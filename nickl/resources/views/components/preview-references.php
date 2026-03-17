<?php
use App\Helpers\GlobalHelper;
use App\Taxonomy\TaxoReferencesCategory;

$taxoSlug = new TaxoReferencesCategory();
$photos = get_field('photos', $pid);
$photo_url = ''; // Valeur par défaut

if (!empty($photos)) {
  if (is_string($photos)) {
    $photos = maybe_unserialize($photos);
  }

  if (is_array($photos) && isset($photos[0])) {
    $photo_id = is_array($photos[0]) ? $photos[0]['ID'] ?? null : $photos[0];

    if ($photo_id) {
      $photo_src = wp_get_attachment_image_src($photo_id, 'module-references');
      $photo_url = $photo_src ? $photo_src[0] : '';
    }
  }
}

$taxoSlug = new TaxoReferencesCategory();
?>

<li class="item">
  <div class="slider-wrapper">
    <div class="swiper slider js_references-slider">
      <div class="swiper-wrapper">
        <?php
        $photos_field = get_field('photos', $pid);

        if (!empty($photos_field) && is_array($photos_field)) :
          foreach ($photos_field as $photo_id) :
            ?>
            <div class="swiper-slide sub-item">
              <?php if (get_field('ref_display', 'options_references') === 'page') : ?>
              <a href="<?= get_permalink($pid) ?>" class="link illus-wrapper">
                <?php else : ?>
                <button type="button" class="illus-wrapper js_open-popin" data-popin="reference-<?= $pid ?>">
                  <?php endif; 
                  ?>
                  <img src="<?= esc_url($photo_id['url']) ?>" alt="<?= esc_attr($photo_id['alt']) ?>" class="illus">
                  <div class="overlay">
                    <span class="icon" aria-hidden="false"><?= GlobalHelper::displaySvg('eye.svg') ?></span>
                      Découvrir
                  </div>
                  <?php if (get_field('ref_display', 'options_references') === 'page') : ?>
              </a>
            <?php else : ?>
              </button>
            <?php endif; ?>
            </div><!-- /.sub-item -->
          <?php
          endforeach;
        endif;
        ?>
      </div><!-- /.swiper-wrapper -->
      <button type="button" class="slider-navigation prev js_references-slider-btn-prev"></button>
      <button type="button" class="slider-navigation next js_references-slider-btn-next"></button>
      <div class="slider-pagination js_references-slider-pagination"></div>
    </div><!-- /.slider -->
  </div><!-- /.slider-wrapper -->

  <?php if (get_field('ref_display', 'options_references') === 'page'): ?>
  <a href="<?= get_permalink($pid) ?>" class="link">
    <?php else: ?>
    <button type="button" class="link js_open-popin" data-popin="reference-<?= $pid ?>">
      <?php endif; ?>
    <?php if ($terms = GlobalHelper::getTerms($pid, $taxoSlug->getSlug())) { ?>
    <p class="category"><?= esc_html($terms) ?></p>
    <?php } ?>
    <h3 class="title title-section-3"><?= get_the_title($pid) ?></h3>
      <?php if ($customerName = get_field('customer_name', $pid)): ?>
        <p class="name"><?= $customerName ?></p>
      <?php endif; ?>
    <?php if (get_field('ref_display', 'options_references') === 'page'): ?>
  </a><!-- /.link -->
<?php else: ?>
  </button><!-- /.link -->
<?php endif; ?>

</li><!-- /.item -->