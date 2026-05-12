<?php
/**
 * SEPAController — SEPA Direct Debit via Stripe.
 *
 * Flow:
 *   1. POST /payments/sepa/setup-intent         → Stripe SetupIntent (collecte mandat)
 *   2. Client confirme mandat via Stripe Elements (iban_element)
 *   3. Webhook setup_intent.succeeded            → mandate active
 *   4. POST /payments/sepa/charge { order_id }   → PaymentIntent off-session (debit automatique)
 *   5. Webhook payment_intent.succeeded          → order paid
 *
 * Gates:
 *   - Customer must be pro approved
 *   - Customer must have >= 1 paid order (first order CB only)
 *   - Mandate must be validated (status = 'active')
 *
 * Routes:
 *   POST /payments/sepa/setup-intent          (auth customer pro)
 *   GET  /payments/sepa/mandates              (auth customer — list own mandates)
 *   POST /payments/sepa/charge                { order_id } (auth customer pro, active mandate)
 *   POST /payments/sepa/webhook               (Stripe signature)
 *   GET  /admin/sepa/mandates                 (admin — list all)
 *   PUT  /admin/sepa/mandates/:id             { status: 'active'|'revoked' } (admin validation)
 */
class SEPAController {

    /** Create a Stripe SetupIntent for SEPA Direct Debit mandate collection. */
    public static function createSetupIntent(): void {
        require_ecommerce_enabled();
        $customer = authenticate_customer();
        self::requireProApproved($customer);
        self::requireNotFirstOrder($customer);

        $sk = EcommerceSettingsController::getStripeKey('sk');
        if (!$sk) error_response('Stripe non configure', 500);

        \Stripe\Stripe::setApiKey($sk);
        \Stripe\Stripe::setApiVersion('2024-06-20');

        $db = Database::getInstance();

        try {
            // Create or retrieve Stripe Customer
            $stripeCustomerId = self::getOrCreateStripeCustomer($customer, $db);

            $si = \Stripe\SetupIntent::create([
                'customer' => $stripeCustomerId,
                'payment_method_types' => ['sepa_debit'],
                'metadata' => [
                    'customer_id' => (string) $customer['id'],
                    'email' => $customer['email'],
                ],
            ]);

            json_response([
                'client_secret' => $si->client_secret,
                'setup_intent_id' => $si->id,
            ]);
        } catch (\Stripe\Exception\ApiErrorException $e) {
            error_response('Erreur Stripe : ' . $e->getMessage(), 502);
        }
    }

    /** List customer's SEPA mandates. */
    public static function listMandates(): void {
        require_ecommerce_enabled();
        $customer = authenticate_customer();

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id, status, iban_last4, bank_name, mandate_reference, created_at, validated_at, revoked_at FROM sepa_mandates WHERE customer_id = ? ORDER BY created_at DESC');
        $stmt->execute([$customer['id']]);
        json_response(['mandates' => $stmt->fetchAll()]);
    }

