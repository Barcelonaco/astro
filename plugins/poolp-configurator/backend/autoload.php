<?php
/**
 * Plugin POOLP — autoload.php
 *
 * Loaded by the monorepo's index.php and migrate.php for every active plugin
 * (cf. helpers/plugin-hooks.php). Responsibilities:
 *
 * 1. require_once the plugin's PHP classes
 * 2. register the migration callback (run by migrate.php)
 * 3. register the route handler (run by index.php as a 404 fallback)
 */

require_once __DIR__ . '/PoolpComputeService.php';
require_once __DIR__ . '/PoolpMigrationController.php';
require_once __DIR__ . '/PoolpConfiguratorController.php';

// ── Migration ──────────────────────────────────────────────────────────────
register_plugin_migration('poolp-configurator', function (callable $log): int {
    return PoolpMigrationController::migrate($log);
});

// ── Routes ─────────────────────────────────────────────────────────────────
register_plugin_route('poolp-configurator', function (string $method, string $path): bool {
    // Public endpoints
    if ($method === 'GET' && $path === '/poolp/bootstrap') {
        PoolpConfiguratorController::bootstrap();
        return true;
    }
    if ($method === 'POST' && $path === '/poolp/compute') {
        PoolpConfiguratorController::compute();
        return true;
    }
    if ($method === 'GET' && preg_match('#^/poolp/delivery-zones/(\d{5})$#', $path, $m)) {
        PoolpConfiguratorController::deliveryZone($m[1]);
        return true;
    }

    // Projects (public — token-gated)
    if ($method === 'POST' && $path === '/poolp/projects') {
        PoolpConfiguratorController::createProject();
        return true;
    }
    if ($method === 'GET' && preg_match('#^/poolp/projects/([a-f0-9]{32,64})$#', $path, $m)) {
        PoolpConfiguratorController::getProject($m[1]);
        return true;
    }
    if ($method === 'PUT' && preg_match('#^/poolp/projects/([a-f0-9]{32,64})$#', $path, $m)) {
        PoolpConfiguratorController::updateProject($m[1]);
        return true;
    }
    if ($method === 'POST' && preg_match('#^/poolp/projects/([a-f0-9]{32,64})/qualify$#', $path, $m)) {
        PoolpConfiguratorController::qualifyProject($m[1]);
        return true;
    }
    if ($method === 'POST' && preg_match('#^/poolp/projects/([a-f0-9]{32,64})/pdf$#', $path, $m)) {
        PoolpConfiguratorController::exportPdf($m[1]);
        return true;
    }
    if ($method === 'POST' && preg_match('#^/poolp/projects/([a-f0-9]{32,64})/cart$#', $path, $m)) {
        PoolpConfiguratorController::addToCart($m[1]);
        return true;
    }

    // Admin (auth editor+)
    if ($method === 'GET' && $path === '/poolp/admin/zones') {
        $u = authenticate_token(); require_min_role($u, 'editor');
        PoolpConfiguratorController::adminListZones();
        return true;
    }
    if ($method === 'POST' && $path === '/poolp/admin/zones') {
        $u = authenticate_token(); require_min_role($u, 'editor');
        PoolpConfiguratorController::adminCreateZone();
        return true;
    }
    if ($method === 'PUT' && preg_match('#^/poolp/admin/zones/(\d+)$#', $path, $m)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        PoolpConfiguratorController::adminUpdateZone((int)$m[1]);
        return true;
    }
    if ($method === 'DELETE' && preg_match('#^/poolp/admin/zones/(\d+)$#', $path, $m)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        PoolpConfiguratorController::adminDeleteZone((int)$m[1]);
        return true;
    }
    if ($method === 'GET' && $path === '/poolp/admin/projects') {
        $u = authenticate_token(); require_min_role($u, 'editor');
        PoolpConfiguratorController::adminListProjects();
        return true;
    }
    if ($method === 'GET' && preg_match('#^/poolp/admin/projects/(\d+)$#', $path, $m)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        PoolpConfiguratorController::adminGetProject((int)$m[1]);
        return true;
    }
    if ($method === 'DELETE' && preg_match('#^/poolp/admin/projects/(\d+)$#', $path, $m)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        PoolpConfiguratorController::adminDeleteProject((int)$m[1]);
        return true;
    }

    return false;
});
