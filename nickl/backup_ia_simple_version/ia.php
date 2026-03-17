<?php

add_action('admin_enqueue_scripts', function () {
    wp_enqueue_script('ia-generator', get_template_directory_uri() . '/resources/scripts/routes/ia.js', ['jquery'], null, true);

    wp_localize_script('ia-generator', 'AjaxIa', [
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('ajax_nonce')
    ]);
});
