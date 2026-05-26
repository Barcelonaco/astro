<?php
/**
 * CartController — panier client e-commerce.
 *
 * Identification panier :
 *   - header `X-Cart-Token` envoyé par le frontend (créé à l'ajout du 1er item),
 *   - sinon Bearer customer (panier rattaché au customer_id).
 *
 * Routes :
 *   GET    /cart
 *   POST   /cart/items                 { variant_id, quantity }
 *   PUT    /cart/items/:id             { quantity }
 *   DELETE /cart/items/:id
 *   DELETE /cart/items/custom/:id
 *   DELETE /cart
 *   POST   /cart/coupon                { code }   (préparé pour plus tard)
 *   DELETE /cart/coupon
 *
 * Snapshot prix : cart_items.unit_price_cents enregistré à l'ajout.
 * Conversion en commande gérée par OrderController::createFromCart.
 */
class CartController {

    private const CART_TTL_DAYS = 30;

    public static function getCart(): void {
        $cart = self::resolveOrCreate(false);
        if (!$cart) {
            json_response(self::emptyCart());
            return;
        }
        // Optional tax context from query params (used during checkout when billing address is known)
        $taxContext = self::resolveTaxContextFromRequest();
        json_response(self::serialize($cart, $taxContext));
    }

    public static function addItem(): void {
        $body = get_json_body();
        $variantId = (int) ($body['variant_id'] ?? 0);
        $qty = max(1, (int) ($body['quantity'] ?? 1));
        if ($variantId <= 0) error_response('variant_id requis', 400);

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT v.id, v.product_id, v.price_cents, v.compare_at_price_cents, v.stock_managed, v.stock_quantity FROM product_variants v WHERE v.id = ?');
        $stmt->execute([$variantId]);
        $variant = $stmt->fetch();
        if (!$variant) error_response('Variant introuvable', 404);

        if ((int) $variant['stock_managed'] === 1 && (int) $variant['stock_quantity'] < $qty) {
            error_response('Stock insuffisant', 409);
        }

        // Prix effectif : prix promo si actif (inférieur au prix de base), sinon prix de base
        $effectivePrice = (int) $variant['price_cents'];
        if (!empty($variant['compare_at_price_cents']) && (int) $variant['compare_at_price_cents'] < $effectivePrice) {
            $effectivePrice = (int) $variant['compare_at_price_cents'];
        }

        $cart = self::resolveOrCreate(true);

        // UNIQUE (cart_id, variant_id) → upsert
        $stmt = $db->prepare('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?');
        $stmt->execute([$cart['id'], $variantId]);
        $existing = $stmt->fetch();

        if ($existing) {
            $newQty = (int) $existing['quantity'] + $qty;
            $stmt = $db->prepare('UPDATE cart_items SET quantity = ?, unit_price_cents = ? WHERE id = ?');
            $stmt->execute([$newQty, $effectivePrice, $existing['id']]);
        } else {
            $stmt = $db->prepare('INSERT INTO cart_items (cart_id, variant_id, product_id, quantity, unit_price_cents) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$cart['id'], $variantId, $variant['product_id'], $qty, $effectivePrice]);
        }

        self::touchCart($cart['id']);
        json_response(self::serialize(self::loadCart($cart['id'])), 201);
    }

    public static function updateItem(int $itemId): void {
        $body = get_json_body();
        $qty = (int) ($body['quantity'] ?? 0);
        $cart = self::requireCart();

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id, cart_id, variant_id FROM cart_items WHERE id = ?');
        $stmt->execute([$itemId]);
        $item = $stmt->fetch();
        if (!$item || (int) $item['cart_id'] !== (int) $cart['id']) {
            error_response('Item introuvable', 404);
        }

        if ($qty <= 0) {
            $stmt = $db->prepare('DELETE FROM cart_items WHERE id = ?');
            $stmt->execute([$itemId]);
        } else {
            $stmt = $db->prepare('SELECT price_cents, compare_at_price_cents, stock_managed, stock_quantity FROM product_variants WHERE id = ?');
            $stmt->execute([$item['variant_id']]);
            $v = $stmt->fetch();
            if ($v && (int) $v['stock_managed'] === 1 && (int) $v['stock_quantity'] < $qty) {
                error_response('Stock insuffisant', 409);
            }
            // Refresh effective price (promo may have changed)
            $effectivePrice = (int) ($v['price_cents'] ?? 0);
            if ($v && !empty($v['compare_at_price_cents']) && (int) $v['compare_at_price_cents'] < $effectivePrice) {
                $effectivePrice = (int) $v['compare_at_price_cents'];
            }
            $stmt = $db->prepare('UPDATE cart_items SET quantity = ?, unit_price_cents = ? WHERE id = ?');
            $stmt->execute([$qty, $effectivePrice, $itemId]);
        }

        self::touchCart($cart['id']);
        json_response(self::serialize(self::loadCart($cart['id'])));
    }

    public static function removeItem(int $itemId): void {
        $cart = self::requireCart();
        $db = Database::getInstance();
        $stmt = $db->prepare('DELETE FROM cart_items WHERE id = ? AND cart_id = ?');
        $stmt->execute([$itemId, $cart['id']]);
        self::touchCart($cart['id']);
        json_response(self::serialize(self::loadCart($cart['id'])));
    }

    public static function removeCustomItem(int $itemId): void {
        $cart = self::requireCart();
        $db = Database::getInstance();
        $stmt = $db->prepare('DELETE FROM cart_items_custom WHERE id = ? AND cart_id = ?');
        $stmt->execute([$itemId, $cart['id']]);
        self::touchCart($cart['id']);
        json_response(self::serialize(self::loadCart($cart['id'])));
    }

    public static function clearCart(): void {
        $cart = self::requireCart();
        $db = Database::getInstance();
        $db->prepare('DELETE FROM cart_items WHERE cart_id = ?')->execute([$cart['id']]);
        $db->prepare('DELETE FROM cart_items_custom WHERE cart_id = ?')->execute([$cart['id']]);
        $db->prepare('UPDATE carts SET coupon_code = NULL WHERE id = ?')->execute([$cart['id']]);
        self::touchCart($cart['id']);
        json_response(self::serialize(self::loadCart($cart['id'])));
    }

    public static function applyCoupon(): void {
        $body = get_json_body();
        $code = trim((string) ($body['code'] ?? ''));
        if ($code === '') error_response('code requis', 400);
        $cart = self::requireCart();
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW()) AND (starts_at IS NULL OR starts_at <= NOW())');
        $stmt->execute([$code]);
        $coupon = $stmt->fetch();
        if (!$coupon) error_response('Code invalide ou expire', 404);

        // Check max uses (global)
        $maxUses = $coupon['max_uses'] !== null ? (int) $coupon['max_uses'] : null;
        $timesUsed = (int) ($coupon['used_count'] ?? 0);
        if ($maxUses !== null && $timesUsed >= $maxUses) {
            error_response('Ce code promo a atteint sa limite d\'utilisation', 400);
        }

        // Check max uses per customer
        $maxPerCustomer = $coupon['max_uses_per_customer'] !== null ? (int) $coupon['max_uses_per_customer'] : null;
        if ($maxPerCustomer !== null) {
            $customerId = self::optionalCustomerId();
            if ($customerId) {
                $stmt = $db->prepare('SELECT COUNT(*) FROM coupon_usages WHERE coupon_id = ? AND customer_id = ?');
                $stmt->execute([$coupon['id'], $customerId]);
                if ((int) $stmt->fetchColumn() >= $maxPerCustomer) {
                    error_response('Vous avez deja utilise ce code promo', 400);
                }
            }
        }

        $db->prepare('UPDATE carts SET coupon_code = ? WHERE id = ?')->execute([$code, $cart['id']]);
        json_response(self::serialize(self::loadCart($cart['id'])));
    }

