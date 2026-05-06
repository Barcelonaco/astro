<?php

/**
 * E-commerce feature flag.
 * All e-commerce endpoints should call require_ecommerce_enabled() at the top.
 * If disabled in settings, returns 404 (hides existence of the feature).
 */

function ecommerce_enabled(): bool {
    static $cached = null;
    if ($cached !== null) return $cached;

    try {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'ecommerce_enabled'");
        $stmt->execute();
        $val = $stmt->fetchColumn();
        $cached = ($val === '1' || $val === 1);
    } catch (\Exception $e) {
        $cached = false;
    }
    return $cached;
}

function require_ecommerce_enabled(): void {
    if (!ecommerce_enabled()) {
        error_response('Not found', 404);
    }
}
