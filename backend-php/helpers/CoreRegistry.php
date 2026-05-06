<?php

/**
 * Core CPT + module registry. Single source of truth for built-in (non-plugin)
 * post types and modules. Backed by config/core_modules.json so the Astro
 * frontend can read the same file at build time.
 */
class CoreRegistry {
    private static ?array $cache = null;

    public static function load(): array {
        if (self::$cache !== null) return self::$cache;
        $path = __DIR__ . '/../config/core_modules.json';
        if (!file_exists($path)) {
            self::$cache = ['cpts' => [], 'modules' => []];
            return self::$cache;
        }
        $data = json_decode(file_get_contents($path), true);
        self::$cache = is_array($data) ? $data : ['cpts' => [], 'modules' => []];
        return self::$cache;
    }

    public static function getCPTs(): array {
        return self::load()['cpts'] ?? [];
    }

    public static function getModules(): array {
        return self::load()['modules'] ?? [];
    }

    public static function isCoreCPT(string $slug): bool {
        foreach (self::getCPTs() as $cpt) {
            if (($cpt['slug'] ?? '') === $slug) return true;
        }
        return false;
    }

    public static function isCoreModule(string $name): bool {
        foreach (self::getModules() as $m) {
            $n = $m['name'] ?? '';
            if ($n === '') continue;
            $kebab = strtolower(preg_replace('/(?<!^)([A-Z])/', '-$1', $n));
            if ($n === $name || $kebab === $name) return true;
        }
        return false;
    }
}
