<?php

/**
 * E-commerce settings : config boutique, passerelles paiement, numérotation, RGPD.
 * Secrets (stripe_sk, paypal_secret) sont chiffrés via helpers/encryption.php.
 * Super_admin uniquement pour la lecture/écriture.
 */
class EcommerceSettingsController {

    /** Clés stockées en clair dans settings */
    private static array $plainKeys = [
        // (L'activation du module est dérivée de l'état du plugin dans
        //  settings.active_plugins, plus de toggle dédié.)

        // Identité boutique
        'shop_legal_name',
        'shop_vat_number',
        'shop_siret',
        'shop_address',
        'shop_postcode',
        'shop_city',
        'shop_country',
        'shop_phone',
        'shop_email',
        'shop_currency',            // 'EUR' par défaut

        // Paiement - moyens actifs (JSON array : ["stripe","paypal","bank_transfer","on_invoice"])
        'shop_payment_methods',

        // Stripe — mode actif (test|live) + clés publiques par environnement
        'stripe_mode',              // 'test' | 'live' — détermine le couple actif
        'stripe_pk_test',           // pk_test_… (clé publique)
        'stripe_pk_live',           // pk_live_…
        'stripe_webhook_id_test',   // id endpoint test (pas le secret)
        'stripe_webhook_id_live',   // id endpoint production

        // PayPal (client_id OK en clair)
        'paypal_client_id',
        'paypal_mode',              // 'sandbox' | 'live'
        'paypal_webhook_id',

        // Virement — uniquement le titulaire (nom commercial, non sensible).
        // L'IBAN et le BIC sont chiffrés (cf. $secretKeys).
        'bank_holder',

        // Numérotation légale
        'invoice_prefix',           // 'FR-'
        'invoice_next_number',      // compteur
        'quote_prefix',             // 'D-'
        'quote_next_number',

        // Emails
        'ecommerce_emails_from',    // email expéditeur
        'ecommerce_notif_recipients', // destinataires admin (JSON array ou CSV)

        // Fiscalite
        'shop_franchise_tva',       // '1' si micro-entreprise franchise de base (art. 293 B CGI)

        // Checkout
        'checkout_guest_enabled',   // '1' par défaut
        'order_customer_cancel_enabled',
        'order_customer_cancel_window_hours',
        'order_customer_cancel_allowed_statuses',
        'order_customer_cancel_reason_required',

        // RGPD
        'gdpr_auto_erase_enabled',
        'gdpr_inactivity_years',
        'gdpr_inactivity_notify_days_before',
    ];

    /** Clés chiffrées (AES-256-CBC, jamais retournées en clair par défaut) */
    private static array $secretKeys = [
        // Stripe — sk_* + whsec_* par environnement (les 4 stockées en parallèle
        // pour pouvoir basculer test ↔ production sans ressaisir les clés).
        'stripe_sk_test',
        'stripe_sk_live',
        'stripe_webhook_secret_test',
        'stripe_webhook_secret_live',
        'paypal_secret',            // client secret
        'paypal_webhook_secret',
        'bank_iban',                // IBAN du compte de la boutique
        'bank_bic',                 // BIC associé
    ];

    /** Retourne tous les settings e-commerce. Secrets masqués. */
    public static function getAll(): void {
        $db = Database::getInstance();
        $allKeys = array_merge(self::$plainKeys, self::$secretKeys);
        $placeholders = implode(',', array_fill(0, count($allKeys), '?'));
        $stmt = $db->prepare("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ($placeholders)");
        $stmt->execute($allKeys);

        $out = [];
        // Défauts raisonnables
        $defaults = [
            'shop_currency' => 'EUR',
            'shop_country' => 'FR',
            'shop_payment_methods' => '["bank_transfer"]',
            'stripe_mode' => 'test',
            'paypal_mode' => 'sandbox',
            'invoice_prefix' => 'FR-',
            'invoice_next_number' => '1',
            'quote_prefix' => 'D-',
            'quote_next_number' => '1',
            'checkout_guest_enabled' => '1',
            'order_customer_cancel_enabled' => '1',
            'order_customer_cancel_window_hours' => '24',
            'order_customer_cancel_allowed_statuses' => 'pending,awaiting_payment,paid,processing',
            'order_customer_cancel_reason_required' => '1',
            'gdpr_auto_erase_enabled' => '0',
            'gdpr_inactivity_years' => '3',
            'gdpr_inactivity_notify_days_before' => '30',
        ];
        foreach ($defaults as $k => $v) $out[$k] = $v;

        foreach ($stmt->fetchAll() as $row) {
            $key = $row['setting_key'];
            if (in_array($key, self::$secretKeys)) {
                // Masquage : retourne juste un flag "has_key" + preview
                $out[$key . '_set'] = !empty($row['setting_value']);
                $out[$key . '_masked'] = self::maskSecret($row['setting_value']);
            } else {
                $out[$key] = $row['setting_value'];
            }
        }

        json_response($out);
    }

