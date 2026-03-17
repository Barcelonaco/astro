<?php

add_theme_support('acorn');

$acorn_path = __DIR__ . '/../vendor/autoload.php';

if (file_exists($acorn_path)) {
    require_once $acorn_path;
} else {
    wp_die(__('Error locating autoloader. Please run <code>composer install</code>.', 'sage'));
}

if (!function_exists('\Roots\bootloader')) {
    wp_die(
        __('You need to install Acorn to use this site.', 'domain'),
        '',
        [
            'link_url'  => 'https://roots.io/acorn/docs/installation/',
            'link_text' => __('Acorn Docs: Installation', 'domain'),
        ]
    );
}

add_action('after_setup_theme', function () {
    \Roots\bootloader()->boot();
}, 0);
