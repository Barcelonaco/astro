<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class SingleActualites extends Composer
{
    /**
     * Définir les vues concernées par ce Composer.
     */
    protected static $views = [
        'single-actualites',
    ];

    /**
     * Injecter les données nécessaires aux vues.
     */
    public function with()
    {
    
        return [
            'modules' => $this->getModules(),
        ];
    }

    protected function isWoocommercePage($pid = null)
    {
        if (empty($pid)) {
            $pid = get_the_ID();
        }
        if (class_exists('woocommerce')) {
            if (function_exists('pll_get_post_translations')) {

                $shop = pll_get_post_translations(wc_get_page_id('shop'));
                $cart = pll_get_post_translations(wc_get_page_id('cart'));
                $checkout = pll_get_post_translations(wc_get_page_id('checkout'));
                $accountPage = pll_get_post_translations(wc_get_page_id('myaccount'));

                $checkoutPayPage = is_checkout_pay_page();
                $product = is_singular('product');
                $endPointWP = is_wc_endpoint_url();

                foreach ($shop as $id) {
                    $wcPagesID[] = $id;
                }
                foreach ($cart as $id) {
                    $wcPagesID[] = $id;
                }
                foreach ($checkout as $id) {
                    $wcPagesID[] = $id;
                }
                foreach ($accountPage as $id) {
                    $wcPagesID[] = $id;
                }


                if ($checkoutPayPage || $product || $endPointWP || in_array($pid, $wcPagesID)) {
                    return true;
                }
            } else {
                $shop = wc_get_page_id('shop');
                $cart = wc_get_page_id('cart');
                $checkout = wc_get_page_id('checkout');
                $accountPage = wc_get_page_id('myaccount');

                $checkoutPayPage = is_checkout_pay_page();
                $product = is_singular('product');
                $endPointWP = is_wc_endpoint_url();

                $wcPagesID[] = $shop;
                $wcPagesID[] = $cart;
                $wcPagesID[] = $checkout;
                $wcPagesID[] = $accountPage;

                if ($checkoutPayPage || $product || $endPointWP || in_array($pid, $wcPagesID)) {
                    return true;
                }
            }
        }

        return false;
    }

    protected function getH1InHeader()
    {
        return get_field('h1_in_header');
    }

    protected function getModules()
    {
        $modules = get_field('flexible_modules');
     
        return is_array($modules) ? $modules : []; // Retourne un tableau vide si ce n'est pas un tableau
    }

    protected function getHeaderType()
    {
        $headerType = get_field('header_type');
        return is_string($headerType) ? $headerType : 'none'; // Retourne 'default' si ce n'est pas une chaîne
    }

}
