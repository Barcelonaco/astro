<?php

class PluginController {
    /**
     * Return the list of active plugin directories from settings.
     * If the setting doesn't exist yet, defaults to a known list (backward-compatible).
     */
    public static function getActiveList(): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'active_plugins'");
        $stmt->execute();
        $row = $stmt->fetch();
        if (!$row) return ['references', 'actualites', 'evenements']; // default active plugins
        $decoded = json_decode($row['setting_value'], true);
        return is_array($decoded) ? $decoded : null;
    }

    public static function isPluginActive(string $dir): bool {
        $list = self::getActiveList();
        if ($list === null) return true;
        return in_array($dir, $list, true);
    }

    /**
     * Find the plugin directory that owns a given block type (kebab-case or original name).
     * Looks at modules.items[].name and at templates/<type>.blade.php.
     * Returns null if no plugin owns the type (= core module).
     */
    public static function findPluginForBlockType(string $type): ?string {
        $pluginsDir = __DIR__ . '/../../plugins';
        if (!is_dir($pluginsDir)) return null;
        foreach (scandir($pluginsDir) as $entry) {
            if ($entry === '.' || $entry === '..') continue;
            $pluginRoot = $pluginsDir . '/' . $entry;
            if (!is_dir($pluginRoot)) continue;
            $manifestPath = $pluginRoot . '/plugin.json';
            if (file_exists($manifestPath)) {
                $manifest = json_decode(file_get_contents($manifestPath), true);
                if (is_array($manifest)) {
                    $items = $manifest['modules']['items'] ?? [];
                    foreach ($items as $m) {
                        $name = $m['name'] ?? '';
                        if ($name === '') continue;
                        $kebab = strtolower(preg_replace('/(?<!^)([A-Z])/', '-$1', $name));
                        if ($name === $type || $kebab === $type) return $entry;
                    }
                }
            }
            // Template-based detection (templates/<type>.blade.php)
            $tplPath = $pluginRoot . '/templates/' . $type . '.blade.php';
            if (file_exists($tplPath)) return $entry;
        }
        return null;
    }

    public static function isBlockTypeActive(string $type): bool {
        $owner = self::findPluginForBlockType($type);
        if ($owner === null) return true; // core module — always allowed
        return self::isPluginActive($owner);
    }

    /**
     * Return all block types that belong to inactive plugins (for frontend/admin filtering).
     */
    public static function getInactiveBlockTypes(): array {
        $pluginsDir = __DIR__ . '/../../plugins';
        if (!is_dir($pluginsDir)) return [];
        $activeList = self::getActiveList();
        $inactive = [];
        foreach (scandir($pluginsDir) as $entry) {
            if ($entry === '.' || $entry === '..') continue;
            $pluginRoot = $pluginsDir . '/' . $entry;
            if (!is_dir($pluginRoot)) continue;
            $manifestPath = $pluginRoot . '/plugin.json';
            if (!file_exists($manifestPath)) continue;
            $isActive = $activeList === null ? true : in_array($entry, $activeList, true);
            if ($isActive) continue;
            $manifest = json_decode(file_get_contents($manifestPath), true);
            if (!is_array($manifest)) continue;
            $items = $manifest['modules']['items'] ?? [];
            foreach ($items as $m) {
                $name = $m['name'] ?? '';
                if ($name === '') continue;
                $kebab = strtolower(preg_replace('/(?<!^)([A-Z])/', '-$1', $name));
                $inactive[] = $kebab;
                if ($name !== $kebab) $inactive[] = $name;
            }
            // Template-based plugin types
            $tplDir = $pluginRoot . '/templates';
            if (is_dir($tplDir)) {
                foreach (scandir($tplDir) as $f) {
                    if (str_ends_with($f, '.blade.php')) {
                        $inactive[] = substr($f, 0, -strlen('.blade.php'));
                    }
                }
            }
        }
        return array_values(array_unique($inactive));
    }

    /**
     * GET /plugins/inactive-types — public, returns block types of disabled plugins
     * Used by frontend and admin to skip rendering modules whose plugin is off.
     */
    public static function getInactiveTypes(): void {
        json_response(['types' => self::getInactiveBlockTypes()]);
    }

    public static function getPluginManifests(bool $activeOnly = false): array {
        $pluginsDir = __DIR__ . '/../../plugins';
        if (!is_dir($pluginsDir)) return [];

        $activeList = self::getActiveList();

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
            $manifest['_active'] = $activeList === null ? true : in_array($entry, $activeList, true);

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

        // Rebuild the frontend so any pages containing modules from this plugin
        // re-render correctly (hidden when off, restored when on) without the
        // user needing to re-save each page.
        trigger_frontend_rebuild('plugin ' . ($active ? 'enabled' : 'disabled') . ': ' . $pluginDir, false);

        json_response(['active' => (bool) $active, 'active_plugins' => $currentList]);
    }
}
