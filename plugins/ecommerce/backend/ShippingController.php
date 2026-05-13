<?php
/**
 * ShippingController — résout les méthodes de livraison disponibles depuis
 * un code postal et le poids/montant du panier.
 *
 * Routes :
 *   GET /shop/shipping-rates?postcode=&country=FR&cart_token=
 *
 * Sélection :
 *   1. trouve les zones dont postcode_patterns matchent le CP (ou liste vide = tous CP du pays)
 *   2. liste les méthodes actives de ces zones, triées par priority/zone puis position
 *   3. pour 'flat' → price_cents fixe ; 'free' → 0 ; 'free' avec free_threshold_cents → 0 si subtotal ≥ seuil ; 'weight' → tier matching ; 'price' → tier matching
 */
class ShippingController {

    public static function rates(): void {
        $postcode = trim((string) ($_GET['postcode'] ?? ''));
        $country = strtoupper(trim((string) ($_GET['country'] ?? 'FR')));
        if ($postcode === '') error_response('postcode requis', 400);

        $cartContext = self::resolveCartContext();

        $db = Database::getInstance();
        $stmt = $db->query('SELECT * FROM shipping_zones ORDER BY priority DESC, position ASC, id ASC');
        $zones = $stmt->fetchAll();

        $matchedZoneIds = [];
        foreach ($zones as $z) {
            $countries = is_string($z['countries']) ? (json_decode($z['countries'], true) ?: []) : [];
            if (!empty($countries) && !in_array($country, $countries, true)) continue;
            $patterns = $z['postcode_patterns'] ? (is_string($z['postcode_patterns']) ? json_decode($z['postcode_patterns'], true) : $z['postcode_patterns']) : null;
            if (empty($patterns) || self::postcodeMatches($postcode, $patterns)) {
                $matchedZoneIds[] = (int) $z['id'];
            }
        }
        if (empty($matchedZoneIds)) {
            json_response(['rates' => [], 'postcode' => $postcode, 'country' => $country]);
            return;
        }

        $in = implode(',', array_fill(0, count($matchedZoneIds), '?'));
        $stmt = $db->prepare("SELECT m.*, z.priority AS zone_priority, z.name AS zone_name FROM shipping_methods m JOIN shipping_zones z ON z.id = m.zone_id WHERE m.is_active = 1 AND m.zone_id IN ($in) ORDER BY z.priority DESC, m.position ASC, m.id ASC");
        $stmt->execute($matchedZoneIds);
        $methods = $stmt->fetchAll();

        $rates = [];
        foreach ($methods as $m) {
            $price = self::resolvePrice($m, $cartContext);
            if ($price === null) continue;
            $rates[] = [
                'method_id' => (int) $m['id'],
                'zone_id' => (int) $m['zone_id'],
                'zone_name' => $m['zone_name'],
                'name' => $m['name'],
                'description' => $m['description'],
                'type' => $m['type'],
                'price_cents' => $price,
                'tax_code' => $m['tax_code'],
                'delivery_min_days' => $m['delivery_min_days'] !== null ? (int) $m['delivery_min_days'] : null,
                'delivery_max_days' => $m['delivery_max_days'] !== null ? (int) $m['delivery_max_days'] : null,
            ];
        }

        // If cart contains a POOLP configured box, inject the POOLP delivery rate
        // from the config_snapshot (poolp_delivery_zones) and remove ecommerce rates
        $poolpRate = self::resolvePoolpDeliveryRate($postcode);
        if ($poolpRate !== null) {
            // POOLP rate overrides ecommerce shipping for configured boxes
            $rates = [$poolpRate];
        }

        // Rate validity: 7 days from now (CDC §4.2)
        $validityDays = (int) (PluginController::getPluginOption('ecommerce', 'shipping_rate_validity_days') ?? 7);
        $validUntil = date('Y-m-d\TH:i:s', strtotime("+{$validityDays} days"));

        json_response([
            'postcode' => $postcode,
            'country' => $country,
            'rates' => $rates,
            'subtotal_cents' => $cartContext['subtotal_cents'],
            'weight_grams' => $cartContext['weight_grams'],
            'valid_until' => $validUntil,
            'fetched_at' => date('Y-m-d\TH:i:s'),
        ]);
    }

