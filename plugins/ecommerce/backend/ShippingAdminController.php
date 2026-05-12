<?php
/**
 * ShippingAdminController — CRUD zones + méthodes de livraison.
 *
 * Routes admin :
 *   GET    /admin/shipping-zones
 *   POST   /admin/shipping-zones
 *   PUT    /admin/shipping-zones/:id
 *   DELETE /admin/shipping-zones/:id
 *   GET    /admin/shipping-zones/:id/methods
 *   POST   /admin/shipping-zones/:id/methods
 *   PUT    /admin/shipping-methods/:id
 *   DELETE /admin/shipping-methods/:id
 *
 * Sécurité : require_min_role(editor) appliqué dans autoload.php.
 */
class ShippingAdminController {

    public static function listZones(): void {
        $db = Database::getInstance();
        $zones = $db->query('SELECT * FROM shipping_zones ORDER BY priority DESC, position ASC, id ASC')->fetchAll();
        $methods = $db->query('SELECT * FROM shipping_methods ORDER BY zone_id ASC, position ASC, id ASC')->fetchAll();

        $byZone = [];
        foreach ($methods as $m) {
            $zid = (int) $m['zone_id'];
            $byZone[$zid] = $byZone[$zid] ?? [];
            $byZone[$zid][] = self::serializeMethod($m);
        }

        $out = array_map(function ($z) use ($byZone) {
            $z = self::serializeZone($z);
            $z['methods'] = $byZone[$z['id']] ?? [];
            return $z;
        }, $zones);

        json_response(['zones' => $out]);
    }

