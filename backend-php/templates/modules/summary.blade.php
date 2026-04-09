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

<div id="{{ $id_bloc }}"
  class="module module-summary {{isset($columns) ? '' : $classes }}{{ isset($reusable_bloc) ? ' ' . $reusable_bloc : '' }}">

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

    @if ($links_type)
      {!! wp_nav_menu(['menu' => $menu_id]) !!}
    @elseif (!$links_type)
      <ul class="menu">
        @foreach ($custom_menu as $menu)
          <li class="menu-item sub">
            @if ($menu['title'])
              <p class="title">{{ $menu['title'] }}</p>
            @endif
            <ul class="sub-menu">
              @foreach ($menu['links'] as $link)
                <li class="menu-item"><a href="{{ $link['link']['url'] }}"
                    target="{{ $link['link']['target'] }}">{!! $link['link']['title'] !!}</a></li>
              @endforeach
            </ul>
          </li>

        @endforeach

      </ul>

    @endif

  </div>{{-- /.container --}}
</div>{{-- /.module-big-menu --}}
