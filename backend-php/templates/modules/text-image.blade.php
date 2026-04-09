@php
    use App\Helpers\GlobalHelper;
    use App\Helpers\CookieHelper;

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

<div id="{{ $id_bloc }}"
    class="module module-text-image{{ isset($columns) ? '' : ' ' . $classes }}{{ isset($customClasses) ? ' ' . $customClasses : '' }}">

    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif

    <div class="container">
        <div class="cols-wrapper {{ $placement }} text-{{ $module['text_width']}} {{ $module['media_ratio'] }}">
            <div class="col col-1">

                @if (!$module['media_choice'] || $module['media_choice'] == 0)
                    <div class="video-wrapper {{ $module['media_ratio'] }} js_show-content">
                        @if (!empty($module['preview']) && $module['video_src'] !== 'mp4')
                            @if ($module['preview']['type'] == 'image')
                                <img src="{{ $module['preview']['sizes']['banner'] }}" alt="{{ $module['preview']['alt'] }}"
                                    class="illus-video">
                            @elseif ($module['preview']['type'] == 'video')
                                <video class="background-video" autoplay loop muted playsinline>
                                    <source src="{{ $module['preview']['url'] }}" type="video/mp4">
                                </video>
                            @endif
                        @elseif ($module['video_src'] === 'youtube' && $module['youtube_link'])
                            <img src="https://img.youtube.com/vi/{{ GlobalHelper::getVideoID($module['youtube_link'], 1) }}/maxresdefault.jpg"
                                alt="" class="illus-video">
                        @endif

                        @if ($module['video_src'] === 'youtube' && $module['youtube_link'])
                            <button type="button" class="btn js_btn-video"
                                data-src="{{ GlobalHelper::getVideoID($module['youtube_link'], 1) }}">
                                <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('play.svg') !!}</span>
                                <span class="txt">
                                    {{ bcn_pll('Lire la vidéo') }}
                                </span>
                            </button>
                            <iframe
                                src="https://www.youtube.com/embed/{{ GlobalHelper::getVideoID($module['youtube_link'], 1) }}"
                                frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
                        @elseif ($module['video_src'] === 'mp4' && $module['video'])
                            <video class="video" autoplay loop muted playsinline>
                                <source src="{{ $module['video']['url'] }}" type="video/mp4">
                            </video>
                        @elseif ($module['video_src'] === 'vimeo' && $module['vimeo_link'])
                            <button type="button" class="btn js_btn-video"
                                data-src-vimeo="{{ GlobalHelper::getVideoID($module['vimeo_link'], 2) }}">
                                <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('play.svg') !!}</span>
                                <span class="txt">
                                    {{ bcn_pll('Lire la vidéo') }}
                                </span>
                            </button>
                            <iframe
                                src="https://player.vimeo.com/video/{{ GlobalHelper::getVideoID($module['vimeo_link'], 2) }}"
                                frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
                        @elseif ($module['video_src'] === 'dailymotion' && $module['dailymotion_link'])
                            <button type="button" class="btn js_btn-video"
                                data-src-dailymotion="{{ GlobalHelper::getVideoID($module['dailymotion_link']) }}">
                                <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('play.svg') !!}</span>
                                <span class="txt">
                                    {{ bcn_pll('Lire la vidéo') }}
                                </span>
                            </button>
                            <iframe
                                src="https://geo.dailymotion.com/player.html?video={{ GlobalHelper::getVideoID($module['dailymotion_link'])}}"
                                allowfullscreen scrolling="no"
                                allow="encrypted-media; fullscreen; picture-in-picture; web-share;"></iframe>
                        @endif
                    </div>{{-- /.video --}}
                    <div class="no-cookies-wrapper js_show-cookies">
                        <div class="no-cookies">
                            <span class="no-cookies-icon"
                                aria-hidden="true">{!! GlobalHelper::displaySvg('cookies-light.svg') !!}</span>
                            <p class="no-cookies-txt">
                                {!! bcn_pll('Pour afficher ce contenu vous devez<br>accepter les cookies') !!}
                                <button type="button" data-cc="show-preferencesModal"
                                    aria-haspopup="dialog">publicitaires</button> puis <button type="button"
                                    onclick="location.href = location.pathname + '?t=' + Date.now()">recharger la
                                    page</button>.
                            </p>
                        </div>{{-- /.no-cookies --}}
                    </div>{{-- /.no-cookies-wrapper --}}
                @elseif ($module['media_choice'] && $module['media_choice'] == 1)
                    @php
                        $image = $module['image'] ?? null;
                        $img = GlobalHelper::getImageOrReplacement($module['media_ratio'] == 'square' ? 'square-large' : $module['media_ratio'], null, $image);
                    @endphp

                    <div class="illus-wrapper {{ $module['media_ratio'] }}">
                        <img src="{{ $img["url"] ?? $img }}" alt="{{ $img['alt'] ?? $img }}" class="illus">
                    </div>

                @endif
            </div>{{-- /.col-1 --}}

            <div class="col col-2 {{ $module['text_align'] ? 'text-align-' . $module['text_align'] : '' }}">
                <div class="txt editor">
                    @if (!empty($module['text']))
                        {!! str_replace(['&nbsp;', "\xC2\xA0"], ' ', $module['text']) !!}
                    @endif
                </div>{{-- /.txt --}}
                @if (!empty($module['cta']) && !empty($module['cta']['url']))
                    <div class="btn-wrapper align-{{ $link_align ? $link_align : 'left' }}">
                        <a href="{{ $module['cta']['url'] }}"
                            class="btn btn-{{ $link_style ? $link_style : 'tertiary' }} color-primary"
                            target="{{ !empty($module['cta']['target']) ? $module['cta']['target'] : '_self' }}">
                            {{ !empty($module['cta']['title']) ? $module['cta']['title'] : bcn_pll('En savoir plus') }}
                        </a>
                    </div>
                @endif
            </div>{{-- /.col-2 --}}
        </div>{{-- /.cols-wrapper --}}
    </div>{{-- /.container --}}
</div>{{-- /.module-text-image --}}