<?php

/**
 * AES-256-CBC encryption/decryption for sensitive values (API keys).
 * Requires AI_ENCRYPTION_KEY env var (64-char hex = 32 bytes).
 */

function encrypt_value(string $plaintext): string {
    $key = $_ENV['AI_ENCRYPTION_KEY'] ?? '';
    if (empty($key)) throw new RuntimeException('AI_ENCRYPTION_KEY not set in .env');
    $iv = openssl_random_pseudo_bytes(16);
    $encrypted = openssl_encrypt($plaintext, 'aes-256-cbc', hex2bin($key), 0, $iv);
    return base64_encode($iv . '::' . $encrypted);
}

function decrypt_value(string $ciphertext): string {
    $key = $_ENV['AI_ENCRYPTION_KEY'] ?? '';
    if (empty($key)) throw new RuntimeException('AI_ENCRYPTION_KEY not set in .env');
    $parts = explode('::', base64_decode($ciphertext), 2);
    if (count($parts) !== 2) throw new RuntimeException('Invalid encrypted value');
    return openssl_decrypt($parts[1], 'aes-256-cbc', hex2bin($key), 0, $parts[0]);
}
