<?php

use App\Helpers\GlobalHelper;
use App\Taxonomy\TaxoNewsCategory;

$taxoSlug = new TaxoNewsCategory();
if (isset($display_posts)) {
  if (($display_posts == '1') || ($display_posts == '2')) {
    $img_size = 'module-news-slider';
  } else {
    $img_size = 'module-gallery-fixe';
  }
} elseif (isset($k)) {
  if ($k = 0) {
    $img_size = 'module-news-slider';
  } else {
    $img_size = 'module-gallery-fixe';
  }
} else {
  $img_size = '';
}


if (isset($post) && is_array($post)) {
  // $image_url = GlobalHelper::getImageOrReplacement($img_size, $post['id'])['url'];
  $image_url = $post['image'];
  $image_alt = GlobalHelper::getImageOrReplacement('', $post['id'])['alt'];
  $category = $post['rubrique'];
  $title = $post['title'];
  $date = GlobalHelper::getFrenchDate($post['created']);
  $url = home_url('/actualites/weblex' . $urlWeblex);

  $description = get_the_excerpt($post['id']);
} else {
  $post = get_post($pid);
  $image_url = GlobalHelper::getImageOrReplacement($img_size, $post->ID)['url'];
  $image_alt = GlobalHelper::getImageOrReplacement('', $post->ID)['alt'];
  $category = GlobalHelper::getTerms($pid, $taxoSlug->getSlug());
  $title = $post->post_title;
  $date = GlobalHelper::getFrenchDate($post->post_date, 'j/m/Y');
  $url = get_permalink($post->ID);
  $description = get_the_excerpt($post->ID);
}

?>
<div class="swiper-slide item">
  <a href="<?= $url ?>" class="link">
    <div class="illus-wrapper">
      <img src="<?= esc_url($image_url) ?>" alt="<?= esc_attr($image_alt) ?>" class="illus" no-lazy>
      <div class="overlay">
        <span class="icon" aria-hidden="false"><?= GlobalHelper::displaySvg('eye.svg') ?></span>
        Lire l'actualité
      </div>
    </div>
    <div class="desc">
      <p class="category"><?= $category ?></p>
      <h3 class="title title-section-3"><?= $title ?></h3>
      <?php if (isset($content['display_posts']) && $content['display_posts'] == 1 || is_archive()): ?>
        <div class="editor txt">
          <?= nl2br($description) ?>
        </div>
      <?php endif; ?>
      <div class="btn-wrapper">
        <span class="fake-link btn btn-tertiary color-primary">Lire l'actualité</span>
      </div>
      <time class="date"><?= $date ?></time>
    </div>
  </a>
</div>