    public static function createZone(): void {
        $body = get_json_body();
        $name = trim((string) ($body['name'] ?? ''));
        if ($name === '') error_response('name requis', 400);

        $countries = is_array($body['countries'] ?? null) ? $body['countries'] : ['FR'];
        $patterns = isset($body['postcode_patterns']) && is_array($body['postcode_patterns']) ? $body['postcode_patterns'] : null;

        $db = Database::getInstance();
        $stmt = $db->prepare('INSERT INTO shipping_zones (name, countries, postcode_patterns, priority, position) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([
            $name,
            json_encode($countries, JSON_UNESCAPED_UNICODE),
            $patterns ? json_encode($patterns, JSON_UNESCAPED_UNICODE) : null,
            (int) ($body['priority'] ?? 0),
            (int) ($body['position'] ?? 0),
        ]);
        json_response(['id' => (int) $db->lastInsertId()], 201);
    }

    public static function updateZone(int $id): void {
        $body = get_json_body();
        $db = Database::getInstance();
        $existing = $db->prepare('SELECT * FROM shipping_zones WHERE id = ?');
        $existing->execute([$id]);
        if (!$existing->fetch()) error_response('Zone introuvable', 404);

        $sets = [];
        $params = [];
        if (isset($body['name'])) { $sets[] = 'name = ?'; $params[] = trim((string) $body['name']); }
        if (isset($body['countries']) && is_array($body['countries'])) {
            $sets[] = 'countries = ?'; $params[] = json_encode($body['countries'], JSON_UNESCAPED_UNICODE);
        }
        if (array_key_exists('postcode_patterns', $body)) {
            $patterns = is_array($body['postcode_patterns']) ? $body['postcode_patterns'] : null;
            $sets[] = 'postcode_patterns = ?';
            $params[] = $patterns ? json_encode($patterns, JSON_UNESCAPED_UNICODE) : null;
        }
        if (isset($body['priority'])) { $sets[] = 'priority = ?'; $params[] = (int) $body['priority']; }
        if (isset($body['position'])) { $sets[] = 'position = ?'; $params[] = (int) $body['position']; }
        if (empty($sets)) { json_response(['ok' => true]); return; }

        $params[] = $id;
        $db->prepare('UPDATE shipping_zones SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
        json_response(['ok' => true]);
    }

    public static function deleteZone(int $id): void {
        $db = Database::getInstance();
        $db->prepare('DELETE FROM shipping_zones WHERE id = ?')->execute([$id]);
        json_response(['ok' => true]);
    }

    public static function listMethods(int $zoneId): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM shipping_methods WHERE zone_id = ? ORDER BY position ASC, id ASC');
        $stmt->execute([$zoneId]);
        json_response(['methods' => array_map([self::class, 'serializeMethod'], $stmt->fetchAll())]);
    }

    public static function createMethod(int $zoneId): void {
        $body = get_json_body();
        $name = trim((string) ($body['name'] ?? ''));
        $type = (string) ($body['type'] ?? 'flat');
        if ($name === '') error_response('name requis', 400);
        if (!in_array($type, ['flat', 'free', 'weight', 'price'], true)) error_response('type invalide', 400);

        $db = Database::getInstance();
        $stmt = $db->prepare('INSERT INTO shipping_methods
            (zone_id, name, description, type, price_cents, free_threshold_cents, weight_tiers, tax_code, delivery_min_days, delivery_max_days, is_active, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $zoneId,
            $name,
            trim((string) ($body['description'] ?? '')) ?: null,
            $type,
            (int) ($body['price_cents'] ?? 0),
            isset($body['free_threshold_cents']) && $body['free_threshold_cents'] !== '' ? (int) $body['free_threshold_cents'] : null,
            !empty($body['weight_tiers']) && is_array($body['weight_tiers']) ? json_encode($body['weight_tiers'], JSON_UNESCAPED_UNICODE) : null,
            !empty($body['tax_code']) ? (string) $body['tax_code'] : null,
            isset($body['delivery_min_days']) && $body['delivery_min_days'] !== '' ? (int) $body['delivery_min_days'] : null,
            isset($body['delivery_max_days']) && $body['delivery_max_days'] !== '' ? (int) $body['delivery_max_days'] : null,
            !empty($body['is_active']) ? 1 : 0,
            (int) ($body['position'] ?? 0),
        ]);
        json_response(['id' => (int) $db->lastInsertId()], 201);
    }

    public static function updateMethod(int $id): void {
        $body = get_json_body();
        $db = Database::getInstance();
        $existing = $db->prepare('SELECT * FROM shipping_methods WHERE id = ?');
        $existing->execute([$id]);
        if (!$existing->fetch()) error_response('Méthode introuvable', 404);

        $allowed = [
            'name' => 'string', 'description' => 'string', 'type' => 'string',
            'price_cents' => 'int', 'free_threshold_cents' => 'int_nullable',
            'weight_tiers' => 'json_nullable', 'tax_code' => 'string_nullable',
            'delivery_min_days' => 'int_nullable', 'delivery_max_days' => 'int_nullable',
            'is_active' => 'bool', 'position' => 'int',
        ];

        $sets = [];
        $params = [];
        foreach ($allowed as $field => $cast) {
            if (!array_key_exists($field, $body)) continue;
            $val = $body[$field];
            switch ($cast) {
                case 'string': $val = trim((string) $val); break;
                case 'string_nullable': $val = trim((string) $val); $val = $val === '' ? null : $val; break;
                case 'int': $val = (int) $val; break;
                case 'int_nullable': $val = ($val === '' || $val === null) ? null : (int) $val; break;
                case 'bool': $val = !empty($val) ? 1 : 0; break;
                case 'json_nullable': $val = !empty($val) && is_array($val) ? json_encode($val, JSON_UNESCAPED_UNICODE) : null; break;
            }
            $sets[] = "$field = ?";
            $params[] = $val;
        }
        if (empty($sets)) { json_response(['ok' => true]); return; }

        $params[] = $id;
        $db->prepare('UPDATE shipping_methods SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
        json_response(['ok' => true]);
    }

    public static function deleteMethod(int $id): void {
        $db = Database::getInstance();
        $db->prepare('DELETE FROM shipping_methods WHERE id = ?')->execute([$id]);
        json_response(['ok' => true]);
    }

    private static function serializeZone(array $row): array {
        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'countries' => is_string($row['countries']) ? (json_decode($row['countries'], true) ?: []) : (array) $row['countries'],
            'postcode_patterns' => $row['postcode_patterns'] ? (is_string($row['postcode_patterns']) ? (json_decode($row['postcode_patterns'], true) ?: []) : (array) $row['postcode_patterns']) : [],
            'priority' => (int) $row['priority'],
            'position' => (int) $row['position'],
        ];
    }

    private static function serializeMethod(array $row): array {
        return [
            'id' => (int) $row['id'],
            'zone_id' => (int) $row['zone_id'],
            'name' => $row['name'],
            'description' => $row['description'],
            'type' => $row['type'],
            'price_cents' => (int) $row['price_cents'],
            'free_threshold_cents' => $row['free_threshold_cents'] !== null ? (int) $row['free_threshold_cents'] : null,
            'weight_tiers' => $row['weight_tiers'] ? (is_string($row['weight_tiers']) ? (json_decode($row['weight_tiers'], true) ?: []) : (array) $row['weight_tiers']) : [],
            'tax_code' => $row['tax_code'],
            'delivery_min_days' => $row['delivery_min_days'] !== null ? (int) $row['delivery_min_days'] : null,
            'delivery_max_days' => $row['delivery_max_days'] !== null ? (int) $row['delivery_max_days'] : null,
            'is_active' => (int) $row['is_active'] === 1,
            'position' => (int) $row['position'],
        ];
    }
}
