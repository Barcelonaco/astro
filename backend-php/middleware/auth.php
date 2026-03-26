<?php

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

function authenticate_token(): array {
    $token = get_bearer_token();
    if (!$token) {
        error_response('Access denied. No token provided.', 401);
    }

    try {
        $decoded = JWT::decode($token, new Key($_ENV['JWT_SECRET'], 'HS256'));
        return (array) $decoded;
    } catch (\Exception $e) {
        error_response('Invalid token', 403);
    }
    exit; // unreachable but satisfies static analysis
}

function require_admin(array $user): void {
    if (($user['role'] ?? '') !== 'admin') {
        error_response('Access denied. Admin only.', 403);
    }
}
