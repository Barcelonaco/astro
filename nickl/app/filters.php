<?php

/**
 * Theme filters.
 */

namespace App;

/**
 * Add "… Continued" to the excerpt.
 *
 * @return string
 */
add_filter('excerpt_more', function () {
    return sprintf(' ...');
});
add_filter('wpseo_json_ld_output', '__return_false');
add_filter('wp_calculate_image_srcset', '__return_false');
add_filter('nav_menu_link_attributes', function($atts, $item, $args, $depth) {
    if (isset($atts['href']) && $atts['href'] === '#') {
        $atts['href'] = 'javascript:void(0)'; // ou '' selon préférence
        $atts['class'] = (isset($atts['class']) ? $atts['class'] . ' ' : '') . 'no-link';
        $atts['onclick'] = 'return false;';
    }
    return $atts;
}, 10, 4);