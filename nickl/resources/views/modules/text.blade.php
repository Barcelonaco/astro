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
        $id = '';
    }
@endphp

<div id="{{ $id }}" class="module module-text{{isset($columns) ? '' : ' ' . $classes }}">

    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif

    <div class="container">
        <div class="txt editor {{isset($customClasses) ? ' ' . $customClasses : '' }}">
            @if (!empty($text))
                {!! str_replace(['&nbsp;', "\xC2\xA0"], ' ', $text) !!}
            @endif
        </div>{{-- /.txt --}}

        @if (!empty($cta) && !empty($cta['url']))
            <div class="btn-wrapper align-{{ $link_align ? $link_align : 'left' }}">
                <a href="{{ $cta['url'] }}" class="btn btn-{{ $link_style ? $link_style : 'tertiary' }} color-primary"
                    target="{{ !empty($cta['target']) ? $cta['target'] : '_self' }}">
                    {!! !empty($cta['title']) ? $cta['title'] : bcn_pll('En savoir plus') !!}

                </a>
            </div>{{-- /.btn-wrapper --}}

        @endif

    </div>{{-- /.container --}}
</div>{{-- /.module-text --}}