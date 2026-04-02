<?php
/**
 * One-time script to generate module-fields.json from PHP module definitions.
 *
 * Usage: cd backend-php && php generate-module-fields.php
 *
 * This script parses nickl/app/Modules/*.php using the same regex logic as
 * ModuleFieldsController and outputs a static JSON file that the controller
 * can load directly, removing the dependency on the nickl/ folder.
 *
 * Delete this script after generating the JSON file.
 */

// We need the json_response function stub so the controller doesn't fail
function json_response($data) {
    // no-op: we capture data differently
}

require_once __DIR__ . '/controllers/ModuleFieldsController.php';

// Make private methods accessible via reflection
$rc = new ReflectionClass('ModuleFieldsController');

$parseBlockParamsMethods = $rc->getMethod('parseBlockParamsMethods');
$parseBlockParamsMethods->setAccessible(true);

$parsePhpFile = $rc->getMethod('parsePhpFile');
$parsePhpFile->setAccessible(true);

// Paths
$repoRoot = realpath(__DIR__ . '/..');
$modulesDir = $repoRoot . '/nickl/app/Modules';
$blockParamsPath = $modulesDir . '/BlockParams.php';

// 1. Parse BlockParams methods
$blockParamsMap = [];
if (file_exists($blockParamsPath)) {
    $blockParamsMap = $parseBlockParamsMethods->invoke(null, file_get_contents($blockParamsPath));
}

// 2. Scan all core module PHP files (excluding Schemas/ subdirectory)
$modules = [];

$scanDir = function (string $dir) use (&$scanDir, &$modules, $blockParamsMap, $parsePhpFile) {
    if (!is_dir($dir)) return;
    foreach (scandir($dir) as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $fullPath = $dir . '/' . $entry;

        // Skip Schemas subdirectory (not modules)
        if (is_dir($fullPath) && basename($fullPath) === 'Schemas') continue;

        if (is_dir($fullPath)) {
            $scanDir($fullPath);
            continue;
        }
        if (!str_ends_with($entry, '.php')) continue;
        if ($entry === 'BlockParams.php') continue; // handled separately

        $parsed = $parsePhpFile->invoke(null, $fullPath, $blockParamsMap);
        if (!$parsed) continue;

        if (!isset($modules[$parsed['className']])) {
            $modules[$parsed['className']] = ['layout' => $parsed['layout'], 'fields' => $parsed['fields']];
        } else {
            $existing = [];
            foreach ($modules[$parsed['className']]['fields'] as $f) $existing[$f['name']] = $f;
            foreach ($parsed['fields'] as $f) {
                if (!isset($existing[$f['name']])) $existing[$f['name']] = $f;
            }
            $modules[$parsed['className']]['fields'] = array_values($existing);
            if (!$modules[$parsed['className']]['layout'] && $parsed['layout']) {
                $modules[$parsed['className']]['layout'] = $parsed['layout'];
            }
        }
    }
};

$scanDir($modulesDir);

// Also scan FieldGroup directory if it exists inside Modules
$fieldGroupDir = $modulesDir . '/FieldGroup';
if (is_dir($fieldGroupDir)) {
    $scanDir($fieldGroupDir);
}

// 3. Build output
$output = [
    'modules' => $modules,
    'blockParams' => $blockParamsMap,
];

// 4. Write JSON
$configDir = __DIR__ . '/config';
$outputPath = $configDir . '/module-fields.json';

$json = json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

file_put_contents($outputPath, $json);

$moduleCount = count($modules);
$blockParamsCount = count($blockParamsMap);

echo "Generated $outputPath\n";
echo "  - $moduleCount modules\n";
echo "  - $blockParamsCount BlockParams methods\n";
echo "\nModules:\n";
foreach ($modules as $className => $mod) {
    $fieldCount = count($mod['fields']);
    echo "  $className (layout: {$mod['layout']}) — $fieldCount fields\n";
}
echo "\nBlockParams methods:\n";
foreach ($blockParamsMap as $methodName => $fields) {
    $fieldCount = count($fields);
    echo "  $methodName — $fieldCount fields\n";
}
echo "\nDone! You can now update ModuleFieldsController.php to load this JSON.\n";
