@if (!empty($title_bloc) && $title_bloc != '')
  <h{{ $title_style ? $title_style : 2 }}
    class="title-module title-section-{{ $title_style ? $title_style : '4' }} align-{!! $title_align ?? 'center' !!}">
    {{ $title_bloc }}
  </h{{ $title_style ? $title_style : 2 }}>
@endif