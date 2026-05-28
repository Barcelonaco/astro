<?php

/**
 * Product controller — catalogue public et admin.
 * Enrichit cpt_products avec variants, images, effective_price, in_stock.
 * Gère filtres, tri, pagination, facettes, CRUD variants, matrix.
 */
class ProductController {

    // ────────────────────────────────────────────────────────────────
    // PUBLIC : Listing + filtres + tri + pagination
    // ────────────────────────────────────────────────────────────────

    public static function listPublic(): void {
        require_ecommerce_enabled();
        self::ensureAllHaveVariants();

        [$sql, $params, $countSql, $countParams] = self::buildQuery();

        $page = max(1, (int) ($_GET['page'] ?? 1));
        $perPage = max(1, min(60, (int) ($_GET['per_page'] ?? 24)));
        $offset = ($page - 1) * $perPage;

        $sql .= " LIMIT ? OFFSET ?";
        $params[] = $perPage;
        $params[] = $offset;

        $db = Database::getInstance();
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $items = array_map(fn($r) => self::enrich($r, true), $rows);

        $countStmt = $db->prepare($countSql);
        $countStmt->execute($countParams);
        $total = (int) $countStmt->fetchColumn();

        json_response([
            'data' => $items,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'pages' => (int) ceil($total / $perPage),
        ]);
    }

    public static function getBySlug(string $slug): void {
        require_ecommerce_enabled();

        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT * FROM cpt_products WHERE slug = ? AND status = 'published'");
        $stmt->execute([$slug]);
        $row = $stmt->fetch();
        if (!$row) error_response('Produit introuvable', 404);

        $item = self::enrich($row, false);
        $item['related'] = self::findRelated((int) $row['id'], 4);
        json_response($item);
    }

