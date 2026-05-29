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

/**
 * Verify reCAPTCHA v3 token. Blocks with 400 if verification fails.
 * Does nothing if reCAPTCHA is not configured (no secret key in settings).
 */
function verify_recaptcha(?string $token): void {
    if (empty($token)) return;
    try {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'recaptcha_secret_key'");
        $stmt->execute();
        $row = $stmt->fetch();
        $secretKey = $row['setting_value'] ?? null;
        if (empty($secretKey)) return; // reCAPTCHA not configured — skip

        $verifyUrl = 'https://www.google.com/recaptcha/api/siteverify?secret=' . urlencode($secretKey) . '&response=' . urlencode($token);
        $verifyRes = @file_get_contents($verifyUrl);
        if ($verifyRes) {
            $verifyData = json_decode($verifyRes, true);
            if (empty($verifyData['success']) || (isset($verifyData['score']) && $verifyData['score'] < 0.3)) {
                error_response('Verification anti-spam echouee. Reessayez.', 400);
            }
        }
    } catch (\Throwable $e) {
        // Don't block if reCAPTCHA verification fails internally
        error_log('reCAPTCHA verification error: ' . $e->getMessage());
    }
}