    /** Charge an order via SEPA off-session using customer's active mandate. */
    public static function charge(): void {
        require_ecommerce_enabled();
        $customer = authenticate_customer();
        self::requireProApproved($customer);

        $body = get_json_body();
        $orderId = (int) ($body['order_id'] ?? 0);
        if ($orderId <= 0) error_response('order_id requis', 400);

        $db = Database::getInstance();

        // Verify order belongs to customer
        $stmt = $db->prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?');
        $stmt->execute([$orderId, $customer['id']]);
        $order = $stmt->fetch();
        if (!$order) error_response('Commande introuvable', 404);

        if ($order['payment_method'] !== 'on_invoice') {
            error_response('Cette commande n\'utilise pas le paiement par prelevement', 400);
        }
        if (in_array($order['payment_status'], ['paid', 'partially_refunded', 'refunded'], true)) {
            error_response('Commande deja payee', 409);
        }

        // Get active mandate
        $stmt = $db->prepare("SELECT * FROM sepa_mandates WHERE customer_id = ? AND status = 'active' ORDER BY validated_at DESC LIMIT 1");
        $stmt->execute([$customer['id']]);
        $mandate = $stmt->fetch();
        if (!$mandate) error_response('Aucun mandat SEPA actif. Veuillez configurer un prelevement dans votre espace client.', 400);

        $sk = EcommerceSettingsController::getStripeKey('sk');
        if (!$sk) error_response('Stripe non configure', 500);

        \Stripe\Stripe::setApiKey($sk);
        \Stripe\Stripe::setApiVersion('2024-06-20');

        try {
            $pi = \Stripe\PaymentIntent::create([
                'amount' => (int) $order['total_cents'],
                'currency' => strtolower($order['currency']),
                'customer' => $mandate['stripe_customer_id'],
                'payment_method' => $mandate['stripe_payment_method_id'],
                'payment_method_types' => ['sepa_debit'],
                'off_session' => true,
                'confirm' => true,
                'metadata' => [
                    'order_id' => (string) $order['id'],
                    'order_number' => $order['order_number'],
                    'mandate_id' => (string) $mandate['id'],
                ],
                'description' => 'Prelevement SEPA — Commande ' . $order['order_number'],
            ]);

            // Store payment intent
            $db->prepare('INSERT INTO payment_intents (order_id, provider, provider_intent_id, client_secret, amount_cents, currency, status, payment_method_type, raw_response) VALUES (?, "stripe", ?, NULL, ?, ?, ?, "sepa_debit", ?)')
                ->execute([$orderId, $pi->id, $pi->amount, strtoupper($pi->currency), $pi->status, json_encode($pi->toArray(), JSON_UNESCAPED_UNICODE)]);

            $db->prepare("UPDATE orders SET payment_status = 'pending' WHERE id = ?")
                ->execute([$orderId]);

            $db->prepare('INSERT INTO audit_log (entity_type, entity_id, event_type, provider, payload, actor_type) VALUES ("order", ?, "sepa_charge_initiated", "stripe", ?, "customer")')
                ->execute([$orderId, json_encode(['intent_id' => $pi->id, 'mandate_id' => $mandate['id']])]);

            json_response([
                'status' => $pi->status,
                'payment_intent_id' => $pi->id,
                'message' => 'Prelevement SEPA initie. Le debit sera effectif sous 5 jours ouvrables.',
            ]);
        } catch (\Stripe\Exception\ApiErrorException $e) {
            error_response('Erreur Stripe : ' . $e->getMessage(), 502);
        }
    }

    /** Webhook: handle SEPA-specific events. */
    public static function webhook(): void {
        // Reuse StripeController webhook for SEPA events — they come on the same endpoint.
        // This method handles setup_intent.succeeded specifically for mandate creation.
        // payment_intent.succeeded/failed are already handled by StripeController.
        StripeController::webhook();
    }

    // ── Admin ─────────────────────────────────────────────────────────────

