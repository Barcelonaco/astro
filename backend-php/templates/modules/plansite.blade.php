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

<div id="{{ $id_bloc }}" class="module module-plansite {{ isset($columns) ? '' : $classes }}">

  @if (!empty($backgroundImage) && !isset($columns))
    <div class="background"
      style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
    </div>
  @endif

  <div class="container">
    @if (!empty($title_bloc) && $title_bloc != '')
      <h{{ $title_style ? $title_style : 1 }}
        class="title-module title-section-{{ $title_style ? $title_style : '1' }} align-{!! $title_align ?? 'center' !!}">
        {{ $title_bloc ? $title_bloc : 'Plan du site' }}</h{{ $title_style ? $title_style : 1 }}>
    @endif

    <div class="txt editor">
      {!! do_shortcode('[plan_du_site]') !!}
    </div>
  </div>{{-- /.container --}}
</div>{{-- /.module-plansite --}}