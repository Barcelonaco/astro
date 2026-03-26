<?php

class ReusableBlocModel {
    public static function findAll(): array {
        $db = Database::getInstance();
        return $db->query("
            SELECT rb.*, u.name as author_name
            FROM reusable_blocs rb
            LEFT JOIN users u ON rb.author_id = u.id
            ORDER BY rb.title ASC
        ")->fetchAll();
    }

    public static function findById(int $id): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT rb.*, u.name as author_name
            FROM reusable_blocs rb
            LEFT JOIN users u ON rb.author_id = u.id
            WHERE rb.id = ?
        ");
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public static function create(array $data): int {
        $db = Database::getInstance();
        $stmt = $db->prepare('INSERT INTO reusable_blocs (title, content, status, author_id) VALUES (?, ?, ?, ?)');
        $stmt->execute([$data['title'], $data['content'], $data['status'] ?? 'published', $data['author_id']]);
        return (int) $db->lastInsertId();
    }

    public static function update(int $id, array $data): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('UPDATE reusable_blocs SET title = ?, content = ?, status = ? WHERE id = ?');
        $stmt->execute([$data['title'], $data['content'], $data['status'] ?? 'published', $id]);
    }

    public static function delete(int $id): void {
        $db = Database::getInstance();
        $db->prepare('DELETE FROM reusable_blocs WHERE id = ?')->execute([$id]);
    }
}
