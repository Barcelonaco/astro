@php
  use App\Helpers\ThemeHelper;
  use App\Helpers\GlobalHelper;
  use App\Helpers\ReferencesHelper;
  use App\Posttype\CptReferences;use App\Taxonomy\TaxoReferencesCategory;
  $pid = get_the_ID();  
  $taxoSlug = new TaxoReferencesCategory();
  $data = ReferencesHelper::getRefs(null, 0, -1);
  $h1InHeader = get_field('h1_in_header', 'options_references');
  $showBreadcrumb = get_field('show_breadcrumb', 'options') && function_exists('yoast_breadcrumb');
  $showShareBtn = get_field('pages_share_btn', 'options') && !get_field('share_btn_position', 'options');
@endphp

@if (get_field('ref_display', 'options_references') !== 'popup')
  @extends('layouts.app')
  @section('content')
    <main id="main" class="main-page page-single-refs" role="main">
      <section>
        @if ($showBreadcrumb || $showShareBtn)
          <div class="container sub-header">
            @if ($showBreadcrumb)
              @include('components.breadcrumb')
            @endif

            @if ($showShareBtn)
              @include('modules.share', ['share_btn_position' => 'top'])
            @endif
          </div>
        @endif
        <article>
          <div class="container-large">
            <div class="cols-wrapper">
              <div class="col col-1">
                <div class="slider-wrapper">
                  <div class="swiper slider js_references-slider">
                    <div class="swiper-wrapper">

                      @foreach (get_field('photos', $pid) as $photo)
                        <div class="swiper-slide sub-item">
                          <div class="illus-wrapper">
                            <img src="<?= GlobalHelper::getImageOrReplacement('', $photo) ?>"
                                 alt="<?= get_post_meta($photo, '_wp_attachment_image_alt', TRUE)?>"
                                 class="illus">
                          </div>
                        </div><!-- /.item -->
                      @endforeach

                    </div><!-- /.swiper-wrapper -->
                    <button type="button"
                            class="slider-navigation prev js_references-popin-slider-btn-prev"></button>
                    <button type="button"
                            class="slider-navigation next js_references-popin-slider-btn-next"></button>
                    <div class="slider-pagination js_references-slider-pagination"></div>
                  </div><!-- /.slider -->
                </div><!-- /.slider-wrapper -->
              </div><!-- /.col-1 -->

              <div class="col col-2">
                @if ($terms = GlobalHelper::getTerms($pid, $taxoSlug->getSlug()))
                  <p class="category"><?= $terms ?></p>
                @endif
                @if ($h1InHeader === 'yes')
                  <h1 class="title title-section-1">{!! ThemeHelper::title($pid) !!}</h1>
                @else
                  <p class="title title-section-1">{!! ThemeHelper::title($pid) !!}</p>
                @endif
                @if ($customerName = get_field('customer_name', $pid))
                  <p class="name"><?= $customerName ?></p>
                @endif
                  @if ($text_ref = get_field('text', $pid))
                  <div class="txt editor">{!!$text_ref!!}</div><!-- /.txt -->
                  @endif
                @if ($link = get_field('link', $pid))
                  @if (!empty($link[ 'url' ]))
                    <div class="btn-wrapper">
                      <a href="<?= $link[ 'url' ] ?>" class="btn btn-primary"
                         target="<?= !empty($link[ 'target' ]) ? $link[ 'target' ] : '_self' ?>"><?= $link['title'] ?></a>
                    </div>
                  @endif
                @endif
              </div><!-- /.col-2 -->
            </div><!-- /.cols-wrapper -->
          </div>{{-- /.container-large --}}
          
          @php
            $modules = get_field('flexible_modules');
          @endphp

          @if(is_array($modules) && count($modules) > 0)
            @foreach($modules as $module)
              @if(isset($module['acf_fc_layout']) && !empty($module['acf_fc_layout']) && ($module['is_visible'] ?? 'yes') !== 'no')
                @php
                  try {
                @endphp
                  @includeIf('modules.' . $module['acf_fc_layout'], ['h1_in_header' => get_field('h1_in_header'), 'content' => $module, 'module' => $module, 'number' => $loop->iteration])
                @php
                  } catch (\Throwable $e) {
                    if (defined('WP_DEBUG') && WP_DEBUG) {
                      echo '<!-- MODULE ERROR ['.$module['acf_fc_layout'].']: '.esc_html($e->getMessage()).' -->';
                      error_log('Module render error ['.$module['acf_fc_layout'].']: '.$e->getMessage().' in '.$e->getFile().':'.$e->getLine());
                    }
                  }
                @endphp
              @endif
            @endforeach
          @endif

        </article>

        @if (get_field('share_btn_position', 'options'))
          @include('modules.share', ['share_btn_position' => 'bottom'])
        @endif

      </section>
    </main>{{-- /.page-single-refs --}}
  @endsection
@else
  @php
    wp_redirect(get_post_type_archive_link($cptSlug->getSlug()));
  @endphp
@endif

<script>
  function adjustAlignment() {
  const wrapper = document.querySelector('.cols-wrapper');
  const imgCol = wrapper.querySelector('.col-1');
  const txtCol = wrapper.querySelector('.col-2');
  const img = imgCol.querySelector('.slider-wrapper');

  const imgHeight = img.offsetHeight;
  const txtHeight = txtCol.offsetHeight;

  if (imgHeight > txtHeight) {
    wrapper.style.alignItems = 'center'; // image plus haute
    imgCol.classList.remove('sticky'); 
  } else {
    imgCol.classList.add('sticky'); // image devient sticky au scroll
  }
}

// Exécuter au chargement et au redimensionnement
window.addEventListener('load', adjustAlignment);
window.addEventListener('resize', adjustAlignment);

</script>