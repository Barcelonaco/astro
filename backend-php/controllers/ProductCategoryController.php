<?php

/**
 * Product categories — endpoints publics arbre + détail + admin CRUD.
 * Wrappe ProductCategoryModel + compte de produits par catégorie.
 */
class ProductCategoryController {

    /** Arbre nested avec compteurs (si ?tree=1) ou plat. */
    public static function listPublic(): void {
        require_ecommerce_enabled();

        $tree = !empty($_GET['tree']);
        $withCounts = !empty($_GET['counts']);
        $recursive = ($_GET['recursive'] ?? '1') !== '0';

        if ($tree) {
            $nodes = ProductCategoryModel::buildTree();
            if ($withCounts) self::attachCountsRecursive($nodes, $recursive);
            json_response($nodes);
        } else {
            $all = ProductCategoryModel::findAll();
            if ($withCounts) {
                foreach ($all as &$cat) {
                    $cat['product_count'] = ProductCategoryModel::countProducts((int) $cat['id'], $recursive);
                }
            }
            json_response($all);
        }
    }

    public static function getBySlug(string $slug): void {
        require_ecommerce_enabled();
        $cat = ProductCategoryModel::findBySlug($slug);
        if (!$cat) error_response('Catégorie introuvable', 404);

        $cat['breadcrumb'] = ProductCategoryModel::breadcrumb((int) $cat['id']);
        $cat['children'] = self::childrenOf((int) $cat['id']);
        $cat['product_count'] = ProductCategoryModel::countProducts((int) $cat['id'], true);
        json_response($cat);
    }

    /** Retrouve une catégorie via son path complet (ex : /api/shop/categories/by-path?path=vetements/homme). */
    public static function getByPath(): void {
        require_ecommerce_enabled();
        $path = trim($_GET['path'] ?? '', '/');
        if ($path === '') error_response('path requis', 400);
        $cat = ProductCategoryModel::findByPath($path);
        if (!$cat) error_response('Catégorie introuvable', 404);

        $cat['breadcrumb'] = ProductCategoryModel::breadcrumb((int) $cat['id']);
        $cat['children'] = self::childrenOf((int) $cat['id']);
        $cat['product_count'] = ProductCategoryModel::countProducts((int) $cat['id'], true);
        json_response($cat);
    }

    // ── Admin CRUD ──────────────────────────────────────────────────────────
    public static function create(): void {
        $body = get_json_body();
        $name = trim($body['name'] ?? '');
        $slug = trim($body['slug'] ?? '');
        if ($name === '') error_response('Nom requis', 400);
        if ($slug === '') $slug = generate_slug($name);

        // Unicité du slug
        if (ProductCategoryModel::findBySlug($slug)) {
            error_response('Slug déjà utilisé', 409);
        }

        $id = ProductCategoryModel::create([
            'name' => $name,
            'slug' => $slug,
            'parent_id' => !empty($body['parent_id']) ? (int) $body['parent_id'] : null,
            'position' => (int) ($body['position'] ?? 0),
            'description' => $body['description'] ?? null,
            'featured_image' => $body['featured_image'] ?? null,
            'seo_meta' => $body['seo_meta'] ?? null,
        ]);
        json_response(['id' => $id, 'category' => ProductCategoryModel::findById($id)], 201);
    }

    public static function update(int $id): void {
        $body = get_json_body();
        if (isset($body['slug']) && $body['slug'] !== '') {
            $existing = ProductCategoryModel::findBySlug($body['slug']);
            if ($existing && (int) $existing['id'] !== $id) {
                error_response('Slug déjà utilisé', 409);
            }
        }
        ProductCategoryModel::update($id, $body);
        json_response(['category' => ProductCategoryModel::findById($id)]);
    }

    public static function delete(int $id): void {
        ProductCategoryModel::delete($id);
        json_response(['message' => 'Catégorie supprimée']);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────
    private static function childrenOf(int $parentId): array {
        $all = ProductCategoryModel::findAll();
        return array_values(array_filter($all, fn($c) => (int) $c['parent_id'] === $parentId));
    }

    private static function attachCountsRecursive(array &$nodes, bool $recursive): void {
        foreach ($nodes as &$node) {
            $node['product_count'] = ProductCategoryModel::countProducts((int) $node['id'], $recursive);
            if (!empty($node['children'])) {
                self::attachCountsRecursive($node['children'], $recursive);
            }
        }
    }
}
