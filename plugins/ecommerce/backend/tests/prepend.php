<?php
/**
 * Auto-prepend script — définit les stubs AVANT que PHPUnit ne charge
 * l'autoloader Composer (qui inclut les helpers qui appellent exit).
 *
 * Usage dans phpunit.xml : php → ini → auto_prepend_file="backend/tests/prepend.php"
 * OU via CLI : php -d auto_prepend_file=backend/tests/prepend.php vendor/bin/phpunit
 */

// Bloque les fichiers helpers de l'autoloader Composer
$backendDir = getenv('BACKEND_PHP_DIR') ?: (realpath(__DIR__ . '/../../../../backend-php') ?: '');
if ($backendDir) {
    $autoloadFilesPath = $backendDir . '/vendor/composer/autoload_files.php';
    if (file_exists($autoloadFilesPath)) {
        $fileMap = require $autoloadFilesPath;
        foreach ($fileMap as $hash => $filePath) {
            if (strpos($filePath, 'helpers/response.php') !== false
                || strpos($filePath, 'helpers/request.php') !== false
                || strpos($filePath, 'helpers/slug.php') !== false
            ) {
                $GLOBALS['__composer_autoload_files'][$hash] = true;
            }
        }
    }
}

// Stubs testables (throw au lieu d'exit)
function json_response($data, int $status = 200): void {
    throw new \RuntimeException(json_encode(['status' => $status, 'data' => $data]));
}
function error_response(string $message, int $status = 400): void {
    throw new \RuntimeException(json_encode(['status' => $status, 'error' => $message]));
}
function get_json_body(): array {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}
function get_bearer_token(): ?string { return null; }
