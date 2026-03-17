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

@if(!empty($posts))

  <div id="{{ $id_bloc }}"
    class="module module-insta-slider @if(!isset($columns) || $columns == 0) {{  $classes }} @endif">
    <input id="count_post_insta" type="hidden" value="{{count($posts['data'])}}">

    @if (!empty($backgroundImage) && !isset($columns))
      <div class="background"
        style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
      </div>
    @endif

    <div class="container-large">
      @if (!empty($title_bloc) && $title_bloc != '')
        <h{{ $title_style ? $title_style : 2 }}
          class="title-module title-section-{{ $title_style ? $title_style : '4' }} align-{!! $title_align ?? 'center' !!}">
          {{ $title_bloc }}</h{{ $title_style ? $title_style : 2 }}>
      @endif
      <div class="slider-wrapper">
        <div class="swiper slider js_insta-slider columns-1">
          <div class="swiper-wrapper">
            @foreach($posts['data'] as $post)
              @include('components.preview-insta', ['post' => $post])
            @endforeach
          </div>
        </div>{{-- /.swipper --}}
        <button type="button" class="slider-navigation prev"></button>
        <button type="button" class="slider-navigation next"></button>
      </div>{{-- /.slider-wrapper --}}

      @if (!empty($catchphrase))
        <div class="btn-more-wrapper">
          <a href="{{ $link }}" target="_blank" class="btn btn-tertiary insta-link">
            {!! $catchphrase !!}
          </a>
        </div>
      @endif
    </div>{{-- /.container-large --}}
  </div>{{-- /.module-insta-slider --}}
@else
  <div>Veuillez configurer Instagram dans les paramètres du site</div>
@endif