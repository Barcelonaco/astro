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

<div id="{{ $id_bloc }}" class="module module-separator {{isset($columns) ? '' : $classes }}">

    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif

    @switch($module['separator_style'])
        @case('style-1')
            <span class="points-wrapper">
                <span class="point point-1"></span>
                <span class="point point-2"></span>
                <span class="point point-3"></span>
            </span>{{-- /.points-wrapper --}}
            @if (!empty($module['text']))
                <span class="title title-section-3">{{ $module['text'] }}</span>
                <span class="points-wrapper">
                    <span class="point point-1"></span>
                    <span class="point point-2"></span>
                    <span class="point point-3"></span>
                </span>{{-- /.points-wrapper --}}
            @endif
            @break

        @case('style-2')
            <hr class="default">
            @if (!empty($module['text']))
                <span class="title title-section-3">{{ $module['text'] }}</span>
                <hr class="default">
            @endif
            @break

        @case('style-3')
                <hr class="custom" style="width:{{ $width }}%;height:{{ $module['height'] }}px;"/>
                @if (!empty($module['text']))
                    <span class="title title-section-3">{{ $module['text'] }}</span>
                    <hr class="custom" style="width:{{ $width }}%;height:{{ $module['height'] }}px;"/>
                @endif
            @break

        @default
    @endswitch

</div>{{-- /.module-separator --}}