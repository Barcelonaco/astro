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

<div id="{{ $id }}"
    class="module module-illustration-video @if(!isset($columns) || $columns == 0) {{  $classes }} @endif">
    {{-- Arrière-plan si défini --}}
    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif


    <div class="container-large">
        <div class="video-wrapper" style="{{ isset($columns) ? 'null' : 'height: calc(100vh / ' . $ratio . ' )' }}">
            <video class="video" autoplay loop muted playsinline>
                <source src="{{ $url }}" type="video/mp4">
            </video>
        </div>{{-- /.video-wrapper --}}
    </div>{{-- /.container-large --}}
</div>{{-- /.module-illustration-video --}}