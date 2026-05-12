<?php
/**
 * TaxAdminController — CRUD taux de TVA.
 *
 * Routes :
 *   GET    /admin/tax-rates
 *   POST   /admin/tax-rates
 *   PUT    /admin/tax-rates/:id
 *   DELETE /admin/tax-rates/:id
 *   GET    /shop/tax-rates    (public — alimente les selects côté front/admin CPT)
 */
class TaxAdminController {

    public static function listAdmin(): void {
        json_response(['rates' => self::all()]);
    }

    public static function listPublic(): void {
        json_response(['rates' => self::all()]);
    }

    public static function create(): void {
        $body = get_json_body();
        $code = strtoupper(trim((string) ($body['code'] ?? '')));
        $label = trim((string) ($body['label'] ?? ''));
        if ($code === '' || $label === '') error_response('code et label requis', 400);
        if (!preg_match('/^[A-Z0-9_]+$/', $code)) error_response('code invalide (A-Z, 0-9, _)', 400);

        $rate = (float) ($body['rate'] ?? 0);
        $country = strtoupper(substr(trim((string) ($body['country_code'] ?? 'FR')), 0, 2));
        $isDefault = !empty($body['is_default']) ? 1 : 0;

        $db = Database::getInstance();
        if ($isDefault) {
            $db->prepare('UPDATE tax_rates SET is_default = 0 WHERE country_code = ?')->execute([$country]);
        }
        try {
            $stmt = $db->prepare('INSERT INTO tax_rates (code, label, rate, country_code, is_default) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$code, $label, $rate, $country, $isDefault]);
        } catch (\PDOException $e) {
            if (strpos($e->getMessage(), 'Duplicate') !== false) {
                error_response('Ce code TVA existe déjà', 409);
            }
            throw $e;
        }
        json_response(['id' => (int) $db->lastInsertId()], 201);
    }

    public static function update(int $id): void {
        $body = get_json_body();
        $db = Database::getInstance();
        $existing = $db->prepare('SELECT * FROM tax_rates WHERE id = ?');
        $existing->execute([$id]);
        $row = $existing->fetch();
        if (!$row) error_response('Taux introuvable', 404);

        $sets = [];
        $params = [];
        if (isset($body['label'])) { $sets[] = 'label = ?'; $params[] = trim((string) $body['label']); }
        if (isset($body['rate'])) { $sets[] = 'rate = ?'; $params[] = (float) $body['rate']; }
        if (isset($body['country_code'])) {
            $country = strtoupper(substr(trim((string) $body['country_code']), 0, 2));
            $sets[] = 'country_code = ?'; $params[] = $country;
        }
        if (array_key_exists('is_default', $body)) {
            $isDefault = !empty($body['is_default']) ? 1 : 0;
            if ($isDefault) {
                $country = $body['country_code'] ?? $row['country_code'];
                $db->prepare('UPDATE tax_rates SET is_default = 0 WHERE country_code = ? AND id != ?')->execute([$country, $id]);
            }
            $sets[] = 'is_default = ?'; $params[] = $isDefault;
        }
        if (empty($sets)) { json_response(['ok' => true]); return; }

        $params[] = $id;
        $db->prepare('UPDATE tax_rates SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
        json_response(['ok' => true]);
    }

    public static function delete(int $id): void {
        $db = Database::getInstance();
        $db->prepare('DELETE FROM tax_rates WHERE id = ?')->execute([$id]);
        json_response(['ok' => true]);
    }

    private static function all(): array {
        $db = Database::getInstance();
        $rows = $db->query('SELECT * FROM tax_rates ORDER BY country_code ASC, is_default DESC, rate DESC, code ASC')->fetchAll();
        return array_map(fn($r) => [
            'id' => (int) $r['id'],
            'code' => $r['code'],
            'label' => $r['label'],
            'rate' => (float) $r['rate'],
            'country_code' => $r['country_code'],
            'is_default' => (int) $r['is_default'] === 1,
        ], $rows);
    }
}
