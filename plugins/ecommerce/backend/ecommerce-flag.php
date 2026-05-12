<?php

/**
 * E-commerce feature flag.
 *
 * Le module est activé dès que le plugin `ecommerce` est dans
 * `settings.active_plugins`. Plus de toggle séparé en BO — l'activation/
 * désactivation se fait via la page Plugins du back-office.
 *
 * Toutes les routes ecom appellent require_ecommerce_enabled() en début de
 * handler ; sans plugin actif, on renvoie 404 (cache l'existence de la feature).
 */

function ecommerce_enabled(): bool {
    static $cached = null;
    if ($cached !== null) return $cached;
    try {
        $cached = PluginController::isPluginActive('ecommerce');
    } catch (\Throwable $e) {
        $cached = false;
    }
    return $cached;
}

function require_ecommerce_enabled(): void {
    if (!ecommerce_enabled()) {
        error_response('Not found', 404);
    }
}
