<?php

use Firebase\JWT\JWT;

class AuthController {
    public static function login(): void {
        $body = get_json_body();
        $email = $body['email'] ?? '';
        $password = $body['password'] ?? '';

        if (empty($email) || empty($password)) {
            error_response('Email and password are required', 400);
        }

        $user = UserModel::findByEmail($email);
        if (!$user) {
            error_response('Invalid email or password', 401);
        }

        if (!UserModel::verifyPassword($password, $user['password'])) {
            error_response('Invalid email or password', 401);
        }

        $token = JWT::encode(
            [
                'id' => $user['id'],
                'email' => $user['email'],
                'role' => $user['role'],
                'exp' => time() + (7 * 24 * 60 * 60), // 7 days
            ],
            $_ENV['JWT_SECRET'],
            'HS256'
        );

        json_response([
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
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
}
