<?php

class PostModel {
    public static function findAll(array $filters = []): array {
        $db = Database::getInstance();
        $query = "
            SELECT
                p.*,
                u.name as author_name,
                GROUP_CONCAT(DISTINCT c.id) as category_ids,
                GROUP_CONCAT(DISTINCT c.name) as category_names,
                GROUP_CONCAT(DISTINCT t.name) as tags
            FROM posts p
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN post_categories pc ON p.id = pc.post_id
            LEFT JOIN categories c ON pc.category_id = c.id
            LEFT JOIN post_tags pt ON p.id = pt.post_id
            LEFT JOIN tags t ON pt.tag_id = t.id
            WHERE 1=1
        ";
        $params = [];

        if (!empty($filters['status'])) {
            $query .= ' AND p.status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['category'])) {
            $query .= ' AND c.slug = ?';
            $params[] = $filters['category'];
        }

        $query .= ' GROUP BY p.id ORDER BY p.published_date DESC';

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public static function findBySlug(string $slug): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT
                p.*,
                u.name as author_name,
                u.email as author_email,
                GROUP_CONCAT(DISTINCT c.id) as category_ids,
                GROUP_CONCAT(DISTINCT c.name) as category_names,
                GROUP_CONCAT(DISTINCT c.slug) as category_slugs,
                GROUP_CONCAT(DISTINCT t.name) as tags
            FROM posts p
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN post_categories pc ON p.id = pc.post_id
            LEFT JOIN categories c ON pc.category_id = c.id
            LEFT JOIN post_tags pt ON p.id = pt.post_id
            LEFT JOIN tags t ON pt.tag_id = t.id
            WHERE p.slug = ?
            GROUP BY p.id
        ");
        $stmt->execute([$slug]);
        return $stmt->fetch() ?: null;
    }

    public static function create(array $data): int {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            INSERT INTO posts (title, slug, excerpt, content, featured_image, author_id, published_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['title'], $data['slug'], $data['excerpt'] ?? null,
            $data['content'] ?? null, $data['featured_image'] ?? null,
            $data['author_id'], $data['published_date'] ?? null, $data['status'] ?? 'draft'
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(int $id, array $data): void {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            UPDATE posts
            SET title = ?, slug = ?, excerpt = ?, content = ?, featured_image = ?, published_date = ?, status = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $data['title'], $data['slug'], $data['excerpt'] ?? null,
            $data['content'] ?? null, $data['featured_image'] ?? null,
            $data['published_date'] ?? null, $data['status'] ?? 'draft', $id
        ]);
    }

    public static function delete(int $id): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('DELETE FROM posts WHERE id = ?');
        $stmt->execute([$id]);
    }

    public static function setCategories(int $postId, array $categoryIds): void {
        $db = Database::getInstance();
        $db->prepare('DELETE FROM post_categories WHERE post_id = ?')->execute([$postId]);

        if (!empty($categoryIds)) {
            $stmt = $db->prepare('INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)');
            foreach ($categoryIds as $catId) {
                $stmt->execute([$postId, (int) $catId]);
            }
        }
    }

    public static function setTags(int $postId, array $tagNames): void {
        $db = Database::getInstance();
        $db->prepare('DELETE FROM post_tags WHERE post_id = ?')->execute([$postId]);

        if (!empty($tagNames)) {
            $stmtFind = $db->prepare('SELECT id FROM tags WHERE name = ?');
            $stmtInsertTag = $db->prepare('INSERT INTO tags (name) VALUES (?)');
            $stmtLink = $db->prepare('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)');

            foreach ($tagNames as $tagName) {
                $stmtFind->execute([$tagName]);
                $existing = $stmtFind->fetch();

                if ($existing) {
                    $tagId = $existing['id'];
                } else {
                    $stmtInsertTag->execute([$tagName]);
                    $tagId = (int) $db->lastInsertId();
                }

                $stmtLink->execute([$postId, $tagId]);
            }
        }
    }
}
