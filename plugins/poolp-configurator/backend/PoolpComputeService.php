<?php
/**
 * PoolpComputeService — moteur métier du configurateur POOLP.
 *
 * Pure : pas de session, pas de cookies, pas d'output. Ne dépend que de :
 * - Database::getInstance() (PDO partagé) pour lire les CPT
 * - PluginController pour les settings options du plugin
 *
 * 100% testable. Toute la logique CDC §3 (calculs hydrauliques, exclusions,
 * sélection auto refs, prix, logistique, avertissements) vit ici.
 */

class PoolpComputeService {

    public const TREATMENTS = ['aucun', 'regul_ph', 'electrolyse_ph', 'electrolyse_ph_redox', 'uv_oxygene'];
    public const TREATMENTS_FORBIDDEN_WHEN_COVERED = ['electrolyse_ph']; // bassin couvert + traitement auto → pas électrolyse seule

    /**
     * Point d'entrée principal.
     *
     * @param array $input  inputs wizard (cf. README plugin)
     * @param bool $isPro
     * @param float $discountRate  taux de remise pro (0..1) — fourni par module statuts pros (hors plugin)
     * @return array  résultat complet (hydraulic, box, equipements, finition, livraison, totaux, warnings, …)
     */
    public static function compute(array $input, bool $isPro = false, float $discountRate = 0.0): array {
        $errors = self::validateInput($input);
        if (!empty($errors)) {
            return ['error' => 'invalid_input', 'fields' => $errors];
        }

        $hydraulic = self::computeHydraulic($input);
        $excluded = self::excludedBoxes($input, $hydraulic['volume']);

        // Bassin couvert → restriction des traitements
        $allowedTreatments = self::allowedTreatments($input);
        if (!in_array($input['traitement'] ?? 'aucun', $allowedTreatments, true)) {
            return [
                'error' => 'invalid_treatment_for_covered_pool',
                'allowed_treatments' => $allowedTreatments,
            ];
        }

        try {
            $box = self::pickBox($hydraulic['volume'], $excluded, $input['box_override'] ?? null);
        } catch (\DomainException $e) {
            return ['error' => $e->getMessage(), 'hydraulic' => $hydraulic, 'excluded_boxes' => $excluded];
        }

        $equipements = self::pickEquipments($box, $input);
        $finition = self::pickFinition((int)($input['finition_id'] ?? 0));
        $livraison = self::resolveDeliveryZone($input['code_postal'] ?? '', $input['mode_livraison'] ?? 'kit');

        $totaux = self::computeTotals($box, $equipements, $finition, $livraison, $isPro, $discountRate);

        $warnings = self::buildWarnings($input);

        return [
            'hydraulic' => $hydraulic,
            'box' => $box,
            'equipements' => $equipements,
            'finition' => $finition,
            'livraison' => $livraison,
            'totaux' => $totaux,
            'excluded_boxes' => $excluded,
            'allowed_treatments' => $allowedTreatments,
            'warnings' => $warnings,
            'is_pro' => $isPro,
        ];
    }

    // ─── Validation ──────────────────────────────────────────────────────────

    public static function validateInput(array $i): array {
        $errors = [];
        foreach (['longueur', 'largeur', 'hauteur'] as $f) {
            if (!isset($i[$f]) || !is_numeric($i[$f]) || $i[$f] <= 0) {
                $errors[$f] = 'required_positive_number';
            }
        }
        if (isset($i['traitement']) && !in_array($i['traitement'], self::TREATMENTS, true)) {
            $errors['traitement'] = 'invalid_value';
        }
        if (isset($i['filtre']) && !in_array($i['filtre'], ['sable', 'cartouche'], true)) {
            $errors['filtre'] = 'invalid_value';
        }
        if (isset($i['pompe']) && !in_array($i['pompe'], ['mono', 'variable'], true)) {
            $errors['pompe'] = 'invalid_value';
        }
        return $errors;
    }

    // ─── Calculs hydrauliques (CDC §3.2 étape 2) ─────────────────────────────

