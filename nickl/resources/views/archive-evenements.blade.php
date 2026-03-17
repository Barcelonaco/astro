@php
  use App\Helpers\EventsHelper;
  use App\Helpers\GlobalHelper;
  use App\Helpers\ThemeHelper;
  use App\Posttype\CptEvents;
  use App\Taxonomy\TaxoEventsType;

  $cptSlug = new CptEvents();
  $taxoType = new TaxoEventsType();
  $posts = EventsHelper::getEventsFiltered();
  $taxoTypeTerms = EventsHelper::getTaxoEventType();
  $imagesRatio = get_option('options_evenements_images_ratio');
  $showBreadcrumb = get_field('show_breadcrumb', 'options') && function_exists('yoast_breadcrumb');
  $showShareBtn = get_field('pages_share_btn', 'options') && !get_field('share_btn_position', 'options');
@endphp

@extends('layouts.app')

@section('content')
  @if (isset($imgBanner) && !empty($imgBanner))
    @include('modules.banner', ['h1_in_header' => $h1InHeader, 'title' => ThemeHelper::title(), 'height_banner' => $heightBanner])
  @endif
  <main id="main" class="main-page page-archive-event js_event-container event-grid" role="main">
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
                  @if ($titleInHeader === 'showTitle')
                    @if ($h1InHeader === 'yes')
                      <h1 class="title title-section-1">{!! $posts ? ThemeHelper::title() : "Aucun évènement à venir" !!}</h1>
                    @else
                      <p class="title title-section-1">{!! $posts ? ThemeHelper::title() : "Aucun évènement à venir" !!}</p>
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
        @if ($posts)
          <div class="event-top-option {{ $taxoTypeTerms ? 'space-between' : '' }}">
            @if ($taxoTypeTerms)

              <ul class="tabs">
                <li class="tab">
                  <button type="button" class="link active js_change-term" data-value="all">{{ bcn_pll('Tout') }}</button>
                </li>
                @foreach($taxoTypeTerms as $taxoType)
                  <li class="tab">
                    <button type="button" class="link js_change-term" data-value="{{ $taxoType->slug }}">{{ $taxoType->name }}</button>
                  </li>
                @endforeach
              </ul>
              {{-- /.tabs --}}
            @endif
            <div class="event-toggle" id="js_event-toggle"><span id="toggle-text">{{ $eventDisplay == 'list' ? 'Vue liste' : 'Vue photo' }}</span> <span class="icon" aria-hidden="false"><?= GlobalHelper::displaySvg('chevron.svg') ?></span>
              <div class="event-toggle-list" id="js_event-toggle">
                <p id="js_select-list" class="{{ $eventDisplay == 'list' ? 'selected' : '' }}">Vue liste</p>
                <p id="js_select-grid" class="{{ $eventDisplay == 'grid' ? 'selected' : '' }}">Vue photo</p>
              </div>
            </div>
          </div>
          <ul id="js_list-event" class="{{ $eventDisplay ? $eventDisplay : 'list' }} {{ $imagesRatio ? $imagesRatio : '' }} js_list-event columns-<?= count($posts['posts']) ?>">

            @foreach($posts['posts'] as $k => $post)
              {!! view('components.preview-event-grid', ['post' => $post, 'k' => $k, 'imagesRatio' => $imagesRatio])->render() !!}
            @endforeach

          </ul>
        @endif
      </div>{{-- /.container --}}
      @if (get_field('pages_share_btn', 'options') && get_field('share_btn_position', 'options'))
        @include('modules.share', ['share_btn_position' => 'bottom'])
      @endif
    </section>
  </main>{{-- /.page-archive-events --}}

@endsection
