<?php

use Firebase\JWT\JWT;

class AuthController {
    public static function login(): void {
        $body = get_json_body();
        $login = $body['login'] ?? $body['email'] ?? '';
        $password = $body['password'] ?? '';

        if (empty($login) || empty($password)) {
            error_response('Identifiant et mot de passe requis', 400);
        }

        $user = UserModel::findByLogin($login);
        if (!$user) {
            error_response('Identifiant ou mot de passe incorrect', 401);
        }

        if (!UserModel::verifyPassword($password, $user['password'])) {
            error_response('Invalid email or password', 401);
        }

        $token = JWT::encode(
            [
                'id' => $user['id'],
                'name' => $user['name'],
                'username' => $user['username'] ?? null,
                'email' => $user['email'],
                'role' => $user['role'],
                'exp' => time() + 24 * 60 * 60, // 24 hours
            ],
            $_ENV['JWT_SECRET'],
            'HS256'
        );

        json_response([
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'username' => $user['username'] ?? null,
                'email' => $user['email'],
                'role' => $user['role'],
            ]
        ]);
    }

    public static function me(array $authUser): void {
        $user = UserModel::findById($authUser['id']);
        if (!$user) {
            error_response('User not found', 404);
        }
        json_response($user);
    }

    public static function updateProfile(array $authUser): void {
        $body = get_json_body();
        $name = $body['name'] ?? '';
        $email = $body['email'] ?? '';
        $username = $body['username'] ?? '';

        if (empty($name) || empty($email)) {
            error_response('Nom et email sont requis', 400);
        }

        // Check email uniqueness (exclude self)
        $existing = UserModel::findByEmail($email);
        if ($existing && $existing['id'] !== $authUser['id']) {
            error_response('Cet email est déjà utilisé', 400);
        }

        // Check username uniqueness (exclude self)
        if (!empty($username)) {
            $existingUsername = UserModel::findByUsername($username);
            if ($existingUsername && $existingUsername['id'] !== $authUser['id']) {
                error_response('Ce nom d\'utilisateur est déjà pris', 400);
            }
        }

        // Get current user to preserve role
        $currentUser = UserModel::findById($authUser['id']);
        if (!$currentUser) {
            error_response('Utilisateur introuvable', 404);
        }

        $data = [
            'name' => $name,
            'email' => $email,
            'username' => $username,
            'role' => $currentUser['role'], // role cannot be changed via profile
        ];

        // Password change (optional, requires current password)
        if (!empty($body['new_password'])) {
            if (empty($body['current_password'])) {
                error_response('Le mot de passe actuel est requis pour changer le mot de passe', 400);
            }
            // Verify current password
            $fullUser = UserModel::findByEmail($currentUser['email']);
            if (!$fullUser || !UserModel::verifyPassword($body['current_password'], $fullUser['password'])) {
                error_response('Mot de passe actuel incorrect', 400);
            }
            if (strlen($body['new_password']) < 8) {
                error_response('Le nouveau mot de passe doit contenir au moins 8 caractères', 400);
            }
            $data['password'] = $body['new_password'];
        }

        try {
            UserModel::update($authUser['id'], $data);

            // Return updated user + new token
            $updated = UserModel::findById($authUser['id']);
            $token = JWT::encode(
                [
                    'id' => $updated['id'],
                    'name' => $updated['name'],
                    'username' => $updated['username'] ?? null,
                    'email' => $updated['email'],
                    'role' => $updated['role'],
                    'exp' => time() + 7 * 24 * 60 * 60,
                ],
                $_ENV['JWT_SECRET'],
                'HS256'
            );

            json_response([
                'message' => 'Profil mis à jour avec succès',
                'token' => $token,
                'user' => $updated,
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) {
                error_response('Email ou nom d\'utilisateur déjà utilisé', 400);
            }
            throw $e;
        }
    }

    public static function forgotPassword(): void {
        $body = get_json_body();
        $email = $body['email'] ?? '';

        if (empty($email)) {
            error_response('Email is required', 400);
        }

        // Always return success to avoid email enumeration
        $user = UserModel::findByEmail($email);
        if (!$user) {
            json_response(['message' => 'Si cette adresse existe, un email de réinitialisation a été envoyé.']);
            return;
        }

        $token = bin2hex(random_bytes(32));
        $expires = date('Y-m-d H:i:s', strtotime('+1 hour'));
        UserModel::setResetToken($user['id'], $token, $expires);

        // Build reset URL
        $adminUrl = rtrim($_ENV['ADMIN_URL'] ?? 'http://localhost:3000/admin', '/');
        $resetUrl = "{$adminUrl}/reset-password.html?token={$token}";

        // Send email via Resend
        $apiKey = $_ENV['RESEND_API_KEY'] ?? '';
        $fromEmail = $_ENV['RESEND_FROM_EMAIL'] ?? 'onboarding@resend.dev';

        if (!empty($apiKey)) {
            $html = "
                <p>Bonjour {$user['name']},</p>
                <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
                <p><a href='{$resetUrl}' style='display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;text-decoration:none;border-radius:8px;font-weight:600;'>Réinitialiser mon mot de passe</a></p>
                <p>Ce lien expire dans 1 heure.</p>
                <p>Si vous n'avez pas fait cette demande, ignorez cet email.</p>
            ";

            $ch = curl_init('https://api.resend.com/emails');
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $apiKey,
                ],
                CURLOPT_POSTFIELDS => json_encode([
                    'from' => $fromEmail,
                    'to' => [$email],
                    'subject' => 'Réinitialisation de votre mot de passe',
                    'html' => $html,
                ]),
            ]);
            curl_exec($ch);
            curl_close($ch);
        }

        json_response(['message' => 'Si cette adresse existe, un email de réinitialisation a été envoyé.']);
    }

    public static function resetPassword(): void {
        $body = get_json_body();
        $token = $body['token'] ?? '';
        $password = $body['password'] ?? '';

        if (empty($token) || empty($password)) {
            error_response('Token et mot de passe sont requis', 400);
        }

        if (strlen($password) < 8) {
            error_response('Le mot de passe doit contenir au moins 8 caractères', 400);
        }

        $user = UserModel::findByResetToken($token);
        if (!$user) {
            error_response('Lien de réinitialisation invalide', 400);
        }

        if (strtotime($user['reset_token_expires']) < time()) {
            UserModel::clearResetToken($user['id']);
            error_response('Ce lien a expiré. Veuillez refaire une demande.', 400);
        }

        // Update password and clear token
        UserModel::update($user['id'], [
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'password' => $password,
        ]);
        UserModel::clearResetToken($user['id']);

        json_response(['message' => 'Mot de passe mis à jour avec succès.']);
    }
}
