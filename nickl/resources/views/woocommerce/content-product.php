<?php
use App\Helpers\GlobalHelper;

defined('ABSPATH') || exit;

// Paramètres de la requête
$args = [
  'post_type' => 'product', // On cherche des produits
  'posts_per_page' => -1,   // -1 pour récupérer tous les produits
  'post_status' => 'publish', // Seulement les produits publiés
];

// Exécuter la requête
$product_query = new WP_Query($args);
?>

<?php
// Vérifier si la requête a des résultats
if ($product_query->have_posts()) :
    while ($product_query->have_posts()) :
        $product_query->the_post();
      // Récupérer l'objet produit WooCommerce
        $product = wc_get_product(get_the_ID());
        ?>
    <li <?php wc_product_class('', $product); ?>>
      <a href="<?php the_permalink(); ?>"> <!-- Lien vers la page produit -->
        <?php
        /**
         * Hook: woocommerce_before_shop_loop_item.
         *
         * @hooked woocommerce_template_loop_product_link_open - 10
         */
        do_action('woocommerce_before_shop_loop_item');
        ?>
        <div class="illus-wrapper">
          <?php
            /**
             * Hook: woocommerce_before_shop_loop_item_title.
             *
             * @hooked woocommerce_show_product_loop_sale_flash - 10
             * @hooked woocommerce_template_loop_product_thumbnail - 10
             */
            do_action('woocommerce_before_shop_loop_item_title');
            ?>
          <div class="overlay">
            <span class="icon" aria-hidden="false"><?= GlobalHelper::displaySvg('eye.svg') ?></span>
            <?= bcn_pll('En savoir plus') ?>
          </div>
        </div>
          <?php
          /**
           * Hook: woocommerce_shop_loop_item_title.
           *
           * @hooked woocommerce_template_loop_product_title - 10
           */
            do_action('woocommerce_shop_loop_item_title');

          /**
           * Hook: woocommerce_after_shop_loop_item_title.
           *
           * @hooked woocommerce_template_loop_rating - 5
           * @hooked woocommerce_template_loop_price - 10
           */
            do_action('woocommerce_after_shop_loop_item_title');

            if (IS_COMMERCIAL) {
              /**
               * Hook: woocommerce_after_shop_loop_item.
               *
               * @hooked woocommerce_template_loop_product_link_close - 5
               * @hooked woocommerce_template_loop_add_to_cart - 10
               */
                do_action('woocommerce_after_shop_loop_item');
            } else {
                echo "<a href='javascript:void(0)' class='fake-link'></a>";
            }
            ?>
      </a>
    </li>
        <?php
    endwhile;
else :
    echo '<p>' . __('No products found') . '</p>';
endif;

// Réinitialiser la requête WordPress
wp_reset_postdata();
?>
