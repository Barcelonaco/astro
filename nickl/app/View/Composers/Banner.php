<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class Banner extends Composer
{
    /**
     * Définir les vues concernées par ce Composer.
     */
    protected static $views = [
        'modules.banner',
    ];


    public function with()
    {
        $id = $this->getId();
        $taxo = $this->getTaxonomy();

        return [
            'id' => $id,
            'heightBanner' => $this->getBannerHeight($id),
            'term' => $this->getTerms($id, $taxo, '-'),
            'h1InHeader' => $this->getH1InHeader($id),
            'titleInHeader' => $this->getTitleInHeader($id),
            'imgBanner' => $this->getImgBanner($id),
            'isWooCommercePage' => $this->isWoocommercePage(),
            'term' => $this->getTerms($id, $taxo, '-'),
            'title_size' => get_field('title_size'),
            'title' => GlobalHelper::getTitle($id)
        ];
    }

    /**
     * Récupérer l'ID du post courant.
     */
    protected function getId()
    {
        if (class_exists('WooCommerce') && is_shop()) {
            return wc_get_page_id('shop');
        }
        return get_the_ID() ?: null;
    }

    /**
     * Récupérer la hauteur de la bannière.
     */
    protected function getBannerHeight($id = null)
    {
        if ($id) {
            return get_field('banner_height', $id);
        }
        if (is_single()) {
            return get_field('banner_height');
        }
        if (is_page()) {
            return get_field('banner_height');
        }
        if (is_archive()) {
            return get_field('banner_height', 'options_' . get_post_type());
        }
        if (is_404()) {
            return 'small';
        }

        return 'medium';
    }

    /**
     * Récupérer si le H1 doit être affiché dans le header.
     */
    protected function getH1InHeader($id = null)
    {
        if ($id) {
            return get_field('h1_in_header', $id);
        }
        if (is_single()) {
            return get_field('h1_in_header');
        }
        if (is_page()) {
            return get_field('h1_in_header');
        }
        if (is_archive()) {
            return get_field('h1_in_header', 'options_' . get_post_type());
        }
        if (is_404()) {
            return 'true';
        }

        return 'true';
    }

    /**
     * Récupérer si le titre doit être affiché dans le header.
     */
    protected function getTitleInHeader($id = null)
    {
        if ($id) {
            return get_field('title_in_header', $id);
        }
        if (is_single()) {
            return get_field('title_in_header');
        }
        if (is_page()) {
            return get_field('title_in_header');
        }
        if (is_archive()) {
            return get_field('title_in_header', 'options_' . get_post_type());
        }
        if (is_404()) {
            return 'true';
        }

        return 'true';
    }

    /**
     * Récupérer l'image de la bannière.
     */
    protected function getImgBanner($id = null)
    {
        $size = 'banner';

        if ($id) {
            return GlobalHelper::getImageOrReplacement($size, $id);
        }
        if (is_single()) {
            return GlobalHelper::getImageOrReplacement($size, get_the_ID());
        }
        if (is_page()) {
            return GlobalHelper::getImageOrReplacement($size, get_the_ID());
        }
        if (is_archive()) {
            $img = get_field('header_img', 'options_' . get_post_type());
            if (!empty($img)) {
                return $img[ 'sizes' ][ $size ];
            }
        }

        $img = get_field('replacement_image', 'options');

        if (!empty($img)) {
            return $img[ 'sizes' ][ $size ];
        }

        return false;
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

    protected function getTerms($pid, $taxo, $separator = '-')
    {
        $terms = get_the_terms($pid, $taxo);
        $return = null;

        if (is_array($terms) && !empty($terms)) {
            $i = 1;
            $count = count($terms);

            foreach ($terms as $term) {
                $return .= $term->name;
                if ($count > 1) {
                    if ($i != $count) {
                        $return .= ' ' . $separator . ' ';
                    }
                }

                $i++;
            }
        }

        return $return;
    }

    protected function getTaxonomy()
{
    return get_post_type() === 'product' ? 'product_cat' : 'category';
}

}
