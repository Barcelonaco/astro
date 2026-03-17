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

<div id="{{ $id }}" class="module module-accordion @if(!isset($columns) || $columns == 0) {{ $classes }} @endif">

    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ $background_image }}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif

    @if (!empty($accordions))
        <div class="container">

            @if (!isset($columns))
                @include('components.bloc-title-module', [
                    'title_bloc' => $title_bloc,
                    'title_style' => $title_style,
                    'title_align' => $title_align,
                ])
            @endif

            <div class="accordion">
                @foreach($accordions as $accordion)
                    <button type="button" class="title js_toggle-accordion">
                        {!! $accordion['title'] !!}
                        <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('chevron.svg') !!}</span>
                    </button>
                    <div class="txt editor">
                        {!! $accordion['text'] !!}
                    </div>{{-- /.txt --}}
                @endforeach
            </div>{{-- /.accordion --}}
        </div>{{-- /.container --}}
    @endif
</div>{{-- /.module-accordion --}}
