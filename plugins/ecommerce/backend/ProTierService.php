<?php
/**
 * ProTierService — calcul CA glissant 365j → tier → discount_rate.
 *
 * Barème par défaut (modifiable via settings `ecommerce_pro_tiers` JSON) :
 *   Bronze   0 –  5 000 €  →  0 %
 *   Argent   5 000 – 15 000 €  →  5 %
 *   Or      15 000 – 30 000 €  → 10 %
 *   Platine ≥ 30 000 €  → 15 %
 *
 * Routes admin :
 *   GET  /admin/pro-tiers          → barème actuel
 *   PUT  /admin/pro-tiers          → modifier barème
 *   POST /admin/pro-tiers/recalc   → recalcul forcé de tous les pros
 *   GET  /admin/pro-tiers/preview  → liste pros avec CA + tier prévisuel
 */
class ProTierService {

    private const DEFAULT_TIERS = [
        ['name' => 'Bronze',  'min_cents' => 0,       'max_cents' => 500000,  'discount_rate' => 0],
        ['name' => 'Argent',  'min_cents' => 500000,  'max_cents' => 1500000, 'discount_rate' => 5],
        ['name' => 'Or',      'min_cents' => 1500000, 'max_cents' => 3000000, 'discount_rate' => 10],
        ['name' => 'Platine', 'min_cents' => 3000000, 'max_cents' => null,    'discount_rate' => 15],
    ];

    // ── Admin routes ──────────────────────────────────────────────────────

    /** GET /admin/pro-tiers */
    public static function getTiers(): void {
        require_ecommerce_enabled();
        json_response(['tiers' => self::loadTiers()]);
    }

    /** PUT /admin/pro-tiers  { tiers: [...] } */
    public static function updateTiers(): void {
        require_ecommerce_enabled();
        $body = get_json_body();
        $tiers = $body['tiers'] ?? null;

        if (!is_array($tiers) || empty($tiers)) {
            error_response('Tableau de tiers requis', 400);
        }

        // Validate
        foreach ($tiers as $i => $t) {
            if (empty($t['name'])) error_response("Tier #{$i}: name requis", 400);
            if (!isset($t['min_cents']) || (int) $t['min_cents'] < 0) error_response("Tier #{$i}: min_cents invalide", 400);
            if (!isset($t['discount_rate']) || (float) $t['discount_rate'] < 0 || (float) $t['discount_rate'] > 100) {
                error_response("Tier #{$i}: discount_rate doit etre entre 0 et 100", 400);
            }
        }

        // Sort ascending by min_cents
        usort($tiers, fn($a, $b) => (int) $a['min_cents'] - (int) $b['min_cents']);

        $db = Database::getInstance();
        $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('ecommerce_pro_tiers', ?)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)")
            ->execute([json_encode($tiers, JSON_UNESCAPED_UNICODE)]);

