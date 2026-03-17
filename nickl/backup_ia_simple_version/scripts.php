<?php

new App\Helpers\AjaxRefs();
new App\Helpers\AjaxNews();
new App\Helpers\AjaxEvents();
new App\Helpers\AjaxIa();
// Fonction pour ajouter les scripts nécessaires pour l'AJAX
if (!function_exists('enqueue_custom_ajax_scripts')) {
    function enqueue_custom_ajax_scripts()
    {
        // Si on est dans l'admin, on arrête l'exécution du script
        if (is_admin()) {
            return;
        }

        // Données AJAX pour la localisation
        $ajax_data = [
            'ajaxurl' => admin_url('admin-ajax.php'), // URL pour faire l'appel AJAX
            'nonce' => wp_create_nonce('ajax_nonce'), // Génération du nonce pour sécurité
        ];

        // Vérification des types de publication pour déterminer quel script charger
        if (is_post_type_archive('references') || is_tax('ref_categorie') || is_single('reference')) {
            wp_enqueue_script('AjaxRefs', get_template_directory_uri() . '/resources/scripts/autoload/AjaxRefs.js', ['jquery'], null, true);
            wp_localize_script('AjaxRefs', 'ajaxObject', $ajax_data);
        } elseif (is_post_type_archive('actualites')) {
            wp_enqueue_script('AjaxNews', get_template_directory_uri() . '/resources/scripts/autoload/AjaxNews.js', ['jquery'], null, true);
            wp_localize_script('AjaxNews', 'ajaxObject', $ajax_data);
        } elseif (is_post_type_archive('evenements')) {
            wp_enqueue_script('AjaxEvents', get_template_directory_uri() . '/resources/scripts/autoload/AjaxEvents.js', ['jquery'], null, true);
            wp_localize_script('AjaxEvents', 'ajaxObject', $ajax_data);
        }
    }
    add_action('wp_enqueue_scripts', 'enqueue_custom_ajax_scripts');
}

?>