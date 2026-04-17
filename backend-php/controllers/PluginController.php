<?php

class PluginController {
    /**
     * Return the list of active plugin directories from settings.
     * If the setting doesn't exist yet, ALL plugins are considered active (backward-compatible).
     */
    private static function getActiveList(): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'active_plugins'");
        $stmt->execute();
        $row = $stmt->fetch();
        if (!$row) return ['references', 'actualites', 'evenements']; // default active plugins
        $decoded = json_decode($row['setting_value'], true);
        return is_array($decoded) ? $decoded : null;
    }

    public static function getPluginManifests(bool $activeOnly = false): array {
        $pluginsDir = __DIR__ . '/../../plugins';
        if (!is_dir($pluginsDir)) return [];

        $activeList = $activeOnly ? self::getActiveList() : null;

        $manifests = [];
        foreach (scandir($pluginsDir) as $entry) {
            if ($entry === '.' || $entry === '..') continue;
            $dir = $pluginsDir . '/' . $entry;
            if (!is_dir($dir)) continue;

            $manifestPath = $dir . '/plugin.json';
            if (!file_exists($manifestPath)) continue;

            $json = file_get_contents($manifestPath);
            $manifest = json_decode($json, true);
            if (!$manifest) continue;

            $manifest['_dir'] = $entry;

            // Determine active status
            if ($activeList !== null) {
                $manifest['_active'] = in_array($entry, $activeList, true);
            } else {
                $manifest['_active'] = true; // no activeList filter → show all in admin
            }

            if ($activeOnly && !$manifest['_active']) continue;

            $manifests[] = $manifest;
        }
        return $manifests;
    }

    /**
     * GET /plugins — returns all plugins with their active status (admin)
     */
    public static function getPlugins(): void {
        json_response(['plugins' => self::getPluginManifests(false)]);
    }

    /**
     * GET /plugins/active — returns only active plugins (used by frontend/page builder)
     */
    public static function getActivePlugins(): void {
        json_response(['plugins' => self::getPluginManifests(true)]);
    }

    /**
     * PUT /plugins/:dir/toggle — activate or deactivate a plugin
     * Body: { "active": true|false }
     */
    public static function togglePlugin(string $pluginDir): void {
        // Validate plugin directory name (prevent path traversal)
        if (!preg_match('/^[a-z0-9_-]+$/i', $pluginDir)) {
            error_response('Invalid plugin name', 400);
        }

        // Verify the plugin directory exists
        $pluginsDir = __DIR__ . '/../../plugins';
        $manifestPath = $pluginsDir . '/' . $pluginDir . '/plugin.json';
        if (!file_exists($manifestPath)) {
            error_response('Plugin not found', 404);
        }

        $body = get_json_body();
        $active = $body['active'] ?? null;
        if ($active === null) {
            error_response('Missing "active" field (true or false)', 400);
        }

        $db = Database::getInstance();

        // Get current list
        $currentList = self::getActiveList();
        // getActiveList() always returns an array (defaults to references, actualites, evenements)

        if ($active) {
            if (!in_array($pluginDir, $currentList, true)) {
                $currentList[] = $pluginDir;
            }
        } else {
            $currentList = array_values(array_filter($currentList, fn($d) => $d !== $pluginDir));
        }

        $json = json_encode($currentList, JSON_UNESCAPED_UNICODE);
        $stmt = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('active_plugins', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
        $stmt->execute([$json]);

        // Invalidate bootstrap cache
        @unlink(__DIR__ . '/../uploads/.bootstrap_cache.json');

        json_response(['active' => (bool) $active, 'active_plugins' => $currentList]);
    }
}
