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

<div id="{{ $id_bloc }}" class="module module-icons {{isset($columns) ? '' : $classes }}">

    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif

    <div class="container">

        @if (!empty($module['logos']))

            @if (!isset($columns))
                @include('components.bloc-title-module', [
                    'title_bloc' => $title_bloc,
                    'title_style' => $title_style,
                    'title_align' => $title_align,
                ])
            @endif

            <ul
                class="list{{ $module['grey_filter'] ? ' grey_filter' : null }}{{ $module['icon_type'] ? null : ' icon_type_jpg' }}">

                @foreach($module['logos'] as $logo)

                    <li class="item">

                        @if (!empty($logo['link']) && !empty($logo['link']['url']))
                            <a href="{{ $logo['link']['url'] }}" class="link"
                                target="{{ !empty($logo['link']['target']) ? $logo['link']['target'] : '_self' }}">
                        @endif
                            @php
                                if ($module['icon_type'] == 0) {
                                    $img = $logo['logo']['sizes']['thumbnail'];
                                } else {
                                    $img = $logo['logo']['url'];
                                }
                            @endphp

                            <div class="illus-wrapper">
                                <img src="{{ $img }}" alt="" class="illus{{ $module['icon_type'] ? null : ' icon_type_jpg' }}">
                            </div>{{-- /.illus-wrapper --}}
                            @if (!empty($logo['titre']) || !empty($logo['desc']))
                                <div class="desc">
                                    @if (!empty($logo['titre']))
                                        <p class="title">{{ $logo['titre'] }}</p>
                                    @endif
                                    @if (!empty($logo['desc']))
                                        <div class="txt editor">
                                            <p>{!! nl2br($logo['desc']) !!}</p>
                                        </div>
                                    @endif
                                </div>{{-- /.desc --}}
                            @endif

                            @if (!empty($logo['link']) && !empty($logo['link']['url']))
                                </a>
                            @endif

                    </li>{{-- /.item --}}

                @endforeach

            </ul>{{-- /.list --}}

        @endif

    </div>{{-- /.container --}}
</div>{{-- /.module-icons --}}