    /**
     * If the poolp-configurator plugin is active and the cart contains a POOLP
     * configured box, resolve delivery from poolp_delivery_zones and return a
     * virtual shipping rate. Returns null if not applicable.
     */
    private static function resolvePoolpDeliveryRate(string $postcode): ?array {
        // Check cart has poolp custom items
        $token = trim((string) ($_GET['cart_token'] ?? ($_SERVER['HTTP_X_CART_TOKEN'] ?? '')));
        if ($token === '') return null;

        $db = Database::getInstance();

        // Check poolp_delivery_zones table exists (plugin active)
        try {
            $db->query("SELECT 1 FROM poolp_delivery_zones LIMIT 1");
        } catch (\Throwable $e) {
            return null;
        }

        // Check cart has poolp custom items
        $cart = CartController::loadByToken($token);
        if (!$cart) return null;
        $custom = CartController::getCustomItems((int) $cart['id']);
        $hasPoolp = false;
        $modeLivraison = 'kit';
        foreach ($custom as $c) {
            if (($c['source_type'] ?? '') === 'poolp_configurator') {
                $hasPoolp = true;
                $snapshot = is_string($c['config_snapshot']) ? json_decode($c['config_snapshot'], true) : ($c['config_snapshot'] ?? []);
                $modeLivraison = $snapshot['state']['mode_livraison'] ?? 'kit';
                break;
            }
        }
        if (!$hasPoolp) return null;

        // Resolve from poolp_delivery_zones
        $zones = $db->query("SELECT * FROM poolp_delivery_zones WHERE is_active = 1 ORDER BY sort_order, id")->fetchAll();
        foreach ($zones as $z) {
            $patterns = is_string($z['postal_codes']) ? json_decode($z['postal_codes'], true) : ($z['postal_codes'] ?? []);
            if (!empty($patterns) && self::postcodeMatches($postcode, $patterns)) {
                $feeCents = $modeLivraison === 'montee'
                    ? (int) ($z['fee_assembled_ttc_cents'] ?? 0)
                    : (int) ($z['fee_kit_ttc_cents'] ?? 0);
                return [
                    'method_id' => -1,
                    'zone_id' => -1,
                    'zone_name' => $z['zone_label'],
                    'name' => 'Livraison POOLP — ' . $z['zone_label'],
                    'description' => $z['delay_label'] ?? '',
                    'type' => 'poolp',
                    'price_cents' => $feeCents,
                    'tax_code' => 'FR_STANDARD',
                    'delivery_min_days' => null,
                    'delivery_max_days' => null,
                    '_poolp' => true,
                ];
            }
        }
        return null;
    }

    public static function postcodeMatches(string $cp, array $patterns): bool {
        foreach ($patterns as $pat) {
            $pat = trim((string) $pat);
            if ($pat === '') continue;
            if ($pat === $cp) return true;
            if (preg_match('/^(\d{5})-(\d{5})$/', $pat, $m)) {
                if ((int) $cp >= (int) $m[1] && (int) $cp <= (int) $m[2]) return true;
            }
            if (str_ends_with($pat, '*')) {
                $prefix = rtrim($pat, '*');
                if (str_starts_with($cp, $prefix)) return true;
            }
        }
        return false;
    }

    private static function resolvePrice(array $method, array $ctx): ?int {
        $type = $method['type'];
        if ($type === 'free') return 0;
        if ($type === 'flat') {
            $price = (int) ($method['price_cents'] ?? 0);
            $threshold = $method['free_threshold_cents'] !== null ? (int) $method['free_threshold_cents'] : null;
            if ($threshold !== null && $ctx['subtotal_cents'] >= $threshold) return 0;
            return $price;
        }
        if ($type === 'weight') {
            $tiers = $method['weight_tiers'] ? (is_string($method['weight_tiers']) ? json_decode($method['weight_tiers'], true) : $method['weight_tiers']) : [];
            return self::resolveTier($tiers, $ctx['weight_grams']);
        }
        if ($type === 'price') {
            $tiers = $method['weight_tiers'] ? (is_string($method['weight_tiers']) ? json_decode($method['weight_tiers'], true) : $method['weight_tiers']) : [];
            return self::resolveTier($tiers, $ctx['subtotal_cents']);
        }
        return null;
    }

    private static function resolveTier(array $tiers, int $value): ?int {
        foreach ($tiers as $tier) {
            $min = (int) ($tier['min'] ?? 0);
            $max = isset($tier['max']) ? (int) $tier['max'] : PHP_INT_MAX;
            if ($value >= $min && $value <= $max) {
                return (int) ($tier['price_cents'] ?? 0);
            }
        }
        return null;
    }

    private static function resolveCartContext(): array {
        $token = trim((string) ($_GET['cart_token'] ?? ($_SERVER['HTTP_X_CART_TOKEN'] ?? '')));
        $subtotal = 0;
        $weight = 0;
        if ($token !== '') {
            $cart = CartController::loadByToken($token);
            if ($cart) {
                $items = CartController::getItems((int) $cart['id']);
                foreach ($items as $i) {
                    $subtotal += (int) $i['line_total_cents'];
                    if (!empty($i['weight_grams'])) $weight += (int) $i['weight_grams'] * (int) $i['quantity'];
                }
                $custom = CartController::getCustomItems((int) $cart['id']);
                foreach ($custom as $i) {
                    $subtotal += (int) $i['line_total_cents'];
                }
            }
        }
        return ['subtotal_cents' => $subtotal, 'weight_grams' => $weight];
    }
}
