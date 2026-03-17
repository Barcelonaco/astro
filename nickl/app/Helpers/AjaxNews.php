<?php

namespace App\Helpers;

use App\Helpers\NewsHelper as News;
use Roots\view; // Assure que la fonction view() est disponible

class AjaxNews
{
    public function __construct()
    {
        add_action('wp_ajax_change_actu', [$this, 'change']);
        add_action('wp_ajax_nopriv_change_actu', [$this, 'change']);
        add_action('wp_ajax_loadmore_actu', [$this, 'loadmore']);
        add_action('wp_ajax_nopriv_loadmore_actu', [$this, 'loadmore']);
    }

    public function change()
    {
        // Récupération et sécurisation du terme de catégorie
        $term = !empty($_POST['term']) ? sanitize_text_field($_POST['term']) : null;

        // Paramètres de pagination
        $ppp = 7;
        $offset = 0;

        // Récupération des actualités
        if ($term === 'weblex') {
            $newsData = News::getNewsFromWebLex(null, $offset, $ppp);
        } else {
            $newsData = News::getNews($term, $offset, $ppp);
        }

        $response = [
            'html' => '',
            'pagination' => ''
        ];

        if (!empty($newsData['posts'])) {
            foreach ($newsData['posts'] as $post) {
                ob_start();

                // Gestion ID WebLex ou WP
                $pid = is_array($post) ? $post['id'] : $post->ID;

                $response['html'] .= view('components.preview-actualites', [
                    'post' => $post,
                    'pid' => $pid,
                ])->render();
            }
        }

        // Gestion de la pagination
        if (!empty($newsData['max_pages']) && $newsData['max_pages'] > 1) {
            $nextPage = 2;
            $response['pagination'] = "<div class='btn-more-wrapper js_list-pagination'><button type='button'
                                class='btn btn-tertiary js_load-more' data-page='" . esc_attr($nextPage) . "'>" .
                esc_html(bcn_pll("Voir plus d'actualités")) .
                "</button></div>";
        }

        wp_send_json_success($response);
        wp_die();
    }

    public function loadmore()
    {
        // Récupération et sécurisation des données
        $term = !empty($_POST['term']) ? sanitize_text_field($_POST['term']) : null;

        $targetPage = isset($_POST['targetPage']) ? intval($_POST['targetPage']) : 1;

        // Paramètres de pagination
        $ppp = 6;
        $offset = ($ppp * ($targetPage - 1) + 1);

        if ($targetPage === 2) {
            $offset = 7;
        }

        $data = [
            'html' => '',
            'pagination' => ''
        ];

        // Récupération des actualités paginées
        if ($term === 'weblex') {
            $newsData = News::getNewsFromWebLex(null, $offset, $ppp);
        } else {
            $newsData = News::getNews($term, $offset, $ppp);
        }




        if (!empty($newsData['posts'])) {
            foreach ($newsData['posts'] as $post) {
                if (is_object($post)) {
                    $data['html'] .= view('components.preview-actualites', [
                        'post' => $post,
                        'pid' => $post->ID
                    ])->render();
                } else {
                    $data['html'] .= view('components.preview-actualites', [
                        'post' => $post
                    ])->render();
                }


            }

        }

        // Gestion de la pagination
        if (!empty($newsData['max_pages']) && $newsData['max_pages'] > $targetPage) {
            $nextPage = $targetPage + 1;

            $data['pagination'] = "<div class='btn-more-wrapper js_list-pagination'><button type='button'
                                    class='btn btn-tertiary js_load-more' data-page='" . esc_attr($nextPage) . "'>" .
                esc_html(bcn_pll('Voir plus d\'actualités')) .
                "</button></div>";
        }

        wp_send_json_success($data);
        wp_die();
    }
}