    public static function computeHydraulic(array $i): array {
        $L = (float) $i['longueur'];
        $l = (float) $i['largeur'];
        $h = (float) $i['hauteur'];
        $voletImmerge = !empty($i['volet_immerge']);

        $surface = $L * $l;
        $volume = $L * $l * $h;
        $debit = $volume / 5;
        $nbSkimmers = (int) ceil(max($surface / 25, $debit / 6));
        $nbBondes = 1 + ($voletImmerge ? 1 : 0);
        $nbRefoulements = $nbSkimmers + ($voletImmerge ? 1 : 0);

        return [
            'surface' => round($surface, 2),
            'volume' => round($volume, 2),
            'debit' => round($debit, 2),
            'nb_skimmers' => $nbSkimmers,
            'nb_bondes' => $nbBondes,
            'nb_refoulements' => $nbRefoulements,
        ];
    }

    // ─── Règles d'exclusion box (CDC §3.5) ───────────────────────────────────

    public static function excludedBoxes(array $i, float $volume): array {
        $excluded = [];
        if (($i['traitement'] ?? '') === 'uv_oxygene') $excluded[] = 'S';
        if (!empty($i['bypass_pac']))                   $excluded[] = 'S';
        if ($volume > 37 && $volume <= 52)              $excluded[] = 'S';
        if ($volume > 52 && $volume <= 75) {
            $excluded[] = 'S';
            $excluded[] = 'M';
        }
        return array_values(array_unique($excluded));
    }

    // ─── Bassin couvert + traitement auto ────────────────────────────────────

    public static function allowedTreatments(array $i): array {
        if (empty($i['bassin_couvert'])) return self::TREATMENTS;
        // bassin couvert → on retire les traitements interdits (CDC §3.2 étape 1)
        return array_values(array_diff(self::TREATMENTS, self::TREATMENTS_FORBIDDEN_WHEN_COVERED));
    }

    // ─── Sélection box (CDC §3.3) ────────────────────────────────────────────

    /**
     * Box choisie = la plus petite box non exclue dont volume_max >= volume bassin.
     * Si box_override fourni, on tente cette box (doit être non exclue ET >= volume requis).
     *
     * @throws \DomainException si aucune box ne correspond ('volume_hors_gamme')
     */
    public static function pickBox(float $volume, array $excluded, ?string $override = null): array {
        $boxes = self::loadBoxesByCode();
        // ordre canonique S < M < L
        $order = ['S' => 1, 'M' => 2, 'L' => 3];
        uksort($boxes, fn($a, $b) => ($order[$a] ?? 99) <=> ($order[$b] ?? 99));

        if ($override !== null && isset($boxes[$override])) {
            $b = $boxes[$override];
            if (!in_array($override, $excluded, true) && (float)$b['volume_max_m3'] >= $volume) {
                return self::formatBox($b);
            }
        }

        foreach ($boxes as $code => $b) {
            if (in_array($code, $excluded, true)) continue;
            if ((float)$b['volume_max_m3'] >= $volume) {
                return self::formatBox($b);
            }
        }
        throw new \DomainException('volume_hors_gamme');
    }

    private static function loadBoxesByCode(): array {
        $db = Database::getInstance();
        $stmt = $db->query("SELECT id, title, slug, featured_image, custom_fields, status FROM cpt_poolp_boxes WHERE status = 'published'");
        $rows = $stmt->fetchAll();
        $byCode = [];
        foreach ($rows as $r) {
            $cf = json_decode($r['custom_fields'] ?? '{}', true) ?: [];
            $code = $cf['code'] ?? null;
            if (!$code) continue;
            $byCode[$code] = array_merge($r, $cf, ['raw' => $r]);
        }
        return $byCode;
    }

