<?php

namespace App\Helpers;

use App\Helpers\GlobalHelper;
use App\Posttype\CptEvents;
use App\Taxonomy\TaxoEventsType;

class EventsHelper
{

    public static function getEventDate($pid)
    {
        $startDate = get_field('start_date', $pid);
        $endDate = get_field('end_date', $pid);
        $startTime = get_field('start_time', $pid);
        $endTime = get_field('end_time', $pid);
        $html = '';

        if (!empty($startDate) && strtotime($startDate) < strtotime($endDate)) {
            $html .= __('Du', THEME_TEXTDOMAIN) . ' ' . GlobalHelper::getFrenchDate($startDate, 'd/m/Y') . ' ' . __('au',
                            THEME_TEXTDOMAIN) . ' ' . GlobalHelper::getFrenchDate($endDate, 'd/m/Y');
        } else {
            $html .= __('Le', THEME_TEXTDOMAIN) . ' ' . GlobalHelper::getFrenchDate($startDate, 'd/m/Y');
        }

        if (!empty($startTime)) {
            if (!empty($endTime)) {
                $html .= ' ' . __('de', THEME_TEXTDOMAIN) . ' ' . str_replace(':', 'h',
                            GlobalHelper::getFrenchDate($startTime, 'H:i')) . ' ' . __('à',
                                THEME_TEXTDOMAIN) . ' ' . str_replace(':', 'h', GlobalHelper::getFrenchDate($endTime, 'H:i'));
            } else {
                $html .= ' ' . __('à partir de', THEME_TEXTDOMAIN) . ' ' . str_replace(':', 'h',
                GlobalHelper::getFrenchDate($startTime, 'H:i'));
            }
        }

        return $html;
    }

    public static function getEventLocation($pid)
    {
        $locationName = get_field('location_name', $pid);
        $location = get_field('location', $pid);

        $html='';

        if(!empty($locationName)) {
                $html.= __($locationName);
        }

        if(!empty($locationName) && !empty($location)) {
                $html.= ', ';
        }

        if(!empty($location)) {
                $html.= __($location['city']);
        }


        return $html;
    }

    public static function getEventsFiltered($ppp = -1, $term = 'all', $offset = 1)
    {
        $isAjax = false;
        $cpt = new CptEvents();
        $taxoSlug = new TaxoEventsType();
        $active = null;
        $args = [
                'post_type' => $cpt->getSlug(),
                'posts_per_page' => $ppp,
                'paged' => 1,
                'status' => 'publish',
                'orderby' => 'meta_value_num',
                'meta_key' => 'start_date',
                'order' => 'ASC',
                'meta_query' => [
                        'relation' => 'OR',
                        [
                                'key' => 'end_date',
                                'compare' => '>=',
                                'value' => date('Ymd'),
                        ],
                        [
                                [
                                        'relation' => 'OR',
                                        [
                                                'key' => 'end_date',
                                                'compare' => '=',
                                                'value' => '',
                                        ],
                                        [
                                                'key' => 'end_date',
                                                'compare' => 'NOT EXISTS',
                                        ],
                                ],
                                [
                                        'key' => 'start_date',
                                        'compare' => '>=',
                                        'value' => date('Ymd'),
                                ],
                        ],
                ]

        ];

        if (!$isAjax && isset($_GET) && isset($_GET[ 'evenements' ])) {
                $term = $_GET[ 'evenements' ];
                $active = $term;
            }

        if ($term && $term !== 'all') {
            $args[ 'tax_query' ] = [
                    [
                            'terms' => $term,
                            'field' => 'slug',
                            'taxonomy' => $taxoSlug->getSlug()
                    ]
            ];
        }

        $posts = new \WP_Query($args);

        if ($posts->have_posts()) {
            return [
                    'posts' => $posts->posts,
                    'number_page' => $posts->max_num_pages
            ];
        }

        return false;
    }

    public static function getTaxoEventType()
    {
        $taxo = new TaxoEventsType();

        return get_terms([
                'taxonomy' => $taxo->getSlug(),
        ]);
    }

    public static function getEvents($term = 'all')
    {
        $cptSlug = new CptEvents();
        $taxoSlug = new TaxoEventsType();
        $active = null;

        $args = [
                'post_type' => $cptSlug->getSlug(),
                'posts_per_page' => -1,
                'meta_key'          => 'start_date',
                'orderby'           => 'meta_value',
                'order'             => 'ASC',
        ];

        if (!$isAjax && isset($_GET) && isset($_GET[ 'evenements' ])) {
            $term = $_GET[ 'evenements' ];
            $active = $term;
        }

        if ($term && $term !== 'all') {
            $args[ 'tax_query' ] = [
                    [
                            'terms' => $term,
                            'field' => 'slug',
                            'taxonomy' => $taxoSlug->getSlug()
                    ]
            ];
        }

        $posts = new \WP_Query($args);

        if ($posts->have_posts()) {
            return [
                    'posts' => $posts->posts,
                    'active' => $active,
            ];
        }

        return null;
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
