<?php
namespace App\Helpers;

use App\Helpers\EventsHelper as Events;

class AjaxEvents
{
    public function __construct()
    {
        add_action('wp_ajax_change_events', [$this, 'change']);
        add_action('wp_ajax_nopriv_change_events', [$this, 'change']);
        add_action('wp_ajax_loadmore_events', [$this, 'loadmore']);
        add_action('wp_ajax_nopriv_loadmore_events', [$this, 'loadmore']);
    }
    public function change()
    {
        // Vérification de la nonce



        // Sécurisation du terme
        $term = !empty($_POST['term']) ? sanitize_text_field($_POST['term']) : null;

        // Nombre d'éléments à récupérer
        $offset = 0;
        $ppp = -1;

        // Initialisation des données
        $data = [
            'html' => '',
            'pagination' => ''
        ];

        // Récupération des événements filtrés
        $Eventsdata = Events::getEventsFiltered($ppp, $term, $offset);
        //wp_send_json_error(['message' => $Eventsdata['posts']]);
        if (!empty($Eventsdata['posts'])) {
            foreach ($Eventsdata['posts'] as $k => $post) {
                // Rendu du Blade via Acorn
                $data['html'] .= view('components.preview-event-grid', ['post' => $post, 'k' => $k])->render();
            }
        }

        // Gestion de la pagination
        if (!empty($Eventsdata['max_pages']) && $Eventsdata['max_pages'] > 1) {
            $nextPage = 2;
            $data['pagination'] = "<button type='button'
                                class='btn btn-tertiary js_load-more'
                                data-page='" . esc_attr($nextPage) . "'>" .
                esc_html(bcn_pll('Voir plus d\'événements')) .
                "</button>";
        }

        wp_send_json_success($data);
        wp_die();
    }


    public function loadmore()
    {
        $term = !empty($_POST[ 'term' ]) ? $_POST[ 'term' ] : null;
        $targetPage = intval($_POST[ 'targetPage' ]);

        $ppp = 6;
        $data[ 'html' ] = '';
        $data['pagination'] = '';
        $offset = ($ppp * ($targetPage - 1)) +1;

        $Eventsdata = Events::getEventsFiltered($ppp, $term, $offset);

        if (!empty($Eventsdata['posts'])) {
            foreach ($Eventsdata[ 'posts' ] as $k => $post) {
                // Rendu du Blade via Acorn
                $data['html'] = view('components.preview-event-grid', ['pid' => $post->ID, 'k' => $k])->render();
            }
        }


        if ($data['max_pages'] > $targetPage) {
            $nextPage = $targetPage +1;
            $data['pagination'] = "<button type='button'
                                    class='btn btn-tertiary js_load-more' data-page='" . $nextPage ."'>" . __('Voir plus d\'événements', THEME_TEXTDOMAIN) ."</button>";
        }

        wp_send_json_success($data);
        die();
    }
}
