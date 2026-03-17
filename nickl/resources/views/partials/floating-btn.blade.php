@php
use App\Helpers\GlobalHelper;
@endphp
@if (($floatBtnLink = get_field('floating-btn-link', 'options')) && (get_field('show_btn', 'options') == 1))
  <a href="{!! $floatBtnLink['url'] !!}" target="{!! $floatBtnLink['target'] ? $floatBtnLink['target'] : '_self' !!}" class="floating-btn" title="{!! $floatBtnLink['title'] ? $floatBtnLink['title'] : '' !!}">
    @if ($floatBtnImg = get_field('floating-btn-img', 'options'))
      <div class="icon">
        @if (GlobalHelper::displaySvgPng($floatBtnImg['ID']))
          {!! GlobalHelper::displaySvgPng($floatBtnImg['ID']) !!}
        @else
          <img src="{!! $floatBtnImg['url'] !!}" class="illus" />
        @endif
      </div>
    @endif
    {!! $floatBtnLink['title'] ? $floatBtnLink['title'] : '' !!}
  </a>
@endif
