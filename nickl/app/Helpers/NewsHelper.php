<?php

namespace App\Helpers;

use App\Posttype\CptNews;
use App\Taxonomy\TaxoNewsCategory;

class NewsHelper
{
    public static function getNews($term = null, $offset = 0, $ppp = 6)
    {
        $cptSlug = new CptNews();
        $taxoSlug = new TaxoNewsCategory();
        $data = [];

        $args = [
            'post_type' => $cptSlug->getSlug(),
            'post_status' => 'publish',
            'posts_per_page' => $ppp,
            'paged' => 1,
            'offset' => $offset,
        ];

        if ($term && $term !== 'all') {
            $args['tax_query'] = [
                [
                    'terms' => $term,
                    'field' => 'slug',
                    'taxonomy' => $taxoSlug->getSlug()
                ]
            ];
        }
        $posts = new \WP_Query($args);

        if ($posts->have_posts()) {
            $data = [
                'posts' => $posts->posts,
                'max_pages' => $posts->max_num_pages,
                'next_page' => 2,
            ];
        }

        return $data;
    }

    public static function getNewsFromWebLex($term = null, $offset = 0, $ppp = 6)
    {
        $url = 'https://www.weblex.fr/weblex/feed/26366';
        $response = wp_remote_get($url);

        if (is_wp_error($response)) {
            return [
                'posts' => [],
                'max_pages' => 0,
                'next_page' => 0,
            ];
        }

        $body = wp_remote_retrieve_body($response);
        $json = json_decode($body, true);

        if (empty($json['datas']['actus'])) {
            return [
                'posts' => [],
                'max_pages' => 0,
                'next_page' => 0,
            ];
        }

        $actus = array_merge($json['datas']['actus'], $json['datas']['histoire']);

        // Ajout de la rubrique par défaut si absente
        $actus = array_map(function ($item) {
            if (!isset($item['rubrique'])) {
                $item['rubrique'] = 'Petite histoire';
            }
            return $item;
        }, $actus);
        // Filtrage par rubrique si $term est fourni
        if ($term && $term !== 'all') {
            $actus = array_filter($actus, function ($item) use ($term) {
                return sanitize_title($item['rubrique']) === sanitize_title($term);
            });
        }

        // Tri par date décroissante
        usort($actus, function ($a, $b) {
            return strtotime($b['created']) - strtotime($a['created']);
        });
        //dd($actus);

        $total = count($actus);
        $max_pages = ceil($total / $ppp);
        $paged = floor($offset / $ppp) + 1;

        // Découpage pagination
        $posts = array_slice($actus, $offset, $ppp);



        return [
            'posts' => $posts,
            'max_pages' => $max_pages,
            'next_page' => 2,
        ];
    }

    public static function getSingleWebLex($id)
    {
        $url = 'https://www.weblex.fr/weblex/feed/26366';
        $response = wp_remote_get($url);

        if (is_wp_error($response)) {
            return null;
        }

        $body = wp_remote_retrieve_body($response);
        $json = json_decode($body, true);

        $actus = array_merge($json['datas']['actus'], $json['datas']['histoire']);

        if (empty($actus)) {
            return null;
        }

        foreach ($actus as $post) {
            if ($post['id'] == $id) {
                return $post;
            }
        }

        return null;
    }

    public static function getSingleWebLexBySlug($slug, $isHistoire = false)
    {
        $url = 'https://www.weblex.fr/weblex/feed/26366';
        $response = wp_remote_get($url);

        if (is_wp_error($response)) {
            return null;
        }

        $body = wp_remote_retrieve_body($response);
        $json = json_decode($body, true);
        $actus = array_merge($json['datas']['actus'], $json['datas']['histoire']);

        if (empty($actus)) {
            return null;
        }

        foreach ($actus as $post) {
            $urlWeblex = $post['url'];
            if (str_contains($urlWeblex, $slug)) {
                return $post;
            }
        }

        return null;
    }

    public static function getTerms()
    {
        $taxoSlug = new TaxoNewsCategory();
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