        json_response(['message' => 'Barème mis à jour', 'tiers' => $tiers]);
    }

    /** POST /admin/pro-tiers/recalc — recalcul forcé de tous les pros */
    public static function recalcAll(): void {
        require_ecommerce_enabled();
        $result = self::recalculateAllPros();
        json_response($result);
    }

    /** GET /admin/pro-tiers/preview — liste pros avec CA + tier */
    public static function preview(): void {
        require_ecommerce_enabled();
        $db = Database::getInstance();
        $tiers = self::loadTiers();

        $stmt = $db->query("
            SELECT c.id, c.email, c.first_name, c.last_name, c.company, c.siret,
                   c.is_pro, c.pro_status, c.pro_tier, c.discount_rate, c.discount_override,
                   c.created_at
            FROM customers c
            WHERE c.is_pro = 1 AND c.pro_status = 'approved'
            ORDER BY c.created_at DESC
        ");
        $pros = $stmt->fetchAll();

        foreach ($pros as &$p) {
            // Use anniversary-based revenue calculation
            $rev = self::revenue365((int) $p['id']);
            $p['revenue_365_cents'] = $rev;
            $tier = self::tierForRevenue($rev, $tiers);
            $p['computed_tier'] = $tier['name'];
            $p['computed_discount'] = (float) $tier['discount_rate'];
            $p['current_discount'] = (float) ($p['discount_rate'] ?? 0);
            $p['is_override'] = !empty($p['discount_override']);
        }
        unset($p);

        json_response(['pros' => $pros, 'tiers' => $tiers]);
    }

    // ── Core logic ────────────────────────────────────────────────────────

    /**
     * Calcule le CA payé sur la période anniversaire en cours du compte.
     *
     * La période se base sur la date de création du compte :
     *   - Année 1 : created_at → created_at + 365j
     *   - Année 2 : created_at + 365j → created_at + 730j
     *   - etc.
     * Le CA est remis à 0 à chaque date anniversaire.
     *
     * @return int montant en centimes
     */
    public static function revenue365(int $customerId): int {
        $db = Database::getInstance();

        // Get customer creation date
        $stmt = $db->prepare("SELECT created_at FROM customers WHERE id = ?");
        $stmt->execute([$customerId]);
        $row = $stmt->fetch();
        if (!$row || empty($row['created_at'])) {
            // Fallback: rolling 365 days
            return self::revenueRolling365($customerId);
        }

        $createdAt = new \DateTime($row['created_at']);
        $now = new \DateTime();

        // Calculate which anniversary period we're in
        $diff = $createdAt->diff($now);
        $yearsSinceCreation = $diff->y;

        // Period start = created_at + (yearsSinceCreation * 365 days)
        $periodStart = clone $createdAt;
        $periodStart->modify("+{$yearsSinceCreation} years");

        // If periodStart is in the future (edge case around creation date),
        // go back one year
        if ($periodStart > $now) {
            $periodStart->modify("-1 year");
        }

        $stmt = $db->prepare("
            SELECT COALESCE(SUM(total_cents), 0) AS total
            FROM orders
            WHERE customer_id = ?
              AND payment_status IN ('paid', 'partially_refunded')
              AND placed_at >= ?
        ");
        $stmt->execute([$customerId, $periodStart->format('Y-m-d H:i:s')]);
        return (int) $stmt->fetch()['total'];
    }

    /** Fallback: rolling 365 days from now (used if created_at unknown). */
    private static function revenueRolling365(int $customerId): int {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT COALESCE(SUM(total_cents), 0) AS total
            FROM orders
            WHERE customer_id = ?
              AND payment_status IN ('paid', 'partially_refunded')
              AND placed_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)
        ");
        $stmt->execute([$customerId]);
        return (int) $stmt->fetch()['total'];
    }

    /**
     * Trouve le tier correspondant au CA.
     */
    public static function tierForRevenue(int $revenueCents, ?array $tiers = null): array {
        $tiers = $tiers ?? self::loadTiers();
        $matched = $tiers[0]; // default = first tier
        foreach ($tiers as $t) {
            $min = (int) $t['min_cents'];
            $max = $t['max_cents'] !== null ? (int) $t['max_cents'] : PHP_INT_MAX;
            if ($revenueCents >= $min && $revenueCents < $max) {
                $matched = $t;
                break;
            }
            // If revenue exceeds all, use last tier
            if ($revenueCents >= $min) $matched = $t;
        }
        return $matched;
    }

    /**
     * Recalcule le discount_rate d'un customer pro (sauf override).
     * Appelé après paiement ou en batch cron.
     */
    public static function recalculateForCustomer(int $customerId): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id, is_pro, pro_status, discount_override FROM customers WHERE id = ?');
        $stmt->execute([$customerId]);
        $customer = $stmt->fetch();
        if (!$customer) return;
        if (!(int) $customer['is_pro'] || $customer['pro_status'] !== 'approved') return;
        if (!empty($customer['discount_override'])) return; // admin override → skip

        $revenue = self::revenue365($customerId);
        $tier = self::tierForRevenue($revenue);
        $newRate = (float) $tier['discount_rate'];

        $db->prepare('UPDATE customers SET discount_rate = ?, pro_tier = ? WHERE id = ?')
            ->execute([$newRate, $tier['name'], $customerId]);
    }

    /**
     * Recalcul batch de tous les pros.
     */
    public static function recalculateAllPros(): array {
        $db = Database::getInstance();
        $tiers = self::loadTiers();

        $stmt = $db->query("SELECT id FROM customers WHERE is_pro = 1 AND pro_status = 'approved' AND (discount_override IS NULL OR discount_override = 0)");
        $ids = $stmt->fetchAll(\PDO::FETCH_COLUMN);

        $updated = 0;
        foreach ($ids as $cid) {
            $revenue = self::revenue365((int) $cid);
            $tier = self::tierForRevenue($revenue, $tiers);
            $db->prepare('UPDATE customers SET discount_rate = ?, pro_tier = ? WHERE id = ?')
                ->execute([(float) $tier['discount_rate'], $tier['name'], (int) $cid]);
            $updated++;
        }

        return ['updated' => $updated, 'total_pros' => count($ids)];
    }

    // ── Settings ──────────────────────────────────────────────────────────

    public static function loadTiers(): array {
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'ecommerce_pro_tiers' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch();
            if ($row && $row['setting_value']) {
                $parsed = json_decode($row['setting_value'], true);
                if (is_array($parsed) && !empty($parsed)) return $parsed;
            }
        } catch (\Throwable $e) {}
        return self::DEFAULT_TIERS;
    }
}
