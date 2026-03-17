@php
  if(isset($columns) && $columns == 'module-in-column'){
    $id_bloc = '';
  }
  $transforms = [];
  if (!empty($module['transformX'])) $transforms[] = "translateX({$module['transformX']}vw)";
  if (!empty($module['transformY'])) $transforms[] = "translateY({$module['transformY']}vh)";
  $transformStyle = !empty($transforms) ? 'transform: ' . implode(' ', $transforms) . ';' : '';
@endphp

<div id="{{ $id_bloc }}" class="module module-ornament {{isset($columns) ? '' : $classes }}">

        @if ($module['image'])

          <div class="illus-wrapper img-{{ $module['img_placement'] }}" style="max-width: {{ $widthImage }}%; opacity: {{ $module['img_opacity'] / 100 }}; {{ $transformStyle }}">
            <img src="{{ $module['image']['sizes']['banner'] }}" alt="" class="illus" no-lazy>
          </div>{{-- /.illus-wrapper --}}

        @endif
</div>{{-- /.module-ornament --}}