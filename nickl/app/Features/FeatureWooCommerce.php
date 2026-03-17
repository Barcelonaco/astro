<?php

namespace App\Features;
class FeatureWooCommerce
{
    public function hooks()
    {
        if (!class_exists('WooCommerce')) {
            return;
        }
        add_action('admin_menu', [$this, 'hideWoocommerceMenu'], 71);
        add_action('after_setup_theme', [$this, 'addWCLibrary']);
        add_filter('woocommerce_add_to_cart_fragments', [$this, 'refreshCountCartItems'], 10, 1);
        add_action('product_cat_edit_form_fields', [$this, 'addProductCatLongDescripton'], 10);
        add_action('edited_product_cat', [$this, 'saveProductCatLongDescripton']);
        add_action('admin_enqueue_scripts', [$this, 'injectJSConfig'], 100);
    }

    public function refreshCountCartItems($fragments)
    {
        $countCartItems = WC()->cart->get_cart_contents_count();
        if ($countCartItems > 0) {
            $fragments['span.header-cart-count'] = '<span class="nbr header-cart-count" aria-hidden="true">' . $countCartItems . '</span>';
        } else {
            $fragments['span.header-cart-count'] = '<span class="nbr header-cart-count" aria-hidden="true" style="display: none"></span>';
        }

        return $fragments;
    }

    public function addWCLibrary()
    {
        add_theme_support('wc-product-gallery-zoom');
        add_theme_support('wc-product-gallery-lightbox');
        add_theme_support('wc-product-gallery-slider');
    }

    public function hideWoocommerceMenu()
    {
        if (!IS_COMMERCIAL && (!current_user_can('administrator') || current_user_can('adminsite'))) {
            remove_menu_page('woocommerce');
            remove_menu_page('woocommerce-marketing');
            remove_menu_page('wc-admin&path=/analytics/overview');
        }
    }

    public function addProductCatLongDescripton($term)
    {
        $long_description = get_term_meta($term->term_id, 'long_description', true);
        ?>
        <tr class="form-field term-long-description-wrap">
            <th scope="row"><label for="long_description"><?php _e('Description longue', 'your-textdomain'); ?></label></th>
            <td>
                <?php
                wp_editor($long_description, 'long_description', [
                    'textarea_name' => 'long_description',
                    'textarea_rows' => 30,
                    'media_buttons' => false,
                ]);
                ?>
                <p class="description">
                    <?php _e('Ajouter une description longue pour cette catégorie produit.', 'your-textdomain'); ?>
                </p>
            </td>
        </tr>
        <?php
    }
    public function saveProductCatLongDescripton($term_id)
    {
        if (isset($_POST['long_description'])) {
            update_term_meta($term_id, 'long_description', wp_kses_post($_POST['long_description']));
        }
    }

    public function injectJSConfig()
    {
        wp_localize_script('sage/admin.js', 'nicklConfig', [
            'is_woocommerce' => true,
        ]);
    }
}

