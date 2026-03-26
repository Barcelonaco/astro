<?php

class PageModel {
    public static function findAll(): array {
        $db = Database::getInstance();
        return $db->query("
            SELECT
                p.*,
                u.name as author_name,
                parent.title as parent_title
            FROM pages p
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN pages parent ON p.parent_id = parent.id
            ORDER BY p.menu_order ASC, p.created_at DESC
        ")->fetchAll();
    }

    public static function findBySlug(string $slug): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT
                p.*,
                u.name as author_name,
                u.email as author_email,
                parent.title as parent_title,
                parent.slug as parent_slug
            FROM pages p
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN pages parent ON p.parent_id = parent.id
            WHERE p.slug = ?
        ");
        $stmt->execute([$slug]);
        return $stmt->fetch() ?: null;
    }

    public static function create(array $data): int {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            INSERT INTO pages (title, slug, content, color_overrides, seo_meta, author_id, status, show_in_menu, menu_order, parent_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['title'], $data['slug'], $data['content'] ?? null,
            $data['color_overrides'] ?? null, $data['seo_meta'] ?? null,
            $data['author_id'], $data['status'] ?? 'draft',
            isset($data['show_in_menu']) ? (int) $data['show_in_menu'] : 1,
            $data['menu_order'] ?? 0,
            $data['parent_id'] ?? null
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(int $id, array $data): void {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            UPDATE pages
            SET title = ?, slug = ?, content = ?, color_overrides = ?, seo_meta = ?, status = ?, show_in_menu = ?, menu_order = ?, parent_id = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $data['title'], $data['slug'], $data['content'] ?? null,
            $data['color_overrides'] ?? null, $data['seo_meta'] ?? null,
            $data['status'] ?? 'draft',
            isset($data['show_in_menu']) ? (int) $data['show_in_menu'] : 1,
            $data['menu_order'] ?? 0,
            $data['parent_id'] ?? null,
            $id
        ]);
    }

    public static function delete(int $id): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('DELETE FROM pages WHERE id = ?');
        $stmt->execute([$id]);
    }

    public static function findNavigation(): array {
        $db = Database::getInstance();
        $rows = $db->query("
            SELECT id, title, slug, menu_order, parent_id
            FROM pages
            WHERE status = 'published' AND show_in_menu = 1
            ORDER BY menu_order ASC, title ASC
        ")->fetchAll();

        $parents = array_filter($rows, fn($p) => empty($p['parent_id']));
        $children = array_filter($rows, fn($p) => !empty($p['parent_id']));

        return array_values(array_map(function ($parent) use ($children) {
            $parent['children'] = array_values(array_filter($children, fn($c) => $c['parent_id'] == $parent['id']));
            return $parent;
        }, $parents));
    }
}
