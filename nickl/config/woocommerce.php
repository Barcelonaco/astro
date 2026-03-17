<?php
use App\Helpers\GlobalHelper;

add_filter('woocommerce_show_page_title', '__return_false');

add_action('init', function () {
    remove_post_type_support('product', 'editor');
});

if(class_exists('WooCommerce')) {
    add_filter('template_include', function ($template) {
        if ((is_shop() || is_post_type_archive('product')) && !is_admin()) {

            $blade = locate_template('resources/views/woocommerce/archive-product.blade.php');
            if ($blade) {
                return $blade;
            }
        }
        if ((is_product_category() || is_product_tag()) && !is_admin()) {

            $blade = locate_template('resources/views/woocommerce/archive-product.blade.php');
            if ($blade) {
                return $blade;
            }
        }
        if (is_singular('product')) {
            $blade = locate_template('resources/views/woocommerce/single-product.blade.php');
            if ($blade) {
                return $blade;
            }
        }
        if (is_cart()) {
            $blade = locate_template('resources/views/woocommerce/cart/cart.blade.php');
            if ($blade) {
                return $blade;
            }
        }
        if (is_checkout()) {
            $blade = locate_template('resources/views/woocommerce/page-checkout.blade.php');
            if ($blade) {
                return $blade;
            }
        }
        if (is_account_page()) {
            $blade = locate_template('resources/views/woocommerce/page-account.blade.php');
            if ($blade) {
                return $blade;
            }
        }
        return $template;
    }, 100);


    add_filter('loop_shop_per_page', function($cols) {
        return 25;
    }, 20);

    if (!has_action('woocommerce_before_cart_table', 'add_return_to_shop_button')) {
        add_action('woocommerce_before_cart_table', 'add_return_to_shop_button', 5);
    }
}
if (!function_exists('add_return_to_shop_button')){
    function add_return_to_shop_button() {
        echo '<div class="cart-back">
        <div class="return-to-shop">
            <a class="button wc-backward" href="' . esc_url(wc_get_page_permalink('shop')) . '">'.GlobalHelper::displaySvg('chevron.svg') .' ' . __('Retour à la boutique', 'woocommerce') . '</a>
        </div>
    </div>';
    }
}

add_action('after_setup_theme', function () {
    add_theme_support('woocommerce');
});