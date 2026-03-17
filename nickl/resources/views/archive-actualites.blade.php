@php
  use App\Posttype\CptNews;
  use App\Helpers\NewsHelper;
  use App\Helpers\ThemeHelper;

  $cptSlug = new CptNews();
  $terms = NewsHelper::getTerms();
  $showBreadcrumb = get_field('show_breadcrumb', 'options') && function_exists('yoast_breadcrumb');
  $showShareBtn = get_field('pages_share_btn', 'options') && !get_field('share_btn_position', 'options');
@endphp

@extends('layouts.app')

@section('content')
  @if (!empty($imgBanner))
    @include('modules.banner', ['h1_in_header' => $h1InHeader, 'title' => ThemeHelper::title(), 'height_banner' => $heightBanner])
  @endif
  <main id="main" class="main-page page-archive-news js_actu-container" role="main">
    <section>
      @if ($showBreadcrumb || $showShareBtn)
        <div class="container sub-header">
          @if ($showBreadcrumb)
            @include('components.breadcrumb')
          @endif

          @if ($showShareBtn)
            @include('modules.share', ['share_btn_position' => 'top'])
          @endif
        </div>
      @endif
      <div class="container-large">
        <div class="archive-top">
          @if (empty($imgBanner))
            @if ($archiveDisplay === 'columns-2')
              <div class="cols-wrapper {{ $archiveDisplay }}">
                <div class="col col-1">
                  @endif
                  @if ($titleInHeader != 'hideTitle')
                    @if ($h1InHeader === 'yes')
                      <h1 class="title title-section-1">{{ ThemeHelper::title() }}</h1>
                    @else
                      <p class="title title-section-1">{{ ThemeHelper::title() }}</p>
                    @endif
                  @endif
                  @if ($archiveDisplay === 'columns-2')
                </div>{{-- /.col-1  --}}
                @endif
                @endif

                @if (!empty($archiveDesc))
                  @if ($archiveDisplay === 'columns-2' && empty($imgBanner))
                    <div class="col col-2">
                      @endif

                      <div class="txt editor">
                        {!! $archiveDesc !!}
                      </div>

                      @if ($archiveDisplay === 'columns-2' && empty($imgBanner))
                    </div>{{-- /.col-2  --}}
              </div>{{-- /.col-wrapper  --}}
            @endif
          @endif
        </div>{{-- /.archive-top  --}}

        @if ($posts['posts'])
          @if ($terms)
            <ul class="tabs">
              <li class="tab">
                <button type="button" class="link active js_change-term" data-value="all">{{ bcn_pll('Tout') }}</button>
              </li>
              @foreach($terms as $term)
                <li class="tab">
                  <button type="button" class="link js_change-term" data-value="{{ $term->slug }}">{{ $term->name }}</button>
                </li>
              @endforeach
            </ul>{{-- /.tabs --}}
          @endif

          <ul class="list-single js_list-actu">

            @foreach($posts['posts'] as $k => $actu)
              @if(is_array($actu))
                {!! view('components.preview-actualites', ['post' => $actu, 'k' => $k])->render() !!}
              @else
                {!! view('components.preview-actualites', ['pid' => $actu->ID, 'k' => $k])->render() !!}
              @endif
            @endforeach

          </ul>{{-- /.list-single --}}

          <div class="pagination">
            @if ($posts['max_pages'] >= $posts['next_page'])
              <div class="btn-more-wrapper js_list-pagination">
                <button type="button" class="btn btn-tertiary js_load-more" data-page="{{ $posts['next_page'] }}">{{ bcn_pll('Voir plus d\'actualités') }}</button>
              </div>
            @endif
          </div>

        @endif

      </div>{{-- /.container-large --}}
      @if (get_field('pages_share_btn', 'options') && get_field('share_btn_position', 'options'))
        @include('modules.share', ['share_btn_position' => 'bottom'])
      @endif
    </section>
  </main>{{-- /.page-archive-news --}}

@endsection