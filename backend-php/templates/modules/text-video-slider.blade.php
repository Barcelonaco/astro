@php
    use App\Helpers\CookieHelper as Cookie;
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

<div id="{{ $id_bloc }}" class="module module-text-video-slider {{isset($columns) ? '' : $classes }}">

    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif

    <div class="slider-wrapper">
        <div class="swiper slider js_text-video-slider">
            <div class="swiper-wrapper">
                @foreach($slider as $slide)

                    <div class="swiper-slide item">
                        <div class="container-large">
                            <div class="cols-wrapper">

                                <div class="col col-1">
                                    @if (!$h1_in_header && $slide['is_h1'])
                                        <h1 class="title title-section-2">{!! $slide['title'] !!} </h1>
                                    @else
                                        <h2 class="title title-section-2">{!! $slide['title'] !!}</h2>
                                    @endif
                                    @if (!empty($slide['desc']))
                                        <div class="txt editor">
                                            {!! $slide['desc'] !!}
                                        </div>{{-- /.txt --}}
                                    @endif
                                    @if (!empty($slide['link_1']) || !empty($slide['link_2']))
                                        <div class="btn-wrapper">
                                            @if (!empty($slide['link_1']))
                                                <a href="{{ $slide['link_1']['url'] }}"
                                                    target="{{ !empty($slide['link_1']['target']) ? $slide['link_1']['target'] : '_self' }}"
                                                    class="btn btn-primary">{!! !empty($slide['link_1']['title']) ? $slide['link_1']['title'] : bcn_pll('En savoir plus')!!}</a>
                                            @endif
                                            @if (!empty($slide['link_2']))

                                                <a href="{{ $slide['link_2']['url'] }}"
                                                    target="{{ !empty($slide['link_2']['target']) ? $slide['link_2']['target'] : '_self' }}"
                                                    class="btn btn-secondary color-primary-full">{!! !empty($slide['link_2']['title']) ? $slide['link_2']['title'] : bcn_pll('En savoir plus')!!}</a>
                                            @endif
                                        </div>{{-- /.btn-wrapper --}}
                                    @endif
                                </div>{{-- /.col-1 --}}
                                @if (count($module['slider']) > 1)
                                    <div class="slider-navigation-mobile-wrapper">
                                        <button type="button"
                                            class="slider-navigation prev js_text-video-slider-btn-prev"></button>
                                        <button type="button"
                                            class="slider-navigation next js_text-video-slider-btn-next"></button>
                                    </div>
                                @endif
                                <div class="col col-2">
                                    @if (Cookie::isCookieAccepted('advertising') && !empty($slide['video']))
                                        <div class="video">
                                            @if (!empty($slide['preview']))
                                                @if ($slide['preview']['type'] == 'image')
                                                    <img src="{{ $slide['preview']['url'] }}" alt="{{ $slide['preview']['alt'] }}"
                                                        class="illus">
                                                @elseif ($slide['preview']['type'] == 'video')
                                                    <video class="background-video js-lazy-video" autoplay loop muted playsinline>
                                                        <source src="{{ $slide['preview']['url'] }}" type="video/mp4">
                                                    </video>
                                                @endif
                                            @endif

                                            <button type="button" class="btn js_btn-video"
                                                data-src="{{ GlobalHelper::getYoutubeID($slide['video']) }}">
                                                <span class="icon"
                                                    aria-hidden="true">{!! GlobalHelper::displaySvg('play.svg') !!}</span>
                                                <span class="txt">
                                                    {{ bcn_pll('Lire la vidéo') }}
                                                </span>
                                            </button>
                                            <iframe src="" frameborder="0"></iframe>
                                        </div>{{-- /.video --}}
                                    @elseif (empty($slide['video']) && !empty($slide['preview']))
                                        <div class="video">
                                            @if ($slide['preview']['type'] == 'image')
                                                <img src="{{ $slide['preview']['url'] }}" alt="{{ $slide['preview']['alt'] }}"
                                                    class="illus">
                                            @elseif ($slide['preview']['type'] == 'video')
                                                <video class="background-video js-lazy-video" autoplay loop muted playsinline>
                                                    <source src="{{ $slide['preview']['url'] }}" type="video/mp4">
                                                </video>
                                            @endif
                                        </div>{{-- /.video --}}
                                    @else
                                        @include('components.no-cookies', ['cat' => 'Publicitaires'])
                                    @endif
                                </div>{{-- /.col-2 --}}

                                @if($module['discover_btn'])
                                    <button type="button"
                                        class="btn-scroll btn-scroll-down js_btn-scroll-down">{{ bcn_pll('Découvrir') }}</button>
                                @endif

                            </div>{{-- /.cols-wrapper --}}
                        </div>{{-- /.container-large --}}
                    </div>{{-- /.item --}}

                @endforeach

            </div>{{-- /.swiper-wrapper --}}
        </div>{{-- /.slider --}}

        @if (count($module['slider']) > 1)
            <button type="button" class="slider-navigation prev"></button>
            <button type="button" class="slider-navigation next"></button>
        @endif

    </div>{{-- /.sldier-wrapper --}}
</div>{{-- /.module-text-video-slider --}}