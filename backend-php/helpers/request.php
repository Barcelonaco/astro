<?php

function get_json_body(): array {
    $raw = file_get_contents('php://input');
    if (empty($raw)) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function get_bearer_token(): ?string {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(\S+)/', $header, $matches)) {
        return $matches[1];
    }
    return null;
}

function get_query_param(string $key, $default = null) {
    return $_GET[$key] ?? $default;
}
