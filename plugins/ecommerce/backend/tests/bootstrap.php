<?php
/**
 * Bootstrap PHPUnit — charge les controllers/services ecommerce à tester.
 *
 * PHPUnit (via vendor/bin/phpunit de backend-php) charge automatiquement
 * l'autoloader Composer, qui inclut les helpers (response.php, request.php).
 * Ces helpers appellent exit(), incompatible avec les tests.
 *
 * Stratégie : on pré-bloque les fichiers helpers via $GLOBALS Composer AVANT
 * que l'autoloader ne les charge, en utilisant un auto_prepend trick.
 *
 * Alternative retenue : NE PAS utiliser backend-php/vendor/bin/phpunit.
 * Utiliser un phpunit installé dans le plugin ou via chemin absolu.
 */

// ── Localise backend-php ────────────────────────────────────────────────────

$candidates = [
    __DIR__ . '/../../../../backend-php',
    getenv('BACKEND_PHP_DIR') ?: '',
];
$backendDir = null;
foreach ($candidates as $c) {
    if ($c && is_file($c . '/vendor/autoload.php')) { $backendDir = realpath($c); break; }
}
if (!$backendDir) {
    fwrite(STDERR, "Could not locate backend-php. Set BACKEND_PHP_DIR env var.\n");
    exit(1);
}

// L'autoloader est déjà chargé par PHPUnit lui-même (via vendor/bin/phpunit).
// On charge seulement .env + Database + les controllers ecommerce.

if (file_exists($backendDir . '/.env')) {
    (Dotenv\Dotenv::createImmutable($backendDir))->safeLoad();
}

// Database config
if (file_exists($backendDir . '/config/database.php')) {
    require_once $backendDir . '/config/database.php';
}

// Helpers supplémentaires utilisés par les controllers ecommerce
// (non fournis par l'autoloader)
if (!function_exists('customer_jwt_secret')) {
    function customer_jwt_secret(): string { return 'test-secret'; }
}
if (!function_exists('require_ecommerce_enabled')) {
    function require_ecommerce_enabled(): void { /* noop in tests */ }
}
if (!function_exists('authenticate_customer')) {
    function authenticate_customer(): array { return ['id' => 1]; }
}
if (!function_exists('check_rate_limit')) {
    function check_rate_limit(string $key, int $max, int $windowSec): void { /* noop */ }
}

// Charge les fichiers ecommerce à tester
$pluginDir = __DIR__ . '/../../backend';
$files = [
    'TaxResolver.php',
    'ShippingController.php',
    'ProTierService.php',
    'CartController.php',
    'OrderController.php',
    'InvoiceController.php',
    'CouponsAdminController.php',
];
foreach ($files as $f) {
    if (file_exists($pluginDir . '/' . $f)) {
        require_once $pluginDir . '/' . $f;
    }
}
