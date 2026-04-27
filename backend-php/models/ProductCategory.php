<?php

/**
 * ProductCategory — wrapper sur cpt_products_categories avec hiérarchie.
 * La migration Phase 0 a ajouté : parent_id, path, level, position, description, featured_image, seo_meta.
 * Le path est auto-maintenu (ex: "vetements/homme/t-shirts") pour lookup rapide + breadcrumb.
 */
class ProductCategoryModel {

    public static function findAll(): array {
        $db = Database::getInstance();
        $stmt = $db->query('SELECT * FROM cpt_products_categories ORDER BY level ASC, position ASC, name ASC');
        return array_map([self::class, 'parse'], $stmt->fetchAll());
    }

    public static function findById(int $id): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM cpt_products_categories WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? self::parse($row) : null;
    }

    public static function findBySlug(string $slug): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM cpt_products_categories WHERE slug = ?');
        $stmt->execute([$slug]);
        $row = $stmt->fetch();
        return $row ? self::parse($row) : null;
    }

    /** Retrouve une catégorie depuis son path complet (ex: "vetements/homme/t-shirts"). */
    public static function findByPath(string $path): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM cpt_products_categories WHERE path = ?');
        $stmt->execute([$path]);
        $row = $stmt->fetch();
        return $row ? self::parse($row) : null;
    }

    /** Récupère les IDs d'une catégorie et de toutes ses sous-catégories (récursif). */
    public static function getIdsWithDescendants(int $rootId): array {
        $all = self::findAll();
        $ids = [$rootId];
        $changed = true;
        while ($changed) {
            $changed = false;
            foreach ($all as $cat) {
                if (in_array((int) $cat['parent_id'], $ids) && !in_array((int) $cat['id'], $ids)) {
                    $ids[] = (int) $cat['id'];
                    $changed = true;
                }
            }
        }
        return $ids;
    }

    /** Arbre nested : chaque root a ses children. */
    public static function buildTree(): array {
        $all = self::findAll();
        $byId = [];
        foreach ($all as $cat) {
            $cat['children'] = [];
            $byId[$cat['id']] = $cat;
        }
        $roots = [];
        foreach ($byId as $id => $cat) {
            if (empty($cat['parent_id'])) {
                $roots[] = &$byId[$id];
            } else {
                if (isset($byId[$cat['parent_id']])) {
                    $byId[$cat['parent_id']]['children'][] = &$byId[$id];
                }
            }
        }
        return array_values($roots);
    }

    /** Breadcrumb depuis la racine jusqu'à la catégorie donnée. */
    public static function breadcrumb(int $id): array {
        $crumbs = [];
        $cur = self::findById($id);
        while ($cur) {
            array_unshift($crumbs, ['id' => (int) $cur['id'], 'name' => $cur['name'], 'slug' => $cur['slug'], 'path' => $cur['path']]);
            $cur = !empty($cur['parent_id']) ? self::findById((int) $cur['parent_id']) : null;
        }
        return $crumbs;
    }

    public static function create(array $data): int {
        $db = Database::getInstance();
        $parentId = !empty($data['parent_id']) ? (int) $data['parent_id'] : null;
        [$path, $level] = self::computePath($data['slug'], $parentId);

        $stmt = $db->prepare('
            INSERT INTO cpt_products_categories (name, slug, parent_id, path, level, position, description, featured_image, seo_meta)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $data['name'],
            $data['slug'],
            $parentId,
            $path,
            $level,
            (int) ($data['position'] ?? 0),
            $data['description'] ?? null,
            !empty($data['featured_image']) ? json_encode($data['featured_image'], JSON_UNESCAPED_UNICODE) : null,
            !empty($data['seo_meta']) ? json_encode($data['seo_meta'], JSON_UNESCAPED_UNICODE) : null,
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(int $id, array $data): void {
        $db = Database::getInstance();
        $current = self::findById($id);
        if (!$current) return;

        $fields = [];
        $values = [];

        $slugChanged = false;
        $parentChanged = false;
        $newSlug = $current['slug'];
        $newParent = $current['parent_id'] !== null ? (int) $current['parent_id'] : null;

        if (isset($data['name'])) { $fields[] = 'name = ?'; $values[] = $data['name']; }
        if (isset($data['slug']) && $data['slug'] !== $current['slug']) {
            $fields[] = 'slug = ?'; $values[] = $data['slug'];
            $newSlug = $data['slug'];
            $slugChanged = true;
        }
        if (array_key_exists('parent_id', $data)) {
            $p = !empty($data['parent_id']) ? (int) $data['parent_id'] : null;
            // Empêcher les cycles : le nouveau parent ne peut pas être un descendant
            if ($p !== null && $p !== $id && !in_array($p, self::getIdsWithDescendants($id))) {
                $fields[] = 'parent_id = ?'; $values[] = $p;
                $newParent = $p;
                $parentChanged = true;
            } elseif ($p === null) {
                $fields[] = 'parent_id = ?'; $values[] = null;
                $newParent = null;
                $parentChanged = true;
            }
        }
        if (isset($data['position'])) { $fields[] = 'position = ?'; $values[] = (int) $data['position']; }
        if (array_key_exists('description', $data)) { $fields[] = 'description = ?'; $values[] = $data['description']; }
        if (array_key_exists('featured_image', $data)) {
            $fields[] = 'featured_image = ?';
            $values[] = !empty($data['featured_image']) ? json_encode($data['featured_image'], JSON_UNESCAPED_UNICODE) : null;
        }
        if (array_key_exists('seo_meta', $data)) {
            $fields[] = 'seo_meta = ?';
            $values[] = !empty($data['seo_meta']) ? json_encode($data['seo_meta'], JSON_UNESCAPED_UNICODE) : null;
        }

        if (!empty($fields)) {
            $values[] = $id;
            $stmt = $db->prepare('UPDATE cpt_products_categories SET ' . implode(', ', $fields) . ' WHERE id = ?');
            $stmt->execute($values);
        }

        // Recompute path si slug ou parent a changé (et cascade aux descendants)
        if ($slugChanged || $parentChanged) {
            [$newPath, $newLevel] = self::computePath($newSlug, $newParent);
            $db->prepare('UPDATE cpt_products_categories SET path = ?, level = ? WHERE id = ?')->execute([$newPath, $newLevel, $id]);
            self::refreshDescendants($id);
        }
    }

    public static function delete(int $id): void {
        $db = Database::getInstance();
        // Détacher les enfants au niveau racine (ne supprime pas en cascade — sécurité)
        $db->prepare('UPDATE cpt_products_categories SET parent_id = NULL WHERE parent_id = ?')->execute([$id]);
        $db->prepare('DELETE FROM cpt_products_categories WHERE id = ?')->execute([$id]);
        // Refresh des ex-enfants
        self::refreshAllPaths();
        // Nettoyer la map produit-catégorie
        $db->prepare('DELETE FROM cpt_products_category_map WHERE category_id = ?')->execute([$id]);
    }

    private static function computePath(string $slug, ?int $parentId): array {
        if ($parentId === null) return [$slug, 0];
        $parent = self::findById($parentId);
        if (!$parent) return [$slug, 0];
        return [$parent['path'] . '/' . $slug, (int) $parent['level'] + 1];
    }

    private static function refreshDescendants(int $parentId): void {
        $db = Database::getInstance();
        $children = $db->prepare('SELECT id, slug FROM cpt_products_categories WHERE parent_id = ?');
        $children->execute([$parentId]);
        foreach ($children->fetchAll() as $child) {
            [$path, $level] = self::computePath($child['slug'], $parentId);
            $db->prepare('UPDATE cpt_products_categories SET path = ?, level = ? WHERE id = ?')->execute([$path, $level, $child['id']]);
            self::refreshDescendants((int) $child['id']);
        }
    }

    /** Utilitaire : recalcule tous les path (utile après suppression/import). */
    public static function refreshAllPaths(): void {
        $db = Database::getInstance();
        // Commence par les racines et descend
        $roots = $db->query('SELECT id, slug FROM cpt_products_categories WHERE parent_id IS NULL')->fetchAll();
        foreach ($roots as $root) {
            $db->prepare('UPDATE cpt_products_categories SET path = ?, level = 0 WHERE id = ?')->execute([$root['slug'], $root['id']]);
            self::refreshDescendants((int) $root['id']);
        }
    }

    /** Compte des produits publiés par catégorie (récursif si demandé). */
    public static function countProducts(int $categoryId, bool $recursive = true, bool $publishedOnly = true): int {
        $db = Database::getInstance();
        $ids = $recursive ? self::getIdsWithDescendants($categoryId) : [$categoryId];
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $sql = "SELECT COUNT(DISTINCT p.id) FROM cpt_products p JOIN cpt_products_category_map m ON m.item_id = p.id WHERE m.category_id IN ({$placeholders})";
        if ($publishedOnly) $sql .= " AND p.status = 'published'";
        $stmt = $db->prepare($sql);
        $stmt->execute($ids);
        return (int) $stmt->fetchColumn();
    }

    private static function parse(array $row): array {
        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'slug' => $row['slug'],
            'parent_id' => $row['parent_id'] !== null ? (int) $row['parent_id'] : null,
            'path' => $row['path'] ?? $row['slug'],
            'level' => (int) ($row['level'] ?? 0),
            'position' => (int) ($row['position'] ?? 0),
            'description' => $row['description'] ?? null,
            'featured_image' => !empty($row['featured_image']) ? (is_string($row['featured_image']) ? json_decode($row['featured_image'], true) : $row['featured_image']) : null,
            'seo_meta' => !empty($row['seo_meta']) ? (is_string($row['seo_meta']) ? json_decode($row['seo_meta'], true) : $row['seo_meta']) : null,
        ];
    }
}
