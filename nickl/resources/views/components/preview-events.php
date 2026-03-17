<?php
use App\Helpers\GlobalHelper;
use App\Helpers\EventsHelper;
use App\Taxonomy\TaxoEventsType;

$taxoSlug = new TaxoEventsType();
$dateStart = get_field('start_date', $post->ID);
$isSticky = get_field('is_sticky', $post->ID);
$soldOut = get_field('sold_out', $post->ID);
$terms = GlobalHelper::getTerms($post->ID, $taxoSlug->getSlug());
$eventLocation = EventsHelper::getEventLocation($post->ID);

// Déterminer si le post a un "banner"
$banner = (!empty($isSticky) || !empty($soldOut)) ? 1 : 0;
?>

<div class="swiper-slide item <?= $banner ? 'vedette' : '' ?>">
  <a href="<?= get_permalink($post->ID) ?>" class="link">
    <?php if (!empty($banner)): ?>
      <?php if ($isSticky): ?>
        <span class="vedette-tag">
                        <?= GlobalHelper::displaySvg('star.svg') ?> <?= bcn_pll('En vedette') ?>
                    </span>
      <?php elseif ($soldOut || ($soldOut && $isSticky)): ?>
        <span class="vedette-tag">
          <?= GlobalHelper::displaySvg('cross-circle.svg') ?> <?= bcn_pll('Complet') ?>
        </span>
      <?php endif; ?>
    <?php endif; ?>
    <div class="illus-wrapper">
      <img src="<?= esc_url(GlobalHelper::getImageOrReplacement($imagesRatio ? 'a4' : 'module-gallery-fixe', $post->ID)['url']) ?>"
           alt="<?= esc_attr(get_post_meta(get_post_thumbnail_id($post->ID), '_wp_attachment_image_alt', true)) ?>"
           no-lazy class="illus">



      <div class="overlay">
        <span class="icon" aria-hidden="false"><?= GlobalHelper::displaySvg('eye.svg') ?></span>
        <?= bcn_pll('Agrandir') ?>
      </div>
    </div>

    <div class="desc">
      <?php if (!empty($terms)): ?>
      <span class="category"><?= esc_html($terms) ?></span>
      <?php endif; ?>
      <h3 class="title"><?= esc_html($post->post_title) ?></h3>
      <p class="date"><?= esc_html(EventsHelper::getEventDate($post->ID)) ?></p>

      <?php if (!empty($eventLocation)): ?>
      <p class="location">
          <?= GlobalHelper::displaySvg('location.svg') ?>
          <?= esc_html($eventLocation) ?>
      </p>
      <?php endif; ?>
    </div>
  </a>
</div>
