<?php
/**
 * CouponsAdminController — CRUD coupons.
 *
 * Routes :
 *   GET    /admin/coupons
 *   POST   /admin/coupons
 *   PUT    /admin/coupons/:id
 *   DELETE /admin/coupons/:id
 */
class CouponsAdminController {

    public static function listAll(): void {
        $db = Database::getInstance();
        $rows = $db->query('SELECT * FROM coupons ORDER BY is_active DESC, created_at DESC')->fetchAll();
        json_response(['coupons' => array_map([self::class, 'serialize'], $rows)]);
    }

    public static function create(): void {
        $body = get_json_body();
        $code = strtoupper(trim((string) ($body['code'] ?? '')));
        $type = (string) ($body['type'] ?? 'percent');
        if ($code === '') error_response('code requis', 400);
        if (!preg_match('/^[A-Z0-9_-]+$/', $code)) error_response('code invalide (A-Z, 0-9, _, -)', 400);
        if (!in_array($type, ['percent', 'fixed', 'free_shipping'], true)) error_response('type invalide', 400);

        $db = Database::getInstance();
        try {
            $stmt = $db->prepare('INSERT INTO coupons
                (code, type, value_cents, percent, min_subtotal_cents, max_uses, max_uses_per_customer,
                 starts_at, expires_at, applies_to, applies_ids, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([
                $code,
                $type,
                $type === 'fixed' && isset($body['value_cents']) ? (int) $body['value_cents'] : null,
                $type === 'percent' && isset($body['percent']) ? (float) $body['percent'] : null,
                isset($body['min_subtotal_cents']) && $body['min_subtotal_cents'] !== '' ? (int) $body['min_subtotal_cents'] : null,
                isset($body['max_uses']) && $body['max_uses'] !== '' ? (int) $body['max_uses'] : null,
                isset($body['max_uses_per_customer']) && $body['max_uses_per_customer'] !== '' ? (int) $body['max_uses_per_customer'] : null,
                !empty($body['starts_at']) ? (string) $body['starts_at'] : null,
                !empty($body['expires_at']) ? (string) $body['expires_at'] : null,
                in_array($body['applies_to'] ?? 'all', ['all', 'products', 'categories'], true) ? $body['applies_to'] : 'all',
                !empty($body['applies_ids']) && is_array($body['applies_ids']) ? json_encode($body['applies_ids']) : null,
                array_key_exists('is_active', $body) ? (!empty($body['is_active']) ? 1 : 0) : 1,
            ]);
        } catch (\PDOException $e) {
            if (strpos($e->getMessage(), 'Duplicate') !== false) error_response('Ce code coupon existe déjà', 409);
            throw $e;
        }
        json_response(['id' => (int) $db->lastInsertId()], 201);
    }

    public static function update(int $id): void {
        $body = get_json_body();
        $db = Database::getInstance();
        $existing = $db->prepare('SELECT * FROM coupons WHERE id = ?');
        $existing->execute([$id]);
        if (!$existing->fetch()) error_response('Coupon introuvable', 404);

        $allowed = [
            'type' => 'string', 'value_cents' => 'int_nullable', 'percent' => 'float_nullable',
            'min_subtotal_cents' => 'int_nullable', 'max_uses' => 'int_nullable',
            'max_uses_per_customer' => 'int_nullable', 'starts_at' => 'string_nullable',
            'expires_at' => 'string_nullable', 'applies_to' => 'string',
            'applies_ids' => 'json_nullable', 'is_active' => 'bool',
        ];
        $sets = [];
        $params = [];
        foreach ($allowed as $field => $cast) {
            if (!array_key_exists($field, $body)) continue;
            $val = $body[$field];
            switch ($cast) {
                case 'string': $val = (string) $val; break;
                case 'string_nullable': $val = trim((string) $val); $val = $val === '' ? null : $val; break;
                case 'int_nullable': $val = ($val === '' || $val === null) ? null : (int) $val; break;
                case 'float_nullable': $val = ($val === '' || $val === null) ? null : (float) $val; break;
                case 'bool': $val = !empty($val) ? 1 : 0; break;
                case 'json_nullable': $val = !empty($val) && is_array($val) ? json_encode($val) : null; break;
            }
            $sets[] = "$field = ?";
            $params[] = $val;
        }
        if (empty($sets)) { json_response(['ok' => true]); return; }

        $params[] = $id;
        $db->prepare('UPDATE coupons SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
        json_response(['ok' => true]);
    }

    public static function delete(int $id): void {
        $db = Database::getInstance();
        $db->prepare('DELETE FROM coupons WHERE id = ?')->execute([$id]);
        json_response(['ok' => true]);
    }

    private static function serialize(array $row): array {
        return [
            'id' => (int) $row['id'],
            'code' => $row['code'],
            'type' => $row['type'],
            'value_cents' => $row['value_cents'] !== null ? (int) $row['value_cents'] : null,
            'percent' => $row['percent'] !== null ? (float) $row['percent'] : null,
            'min_subtotal_cents' => $row['min_subtotal_cents'] !== null ? (int) $row['min_subtotal_cents'] : null,
            'max_uses' => $row['max_uses'] !== null ? (int) $row['max_uses'] : null,
            'max_uses_per_customer' => $row['max_uses_per_customer'] !== null ? (int) $row['max_uses_per_customer'] : null,
            'used_count' => (int) $row['used_count'],
            'starts_at' => $row['starts_at'],
            'expires_at' => $row['expires_at'],
            'applies_to' => $row['applies_to'],
            'applies_ids' => $row['applies_ids'] ? (is_string($row['applies_ids']) ? (json_decode($row['applies_ids'], true) ?: []) : (array) $row['applies_ids']) : [],
            'is_active' => (int) $row['is_active'] === 1,
            'created_at' => $row['created_at'],
        ];
    }
}
