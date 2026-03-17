<?php

use App\Helpers\IaCreditManager;

// Initialiser le gestionnaire de crédits IA (singleton)
add_action('init', function () {
    IaCreditManager::getInstance();
}, 10);

add_action('admin_enqueue_scripts', function () {
    wp_enqueue_script('ia-generator', get_template_directory_uri() . '/resources/scripts/routes/ia.js', ['jquery'], null, true);
    wp_enqueue_script('ia-generator-simple', get_template_directory_uri() . '/resources/scripts/routes/ia_simple.js', ['jquery'], null, true);
    wp_enqueue_script('ia-credit-status', get_template_directory_uri() . '/resources/scripts/routes/ia-credit-status.js', ['jquery'], null, true);

    $default_image = get_field('replacement_image', 'option');
    $default_image_url = '';
    if ($default_image) {
        $default_image_url = is_array($default_image) ? $default_image['url'] : $default_image;
    }

    wp_localize_script('ia-generator', 'AjaxIa2', [
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('ajax_nonce'),
        'default_image' => $default_image_url
    ]);

    wp_localize_script('ia-generator-simple', 'AjaxIa', [
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('ajax_nonce'),
        'default_image' => $default_image_url
    ]);
});
