<?php
/**
 * StripeController — paiement CB via Stripe PaymentIntent.
 *
 * Routes :
 *   POST /payments/stripe/create-payment-intent   { order_id, guest_token? }
 *   POST /payments/stripe/webhook                 (signature checked)
 *   GET  /shop/payment-config                     (public — pk_*, mode, methods)
 *
 * Flow client :
 *   1. POST /orders → order créée (status awaiting_payment, unpaid)
 *   2. POST /payments/stripe/create-payment-intent → client_secret
 *   3. Frontend mount Stripe Elements + confirmCardPayment(client_secret)
 *   4. Webhook payment_intent.succeeded → orders.payment_status=paid + status=paid
 *
 * Source de vérité = webhook. La confirmation client UI ne fait que poller
 * /orders/:id pour montrer l'état le plus récent.
 *
 * Sécurité :
 *   - Si order.guest_token, on exige le guest_token côté caller
 *   - Sinon on exige le bearer customer correspondant
 *   - Webhook vérifié via stripe-signature header + endpoint secret
 */
class StripeController {

    /** Expose le pk + mode pour Stripe.js. Aucun secret. */
    public static function publicConfig(): void {
        $db = Database::getInstance();
        $keys = ['stripe_pk', 'stripe_mode', 'shop_payment_methods', 'shop_currency', 'ecommerce_enabled'];
        $stmt = $db->prepare('SELECT setting_key, setting_value FROM settings WHERE setting_key IN (' . implode(',', array_fill(0, count($keys), '?')) . ')');
        $stmt->execute($keys);
        $map = [];
        foreach ($stmt->fetchAll() as $r) $map[$r['setting_key']] = $r['setting_value'];

        $methods = json_decode($map['shop_payment_methods'] ?? '[]', true) ?: [];
        json_response([
            'enabled' => ($map['ecommerce_enabled'] ?? '0') === '1',
            'currency' => $map['shop_currency'] ?? 'EUR',
            'payment_methods' => $methods,
            'stripe' => [
                'enabled' => in_array('stripe', $methods, true),
                'pk' => $map['stripe_pk'] ?? '',
                'mode' => $map['stripe_mode'] ?? 'test',
            ],
        ]);
    }

