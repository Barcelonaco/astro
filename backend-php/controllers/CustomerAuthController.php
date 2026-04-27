<?php

/**
 * Customer auth controller — inscription, connexion, reset password, profil, adresses.
 * Toutes les routes exigent le feature flag ecommerce_enabled via require_ecommerce_enabled().
 * Les secrets sont rate-limités pour prévenir bruteforce + enumeration.
 */
class CustomerAuthController {

    // ── Inscription ─────────────────────────────────────────────────────────
    public static function register(): void {
        require_ecommerce_enabled();
        check_rate_limit('customer_register', 5, 3600); // 5 / heure / IP

        $body = get_json_body();
        $email = trim(strtolower($body['email'] ?? ''));
        $password = $body['password'] ?? '';
        $firstName = trim($body['first_name'] ?? '');
        $lastName = trim($body['last_name'] ?? '');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            error_response('Email invalide', 400);
        }
        if (strlen($password) < 8) {
            error_response('Le mot de passe doit contenir au moins 8 caractères', 400);
        }

        // Refuser si customer déjà existant
        if (CustomerModel::findByEmail($email)) {
            error_response('Cet email est déjà utilisé', 409);
        }

        $id = CustomerModel::create([
            'email' => $email,
            'password' => $password,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'phone' => trim($body['phone'] ?? '') ?: null,
            'company' => trim($body['company'] ?? '') ?: null,
            'vat_number' => trim($body['vat_number'] ?? '') ?: null,
            'is_pro' => !empty($body['is_pro']),
            'accepts_marketing' => !empty($body['accepts_marketing']),
        ]);

        $customer = CustomerModel::findById($id);
        $token = encode_customer_token($customer);

