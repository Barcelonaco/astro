<?php

namespace App\Helpers;

class ProductHelper
{
    public static function getFeaturedProducts($products)
    {
    // Ensure WooCommerce is available
        if (! class_exists('WooCommerce')) {
            return [];
        }

        $args = [];
        $defaults = [
        'posts_per_page' => 4,
        'columns' => 4,
        'orderby' => $products,
        'posts__in' => $products,
        ];

        $args = wp_parse_args($args, $defaults);

    // Ensure $products is an array of product IDs before proceeding
        if (! is_array($products) || empty($products)) {
            return $args;
        }

    // Get visible related products then sort them at random.
        $args['related_products'] = array_filter(
            array_map('wc_get_product', $products),
            'wc_products_array_filter_visible'
        );

    // Call wc_set_loop_prop() only if WooCommerce is available
        wc_set_loop_prop('name', 'related');
        wc_set_loop_prop('columns', apply_filters('woocommerce_related_products_columns', $args['columns']));

        return $args;
    }
}
