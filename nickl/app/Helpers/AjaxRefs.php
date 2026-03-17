<?php
namespace App\Helpers;

use App\Helpers\ReferencesHelper as Refs;

class AjaxRefs
{
    public function __construct()
    {
        add_action('wp_ajax_change_ref', [$this, 'change']);
        add_action('wp_ajax_nopriv_change_ref', [$this, 'change']);
        add_action('wp_ajax_loadmore_ref', [$this, 'loadmore']);
        add_action('wp_ajax_nopriv_loadmore_ref', [$this, 'loadmore']);

    }

    /**
     * Change the content based on the provided term
     */
    public function change()
    {

        // Vérification du nonce
        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'ajax_nonce')) {
            wp_send_json_error(['message' => 'Nonce invalide', 'nonce_received' => $_POST['nonce'] ?? '']);
            wp_die(); // Stoppe l'exécution en cas d'erreur
        }

        $term = !empty($_POST['term']) ? sanitize_text_field($_POST['term']) : null;
        $ppp = 6; // Nombre de posts par page
        $offset = 0;

        // Récupération des données
        if($term !== 'all'){
            $data = Refs::getRefs($ppp, null, $term, $offset);
        }
        else{
            $data = Refs::getRefs(6, null, null, 0, true);
        }


        $response = [
            'html' => '',
            'popin' => '',
            'pagination' => ''
        ];

        // Si des posts sont récupérés
        if (!empty($data['posts'])) {
            foreach ($data['posts'] as $post) {
                ob_start();
                $pid = $post->ID;
                $response['html'] .= view('components.preview-references', ['post' => $post, 'pid' => $pid])->render();
                $response['popin'] .= view('components.preview-popin-references', ['post' => $post, 'pid' => $pid])->render();
            }

            // Pagination
            if ($data['max_pages'] > 1) {
                $nextPage = 2;
                $response['pagination'] = "<button type='button' class='btn btn-tertiary js_load-more'
                                            data-term='" . esc_attr($term) . "'
                                            data-page='" . $nextPage . "'>" . bcn_pll('En voir plus') . "</button>";
            }

            wp_send_json_success($response);

        } else {
            // Si aucune donnée n'est trouvée
            wp_send_json_error(['message' => 'Aucun résultat trouvé']);
            wp_die();
        }
    }

    /**
     * Handle load more action
     */
    public function loadmore()
    {
        // Vérification du nonce
        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'ajax_nonce')) {
            wp_send_json_error(['message' => 'Nonce invalide']);
            wp_die(); // Stoppe l'exécution en cas d'erreur
        }

        $term = !empty($_POST['term']) ? sanitize_text_field($_POST['term']) : null;
        $targetPage = !empty($_POST['targetPage']) ? intval($_POST['targetPage']) : 1;
        $ppp = 6;
        $offset = ($ppp * ($targetPage - 1));

        // Récupération des données
        $data = Refs::getRefs($ppp, null, $term, $offset);

        $response = [
            'html' => '',
            'popin' => '',
            'pagination' => ''
        ];

        // Si des posts sont récupérés
        if (!empty($data['posts'])) {
            foreach ($data['posts'] as $post) {
                ob_start();
                $pid = $post->ID;
                $response['html'] .= view('components.preview-references', ['post' => $post, 'pid' => $pid])->render();
                $response['popin'] .= view('components.preview-popin-references', ['post' => $post, 'pid' => $pid])->render();
            }

            // Gestion de la pagination
            if ($data['max_pages'] > $targetPage) {
                $nextPage = $targetPage + 1;
                $response['pagination'] = "<button type='button' class='btn btn-tertiary js_load-more'
                                            data-term='" . esc_attr($term) . "'
                                            data-page='" . $nextPage . "'>" . bcn_pll('En voir plus') . "</button>";
            }

            wp_send_json_success($response);

        } else {
            // Si aucune donnée n'est trouvée
            wp_send_json_error(['message' => 'Aucun résultat trouvé']);
            wp_die();
        }
    }
}
