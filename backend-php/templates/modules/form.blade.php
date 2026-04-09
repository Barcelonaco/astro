@php
    use App\Helpers\GlobalHelper;

    if (!empty($backgroundImage)) {
        if (isset($reusable_bloc) && !empty($reusable_bloc)) {
            $background_image = GlobalHelper::displayBackground($backgroundImage['url']);
        } else {
            $background_image = 'background-image: url(' . e($backgroundImage['url']) . ')';
        }
    }

    if (isset($columns) && $columns == 'module-in-column') {
        $id_bloc = '';
    }
@endphp

<div id="{{ $id_bloc }}" class="module module-form {{isset($columns) ? '' : $classes }}">
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

        {!! gravity_form($module['form_id'], false, false, false, null, true) !!}

    </div>{{-- /.container --}}
</div>{{-- /.module-form --}}
