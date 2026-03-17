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

<div id="{{ $id_bloc }}" class="module module-quote {{isset($columns) ? '' : $classes }}">

    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif

    <div class="container">
        <p class="txt title-section-2">“{!! nl2br($quote['quote']) !!}”</p>

        @if (!empty($quote['photo']) || !empty($quote['name']) || !empty($quote['job']))
            <div class="author">
                @if (!empty($quote['photo']))
                    <div class="illus-wrapper">
                        <img src="{{ $quote['photo']['sizes']['square-large'] }}" alt="{{ $quote['photo']['alt'] }}"
                            class="illus">
                    </div>
                @endif
                @if (!empty($quote['name']))
                    <p class="name">{{ $quote['name'] }}</p>
                @endif
                @if (!empty($quote['job']))
                    <p class="function">{{ $quote['job'] }}</p>
                @endif

            </div>{{-- /.author --}}
        @endif

    </div>{{-- /.container --}}
</div>{{-- /.module-quote --}}