    private static function formatBox(array $b): array {
        return [
            'id' => (int)$b['id'],
            'code' => $b['code'],
            'label' => $b['title'],
            'slug' => $b['slug'],
            'volume_max' => (float)($b['volume_max_m3'] ?? 0),
            'debit' => (float)($b['debit_m3h'] ?? 0),
            'diametre_canalisations' => (float)($b['diametre_canalisations_mm'] ?? 0),
            'surface_ext' => (float)($b['surface_ext_m2'] ?? 0),
            'surface_utile' => (float)($b['surface_utile_m2'] ?? 0),
            'taux_utile' => (float)($b['taux_utile_pct'] ?? 0),
            'poids' => (float)($b['poids_kg'] ?? 0),
            'prix_base_ttc' => (float)($b['prix_base_ttc'] ?? 0),
            'prix_base_pro_ht' => (float)($b['prix_base_pro_ht'] ?? 0),
            'photo_url' => self::extractMediaUrl($b['featured_image'] ?? null),
            'description' => $b['description_technique'] ?? null,
        ];
    }

    // featured_image stocké en JSON ({url, sizes, …}) — extrait l'URL pour le frontend
    private static function extractMediaUrl($raw): ?string {
        if (empty($raw)) return null;
        if (is_string($raw)) {
            $trim = trim($raw);
            if ($trim === '' || $trim === 'null') return null;
            if ($trim[0] === '{' || $trim[0] === '[') {
                $decoded = json_decode($trim, true);
                if (is_array($decoded)) {
                    return $decoded['url'] ?? ($decoded['sizes']['banner'] ?? null);
                }
            }
            return $trim;
        }
        if (is_array($raw)) {
            return $raw['url'] ?? ($raw['sizes']['banner'] ?? null);
        }
        return null;
    }

    // ─── Sélection auto références (CDC §3.2 étape 4) ────────────────────────

    /**
     * Lit la composition pour (box, filtre, pompe) puis résout chaque équipement par ID.
     * Si aucune composition n'est définie, fallback sur sélection auto par
     * compatibilité (compatible_box_sizes / compatible_filter_types / compatible_pump_types).
     * Coffret programmation : déduit du type de pompe (mono → BLUETOOTH, variable → WIFI).
     */
    public static function pickEquipments(array $box, array $i): array {
        $boxCode = $box['code'];
        $filtreType = $i['filtre'] ?? 'sable';
        $pompeType = $i['pompe'] ?? 'mono';

        $composition = self::loadComposition($boxCode, $filtreType, $pompeType);

        $result = [
            'filtre' => self::loadEquipmentById($composition['filtre_equipment_id'] ?? null)
                ?: self::pickByCompat('filtre', $boxCode, $filtreType, $pompeType),
            'pompe' => self::loadEquipmentById($composition['pompe_equipment_id'] ?? null)
                ?: self::pickByCompat('pompe', $boxCode, $filtreType, $pompeType),
            'filterbox' => self::loadEquipmentById($composition['filterbox_equipment_id'] ?? null),
            'coffret_distribution' => self::loadEquipmentById($composition['coffret_distribution_equipment_id'] ?? null)
                ?: self::pickByCategorySlug('coffret_distribution', null, $boxCode),
            'coffret_programmation' => self::loadEquipmentById($composition['coffret_programmation_equipment_id'] ?? null),
            'extension' => self::loadEquipmentById($composition['extension_equipment_id'] ?? null),
            'traitement' => self::pickTreatment($i['traitement'] ?? 'aucun'),
            'bypass_pac' => !empty($i['bypass_pac']) ? self::pickByCategorySlug('bypass_pac', null, $boxCode) : null,
        ];

        // Coffret programmation déduit si non explicitement défini en composition
        if ($result['coffret_programmation'] === null) {
            $autoSlug = self::deduceCoffretProgrammation($pompeType);
            $result['coffret_programmation'] = self::pickByCompat('coffret_programmation', $boxCode, null, $pompeType, $autoSlug);
        }

        return array_filter($result, fn($v) => $v !== null);
    }

