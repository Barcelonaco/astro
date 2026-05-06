<?php

/**
 * ProductVariant model.
 * Tous les produits ont au moins un variant (produit "simple" = 1 variant avec attributes={}).
 */
class ProductVariantModel {

    public static function findByProduct(int $productId): array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY position ASC, id ASC');
        $stmt->execute([$productId]);
        return array_map([self::class, 'parse'], $stmt->fetchAll());
    }

    public static function findById(int $id): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM product_variants WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? self::parse($row) : null;
    }

    public static function findBySku(string $sku): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM product_variants WHERE sku = ?');
        $stmt->execute([$sku]);
        $row = $stmt->fetch();
        return $row ? self::parse($row) : null;
    }

    public static function create(int $productId, array $data): int {
        $db = Database::getInstance();
        $stmt = $db->prepare('
            INSERT INTO product_variants
                (product_id, sku, attributes, price_cents, compare_at_price_cents, weight_grams, stock_quantity, stock_managed, low_stock_threshold, barcode, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $productId,
            $data['sku'],
            json_encode($data['attributes'] ?? new \stdClass(), JSON_UNESCAPED_UNICODE),
            (int) ($data['price_cents'] ?? 0),
            isset($data['compare_at_price_cents']) ? (int) $data['compare_at_price_cents'] : null,
            isset($data['weight_grams']) ? (int) $data['weight_grams'] : null,
            (int) ($data['stock_quantity'] ?? 0),
            !empty($data['stock_managed']) || !isset($data['stock_managed']) ? 1 : 0,
            (int) ($data['low_stock_threshold'] ?? 5),
            $data['barcode'] ?? null,
            (int) ($data['position'] ?? 0),
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(int $id, array $data): void {
        $db = Database::getInstance();
        $fields = [];
        $values = [];
        $allowed = ['sku', 'attributes', 'price_cents', 'compare_at_price_cents', 'weight_grams', 'stock_quantity', 'stock_managed', 'low_stock_threshold', 'barcode', 'position'];
        foreach ($allowed as $f) {
            if (!array_key_exists($f, $data)) continue;
            $fields[] = "{$f} = ?";
            if ($f === 'attributes') {
                $values[] = json_encode($data[$f], JSON_UNESCAPED_UNICODE);
            } elseif ($f === 'stock_managed') {
                $values[] = !empty($data[$f]) ? 1 : 0;
            } else {
                $values[] = $data[$f];
            }
        }
        if (empty($fields)) return;
        $values[] = $id;
        $stmt = $db->prepare('UPDATE product_variants SET ' . implode(', ', $fields) . ' WHERE id = ?');
        $stmt->execute($values);
    }

    public static function delete(int $id): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('DELETE FROM product_variants WHERE id = ?');
        $stmt->execute([$id]);
    }

    public static function deleteByProduct(int $productId): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('DELETE FROM product_variants WHERE product_id = ?');
        $stmt->execute([$productId]);
    }

    /** Assure qu'un produit a au moins un variant (fallback "simple"). */
    public static function ensureDefault(int $productId, string $productSlug, int $basePriceCents, int $initialStock = 0, bool $stockManaged = true): int {
        $existing = self::findByProduct($productId);
        if (!empty($existing)) return (int) $existing[0]['id'];

        $sku = self::generateUniqueSku($productSlug . '-default');
        return self::create($productId, [
            'sku' => $sku,
            'attributes' => (object) [],
            'price_cents' => $basePriceCents,
            'stock_quantity' => $initialStock,
            'stock_managed' => $stockManaged,
        ]);
    }

    /**
     * Génère la matrix cartésienne de variants depuis les attributs déclarés.
     * $attributes : [ {name, options: [...] }, ... ]
     * Préserve les variants existants qui correspondent au même jeu d'attributs (via sku).
     */
    public static function generateMatrix(int $productId, string $productSlug, int $basePriceCents, array $attributes, int $initialStock = 0): array {
        if (empty($attributes)) {
            $id = self::ensureDefault($productId, $productSlug, $basePriceCents, $initialStock);
            return [$id];
        }

        // Cartesian product
        $combos = [[]];
        foreach ($attributes as $attr) {
            $name = trim($attr['name'] ?? '');
            $options = array_filter(array_map('trim', $attr['options'] ?? []));
            if (empty($name) || empty($options)) continue;
            $new = [];
            foreach ($combos as $combo) {
                foreach ($options as $opt) {
                    $new[] = $combo + [$name => $opt];
                }
            }
            $combos = $new;
        }

        // Préserver variants existants qui matchent exactement (via attributes)
        $existing = self::findByProduct($productId);
        $existingByAttrs = [];
        foreach ($existing as $v) {
            $key = self::attrSignature($v['attributes'] ?? []);
            $existingByAttrs[$key] = $v;
        }

        $db = Database::getInstance();
        $db->beginTransaction();
        try {
            // Supprimer les variants qui ne matchent plus aucun combo
            $matchedIds = [];
            $resultIds = [];
            foreach ($combos as $combo) {
                $key = self::attrSignature($combo);
                if (isset($existingByAttrs[$key])) {
                    $resultIds[] = (int) $existingByAttrs[$key]['id'];
                    $matchedIds[] = (int) $existingByAttrs[$key]['id'];
                } else {
                    $skuSuffix = strtolower(implode('-', array_map(fn($v) => preg_replace('/[^a-z0-9]+/i', '', $v), array_values($combo))));
                    $sku = self::generateUniqueSku($productSlug . '-' . $skuSuffix);
                    $id = self::create($productId, [
                        'sku' => $sku,
                        'attributes' => $combo,
                        'price_cents' => $basePriceCents,
                        'stock_quantity' => $initialStock,
                        'stock_managed' => true,
                    ]);
                    $resultIds[] = $id;
                }
            }
            // Supprimer les orphelins
            foreach ($existing as $v) {
                if (!in_array((int) $v['id'], $matchedIds)) {
                    self::delete((int) $v['id']);
                }
            }
            $db->commit();
        } catch (\Exception $e) {
            $db->rollBack();
            throw $e;
        }

        return $resultIds;
    }

    private static function attrSignature(array $attrs): string {
        ksort($attrs);
        return json_encode($attrs, JSON_UNESCAPED_UNICODE);
    }

    private static function generateUniqueSku(string $base): string {
        $base = strtolower(preg_replace('/[^a-z0-9-]+/i', '-', $base));
        $base = trim($base, '-');
        $candidate = $base;
        $n = 1;
        while (self::findBySku($candidate) !== null) {
            $candidate = $base . '-' . $n++;
            if ($n > 1000) {
                $candidate = $base . '-' . substr(md5(uniqid()), 0, 6);
                break;
            }
        }
        return $candidate;
    }

    private static function parse(array $row): array {
        $row['id'] = (int) $row['id'];
        $row['product_id'] = (int) $row['product_id'];
        $row['price_cents'] = (int) $row['price_cents'];
        $row['compare_at_price_cents'] = $row['compare_at_price_cents'] !== null ? (int) $row['compare_at_price_cents'] : null;
        $row['weight_grams'] = $row['weight_grams'] !== null ? (int) $row['weight_grams'] : null;
        $row['stock_quantity'] = (int) $row['stock_quantity'];
        $row['stock_managed'] = (bool) $row['stock_managed'];
        $row['low_stock_threshold'] = $row['low_stock_threshold'] !== null ? (int) $row['low_stock_threshold'] : null;
        $row['position'] = (int) $row['position'];
        $row['attributes'] = !empty($row['attributes']) ? (is_string($row['attributes']) ? json_decode($row['attributes'], true) : $row['attributes']) : [];
        if ($row['attributes'] === null) $row['attributes'] = [];
        return $row;
    }
}