    /** Crée (ou réutilise) un PaymentIntent pour la commande. */
    public static function createPaymentIntent(): void {
        require_ecommerce_enabled();
        $body = get_json_body();
        $orderId = (int) ($body['order_id'] ?? 0);
        if ($orderId <= 0) error_response('order_id requis', 400);

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if (!$order) error_response('Commande introuvable', 404);

        self::authorizeOrder($order, $body['guest_token'] ?? null);

        if ($order['payment_method'] !== 'stripe') {
            error_response('Cette commande n\'est pas réglée par Stripe', 400);
        }
        if (in_array($order['payment_status'], ['paid', 'partially_refunded', 'refunded'], true)) {
            error_response('Commande déjà payée', 409);
        }

        $sk = EcommerceSettingsController::getSecret('stripe_sk');
        if (!$sk) error_response('Stripe non configuré (clé secrète manquante)', 500);

        try {
            \Stripe\Stripe::setApiKey($sk);
            \Stripe\Stripe::setApiVersion('2024-06-20');
        } catch (\Throwable $e) {
            error_response('Init Stripe échoué : ' . $e->getMessage(), 500);
        }

        // Réutilise un PaymentIntent existant pour cette commande si dispo et toujours actif.
        $stmt = $db->prepare("SELECT * FROM payment_intents WHERE order_id = ? AND provider = 'stripe' ORDER BY id DESC LIMIT 1");
        $stmt->execute([$orderId]);
        $existing = $stmt->fetch();
        if ($existing && in_array($existing['status'], ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'], true)) {
            try {
                $pi = \Stripe\PaymentIntent::retrieve($existing['provider_intent_id']);
                if ($pi->amount === (int) $order['total_cents'] && $pi->currency === strtolower($order['currency'])) {
                    json_response([
                        'client_secret' => $pi->client_secret,
                        'payment_intent_id' => $pi->id,
                        'amount' => $pi->amount,
                        'currency' => $pi->currency,
                    ]);
                    return;
                }
                // Montant changé → on annule l'ancien et on en recrée un.
                if ($pi->status !== 'canceled') {
                    try { $pi->cancel(); } catch (\Throwable $e) {}
                }
            } catch (\Throwable $e) { /* on tombe en création */ }
        }

        try {
            $pi = \Stripe\PaymentIntent::create([
                'amount' => (int) $order['total_cents'],
                'currency' => strtolower($order['currency']),
                'metadata' => [
                    'order_id' => (string) $order['id'],
                    'order_number' => $order['order_number'],
                ],
                'description' => 'Commande ' . $order['order_number'],
                'receipt_email' => $order['email'] ?: null,
                'automatic_payment_methods' => ['enabled' => true],
            ]);
        } catch (\Stripe\Exception\ApiErrorException $e) {
            error_log('Stripe createPaymentIntent failed: ' . $e->getMessage());
            error_response('Erreur Stripe : ' . $e->getMessage(), 502);
        }

        $stmt = $db->prepare('INSERT INTO payment_intents (order_id, provider, provider_intent_id, client_secret, amount_cents, currency, status, payment_method_type, raw_response) VALUES (?, "stripe", ?, ?, ?, ?, ?, NULL, ?)');
        $stmt->execute([
            $orderId,
            $pi->id,
            $pi->client_secret,
            $pi->amount,
            strtoupper($pi->currency),
            $pi->status,
            json_encode($pi->toArray(), JSON_UNESCAPED_UNICODE),
        ]);

        $stmt = $db->prepare("UPDATE orders SET payment_status = 'pending' WHERE id = ?");
        $stmt->execute([$orderId]);

        $stmt = $db->prepare('INSERT INTO order_events (order_id, type, payload, actor_type) VALUES (?, "payment_intent_created", ?, "system")');
        $stmt->execute([$orderId, json_encode(['provider' => 'stripe', 'intent_id' => $pi->id], JSON_UNESCAPED_UNICODE)]);

        json_response([
            'client_secret' => $pi->client_secret,
            'payment_intent_id' => $pi->id,
            'amount' => $pi->amount,
            'currency' => $pi->currency,
        ]);
    }

    /**
     * Webhook Stripe : signature checked + idempotent (UNIQUE provider_event_id).
     * Documenter dans le tableau de bord Stripe : URL = /api/payments/stripe/webhook,
     * events = payment_intent.succeeded, payment_intent.payment_failed, charge.refunded.
     */
    public static function webhook(): void {
        $payload = file_get_contents('php://input') ?: '';
        $sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
        $secret = EcommerceSettingsController::getSecret('stripe_webhook_secret');
        if (!$secret) {
            http_response_code(500);
            echo 'Webhook secret missing';
            exit;
        }

        try {
            $event = \Stripe\Webhook::constructEvent($payload, $sigHeader, $secret, 300);
        } catch (\UnexpectedValueException $e) {
            http_response_code(400);
            echo 'Invalid payload';
            exit;
        } catch (\Stripe\Exception\SignatureVerificationException $e) {
            http_response_code(400);
            echo 'Invalid signature';
            exit;
        }

        $db = Database::getInstance();

        // Idempotence : on persiste l'event avec UNIQUE (provider, event_id).
        try {
            $stmt = $db->prepare('INSERT INTO payment_events (provider, event_id, event_type, payload) VALUES ("stripe", ?, ?, ?)');
            $stmt->execute([$event->id, $event->type, json_encode($event->toArray(), JSON_UNESCAPED_UNICODE)]);
        } catch (\PDOException $e) {
            // Duplicate event → already processed.
            if ((int) $e->errorInfo[1] === 1062) {
                http_response_code(200);
                echo 'OK (duplicate)';
                exit;
            }
            error_log('Webhook persist failed: ' . $e->getMessage());
            http_response_code(500);
            echo 'DB error';
            exit;
        }

        try {
            switch ($event->type) {
                case 'payment_intent.succeeded':
                    self::handlePaymentSuccess($db, $event->data->object);
                    break;
                case 'payment_intent.payment_failed':
                    self::handlePaymentFailed($db, $event->data->object);
                    break;
                case 'payment_intent.canceled':
                    self::handlePaymentCanceled($db, $event->data->object);
                    break;
                case 'charge.refunded':
                    self::handleRefund($db, $event->data->object);
                    break;
                default:
                    // Pas d'erreur — on enregistre simplement l'event.
                    break;
            }
            $db->prepare('UPDATE payment_events SET processed_at = NOW() WHERE provider = "stripe" AND event_id = ?')
                ->execute([$event->id]);
        } catch (\Throwable $e) {
            error_log('Webhook handler failed: ' . $e->getMessage());
            $db->prepare('UPDATE payment_events SET processing_error = ? WHERE provider = "stripe" AND event_id = ?')
                ->execute([$e->getMessage(), $event->id]);
            http_response_code(500);
            echo 'Handler error';
            exit;
        }

        http_response_code(200);
        echo 'OK';
        exit;
    }

    private static function handlePaymentSuccess(PDO $db, $intent): void {
        $orderId = (int) ($intent->metadata->order_id ?? 0);
        if (!$orderId) return;

        $db->prepare('UPDATE payment_intents SET status = ?, payment_method_type = ?, raw_response = ? WHERE provider = "stripe" AND provider_intent_id = ?')
            ->execute([
                $intent->status,
                $intent->payment_method_types[0] ?? null,
                json_encode($intent, JSON_UNESCAPED_UNICODE),
                $intent->id,
            ]);

        $db->prepare("UPDATE orders SET status = 'paid', payment_status = 'paid', paid_at = NOW() WHERE id = ? AND payment_status != 'paid'")
            ->execute([$orderId]);

        $db->prepare('INSERT INTO order_events (order_id, type, payload, actor_type) VALUES (?, "payment_succeeded", ?, "webhook")')
            ->execute([$orderId, json_encode(['provider' => 'stripe', 'intent_id' => $intent->id, 'amount' => $intent->amount], JSON_UNESCAPED_UNICODE)]);
    }

    private static function handlePaymentFailed(PDO $db, $intent): void {
        $orderId = (int) ($intent->metadata->order_id ?? 0);
        if (!$orderId) return;

        $db->prepare('UPDATE payment_intents SET status = ?, raw_response = ? WHERE provider = "stripe" AND provider_intent_id = ?')
            ->execute([$intent->status, json_encode($intent, JSON_UNESCAPED_UNICODE), $intent->id]);

        $db->prepare("UPDATE orders SET payment_status = 'failed' WHERE id = ?")
            ->execute([$orderId]);

        $db->prepare('INSERT INTO order_events (order_id, type, payload, actor_type) VALUES (?, "payment_failed", ?, "webhook")')
            ->execute([$orderId, json_encode(['provider' => 'stripe', 'intent_id' => $intent->id, 'last_error' => $intent->last_payment_error->message ?? null], JSON_UNESCAPED_UNICODE)]);
    }

    private static function handlePaymentCanceled(PDO $db, $intent): void {
        $orderId = (int) ($intent->metadata->order_id ?? 0);
        if (!$orderId) return;
        $db->prepare('UPDATE payment_intents SET status = ?, raw_response = ? WHERE provider = "stripe" AND provider_intent_id = ?')
            ->execute([$intent->status, json_encode($intent, JSON_UNESCAPED_UNICODE), $intent->id]);
        $db->prepare('INSERT INTO order_events (order_id, type, payload, actor_type) VALUES (?, "payment_canceled", ?, "webhook")')
            ->execute([$orderId, json_encode(['provider' => 'stripe', 'intent_id' => $intent->id], JSON_UNESCAPED_UNICODE)]);
    }

    private static function handleRefund(PDO $db, $charge): void {
        // charge.refunded → on retrouve l'order via metadata du PaymentIntent.
        $intentId = $charge->payment_intent ?? null;
        if (!$intentId) return;
        $stmt = $db->prepare('SELECT order_id FROM payment_intents WHERE provider = "stripe" AND provider_intent_id = ?');
        $stmt->execute([$intentId]);
        $row = $stmt->fetch();
        if (!$row) return;
        $orderId = (int) $row['order_id'];

        $isFull = $charge->refunded === true || ($charge->amount_refunded ?? 0) >= ($charge->amount ?? 0);
        $newStatus = $isFull ? 'refunded' : 'partially_refunded';
        $db->prepare("UPDATE orders SET payment_status = ? WHERE id = ?")
            ->execute([$newStatus, $orderId]);

        $db->prepare('INSERT INTO order_events (order_id, type, payload, actor_type) VALUES (?, "refunded", ?, "webhook")')
            ->execute([$orderId, json_encode(['provider' => 'stripe', 'charge_id' => $charge->id, 'amount_refunded' => $charge->amount_refunded ?? 0, 'is_full' => $isFull], JSON_UNESCAPED_UNICODE)]);
    }

    /** Auth : customer connecté propriétaire de l'order, OU guest_token correspondant. */
    private static function authorizeOrder(array $order, ?string $guestToken): void {
        $token = get_bearer_token();
        if ($token) {
            try {
                $decoded = \Firebase\JWT\JWT::decode($token, new \Firebase\JWT\Key(customer_jwt_secret(), 'HS256'));
                $claims = (array) $decoded;
                if (($claims['type'] ?? '') === 'customer'
                    && (int) ($claims['id'] ?? 0) === (int) ($order['customer_id'] ?? 0)) {
                    return;
                }
            } catch (\Throwable $e) { /* fallthrough */ }
        }
        if (!empty($guestToken) && hash_equals((string) ($order['guest_token'] ?? ''), (string) $guestToken)) {
            return;
        }
        error_response('Accès refusé', 403);
    }
}