    /**
     * Cherche un équipement compatible avec (box, filtre, pompe). Optionnellement filtré
     * par slug_choice si fourni. Trie par auto_select_priority desc puis prix_ttc asc.
     */
    private static function pickByCompat(string $category, string $boxCode, ?string $filtreType, ?string $pompeType, ?string $slugChoice = null): ?array {
        $db = Database::getInstance();
        $stmt = $db->query("SELECT id, title, slug, featured_image, custom_fields FROM cpt_poolp_equipments WHERE status = 'published'");
        $rows = $stmt->fetchAll();
        $candidates = [];
        foreach ($rows as $r) {
            $cf = json_decode($r['custom_fields'] ?? '{}', true) ?: [];
            if (($cf['category'] ?? null) !== $category) continue;
            if ($slugChoice !== null && ($cf['slug_choice'] ?? null) !== $slugChoice) continue;
            // Compatibilité box
            $compatBox = self::splitCsv($cf['compatible_box_sizes'] ?? '');
            if (!empty($compatBox) && !in_array($boxCode, $compatBox, true)) continue;
            // Compatibilité filtre
            if ($filtreType !== null) {
                $compatF = self::splitCsv($cf['compatible_filter_types'] ?? '');
                if (!empty($compatF) && !in_array($filtreType, $compatF, true)) continue;
            }
            // Compatibilité pompe
            if ($pompeType !== null) {
                $compatP = self::splitCsv($cf['compatible_pump_types'] ?? '');
                if (!empty($compatP) && !in_array($pompeType, $compatP, true)) continue;
            }
            $candidates[] = array_merge($r, [
                '_priority' => (int)($cf['auto_select_priority'] ?? 0),
                '_prix' => (float)($cf['prix_ttc'] ?? 0),
            ]);
        }
        if (empty($candidates)) return null;
        usort($candidates, function ($a, $b) {
            if ($a['_priority'] !== $b['_priority']) return $b['_priority'] <=> $a['_priority'];
            return $a['_prix'] <=> $b['_prix'];
        });
        return self::formatEquipment($candidates[0]);
    }

    private static function splitCsv(string $csv): array {
        $parts = array_map('trim', explode(',', $csv));
        return array_values(array_filter($parts, fn($p) => $p !== ''));
    }

    public static function deduceCoffretProgrammation(string $pompeType): string {
        return $pompeType === 'variable' ? 'wifi' : 'bluetooth';
    }

    private static function loadComposition(string $boxCode, string $filtreType, string $pompeType): array {
        $db = Database::getInstance();
        $stmt = $db->query("SELECT custom_fields FROM cpt_poolp_compositions WHERE status = 'published'");
        $rows = $stmt->fetchAll();
        foreach ($rows as $r) {
            $cf = json_decode($r['custom_fields'] ?? '{}', true) ?: [];
            if (($cf['box_code'] ?? null) === $boxCode
                && ($cf['filtre_type'] ?? null) === $filtreType
                && ($cf['pompe_type'] ?? null) === $pompeType) {
                return $cf;
            }
        }
        return [];
    }

    private static function loadEquipmentById(?int $id): ?array {
        if (!$id) return null;
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT id, title, slug, featured_image, custom_fields FROM cpt_poolp_equipments WHERE id = ? AND status = 'published'");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) return null;
        return self::formatEquipment($row);
    }

    private static function pickByCategorySlug(string $category, ?string $slugChoice, ?string $boxCode = null): ?array {
        $db = Database::getInstance();
        $sql = "SELECT id, title, slug, featured_image, custom_fields FROM cpt_poolp_equipments WHERE status = 'published'";
        $stmt = $db->query($sql);
        $rows = $stmt->fetchAll();
        $candidates = [];
        foreach ($rows as $r) {
            $cf = json_decode($r['custom_fields'] ?? '{}', true) ?: [];
            if (($cf['category'] ?? null) !== $category) continue;
            if ($slugChoice !== null && ($cf['slug_choice'] ?? null) !== $slugChoice) continue;
            if ($boxCode !== null) {
                $compatBox = self::splitCsv($cf['compatible_box_sizes'] ?? '');
                if (!empty($compatBox) && !in_array($boxCode, $compatBox, true)) continue;
            }
            $candidates[] = array_merge($r, ['priority' => (int)($cf['auto_select_priority'] ?? 0)]);
        }
        if (empty($candidates)) return null;
        usort($candidates, fn($a, $b) => $b['priority'] <=> $a['priority']);
        return self::formatEquipment($candidates[0]);
    }

    public static function pickTreatment(string $slug): ?array {
        if ($slug === 'aucun' || $slug === '') return null;
        return self::pickByCategorySlug('traitement', $slug);
    }

