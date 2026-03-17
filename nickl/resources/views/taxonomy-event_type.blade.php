@php
  use App\Helpers\EventsHelper as Event;
  use App\Helpers\GlobalHelper;
  use App\Helpers\ThemeHelper;
  use App\Posttype\CptEvents;
  use App\Taxonomy\TaxoEventsType;
  $cptSlug = new CptEvents();
  $term = get_queried_object();
  $taxoType = new TaxoEventsType();
  $data = Event::getEvents($term);
  $taxoTypeTerms = Event::getTaxoEventType();
  $termLongDesc = get_term_meta($term->term_id, 'long_description', true);
  $imgBanner = get_field('header_img', 'options_' . $cptSlug->getSlug());
  $heightBanner = get_field('img_height', 'options_' . $cptSlug->getSlug());
  $h1InHeader = get_field('h1_in_header', 'options_' . $cptSlug->getSlug());
  $titleInHeader = get_field('title_in_header', 'options_' . $cptSlug->getSlug());
  $randomise = get_field('randomise_refs','options_' . $cptSlug->getSlug());
  $archiveDesc = $term->description;
  $archiveDisplay = get_field('archive_display', 'options_' . $cptSlug->getSlug());
@endphp
@extends('layouts.app')
@section('content')
  <main id="main" class="main-page page-archive-event js_event-container event-grid" role="main">
    <section>
        @if (get_field('show_breadcrumb', 'options') && function_exists('yoast_breadcrumb'))
          @include('components.breadcrumb')
        @endif
      <div class="container-large">
        <div class="archive-top">
          @if ($titleInHeader != 'hideTitle')
            @if ($h1InHeader === 'yes')
              <h1 class="title title-section-1">{!! ThemeHelper::title() . ' > ' . $term->name !!}</h1>
            @else
              <p class="title title-section-1">{!! ThemeHelper::title() . ' > ' . $term->name !!}</p>
            @endif
          @endif
          @if (!empty($archiveDesc))
            <div class="txt editor">
              {!! $archiveDesc !!}
            </div>
            @php var_dump($term); @endphp
          @endif
        </div>{{-- /.archive-top  --}}
        @if ($data)
          <div class="event-top-option">
            <div class="event-toggle" id="js_event-toggle"><span
                id="toggle-text">{{ $eventDisplay == 'list' ? 'Vue liste' : 'Vue photo' }}</span> <span class="icon"
                                                                                                        aria-hidden="false"><?= GlobalHelper::displaySvg('chevron.svg') ?></span>
              <div class="event-toggle-list" id="js_event-toggle">
                <p id="js_select-list" class="{{ $eventDisplay == 'list' ? 'selected' : '' }}">Vue liste</p>
                <p id="js_select-grid" class="{{ $eventDisplay == 'grid' ? 'selected' : '' }}">Vue photo</p>
              </div>
            </div>
          </div>
          <ul id="js_list-event"
              class="{{ $eventDisplay ? $eventDisplay : 'list' }} js_list-event columns-<?= count($data['posts']) ?>">
            @foreach($data['posts'] as $k => $post)
               {!! view('components.preview-event-grid', ['post' => $post, 'k' => $k])->render() !!}
            @endforeach
          </ul>
        @endif
      </div>{{-- /.container-large --}}
      <div class="container-large">
        @if (!empty($termLongDesc))
          <div class="txt editor desc">
            {!! wpautop($termLongDesc) !!}
          </div>
        @endif
      </div>
    </section>
  </main>{{-- /.page-archive-regerences --}}
@endsection