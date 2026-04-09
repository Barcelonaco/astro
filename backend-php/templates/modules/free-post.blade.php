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

<div id="{{ $id_bloc }}" class="module module-posts-list {{isset($columns) ? '' : $classes }}">

    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif

    <div class="container-large">

        @if (!isset($columns))
            @include('components.bloc-title-module', [
                'title_bloc' => $title_bloc,
                'title_style' => $title_style,
                'title_align' => $title_align,
            ])
        @endif

        <ul class="list columns-{{ count($module['list']) }}">

            @foreach($module['list'] as $post)

                @if (!empty($post['title']) || !empty($post['catchphrase']) || !empty($post['primary_link']) || !empty($post['secondary_link']))
                    <li class="item has-desc">
                @else
                        <li class="item no-desc">
                    @endif
                    <div class="background-item">
                        <img src="{{ $post['image']['sizes']['half'] }}" alt="{{ $post['image']['alt'] }}" class="illus">
                    </div>{{-- /.background-item --}}

                    @if (!empty($post['title']) || !empty($post['catchphrase']) || !empty($post['primary_link']) || !empty($post['secondary_link']))
                        <div class="desc">
                            @if (!empty($post['title']))
                                <h3 class="title title-section-3">{!! $post['title'] !!}</h3>
                            @endif
                            @if (!empty($post['catchphrase']))
                                <div class="editor txt">
                                    <p>{!! nl2br($post['catchphrase']) !!}</p>
                                </div>{{-- /.txt --}}
                            @endif
                            @if (!empty($post['primary_link']) || !empty($post['secondary_link']))
                                <div class="btn-wrapper">
                                    @if (!empty($post['primary_link']) && !empty($post['primary_link']['url']))
                                        <a href="{{ $post['primary_link']['url'] }}" class="btn btn-primary"
                                            target="{{ !empty($post['primary_link']['target']) ? $post['primary_link']['target'] : '_self' }}">
                                            {!! $post['primary_link']['title'] !!}
                                        </a>
                                    @endif
                                    @if (!empty($post['secondary_link']) && !empty($post['secondary_link']['url']))
                                        <a href="{{ $post['secondary_link']['url'] }}" class="btn btn-secondary"
                                            target="{{ !empty($post['secondary_link']['target']) ? $post['secondary_link']['target'] : '_self' }}">
                                            {!! $post['secondary_link']['title'] !!}
                                        </a>
                                    @endif
                                </div>{{-- /.btn-wrapper --}}
                            @endif
                        </div>{{-- /.desc --}}
                    @endif
                </li>{{-- /.item --}}

            @endforeach

        </ul>{{-- /.list --}}

    </div>{{-- /.container-large --}}
</div>{{-- /.module-posts-list --}}
