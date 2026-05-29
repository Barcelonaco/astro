<?php
/**
 * PayPalController — paiement via PayPal Orders API v2.
 *
 * Flow :
 *   1. POST /payments/paypal/create-order   { order_id, guest_token? }
 *      → crée un PayPal order, retourne approval_url (redirect)
 *   2. Frontend redirige vers PayPal (approval_url)
 *   3. PayPal redirige vers /commande/confirmation?order=X&paypal=capture&pp_order=Y
 *   4. Confirmation page calls POST /payments/paypal/capture { paypal_order_id }
 *      → capture le paiement, marque la commande payée
 *   5. POST /payments/paypal/webhook   (backup — signature checked)
 *
 * Clés : paypal_client_id (plain), paypal_secret (encrypted), paypal_mode (sandbox|live).
 */
class PayPalController
{

    private static function getBaseUrl(): string
    {
        $mode = EcommerceSettingsController::getPlain('paypal_mode') ?: 'sandbox';
        return $mode === 'live'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';
    }

    /** Obtient un access token via client_credentials. */
    private static function getAccessToken(): string
    {
        $clientId = EcommerceSettingsController::getPlain('paypal_client_id');
        $secret = EcommerceSettingsController::getSecret('paypal_secret');
        if (!$clientId || !$secret) {
            error_response('PayPal non configure (client_id ou secret manquant)', 500);
        }

        $ch = curl_init(self::getBaseUrl() . '/v1/oauth2/token');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => 'grant_type=client_credentials',
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_USERPWD => $clientId . ':' . $secret,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            error_log('PayPal auth failed: HTTP ' . $httpCode . ' — ' . $response);
            error_response('Echec authentification PayPal', 502);
        }