    public static function removeCoupon(): void {
        $cart = self::requireCart();
        $db = Database::getInstance();
        $db->prepare('UPDATE carts SET coupon_code = NULL WHERE id = ?')->execute([$cart['id']]);
        json_response(self::serialize(self::loadCart($cart['id'])));
    }

    // ── Internal API (used by OrderController) ───────────────────────────────

    public static function loadByToken(string $token): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM carts WHERE token = ?');
        $stmt->execute([$token]);
        return $stmt->fetch() ?: null;
    }

    public static function loadCart(int $id): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM carts WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public static function getItems(int $cartId): array {
        $db = Database::getInstance();
        $stmt = $db->prepare('
            SELECT ci.*, v.sku, v.attributes, v.weight_grams, v.stock_managed, v.stock_quantity,
                   p.title AS product_title, p.slug AS product_slug, p.featured_image,
                   p.custom_fields AS product_custom_fields
            FROM cart_items ci
            JOIN product_variants v ON v.id = ci.variant_id
            JOIN cpt_products p ON p.id = ci.product_id
            WHERE ci.cart_id = ?
            ORDER BY ci.added_at ASC
        ');
        $stmt->execute([$cartId]);
        $rows = $stmt->fetchAll();
        $items = [];
        foreach ($rows as $r) {
            $cf = is_string($r['product_custom_fields']) ? (json_decode($r['product_custom_fields'], true) ?: []) : [];
            $img = $r['featured_image'] ? (is_string($r['featured_image']) ? json_decode($r['featured_image'], true) : $r['featured_image']) : null;
            $attrs = $r['attributes'] ? (is_string($r['attributes']) ? json_decode($r['attributes'], true) : $r['attributes']) : [];
            $items[] = [
                'id' => (int) $r['id'],
                'kind' => 'product',
                'product_id' => (int) $r['product_id'],
                'product_slug' => $r['product_slug'],
                'product_title' => $r['product_title'],
                'variant_id' => (int) $r['variant_id'],
                'sku' => $r['sku'],
                'attributes' => $attrs,
                'quantity' => (int) $r['quantity'],
                'unit_price_cents' => (int) $r['unit_price_cents'],
                'line_total_cents' => (int) $r['unit_price_cents'] * (int) $r['quantity'],
                'weight_grams' => $r['weight_grams'] !== null ? (int) $r['weight_grams'] : null,
                'tax_code' => $cf['tax_code'] ?? 'FR_STANDARD',
                'requires_shipping' => ($cf['type'] ?? 'physical') === 'physical' ? true : !empty($cf['requires_shipping']),
                'is_digital' => ($cf['type'] ?? 'physical') === 'digital',
                'featured_image' => $img,
            ];
        }
        return $items;
    }

    public static function getCustomItems(int $cartId): array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM cart_items_custom WHERE cart_id = ? ORDER BY created_at ASC');
        $stmt->execute([$cartId]);
        $rows = $stmt->fetchAll();
        $items = [];
        foreach ($rows as $r) {
            $items[] = [
                'id' => (int) $r['id'],
                'kind' => 'custom',
                'source_type' => $r['source_type'],
                'source_id' => $r['source_id'] !== null ? (int) $r['source_id'] : null,
                'title' => $r['title'],
                'subtitle' => $r['subtitle'] ?? null,
                'config_snapshot' => is_string($r['config_snapshot']) ? json_decode($r['config_snapshot'], true) : $r['config_snapshot'],
                'quantity' => (int) $r['quantity'],
                'unit_price_cents' => (int) $r['unit_price_ttc_cents'],
                'unit_price_pro_ht_cents' => $r['unit_price_pro_ht_cents'] !== null ? (int) $r['unit_price_pro_ht_cents'] : null,
                'line_total_cents' => (int) $r['unit_price_ttc_cents'] * (int) $r['quantity'],
                'requires_shipping' => true,
                'is_digital' => false,
                'tax_code' => 'FR_STANDARD',
            ];
        }
        return $items;
    }

    /**
     * Calcule les totaux du panier.
     *
     * @param int        $cartId
     * @param array|null $taxContext  Resultat de TaxResolver::resolve() — si null, TVA FR standard.
     */
    public static function computeTotals(int $cartId, ?array $taxContext = null): array {
        $items = self::getItems($cartId);
        $custom = self::getCustomItems($cartId);

        $subtotalTtc = 0;
        $taxBreakdown = [];
        $taxMention = $taxContext['mention'] ?? '';

        // Tous les prix (produits shop ET custom items) sont stockés TTC.
        foreach (array_merge($items, $custom) as $line) {
            $subtotalTtc += $line['line_total_cents'];
            $nominalRate = self::taxRate($line['tax_code'] ?? 'FR_STANDARD');
            $key = (string) $nominalRate;

            if ($taxContext && $taxContext['exempt']) {
                $tax = 0;
            } else {
                $tax = (int) round($line['line_total_cents'] - $line['line_total_cents'] / (1 + $nominalRate / 100));
            }
            $taxBreakdown[$key] = ($taxBreakdown[$key] ?? 0) + $tax;
        }

        // Coupon discount
        $discountCents = 0;
        $couponCode = null;
        $cart = self::loadCart($cartId);
        if ($cart && !empty($cart['coupon_code'])) {
            $couponCode = $cart['coupon_code'];
            $coupon = self::loadCoupon($couponCode);
            if ($coupon) {
                $discountCents = self::computeCouponDiscount($coupon, $subtotalTtc, $items);
            }
        }

        $afterDiscountTtc = max(0, $subtotalTtc - $discountCents);

        // Recalculate tax on discounted total (proportional reduction)
        $taxTotal = 0;
        if ($subtotalTtc > 0 && $afterDiscountTtc > 0) {
            $ratio = $afterDiscountTtc / $subtotalTtc;
            $recalcBreakdown = [];
            foreach ($taxBreakdown as $k => $v) {
                $adjusted = (int) round($v * $ratio);
                $recalcBreakdown[$k] = $adjusted;
                $taxTotal += $adjusted;
            }
            $taxBreakdown = $recalcBreakdown;
        } elseif ($afterDiscountTtc <= 0) {
            $taxBreakdown = [];
        }

        $subtotalHt = $afterDiscountTtc - $taxTotal;

        return [
            'subtotal_cents' => $subtotalHt,
            'tax_cents' => $taxTotal,
            'tax_breakdown' => $taxBreakdown,
            'total_cents' => $afterDiscountTtc,
            'discount_cents' => $discountCents,
            'coupon_code' => $couponCode,
            'tax_mention' => $taxMention,
            'tax_exempt' => !empty($taxContext['exempt']),
            'items_count' => array_sum(array_map(fn($i) => $i['quantity'], $items))
                + array_sum(array_map(fn($i) => $i['quantity'], $custom)),
        ];
    }

    public static function loadCouponStatic(string $code): ?array {
        return self::loadCoupon($code);
    }

    private static function loadCoupon(string $code): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW()) AND (starts_at IS NULL OR starts_at <= NOW())');
        $stmt->execute([$code]);
        return $stmt->fetch() ?: null;
    }

    private static function computeCouponDiscount(array $coupon, int $subtotalTtc, array $items): int {
        $type = $coupon['type'];
        $minSubtotal = $coupon['min_subtotal_cents'] !== null ? (int) $coupon['min_subtotal_cents'] : 0;
        if ($subtotalTtc < $minSubtotal) return 0;

        if ($type === 'free_shipping') return 0; // handled at shipping level

        if ($type === 'percent') {
            $pct = (float) ($coupon['percent'] ?? 0);
            if ($pct <= 0 || $pct > 100) return 0;
            return (int) round($subtotalTtc * $pct / 100);
        }

        if ($type === 'fixed') {
            $fixed = (int) ($coupon['value_cents'] ?? 0);
            return min($fixed, $subtotalTtc);
        }

        return 0;
    }

    public static function emptyCart(): array {
        return [
            'id' => null,
            'token' => null,
            'currency' => 'EUR',
            'items' => [],
            'custom_items' => [],
            'subtotal_cents' => 0,
            'tax_cents' => 0,
            'total_cents' => 0,
            'tax_breakdown' => [],
            'items_count' => 0,
            'coupon_code' => null,
        ];
    }

    private static function taxRate(string $code): float {
        static $cache = null;
        if ($cache === null) {
            $cache = [];
            try {
                $rows = Database::getInstance()->query('SELECT code, rate FROM tax_rates')->fetchAll();
                foreach ($rows as $r) $cache[$r['code']] = (float) $r['rate'];
            } catch (\Throwable $e) {
                $cache = ['FR_STANDARD' => 20.0];
            }
            if (!isset($cache['FR_STANDARD'])) $cache['FR_STANDARD'] = 20.0;
        }
        return $cache[$code] ?? $cache['FR_STANDARD'];
    }

    /**
     * Resolve tax context from request query params or customer auth.
     * Used during checkout when billing address is known.
     * Query params: ?billing_country=XX
     * Customer pro status resolved from auth token.
     */
    private static function resolveTaxContextFromRequest(): ?array {
        $billingCountry = trim((string) ($_GET['billing_country'] ?? ''));
        if ($billingCountry === '') return null;

        $isPro = false;
        $vatNumber = null;
        $token = get_bearer_token();
        if ($token) {
            try {
                $decoded = \Firebase\JWT\JWT::decode($token, new \Firebase\JWT\Key(customer_jwt_secret(), 'HS256'));
                $claims = (array) $decoded;
                if (($claims['type'] ?? '') === 'customer') {
                    $customer = CustomerModel::findById((int) $claims['id']);
                    if ($customer) {
                        $isPro = !empty($customer['is_pro']) && ($customer['pro_status'] ?? '') === 'approved';
                        $vatNumber = $customer['vat_number'] ?? null;
                    }
                }
            } catch (\Throwable $e) {}
        }

        return TaxResolver::resolve($billingCountry, $isPro, $vatNumber);
    }

    public static function serialize(array $cart, ?array $taxContext = null): array {
        $items = self::getItems((int) $cart['id']);
        $custom = self::getCustomItems((int) $cart['id']);
        $totals = self::computeTotals((int) $cart['id'], $taxContext);
        return array_merge([
            'id' => (int) $cart['id'],
            'token' => $cart['token'],
            'customer_id' => $cart['customer_id'] !== null ? (int) $cart['customer_id'] : null,
            'currency' => $cart['currency'] ?? 'EUR',
            'coupon_code' => $cart['coupon_code'] ?? null,
            'shipping_method_id' => $cart['shipping_method_id'] !== null ? (int) $cart['shipping_method_id'] : null,
            'shipping_address' => $cart['shipping_address_json'] ? (is_string($cart['shipping_address_json']) ? json_decode($cart['shipping_address_json'], true) : $cart['shipping_address_json']) : null,
            'items' => $items,
            'custom_items' => $custom,
            'expires_at' => $cart['expires_at'] ?? null,
        ], $totals);
    }

    // ── Resolve / create ────────────────────────────────────────────────────

    private static function requireCart(): array {
        $cart = self::resolveOrCreate(false);
        if (!$cart) error_response('Panier introuvable', 404);
        return $cart;
    }

    /**
     * Résout le panier courant via :
     *   1. header X-Cart-Token (anonyme)
     *   2. customer_id (Bearer customer)
     * Si $createIfMissing, crée un panier neuf avec un token random.
     */
    private static function resolveOrCreate(bool $createIfMissing): ?array {
        $token = self::headerCartToken();
        $customerId = self::optionalCustomerId();
        $db = Database::getInstance();

        if ($token) {
            $stmt = $db->prepare('SELECT * FROM carts WHERE token = ? AND expires_at > NOW()');
            $stmt->execute([$token]);
            $cart = $stmt->fetch();
            if ($cart) {
                // Si customer connecté et panier anonyme → on attache
                if ($customerId && empty($cart['customer_id'])) {
                    $db->prepare('UPDATE carts SET customer_id = ? WHERE id = ?')->execute([$customerId, $cart['id']]);
                    $cart['customer_id'] = $customerId;
                }
                return $cart;
            }
        }

        if ($customerId) {
            $stmt = $db->prepare('SELECT * FROM carts WHERE customer_id = ? AND expires_at > NOW() ORDER BY updated_at DESC LIMIT 1');
            $stmt->execute([$customerId]);
            $cart = $stmt->fetch();
            if ($cart) return $cart;
        }

        if (!$createIfMissing) return null;

        // Crée un panier neuf
        $newToken = bin2hex(random_bytes(24));
        $stmt = $db->prepare('INSERT INTO carts (token, customer_id, currency, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ' . self::CART_TTL_DAYS . ' DAY))');
        $stmt->execute([$newToken, $customerId, 'EUR']);
        $id = (int) $db->lastInsertId();

        // Renvoie le token au client (header de réponse)
        header('X-Cart-Token: ' . $newToken);

        return self::loadCart($id);
    }

    private static function touchCart(int $id): void {
        $db = Database::getInstance();
        $db->prepare('UPDATE carts SET updated_at = CURRENT_TIMESTAMP, expires_at = DATE_ADD(NOW(), INTERVAL ' . self::CART_TTL_DAYS . ' DAY) WHERE id = ?')
            ->execute([$id]);
    }

    private static function headerCartToken(): ?string {
        $val = $_SERVER['HTTP_X_CART_TOKEN'] ?? '';
        $val = trim($val);
        return $val !== '' ? $val : null;
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
}
