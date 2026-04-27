<?php

/**
 * ProductImage — galerie produit, avec assignation optionnelle à un variant.
 * Reference media_id depuis la table media_items (pas de FK dure car CPT peut être flexible).
 */
class ProductImageModel {

    public static function findByProduct(int $productId): array {
        $db = Database::getInstance();
        $stmt = $db->prepare('
            SELECT pi.*, m.url, m.alt AS media_alt, m.width, m.height, m.mime_type
            FROM product_images pi
            LEFT JOIN media_items m ON m.id = pi.media_id
            WHERE pi.product_id = ?
            ORDER BY pi.position ASC, pi.id ASC
        ');
        $stmt->execute([$productId]);
        return array_map([self::class, 'parse'], $stmt->fetchAll());
    }

    public static function findByVariant(int $variantId): array {
        $db = Database::getInstance();
        $stmt = $db->prepare('
            SELECT pi.*, m.url, m.alt AS media_alt, m.width, m.height, m.mime_type
            FROM product_images pi
            LEFT JOIN media_items m ON m.id = pi.media_id
            WHERE pi.variant_id = ?
            ORDER BY pi.position ASC, pi.id ASC
        ');
        $stmt->execute([$variantId]);
        return array_map([self::class, 'parse'], $stmt->fetchAll());
    }

    public static function create(int $productId, int $mediaId, ?int $variantId = null, int $position = 0, ?string $alt = null): int {
        $db = Database::getInstance();
        $stmt = $db->prepare('INSERT INTO product_images (product_id, variant_id, media_id, position, alt) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$productId, $variantId, $mediaId, $position, $alt]);
        return (int) $db->lastInsertId();
    }

    /** Remplace totalement la galerie d'un produit (supprime + insère). */
    public static function replaceForProduct(int $productId, array $images): void {
        $db = Database::getInstance();
        $db->beginTransaction();
        try {
            $db->prepare('DELETE FROM product_images WHERE product_id = ?')->execute([$productId]);
            $ins = $db->prepare('INSERT INTO product_images (product_id, variant_id, media_id, position, alt) VALUES (?, ?, ?, ?, ?)');
            foreach ($images as $i => $img) {
                if (empty($img['media_id'])) continue;
                $ins->execute([
                    $productId,
                    isset($img['variant_id']) ? (int) $img['variant_id'] : null,
                    (int) $img['media_id'],
                    (int) ($img['position'] ?? $i),
                    $img['alt'] ?? null,
                ]);
            }
            $db->commit();
        } catch (\Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function delete(int $id): void {
        $db = Database::getInstance();
        $db->prepare('DELETE FROM product_images WHERE id = ?')->execute([$id]);
    }

    private static function parse(array $row): array {
        return [
            'id' => (int) $row['id'],
            'product_id' => (int) $row['product_id'],
            'variant_id' => $row['variant_id'] !== null ? (int) $row['variant_id'] : null,
            'media_id' => (int) $row['media_id'],
            'position' => (int) $row['position'],
            'alt' => $row['alt'] ?? $row['media_alt'] ?? '',
            'url' => $row['url'] ?? null,
            'width' => $row['width'] !== null ? (int) $row['width'] : null,
            'height' => $row['height'] !== null ? (int) $row['height'] : null,
            'mime_type' => $row['mime_type'] ?? null,
        ];
    }
}