        $data = json_decode($response, true);
        return $data['access_token'] ?? '';
    }

    /**
     * Crée un PayPal order et retourne l'URL d'approbation.
     * POST /payments/paypal/create-order { order_id, guest_token? }
     */
    public static function createOrder(): void
    {
        require_ecommerce_enabled();
        $body = get_json_body();
        $orderId = (int) ($body['order_id'] ?? 0);
        if ($orderId <= 0)
            error_response('order_id requis', 400);

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if (!$order)
            error_response('Commande introuvable', 404);

        self::authorizeOrder($order, $body['guest_token'] ?? null);

        if ($order['payment_method'] !== 'paypal') {
            error_response('Cette commande n\'est pas reglee par PayPal', 400);
        }
        if (in_array($order['payment_status'], ['paid', 'partially_refunded', 'refunded'], true)) {
            error_response('Commande deja payee', 409);
        }

        // Reuse existing PayPal order if still valid
        $stmt = $db->prepare("SELECT * FROM payment_intents WHERE order_id = ? AND provider = 'paypal' ORDER BY id DESC LIMIT 1");
        $stmt->execute([$orderId]);
        $existing = $stmt->fetch();
        if ($existing && in_array($existing['status'], ['CREATED', 'PAYER_ACTION_REQUIRED'], true)) {
            $raw = json_decode($existing['raw_response'] ?? '{}', true);
            $approvalUrl = '';
            foreach (($raw['links'] ?? []) as $link) {
                if ($link['rel'] === 'approve') {
                    $approvalUrl = $link['href'];
                    break;
                }
            }
            if ($approvalUrl) {
                json_response([
                    'paypal_order_id' => $existing['provider_intent_id'],
                    'approval_url' => $approvalUrl,
                ]);
                return;
            }
        }

        $accessToken = self::getAccessToken();
        $currency = strtoupper($order['currency'] ?: 'EUR');
        $total = number_format((int) $order['total_cents'] / 100, 2, '.', '');

        $frontendUrl = rtrim($_ENV['FRONTEND_URL'] ?? 'http://localhost:4321', '/');
        $guest = !empty($order['guest_token']) ? '&guest_token=' . urlencode($order['guest_token']) : '';
        $returnUrl = $frontendUrl . '/commande/confirmation?order=' . $order['id'] . '&paypal=capture' . $guest;
        $cancelUrl = $frontendUrl . '/commande/confirmation?order=' . $order['id'] . '&paypal=cancel' . $guest;

        $payload = [
            'intent' => 'CAPTURE',
            'purchase_units' => [
                [
                    'reference_id' => (string) $order['id'],
                    'description' => 'Commande ' . $order['order_number'],
                    'custom_id' => (string) $order['id'],
                    'amount' => [
                        'currency_code' => $currency,
                        'value' => $total,
                    ],
                ]
            ],
            'payment_source' => [
                'paypal' => [
                    'experience_context' => [
                        'payment_method_preference' => 'IMMEDIATE_PAYMENT_REQUIRED',
                        'brand_name' => self::getSiteName(),
                        'locale' => 'fr-FR',
                        'landing_page' => 'LOGIN',
                        'user_action' => 'PAY_NOW',
                        'return_url' => $returnUrl,
                        'cancel_url' => $cancelUrl,
                    ],
                ],
            ],
        ];

        $ch = curl_init(self::getBaseUrl() . '/v2/checkout/orders');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $accessToken,
                'PayPal-Request-Id: order-' . $order['id'] . '-' . time(),
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode < 200 || $httpCode >= 300) {
            error_log('PayPal createOrder failed: HTTP ' . $httpCode . ' — ' . $response);
            error_response('Erreur PayPal : impossible de creer la commande', 502);
        }

        $ppOrder = json_decode($response, true);
        $ppOrderId = $ppOrder['id'] ?? '';
        $approvalUrl = '';
        foreach (($ppOrder['links'] ?? []) as $link) {
            if ($link['rel'] === 'payer-action') {
                $approvalUrl = $link['href'];
                break;
            }
        }
        if (!$approvalUrl) {
            foreach (($ppOrder['links'] ?? []) as $link) {
                if ($link['rel'] === 'approve') {
                    $approvalUrl = $link['href'];
                    break;
                }
            }
        }

        // Persist in payment_intents
        $stmt = $db->prepare('INSERT INTO payment_intents (order_id, provider, provider_intent_id, client_secret, amount_cents, currency, status, payment_method_type, raw_response) VALUES (?, "paypal", ?, "", ?, ?, ?, "paypal", ?)');
        $stmt->execute([
            $orderId,
            $ppOrderId,
            (int) $order['total_cents'],
            $currency,
            $ppOrder['status'] ?? 'CREATED',
            json_encode($ppOrder, JSON_UNESCAPED_UNICODE),
        ]);

        $db->prepare("UPDATE orders SET payment_status = 'pending' WHERE id = ?")
            ->execute([$orderId]);

        $db->prepare('INSERT INTO audit_log (entity_type, entity_id, event_type, provider, payload, actor_type) VALUES ("order", ?, "paypal_order_created", "paypal", ?, "system")')
            ->execute([$orderId, json_encode(['paypal_order_id' => $ppOrderId], JSON_UNESCAPED_UNICODE)]);

        json_response([
            'paypal_order_id' => $ppOrderId,
            'approval_url' => $approvalUrl,
        ]);
    }

    /**
     * Capture un PayPal order apres approbation du client.
     * POST /payments/paypal/capture { paypal_order_id, order_id, guest_token? }
     */
    public static function capture(): void
    {
        require_ecommerce_enabled();
        $body = get_json_body();
        $ppOrderId = trim((string) ($body['paypal_order_id'] ?? ''));
        $orderId = (int) ($body['order_id'] ?? 0);
        if (!$ppOrderId || !$orderId)
            error_response('paypal_order_id et order_id requis', 400);

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if (!$order)
            error_response('Commande introuvable', 404);

        self::authorizeOrder($order, $body['guest_token'] ?? null);

        // Already paid?
        if ($order['payment_status'] === 'paid') {
            json_response(['status' => 'already_paid', 'payment_status' => 'paid']);
            return;
        }

        $accessToken = self::getAccessToken();

        $ch = curl_init(self::getBaseUrl() . '/v2/checkout/orders/' . $ppOrderId . '/capture');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => '{}',
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $accessToken,
                'PayPal-Request-Id: capture-' . $orderId . '-' . time(),
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $captureData = json_decode($response, true);

        // Update payment_intents
        $db->prepare('UPDATE payment_intents SET status = ?, raw_response = ? WHERE provider = "paypal" AND provider_intent_id = ?')
            ->execute([
                $captureData['status'] ?? 'UNKNOWN',
                json_encode($captureData, JSON_UNESCAPED_UNICODE),
                $ppOrderId,
            ]);

        if ($httpCode >= 200 && $httpCode < 300 && ($captureData['status'] ?? '') === 'COMPLETED') {
            self::handlePaymentSuccess($db, $orderId, $ppOrderId, $captureData);
            json_response(['status' => 'captured', 'payment_status' => 'paid']);
        } else {
            $db->prepare("UPDATE orders SET payment_status = 'failed' WHERE id = ?")
                ->execute([$orderId]);

            $db->prepare('INSERT INTO audit_log (entity_type, entity_id, event_type, provider, payload, actor_type) VALUES ("order", ?, "paypal_capture_failed", "paypal", ?, "system")')
                ->execute([$orderId, json_encode(['paypal_order_id' => $ppOrderId, 'http_code' => $httpCode, 'response' => $captureData], JSON_UNESCAPED_UNICODE)]);

            error_response('Capture PayPal echouee : ' . ($captureData['message'] ?? 'erreur inconnue'), 502);
        }
    }

    /**
     * Webhook PayPal — backup pour capture missed ou refunds.
     * POST /payments/paypal/webhook
     */
    public static function webhook(): void
    {
        $payload = file_get_contents('php://input') ?: '';
        $headers = self::getWebhookHeaders();
        $webhookId = EcommerceSettingsController::getPlain('paypal_webhook_id');
        $webhookSecret = EcommerceSettingsController::getSecret('paypal_webhook_secret');

        // Verify signature if webhook_id is configured
        if ($webhookId) {
            $valid = self::verifyWebhookSignature($payload, $headers, $webhookId);
            if (!$valid) {
                http_response_code(400);
                echo 'Invalid signature';
                exit;
            }
        }

        $event = json_decode($payload, true);
        if (!$event) {
            http_response_code(400);
            echo 'Invalid JSON';
            exit;
        }

        $eventType = $event['event_type'] ?? '';
        $eventId = $event['id'] ?? '';

        $db = Database::getInstance();

        // Idempotence
        try {
            $stmt = $db->prepare('INSERT INTO audit_log (entity_type, event_type, provider, provider_event_id, payload, actor_type) VALUES ("payment", ?, "paypal", ?, ?, "webhook")');
            $stmt->execute([$eventType, $eventId, json_encode($event, JSON_UNESCAPED_UNICODE)]);
        } catch (\PDOException $e) {
            if ((int) $e->errorInfo[1] === 1062) {
                http_response_code(200);
                echo 'OK (duplicate)';
                exit;
            }
            error_log('PayPal webhook persist failed: ' . $e->getMessage());
            http_response_code(500);
            echo 'DB error';
            exit;
        }

        try {
            switch ($eventType) {
                case 'CHECKOUT.ORDER.APPROVED':
                    // Order approved but not captured yet — frontend should capture.
                    // Backup: auto-capture if frontend missed it.
                    $resource = $event['resource'] ?? [];
                    $ppOrderId = $resource['id'] ?? '';
                    if ($ppOrderId) {
                        $stmt = $db->prepare('SELECT order_id FROM payment_intents WHERE provider = "paypal" AND provider_intent_id = ?');
                        $stmt->execute([$ppOrderId]);
                        $row = $stmt->fetch();
                        if ($row) {
                            $orderCheck = $db->prepare("SELECT payment_status FROM orders WHERE id = ?");
                            $orderCheck->execute([$row['order_id']]);
                            $currentStatus = $orderCheck->fetchColumn();
                            if ($currentStatus !== 'paid') {
                                // Auto-capture
                                self::autoCaptureFromWebhook($ppOrderId, (int) $row['order_id']);
                            }
                        }
                    }
                    break;

                case 'PAYMENT.CAPTURE.COMPLETED':
                    $resource = $event['resource'] ?? [];
                    $ppOrderId = $resource['supplementary_data']['related_ids']['order_id'] ?? '';
                    if ($ppOrderId) {
                        $stmt = $db->prepare('SELECT order_id FROM payment_intents WHERE provider = "paypal" AND provider_intent_id = ?');
                        $stmt->execute([$ppOrderId]);
                        $row = $stmt->fetch();
                        if ($row) {
                            self::handlePaymentSuccess($db, (int) $row['order_id'], $ppOrderId, $resource);
                        }
                    }
                    break;

                case 'PAYMENT.CAPTURE.DENIED':
                case 'PAYMENT.CAPTURE.DECLINED':
                    $resource = $event['resource'] ?? [];
                    $ppOrderId = $resource['supplementary_data']['related_ids']['order_id'] ?? '';
                    if ($ppOrderId) {
                        $stmt = $db->prepare('SELECT order_id FROM payment_intents WHERE provider = "paypal" AND provider_intent_id = ?');
                        $stmt->execute([$ppOrderId]);
                        $row = $stmt->fetch();
                        if ($row) {
                            $db->prepare("UPDATE orders SET payment_status = 'failed' WHERE id = ?")
                                ->execute([$row['order_id']]);
                        }
                    }
                    break;

                case 'PAYMENT.CAPTURE.REFUNDED':
                    $resource = $event['resource'] ?? [];
                    $ppOrderId = $resource['supplementary_data']['related_ids']['order_id'] ?? '';
                    if ($ppOrderId) {
                        $stmt = $db->prepare('SELECT order_id FROM payment_intents WHERE provider = "paypal" AND provider_intent_id = ?');
                        $stmt->execute([$ppOrderId]);
                        $row = $stmt->fetch();
                        if ($row) {
                            $db->prepare("UPDATE orders SET payment_status = 'refunded' WHERE id = ?")
                                ->execute([$row['order_id']]);
                        }
                    }
                    break;
            }

            $db->prepare('UPDATE audit_log SET processed_at = NOW() WHERE provider = "paypal" AND provider_event_id = ?')
                ->execute([$eventId]);
        } catch (\Throwable $e) {
            error_log('PayPal webhook handler failed: ' . $e->getMessage());
            $db->prepare('UPDATE audit_log SET processing_error = ? WHERE provider = "paypal" AND provider_event_id = ?')
                ->execute([$e->getMessage(), $eventId]);
            http_response_code(500);
            echo 'Handler error';
            exit;
        }

        http_response_code(200);
        echo 'OK';
        exit;
    }

    /**
     * GET /payments/paypal/check-status?order_id=X&guest_token=Y
     * Fallback polling quand le webhook n'est pas encore arrive.
     */
    public static function checkStatus(): void
    {
        require_ecommerce_enabled();
        $orderId = (int) ($_GET['order_id'] ?? 0);
        if (!$orderId)
            error_response('order_id requis', 400);

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if (!$order)
            error_response('Commande introuvable', 404);

        // Already resolved
        if (in_array($order['payment_status'], ['paid', 'failed', 'refunded'], true)) {
            json_response(['payment_status' => $order['payment_status'], 'synced' => false]);
            return;
        }

        // Find PayPal order
        $stmt = $db->prepare('SELECT provider_intent_id FROM payment_intents WHERE order_id = ? AND provider = "paypal" ORDER BY id DESC LIMIT 1');
        $stmt->execute([$orderId]);
        $ppOrderId = $stmt->fetchColumn();
        if (!$ppOrderId) {
            json_response(['payment_status' => $order['payment_status'], 'synced' => false]);
            return;
        }

        // Query PayPal API
        try {
            $accessToken = self::getAccessToken();
            $ch = curl_init(self::getBaseUrl() . '/v2/checkout/orders/' . $ppOrderId);
            curl_setopt_array($ch, [
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $accessToken,
                ],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 10,
            ]);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode !== 200) {
                json_response(['payment_status' => $order['payment_status'], 'synced' => false]);
                return;
            }

            $ppOrder = json_decode($response, true);
            if (($ppOrder['status'] ?? '') === 'COMPLETED') {
                self::handlePaymentSuccess($db, $orderId, $ppOrderId, $ppOrder);
                json_response(['payment_status' => 'paid', 'synced' => true]);
                return;
            }
        } catch (\Throwable $e) {
            error_log('PayPal checkStatus error: ' . $e->getMessage());
        }

        json_response(['payment_status' => $order['payment_status'], 'synced' => false]);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private static function handlePaymentSuccess(PDO $db, int $orderId, string $ppOrderId, array $captureData): void
    {
        $stmt = $db->prepare("SELECT payment_status FROM orders WHERE id = ?");
        $stmt->execute([$orderId]);
        $current = $stmt->fetchColumn();

        $db->prepare("UPDATE orders SET status = 'paid', payment_status = 'paid', paid_at = NOW() WHERE id = ? AND payment_status != 'paid'")
            ->execute([$orderId]);

        $db->prepare('UPDATE payment_intents SET status = "COMPLETED" WHERE provider = "paypal" AND provider_intent_id = ?')
            ->execute([$ppOrderId]);

        $db->prepare('INSERT INTO audit_log (entity_type, entity_id, event_type, provider, payload, actor_type) VALUES ("order", ?, "payment_succeeded", "paypal", ?, "system")')
            ->execute([$orderId, json_encode(['paypal_order_id' => $ppOrderId], JSON_UNESCAPED_UNICODE)]);

        if ($current !== 'paid') {
            try {
                $order = OrderController::loadFullStatic($orderId);
                if ($order) {
                    OrderMailer::sendOrderConfirmation($order);
                    OrderMailer::sendAdminOrderNotif($order);
                }
            } catch (\Throwable $e) {
                error_log('OrderMailer error (PayPal): ' . $e->getMessage());
            }

            InvoiceController::autoGenerateOnPayment($orderId);
            InvoiceController::sendInvoiceEmail($orderId);

            try {
                $stmt2 = $db->prepare('SELECT customer_id FROM orders WHERE id = ?');
                $stmt2->execute([$orderId]);
                $cid = $stmt2->fetchColumn();
                if ($cid)
                    ProTierService::recalculateForCustomer((int) $cid);
            } catch (\Throwable $e) {
                error_log('ProTierService recalc error (PayPal): ' . $e->getMessage());
            }
        }
    }

    private static function autoCaptureFromWebhook(string $ppOrderId, int $orderId): void
    {
        try {
            $accessToken = self::getAccessToken();
            $ch = curl_init(self::getBaseUrl() . '/v2/checkout/orders/' . $ppOrderId . '/capture');
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => '{}',
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $accessToken,
                ],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 15,
            ]);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            $captureData = json_decode($response, true);
            if ($httpCode >= 200 && $httpCode < 300 && ($captureData['status'] ?? '') === 'COMPLETED') {
                $db = Database::getInstance();
                self::handlePaymentSuccess($db, $orderId, $ppOrderId, $captureData);
            }
        } catch (\Throwable $e) {
            error_log('PayPal auto-capture from webhook failed: ' . $e->getMessage());
        }
    }

    private static function authorizeOrder(array $order, ?string $guestToken): void
    {
        $token = get_bearer_token();
        if ($token) {
            try {
                $decoded = \Firebase\JWT\JWT::decode($token, new \Firebase\JWT\Key(customer_jwt_secret(), 'HS256'));
                $claims = (array) $decoded;
                if (
                    ($claims['type'] ?? '') === 'customer'
                    && (int) ($claims['id'] ?? 0) === (int) ($order['customer_id'] ?? 0)
                ) {
                    return;
                }
            } catch (\Throwable $e) { /* fallthrough */
            }
        }
        if (!empty($guestToken) && hash_equals((string) ($order['guest_token'] ?? ''), (string) $guestToken)) {
            return;
        }
        error_response('Acces refusé', 403);
    }

    private static function getSiteName(): string
    {
        $stmt = Database::getInstance()->prepare("SELECT setting_value FROM settings WHERE setting_key = 'site_name' LIMIT 1");
        $stmt->execute();
        return $stmt->fetchColumn() ?: 'Boutique';
    }

    private static function getWebhookHeaders(): array
    {
        return [
            'PAYPAL-TRANSMISSION-ID' => $_SERVER['HTTP_PAYPAL_TRANSMISSION_ID'] ?? '',
            'PAYPAL-TRANSMISSION-TIME' => $_SERVER['HTTP_PAYPAL_TRANSMISSION_TIME'] ?? '',
            'PAYPAL-TRANSMISSION-SIG' => $_SERVER['HTTP_PAYPAL_TRANSMISSION_SIG'] ?? '',
            'PAYPAL-CERT-URL' => $_SERVER['HTTP_PAYPAL_CERT_URL'] ?? '',
            'PAYPAL-AUTH-ALGO' => $_SERVER['HTTP_PAYPAL_AUTH_ALGO'] ?? '',
        ];
    }

    private static function verifyWebhookSignature(string $payload, array $headers, string $webhookId): bool
    {
        try {
            $accessToken = self::getAccessToken();
            $verifyPayload = [
                'auth_algo' => $headers['PAYPAL-AUTH-ALGO'],
                'cert_url' => $headers['PAYPAL-CERT-URL'],
                'transmission_id' => $headers['PAYPAL-TRANSMISSION-ID'],
                'transmission_sig' => $headers['PAYPAL-TRANSMISSION-SIG'],
                'transmission_time' => $headers['PAYPAL-TRANSMISSION-TIME'],
                'webhook_id' => $webhookId,
                'webhook_event' => json_decode($payload, true),
            ];

            $ch = curl_init(self::getBaseUrl() . '/v1/notifications/verify-webhook-signature');
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode($verifyPayload, JSON_UNESCAPED_UNICODE),
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $accessToken,
                ],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 15,
            ]);
            $response = curl_exec($ch);
            curl_close($ch);

            $result = json_decode($response, true);
            return ($result['verification_status'] ?? '') === 'SUCCESS';
        } catch (\Throwable $e) {
            error_log('PayPal webhook verification failed: ' . $e->getMessage());
            return false;
        }
    }
}
