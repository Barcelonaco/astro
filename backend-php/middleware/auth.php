<?php

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

function authenticate_token(): array {
    $token = get_bearer_token();
    if (!$token) {
        error_response('Access denied. No token provided.', 401);
    }

    // Check static API key first (per-site, permanent)
    $apiKey = $_ENV['API_KEY'] ?? '';
    if (!empty($apiKey) && hash_equals($apiKey, $token)) {
        return [
            'id' => 0,
            'email' => 'api@site',
            'role' => 'super_admin',
        ];
    }

    // Fall back to JWT (per-user, expires)
    try {
        $decoded = JWT::decode($token, new Key($_ENV['JWT_SECRET'], 'HS256'));
        return (array) $decoded;
    } catch (\Exception $e) {
        error_response('Invalid token', 403);
    }
    exit; // unreachable but satisfies static analysis
}

/**
 * Role hierarchy (higher = more permissions):
 *   super_admin > admin_site > editor > reader
 */
const ROLE_LEVELS = [
    'reader'      => 0,
    'editor'      => 1,
    'admin_site'  => 2,
    'super_admin' => 3,
    // Legacy alias
    'admin'       => 3,
];

function role_level(string $role): int {
    return ROLE_LEVELS[$role] ?? -1;
}

/**
 * Require that the user's role is at least $minRole in the hierarchy.
 */
function require_min_role(array $user, string $minRole): void {
    $userLevel = role_level($user['role'] ?? '');
    $requiredLevel = role_level($minRole);
    if ($userLevel < $requiredLevel) {
        error_response('Access denied. Insufficient permissions.', 403);
    }
}

/** Legacy wrapper — kept so existing calls still compile. */
function require_admin(array $user): void {
    require_min_role($user, 'super_admin');
}
