<?php
/**
 * OrderController — création + lecture des commandes.
 *
 * Routes :
 *   POST /orders                     { addresses, shipping_method_id, payment_method, notes? }
 *   GET  /orders/:id                 (auth customer ou guest_token=)
 *   GET  /orders/by-number/:number   (auth ou guest_token)
 *   GET  /orders                     (auth customer — liste personnelle)
 *
 * Création :
 *   - Snapshot complet du panier (items + custom_items) → order_items
 *   - Adresses billing + shipping → orders.billing_address + orders.shipping_address (JSON)
 *   - Calcule subtotal / shipping / tax / total
 *   - Vide le panier source (cart_items + cart_items_custom)
 *   - Status = 'awaiting_payment', payment_status = 'unpaid'
 *
 * Note : intégration paiement Stripe est à la charge de PaymentController (à faire).
 * Pour l'instant, l'order est créée en attente, et un paiement on_invoice ou
 * bank_transfer la fait passer en 'pending' puis 'paid' manuellement (admin).
 */
class OrderController {

    public static function create(): void {
        $body = get_json_body();

        $cart = self::resolveCart();
        if (!$cart) error_response('Panier introuvable', 404);

        $items = CartController::getItems((int) $cart['id']);
        $custom = CartController::getCustomItems((int) $cart['id']);
        if (empty($items) && empty($custom)) error_response('Panier vide', 400);

        $billing = self::validateAddress($body['billing'] ?? null, 'billing');
        $shipping = self::validateAddress($body['shipping'] ?? $body['billing'] ?? null, 'shipping');

        $shippingMethodId = (int) ($body['shipping_method_id'] ?? 0);
        $shippingMethod = self::loadShippingMethod($shippingMethodId);

        $paymentMethod = (string) ($body['payment_method'] ?? 'stripe');
        if (!in_array($paymentMethod, ['stripe', 'paypal', 'bank_transfer', 'on_invoice'], true)) {
            error_response('Méthode de paiement invalide', 400);
        }

        // Première commande comptant CB obligatoire (CDC §5.3)
        $customerId = self::optionalCustomerId();
        $isFirstOrder = self::isFirstOrder($customerId, (string) $billing['email']);
        if ($isFirstOrder && $paymentMethod === 'on_invoice') {
            error_response('Le paiement différé n\'est disponible qu\'à partir de la 2e commande.', 403);
        }

        // Resolve tax context based on billing country + customer pro status
        $isPro = false;
        $vatNumber = null;
        if ($customerId) {
            $customerData = CustomerModel::findById($customerId);
            if ($customerData) {
                $isPro = !empty($customerData['is_pro']) && ($customerData['pro_status'] ?? '') === 'approved';
                $vatNumber = $customerData['vat_number'] ?? null;
            }
        }
        $taxContext = TaxResolver::resolve($billing['country_code'] ?? 'FR', $isPro, $vatNumber);

        $totals = CartController::computeTotals((int) $cart['id'], $taxContext);
        $shippingPrice = $shippingMethod ? self::resolveShippingPrice($shippingMethod, $totals['subtotal_cents'], $items, $custom) : 0;

        $db = Database::getInstance();
        $db->beginTransaction();
        try {
            $orderNumber = self::generateOrderNumber();
            $stmt = $db->prepare('INSERT INTO orders
                (order_number, customer_id, email, status, payment_status, payment_method, currency,
                 subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, tax_breakdown,
                 coupon_code, shipping_method_id, shipping_method_label, notes, ip_address, placed_at, guest_token)
                VALUES (?, ?, ?, "awaiting_payment", "unpaid", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)');
            $guestToken = $customerId ? null : bin2hex(random_bytes(24));
            $totalCents = $totals['subtotal_cents'] + $shippingPrice + $totals['tax_cents'];
            // Include tax mention in breakdown for invoicing
            $taxBreakdownFull = $totals['tax_breakdown'];
            if (!empty($taxContext['mention'])) {
                $taxBreakdownFull['_mention'] = $taxContext['mention'];
                $taxBreakdownFull['_reason'] = $taxContext['reason'];
            }
            $stmt->execute([
                $orderNumber,
                $customerId,
                $billing['email'],
                $paymentMethod,
                $cart['currency'] ?? 'EUR',
                $totals['subtotal_cents'],
                0,
                $shippingPrice,
                $totals['tax_cents'],
                $totalCents,
                json_encode($taxBreakdownFull, JSON_UNESCAPED_UNICODE),
                $cart['coupon_code'] ?? null,
                $shippingMethodId ?: null,
                $shippingMethod['name'] ?? null,
                trim((string) ($body['notes'] ?? '')) ?: null,
                $_SERVER['REMOTE_ADDR'] ?? null,
                $guestToken,
            ]);
            $orderId = (int) $db->lastInsertId();

            $db->prepare('UPDATE orders SET billing_address = ?, shipping_address = ? WHERE id = ?')->execute([
                json_encode($billing, JSON_UNESCAPED_UNICODE),
                json_encode($shipping, JSON_UNESCAPED_UNICODE),
                $orderId,
            ]);

            // Regular shop items : prix TTC, on extrait la TVA contenue (même logique que custom items).
            foreach ($items as $line) {
                $rate = self::taxRate($line['tax_code'] ?? 'FR_STANDARD');
                $lineTtc = (int) $line['line_total_cents'];
                $lineHt = (int) round($lineTtc / (1 + $rate / 100));
                $lineTax = $lineTtc - $lineHt;
                $unitTtc = (int) $line['unit_price_cents'];
                $unitHt = (int) round($unitTtc / (1 + $rate / 100));
                $stmt = $db->prepare('INSERT INTO order_items
                    (order_id, product_id, variant_id, sku, product_title, variant_attributes, quantity,
                     unit_price_cents, tax_rate, line_subtotal_cents, line_tax_cents, line_total_cents,
                     is_digital, requires_shipping)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([
                    $orderId,
                    $line['product_id'],
                    $line['variant_id'],
                    $line['sku'],
                    $line['product_title'],
                    json_encode($line['attributes'] ?? [], JSON_UNESCAPED_UNICODE),
                    $line['quantity'],
                    $unitHt,
                    $rate,
                    $lineHt,
                    $lineTax,
                    $lineTtc,
                    $line['is_digital'] ? 1 : 0,
                    $line['requires_shipping'] ? 1 : 0,
                ]);
            }

            // Custom items (POOLP) : prix TTC, on extrait la TVA contenue.
            foreach ($custom as $line) {
                $rate = self::taxRate($line['tax_code'] ?? 'FR_STANDARD');
                $lineTtc = (int) $line['line_total_cents'];
                $lineHt = (int) round($lineTtc / (1 + $rate / 100));
                $lineTax = $lineTtc - $lineHt;
                $sku = sprintf('CUSTOM-%s-%d', $line['source_type'] ?? 'item', $line['source_id'] ?? 0);
                $stmt = $db->prepare('INSERT INTO order_items
                    (order_id, product_id, variant_id, sku, product_title, variant_attributes, quantity,
                     unit_price_cents, tax_rate, line_subtotal_cents, line_tax_cents, line_total_cents,
                     is_digital, requires_shipping)
                    VALUES (?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)');
                $stmt->execute([
                    $orderId,
                    $sku,
                    $line['title'],
                    json_encode(['source_type' => $line['source_type'] ?? null, 'source_id' => $line['source_id'] ?? null, 'config_snapshot' => $line['config_snapshot'] ?? null], JSON_UNESCAPED_UNICODE),
                    $line['quantity'],
                    $lineHt,  // unit HT pour cohérence
                    $rate,
                    $lineHt * (int) $line['quantity'],
                    $lineTax * (int) $line['quantity'],
                    $lineTtc,
                ]);
            }

            $stmt = $db->prepare('INSERT INTO audit_log (entity_type, entity_id, event_type, payload, actor_type) VALUES ("order", ?, "created", ?, "customer")');
            $stmt->execute([$orderId, json_encode(['ip' => $_SERVER['REMOTE_ADDR'] ?? null], JSON_UNESCAPED_UNICODE)]);

            // Vide le panier
            $db->prepare('DELETE FROM cart_items WHERE cart_id = ?')->execute([$cart['id']]);
            $db->prepare('DELETE FROM cart_items_custom WHERE cart_id = ?')->execute([$cart['id']]);

            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            error_log('Order creation failed: ' . $e->getMessage());
            error_response('Erreur lors de la création de la commande', 500);
        }

        $order = self::loadFull($orderId);
        json_response($order, 201);
    }

    public static function getById(int $id): void {
        $order = self::loadFull($id);
        if (!$order) error_response('Commande introuvable', 404);
        self::authorize($order);
        json_response($order);
    }

    public static function getByNumber(string $number): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id FROM orders WHERE order_number = ?');
        $stmt->execute([$number]);
        $row = $stmt->fetch();
        if (!$row) error_response('Commande introuvable', 404);
        self::getById((int) $row['id']);
    }

    public static function listMine(): void {
        $customer = authenticate_customer();
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id, order_number, status, payment_status, total_cents, currency, placed_at, paid_at, shipped_at, delivered_at FROM orders WHERE customer_id = ? ORDER BY placed_at DESC LIMIT 200');
        $stmt->execute([$customer['id']]);
        json_response(['orders' => $stmt->fetchAll()]);
    }

    /**
     * GET /orders/track?number=CMD-xxx&email=xxx
     * Public — lookup by order_number + email (no auth needed).
     * Rate limited to prevent enumeration.
     */
    public static function track(): void {
        // Rate limit par IP : 5 tentatives / 5min
        check_rate_limit('order_track', 5, 300);

        $number = trim((string) ($_GET['number'] ?? ''));
        $email = trim(strtolower((string) ($_GET['email'] ?? '')));

        if ($number === '' || $email === '') {
            error_response('Numero de commande et email requis', 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            error_response('Email invalide', 400);
        }

        // Rate limit par email : 5 tentatives / 15min (anti brute-force cible)
        check_rate_limit('order_track_' . md5($email), 5, 900);

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id, guest_token FROM orders WHERE order_number = ? AND LOWER(email) = ?');
        $stmt->execute([$number, $email]);
        $row = $stmt->fetch();

        if (!$row) {
            // Delay constant pour eviter le timing attack (reponse toujours ~500ms)
            usleep(random_int(400000, 600000));
            error_response('Aucune commande trouvee avec ces informations', 404);
        }

        $order = self::loadFull((int) $row['id']);
        if (!$order) error_response('Commande introuvable', 404);

        // Strip guest_token from response (no need to expose it)
        unset($order['guest_token']);

        json_response($order);
    }

    // ── Internal ───────────────────────────────────────────────────────────

    /** Accessible en interne (ex: OrderMailer). */
    public static function loadFullStatic(int $id): ?array {
        return self::loadFull($id);
    }

    private static function loadFull(int $id): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$id]);
        $order = $stmt->fetch();
        if (!$order) return null;

        $stmt = $db->prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC');
        $stmt->execute([$id]);
        $items = $stmt->fetchAll();
        foreach ($items as &$it) {
            $it['variant_attributes'] = $it['variant_attributes'] ? (is_string($it['variant_attributes']) ? json_decode($it['variant_attributes'], true) : $it['variant_attributes']) : [];
        }
        unset($it);

        $order['items'] = $items;
        $order['billing_address']  = $order['billing_address']  ? (is_string($order['billing_address'])  ? json_decode($order['billing_address'],  true) : $order['billing_address'])  : null;
        $order['shipping_address'] = $order['shipping_address'] ? (is_string($order['shipping_address']) ? json_decode($order['shipping_address'], true) : $order['shipping_address']) : null;
        $order['tax_breakdown']    = $order['tax_breakdown']    ? (is_string($order['tax_breakdown'])    ? json_decode($order['tax_breakdown'],    true) : $order['tax_breakdown'])    : [];
        return $order;
    }

