<?php

new App\Helpers\AjaxRefs();
new App\Helpers\AjaxNews();
new App\Helpers\AjaxEvents();
new App\Helpers\AjaxIa();
// Fonction pour ajouter les scripts nécessaires pour l'AJAX
if (!function_exists('enqueue_custom_ajax_scripts')) {
    function enqueue_custom_ajax_scripts()
    {
        if (is_admin()) {
            return;
        }

        if (is_admin()) {
            return;
        }

        // Vérification des types de publication pour déterminer quel script charger
        if (is_post_type_archive('references') || is_tax('ref_categorie') || is_single('reference')) {
            \Roots\bundle('ajaxRefs')->enqueue();
        } elseif (is_post_type_archive('actualites')) {
            \Roots\bundle('ajaxNews')->enqueue();
        } elseif (is_post_type_archive('evenements')) {
            \Roots\bundle('ajaxEvents')->enqueue();
        }
    }
    add_action('wp_enqueue_scripts', 'enqueue_custom_ajax_scripts');

    // Injection des données AJAX dans le head pour être sûr qu'elles soient disponibles
    add_action('wp_head', function () {
        if (is_admin()) {
            return;
        }

        // Vérification si on doit charger les données
        if (
            is_post_type_archive('references') || is_tax('ref_categorie') || is_single('reference') ||
            is_post_type_archive('actualites') ||
            is_post_type_archive('evenements')
        ) {
            $ajax_data = [
                'ajaxurl' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('ajax_nonce'),
            ];
            echo '<script>var ajaxObject = ' . json_encode($ajax_data) . ';</script>';
        }
    });
}



?>