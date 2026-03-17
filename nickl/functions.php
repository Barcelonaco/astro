<?php

require_once __DIR__ . '/config/acorn.php';

$includes_config = [
    'translations.php',
    'bcnco_translation.php',
    'woocommerce.php',
    'scripts.php',
    'theme_nickl.php',
    'insta.php',
    'acymailing.php',
    'plandusite.php',
    'ia.php',
    'commands.php'
];
$includes_app = [
    'setup.php',
    'filters.php',
];
foreach ($includes_app as $file) {
    require_once __DIR__ . "/app/{$file}";
}
foreach ($includes_config as $files) {
    require_once __DIR__ . "/config/{$files}";
}
