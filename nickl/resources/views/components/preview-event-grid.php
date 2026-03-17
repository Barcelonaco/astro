<?php

use App\Helpers\EventsHelper as Event;
use App\Helpers\GlobalHelper;
use App\Taxonomy\TaxoEventsType;

$term = $_POST['term'] ?? null;

if ($term) {
  $posts = Event::getEventsFiltered(-1, $term);
} else {
  $posts = Event::getEventsFiltered(-1);
}

$taxoSlug = new TaxoEventsType();
$pid = $post->ID;
$dateStart = get_field('start_date', $pid);
$isSticky = get_field('is_sticky', $pid);
$soldOut = get_field('sold_out', $pid);
$dateMonthShort = GlobalHelper::getFrenchDate($dateStart, 'M');
$banner = (!empty($isSticky) || !empty($soldOut)) ? 1 : 0;
$point = in_array(GlobalHelper::getFrenchDate($dateStart, 'm'), ['03', '05', '06', '08']) ? '' : '.';
$prevId = isset($posts['posts'][$k - 1]) ? $posts['posts'][$k - 1]->ID : null;

//var_dump(empty($prevId));
if ((!empty($prevId)) && (GlobalHelper::getFrenchDate(get_field('start_date', $prevId), 'm') !== GlobalHelper::getFrenchDate($dateStart, 'm'))) {
  echo '</div>';
}

if ($k == 0 || empty($prevId) || GlobalHelper::getFrenchDate(get_field('start_date', $prevId), 'm') !== GlobalHelper::getFrenchDate($dateStart, 'm')) {
  // Ouvrir une nouvelle liste de mois seulement si c'est le premier événement ou si le mois change

  echo '<div class="month-list">';
  echo '<div class="item date-month"><span>' . ucfirst(GlobalHelper::getFrenchDate($dateStart, 'F Y')) . '</span><hr></div>';
}
?>

<li class="item <?= !empty($banner) ? 'vedette' : null ?>">
  <div class="date-list">
    <p class="date-day"><?= ucfirst(GlobalHelper::getFrenchDate($dateStart, 'D')) ?><span class="show-list">.</span></p>
    <p class="date-num"><?= GlobalHelper::getFrenchDate($dateStart, 'd') ?></p>
  </div>
  <a class="link" href="<?= get_permalink($pid) ?>"></a>
  <div class="illus-wrapper">
    <img src="<?= GlobalHelper::getImageOrReplacement($imagesRatio ? 'a4' : 'module-gallery-fixe', $pid)['url'] ?>"
         alt="<?= get_post_meta(get_post_thumbnail_id($pid), '_wp_attachment_image_alt', true) ?>" class="illus">
    <div class="overlay">
      <span class="icon" aria-hidden="false"><?= GlobalHelper::displaySvg('eye.svg') ?></span>
      <?= bcn_pll('En savoir plus') ?>
    </div>
    <div class="date-grid">
      <p class="date-short">
        <?= ucfirst(GlobalHelper::getFrenchDate($dateStart, 'D')) ?>
        <?= GlobalHelper::getFrenchDate($dateStart, 'd') ?>
        <?= $dateMonthShort ?><?= $point ?>
      </p>
    </div>
  </div>
  <div class="desc">
    <div class="desc-container">
      <?php if (!empty($banner)) { ?>
        <div class="vedette-tag">
          <?php if ($soldOut) { ?>
            <span class="icon" aria-hidden="false"><?= GlobalHelper::displaySvg('cross-circle.svg') ?></span>
            <?= bcn_pll('Complet') ?>
          <?php } elseif ($isSticky) { ?>
            <span class="icon" aria-hidden="false"><?= GlobalHelper::displaySvg('star.svg') ?></span>
            <?= bcn_pll('En vedette') ?>
          <?php } ?>
          <div class="triangle">
            <?= GlobalHelper::displaySvg('triangle.svg') ?>
          </div>
        </div>
      <?php } ?>
      <span class="category"><?= GlobalHelper::getTerms($pid, $taxoSlug->getSlug()) ?></span>
      <h3 class="title"><?= $post->post_title ?></h3>
      <p class="date"><?= Event::getEventDate($pid) ?></p>
      <?php if ($location = get_field('location', $pid)) { ?>
        <p class="location">
          <?= GlobalHelper::displaySvg('location.svg') ?>
          <?= Event::getEventLocation($pid) ?>
        </p>
      <?php } ?>
      <p class="description"><?= nl2br(get_field('desc', $pid)) ?></p>
      <?php if ($price = get_field('price', $pid)) { ?>
        <p class="price"><?= $price ?></p>
      <?php } ?>
    </div>
  </div>
</li>