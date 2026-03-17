<?php

use App\Helpers\GlobalHelper;

$pid = $post->ID;
$image = GlobalHelper::getImageOrReplacement('module-gallery-fixe', $post->ID);
?>

<div class="swiper-slide item">
  <a href="<?= get_permalink($pid) ?>" class="link" target="_blank">
    <div class="illus-wrapper">
      <img src="<?= $image['url'] ?>" alt="<?= $image['alt'] ?>" class="illus">
      <div class="overlay">
        <span class="icon" aria-hidden="false"><?= GlobalHelper::displaySvg('eye.svg') ?></span>
        <?= bcn_pll('Voir') ?>
      </div>
    </div>
    <div class="desc">
      <h3 class="title title-section-3"><?= $post->post_title ?></h3>
      <div class="editor txt">
        <?= nl2br(get_the_excerpt($pid)) ?>
      </div>
      <div class="btn-wrapper">
        <span class="fake-link btn btn-tertiary color-primary"><?= bcn_pll('Lire l\'article') ?></span>
      </div>
      <time class="date"><?= GlobalHelper::getFrenchDate($post->post_date, 'j/m/Y') ?></time>
    </div><!-- /.desc -->
  </a><!-- /.link -->
</div><!-- /.item -->
