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

<div id="{{ $id_bloc }}" class="module module-link {{isset($columns) ? '' : $classes }}">
    {{-- Arrière-plan si défini --}}
    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif
    <div class="container">
        @if (!empty($module['cta']) || !empty($module['cta-2']))
            <div class="btn-wrapper {{ $module['btn_align'] ? $module['btn_align'] : null }}">
                @if (!empty($module['cta']))
                    <a href="{{ $module['cta']['url'] }}" class="btn btn-primary color-primary"
                        target="{{ !empty($module['cta']['target']) ? $module['cta']['target'] : '_self' }}">
                        {!! !empty($module['cta']['title']) ? $module['cta']['title'] : bcn_pll('En savoir plus') !!}
                    </a>
                @endif
                @if (!empty($module['cta-2']))
                    <a href="{{ $module['cta-2']['url'] }}" class="btn btn-primary color-secondary"
                        target="{{ !empty($module['cta-2']['target']) ? $module['cta-2']['target'] : '_self' }}">
                        {!! !empty($module['cta-2']['title']) ? $module['cta-2']['title'] : bcn_pll('En savoir plus') !!}
                    </a>
                @endif
            </div>{{-- /.btn-wrapper --}}
        @endif

    </div>{{-- /.container --}}
</div>{{-- /.module-link --}}