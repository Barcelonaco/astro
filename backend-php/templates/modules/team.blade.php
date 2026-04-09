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

<div id="{{ $id_bloc }}" class="module module-team {{isset($columns) ? '' : $classes }}">

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

        <ul class="list columns columns-{{ count($team_members) }} pictures-{{ $pictures_format }} align-{{ $align }}">

            @foreach($team_members as $team)
                @php
                    $socialNetwork = [
                        'instagram' => $team['instagram'],
                        'tiktok' => $team['tiktok'],
                        'linkedin' => $team['linkedin'],
                        'twitter' => $team['twitter'],
                        'youtube' => $team['youtube'],
                    ];
                @endphp
                <li class="item">
                    <div class="illus-wrapper">
                        @if($pictures_format == 'portrait')
                            <img src="{{ $team['picture']['sizes']['portrait'] }}" alt="{{ $team['picture']['alt'] }}"
                                class="illus">
                        @else
                            <img src="{{ $team['picture']['sizes']['square-large'] }}" alt="{{ $team['picture']['alt'] }}"
                                class="illus">
                        @endif
                    </div>{{-- /.illus-wrapper --}}

                    @if (count($team_members) == 1)

                        </li>{{-- /.item --}}
                        <li class="item">

                    @endif

                    <div class="desc">
                        @if (!empty($team['name']))
                            <p class="name">{{ $team['name'] }}</p>
                        @endif
                        @if (!empty($team['post']))
                            <p class="post">{{ $team['post'] }}</h2>
                        @endif
                            @if (!empty($team['desc']))
                                <p class="team-desc">{!! nl2br($team['desc']) !!}</p>
                            @endif

                        @if (!empty($team['link']) && !empty($team['link']['url']))
                            <div class="btn-wrapper">
                                <a href="{{ $team['link']['url'] }}" class="btn btn-tertiary"
                                    target="{{ !empty($team['link']['target']) ? $team['link']['target'] : '_self' }}">
                                    @if (!empty($team['icon_link']) && !empty($team['icon_link']['url']))
                                        <img src="{{ $team['icon_link']['url'] }}" alt="" class="illus">
                                    @endif
                                    {{ !empty($team['link']['title']) ? $team['link']['title'] : '' }}
                                </a>
                            </div>{{-- /.btn-wrapper --}}
                        @endif

                        @include('components.social-networks', ['socialNetworksa' => $socialNetwork])

                    </div>{{-- /.desc --}}
                </li>{{-- /.item --}}

            @endforeach

        </ul>{{-- /.list --}}
    </div>{{-- /.container-large --}}
</div>{{-- /.module-team --}}
