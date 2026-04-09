@php
  use App\Helpers\GlobalHelper;

  $fields = [
    'hero_banner_align' => get_field('hero_banner_align'),
    'h1_in_header' => get_field('h1_in_header'),
    'hero_banner_height' => get_field('hero_banner_height'),
    'hero_banner_marquise' => get_field('hero_banner_marquise'),
  ];
@endphp

@if($isSlider)

  <div id="{{ isset($number) ? $number : 'section_0' }}" class="module module-hero mode-slider{{ $fields['hero_banner_marquise'] ? ' hero_banner_marquise' : '' }} {{ $seamlessMenu ? 'background-transparent' : '' }}{{ $fields['hero_banner_height'] ? ' medium' : '' }}">
    <div class="swiper slider {{ is_array($sliders) && count($sliders) > 1 ? 'js_slider-hero' : 'js_slider-hero' }}">
      <div class="swiper-wrapper">
        @if (is_array($sliders) && count($sliders) > 0)
          @foreach($sliders as $slide)
            @php
              $image = $slide['image'] ?? null;
              $img = GlobalHelper::getImageOrReplacement( 'banner' , null, $image);
              $cta1 = $slide['cta'];
              $cta2 = $slide['cta_2'];
              $hasDesc = !empty($slide['logo']) || !empty($slide['title']) || !empty($slide['catchphrase']) || !empty($cta1) || !empty($cta2);
            @endphp
            <div class="swiper-slide item {{ $hasDesc ? 'has-desc' : 'no-desc' }}">
              <div class="background">
                @if ($slide['is_image'])
                  <img id="hero-banner-img" src="{{ $img['url'] }}" alt="{{$img['alt']}}" class="illus desktop"  fetchpriority="high">
                  <img id="hero-banner-img" src="{{ !empty($slide['image_mobile']) ? $slide['image_mobile']['sizes']['banner-mobile'] : $slide['image']['sizes']['banner-mobile'] }}" alt="" class="illus mobile"  fetchpriority="high">
                @else
                  <video id="hero-banner-video js-lazy-video" class="video" autoplay playsinline muted loop controlslist="nodownload" preload="none" fetchpriority="high" >
                    <source src="{{ $slide['video']['url'] }}" type="video/mp4">
                  </video>
                @endif
              </div>
              <div class="container-large">
                <div class="desc{{ $fields['hero_banner_align'] ? ' align-'.$fields['hero_banner_align'] : '' }}">
                  @if (!empty($slide['logo']))
                    <div class="logo-wrapper {{ $slide['logo_size'] ?? 'size-m' }}">
                      <img src="{{ $slide['logo']['url'] }}" alt="{{ $slide['logo']['alt'] }}" class="logo">
                    </div>
                  @endif
                  @if (!empty($slide['title']))
                    <p class="title title-section-1">{{ $slide['title'] }}</p>
                  @endif
                  @if (!empty($slide['catchphrase']))
                    @if ($fields['h1_in_header'] == 'yes' && $loop->iteration == 1)
                      <h1 class="editor txt">{!! nl2br($slide['catchphrase']) !!}</h1>
                    @else
                      <div class="editor txt"><p>{!! nl2br($slide['catchphrase']) !!}</p></div>
                    @endif
                  @endif
                  @if ($cta1 || $cta2)
                    <div class="btn-wrapper">
                      @foreach([$cta1, $cta2] as $cta)
                        @if ($cta && !empty($cta['url']))
                          <a href="{{ $cta['url'] }}" class="btn {{ $loop->first ? 'btn-primary' : 'btn-secondary' }}" target="{{ $cta['target'] ?? '_self' }}">
                            {{ $cta['title'] }}
                          </a>
                        @endif
                      @endforeach
                    </div>
                  @endif
                </div>
              </div>
            </div>
          @endforeach
        @endif
      </div>
      @if (is_array($sliders) && count($sliders) > 0)
        <button type="button" class="slider-navigation prev js_slider-hero-btn-prev"></button>
        <button type="button" class="slider-navigation next js_slider-hero-btn-next"></button>
      @endif
    </div>
    @if (!$fields['hero_banner_height'])
      <button type="button" class="btn-scroll btn-scroll-down js_btn-scroll-down">{{ bcn_pll('Découvrir') }}</button>
    @endif
  </div>
@else

  <div id="{{ isset($number) ? $number : 'section_0' }}" class="module module-hero mode-list {{ $heroBgColor }}">
    <div class="container-large">
      <ul class="list">
        @foreach($blocks as $block)
          @php
            $hasDesc = !empty($block['logo']) || !empty($block['title']) || !empty($block['catchphrase']) || !empty($block['cta']) || !empty($block['cta_2']);
          @endphp
          <li class="item {{ $hasDesc ? 'has-desc' : 'no-desc' }}" role="article">
            <div class="link">
              <div class="background">
                <img src="{{ $block['image']['sizes']['module-hero-list'] }}" alt="" class="illus" loading="lazy">
              </div>
              <div class="desc">
                @if(!empty($block['logo']))
                  <div class="logo-wrapper">
                    <img src="{{ $block['logo']['url'] }}" alt="" class="logo">
                  </div>
                @endif
                @if (!empty($block['title']))
                  <p class="title title-section-2">{{ $block['title'] }}</p>
                @endif
                @if (!empty($block['catchphrase']))
                  <div class="editor txt">
                    @if ($fields['h1_in_header'] == 'yes' && $loop->iteration == 1)
                      <h1>{!! nl2br($block['catchphrase']) !!}</h1>
                    @else
                      <p>{!! nl2br($block['catchphrase']) !!}</p>
                    @endif
                  </div>
                @endif
                @if ($block['cta'] || $block['cta_2'])
                  <div class="btn-wrapper">
                    @foreach([$block['cta'], $block['cta_2']] as $cta)
                      @if ($cta && !empty($cta['url']))
                        <a href="{{ $cta['url'] }}" class="btn {{ $loop->first ? 'btn-primary' : 'btn-secondary' }}" target="{{ $cta['target'] ?? '_self' }}">
                          {{ $cta['title'] }}
                        </a>
                      @endif
                    @endforeach
                  </div>
                @endif
              </div>
            </div>
          </li>
        @endforeach
      </ul>
    </div>
  </div>
@endif