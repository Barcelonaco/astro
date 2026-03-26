<?php

class CategoryModel {
    public static function findAll(): array {
        $db = Database::getInstance();
        return $db->query('SELECT * FROM categories ORDER BY name')->fetchAll();
    }

    public static function findBySlug(string $slug): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM categories WHERE slug = ?');
        $stmt->execute([$slug]);
        return $stmt->fetch() ?: null;
    }

    public static function create(array $data): int {
        $db = Database::getInstance();
        $stmt = $db->prepare('INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)');
        $stmt->execute([$data['name'], $data['slug'], $data['description'] ?? null]);
        return (int) $db->lastInsertId();
    }

    public static function update(int $id, array $data): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?');
        $stmt->execute([$data['name'], $data['slug'], $data['description'] ?? null, $id]);
    }

    public static function delete(int $id): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('DELETE FROM categories WHERE id = ?');
        $stmt->execute([$id]);
    }
}
