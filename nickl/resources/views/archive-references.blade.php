@extends('layouts.app')

@php
  $showBreadcrumb = get_field('show_breadcrumb', 'options') && function_exists('yoast_breadcrumb');
  $showShareBtn = get_field('pages_share_btn', 'options') && !get_field('share_btn_position', 'options');
@endphp

@section('content')
  @if (!empty($imgBanner))
    @include('modules.banner', ['h1_in_header' => $h1InHeader, 'title' => $title, 'height_banner' => $heightBanner])
  @endif
  <main id="main" class="main-page page-archive-references" role="main">
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
                      <h1 class="title title-section-1">{{ $title }}</h1>
                    @else
                      <p class="title title-section-1">{{ $title }}</p>
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
                        @if (empty($imgBanner))
                    </div>{{-- /.col-2  --}}
              </div>{{-- /.col-wrapper  --}}
            @endif
          @endif
          @endif
        </div>{{-- /.archive-top  --}}
        <div class="module-references js_refs-container">
          @if ($terms)
            <ul class="tabs">
              <li class="tab">
                <button type="button" class="link active js_change-term" data-value="all">{{ bcn_pll('Tout') }}</button>
              </li>
              @foreach($terms as $term)
                <li class="tab">
                  <button type="button" class="link js_change-term"
                          data-value="{{ $term->slug }}">{{ $term->name }}</button>
                </li>
              @endforeach
            </ul>{{-- /.tabs --}}
          @endif

          @if (isset($data['posts']) && !empty($data['posts']))
            <ul class="list js_list-refs">

              @foreach($data['posts'] as $ref)
                {!! view('components.preview-references', ['pid' => $ref->ID])->render() !!}
              @endforeach

            </ul>{{-- /.list --}}
          @endif

          @if ($data['max_pages'] >= $data['next_page'])
            <div class="btn-more-wrapper js_list-pagination">
              <button type="button"
                      class="btn btn-tertiary color-primary js_load-more"
                      data-page="{{ $data['next_page'] }}">{{ bcn_pll('En voir plus') }}</button>
            </div>
          @endif

          @if (isset($data['posts']) && !empty($data['posts']))
            <div class="js_popin-ref-container">
              @foreach($data['posts'] as $ref)
                @include('components.preview-popin-references', ['pid' => $ref->ID])
              @endforeach
            </div>
          @endif

        </div>{{-- /.module-references --}}
      </div>{{-- /.container-large --}}

      @if (get_field('pages_share_btn', 'options') && get_field('share_btn_position', 'options'))
        @include('modules.share', ['share_btn_position' => 'bottom'])
      @endif

    </section>
  </main>{{-- /.page-archive-references --}}
@endsection
