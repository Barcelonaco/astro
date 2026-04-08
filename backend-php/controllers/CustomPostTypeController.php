<?php

class CustomPostTypeController {
    private static function safeCPTSlug(string $input): ?string {
        return preg_match('/^[a-z0-9-]+$/', $input) ? $input : null;
    }

    private static function ensureCPTTable(string $slug): void {
        $db = Database::getInstance();
        $table = "cpt_{$slug}";
        $db->exec("
            CREATE TABLE IF NOT EXISTS `{$table}` (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL,
                excerpt TEXT,
                content LONGTEXT,
                featured_image JSON,
                custom_fields JSON,
                author_id INT NOT NULL,
                status ENUM('draft', 'published') DEFAULT 'draft',
                published_date DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                seo_meta JSON DEFAULT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE INDEX idx_slug (slug),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        // Migration: add seo_meta column if missing
        try {
            $db->exec("ALTER TABLE `{$table}` ADD COLUMN seo_meta JSON DEFAULT NULL AFTER custom_fields");
        } catch (\PDOException $e) {
            // Column already exists — ignore
        }
    }

    private static function ensureCPTCategoryTables(string $slug): void {
        $db = Database::getInstance();
        $db->exec("
            CREATE TABLE IF NOT EXISTS `cpt_{$slug}_categories` (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL,
                UNIQUE INDEX idx_slug (slug)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        $db->exec("
            CREATE TABLE IF NOT EXISTS `cpt_{$slug}_category_map` (
                item_id INT NOT NULL,
                category_id INT NOT NULL,
                PRIMARY KEY (item_id, category_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public static function migratePluginTables(): void {
        $manifests = PluginController::getPluginManifests();
        foreach ($manifests as $manifest) {
            foreach ($manifest['postTypes'] ?? [] as $pt) {
                if (empty($pt['slug'])) continue;
                self::ensureCPTTable($pt['slug']);
                if (!empty($pt['hasCategories'])) self::ensureCPTCategoryTables($pt['slug']);
            }
        }
    }

    private static function parseCPTRow(array $row): array {
        $row['featured_image'] = !empty($row['featured_image']) ? (is_string($row['featured_image']) ? json_decode($row['featured_image'], true) : $row['featured_image']) : null;
        $row['custom_fields'] = !empty($row['custom_fields']) ? (is_string($row['custom_fields']) ? json_decode($row['custom_fields'], true) : $row['custom_fields']) : new \stdClass();
        $row['seo_meta'] = !empty($row['seo_meta']) ? (is_string($row['seo_meta']) ? json_decode($row['seo_meta'], true) : $row['seo_meta']) : null;
        return $row;
    }

    private static function attachCategories(array $items, string $slug): array {
        if (empty($items)) return $items;
        $db = Database::getInstance();
        $catTable = "cpt_{$slug}_categories";
        $mapTable = "cpt_{$slug}_category_map";
        $ids = array_column($items, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));

        try {
            $stmt = $db->prepare("SELECT m.item_id, c.id, c.name, c.slug FROM `{$mapTable}` m JOIN `{$catTable}` c ON c.id = m.category_id WHERE m.item_id IN ({$placeholders})");
            $stmt->execute($ids);
            $catMap = [];
            foreach ($stmt->fetchAll() as $r) {
                $catMap[$r['item_id']][] = ['id' => $r['id'], 'name' => $r['name'], 'slug' => $r['slug']];
            }
            return array_map(fn($item) => array_merge($item, ['categories' => $catMap[$item['id']] ?? []]), $items);
        } catch (\Exception $e) {
            return array_map(fn($item) => array_merge($item, ['categories' => []]), $items);
        }
    }

    private static function setCPTCategories(string $postType, int $itemId, array $categoryIds): void {
        $db = Database::getInstance();
        $mapTable = "cpt_{$postType}_category_map";
        try {
            $db->prepare("DELETE FROM `{$mapTable}` WHERE item_id = ?")->execute([$itemId]);
            if (!empty($categoryIds)) {
                $stmt = $db->prepare("INSERT INTO `{$mapTable}` (item_id, category_id) VALUES (?, ?)");
                foreach ($categoryIds as $catId) {
                    $stmt->execute([$itemId, (int) $catId]);
                }
            }
        } catch (\Exception $e) {
            // Category tables may not exist
        }
    }

    public static function getItems(string $postType): void {
        $slug = self::safeCPTSlug($postType);
        if (!$slug) error_response('Invalid post type', 400);

        $db = Database::getInstance();
        $table = "cpt_{$slug}";
        $params = [];
        $conditions = [];
        $joinClause = '';

        $status = $_GET['status'] ?? null;
        if ($status && in_array($status, ['published', 'draft'])) {
            $conditions[] = 't.status = ?';
            $params[] = $status;
        }

        $category = $_GET['category'] ?? null;
        if ($category) {
            $joinClause = " JOIN `cpt_{$slug}_category_map` cm ON cm.item_id = t.id JOIN `cpt_{$slug}_categories` cc ON cc.id = cm.category_id AND cc.slug = ?";
            array_unshift($params, $category); // JOIN params first
        }

        $order = ($_GET['order'] ?? '') === 'random' ? 'RAND()' : 't.created_at DESC';
        $sql = "SELECT t.* FROM `{$table}` t{$joinClause}";
        if (!empty($conditions)) $sql .= ' WHERE ' . implode(' AND ', $conditions);
        $sql .= " ORDER BY {$order}";

        $limit = (int) ($_GET['limit'] ?? 0);
        $offset = (int) ($_GET['offset'] ?? 0);
        if ($limit > 0) {
            $sql .= ' LIMIT ?';
            $params[] = $limit;
            if ($offset > 0) {
                $sql .= ' OFFSET ?';
                $params[] = $offset;
            }
        }

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $items = array_map([self::class, 'parseCPTRow'], $stmt->fetchAll());
        $items = self::attachCategories($items, $slug);

        if ($limit > 0) {
            $countParams = [];
            $countSql = "SELECT COUNT(*) as total FROM `{$table}` t";
            if ($category) {
                $countSql .= " JOIN `cpt_{$slug}_category_map` cm ON cm.item_id = t.id JOIN `cpt_{$slug}_categories` cc ON cc.id = cm.category_id AND cc.slug = ?";
                $countParams[] = $category;
            }
            if ($status) {
                $countSql .= ' WHERE t.status = ?';
                $countParams[] = $status;
            }
            $stmt = $db->prepare($countSql);
            $stmt->execute($countParams);
            $total = (int) $stmt->fetch()['total'];
            json_response(['items' => $items, 'total' => $total, 'limit' => $limit, 'offset' => $offset]);
            return;
        }

        json_response($items);
    }

    public static function getOptions(string $postType): void {
        $slug = self::safeCPTSlug($postType);
        if (!$slug) error_response('Invalid post type', 400);

        $db = Database::getInstance();
        $prefix = "cpt_{$slug}_";
        $stmt = $db->prepare('SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE ?');
        $stmt->execute([$prefix . '%']);

        $options = [];
        foreach ($stmt->fetchAll() as $row) {
            $key = str_replace($prefix, '', $row['setting_key']);
            $options[$key] = $row['setting_value'];
        }
        json_response($options);
    }

    public static function getItemBySlug(string $postType, string $slug): void {
        $ptSlug = self::safeCPTSlug($postType);
        if (!$ptSlug) error_response('Invalid post type', 400);

        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT * FROM `cpt_{$ptSlug}` WHERE slug = ?");
        $stmt->execute([$slug]);
        $row = $stmt->fetch();
        if (!$row) error_response('Item not found', 404);

        $item = self::parseCPTRow($row);
        $items = self::attachCategories([$item], $ptSlug);
        json_response($items[0]);
    }

    public static function getItemById(string $postType, int $id): void {
        $slug = self::safeCPTSlug($postType);
        if (!$slug) error_response('Invalid post type', 400);

        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT * FROM `cpt_{$slug}` WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) error_response('Item not found', 404);

        $item = self::parseCPTRow($row);
        $items = self::attachCategories([$item], $slug);
        json_response($items[0]);
    }

    public static function createItem(string $postType, array $authUser): void {
        $slug = self::safeCPTSlug($postType);
        if (!$slug) error_response('Invalid post type', 400);

        $body = get_json_body();
        if (empty($body['title'])) error_response('Title is required', 400);

        $finalSlug = $body['slug'] ?? generate_slug($body['title']);
        $db = Database::getInstance();

        try {
            $stmt = $db->prepare("INSERT INTO `cpt_{$slug}` (title, slug, excerpt, content, featured_image, custom_fields, seo_meta, author_id, status, published_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $body['title'], $finalSlug, $body['excerpt'] ?? null,
                $body['content'] ?? null,
                !empty($body['featured_image']) ? json_encode($body['featured_image']) : null,
                !empty($body['custom_fields']) ? json_encode($body['custom_fields']) : '{}',
                !empty($body['seo_meta']) ? (is_string($body['seo_meta']) ? $body['seo_meta'] : json_encode($body['seo_meta'])) : null,
                $authUser['id'], $body['status'] ?? 'draft',
                $body['published_date'] ?? date('Y-m-d H:i:s')
            ]);
            $itemId = (int) $db->lastInsertId();

            if (!empty($body['categories'])) {
                self::setCPTCategories($slug, $itemId, $body['categories']);
            }

            $stmt = $db->prepare("SELECT * FROM `cpt_{$slug}` WHERE id = ?");
            $stmt->execute([$itemId]);
            $item = self::parseCPTRow($stmt->fetch());
            $items = self::attachCategories([$item], $slug);
            trigger_frontend_rebuild("cpt $slug created");
            json_response($items[0], 201);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) error_response('Un élément avec ce slug existe déjà', 409);
            throw $e;
        }
    }

    public static function updateItem(string $postType, int $id): void {
        $slug = self::safeCPTSlug($postType);
        if (!$slug) error_response('Invalid post type', 400);

        $body = get_json_body();
        $db = Database::getInstance();

        try {
            $stmt = $db->prepare("UPDATE `cpt_{$slug}` SET title = ?, slug = ?, excerpt = ?, content = ?, featured_image = ?, custom_fields = ?, seo_meta = ?, status = ?, published_date = ? WHERE id = ?");
            $stmt->execute([
                $body['title'], $body['slug'], $body['excerpt'] ?? null,
                $body['content'] ?? null,
                !empty($body['featured_image']) ? json_encode($body['featured_image']) : null,
                !empty($body['custom_fields']) ? json_encode($body['custom_fields']) : '{}',
                !empty($body['seo_meta']) ? (is_string($body['seo_meta']) ? $body['seo_meta'] : json_encode($body['seo_meta'])) : null,
                $body['status'] ?? 'draft', $body['published_date'] ?? null, $id
            ]);

            if (isset($body['categories'])) {
                self::setCPTCategories($slug, $id, $body['categories']);
            }

            $stmt = $db->prepare("SELECT * FROM `cpt_{$slug}` WHERE id = ?");
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) error_response('Item not found', 404);

            $item = self::parseCPTRow($row);
            $items = self::attachCategories([$item], $slug);
            trigger_frontend_rebuild("cpt $slug updated");
            json_response($items[0]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) error_response('Un élément avec ce slug existe déjà', 409);
            throw $e;
        }
    }

    public static function deleteItem(string $postType, int $id): void {
        $slug = self::safeCPTSlug($postType);
        if (!$slug) error_response('Invalid post type', 400);

        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT id FROM `cpt_{$slug}` WHERE id = ?");
        $stmt->execute([$id]);
        if (!$stmt->fetch()) error_response('Item not found', 404);

        $db->prepare("DELETE FROM `cpt_{$slug}` WHERE id = ?")->execute([$id]);
        trigger_frontend_rebuild("cpt $slug deleted");
        json_response(['success' => true]);
    }

    // Categories
    public static function getCategories(string $postType): void {
        $slug = self::safeCPTSlug($postType);
        if (!$slug) error_response('Invalid post type', 400);

        $db = Database::getInstance();
        json_response($db->query("SELECT * FROM `cpt_{$slug}_categories` ORDER BY name ASC")->fetchAll());
    }

    public static function createCategory(string $postType): void {
        $slug = self::safeCPTSlug($postType);
        if (!$slug) error_response('Invalid post type', 400);

        $body = get_json_body();
        if (empty($body['name'])) error_response('Name is required', 400);

        $catSlug = generate_slug($body['name']);
        $db = Database::getInstance();
        $stmt = $db->prepare("INSERT INTO `cpt_{$slug}_categories` (name, slug) VALUES (?, ?)");
        $stmt->execute([$body['name'], $catSlug]);
        $id = (int) $db->lastInsertId();

        $stmt = $db->prepare("SELECT * FROM `cpt_{$slug}_categories` WHERE id = ?");
        $stmt->execute([$id]);
        json_response($stmt->fetch(), 201);
    }

    public static function updateCategory(string $postType, int $id): void {
        $slug = self::safeCPTSlug($postType);
        if (!$slug) error_response('Invalid post type', 400);

        $body = get_json_body();
        if (empty($body['name'])) error_response('Name is required', 400);

        $catSlug = generate_slug($body['name']);
        $db = Database::getInstance();
        $db->prepare("UPDATE `cpt_{$slug}_categories` SET name = ?, slug = ? WHERE id = ?")->execute([$body['name'], $catSlug, $id]);

        $stmt = $db->prepare("SELECT * FROM `cpt_{$slug}_categories` WHERE id = ?");
        $stmt->execute([$id]);
        json_response($stmt->fetch());
    }

    public static function deleteCategory(string $postType, int $id): void {
        $slug = self::safeCPTSlug($postType);
        if (!$slug) error_response('Invalid post type', 400);

        $db = Database::getInstance();
        $db->prepare("DELETE FROM `cpt_{$slug}_category_map` WHERE category_id = ?")->execute([$id]);
        $db->prepare("DELETE FROM `cpt_{$slug}_categories` WHERE id = ?")->execute([$id]);
        json_response(['success' => true]);
    }
}