    private static function formatEquipment(array $r): array {
        $cf = json_decode($r['custom_fields'] ?? '{}', true) ?: [];
        return [
            'id' => (int)$r['id'],
            'label' => $r['title'],
            'slug' => $r['slug'],
            'category' => $cf['category'] ?? null,
            'slug_choice' => $cf['slug_choice'] ?? null,
            'reference' => $cf['reference_constructeur'] ?? null,
            'marque' => $cf['marque'] ?? null,
            'description' => $cf['description_courte'] ?? null,
            'icon' => $cf['icon'] ?? null,
            'prix_ttc' => (float)($cf['prix_ttc'] ?? 0),
            'prix_pro_ht' => (float)($cf['prix_pro_ht'] ?? 0),
            'photo_url' => self::extractMediaUrl($r['featured_image'] ?? null),
        ];
    }

    // ─── Finition ────────────────────────────────────────────────────────────

    public static function pickFinition(int $id): ?array {
        if ($id <= 0) return null;
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT id, title, custom_fields FROM cpt_poolp_finitions WHERE id = ? AND status = 'published'");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) return null;
        $cf = json_decode($row['custom_fields'] ?? '{}', true) ?: [];
        return [
            'id' => (int)$row['id'],
            'label' => $row['title'],
            'color_label' => $cf['color_label'] ?? $row['title'],
            'color_hex' => $cf['color_hex'] ?? null,
            'ral_ref' => $cf['ral_ref'] ?? null,
            'prix_supplement_ttc' => (float)($cf['prix_supplement_ttc'] ?? 0),
            'prix_supplement_pro_ht' => (float)($cf['prix_supplement_pro_ht'] ?? 0),
            'preview_image' => $cf['preview_image'] ?? null,
        ];
    }

    // ─── Logistique (CDC §4.2) ───────────────────────────────────────────────

    public static function resolveDeliveryZone(string $codePostal, string $mode = 'kit'): ?array {
        if ($codePostal === '') return null;
        $db = Database::getInstance();

        // 1. Cherche dans poolp_delivery_zones
        $stmt = $db->query("SELECT * FROM poolp_delivery_zones WHERE is_active = 1 ORDER BY sort_order ASC, id ASC");
        $zones = $stmt->fetchAll();
        foreach ($zones as $z) {
            $cps = json_decode($z['postal_codes'] ?? '[]', true) ?: [];
            if (self::postalCodeMatches($codePostal, $cps)) {
                return self::formatZone($z, $mode);
            }
        }

        // 2. Fallback ecommerce si activé (option plugin)
        $useFallback = self::getSetting('plugin_poolp_configurator_use_ecommerce_shipping_fallback', '1');
        if ($useFallback === '1' || $useFallback === 1 || $useFallback === true) {
            $fallback = self::tryEcommerceFallback($codePostal, $mode);
            if ($fallback) return $fallback;
        }

        return null;
    }

    public static function postalCodeMatches(string $cp, array $patterns): bool {
        foreach ($patterns as $pat) {
            $pat = trim((string)$pat);
            if ($pat === '') continue;
            if ($pat === $cp) return true;
            // Range form "30000-30999"
            if (preg_match('/^(\d{5})-(\d{5})$/', $pat, $m)) {
                if ((int)$cp >= (int)$m[1] && (int)$cp <= (int)$m[2]) return true;
            }
            // Prefix form "30*" or "13*"
            if (str_ends_with($pat, '*')) {
                $prefix = rtrim($pat, '*');
                if (str_starts_with($cp, $prefix)) return true;
            }
        }
        return false;
    }

