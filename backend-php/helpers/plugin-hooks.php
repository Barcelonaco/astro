<?php
/**
 * Tiny plugin-hook registry. Lets plugins (in plugins/ or EXTERNAL_PLUGINS_DIR)
 * declare callbacks that the core dispatches at well-known moments.
 *
 * Currently exposes one hook : "migration" — invoked by migrate.php after the
 * built-in tables are migrated. A plugin's backend/autoload.php registers its
 * migration via register_plugin_migration() and the migrate script picks them
 * all up automatically.
 *
 * Reusable for future plugins (e.g. their own setup, scheduled jobs, etc.) by
 * adding more named registries below. Keep this file dependency-free.
 */

if (!isset($GLOBALS['__plugin_migrations'])) {
    $GLOBALS['__plugin_migrations'] = [];
}
if (!isset($GLOBALS['__plugin_route_handlers'])) {
    $GLOBALS['__plugin_route_handlers'] = [];
}

/**
 * Register a migration callback. The callback receives a log function:
 *   function (string $msg): void
 * and must return the number of changes applied (0 if everything was up to date).
 *
 * @param string $name      Stable identifier (e.g. plugin slug). Used for logging only.
 * @param callable $fn      Signature: function(callable $log): int
 */
function register_plugin_migration(string $name, callable $fn): void {
    $GLOBALS['__plugin_migrations'][$name] = $fn;
}

/**
 * Invoke every registered migration callback in registration order.
 * Called by migrate.php.
 */
function run_plugin_migrations(callable $log): int {
    $total = 0;
    foreach ($GLOBALS['__plugin_migrations'] as $name => $fn) {
        $log("\n  [plugin] {$name}:");
        try {
            $total += (int) $fn($log);
        } catch (\Throwable $e) {
            $log("    ERROR migration {$name} failed: " . $e->getMessage());
        }
    }
    return $total;
}

/**
 * Register a route handler for a plugin. Called as a fallback after core
 * routes have not matched. The handler receives ($method, $path) and must:
 *   - return true if it handled the request (it must also send the response)
 *   - return false if the route doesn't belong to it (other plugins / 404)
 *
 * @param string $name      Plugin slug (logging only)
 * @param callable $fn      Signature: function(string $method, string $path): bool
 */
function register_plugin_route(string $name, callable $fn): void {
    $GLOBALS['__plugin_route_handlers'][$name] = $fn;
}

/**
 * Dispatch a request to plugin route handlers. Returns true if any handler
 * claimed the route (and presumably sent a response). Used by index.php as
 * a final fallback before emitting 404.
 */
function dispatch_plugin_routes(string $method, string $path): bool {
    foreach ($GLOBALS['__plugin_route_handlers'] as $name => $fn) {
        try {
            if ($fn($method, $path) === true) return true;
        } catch (\Throwable $e) {
            error_log("Plugin route handler {$name} failed: " . $e->getMessage());
        }
    }
    return false;
}
