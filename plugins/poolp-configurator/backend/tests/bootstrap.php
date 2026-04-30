<?php
/**
 * Bootstrap pour PHPUnit — charge l'autoloader Composer du monorepo,
 * les .env, le helper DB, puis le service à tester.
 *
 * Usage : depuis poolp-configurator/, lancer :
 *   ../../astro/backend-php/vendor/bin/phpunit --bootstrap backend/tests/bootstrap.php backend/tests
 *
 * Si Database n'est pas requis (tests purs), une stub Database est injectée
 * pour éviter une connexion MySQL inutile.
 */

// Localise le monorepo backend-php (source de vérité pour vendor/autoload + helpers)
$candidates = [
    __DIR__ . '/../../../astro/backend-php',
    __DIR__ . '/../../../../astro/backend-php',
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

require_once $backendDir . '/vendor/autoload.php';

if (file_exists($backendDir . '/.env')) {
    (Dotenv\Dotenv::createImmutable($backendDir))->safeLoad();
}

// Tente de charger Database (les tests pure-logic n'en auront pas besoin)
if (file_exists($backendDir . '/config/database.php')) {
    require_once $backendDir . '/config/database.php';
}

// Charge le service plugin
require_once __DIR__ . '/../PoolpComputeService.php';
