<?php

class PluginController {
    public static function getPluginManifests(): array {
        $pluginsDir = __DIR__ . '/../../plugins';
        if (!is_dir($pluginsDir)) return [];

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
            $manifests[] = $manifest;
        }
        return $manifests;
    }

    public static function getPlugins(): void {
        json_response(['plugins' => self::getPluginManifests()]);
    }
}
