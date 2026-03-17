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

<div id="{{ $id_bloc }}" class="module module-text-scrolling {{isset($columns) ? '' : $classes }}">

    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif

    @if (!empty($texts))

        <div class="list {{ $text_size }} direction-{{ $text_direction }}">
            <div class="list-content" style="animation-duration: {{ $text_speed }}s">

                @for($i = 0; $i < 20; $i++)
                    @foreach($texts as $text)
                        @if (!empty($text['text']))

                            <div class="item">{{ $text['text'] }}</div>

                        @endif
                    @endforeach
                @endfor

            </div>{{-- /.list-content --}}
        </div>{{-- /.list --}}

    @endif

</div>{{-- /.module-text-scrolling --}}