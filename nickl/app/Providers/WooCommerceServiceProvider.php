<?php

namespace App\Providers;

use Roots\Acorn\Sage\SageServiceProvider;

class WooCommerceServiceProvider extends SageServiceProvider
{
    public function register()
    {
        //
    }

    public function boot()
    {
        // // Corrige le conflit entre la page /boutique et les archives produit
        // add_action('pre_get_posts', function ($query) {
        //     if (
        //         !is_admin() &&
        //         $query->is_main_query() &&
        //         $query->get('pagename') === 'boutique'
        //     ) {
        //         $query->set('post_type', 'product');
        //         $query->set('wc_query', 'product_query');
        //         $query->is_post_type_archive = true;
        //         $query->is_archive = true;

        //         add_filter('woocommerce_is_shop', '__return_true');
        //     }
        // });

        // // Forcer l'utilisation du template Blade si disponible
        // add_filter('template_include', function ($template) {
        //     if ((is_shop() || is_post_type_archive('product')) && !is_admin()) {
        //         $blade = locate_template('resources/views/woocommerce/archive-product.blade.php');
        //         if ($blade) {
        //             return $blade;
        //         }
        //     }
        //     return $template;
        // }, 100);

        // Ajoute une règle de réécriture propre pour /boutique/page/2/
        add_action('init', function () {
            add_rewrite_rule(
                '^boutique(/page/([0-9]+))?/?$',
                'index.php?pagename=boutique&paged=$matches[2]',
                'top'
            );
        });

        // // Redirection après commande (facultatif mais utile)
        // add_action('woocommerce_thankyou', function ($order_id) {
        //     if ($order_id) {
        //         wp_safe_redirect(wc_get_endpoint_url('order-received', $order_id, wc_get_checkout_url()));
        //         exit;
        //     }
        // });

        // // Utiliser les templates blade personnalisés pour WooCommerce
        // add_filter('woocommerce_locate_template', function ($template, $template_name) {
        //     $basename = basename($template_name, '.php');

        //     if (\Roots\view()->exists("woocommerce.{$basename}")) {
        //         return \Roots\view("woocommerce.{$basename}")->getPath();
        //     }
        //     return $template;
        // }, 100);
    }
}
