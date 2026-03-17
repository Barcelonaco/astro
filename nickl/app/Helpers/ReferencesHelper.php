<?php

namespace App\Helpers;

use App\Taxonomy\TaxoReferencesCategory;
use App\Posttype\CptReferences;

class ReferencesHelper
{
    public static function getRefs($ppp = 6, $forcedRefsId = null, $term = null, $offset = 0, $random = false)
    {
        $cptSlug = new CptReferences();
        $taxoSlug = new TaxoReferencesCategory();
        $data = [];

        // Ajustement de `posts_per_page`
        if ($ppp === -1) {
            $ppp = 100; // Évite les conflits avec `offset`
        }

        $args = [
            'post_type'      => $cptSlug->getSlug(),
            'posts_per_page' => $ppp,
            'post_status'    => 'publish',
        ];

        // Gestion de la pagination et de l'offset
        if ($ppp !== 100) {
            $args['paged'] = max(1, ceil($offset / max(1, $ppp)) + 1);
            $args['offset'] = $offset;
        }

        if ($forcedRefsId) {
            $args['post__in'] = $forcedRefsId;
            $args['orderby'] = 'post__in';
        }

        if ($random) {
            $args['orderby'] = 'rand';
        }

        if ($term && $term !== 'all') {
            $args['tax_query'] = [
                [
                    'taxonomy' => $taxoSlug->getSlug(),
                    'field'    => 'slug',
                    'terms'    => $term,
                ]
            ];
        }

        // Exécution de la requête
        $posts = new \WP_Query($args);

        if ($posts->have_posts()) {
            $data = [
                'posts'     => $posts->posts,
                'max_pages' => $posts->max_num_pages,
                'next_page' => 2,
            ];
        }

        // DEBUG : Log si la requête retourne rien
        if (empty($data['posts'])) {
            error_log('Aucun post trouvé');
            error_log(print_r($args, true));
        }

        wp_reset_postdata();
        return $data;
    }

    public static function getTerms()
    {
        $taxoSlug = new TaxoReferencesCategory();
        return get_terms([
                'taxonomy' => $taxoSlug->getSlug(),
                'hide_empty' => true
        ]);
    }
    public static function title($id = null)
    {
        if ($id) {
            return get_the_title($id);
        }
        if (is_home()) {
            if ($home = get_option('page_for_posts', true)) {
                return get_the_title($home);
            }
            return bcn_pll('Les derniers articles');
        }
        if (is_archive()) {
            $title = get_field('title', 'options_' . get_post_type());
            if (empty($title)) {
                $postType = get_post_type_object(get_post_type());
                return $postType->label;
            }
            return $title;
        }
        if (is_search()) {
            //return sprintf(bcn_pll('Résultat de recherche pour %s'), get_search_query());
            return '';
        }
        if (is_404()) {
            return bcn_pll('Page non trouvée');
        }
        return get_the_title();
    }
}