    private static function authorize(array $order): void {
        $customerId = self::optionalCustomerId();
        if ($customerId && (int) ($order['customer_id'] ?? 0) === $customerId) return;
        $guestToken = trim((string) ($_GET['guest_token'] ?? ''));
        if ($guestToken !== '' && hash_equals((string) ($order['guest_token'] ?? ''), $guestToken)) return;
        // Admin
        $bearer = get_bearer_token();
        if ($bearer) {
            try {
                $decoded = \Firebase\JWT\JWT::decode($bearer, new \Firebase\JWT\Key($_ENV['JWT_SECRET'] ?? '', 'HS256'));
                $claims = (array) $decoded;
                if (in_array($claims['role'] ?? '', ['admin', 'editor'], true)) return;
            } catch (\Throwable $e) {}
        }
        error_response('Accès refusé', 403);
    }

    private static function resolveCart(): ?array {
        $token = trim((string) ($_SERVER['HTTP_X_CART_TOKEN'] ?? ''));
        if ($token !== '') {
            return CartController::loadByToken($token);
        }
        $customerId = self::optionalCustomerId();
        if ($customerId) {
            $db = Database::getInstance();
            $stmt = $db->prepare('SELECT * FROM carts WHERE customer_id = ? AND expires_at > NOW() ORDER BY updated_at DESC LIMIT 1');
            $stmt->execute([$customerId]);
            return $stmt->fetch() ?: null;
        }
        return null;
    }