    /** List all mandates (admin). */
    public static function adminListMandates(): void {
        $db = Database::getInstance();
        $where = ['1 = 1'];
        $params = [];

        if (!empty($_GET['status'])) {
            $where[] = 'm.status = ?';
            $params[] = $_GET['status'];
        }

        $stmt = $db->prepare('
            SELECT m.*, c.email, c.first_name, c.last_name, c.company
            FROM sepa_mandates m
            LEFT JOIN customers c ON c.id = m.customer_id
            WHERE ' . implode(' AND ', $where) . '
            ORDER BY m.created_at DESC
            LIMIT 100
        ');
        $stmt->execute($params);
        json_response(['mandates' => $stmt->fetchAll()]);
    }

    /** Admin: validate or revoke a mandate. */
    public static function adminUpdateMandate(int $id): void {
        $db = Database::getInstance();
        $body = get_json_body();

        $stmt = $db->prepare('SELECT * FROM sepa_mandates WHERE id = ?');
        $stmt->execute([$id]);
        $mandate = $stmt->fetch();
        if (!$mandate) error_response('Mandat introuvable', 404);

        $newStatus = $body['status'] ?? '';
        if (!in_array($newStatus, ['active', 'revoked'], true)) {
            error_response('Statut invalide (active ou revoked)', 400);
        }

        $fields = ['status = ?'];
        $values = [$newStatus];

        if ($newStatus === 'active') {
            $fields[] = 'validated_at = NOW()';
        } elseif ($newStatus === 'revoked') {
            $fields[] = 'revoked_at = NOW()';
        }

        $values[] = $id;
        $db->prepare('UPDATE sepa_mandates SET ' . implode(', ', $fields) . ' WHERE id = ?')
            ->execute($values);

        $user = authenticate_token();
        $db->prepare('INSERT INTO audit_log (entity_type, entity_id, event_type, payload, actor_type, actor_id) VALUES ("sepa_mandate", ?, "admin_status_change", ?, "admin", ?)')
            ->execute([$id, json_encode(['from' => $mandate['status'], 'to' => $newStatus]), $user['id'] ?? null]);

        json_response(['message' => 'Mandat mis a jour']);
    }

    // ── Internal ──────────────────────────────────────────────────────────

    private static function requireProApproved(array $customer): void {
        if (empty($customer['is_pro']) || ($customer['pro_status'] ?? '') !== 'approved') {
            error_response('Le prelevement SEPA est reserve aux comptes professionnels approuves.', 403);
        }
    }

    private static function requireNotFirstOrder(array $customer): void {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT COUNT(*) AS c FROM orders WHERE customer_id = ? AND payment_status IN ('paid', 'partially_refunded')");
        $stmt->execute([$customer['id']]);
        if ((int) $stmt->fetch()['c'] === 0) {
            error_response('Le prelevement SEPA est disponible a partir de votre 2e commande. La premiere commande doit etre reglee par carte bancaire.', 403);
        }
    }

    private static function getOrCreateStripeCustomer(array $customer, \PDO $db): string {
        // Check if customer already has a Stripe customer ID
        $stmt = $db->prepare("SELECT stripe_customer_id FROM sepa_mandates WHERE customer_id = ? AND stripe_customer_id IS NOT NULL LIMIT 1");
        $stmt->execute([$customer['id']]);
        $existing = $stmt->fetch();
        if ($existing && $existing['stripe_customer_id']) {
            return $existing['stripe_customer_id'];
        }

        // Create Stripe Customer
        $sc = \Stripe\Customer::create([
            'email' => $customer['email'],
            'name' => trim(($customer['first_name'] ?? '') . ' ' . ($customer['last_name'] ?? '')),
            'metadata' => [
                'customer_id' => (string) $customer['id'],
                'company' => $customer['company'] ?? '',
            ],
        ]);

        return $sc->id;
    }

    /**
     * Called by StripeController webhook when setup_intent.succeeded fires.
     * Extracts SEPA mandate info and stores it in sepa_mandates.
     */
    public static function handleSetupIntentSucceeded(\PDO $db, $setupIntent): void {
        $customerId = (int) ($setupIntent->metadata->customer_id ?? 0);
        if (!$customerId) return;

        $pmId = $setupIntent->payment_method;
        if (!$pmId) return;

        $sk = EcommerceSettingsController::getStripeKey('sk');
        if (!$sk) return;

        \Stripe\Stripe::setApiKey($sk);

        try {
            $pm = \Stripe\PaymentMethod::retrieve($pmId);
            $sepa = $pm->sepa_debit ?? null;

            $stmt = $db->prepare('INSERT INTO sepa_mandates
                (customer_id, stripe_customer_id, stripe_payment_method_id, stripe_setup_intent_id,
                 iban_last4, bank_name, mandate_reference, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, "pending_validation")');
            $stmt->execute([
                $customerId,
                $setupIntent->customer,
                $pmId,
                $setupIntent->id,
                $sepa->last4 ?? null,
                $sepa->bank_code ?? null,
                $sepa->mandate_reference ?? $setupIntent->mandate ?? null,
                // Status = pending_validation — admin must approve
            ]);

            $db->prepare('INSERT INTO audit_log (entity_type, entity_id, event_type, provider, payload, actor_type) VALUES ("sepa_mandate", ?, "mandate_created", "stripe", ?, "webhook")')
                ->execute([$db->lastInsertId(), json_encode(['setup_intent' => $setupIntent->id, 'pm' => $pmId])]);

        } catch (\Throwable $e) {
            error_log('SEPA handleSetupIntentSucceeded failed: ' . $e->getMessage());
        }
    }
}