    /** Mise à jour des settings (clés plain + secrets chiffrés). */
    public static function update(): void {
        $body = get_json_body();
        if (!is_array($body)) {
            error_response('Body must be JSON object', 400);
        }

        $db = Database::getInstance();
        $stmt = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");

        $updated = [];
        foreach ($body as $key => $value) {
            if (in_array($key, self::$plainKeys)) {
                // Normalisation spéciale : payment_methods et booleans
                if ($key === 'shop_payment_methods' && is_array($value)) {
                    $value = json_encode(array_values($value));
                }
                $strVal = ($value === null || $value === false) ? '' : (is_bool($value) ? ($value ? '1' : '0') : (string) $value);
                $stmt->execute([$key, $strVal]);
                $updated[] = $key;
            } elseif (in_array($key, self::$secretKeys)) {
                $strVal = (string) $value;
                if ($strVal === '') continue; // ignore empty (pas d'écrasement)
                try {
                    $encrypted = encrypt_value($strVal);
                } catch (\Exception $e) {
                    error_response('Chiffrement impossible : vérifiez AI_ENCRYPTION_KEY dans .env', 500);
                    return;
                }
                $stmt->execute([$key, $encrypted]);
                $updated[] = $key;
            }
        }

        // Invalider le cache du bootstrap frontend pour re-exposer/masquer ecommerce_enabled
        @unlink(__DIR__ . '/../uploads/.bootstrap_cache.json');

        json_response(['updated' => $updated, 'message' => 'Paramètres e-commerce mis à jour']);
    }

    /** Récupère un secret déchiffré (usage interne contrôleurs Stripe/PayPal). */
    public static function getSecret(string $key): string {
        if (!in_array($key, self::$secretKeys)) return '';
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        $encrypted = $stmt->fetchColumn();
        if (!$encrypted) return '';
        try {
            return decrypt_value($encrypted);
        } catch (\Exception $e) {
            return '';
        }
    }

    /** Récupère une valeur en clair (settings non chiffrés). */
    public static function getPlain(string $key): string {
        $stmt = Database::getInstance()->prepare("SELECT setting_value FROM settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        return (string) ($stmt->fetchColumn() ?: '');
    }

    /**
     * Résout la clé Stripe active selon stripe_mode.
     *   $type ∈ ['pk', 'sk', 'webhook_id', 'webhook_secret']
     * Fallback rétrocompat sur l'ancienne clé unique (stripe_sk, stripe_pk, …)
     * pour ne pas casser les installs migrant depuis le schéma single-env.
     */
    public static function getStripeKey(string $type, ?string $modeOverride = null): string {
        $mode = $modeOverride ?? (self::getPlain('stripe_mode') ?: 'test');
        if (!in_array($mode, ['test', 'live'], true)) $mode = 'test';
        $key = "stripe_{$type}_{$mode}";
        $value = in_array($key, self::$secretKeys, true) ? self::getSecret($key) : self::getPlain($key);
        if ($value !== '') return $value;

        // Rétrocompat : ancienne clé unique stripe_{type}
        $legacy = "stripe_{$type}";
        if (in_array($legacy, ['stripe_sk', 'stripe_webhook_secret'], true)) {
            // Lire depuis settings sans passer par self::$secretKeys (qui ne le contient plus)
            $stmt = Database::getInstance()->prepare("SELECT setting_value FROM settings WHERE setting_key = ?");
            $stmt->execute([$legacy]);
            $enc = $stmt->fetchColumn();
            if ($enc) {
                try { return decrypt_value($enc); } catch (\Throwable $e) { return ''; }
            }
            return '';
        }
        return self::getPlain($legacy);
    }

    /**
     * Renvoie la liste des secrets webhook disponibles (test + live + legacy)
     * pour valider la signature d'un event entrant. L'endpoint Stripe peut être
     * configuré dans l'env test ou live ; on essaie les deux.
     *
     * @return array<int, array{mode: string, secret: string}>
     */
    public static function getStripeWebhookSecrets(): array {
        $out = [];
        foreach (['test', 'live'] as $mode) {
            $s = self::getSecret("stripe_webhook_secret_{$mode}");
            if ($s) $out[] = ['mode' => $mode, 'secret' => $s];
        }
        // Legacy single-env
        $stmt = Database::getInstance()->prepare("SELECT setting_value FROM settings WHERE setting_key = 'stripe_webhook_secret'");
        $stmt->execute();
        $enc = $stmt->fetchColumn();
        if ($enc) {
            try {
                $plain = decrypt_value($enc);
                if ($plain) $out[] = ['mode' => 'legacy', 'secret' => $plain];
            } catch (\Throwable $e) {}
        }
        return $out;
    }

    /** Masque un secret chiffré pour affichage. */
    private static function maskSecret(string $encrypted): string {
        if (!$encrypted) return '';
        try {
            $plain = decrypt_value($encrypted);
            if (strlen($plain) > 11) {
                return substr($plain, 0, 7) . str_repeat('•', strlen($plain) - 11) . substr($plain, -4);
            }
            return str_repeat('•', strlen($plain));
        } catch (\Exception $e) {
            return '(erreur de déchiffrement)';
        }
    }

    /** Révèle un secret en clair (GET avec ?reveal=1). Pour usage admin ponctuel. */
    public static function revealSecret(string $key): void {
        if (!in_array($key, self::$secretKeys)) {
            error_response('Clé inconnue', 400);
            return;
        }
        $plain = self::getSecret($key);
        json_response(['key' => $key, 'value' => $plain]);
    }
}
