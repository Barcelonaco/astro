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
    class="module module-key-figures @if(!isset($columns) || $columns == 0) {{  $classes }} @endif">

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

        @if (!empty($key_list))

            <ul class="list">

                @foreach($key_list as $key)

                    <li class="item">

                        @if (!empty($key['link']) && !empty($key['link']['url']))
                            <a href="{{ $key['link']['url'] }}" class="link"
                                target="{{ !empty($key['link']['target']) ? $key['link']['target'] : '_self' }}">
                        @endif
                            @if (!empty($key['icone']) || !empty($key['icone']['url']))
                                <div class="illus-wrapper">
                                    <img src="{{ $key['icone']['url'] }}" alt="" class="illus">
                                </div>{{-- /.illus-wrapper --}}
                            @endif
                            <div class="nbr-wrapper">
                                <span class="nbr" data-nbr="{{ $key['value'] }}">
                                    {{ $key['value'] }}
                                </span>

                            </div>
                            @if (!empty($key['titre']) || !empty($key['desc']))
                                <div class="desc">
                                    @if (!empty($key['titre']))
                                        <p class="title">{!! $key['titre'] !!}</p>
                                    @endif
                                    @if (!empty($key['desc']))
                                        <div class="txt editor">
                                            <p>{!! nl2br($key['desc']) !!}</p>
                                        </div>
                                    @endif
                                </div>{{-- /.desc --}}
                            @endif

                            @if (!empty($key['link']) && !empty($key['link']['url']))
                                </a>{{-- /.link --}}
                            @endif

                    </li>{{-- /.item --}}

                @endforeach

            </ul>{{-- /.list --}}
        @endif

    </div>{{-- /.container --}}
</div>{{-- /.module-key-figures --}}
