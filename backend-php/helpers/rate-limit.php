<?php
/**
 * Simple file-based rate limiter.
 * Limits requests per IP on sensitive endpoints (login, forgot-password, etc.)
 */

function check_rate_limit(string $action, int $maxAttempts = 5, int $windowSeconds = 300): void {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = md5($action . ':' . $ip);

    $cacheDir = __DIR__ . '/../uploads/.rate_limit';
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0755, true);
    }

    $file = $cacheDir . '/' . $key;

    // Clean expired entries
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true);
        if (!$data || ($data['window_start'] ?? 0) < time() - $windowSeconds) {
            $data = ['window_start' => time(), 'attempts' => 0];
        }
    } else {
        $data = ['window_start' => time(), 'attempts' => 0];
    }

    $data['attempts']++;
    file_put_contents($file, json_encode($data), LOCK_EX);

    if ($data['attempts'] > $maxAttempts) {
        $retryAfter = $data['window_start'] + $windowSeconds - time();
        header('Retry-After: ' . max(1, $retryAfter));
        http_response_code(429);
        echo json_encode(['error' => 'Trop de tentatives. Réessayez dans ' . ceil($retryAfter / 60) . ' minute(s).']);
        exit;
    }
}

/**
 * Cleanup old rate limit files (call occasionally).
 */
function cleanup_rate_limit_files(): void {
    $cacheDir = __DIR__ . '/../uploads/.rate_limit';
    if (!is_dir($cacheDir)) return;

    foreach (glob($cacheDir . '/*') as $file) {
        if (filemtime($file) < time() - 3600) {
            @unlink($file);
        }
    }
}
