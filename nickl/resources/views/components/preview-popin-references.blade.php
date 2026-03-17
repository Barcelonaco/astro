@php
  use App\Helpers\GlobalHelper;
  use App\Taxonomy\TaxoReferencesCategory;

  $taxoSlug = new TaxoReferencesCategory();
  $photos = get_field('photos', $pid) ?? [];

@endphp

<div class="popin-wrapper popin-references-wrapper" style="display: none;" data-popin="reference-{{ esc_attr($pid) }}">
  <div class="popin">
    <button type="button" class="btn-close js_close-popin" title="{{ esc_attr(bcn_pll('Fermer la popin')) }}">
      <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('close.svg') !!}</span>
    </button>

    <div class="cols-wrapper head">
      <div class="col col-1">
        <div class="slider-wrapper">
          <div class="swiper slider js_references-popin-slider">
            <div class="swiper-wrapper">
              @foreach($photos as $photo)
                @if(is_array($photo))
                  @php
                    $photo_src = $photo['url'];
                    $photo_url = $photo_src ? esc_url($photo_src) : '';
                    $photo_alt = esc_attr($photo['alt']);
                  @endphp
                  <div class="swiper-slide item">
                    <div class="illus-wrapper">
                      <img src="{{ $photo_url }}" alt="{{ $photo_alt }}" class="illus">
                    </div>
                  </div>
                @endif
              @endforeach
            </div>
            <button type="button" class="slider-navigation prev js_references-popin-slider-btn-prev"></button>
            <button type="button" class="slider-navigation next js_references-popin-slider-btn-next"></button>
            <div class="slider-pagination js_references-popin-slider-pagination"></div>
          </div>
        </div>
      </div>

      <div class="col col-2">
        @if ($terms = GlobalHelper::getTerms($pid, $taxoSlug->getSlug()))
          <p class="category">{{ $terms }}</p>
        @endif
        <p class="title title-section-3">{!! get_the_title($pid) !!}</p>
        @if ($customerName = get_field('customer_name', $pid))
          <p class="name">{{ $customerName }}</p>
        @endif
        @if ($text = get_field('text', $pid))
          <div class="txt editor">{!! wp_kses_post($text) !!}</div>
        @endif
          @if (($link = get_field('link', $pid)) || (get_field('ref_display', 'options_references') === 'both'))
            <div class="btn-wrapper">
              @if (!empty($link['url']))
                <a href="{{ esc_url($link['url']) }}" class="btn btn-primary" target="{{ !empty($link['target']) ? esc_attr($link['target']) : '_self' }}">
                  {{ $link['title'] }}
                </a>
              @endif
              @if (get_field('ref_display', 'options_references') === 'both')
                <a href="{{ esc_url(get_permalink($pid)) }}" class="btn @if(!empty($link['url'])) btn-secondary @else btn-primary @endif">En savoir plus</a>
              @endif
            </div>
          @endif
      </div>
    </div>
  </div>
</div>
