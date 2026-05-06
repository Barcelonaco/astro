<?php

/**
 * JWT customer : auth des clients e-commerce.
 * Séparé strictement de l'auth admin (claim type='customer' OBLIGATOIRE).
 *
 * Clé : CUSTOMER_JWT_SECRET (env) — fallback sur JWT_SECRET si absent.
 * TTL : 30 jours (plus long que admin qui est 24h, car commerce = sessions longues).
 */

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

const CUSTOMER_JWT_TTL = 30 * 24 * 60 * 60; // 30 jours

function customer_jwt_secret(): string {
    $secret = $_ENV['CUSTOMER_JWT_SECRET'] ?? '';
    if (empty($secret)) {
        $secret = $_ENV['JWT_SECRET'] ?? '';
    }
    if (empty($secret)) {
        throw new \RuntimeException('CUSTOMER_JWT_SECRET or JWT_SECRET must be set in .env');
    }
    return $secret;
}

function encode_customer_token(array $customer): string {
    return JWT::encode(
        [
            'type' => 'customer',
            'id' => (int) $customer['id'],
            'email' => $customer['email'],
            'name' => trim(($customer['first_name'] ?? '') . ' ' . ($customer['last_name'] ?? '')),
            'exp' => time() + CUSTOMER_JWT_TTL,
        ],
        customer_jwt_secret(),
        'HS256'
    );
}

/**
 * Authentifie un customer depuis le header Authorization.
 * Rejette les tokens admin (claim type != 'customer').
 */
function authenticate_customer(): array {
    $token = get_bearer_token();
    if (!$token) {
        error_response('Authentification requise', 401);
    }

    try {
        $decoded = JWT::decode($token, new Key(customer_jwt_secret(), 'HS256'));
        $claims = (array) $decoded;
    } catch (\Exception $e) {
        error_response('Token invalide', 401);
        exit;
    }

    // Strict : refuser tout token qui n'est pas explicitement marqué customer
    if (($claims['type'] ?? '') !== 'customer') {
        error_response('Token invalide pour cette ressource', 403);
    }

    return [
        'id' => (int) ($claims['id'] ?? 0),
        'email' => $claims['email'] ?? '',
        'name' => $claims['name'] ?? '',
    ];
}
