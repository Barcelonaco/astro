@php
  use App\Helpers\GlobalHelper;

    if (!empty($backgroundImage)) {
        if(isset($reusable_bloc) && !empty($reusable_bloc)) {
            $background_image = GlobalHelper::displayBackground($backgroundImage['url']);
        } else {
            $background_image = 'background-image: url('. e($backgroundImage['url']) .')';
        }
    }

  if (isset($columns) && $columns == 'module-in-column') {
    $id_bloc = '';
  }
@endphp

<div id="{{ $id_bloc }}" class="module module-images-slider {{isset($columns) ? '' : $classes }}">

  @if (!empty($backgroundImage) && !isset($columns))
    <div class="background"
      style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
    </div>
  @endif

  @if (!empty($images))

    <div class="container-large container-1">

      @if (!isset($columns))
          @include('components.bloc-title-module', [
              'title_bloc' => $title_bloc,
              'title_style' => $title_style,
              'title_align' => $title_align,
          ])
      @endif

      <div class="slider-wrapper">
        <div class="swiper slider js_images-slider">
          <div class="swiper-wrapper">
            @foreach ($images as $slide)
              <div class="swiper-slide item {{ !empty($slide['has_desc']) ? 'has-desc' : 'no-desc' }}">
                <div class="illus-wrapper">
                  <img src="{{ e($slide['image_url'] ?? '') }}" alt="{{ e($slide['image_alt'] ?? '') }}" class="illus">
                </div>
                @if (!empty($slide['has_desc']))
                  <div class="container-large container-2">
                    <div class="desc">
                      @if (!empty($slide['legend']))
                        <h3 class="title title-section-3">{!! e($slide['legend']) !!}</h3>
                      @endif
                      @if (!empty($slide['text']))
                        <div class="txt editor">
                          <p>{!! nl2br(e($slide['text'])) !!}</p>
                        </div>{{-- /.txt --}}
                      @endif
                      @if (!empty($slide['link_url']))
                        <div class="btn-wrapper">
                          <a href="{{ e($slide['link_url']) }}" class="btn btn-primary"
                            target="{{ e($slide['link_target'] ?? '_self') }}">
                            {!!  e($slide['link_title'] ?? 'Voir plus') !!}
                          </a>
                          @if (!empty($slide['link2']))
                            <a href="{{ $slide['link2']['url'] }}" class="btn btn-secondary"
                              target="{{ !empty($slide['link2']['target']) ? $slide['link2']['target'] : '_self' }}">
                              {{ $slide['link2']['title'] }}
                            </a>
                          @endif
                        </div>{{-- /.btn-wrapper --}}
                      @endif
                    </div>{{-- /.desc --}}
                  </div>{{-- /.container-large --}}
                @endif
              </div>{{-- /.item --}}
            @endforeach
          </div>{{-- /.swipper-wrapper --}}
        </div>{{-- /.swipper --}}
        <button type="button" class="slider-navigation prev"></button>
        <button type="button" class="slider-navigation next"></button>
        <div class="slider-pagination js_images-slider-pagination"></div>
      </div>{{-- /.slider-wrapper --}}
    </div>{{-- /.container-large --}}
  @endif
</div>{{-- /.module-image-slider --}}
