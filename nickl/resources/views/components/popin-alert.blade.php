@php

  use App\Helpers\GlobalHelper;
  use App\Helpers\ThemeHelper;
  $content = ThemeHelper::getAlertContent();

@endphp
<div class="popin-wrapper popin-alert-wrapper padding-top-small padding-bottom-small" data-popin="alert" style="display: none">
  <div class="popin {{ empty($content['alert_text']) ? 'has-no-text' : '' }} ">

    <div
      class="module module-text module-alert padding-top-small padding-bottom-small {{ $content['bg_img_alert'] ? 'has-background-image' : '' }} {{ $content['bloc_color_alert'] }} {{ $content['is_small_marged_alert'] ? 'padding-small' : '' }}">

      <button type="button" class="btn-close js_close-popin js_close-popin-alert"
              title="{{ bcn_pll('Fermer la popin') }}">
        <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('close.svg') !!}</span>
      </button>

      @if (!empty($content['bg_img_alert']))
        <div class="background"
             style="background-image: url('{{ $content['bg_img_alert']['sizes']['banner'] }}');
                     @if (!empty($content['alert_text']))
                      @if ($content['bg_img_alert'] && $content['bg_opacity_alert'])
                       {{ 'opacity: ' . ($content['bg_opacity_alert'] / 100) }}
                        @endif
                      @else
                        {{ 'opacity: 1' }}
                      @endif
                      "></div>
      @endif

      <div class="container">
        <div class="txt editor">
          {!! $content['alert_text'] !!}
        </div>{{-- /.txt --}}
        @if (!empty($content['alert_cta']) && !empty($content['alert_cta']['url']))
          <div class="btn-wrapper js_close-popin">
            <a href="{{ $content['alert_cta']['url'] }}"
               class="btn btn-primary color-primary"
               target="{{ !empty($content['alert_cta']['target']) ? $content['alert_cta']['target'] : '_self' }}">
              {{ !empty($content['alert_cta']['title']) ? $content['alert_cta']['title'] : bcn_pll('En savoir plus') }}
            </a>
            @if (!empty($content['alert_cta2']) && !empty($content['alert_cta2']['url']))
              <a href="{{ $content['alert_cta2']['url'] }}"
                 class="btn btn-secondary color-primary"
                 target="{{ !empty($content['alert_cta2']['target']) ? $content['alert_cta2']['target'] : '_self' }}">
                {{ !empty($content['alert_cta2']['title']) ? $content['alert_cta2']['title'] : bcn_pll('En savoir plus') }}
              </a>
            @endif
          </div>
        @endif
      </div>{{-- /.container --}}

    </div>{{-- /.module-text --}}

  </div>{{-- /.popin --}}
</div>{{-- /.popin-wrapper --}}
