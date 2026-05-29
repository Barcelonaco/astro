<?php

/**
 * AdminSettingsController — paramètres admin (SMTP, etc.).
 * Super_admin uniquement. Le mot de passe SMTP est chiffré (AES-256-CBC).
 * Quand SMTP est configuré et activé, il override Resend pour l'envoi d'emails.
 */
class AdminSettingsController {

    /** Clés stockées en clair */
    private static array $plainKeys = [
        'smtp_enabled',        // '1' = override Resend
        'smtp_host',           // ex: smtp.gmail.com
        'smtp_port',           // ex: 587
        'smtp_username',       // ex: user@gmail.com
        'smtp_from_email',     // ex: noreply@monsite.fr
        'smtp_from_name',      // ex: Mon Site
        'smtp_encryption',     // 'tls' | 'ssl' | 'none'
    ];

    /** Clés chiffrées */
    private static array $secretKeys = [
        'smtp_password',
    ];

    /** GET — retourne tous les settings admin (password masqué). */
    public static function getSmtp(): void {
        $db = Database::getInstance();
        $allKeys = array_merge(self::$plainKeys, self::$secretKeys);
        $placeholders = implode(',', array_fill(0, count($allKeys), '?'));
        $stmt = $db->prepare("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ($placeholders)");
        $stmt->execute($allKeys);

        $out = [
            'smtp_enabled' => '0',
            'smtp_host' => '',
            'smtp_port' => '587',
            'smtp_username' => '',
            'smtp_from_email' => '',
            'smtp_from_name' => '',
            'smtp_encryption' => 'tls',
        ];

        foreach ($stmt->fetchAll() as $row) {
            $key = $row['setting_key'];
            if (in_array($key, self::$secretKeys)) {
                $out[$key . '_set'] = !empty($row['setting_value']);
                $out[$key . '_masked'] = self::maskSecret($row['setting_value']);
            } else {
                $out[$key] = $row['setting_value'];
            }
        }

        json_response($out);
    }

    /** PUT — met à jour les settings SMTP. */
    public static function updateSmtp(): void {
        $body = get_json_body();
        if (!is_array($body)) {
            error_response('Body must be JSON object', 400);
        }

        $db = Database::getInstance();
        $stmt = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");

        $updated = [];
        foreach ($body as $key => $value) {
            if (in_array($key, self::$plainKeys)) {
                $strVal = ($value === null || $value === false) ? '' : (string) $value;
                $stmt->execute([$key, $strVal]);
                $updated[] = $key;
            } elseif (in_array($key, self::$secretKeys)) {
                $strVal = (string) $value;
                if ($strVal === '') continue; // pas d'ecrasement si vide
                try {
                    $encrypted = encrypt_value($strVal);
                } catch (\Exception $e) {
                    error_response('Chiffrement impossible : verifiez AI_ENCRYPTION_KEY dans .env', 500);
                    return;
                }
                $stmt->execute([$key, $encrypted]);
                $updated[] = $key;
            }
        }

        json_response(['updated' => $updated, 'message' => 'Parametres SMTP mis a jour']);
    }

    /** POST — envoie un email de test via SMTP. */
    public static function testSmtp(): void {
        $body = get_json_body();
        $to = $body['to'] ?? '';
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            error_response('Adresse email invalide', 400);
        }

        // Charger config SMTP depuis la DB
        $config = self::getSmtpConfig();
        if (!$config) {
            error_response('SMTP non configure ou desactive', 400);
        }

        $subject = 'Test SMTP — ' . ($config['from_name'] ?: 'CMS Astro');
        $html = '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">'
            . '<h2 style="margin:0 0 12px;color:#222">Test SMTP OK</h2>'
            . '<p style="color:#555">Cet email confirme que la configuration SMTP fonctionne correctement.</p>'
            . '<p style="color:#999;font-size:12px;margin-top:24px">Envoy&eacute; depuis ' . htmlspecialchars($config['from_name'] ?: 'CMS') . '</p>'
            . '</div>';

        try {
            require_once __DIR__ . '/../helpers/smtp-mailer.php';
            smtp_send_mail($config, $to, $subject, $html);
            json_response(['message' => 'Email de test envoye avec succes']);
        } catch (\Throwable $e) {
            error_response('Echec envoi SMTP : ' . $e->getMessage(), 500);
        }
    }

    /**
     * Retourne la config SMTP si activee et complete, sinon null.
     * Usage interne (OrderMailer).
     */
    public static function getSmtpConfig(): ?array {
        $db = Database::getInstance();
        $allKeys = array_merge(self::$plainKeys, self::$secretKeys);
        $placeholders = implode(',', array_fill(0, count($allKeys), '?'));
        $stmt = $db->prepare("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ($placeholders)");
        $stmt->execute($allKeys);

        $s = [];
        foreach ($stmt->fetchAll() as $row) {
            $s[$row['setting_key']] = $row['setting_value'];
        }

        if (($s['smtp_enabled'] ?? '0') !== '1') return null;
        if (empty($s['smtp_host']) || empty($s['smtp_port'])) return null;

        $password = '';
        if (!empty($s['smtp_password'])) {
            try {
                $password = decrypt_value($s['smtp_password']);
            } catch (\Throwable $e) {
                error_log('AdminSettings: SMTP password decrypt failed: ' . $e->getMessage());
                return null;
            }
        }

        return [
            'host' => $s['smtp_host'],
            'port' => (int) $s['smtp_port'],
            'username' => $s['smtp_username'] ?? '',
            'password' => $password,
            'from_email' => $s['smtp_from_email'] ?? '',
            'from_name' => $s['smtp_from_name'] ?? '',
            'encryption' => $s['smtp_encryption'] ?? 'tls',
        ];
    }

    private static function maskSecret(string $encrypted): string {
        if (!$encrypted) return '';
        try {
            $plain = decrypt_value($encrypted);
            if (strlen($plain) > 8) {
                return substr($plain, 0, 3) . str_repeat('*', strlen($plain) - 6) . substr($plain, -3);
            }
            return str_repeat('*', strlen($plain));
        } catch (\Exception $e) {
            return '(erreur de dechiffrement)';
        }
    }
}
