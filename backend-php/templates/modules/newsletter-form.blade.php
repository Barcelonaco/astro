@php
  use App\Helpers\GlobalHelper;

  if (!empty($backgroundImage)) {
    if (isset($reusable_bloc) && !empty($reusable_bloc)) {
      $background_image = GlobalHelper::displayBackground($backgroundImage['url']);
    } else {
      $background_image = 'background-image: url(' . e($backgroundImage['url']) . ')';
    }
  }

  if (isset($columns) && $columns == 'module-in-column') {
    $id_bloc = '';
  }
@endphp

<div id="{{ $id_bloc }}" class="module module-newsletter-form {{isset($columns) ? '' : $classes }}">

  @if (!empty($backgroundImage) && !isset($columns))
    <div class="background"
      style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
    </div>
  @endif

  <div class="container">
    @if (!isset($columns))
      @include('components.bloc-title-module', [
        'title_bloc' => $title_bloc,
        'title_style' => $title_style,
        'title_align' => $title_align,
      ])
    @endif
    <div class="txt editor">
      @if (!empty($module['desc']))
        {!! str_replace(['&nbsp;', "\xC2\xA0"], ' ', $module['desc']) !!}
      @endif
    </div>{{-- /.txt --}}
    <?= do_shortcode('[acymailing_form_shortcode id="1"]') ?>
  </div>{{-- /.container --}}
</div>{{-- /.module-newsletter-form --}}
