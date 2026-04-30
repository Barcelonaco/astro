<?php

/**
 * Customer model — clients e-commerce.
 * Distinct de UserModel (comptes admin CMS).
 * Auth via JWT customer (claim type='customer') — voir middleware/customer-auth.php
 */
class CustomerModel {

    public static function findByEmail(string $email): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM customers WHERE email = ?');
        $stmt->execute([$email]);
        return $stmt->fetch() ?: null;
    }

    public static function findById(int $id, bool $includeSensitive = false): ?array {
        $db = Database::getInstance();
        $cols = $includeSensitive
            ? '*'
            : 'id, email, first_name, last_name, phone, company, vat_number, siret, activity, is_pro, pro_status, accepts_marketing, email_verified_at, locale, last_login_at, created_at, updated_at, anonymized_at';
        $stmt = $db->prepare("SELECT {$cols} FROM customers WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function create(array $data): int {
        $db = Database::getInstance();
        $hash = password_hash($data['password'], PASSWORD_BCRYPT);
        // is_pro est dérivé de pro_status='approved' — interdit l'auto-promotion
        // à la création (cf. CustomerAuthController::register qui force pending).
        $proStatus = self::normalizeProStatus($data['pro_status'] ?? 'none');
        $isPro = $proStatus === 'approved' ? 1 : 0;
        $stmt = $db->prepare('
            INSERT INTO customers
                (email, password_hash, first_name, last_name, phone, company, vat_number, siret, activity, is_pro, pro_status, accepts_marketing, locale, last_activity_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ');
        $stmt->execute([
            $data['email'],
            $hash,
            $data['first_name'] ?? null,
            $data['last_name'] ?? null,
            $data['phone'] ?? null,
            $data['company'] ?? null,
            $data['vat_number'] ?? null,
            $data['siret'] ?? null,
            $data['activity'] ?? null,
            $isPro,
            $proStatus,
            !empty($data['accepts_marketing']) ? 1 : 0,
            $data['locale'] ?? 'fr',
        ]);
        return (int) $db->lastInsertId();
    }

    /** Borne pro_status aux valeurs ENUM ; tout invalid → 'none'. */
    private static function normalizeProStatus(?string $status): string {
        $allowed = ['none', 'pending', 'approved', 'rejected'];
        return in_array($status, $allowed, true) ? $status : 'none';
    }

    public static function updateProfile(int $id, array $data): void {
        $db = Database::getInstance();
        $fields = [];
        $values = [];
        // is_pro retiré : maintenant dérivé exclusivement de pro_status (réservé
        // à l'admin). Un changement de pro_status recompute is_pro.
        $allowed = ['first_name', 'last_name', 'phone', 'company', 'vat_number', 'siret', 'activity', 'pro_status', 'accepts_marketing', 'locale'];
        foreach ($allowed as $f) {
            if (!array_key_exists($f, $data)) continue;
            if ($f === 'pro_status') {
                $status = self::normalizeProStatus($data[$f]);
                $fields[] = 'pro_status = ?';
                $values[] = $status;
                $fields[] = 'is_pro = ?';
                $values[] = $status === 'approved' ? 1 : 0;
            } elseif ($f === 'accepts_marketing') {
                $fields[] = "{$f} = ?";
                $values[] = !empty($data[$f]) ? 1 : 0;
            } else {
                $fields[] = "{$f} = ?";
                $values[] = $data[$f];
            }
        }
        if (empty($fields)) return;
        $values[] = $id;
        $stmt = $db->prepare('UPDATE customers SET ' . implode(', ', $fields) . ' WHERE id = ?');
        $stmt->execute($values);
    }

    public static function updatePassword(int $id, string $newPassword): void {
        $db = Database::getInstance();
        $hash = password_hash($newPassword, PASSWORD_BCRYPT);
        $stmt = $db->prepare('UPDATE customers SET password_hash = ? WHERE id = ?');
        $stmt->execute([$hash, $id]);
    }

    public static function verifyPassword(string $plain, string $hash): bool {
        return password_verify($plain, $hash);
    }

    public static function touchActivity(int $id): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('UPDATE customers SET last_activity_at = NOW(), last_login_at = NOW() WHERE id = ?');
        $stmt->execute([$id]);
    }

    /** Créé un token de reset et invalide les précédents non-utilisés. Retourne le token. */
    public static function createPasswordResetToken(int $customerId): string {
        $db = Database::getInstance();
        // Invalider les tokens précédents non-utilisés
        $inv = $db->prepare('UPDATE customer_password_resets SET used_at = NOW() WHERE customer_id = ? AND used_at IS NULL');
        $inv->execute([$customerId]);

        $token = bin2hex(random_bytes(32));
        // Utilise NOW() de MySQL pour éviter les décalages de timezone entre PHP et DB
        $ins = $db->prepare('INSERT INTO customer_password_resets (token, customer_id, expires_at) VALUES (?, ?, NOW() + INTERVAL 1 HOUR)');
        $ins->execute([$token, $customerId]);
        return $token;
    }

    /** Retourne le reset valide (non expiré, non utilisé) ou null. */
    public static function findValidPasswordReset(string $token): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('
            SELECT r.*, c.email, c.first_name, c.last_name
            FROM customer_password_resets r
            JOIN customers c ON c.id = r.customer_id
            WHERE r.token = ? AND r.used_at IS NULL AND r.expires_at > NOW()
            LIMIT 1
        ');
        $stmt->execute([$token]);
        return $stmt->fetch() ?: null;
    }

    public static function markResetUsed(string $token): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('UPDATE customer_password_resets SET used_at = NOW() WHERE token = ?');
        $stmt->execute([$token]);
    }

    /** Purge les tokens expirés (cron léger au login admin). */
    public static function purgeExpiredResets(): int {
        $db = Database::getInstance();
        return $db->exec('DELETE FROM customer_password_resets WHERE expires_at < NOW() - INTERVAL 7 DAY');
    }
}