    public static function getById(int $id): void {
        require_ecommerce_enabled();
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT * FROM cpt_products WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) error_response('Produit introuvable', 404);
        json_response(self::enrich($row, false));
    }

    /** Endpoint facettes : counts par option, min/max prix, adapté aux filtres actifs. */
    public static function facets(): void {
        require_ecommerce_enabled();
        self::ensureAllHaveVariants();

        // On réutilise la query mais sans LIMIT
        [$sql, $params] = self::buildQuery();
        $db = Database::getInstance();

        // Récupère les product_ids correspondant aux filtres actuels
        $idSql = preg_replace('/SELECT DISTINCT p\.\*/', 'SELECT DISTINCT p.id', $sql);
        $idSql = preg_replace('/\s*ORDER BY.*$/', '', $idSql);
        $stmt = $db->prepare($idSql);
        $stmt->execute($params);
        $productIds = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));

        if (empty($productIds)) {
            json_response(['price' => ['min' => 0, 'max' => 0], 'attributes' => [], 'categories' => [], 'total' => 0]);
        }

        $placeholders = implode(',', array_fill(0, count($productIds), '?'));

        // Fourchette de prix
        $priceStmt = $db->prepare("SELECT MIN(price_cents) AS min_p, MAX(price_cents) AS max_p FROM product_variants WHERE product_id IN ({$placeholders})");
        $priceStmt->execute($productIds);
        $priceRow = $priceStmt->fetch();

        // Attributs (counts par option)
        $attrStmt = $db->prepare("SELECT attributes FROM product_variants WHERE product_id IN ({$placeholders})");
        $attrStmt->execute($productIds);
        $attrCounts = [];
        foreach ($attrStmt->fetchAll(PDO::FETCH_COLUMN) as $json) {
            $attrs = json_decode($json, true) ?: [];
            foreach ($attrs as $k => $v) {
                if (!isset($attrCounts[$k])) $attrCounts[$k] = [];
                if (!isset($attrCounts[$k][$v])) $attrCounts[$k][$v] = 0;
                $attrCounts[$k][$v]++;
            }
        }
        $attributes = [];
        foreach ($attrCounts as $name => $opts) {
            $options = [];
            foreach ($opts as $value => $count) $options[] = ['value' => $value, 'count' => $count];
            usort($options, fn($a, $b) => strcmp($a['value'], $b['value']));
            $attributes[] = ['name' => $name, 'options' => $options];
        }

        // Catégories (counts)
        $catStmt = $db->prepare("SELECT c.id, c.name, c.slug, c.path, c.parent_id, COUNT(DISTINCT m.item_id) AS count FROM cpt_products_categories c JOIN cpt_products_category_map m ON m.category_id = c.id WHERE m.item_id IN ({$placeholders}) GROUP BY c.id, c.name, c.slug, c.path, c.parent_id ORDER BY c.name ASC");
        $catStmt->execute($productIds);
        $categories = $catStmt->fetchAll();

        json_response([
            'total' => count($productIds),
            'price' => [
                'min' => $priceRow ? (int) $priceRow['min_p'] : 0,
                'max' => $priceRow ? (int) $priceRow['max_p'] : 0,
            ],
            'attributes' => $attributes,
            'categories' => $categories,
        ]);
    }

    // ────────────────────────────────────────────────────────────────
    // ADMIN : Stock summary (dynamic, order-aware)
    // ────────────────────────────────────────────────────────────────

    /**
     * Returns stock info per product: total stock, ordered qty, available qty.
     * available = stock_quantity - SUM(order_items.quantity) for active orders.
     * Active = NOT cancelled/refunded/failed.
     */
    public static function stockSummary(): void {
        require_ecommerce_enabled();
        $db = Database::getInstance();

        // Aggregate variant stock per product
        $stmt = $db->query("
            SELECT pv.product_id,
                   SUM(pv.stock_quantity) AS stock_total,
                   MAX(pv.stock_managed)  AS stock_managed,
                   MIN(pv.low_stock_threshold) AS low_stock_threshold
            FROM product_variants pv
            GROUP BY pv.product_id
        ");
        $stockRows = $stmt->fetchAll();

        // Aggregate ordered quantities per product (active orders only)
        $stmt = $db->query("
            SELECT oi.product_id,
                   SUM(oi.quantity) AS ordered_qty
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.status NOT IN ('cancelled', 'refunded', 'failed')
              AND oi.product_id > 0
            GROUP BY oi.product_id
        ");
        $orderedRows = $stmt->fetchAll();
        $orderedMap = [];
        foreach ($orderedRows as $r) {
            $orderedMap[(int) $r['product_id']] = (int) $r['ordered_qty'];
        }

        $result = [];
        foreach ($stockRows as $r) {
            $pid = (int) $r['product_id'];
            $managed = (int) $r['stock_managed'];
            $total = (int) $r['stock_total'];
            $ordered = $orderedMap[$pid] ?? 0;
            $available = $managed ? max(0, $total - $ordered) : null;
            $threshold = (int) ($r['low_stock_threshold'] ?? 5);

            $result[$pid] = [
                'stock_managed' => (bool) $managed,
                'stock_total'   => $total,
                'ordered_qty'   => $ordered,
                'available'     => $available,
                'low_stock'     => $managed && $available !== null && $available <= $threshold,
            ];
        }

        json_response($result);
    }

    /**
     * Returns stock detail for a single product (per-variant breakdown).
     */
    public static function stockDetail(int $productId): void {
        require_ecommerce_enabled();
        $db = Database::getInstance();

        $stmt = $db->prepare("
            SELECT pv.id AS variant_id, pv.sku, pv.attributes,
                   pv.stock_quantity, pv.stock_managed, pv.low_stock_threshold
            FROM product_variants pv
            WHERE pv.product_id = ?
        ");
        $stmt->execute([$productId]);
        $variants = $stmt->fetchAll();

        // Ordered qty per variant
        $stmt = $db->prepare("
            SELECT oi.variant_id, SUM(oi.quantity) AS ordered_qty
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.status NOT IN ('cancelled', 'refunded', 'failed')
              AND oi.product_id = ?
              AND oi.variant_id > 0
            GROUP BY oi.variant_id
        ");
        $stmt->execute([$productId]);
        $orderedMap = [];
        foreach ($stmt->fetchAll() as $r) {
            $orderedMap[(int) $r['variant_id']] = (int) $r['ordered_qty'];
        }

        $totalStock = 0;
        $totalOrdered = 0;
        $managed = false;

        foreach ($variants as &$v) {
            $v['stock_quantity'] = (int) $v['stock_quantity'];
            $v['stock_managed'] = (bool) $v['stock_managed'];
            $v['low_stock_threshold'] = (int) ($v['low_stock_threshold'] ?? 5);
            $ordered = $orderedMap[(int) $v['variant_id']] ?? 0;
            $v['ordered_qty'] = $ordered;
            $v['available'] = $v['stock_managed'] ? max(0, $v['stock_quantity'] - $ordered) : null;
            if ($v['stock_managed']) {
                $managed = true;
                $totalStock += $v['stock_quantity'];
                $totalOrdered += $ordered;
            }
            if (is_string($v['attributes'])) {
                $v['attributes'] = json_decode($v['attributes'], true) ?: [];
            }
        }
        unset($v);

        json_response([
            'product_id'   => $productId,
            'stock_managed' => $managed,
            'stock_total'   => $totalStock,
            'ordered_qty'   => $totalOrdered,
            'available'     => $managed ? max(0, $totalStock - $totalOrdered) : null,
            'variants'      => $variants,
        ]);
    }

    // ────────────────────────────────────────────────────────────────
    // ADMIN : Variants (CRUD + matrix)
    // ────────────────────────────────────────────────────────────────

    public static function listVariants(int $productId): void {
        require_ecommerce_enabled();
        json_response(['variants' => ProductVariantModel::findByProduct($productId)]);
    }

    /** Upsert bulk : remplace les variants du produit avec la liste fournie. */
    public static function replaceVariants(int $productId): void {
        require_ecommerce_enabled();
        $body = get_json_body();
        $list = $body['variants'] ?? [];
        if (!is_array($list)) error_response('variants doit être un tableau', 400);

        $db = Database::getInstance();
        $product = $db->prepare('SELECT slug FROM cpt_products WHERE id = ?');
        $product->execute([$productId]);
        $prodRow = $product->fetch();
        if (!$prodRow) error_response('Produit introuvable', 404);

        $db->beginTransaction();
        try {
            $existing = ProductVariantModel::findByProduct($productId);
            $existingById = [];
            foreach ($existing as $v) $existingById[(int) $v['id']] = $v;

            $keptIds = [];
            foreach ($list as $v) {
                if (!empty($v['id']) && isset($existingById[(int) $v['id']])) {
                    ProductVariantModel::update((int) $v['id'], $v);
                    $keptIds[] = (int) $v['id'];
                } else {
                    if (empty($v['sku'])) {
                        $suffix = !empty($v['attributes'])
                            ? strtolower(preg_replace('/[^a-z0-9]+/i', '-', implode('-', array_values((array) $v['attributes']))))
                            : 'variant';
                        $v['sku'] = $prodRow['slug'] . '-' . $suffix . '-' . substr(md5(uniqid()), 0, 4);
                    }
                    $newId = ProductVariantModel::create($productId, $v);
                    $keptIds[] = $newId;
                }
            }
            // Supprimer orphelins
            foreach ($existing as $v) {
                if (!in_array((int) $v['id'], $keptIds)) ProductVariantModel::delete((int) $v['id']);
            }
            // Garantir qu'au moins un variant existe
            if (empty($keptIds)) {
                ProductVariantModel::ensureDefault($productId, $prodRow['slug'], 0);
            }
            $db->commit();
        } catch (\Exception $e) {
            $db->rollBack();
            error_response('Erreur variants : ' . $e->getMessage(), 500);
        }

        json_response(['variants' => ProductVariantModel::findByProduct($productId)]);
    }

    /** Génère les variants depuis une matrice d'attributs déclarée en ACF. */
    public static function generateMatrix(int $productId): void {
        require_ecommerce_enabled();

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT slug, custom_fields FROM cpt_products WHERE id = ?');
        $stmt->execute([$productId]);
        $prod = $stmt->fetch();
        if (!$prod) error_response('Produit introuvable', 404);

        $body = get_json_body() ?: [];
        $cf = is_string($prod['custom_fields']) ? json_decode($prod['custom_fields'], true) : ($prod['custom_fields'] ?? []);
        $basePrice = (int) round(((float) ($body['base_price'] ?? $cf['base_price'] ?? 0)) * 100);
        $initialStock = (int) ($body['initial_stock'] ?? 0);

        // Resolve attributes: from body, or from custom_fields.attributes (used_for_variations only)
        $attributes = $body['attributes'] ?? null;
        if (!$attributes) {
            // Read from stored attributes, filter for variation-enabled ones
            $storedAttrs = $cf['attributes'] ?? $cf['variant_attributes'] ?? [];
            $attributes = [];
            foreach ($storedAttrs as $attr) {
                if (!empty($attr['used_for_variations'])) {
                    $attributes[] = $attr;
                }
            }
        }

        if (!is_array($attributes) || empty($attributes)) {
            error_response('Aucun attribut marqué "Utilisé pour les variations"', 400);
        }

        // Normalize attributes : values/options peut venir en string (lignes) ou array
        $normalized = [];
        foreach ($attributes as $attr) {
            $opts = $attr['options'] ?? $attr['values'] ?? [];
            if (is_string($opts)) {
                $opts = array_filter(array_map('trim', preg_split('/[\r\n]+/', $opts)));
            }
            $normalized[] = ['name' => trim($attr['name'] ?? ''), 'options' => array_values($opts)];
        }

        $ids = ProductVariantModel::generateMatrix($productId, $prod['slug'], $basePrice, $normalized, $initialStock);
        json_response(['variants' => ProductVariantModel::findByProduct($productId), 'generated_count' => count($ids)]);
    }

    /**
     * S'assure que chaque produit publié a au moins un variant (crée un variant "default" sinon).
     * Appelé avant les listings/facets pour que le JOIN product_variants ne filtre pas les produits
     * nouvellement créés via l'admin CPT générique (qui ne connaît pas les variants).
     */
    private static function ensureAllHaveVariants(): void {
        $db = Database::getInstance();
        $orphans = $db->query("
            SELECT p.id, p.slug, p.custom_fields
            FROM cpt_products p
            LEFT JOIN product_variants v ON v.product_id = p.id
            WHERE v.id IS NULL AND p.status = 'published'
        ")->fetchAll();
        foreach ($orphans as $row) {
            $cf = !empty($row['custom_fields']) ? (is_string($row['custom_fields']) ? json_decode($row['custom_fields'], true) : $row['custom_fields']) : [];
            $basePrice = (int) round(((float) ($cf['base_price'] ?? 0)) * 100);
            ProductVariantModel::ensureDefault((int) $row['id'], $row['slug'], $basePrice);
        }
    }

    // ────────────────────────────────────────────────────────────────
    // HELPERS internes
    // ────────────────────────────────────────────────────────────────

    /**
     * Construit la SELECT + count avec tous les filtres actifs.
     * Retourne [$sql, $params, $countSql, $countParams].
     */
    private static function buildQuery(): array {
        $db = Database::getInstance();
        $conditions = ["p.status = 'published'"];
        $joins = [];
        $params = [];

        // Filtre catégorie (récursif avec sous-catégories si demandé)
        $category = $_GET['category'] ?? null;
        $includeSub = !empty($_GET['include_subcategories']) || ($category && ($_GET['include_subcategories'] ?? '1') !== '0');
        $categoryIds = null;
        if ($category) {
            $cat = ProductCategoryModel::findBySlug($category);
            if (!$cat) {
                // Category introuvable : force 0 résultats
                $conditions[] = 'p.id = 0';
            } else {
                $categoryIds = $includeSub ? ProductCategoryModel::getIdsWithDescendants((int) $cat['id']) : [(int) $cat['id']];
            }
        }
        $categoriesMulti = $_GET['categories'] ?? null;
        if ($categoriesMulti && !$category) {
            $slugs = is_array($categoriesMulti) ? $categoriesMulti : explode(',', (string) $categoriesMulti);
            $ids = [];
            foreach ($slugs as $s) {
                $c = ProductCategoryModel::findBySlug(trim($s));
                if ($c) $ids = array_merge($ids, ProductCategoryModel::getIdsWithDescendants((int) $c['id']));
            }
            if (empty($ids)) $conditions[] = 'p.id = 0';
            else $categoryIds = array_unique($ids);
        }
        if ($categoryIds !== null && !empty($categoryIds)) {
            $ph = implode(',', array_fill(0, count($categoryIds), '?'));
            $joins[] = "JOIN cpt_products_category_map cm ON cm.item_id = p.id AND cm.category_id IN ({$ph})";
            foreach ($categoryIds as $cid) $params[] = $cid;
        }

        // Recherche full-text simple (title + excerpt + sku via join)
        $search = trim($_GET['search'] ?? '');
        if ($search !== '') {
            $like = '%' . $search . '%';
            $joins[] = "LEFT JOIN product_variants pv_sku ON pv_sku.product_id = p.id";
            $conditions[] = '(p.title LIKE ? OR p.excerpt LIKE ? OR pv_sku.sku LIKE ?)';
            $params[] = $like; $params[] = $like; $params[] = $like;
        }

        // Filtres prix (appliqués sur le variant le moins cher)
        $minPrice = isset($_GET['min_price']) ? (int) round(((float) $_GET['min_price']) * 100) : null;
        $maxPrice = isset($_GET['max_price']) ? (int) round(((float) $_GET['max_price']) * 100) : null;
        $filterStock = !empty($_GET['in_stock']);
        $filterOnSale = !empty($_GET['on_sale']);

        // Join agrégation variants (price_min, price_max, total_stock, on_sale)
        $joins[] = "JOIN (SELECT product_id,
                            MIN(price_cents) AS min_price,
                            MAX(price_cents) AS max_price,
                            SUM(CASE WHEN stock_managed = 0 OR stock_quantity > 0 THEN 1 ELSE 0 END) AS available,
                            MAX(CASE WHEN compare_at_price_cents > price_cents THEN 1 ELSE 0 END) AS on_sale
                         FROM product_variants GROUP BY product_id) vagg ON vagg.product_id = p.id";

        if ($minPrice !== null) { $conditions[] = 'vagg.min_price >= ?'; $params[] = $minPrice; }
        if ($maxPrice !== null) { $conditions[] = 'vagg.min_price <= ?'; $params[] = $maxPrice; }
        if ($filterStock) $conditions[] = 'vagg.available > 0';
        if ($filterOnSale) $conditions[] = 'vagg.on_sale = 1';

        // Type produit
        $type = $_GET['type'] ?? null;
        if ($type && in_array($type, ['physical', 'digital', 'service'])) {
            $conditions[] = "JSON_UNQUOTE(JSON_EXTRACT(p.custom_fields, '$.type')) = ?";
            $params[] = $type;
        }

        // Filtres attributs : ?attributes[color]=rouge
        $attrs = $_GET['attributes'] ?? [];
        if (is_array($attrs) && !empty($attrs)) {
            // Pour chaque attribut demandé, JOIN distinct sur product_variants
            $i = 0;
            foreach ($attrs as $name => $value) {
                $alias = 'pv_attr_' . $i++;
                $joins[] = "JOIN product_variants {$alias} ON {$alias}.product_id = p.id AND JSON_UNQUOTE(JSON_EXTRACT({$alias}.attributes, CONCAT('$.', ?))) = ?";
                // Cette technique nécessite les params en amont du FROM... On va plutôt inliner avec PDO ? params
                // Puisqu'on ne peut pas avoir de ? dans le JOIN dynamique avec nom d'attribut dynamique,
                // on va utiliser les guillemets JSON directs (attention injection). On valide strictement :
            }
            // Refaire proprement : remplacer la boucle ci-dessus par des JOIN SQL safe
            array_splice($joins, -count($attrs)); // retire les JOIN mal formés
            $i = 0;
            foreach ($attrs as $name => $value) {
                if (!preg_match('/^[a-zA-Z0-9_]+$/', (string) $name)) continue;
                $alias = 'pv_attr_' . $i++;
                $joins[] = "JOIN product_variants {$alias} ON {$alias}.product_id = p.id AND JSON_UNQUOTE(JSON_EXTRACT({$alias}.attributes, " . $db->quote('$."' . $name . '"') . ")) = ?";
                $params[] = $value;
            }
        }

        // Visibilité catalogue
        $isSearch = $search !== '';
        if ($isSearch) {
            // Exclure hidden + catalog (catalog = pas visible en recherche)
            $conditions[] = "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.custom_fields, '$.visibility_catalog')), 'visible') IN ('visible', 'search')";
        } else {
            // Exclure hidden + search (search = pas visible en catalogue)
            $conditions[] = "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.custom_fields, '$.visibility_catalog')), 'visible') IN ('visible', 'catalog')";
        }

        // Tri
        $sort = $_GET['sort'] ?? 'newest';
        $orderClause = match ($sort) {
            'oldest' => 'p.published_date ASC',
            'price_asc' => 'vagg.min_price ASC',
            'price_desc' => 'vagg.min_price DESC',
            'name_asc' => 'p.title ASC',
            'name_desc' => 'p.title DESC',
            'popularity' => "(SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.product_id = p.id AND o.status IN ('paid','processing','shipped','delivered')) DESC",
            default => 'p.published_date DESC',
        };

        $joinClause = implode(' ', $joins);
        $whereClause = implode(' AND ', $conditions);

        $sql = "SELECT DISTINCT p.*, vagg.min_price AS _sort_price FROM cpt_products p {$joinClause} WHERE {$whereClause} ORDER BY {$orderClause}";
        $countSql = "SELECT COUNT(DISTINCT p.id) FROM cpt_products p {$joinClause} WHERE {$whereClause}";

        return [$sql, $params, $countSql, $params];
    }

    /** Enrichit une ligne cpt_products avec variants, images, prix, stock, catégories. */
    private static function enrich(array $row, bool $summaryOnly = false): array {
        $id = (int) $row['id'];
        $cf = !empty($row['custom_fields']) ? (is_string($row['custom_fields']) ? json_decode($row['custom_fields'], true) : $row['custom_fields']) : [];
        $featuredImage = !empty($row['featured_image']) ? (is_string($row['featured_image']) ? json_decode($row['featured_image'], true) : $row['featured_image']) : null;
        $seoMeta = !empty($row['seo_meta']) ? (is_string($row['seo_meta']) ? json_decode($row['seo_meta'], true) : $row['seo_meta']) : null;

        $variants = ProductVariantModel::findByProduct($id);

        // S'il n'y a aucun variant (produit tout juste créé via CPT), on génère un "default" silencieusement à la volée.
        if (empty($variants)) {
            $basePrice = (int) round(((float) ($cf['base_price'] ?? 0)) * 100);
            ProductVariantModel::ensureDefault($id, $row['slug'], $basePrice);
            $variants = ProductVariantModel::findByProduct($id);
        }

        // Sync compare_at_price from CPT custom_fields → ALL variants
        // (quand le prix promo global est vidé, tous les variants doivent être réinitialisés)
        $variantsEnabled = !empty($cf['variants_enabled']);
        if (array_key_exists('compare_at_price', $cf)) {
            $expectedCompareCents = !empty($cf['compare_at_price'])
                ? (int) round(((float) $cf['compare_at_price']) * 100)
                : 0;
            $needsSync = false;
            foreach ($variants as $v) {
                if ((int) ($v['compare_at_price_cents'] ?? 0) !== $expectedCompareCents) {
                    $needsSync = true;
                    break;
                }
            }
            if ($needsSync) {
                $newVal = $expectedCompareCents ?: null;
                foreach ($variants as $v) {
                    ProductVariantModel::update((int) $v['id'], ['compare_at_price_cents' => $newVal]);
                }
                $variants = ProductVariantModel::findByProduct($id);
            }
        }

        // Sync remaining fields for non-variant products only
        if (!$variantsEnabled && count($variants) === 1) {
            $variant = $variants[0];
            $patch = [];

            if (isset($cf['base_price'])) {
                $expectedPriceCents = (int) round(((float) $cf['base_price']) * 100);
                if ((int) $variant['price_cents'] !== $expectedPriceCents) {
                    $patch['price_cents'] = $expectedPriceCents;
                }
            }
            if (isset($cf['weight_grams'])) {
                $expectedWeight = (int) $cf['weight_grams'];
                if ((int) ($variant['weight_grams'] ?? 0) !== $expectedWeight) {
                    $patch['weight_grams'] = $expectedWeight;
                }
            }
            if (array_key_exists('stock_managed', $cf)) {
                $expectedManaged = !empty($cf['stock_managed']) ? 1 : 0;
                if ((int) ($variant['stock_managed'] ?? 1) !== $expectedManaged) {
                    $patch['stock_managed'] = $expectedManaged;
                }
            }
            if (isset($cf['stock_quantity'])) {
                $expectedStock = (int) $cf['stock_quantity'];
                if ((int) ($variant['stock_quantity'] ?? 0) !== $expectedStock) {
                    $patch['stock_quantity'] = $expectedStock;
                }
            }
            if (isset($cf['low_stock_threshold'])) {
                $expectedThreshold = (int) $cf['low_stock_threshold'];
                if ((int) ($variant['low_stock_threshold'] ?? 5) !== $expectedThreshold) {
                    $patch['low_stock_threshold'] = $expectedThreshold;
                }
            }

            if (!empty($patch)) {
                ProductVariantModel::update((int) $variant['id'], $patch);
                $variants = ProductVariantModel::findByProduct($id);
            }
        }

        $minPrice = min(array_map(fn($v) => $v['price_cents'], $variants));
        $maxPrice = max(array_map(fn($v) => $v['price_cents'], $variants));
        // compare_at_price_cents = prix promo (inférieur au prix de base quand actif)
        $compareMin = null;
        foreach ($variants as $v) {
            if (!empty($v['compare_at_price_cents']) && $v['compare_at_price_cents'] < $v['price_cents']) {
                $compareMin = $compareMin === null ? $v['compare_at_price_cents'] : min($compareMin, $v['compare_at_price_cents']);
            }
        }
        $inStock = false;
        $stockTracked = false;
        $stockTotal = 0;
        $lowStock = false;
        foreach ($variants as $v) {
            if ($v['stock_managed']) {
                $stockTracked = true;
                $stockTotal += (int) ($v['stock_quantity'] ?? 0);
                $threshold = $v['low_stock_threshold'] !== null ? (int) $v['low_stock_threshold'] : 5;
                if ((int) ($v['stock_quantity'] ?? 0) <= $threshold) $lowStock = true;
            }
            if (!$v['stock_managed'] || $v['stock_quantity'] > 0) $inStock = true;
        }
        // Un produit est "configuré" dès qu'il a un prix ou qu'il a été explicitement mis en stock
        $isConfigured = $minPrice > 0 || (!empty($variants) && count($variants) > 1);

        // HT prices (TTC ÷ (1 + taux TVA)) — basé sur prix effectif (promo si active)
        $taxCode = $cf['tax_code'] ?? 'FR_STANDARD';
        $taxRate = self::getTaxRate($taxCode);
        $effectiveMin = ($compareMin !== null && $compareMin < $minPrice) ? $compareMin : $minPrice;
        $htMin = (int) round($effectiveMin / (1 + $taxRate / 100));
        $htMax = (int) round($maxPrice / (1 + $taxRate / 100));

        $out = [
            'id' => $id,
            'title' => $row['title'],
            'slug' => $row['slug'],
            'excerpt' => $row['excerpt'] ?? null,
            'featured_image' => $featuredImage,
            'status' => $row['status'],
            'published_date' => $row['published_date'] ?? null,
            'type' => $cf['type'] ?? 'physical',
            'tax_code' => $taxCode,
            'tax_rate' => $taxRate,
            'is_featured' => !empty($cf['is_featured']),
            'requires_shipping' => $cf['type'] === 'physical' ? true : !empty($cf['requires_shipping']),
            'short_features' => $cf['short_features'] ?? [],
            'price_cents_min' => $minPrice,
            'price_cents_max' => $maxPrice,
            'price_ht_cents_min' => $htMin,
            'price_ht_cents_max' => $htMax,
            'compare_at_price_cents' => $compareMin,
            'has_variants' => count($variants) > 1,
            'in_stock' => $inStock,
            'stock_tracked' => $stockTracked,
            'stock_total' => $stockTracked ? $stockTotal : null,
            'low_stock' => $stockTracked && $lowStock,
            'is_configured' => $isConfigured,
            'currency' => 'EUR',
            // Technical range (CDC §7.2 — plage technique)
            'debit_min' => isset($cf['debit_min']) ? (float) $cf['debit_min'] : null,
            'debit_max' => isset($cf['debit_max']) ? (float) $cf['debit_max'] : null,
            'volume_min' => isset($cf['volume_min']) ? (float) $cf['volume_min'] : null,
            'volume_max' => isset($cf['volume_max']) ? (float) $cf['volume_max'] : null,
            'reference_constructeur' => $cf['reference_constructeur'] ?? null,
        ];

        // Détails complets pour la fiche produit
        if (!$summaryOnly) {
            $images = ProductImageModel::findByProduct($id);
            // Fallback : si aucune image dans product_variants.images, utiliser custom_fields.gallery
            if (empty($images) && !empty($cf['gallery'])) {
                $cfGallery = is_string($cf['gallery']) ? json_decode($cf['gallery'], true) : $cf['gallery'];
                if (is_array($cfGallery)) {
                    foreach ($cfGallery as $g) {
                        $url = is_string($g) ? $g : ($g['url'] ?? null);
                        if ($url) {
                            $images[] = [
                                'product_id' => $id,
                                'variant_id' => null,
                                'media_id'   => $g['id'] ?? null,
                                'position'   => count($images),
                                'alt'        => is_array($g) ? ($g['alt'] ?? '') : '',
                                'url'        => $url,
                                'width'      => $g['width'] ?? null,
                                'height'     => $g['height'] ?? null,
                                'mime_type'  => null,
                            ];
                        }
                    }
                }
            }
            $out['content'] = $row['content'] ?? null;
            $out['custom_fields'] = $cf;
            $out['seo_meta'] = $seoMeta;
            $out['variants'] = $variants;
            $out['gallery'] = $images;
            $out['categories'] = self::categoriesForProduct($id);
            $out['breadcrumb'] = self::primaryBreadcrumb($id, $out['categories']);
        } else {
            // Fallback catégories légères pour les cards
            $out['categories'] = self::categoriesForProduct($id);
        }

        return $out;
    }

    private static function categoriesForProduct(int $productId): array {
        $db = Database::getInstance();
        $stmt = $db->prepare('
            SELECT c.id, c.name, c.slug, c.path, c.parent_id, c.level
            FROM cpt_products_category_map m
            JOIN cpt_products_categories c ON c.id = m.category_id
            WHERE m.item_id = ?
            ORDER BY c.level ASC, c.name ASC
        ');
        $stmt->execute([$productId]);
        return array_map(fn($r) => [
            'id' => (int) $r['id'],
            'name' => $r['name'],
            'slug' => $r['slug'],
            'path' => $r['path'] ?? $r['slug'],
            'parent_id' => $r['parent_id'] !== null ? (int) $r['parent_id'] : null,
            'level' => (int) ($r['level'] ?? 0),
        ], $stmt->fetchAll());
    }

    private static function primaryBreadcrumb(int $productId, array $categories): array {
        if (empty($categories)) return [];
        // Choisit la catégorie la plus profonde (niveau max)
        usort($categories, fn($a, $b) => ($b['level'] ?? 0) <=> ($a['level'] ?? 0));
        $primary = $categories[0];
        return ProductCategoryModel::breadcrumb((int) $primary['id']);
    }

    private static function findRelated(int $productId, int $limit = 4): array {
        $db = Database::getInstance();
        // Même catégorie principale, exclure le produit courant
        $stmt = $db->prepare('
            SELECT DISTINCT p.*
            FROM cpt_products p
            JOIN cpt_products_category_map m ON m.item_id = p.id
            WHERE m.category_id IN (SELECT category_id FROM cpt_products_category_map WHERE item_id = ?)
              AND p.id != ?
              AND p.status = "published"
            ORDER BY RAND()
            LIMIT ?
        ');
        $stmt->execute([$productId, $productId, $limit]);
        $results = $stmt->fetchAll();

        // Fallback : si aucun produit lié via catégorie, prendre des produits récents
        if (empty($results)) {
            $stmt = $db->prepare('
                SELECT * FROM cpt_products
                WHERE id != ? AND status = "published"
                ORDER BY published_date DESC
                LIMIT ?
            ');
            $stmt->execute([$productId, $limit]);
            $results = $stmt->fetchAll();
        }

        return array_map(fn($r) => self::enrich($r, true), $results);
    }

    /** Tax rate from code — cached. */
    private static function getTaxRate(string $code): float {
        static $cache = null;
        if ($cache === null) {
            $cache = [];
            try {
                $rows = Database::getInstance()->query('SELECT code, rate FROM tax_rates')->fetchAll();
                foreach ($rows as $r) $cache[$r['code']] = (float) $r['rate'];
            } catch (\Throwable $e) {}
            if (!isset($cache['FR_STANDARD'])) $cache['FR_STANDARD'] = 20.0;
        }
        return $cache[$code] ?? $cache['FR_STANDARD'];
    }
}
