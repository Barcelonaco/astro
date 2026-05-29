<?php

/**
 * Customer auth controller — inscription, connexion, reset password, profil, adresses.
 * Toutes les routes exigent le feature flag ecommerce_enabled via require_ecommerce_enabled().
 * Les secrets sont rate-limités pour prévenir bruteforce + enumeration.
 */
class CustomerAuthController
{

    // ── Inscription ─────────────────────────────────────────────────────────
    public static function register(): void
    {
        require_ecommerce_enabled();

        $body = get_json_body();
        verify_recaptcha($body['_recaptcha_token'] ?? null);
        $email = trim(strtolower($body['email'] ?? ''));
        $password = $body['password'] ?? '';
        $firstName = trim($body['first_name'] ?? '');
        $lastName = trim($body['last_name'] ?? '');
        $isProRequest = !empty($body['is_pro']);

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            error_response('Email invalide', 400);
        }
        if (strlen($password) < 8) {
            error_response('Le mot de passe doit contenir au moins 8 caractères', 400);
        }

        // Validation pro : SIRET + activité requis. SIRET = 14 chiffres après
        // strip espaces. Activité bornée à la liste front (cf. /inscription-pro).
        $siret = preg_replace('/\s+/', '', (string) ($body['siret'] ?? '')) ?: null;
        $activity = trim((string) ($body['activity'] ?? '')) ?: null;
        $allowedActivities = ['pisciniste', 'paysagiste', 'batiment', 'thermique', 'distributeur', 'autre'];
        if ($isProRequest) {
            if (!$siret || !preg_match('/^\d{14}$/', $siret)) {
                error_response('Numéro SIRET invalide (14 chiffres requis)', 400);
            }
            if (!$activity || !in_array($activity, $allowedActivities, true)) {
                error_response('Activité invalide', 400);
            }
        }

        // Refuser si customer déjà existant
        if (CustomerModel::findByEmail($email)) {
            error_response('Cet email est déjà utilisé', 409);
        }

        // Gate : is_pro=true demandé → pro_status='pending', is_pro reste 0
        // jusqu'à validation manuelle admin (CustomerModel applique la règle).
        $id = CustomerModel::create([
            'email' => $email,
            'password' => $password,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'phone' => trim($body['phone'] ?? '') ?: null,
            'company' => trim($body['company'] ?? '') ?: null,
            'vat_number' => trim($body['vat_number'] ?? '') ?: null,
            'siret' => $siret,
            'activity' => $activity,
            'pro_status' => $isProRequest ? 'pending' : 'none',
            'accepts_marketing' => !empty($body['accepts_marketing']),
        ]);

        $customer = CustomerModel::findById($id);
        $token = encode_customer_token($customer);

        // Rattache les commandes guest passees avec le meme email
        self::claimGuestOrders((int) $id, $email);

        // Email de bienvenue
        self::sendWelcomeEmail($email, $firstName, $isProRequest);

        // Notification admin pour inscription pro
        if ($isProRequest) {
            self::sendProRegistrationAdminNotif($email, $firstName, $lastName, $siret, $activity, trim($body['company'] ?? ''));
        }

