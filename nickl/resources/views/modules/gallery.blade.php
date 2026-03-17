@php
    use App\Helpers\GlobalHelper;

    if (!empty($backgroundImage)) {
        if(isset($reusable_bloc) && !empty($reusable_bloc)) {
            $background_image = GlobalHelper::displayBackground($backgroundImage['url']);
        } else {
            $background_image = 'background-image: url('. e($backgroundImage['url']) .')';
        }
    }

    if(isset($columns) && $columns == 'module-in-column'){
        $id_bloc = '';
    }
@endphp

<div id="{{ $id_bloc }}" class="module module-gallery {{isset($columns) ? '' : $classes }}">

    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif

    <div class="container{{ $options['width'] }}">

        @if (!isset($columns))
            @include('components.bloc-title-module', [
                'title_bloc' => $title_bloc,
                'title_style' => $title_style,
                'title_align' => $title_align,
            ])
        @endif

        <ul class="list {{ $options['nbr_column'] }} {{ $options['type_img'] }}">
            @php
                $sizes = match (true) {
                    $options['type_img'] == 'img-fluid' => 'module-gallery-fluid',
                    $options['type_img'] == 'img-fixe' && $options['nbr_column'] == 'columns-1' => 'banner',
                    $options['type_img'] == 'img-fixe' && $options['nbr_column'] == 'columns-2' => 'half',
                    default => 'module-gallery-fixe',
                };
            @endphp

            @foreach($module['list'] as $gallery)

                <li class="item">
                    <button type="button" class="link js_open-popin" data-popin="gallery-{{ $indexPopin }}"
                            data-slide="{{ $loop->iteration }}">
                        <div class="illus-wrapper">
                            @if ($options['type_img'] == 'img-fluid')
                                <img src="{{ $gallery['image']['sizes'][$sizes] }}" alt="{{ $gallery['image']['alt'] }}" class="illus" no-lazy>
                            @else
                                <img src="{{ $gallery['image']['sizes'][$sizes] }}" alt="{{ $gallery['image']['alt'] }}" class="illus">
                            @endif
                            <div class="overlay">
                                <span class="icon" aria-hidden="false">{!! GlobalHelper::displaySvg('eye.svg') !!}</span>
                                {{ bcn_pll('Agrandir') }}
                            </div>{{-- /.overlay --}}
                        </div>{{-- /.illus-wrapper --}}
                        @if (!empty($gallery['tag']) || !empty($gallery['titre']))
                            <div class="desc">
                                @if (!empty($gallery['tag']))
                                    <p class="category">{{ $gallery['tag'] }}</p>
                                @endif
                                @if (!empty($gallery['titre']))
                                    <h2 class="title title-section-3" data-text="{{ $gallery['titre'] }}">{{ $gallery['titre'] }}</h2>
                                @endif
                                @if (!empty($gallery['desc']))
                                    <div class="txt editor">
                                        <p>{!! nl2br($gallery['desc']) !!}</p>
                                    </div>{{-- /.txt --}}
                                @endif
                                <span class="fake-btn btn btn-tertiary">{{ bcn_pll('En savoir plus') }}</span>
                            </div>{{-- /.desc --}}
                        @endif
                    </button>{{-- /.link --}}
                </li>{{-- /.item --}}

            @endforeach

        </ul>{{-- /.list --}}

    </div>{{-- /.container-large --}}

    <div class="popin-wrapper popin-gallery-wrapper" style="display: none;" data-popin="gallery-{{ $indexPopin }}">
        <div class="popin">

            <button type="button" class="btn-close js_close-popin" title="{{ bcn_pll('Fermer la popin') }}">
                <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('close.svg') !!}</span>
            </button>

            <div class="module module-images-slider full-width no-padding">
                <div class="container-large container-1">
                    <div class="slider-wrapper">
                        <div class="swiper slider js_images-slider">
                            <div class="swiper-wrapper">

                                @foreach($module['list'] as $gallery)

                                    @if (!empty($gallery['titre']) || !empty($gallery['desc']) || (!empty($gallery['link']) && !empty($gallery['link']['url'])))
                                        <div class="swiper-slide item has-desc">
                                    @else
                                        <div class="swiper-slide item no-desc">
                                    @endif
                                        <div class="illus-wrapper">
                                            <img src="{{ $gallery['image']['url'] }}" alt="{{ $gallery['image']['alt'] }}" class="illus">
                                        </div>{{-- /.illus-wrapper --}}
                                        @if (!empty($gallery['titre']) || !empty($gallery['desc']) || (!empty($gallery['link']) && !empty($gallery['link']['url'])))
                                            <div class="container-large container-2">
                                                <div class="desc">
                                                    @if (!empty($gallery['titre']))
                                                        <p class="title title-section-3">{{ $gallery['titre'] }}</p>
                                                    @endif
                                                    @if (!empty($gallery['desc']))
                                                        <div class="txt editor">
                                                            <p>{!! nl2br($gallery['desc']) !!}</p>
                                                        </div>{{-- /.txt --}}
                                                    @endif
                                                    @if (!empty($gallery['link']) && !empty($gallery['link']['url']))
                                                        <div class="btn-wrapper">
                                                            <a href="{{ $gallery['link']['url'] }}" class="btn btn-primary"
                                                               target="{{ !empty($gallery['link']['target']) ? $gallery['link']['target'] : '_self' }}">{{ $gallery['link']['title'] }}</a>
                                                        </div>{{-- /.btn-wrapper --}}
                                                    @endif

                                                </div>{{-- /.desc --}}
                                            </div>{{-- /.container-large --}}
                                        @endif
                                    </div>{{-- /.item --}}

                                @endforeach

                            </div>{{-- /.swiper-wrapper --}}
                        </div>{{-- /.slider --}}
                        <button type="button" class="slider-navigation prev js_images-slider-btn-prev"></button>
                        <button type="button" class="slider-navigation next js_images-slider-btn-next"></button>
                        <div class="slider-pagination js_images-slider-pagination"></div>
                    </div>{{-- /.slider-wrapper --}}
                </div>{{-- /.container --}}
            </div>{{-- /.module-images-slider --}}
        </div>{{-- /.popin --}}
    </div>{{-- /.popin-wrapper --}}
</div>{{-- /.module-gallery --}}
