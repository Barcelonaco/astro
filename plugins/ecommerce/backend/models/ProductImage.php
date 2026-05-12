<?php

/**
 * ProductImage — galerie produit, stockée dans product_variants.images JSON.
 * Reference media_id depuis la table media_items (pas de FK dure).
 *
 * Schéma JSON par variant : [{ media_id, position, alt }, ...]
 * Hydratation : LEFT JOIN media_items pour url/width/height/mime_type/alt fallback.
 */
class ProductImageModel {

    public static function findByProduct(int $productId): array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id, product_id, images FROM product_variants WHERE product_id = ? ORDER BY position ASC, id ASC');
        $stmt->execute([$productId]);
        $variants = $stmt->fetchAll();

        $entries = [];
        foreach ($variants as $v) {
            $imgs = self::decode($v['images']);
            foreach ($imgs as $img) {
                if (empty($img['media_id'])) continue;
                $entries[] = [
                    'product_id' => (int) $v['product_id'],
                    'variant_id' => (int) $v['id'],
                    'media_id'   => (int) $img['media_id'],
                    'position'   => (int) ($img['position'] ?? 0),
                    'alt'        => $img['alt'] ?? null,
                ];
            }
        }
        return self::hydrate($db, $entries);
    }

    public static function findByVariant(int $variantId): array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id, product_id, images FROM product_variants WHERE id = ?');
        $stmt->execute([$variantId]);
        $v = $stmt->fetch();
        if (!$v) return [];
        $imgs = self::decode($v['images']);
        $entries = [];
        foreach ($imgs as $img) {
            if (empty($img['media_id'])) continue;
            $entries[] = [
                'product_id' => (int) $v['product_id'],
                'variant_id' => (int) $v['id'],
                'media_id'   => (int) $img['media_id'],
                'position'   => (int) ($img['position'] ?? 0),
                'alt'        => $img['alt'] ?? null,
            ];
        }
        return self::hydrate($db, $entries);
    }

    /**
     * Remplace totalement la galerie d'un produit. Chaque image peut cibler un variant via 'variant_id'.
     * Les images sans variant_id sont attachées au 1er variant du produit.
     */
    public static function replaceForProduct(int $productId, array $images): void {
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id FROM product_variants WHERE product_id = ? ORDER BY position ASC, id ASC');
        $stmt->execute([$productId]);
        $variantIds = array_map('intval', array_column($stmt->fetchAll(), 'id'));
        if (empty($variantIds)) return;
        $firstVariantId = $variantIds[0];

        // Group images by target variant
        $byVariant = array_fill_keys($variantIds, []);
        foreach ($images as $i => $img) {
            if (empty($img['media_id'])) continue;
            $vid = isset($img['variant_id']) ? (int) $img['variant_id'] : $firstVariantId;
            if (!in_array($vid, $variantIds, true)) $vid = $firstVariantId;
            $byVariant[$vid][] = [
                'media_id' => (int) $img['media_id'],
                'position' => (int) ($img['position'] ?? $i),
                'alt'      => $img['alt'] ?? null,
            ];
        }

        $db->beginTransaction();
        try {
            $upd = $db->prepare('UPDATE product_variants SET images = ? WHERE id = ?');
            foreach ($byVariant as $vid => $imgs) {
                $upd->execute([empty($imgs) ? null : json_encode(array_values($imgs), JSON_UNESCAPED_UNICODE), $vid]);
            }
            $db->commit();
        } catch (\Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    private static function decode($raw): array {
        if (empty($raw)) return [];
        if (is_array($raw)) return $raw;
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    private static function hydrate(PDO $db, array $entries): array {
        if (empty($entries)) return [];
        $mediaIds = array_unique(array_map(fn($e) => $e['media_id'], $entries));
        $placeholders = implode(',', array_fill(0, count($mediaIds), '?'));
        $stmt = $db->prepare("SELECT id, url, alt AS media_alt, width, height, mime_type FROM media_items WHERE id IN ($placeholders)");
        $stmt->execute(array_values($mediaIds));
        $media = [];
        foreach ($stmt->fetchAll() as $m) $media[(int) $m['id']] = $m;

        $out = [];
        foreach ($entries as $e) {
            $m = $media[$e['media_id']] ?? null;
            $out[] = [
                'product_id' => $e['product_id'],
                'variant_id' => $e['variant_id'],
                'media_id'   => $e['media_id'],
                'position'   => $e['position'],
                'alt'        => $e['alt'] ?? ($m['media_alt'] ?? ''),
                'url'        => $m['url'] ?? null,
                'width'      => isset($m['width'])  ? (int) $m['width']  : null,
                'height'     => isset($m['height']) ? (int) $m['height'] : null,
                'mime_type'  => $m['mime_type'] ?? null,
            ];
        }
        usort($out, fn($a, $b) => ($a['position'] <=> $b['position']) ?: ($a['variant_id'] <=> $b['variant_id']));
        return $out;
    }
}
