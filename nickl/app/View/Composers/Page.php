<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class Page extends Composer
{
    /**
     * Définir les vues concernées par ce Composer.
     */
    protected static $views = [
        'page',
    ];

    /**
     * Injecter les données nécessaires aux vues.
     */
    public function with()
    {

        return [
            'isWooCommercePage' => $this->isWoocommercePage(),
            'h1InHeader' => $this->getH1InHeader(),
            'modules' => $this->getModules(),
            'headerType' => $this->getHeaderType(),
        ];
    }

    protected function isWoocommercePage($pid = null)
    {
        if (empty($pid)) {
            $pid = get_the_ID();
        }
        if (class_exists('woocommerce')) {
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

        return false;
    }

    protected function getH1InHeader()
    {
        return get_field('h1_in_header');
    }

    protected function getModules()
    {
        // Récupérer l'ID de la page courante
        $page_id = get_the_ID();

        // Vérifier si l'ID est valide
        if (!$page_id) {
            return []; // Retourne un tableau vide si l'ID de la page n'est pas valide
        }

        // Récupérer la valeur du champ flexible 'flexible_modules' via get_post_meta
        $modules = get_field('flexible_modules', $page_id);

        // Vérifier si c'est un tableau et retourner les modules, sinon retourner un tableau vide
        return is_array($modules) ? $modules : [];
    }

    protected function getHeaderType()
    {
        $headerType = get_field('header_type');
        return is_string($headerType) ? $headerType : 'none'; // Retourne 'default' si ce n'est pas une chaîne
    }

}
