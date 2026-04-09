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
  $list_posts = is_array($posts) ? $posts['posts'] : $posts->posts;
@endphp

<div id="{{ $id_bloc }}" class="module module-news-slider {{isset($columns) ? '' : $classes }}">

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

    <div class="slider-wrapper">
      <div class="swiper slider js_news-slider columns-{{ $display_posts }}">
        <div class="swiper-wrapper">

          @if ($module['is_manual'] == 1 && !empty($module['news_id']))
            @foreach($module['news_id'] as $news)
              {!! view('components.preview-actualites', ['pid' => $news, 'content' => $module, 'display_posts' => $display_posts])->render() !!}
            @endforeach
          @else
            @foreach($list_posts as $news)
              {!! view('components.preview-actualites', ['pid' => $news, 'content' => $module, 'display_posts' => $display_posts])->render() !!}
            @endforeach
          @endif

        </div>{{-- /.swiper-wrapper --}}
      </div>{{-- /.slider --}}
      <button type="button" class="slider-navigation prev"></button>
      <button type="button" class="slider-navigation next"></button>
    </div>{{-- /.slider-wrapper --}}

    @if ($module['display_archive_link'])
      <div class="btn-more-wrapper">
        <a href="{{ get_post_type_archive_link($cptSlug->getSlug()) }}" class="btn btn-tertiary">
          {{ !empty($module['archive_link_label']) ? $module['archive_link_label'] : bcn_pll('Voir toutes les actualités') }}
        </a>
      </div>{{-- /.btn-more-wrapper --}}
    @endif

  </div>{{-- /.container-large --}}
</div>{{-- /.module-news-slider --}}
