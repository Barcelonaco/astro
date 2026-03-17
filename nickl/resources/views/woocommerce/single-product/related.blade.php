<?php
/**
 * Related Products
 *
 * This template can be overridden by copying it to yourtheme/woocommerce/single-product/related.php.
 *
 * @see https://docs.woocommerce.com/document/template-structure/
 * @package WooCommerce\Templates
 * @version 3.9.0
 */

use App\Helpers\GlobalHelper;

if (!defined('ABSPATH')) {
  exit;
}

if ($related_products) : ?>

<section class="related products">

    <?php if (GlobalHelper::isWoocommercePage()) :
    $heading = apply_filters(
      'woocommerce_product_related_products_heading',
      bcn_pll('Découvrez également', 'woocommerce')
    );

  if ($heading || $title_bloc) : ?>
    <h{{ $title_style ? $title_style : 2 }} class="title-module title-section-{{ $title_style ? $title_style : '4' }} align-{!! $title_align ?? 'center' !!}">{{ $title_bloc }}</h{{ $title_style ? $title_style : 2 }}>
  <?php endif; ?>
  <?php endif; ?>

    <?php woocommerce_product_loop_start(); ?>

    <?php foreach ($related_products as $related_product) :
    $post_object = get_post($related_product->get_id());
    setup_postdata($GLOBALS['post'] = $post_object);
    ?>

  <li <?php wc_product_class('', $related_product); ?>>
    <a href="<?php the_permalink(); ?>">
        <?php do_action('woocommerce_before_shop_loop_item'); ?>

      <div class="illus-wrapper">
          <?php do_action('woocommerce_before_shop_loop_item_title'); ?>
        <div class="overlay">
          <span class="icon" aria-hidden="false"><?= GlobalHelper::displaySvg('eye.svg') ?></span>
            <?= bcn_pll('En savoir plus') ?>
        </div>
      </div>

        <?php
        do_action('woocommerce_shop_loop_item_title');
        do_action('woocommerce_after_shop_loop_item_title');

        if (defined('IS_COMMERCIAL') && IS_COMMERCIAL) {
          do_action('woocommerce_after_shop_loop_item');
        } else {
          echo "<span class='fake-link'></span>";
        }
        ?>
    </a>
  </li>

  <?php endforeach; ?>

    <?php woocommerce_product_loop_end(); ?>

</section>

<?php endif;

wp_reset_postdata();