        json_response([
            'token' => $token,
            'customer' => $customer,
            'message' => 'Compte créé avec succès',
        ], 201);
    }

    // ── Connexion ───────────────────────────────────────────────────────────
    public static function login(): void {
        require_ecommerce_enabled();
        check_rate_limit('customer_login', 5, 300); // 5 / 5min / IP

        $body = get_json_body();
        $email = trim(strtolower($body['email'] ?? ''));
        $password = $body['password'] ?? '';

        if (empty($email) || empty($password)) {
            error_response('Email et mot de passe requis', 400);
        }

        $customer = CustomerModel::findByEmail($email);
        if (!$customer || !CustomerModel::verifyPassword($password, $customer['password_hash'])) {
            error_response('Identifiants invalides', 401);
        }

        if (!empty($customer['anonymized_at'])) {
            // Compte anonymisé → ne doit plus jamais se connecter
            error_response('Identifiants invalides', 401);
        }

        CustomerModel::touchActivity((int) $customer['id']);
        $customer = CustomerModel::findById((int) $customer['id']); // refresh sans password_hash
        $token = encode_customer_token($customer);

        json_response([
            'token' => $token,
            'customer' => $customer,
            'message' => 'Connecté',
        ]);
    }

    // ── Profil courant ──────────────────────────────────────────────────────
    public static function me(): void {
        require_ecommerce_enabled();
        $auth = authenticate_customer();
        $customer = CustomerModel::findById($auth['id']);
        if (!$customer) {
            error_response('Client introuvable', 404);
        }
        json_response($customer);
    }

    // ── Mise à jour du profil ───────────────────────────────────────────────
    public static function updateProfile(): void {
        require_ecommerce_enabled();
        $auth = authenticate_customer();
        $body = get_json_body();

        $data = array_intersect_key($body, array_flip([
            'first_name', 'last_name', 'phone', 'company', 'vat_number',
            'is_pro', 'accepts_marketing', 'locale'
        ]));
        CustomerModel::updateProfile($auth['id'], $data);

        // Changement de mot de passe : exige le mot de passe actuel
        if (!empty($body['new_password'])) {
            if (empty($body['current_password'])) {
                error_response('Mot de passe actuel requis pour changer le mot de passe', 400);
            }
            if (strlen($body['new_password']) < 8) {
                error_response('Le nouveau mot de passe doit contenir au moins 8 caractères', 400);
            }
            $full = CustomerModel::findById($auth['id'], true);
            if (!$full || !CustomerModel::verifyPassword($body['current_password'], $full['password_hash'])) {
                error_response('Mot de passe actuel incorrect', 400);
            }
            CustomerModel::updatePassword($auth['id'], $body['new_password']);

            // Mail de confirmation (anti-fraude)
            self::sendPasswordChangedEmail($full['email'], $full['first_name'] ?? '');
        }

        $customer = CustomerModel::findById($auth['id']);
        json_response(['customer' => $customer, 'message' => 'Profil mis à jour']);
    }

    // ── Mot de passe oublié ─────────────────────────────────────────────────
    public static function forgotPassword(): void {
        require_ecommerce_enabled();

        $body = get_json_body();
        $email = trim(strtolower($body['email'] ?? ''));

        // Rate limits combinés : 3/h/email + 10/h/IP
        check_rate_limit('customer_forgot_' . md5($email), 3, 3600);
        check_rate_limit('customer_forgot_ip', 10, 3600);

        // TOUJOURS retourner 200 pour éviter l'énumération d'emails
        $genericMessage = ['message' => 'Si un compte existe avec cet email, un lien de réinitialisation vient d\'être envoyé.'];

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            json_response($genericMessage);
            return;
        }

        $customer = CustomerModel::findByEmail($email);
        if (!$customer || !empty($customer['anonymized_at'])) {
            json_response($genericMessage);
            return;
        }

        $token = CustomerModel::createPasswordResetToken((int) $customer['id']);
        self::sendPasswordResetEmail($email, $customer['first_name'] ?? '', $token);

        json_response($genericMessage);
    }

    // ── Réinitialisation via token ──────────────────────────────────────────
    public static function resetPassword(): void {
        require_ecommerce_enabled();
        check_rate_limit('customer_reset', 10, 3600);

        $body = get_json_body();
        $token = $body['token'] ?? '';
        $password = $body['password'] ?? '';

        if (empty($token) || !preg_match('/^[a-f0-9]{64}$/', $token)) {
            error_response('Lien invalide ou expiré', 400);
        }
        if (strlen($password) < 8) {
            error_response('Le mot de passe doit contenir au moins 8 caractères', 400);
        }

        $reset = CustomerModel::findValidPasswordReset($token);
        if (!$reset) {
            error_response('Lien expiré ou déjà utilisé. Demandez-en un nouveau.', 400);
        }

        CustomerModel::updatePassword((int) $reset['customer_id'], $password);
        CustomerModel::markResetUsed($token);

        // Mail de confirmation (anti-fraude)
        self::sendPasswordChangedEmail($reset['email'], $reset['first_name'] ?? '');

        json_response(['message' => 'Mot de passe mis à jour avec succès. Vous pouvez maintenant vous connecter.']);
    }

    // ── Logout (stateless — invalide côté client) ───────────────────────────
    public static function logout(): void {
        require_ecommerce_enabled();
        // JWT stateless : le front supprime le token localement.
        // On pourrait blacklister le jti (v2) si besoin.
        json_response(['message' => 'Déconnecté']);
    }

    // ── CRUD adresses ───────────────────────────────────────────────────────
    public static function listAddresses(): void {
        require_ecommerce_enabled();
        $auth = authenticate_customer();
        json_response(CustomerAddressModel::findByCustomer($auth['id']));
    }

    public static function createAddress(): void {
        require_ecommerce_enabled();
        $auth = authenticate_customer();
        $id = CustomerAddressModel::create($auth['id'], get_json_body());
        json_response(['id' => $id, 'message' => 'Adresse créée'], 201);
    }

    public static function updateAddress(int $id): void {
        require_ecommerce_enabled();
        $auth = authenticate_customer();
        CustomerAddressModel::update($id, $auth['id'], get_json_body());
        json_response(['message' => 'Adresse mise à jour']);
    }

    public static function deleteAddress(int $id): void {
        require_ecommerce_enabled();
        $auth = authenticate_customer();
        CustomerAddressModel::delete($id, $auth['id']);
        json_response(['message' => 'Adresse supprimée']);
    }

    // ── Helpers emails (Resend) ─────────────────────────────────────────────
    private static function sendPasswordResetEmail(string $email, string $firstName, string $token): void {
        $frontend = rtrim($_ENV['FRONTEND_URL'] ?? 'http://localhost:4321', '/');
        $resetUrl = "{$frontend}/compte/reset-password/{$token}";
        $name = htmlspecialchars($firstName ?: 'Bonjour');

        $html = "
            <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px'>
                <p>Bonjour {$name},</p>
                <p>Vous avez demandé la réinitialisation de votre mot de passe sur notre boutique.</p>
                <p><a href='{$resetUrl}' style='display:inline-block;padding:12px 24px;background:#0f62fe;color:white;text-decoration:none;border-radius:6px;font-weight:600'>Réinitialiser mon mot de passe</a></p>
                <p style='color:#666;font-size:14px'>Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez simplement ce message.</p>
                <p style='color:#999;font-size:12px;margin-top:40px'>Ne partagez jamais ce lien avec personne.</p>
            </div>
        ";
        self::sendResendEmail($email, 'Réinitialisation de votre mot de passe', $html);
    }

    private static function sendPasswordChangedEmail(string $email, string $firstName): void {
        $name = htmlspecialchars($firstName ?: 'Bonjour');
        $frontend = rtrim($_ENV['FRONTEND_URL'] ?? '', '/');
        $loginUrl = $frontend . '/compte/connexion';

        $html = "
            <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px'>
                <p>Bonjour {$name},</p>
                <p>Le mot de passe de votre compte vient d'être modifié.</p>
                <p>Si vous êtes bien à l'origine de cette modification, aucune action n'est nécessaire.</p>
                <p><strong>Si vous n'avez pas effectué ce changement, contactez-nous immédiatement</strong> et réinitialisez votre mot de passe depuis <a href='{$loginUrl}'>la page de connexion</a>.</p>
            </div>
        ";
        self::sendResendEmail($email, 'Votre mot de passe a été modifié', $html);
    }

    private static function sendResendEmail(string $to, string $subject, string $html): void {
        $apiKey = $_ENV['RESEND_API_KEY'] ?? '';
        if (empty($apiKey)) {
            error_log("Resend API key missing — email not sent ({$subject} to {$to})");
            return;
        }
        $from = $_ENV['ECOMMERCE_EMAILS_FROM'] ?? $_ENV['RESEND_FROM_EMAIL'] ?? 'onboarding@resend.dev';

        $ch = curl_init('https://api.resend.com/emails');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey,
            ],
            CURLOPT_POSTFIELDS => json_encode([
                'from' => $from,
                'to' => [$to],
                'subject' => $subject,
                'html' => $html,
            ]),
        ]);
        curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code >= 400) {
            error_log("Resend email failed ({$code}) — {$subject} to {$to}");
        }
    }
}
