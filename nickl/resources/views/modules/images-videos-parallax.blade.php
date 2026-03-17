@php
    use App\Helpers\GlobalHelper;
    use App\Helpers\DeviceHelper;

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

<div id="{{ $id_bloc }}" class="module module-images-videos-parallax {{isset($columns) ? '' : $classes }}">

    @if (!isset($columns))
          @include('components.bloc-title-module', [
              'title_bloc' => $title_bloc,
              'title_style' => $title_style,
              'title_align' => $title_align,
          ])
      @endif

    <ul class="list">
        @foreach($blocs as $post)
            <li class="item">

                @if ($post['is_image'])
                    <div class="illus-wrapper media-wrapper">
                        <div class="overlay" style="opacity: {{ ($post['overlay_opacity'] / 100) }}"></div>
                        <div class="illus-content">
                            <img src="{{$post['image']['sizes']['banner']}}" alt="{{$post['image']['alt']}}" class="illus media">
                        </div>
                    </div>{{-- /.illus-wrapper --}}
                @else
                    @if (DeviceHelper::isMobile() || DeviceHelper::isTablet())
                        <div class="video-wrapper media-wrapper mobile">
                        <div class="overlay" style="opacity: {{ ($post['overlay_opacity'] / 100) }}"></div>
                            <video class="video media" loop muted playsinline>
                                <source src="{{ $post['video-mobile']['url'] }}" type="video/mp4">
                            </video>
                        </div>{{-- /.video-wrapper --}}
                    @else
                        <div class="video-wrapper media-wrapper desktop">
                        <div class="overlay" style="opacity: {{ ($post['overlay_opacity'] / 100) }}"></div>
                            <video class="video media" loop muted playsinline>
                                <source src="{{ $post['video']['url'] }}" type="video/mp4">
                            </video>
                        </div>{{-- /.video-wrapper --}}
                    @endif
                @endif

                @if (!empty($post['sup-title']) || !empty($post['title']) || !empty($post['desc']) || !empty($post['primary_link']) || !empty($post['secondary_link']))
                    <div class="desc">
                        <div class="container-custom">

                            @if (!empty($post['sup-title']))
                                <p class="sup-title">{!! $post['sup-title'] !!}</p>
                            @endif
                            @if (!empty($post['title']))
                                <h3 class="title title-section-1">{!! $post['title'] !!}</h3>
                            @endif
                            @if (!empty($post['desc']))
                                <div class="editor txt">
                                    <p>{!! nl2br($post['desc']) !!}</p>
                                </div>{{-- /.txt --}}
                            @endif

                            @if (!empty($post['primary_link']) || !empty($post['secondary_link']))
                                <div class="btn-wrapper">
                                    @if (!empty($post['primary_link']) && !empty($post['primary_link']['url']))
                                        <a  href="{{ $post['primary_link']['url'] }}"
                                            class="btn btn-primary"
                                            target="{{ !empty($post['primary_link']['target']) ? $post['primary_link']['target'] : '_self' }}">
                                                {!! $post['primary_link']['title'] !!}
                                        </a>
                                    @endif
                                    @if (!empty($post['secondary_link']) && !empty($post['secondary_link']['url']))
                                        <a  href="{{ $post['secondary_link']['url'] }}"
                                            class="btn btn-secondary"
                                            target="{{ !empty($post['secondary_link']['target']) ? $post['secondary_link']['target'] : '_self' }}">
                                                {!! $post['secondary_link']['title'] !!}
                                        </a>
                                    @endif
                                </div>{{-- /.btn-wrapper --}}
                            @endif

                        </div>{{-- /.container-custom --}}
                    </div>{{-- /.desc --}}
                @endif

            </li>{{-- /.item --}}
        @endforeach
    </ul>{{-- /.list --}}
</div>{{-- /.module-images-videos-parallax --}}
