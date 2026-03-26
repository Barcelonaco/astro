<?php

class UserModel {
    public static function findByEmail(string $email): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        return $stmt->fetch() ?: null;
    }

    public static function findById(int $id): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id, name, email, role FROM users WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public static function findAll(): array {
        $db = Database::getInstance();
        $stmt = $db->query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
        return $stmt->fetchAll();
    }

    public static function create(array $data): int {
        $db = Database::getInstance();
        $name = $data['name'];
        $email = $data['email'];
        $role = $data['role'] ?? 'editor';
        $hashedPassword = password_hash($data['password'], PASSWORD_BCRYPT);

        $stmt = $db->prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
        $stmt->execute([$name, $email, $hashedPassword, $role]);
        return (int) $db->lastInsertId();
    }

    public static function update(int $id, array $data): void {
        $db = Database::getInstance();
        $name = $data['name'];
        $email = $data['email'];
        $role = $data['role'];

        if (!empty($data['password'])) {
            $hashedPassword = password_hash($data['password'], PASSWORD_BCRYPT);
            $stmt = $db->prepare('UPDATE users SET name = ?, email = ?, role = ?, password = ? WHERE id = ?');
            $stmt->execute([$name, $email, $role, $hashedPassword, $id]);
        } else {
            $stmt = $db->prepare('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?');
            $stmt->execute([$name, $email, $role, $id]);
        }
    }

    public static function delete(int $id): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$id]);
    }

    public static function verifyPassword(string $plain, string $hashed): bool {
        return password_verify($plain, $hashed);
    }
}
