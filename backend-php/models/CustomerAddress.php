<?php

class CustomerAddressModel {

    public static function findByCustomer(int $customerId, ?string $type = null): array {
        $db = Database::getInstance();
        if ($type) {
            $stmt = $db->prepare('SELECT * FROM customer_addresses WHERE customer_id = ? AND type = ? ORDER BY is_default DESC, id ASC');
            $stmt->execute([$customerId, $type]);
        } else {
            $stmt = $db->prepare('SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY type, is_default DESC, id ASC');
            $stmt->execute([$customerId]);
        }
        return $stmt->fetchAll();
    }

    public static function findById(int $id): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM customer_addresses WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public static function create(int $customerId, array $data): int {
        $db = Database::getInstance();
        $type = $data['type'] ?? 'shipping';
        if (!in_array($type, ['billing', 'shipping'])) $type = 'shipping';

        if (!empty($data['is_default'])) {
            self::clearDefaults($customerId, $type);
        }

        $stmt = $db->prepare('
            INSERT INTO customer_addresses
                (customer_id, type, is_default, first_name, last_name, company, address_line1, address_line2, postcode, city, region, country_code, phone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $customerId, $type,
            !empty($data['is_default']) ? 1 : 0,
            $data['first_name'] ?? null,
            $data['last_name'] ?? null,
            $data['company'] ?? null,
            $data['address_line1'] ?? null,
            $data['address_line2'] ?? null,
            $data['postcode'] ?? null,
            $data['city'] ?? null,
            $data['region'] ?? null,
            strtoupper($data['country_code'] ?? 'FR'),
            $data['phone'] ?? null,
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(int $id, int $customerId, array $data): void {
        $db = Database::getInstance();
        // Verify ownership
        $existing = self::findById($id);
        if (!$existing || (int) $existing['customer_id'] !== $customerId) return;

        if (!empty($data['is_default'])) {
            self::clearDefaults($customerId, $existing['type']);
        }

        $fields = [];
        $values = [];
        $allowed = ['is_default', 'first_name', 'last_name', 'company', 'address_line1', 'address_line2', 'postcode', 'city', 'region', 'country_code', 'phone'];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $data)) {
                $fields[] = "{$f} = ?";
                if ($f === 'is_default') $values[] = !empty($data[$f]) ? 1 : 0;
                elseif ($f === 'country_code') $values[] = strtoupper($data[$f] ?? 'FR');
                else $values[] = $data[$f];
            }
        }
        if (empty($fields)) return;
        $values[] = $id;
        $stmt = $db->prepare('UPDATE customer_addresses SET ' . implode(', ', $fields) . ' WHERE id = ?');
        $stmt->execute($values);
    }

    public static function delete(int $id, int $customerId): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?');
        $stmt->execute([$id, $customerId]);
    }

    private static function clearDefaults(int $customerId, string $type): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ? AND type = ?');
        $stmt->execute([$customerId, $type]);
    }
}