    private static function formatZone(array $z, string $mode): array {
        $isAssembled = ($mode === 'montee' || $mode === 'assembled');
        $feeTtcCents = $isAssembled ? (int)($z['fee_assembled_ttc_cents'] ?? 0) : (int)($z['fee_kit_ttc_cents'] ?? 0);
        $feeProHtCents = $isAssembled ? (int)($z['fee_assembled_pro_ht_cents'] ?? 0) : (int)($z['fee_kit_pro_ht_cents'] ?? 0);
        $validityDays = (int) self::getSetting('plugin_poolp_configurator_delivery_validity_days', 7);

        return [
            'zone_id' => (int)$z['id'],
            'zone_label' => $z['zone_label'],
            'mode' => $isAssembled ? 'montee' : 'kit',
            'delay_label' => $z['delay_label'] ?? null,
            'fee_ttc' => $feeTtcCents / 100,
            'fee_pro_ht' => $feeProHtCents / 100,
            'valid_until' => date('Y-m-d', time() + $validityDays * 86400),
            'source' => 'poolp',
        ];
    }

    private static function tryEcommerceFallback(string $cp, string $mode): ?array {
        // Check if the ecommerce shipping table exists (it may not on sites without ecommerce)
        $db = Database::getInstance();
        try {
            $stmt = $db->query("SHOW TABLES LIKE 'shipping_zones'");
            if (!$stmt->fetch()) return null;
        } catch (\Throwable $e) {
            return null;
        }
        // Best-effort: pick the first matching zone. Schema may vary — this is a fallback.
        try {
            $stmt = $db->query("SELECT * FROM shipping_zones LIMIT 1");
            $row = $stmt->fetch();
            if (!$row) return null;
            return [
                'zone_id' => (int)($row['id'] ?? 0),
                'zone_label' => $row['name'] ?? 'Zone boutique',
                'mode' => $mode,
                'delay_label' => $row['delay_label'] ?? null,
                'fee_ttc' => 0.0,
                'fee_pro_ht' => 0.0,
                'valid_until' => date('Y-m-d', time() + 7 * 86400),
                'source' => 'ecommerce_fallback',
            ];
        } catch (\Throwable $e) {
            return null;
        }
    }

    // ─── Totaux ──────────────────────────────────────────────────────────────

    public static function computeTotals(array $box, array $equipements, ?array $finition, ?array $livraison, bool $isPro, float $discountRate): array {
        $sumTtc = (float)$box['prix_base_ttc'];
        $sumProHt = (float)$box['prix_base_pro_ht'];

        foreach ($equipements as $eq) {
            $sumTtc += (float)($eq['prix_ttc'] ?? 0);
            $sumProHt += (float)($eq['prix_pro_ht'] ?? 0);
        }

        if ($finition) {
            $sumTtc += (float)$finition['prix_supplement_ttc'];
            $sumProHt += (float)$finition['prix_supplement_pro_ht'];
        }

        if ($livraison) {
            $sumTtc += (float)$livraison['fee_ttc'];
            $sumProHt += (float)$livraison['fee_pro_ht'];
        }

        // Remise pro
        $rate = $discountRate;
        if ($isPro && $rate <= 0) {
            $defaultPct = (float) self::getSetting('plugin_poolp_configurator_default_pro_discount', 5);
            $rate = $defaultPct / 100;
        }
        $proHtRemise = $isPro ? round($sumProHt * (1 - $rate), 2) : null;

        return [
            'ttc' => round($sumTtc, 2),
            'pro_ht_brut' => round($sumProHt, 2),
            'pro_ht_remise' => $proHtRemise,
            'discount_rate' => $isPro ? $rate : 0,
        ];
    }

    // ─── Avertissements (CDC §8.2) ───────────────────────────────────────────

    public static function buildWarnings(array $i): array {
        $warnings = [];
        if (self::getSetting('plugin_poolp_configurator_show_triphase_warning', '1') === '1') {
            $warnings[] = 'triphase';
        }
        if (!empty($i['is_erp']) && self::getSetting('plugin_poolp_configurator_show_erp_warning', '1') === '1') {
            $warnings[] = 'erp';
        }
        return $warnings;
    }

    // ─── Settings helper ─────────────────────────────────────────────────────

    private static function getSetting(string $key, $default = null) {
        static $cache = [];
        if (array_key_exists($key, $cache)) return $cache[$key];
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1");
            $stmt->execute([$key]);
            $row = $stmt->fetch();
            $cache[$key] = $row ? $row['setting_value'] : $default;
        } catch (\Throwable $e) {
            $cache[$key] = $default;
        }
        return $cache[$key];
    }
}
