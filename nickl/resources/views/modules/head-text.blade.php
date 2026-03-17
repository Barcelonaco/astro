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
<div id="{{ $id_bloc }}" class="module module-head-text {{isset($columns) ? '' : $classes }}">
    {{-- Arrière-plan si défini --}}
    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif
    <div class="container">
        <div class="cols-wrapper">

            <div class="col col-1">
                @if (!$h1_in_header && $module['is_h1'])
                    <h1 class="title title-section-2">{{ $title_bloc }}</h1>
                @else
                    <h2 class="title title-section-2">{{ $title_bloc }}</h2>
                @endif
            </div>{{-- /.col-1 --}}

            <div class="col col-2">
                <div class="txt editor">
                    @if (!empty($module['text']))
                        {!! str_replace(['&nbsp;', "\xC2\xA0"], ' ', $module['text']) !!}
                    @endif
                </div>{{-- /.txt --}}
            </div>{{-- /.col-2 --}}

        </div>{{-- /.cols-wrapper --}}
    </div>{{-- /.container --}}
</div>{{-- /.module-head-text --}}