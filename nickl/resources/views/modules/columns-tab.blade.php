@php
  use App\Helpers\GlobalHelper;

  if (($module['is_visible'] ?? 'yes') === 'no') {
    return;
  }

  if (!empty($backgroundImage)) {
    if (isset($reusable_bloc) && !empty($reusable_bloc)) {
      $background_image = GlobalHelper::displayBackground($backgroundImage['url']);
    } else {
      $background_image = 'background-image: url(' . e($backgroundImage['url']) . ')';
    }
  }
  $columns = $module['columns_list'] ?? '';
@endphp

<div id="{{ $id }}" class="module module-columns {{ $classes }}{{ !empty($backgroundImage) && ($module['bg_parallax'] ?? false) ? ' background-parallax' : '' }}">
  {{-- Arrière-plan si défini --}}
  @if (!empty($backgroundImage))
    <div class="background"
      style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
    </div>
  @endif

  <div class="container{{ $module['container_width'] ? '-large' : null }}">
    @if (!empty($title_bloc) && $title_bloc != '')
      <h{{ $title_style ? $title_style : 2 }}
        class="title-module title-section-{{ $title_style ? $title_style : '4' }} align-{!! $title_align ?? 'center' !!}">
        {{ $title_bloc }}
      </h{{ $title_style ? $title_style : 2 }}>
    @endif
    <div
      class="cols-wrapper {{$columnsBackground}} columns-{{ $columnsCount }} {{ $display }}{{ $module['cols_justify_items'] ? ' cols_justify_center' : '' }}">

      @if (!empty($columns))
      @foreach ($columns as $column)
      <div class="col">
        @if(!empty($column['columns_module']))
        @foreach($column['columns_module'] as $column_module)
        @php
          $layout = $column_module['acf_fc_layout'] ?? null;
        @endphp

        @if($layout)
        @if($layout == 'meteo')
          @includeIf('meteo::modules.meteo', [
            'module' => $column_module,
            'number' => $number,
            'columns' => 'module-in-column',
          ])
        @else
        @includeIf('modules.' . $layout, [
          'module' => $column_module,
          'number' => $number,
          'columns' => 'module-in-column',
        ])
      @endif
            @php($number++)
          @endif

        @endforeach
      @endif
    </div>{{-- /.col --}}
  @endforeach
@endif

    </div>{{-- /.cols-wrapper --}}
  </div>{{-- /.container --}}
</div>{{-- /.module-columns --}}
