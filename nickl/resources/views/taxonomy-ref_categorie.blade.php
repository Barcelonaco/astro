@php
  use App\Posttype\CptReferences;
  use App\Helpers\ReferencesHelper;
  use App\Helpers\ThemeHelper;
  $cptSlug = new CptReferences();
  $term = get_queried_object();
  $data = ReferencesHelper::getRefs(-1, 0, $term);
  $terms = ReferencesHelper::getTerms();
  $termLongDesc = get_term_meta($term->term_id, 'long_description', true);
  $imgBanner = get_field('header_img', 'options_' . $cptSlug->getSlug());
  $heightBanner = get_field('img_height', 'options_' . $cptSlug->getSlug());
  $h1InHeader = get_field('h1_in_header', 'options_' . $cptSlug->getSlug());
  $titleInHeader = get_field('title_in_header', 'options_' . $cptSlug->getSlug());
  $randomise = get_field('randomise_refs','options_' . $cptSlug->getSlug());
  $archiveDisplay = get_field('archive_display', 'options_' . $cptSlug->getSlug());
  if ($randomise === 'random') {
      $data = ReferencesHelper::getRefs(-1, null, null, 0, true);
  } else {
      $data = ReferencesHelper::getRefs(-1, 0, $term);
  }
@endphp
@extends('layouts.app')
@section('content')
  <main id="main" class="main-page page-archive-references" role="main">
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
          @if (!empty($archiveDesc = $term->description))
            <div class="txt editor">
              {!! $archiveDesc !!}
            </div>

          @endif
        </div>{{-- /.archive-top  --}}
        <div class="module-references js_refs-container">

          @if ($data['posts'])
            <ul class="list js_list-refs">
              @foreach ($data['posts'] as $post)
                @include('components.preview-references', ['pid' => $post->ID])
              @endforeach
            </ul>{{-- /.list-single --}}
            @if ($data['max_pages'] >= $data['next_page'])
              <div class="btn-more-wrapper js_list-pagination">
                <button type="button"
                        class="btn btn-tertiary js_load-more"
                        data-page="{{ $data['next_page'] }}">{{ bcn_pll('Voir plus de références') }}</button>
              </div>
            @endif
          @endif
        </div>
      </div>{{-- /.container-large --}}
      <div class="container-large">
        @if (!empty($termLongDesc))
          <div class="txt editor desc">
            {!! wpautop($termLongDesc) !!}
          </div>
        @endif
      </div>
    </section>
  </main>{{-- /.page-archive-references --}}
@endsection