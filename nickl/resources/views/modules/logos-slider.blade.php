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

<div id="{{ $id_bloc }}"
    class="module module-logos-slider @if(!isset($columns) || $columns == 0) {{  $classes }} @endif">

    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif

    <div class="container">

        @if (!isset($columns))
            @include('components.bloc-title-module', [
                'title_bloc' => $title_bloc,
                'title_style' => $title_style,
                'title_align' => $title_align,
            ])
        @endif
        @if (!empty($module['logos']))

                <div class="slider-wrapper">
                    <div class="swiper slider js_logos-slider {{ $columns ? '' . $columns : '' }}">
                        <div class="swiper-wrapper">

                            @foreach($module['logos'] as $logo)

                                    <div class="swiper-slide item">
                                        @if (!empty($logo['link']) && !empty($logo['link']['url']))
                                            <a href="{{ $logo['link']['url'] }}" class="link"
                                                target="{{ !empty($logo['link']['target']) ? $logo['link']['target'] : '_self' }}">
                                        @else
                                                <div class="link">
                                            @endif
                                                <img src="{{ $logo['logo']['sizes']['module-logo'] }}" alt="{{ $logo['logo']['alt'] }}"
                                                    class="illus">
                                                @if (!empty($logo['link']) && !empty($logo['link']['url']))
                                                    </a>
                                                @else
                                            </div>{{-- /.link --}}
                                        @endif
                                </div>{{-- /.item --}}

                            @endforeach

                    </div>{{-- /.swiper-wrapper --}}
                </div>{{-- /.slider --}}
                <button type="button" class="slider-navigation js_logos-slider-btn-prev prev"></button>
                <button type="button" class="slider-navigation js_logos-slider-btn-next next"></button>
            </div>{{-- /.slider-wrapper --}}

        @endif

</div>{{-- /.container --}}
</div>{{-- /.module-logos-slider --}}