    private static function optionalCustomerId(): ?int {
        $token = get_bearer_token();
        if (!$token) return null;
        try {
            $decoded = \Firebase\JWT\JWT::decode($token, new \Firebase\JWT\Key(customer_jwt_secret(), 'HS256'));
            $claims = (array) $decoded;
            if (($claims['type'] ?? '') !== 'customer') return null;
            return (int) ($claims['id'] ?? 0) ?: null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    private static function validateAddress($addr, string $type): array {
        if (!is_array($addr)) error_response("Adresse $type requise", 400);
        $required = ['first_name', 'last_name', 'address_line1', 'postcode', 'city', 'country_code'];
        if ($type === 'billing') $required[] = 'email';
        foreach ($required as $f) {
            if (empty($addr[$f])) error_response("Adresse $type : $f requis", 400);
        }
        if ($type === 'billing' && !filter_var($addr['email'], FILTER_VALIDATE_EMAIL)) {
            error_response('Email invalide', 400);
        }
        return [
            'first_name' => (string) $addr['first_name'],
            'last_name' => (string) $addr['last_name'],
            'company' => (string) ($addr['company'] ?? '') ?: null,
            'address_line1' => (string) $addr['address_line1'],
            'address_line2' => (string) ($addr['address_line2'] ?? '') ?: null,
            'postcode' => (string) $addr['postcode'],
            'city' => (string) $addr['city'],
            'region' => (string) ($addr['region'] ?? '') ?: null,
            'country_code' => strtoupper((string) $addr['country_code']),
            'phone' => (string) ($addr['phone'] ?? '') ?: null,
            'email' => (string) ($addr['email'] ?? '') ?: null,
            'vat_number' => (string) ($addr['vat_number'] ?? '') ?: null,
        ];
    }

    private static function loadShippingMethod(int $id): ?array {
        if ($id <= 0) return null;
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM shipping_methods WHERE id = ? AND is_active = 1');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    private static function resolveShippingPrice(array $method, int $subtotal, array $items, array $custom): int {
        $weight = 0;
        foreach ($items as $i) {
            if (!empty($i['weight_grams'])) $weight += (int) $i['weight_grams'] * (int) $i['quantity'];
        }
        $type = $method['type'];
        if ($type === 'free') return 0;
        if ($type === 'flat') {
            $threshold = $method['free_threshold_cents'] !== null ? (int) $method['free_threshold_cents'] : null;
            if ($threshold !== null && $subtotal >= $threshold) return 0;
            return (int) ($method['price_cents'] ?? 0);
        }
        if ($type === 'weight' || $type === 'price') {
            $tiers = $method['weight_tiers'] ? (is_string($method['weight_tiers']) ? json_decode($method['weight_tiers'], true) : $method['weight_tiers']) : [];
            $value = $type === 'weight' ? $weight : $subtotal;
            foreach ($tiers as $t) {
                $min = (int) ($t['min'] ?? 0);
                $max = isset($t['max']) ? (int) $t['max'] : PHP_INT_MAX;
                if ($value >= $min && $value <= $max) return (int) ($t['price_cents'] ?? 0);
            }
        }
        return (int) ($method['price_cents'] ?? 0);
    }

    private static function isFirstOrder(?int $customerId, string $email): bool {
        $db = Database::getInstance();
        if ($customerId) {
            $stmt = $db->prepare('SELECT COUNT(*) AS c FROM orders WHERE customer_id = ? AND payment_status IN ("pending","paid","partially_refunded")');
            $stmt->execute([$customerId]);
            return ((int) $stmt->fetch()['c']) === 0;
        }
        $stmt = $db->prepare('SELECT COUNT(*) AS c FROM orders WHERE email = ? AND payment_status IN ("pending","paid","partially_refunded")');
        $stmt->execute([$email]);
        return ((int) $stmt->fetch()['c']) === 0;
    }

    private static function generateOrderNumber(): string {
        // 5 random bytes = 10 hex chars ≈ 1.1 trillion combinations per day
        return sprintf('CMD-%s-%s', date('ymd'), strtoupper(bin2hex(random_bytes(5))));
    }

    private static function taxRate(string $code): float {
        static $cache = null;
        if ($cache === null) {
            $cache = [];
            try {
                $rows = Database::getInstance()->query('SELECT code, rate FROM tax_rates')->fetchAll();
                foreach ($rows as $r) $cache[$r['code']] = (float) $r['rate'];
            } catch (\Throwable $e) {}
            if (!isset($cache['FR_STANDARD'])) $cache['FR_STANDARD'] = 20.0;
        }
        return $cache[$code] ?? $cache['FR_STANDARD'];
    }
}