        json_response([
            'token' => $token,
            'customer' => $customer,
            'message' => 'Compte créé avec succès',
        ], 201);
    }

    // ── Connexion ───────────────────────────────────────────────────────────
    public static function login(): void
    {
        require_ecommerce_enabled();
        check_rate_limit('customer_login', 5, 300); // 5 / 5min / IP

        $body = get_json_body();
        verify_recaptcha($body['_recaptcha_token'] ?? null);
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

        // Rattache les commandes guest passees avec le meme email (a chaque login)
        self::claimGuestOrders((int) $customer['id'], $email);

        $customer = CustomerModel::findById((int) $customer['id']); // refresh sans password_hash
        $token = encode_customer_token($customer);

        json_response([
            'token' => $token,
            'customer' => $customer,
            'message' => 'Connecté',
        ]);
    }

    // ── Profil courant ──────────────────────────────────────────────────────
    public static function me(): void
    {
        require_ecommerce_enabled();
        $auth = authenticate_customer();
        $customer = CustomerModel::findById($auth['id']);
        if (!$customer) {
            error_response('Client introuvable', 404);
        }
        json_response($customer);
    }

    // ── Mise à jour du profil ───────────────────────────────────────────────
    public static function updateProfile(): void
    {
        require_ecommerce_enabled();
        $auth = authenticate_customer();
        $body = get_json_body();

        // is_pro retiré : self-promotion impossible. pro_status réservé à l'admin
        // (un futur AdminCustomerController appellera CustomerModel::updateProfile).
        $data = array_intersect_key($body, array_flip([
            'first_name',
            'last_name',
            'phone',
            'company',
            'vat_number',
            'siret',
            'activity',
            'accepts_marketing',
            'locale'
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
    public static function forgotPassword(): void
    {
        require_ecommerce_enabled();

        $body = get_json_body();
        verify_recaptcha($body['_recaptcha_token'] ?? null);
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
    public static function resetPassword(): void
    {
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
    public static function logout(): void
    {
        require_ecommerce_enabled();
        // JWT stateless : le front supprime le token localement.
        // On pourrait blacklister le jti (v2) si besoin.
        json_response(['message' => 'Déconnecté']);
    }

    // ── Suppression compte (RGPD) ───────────────────────────────────────────

    /**
     * DELETE /customer/auth/account — suppression du compte client.
     * Anonymise les donnees personnelles, conserve les commandes pour obligations legales.
     */
    public static function deleteAccount(): void
    {
        require_ecommerce_enabled();
        $auth = authenticate_customer();
        $body = get_json_body();

        // Require password confirmation for security
        $password = $body['password'] ?? '';
        if (empty($password)) {
            error_response('Mot de passe requis pour confirmer la suppression', 400);
        }

        $customer = CustomerModel::findById((int) $auth['id'], true);
        if (!$customer || !CustomerModel::verifyPassword($password, $customer['password_hash'] ?? '')) {
            error_response('Mot de passe incorrect', 403);
        }

        // Anonymize instead of hard-delete (legal obligation: keep order history)
        $db = Database::getInstance();
        $anonEmail = 'anonymized_' . $auth['id'] . '@deleted.local';
        $db->prepare("UPDATE customers SET
            email = ?,
            password_hash = '',
            first_name = 'Compte',
            last_name = 'Supprime',
            phone = NULL,
            company = NULL,
            vat_number = NULL,
            siret = NULL,
            activity = NULL,
            anonymized_at = NOW(),
            anonymization_reason = 'user_request'
            WHERE id = ?")
            ->execute([$anonEmail, $auth['id']]);

        // Delete addresses
        $db->prepare('DELETE FROM customer_addresses WHERE customer_id = ?')->execute([$auth['id']]);

        // Log erasure
        $emailHash = hash('sha256', $customer['email'] ?? '');
        $erasedFields = json_encode(['email', 'password_hash', 'phone', 'company', 'vat_number', 'siret', 'activity']);
        $db->prepare("INSERT INTO gdpr_erasure_log (customer_id, customer_email_hash, reason, requested_by_type, requested_by_id, performed_at, fields_erased, notes) VALUES (?, ?, 'user_request', 'customer', ?, NOW(), ?, ?)")
            ->execute([$auth['id'], $emailHash, $auth['id'], $erasedFields, json_encode(['method' => 'self_service', 'ip' => $_SERVER['REMOTE_ADDR'] ?? null])]);

        json_response(['message' => 'Compte supprime. Vos donnees personnelles ont ete anonymisees.']);
    }

    /**
     * POST /customer/auth/erasure-request — demande de suppression RGPD (file d'attente admin).
     */
    public static function requestErasure(): void
    {
        require_ecommerce_enabled();
        $auth = authenticate_customer();
        $body = get_json_body();

        $db = Database::getInstance();

        // Check if a pending request already exists
        $stmt = $db->prepare("SELECT id FROM gdpr_erasure_requests WHERE customer_id = ? AND status = 'pending'");
        $stmt->execute([$auth['id']]);
        if ($stmt->fetch()) {
            error_response('Une demande de suppression est deja en cours', 409);
        }

        $db->prepare("INSERT INTO gdpr_erasure_requests (customer_id, reason, requested_at, status) VALUES (?, ?, NOW(), 'pending')")
            ->execute([$auth['id'], trim((string) ($body['reason'] ?? ''))]);

        json_response(['message' => 'Demande de suppression enregistree. Elle sera traitee sous 30 jours.'], 201);
    }

    // ── CRUD adresses ───────────────────────────────────────────────────────
    public static function listAddresses(): void
    {
        require_ecommerce_enabled();
        $auth = authenticate_customer();
        json_response(CustomerAddressModel::findByCustomer($auth['id']));
    }

    public static function createAddress(): void
    {
        require_ecommerce_enabled();
        $auth = authenticate_customer();
        $id = CustomerAddressModel::create($auth['id'], get_json_body());
        json_response(['id' => $id, 'message' => 'Adresse créée'], 201);
    }

    public static function updateAddress(int $id): void
    {
        require_ecommerce_enabled();
        $auth = authenticate_customer();
        CustomerAddressModel::update($id, $auth['id'], get_json_body());
        json_response(['message' => 'Adresse mise à jour']);
    }

    public static function deleteAddress(int $id): void
    {
        require_ecommerce_enabled();
        $auth = authenticate_customer();
        CustomerAddressModel::delete($id, $auth['id']);
        json_response(['message' => 'Adresse supprimée']);
    }

    // ── Helpers emails (Resend) ─────────────────────────────────────────────
    private static function sendPasswordResetEmail(string $email, string $firstName, string $token): void
    {
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

    private static function sendPasswordChangedEmail(string $email, string $firstName): void
    {
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

    public static function sendResendEmail(string $to, string $subject, string $html): void
    {
        $apiKey = $_ENV['RESEND_API_KEY'] ?? '';
        if (empty($apiKey)) {
            error_log("Resend API key missing — email not sent ({$subject} to {$to})");
            return;
        }
        $from = $_ENV['ECOMMERCE_EMAILS_FROM'] ?? $_ENV['RESEND_FROM_EMAIL'] ?? 'onboarding@resend.dev';
        try {
            $stmt = Database::getInstance()->prepare("SELECT setting_value FROM settings WHERE setting_key = 'ecommerce_emails_from'");
            $stmt->execute();
            $row = $stmt->fetch();
            if ($row && !empty($row['setting_value'])) $from = $row['setting_value'];
        } catch (\Throwable $e) {}

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
        $response = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        // If domain not verified (403), retry with env fallback
        if ($code === 403) {
            $envFrom = $_ENV['RESEND_FROM_EMAIL'] ?? '';
            if ($envFrom && $envFrom !== $from) {
                error_log("Resend 403 with '{$from}', retrying with env '{$envFrom}'");
                $ch2 = curl_init('https://api.resend.com/emails');
                curl_setopt_array($ch2, [
                    CURLOPT_POST => true,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 10,
                    CURLOPT_HTTPHEADER => [
                        'Content-Type: application/json',
                        'Authorization: Bearer ' . $apiKey,
                    ],
                    CURLOPT_POSTFIELDS => json_encode([
                        'from' => $envFrom,
                        'to' => [$to],
                        'subject' => $subject,
                        'html' => $html,
                    ]),
                ]);
                $response = curl_exec($ch2);
                $code = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
                curl_close($ch2);
            }
        }

        if ($code >= 400) {
            error_log("Resend email failed ({$code}) — {$subject} to {$to}");
        }
    }

    // ── Rattachement commandes guest ───────────────────────────────────────

    /**
     * Rattache les commandes passees en guest (customer_id = NULL) au compte
     * Notification admin : nouveau compte pro en attente de validation.
     */
    private static function sendProRegistrationAdminNotif(string $email, string $firstName, string $lastName, ?string $siret, ?string $activity, string $company): void {
        $adminUrl = rtrim($_ENV['ADMIN_URL'] ?? $_ENV['FRONTEND_URL'] ?? '', '/') . '/admin#clients';
        $name = htmlspecialchars(trim("$firstName $lastName") ?: $email);
        $html = "
            <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px'>
                <h2 style='color:#222;margin:0 0 16px'>Nouvelle demande de compte professionnel</h2>
                <p>Un nouveau client a demandé un compte professionnel :</p>
                <table style='border-collapse:collapse;width:100%;font-size:14px;margin:16px 0'>
                    <tr><td style='padding:6px 10px;border:1px solid #ddd;font-weight:600'>Nom</td><td style='padding:6px 10px;border:1px solid #ddd'>{$name}</td></tr>
                    <tr><td style='padding:6px 10px;border:1px solid #ddd;font-weight:600'>Email</td><td style='padding:6px 10px;border:1px solid #ddd'>" . htmlspecialchars($email) . "</td></tr>
                    <tr><td style='padding:6px 10px;border:1px solid #ddd;font-weight:600'>Entreprise</td><td style='padding:6px 10px;border:1px solid #ddd'>" . htmlspecialchars($company ?: '-') . "</td></tr>
                    <tr><td style='padding:6px 10px;border:1px solid #ddd;font-weight:600'>SIRET</td><td style='padding:6px 10px;border:1px solid #ddd'>" . htmlspecialchars($siret ?: '-') . "</td></tr>
                    <tr><td style='padding:6px 10px;border:1px solid #ddd;font-weight:600'>Activité</td><td style='padding:6px 10px;border:1px solid #ddd'>" . htmlspecialchars($activity ?: '-') . "</td></tr>
                </table>
                <p style='margin-top:20px'>
                    <a href='{$adminUrl}' style='display:inline-block;padding:12px 24px;background:#222;color:#fff;text-decoration:none;border-radius:6px;font-weight:600'>Vérifier et approuver</a>
                </p>
            </div>
        ";

        // Send to admin recipients
        $recipients = [];
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'ecommerce_notif_recipients'");
            $stmt->execute();
            $row = $stmt->fetch();
            if ($row && !empty($row['setting_value'])) {
                foreach (explode(',', $row['setting_value']) as $e) {
                    $e = trim($e);
                    if ($e !== '') $recipients[] = $e;
                }
            }
            $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'shop_email'");
            $stmt->execute();
            $row = $stmt->fetch();
            if ($row && !empty($row['setting_value'])) $recipients[] = $row['setting_value'];
        } catch (\Throwable $e) {}
        $recipients = array_values(array_unique($recipients));

        foreach ($recipients as $to) {
            self::sendResendEmail($to, 'Nouvelle demande de compte pro — ' . $name, $html);
        }
    }

    /**
     * client si l'email correspond. Executee au register + login.
     */
    private static function claimGuestOrders(int $customerId, string $email): void
    {
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare('UPDATE orders SET customer_id = ? WHERE customer_id IS NULL AND LOWER(email) = ? AND email != ""');
            $count = $stmt->execute([$customerId, strtolower($email)]);
            $affected = $stmt->rowCount();
            if ($affected > 0) {
                $db->prepare('INSERT INTO audit_log (entity_type, entity_id, event_type, payload, actor_type) VALUES ("customer", ?, "guest_orders_claimed", ?, "system")')
                    ->execute([$customerId, json_encode(['email' => $email, 'orders_claimed' => $affected])]);
            }
        } catch (\Throwable $e) {
            error_log('claimGuestOrders failed: ' . $e->getMessage());
        }
    }

    private static function sendWelcomeEmail(string $email, string $firstName, bool $isPro): void
    {
        $name = htmlspecialchars($firstName ?: 'Bonjour');
        $frontend = rtrim($_ENV['FRONTEND_URL'] ?? 'http://localhost:4321', '/');
        $accountUrl = $frontend . '/compte';

        if ($isPro) {
            // Contact email from settings
            $contactEmail = '';
            try {
                $stmtC = Database::getInstance()->prepare("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('email', 'shop_email')");
                $stmtC->execute();
                $emailSettings = [];
                foreach ($stmtC->fetchAll() as $r) $emailSettings[$r['setting_key']] = $r['setting_value'];
                $contactEmail = $emailSettings['email'] ?? $emailSettings['shop_email'] ?? '';
            } catch (\Throwable $e) {}
            $contactLine = $contactEmail
                ? "<p style='margin-top:20px;font-size:14px;color:#555'>Une question ? Contactez-nous a <a href='mailto:{$contactEmail}' style='color:#222;font-weight:600'>{$contactEmail}</a> ou via la page <a href='{$frontend}/contact' style='color:#222;font-weight:600'>Contact</a>.</p>"
                : "<p style='margin-top:20px;font-size:14px;color:#555'>Une question ? Rendez-vous sur notre page <a href='{$frontend}/contact' style='color:#222;font-weight:600'>Contact</a>.</p>";

            $html = "
                <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px'>
                    <h2 style='color:#222;margin:0 0 16px'>Demande de compte professionnel bien recue</h2>
                    <p>Merci pour votre inscription. Votre demande a bien ete enregistree et est en cours de traitement par notre equipe.</p>
                    <p>Votre compte professionnel sera active sous 24 a 48 heures ouvrees, apres verification de vos informations. Vous recevrez un email de confirmation des que votre acces sera ouvert.</p>
                    <p>En attendant, vous pouvez continuer a utiliser le configurateur et parcourir la boutique. Votre panier et vos configurations sont conserves.</p>
                    {$contactLine}
                    <p style='margin-top:24px'>
                        <a href='{$accountUrl}' style='display:inline-block;padding:12px 24px;background:#222;color:#fff;text-decoration:none;border-radius:6px;font-weight:600'>Acceder a mon espace</a>
                    </p>
                    <p style='color:#999;font-size:12px;margin-top:40px'>Si vous n'avez pas cree ce compte, vous pouvez ignorer ce message.</p>
                </div>
            ";
            self::sendResendEmail($email, 'Demande de compte professionnel bien recue', $html);
        } else {
            $html = "
                <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px'>
                    <h2 style='color:#222;margin:0 0 16px'>Bienvenue {$name} !</h2>
                    <p>Votre compte a été créé avec succès sur notre boutique.</p>
                    <p>Depuis votre espace client, vous pouvez :</p>
                    <ul style='color:#555;font-size:14px;line-height:1.8'>
                        <li>Suivre vos commandes</li>
                        <li>Gérer vos adresses de livraison et facturation</li>
                        <li>Modifier vos informations personnelles</li>
                    </ul>
                    <p style='margin-top:24px'>
                        <a href='{$accountUrl}' style='display:inline-block;padding:12px 24px;background:#222;color:#fff;text-decoration:none;border-radius:6px;font-weight:600'>Accéder à mon compte</a>
                    </p>
                    <p style='color:#999;font-size:12px;margin-top:40px'>Si vous n'avez pas créé ce compte, vous pouvez ignorer ce message.</p>
                </div>
            ";
            self::sendResendEmail($email, 'Bienvenue — votre compte a été créé', $html);
        }
    }
}
