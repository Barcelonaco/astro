@php
  use App\Helpers\Dashboard;
  use App\Helpers\GlobalHelper;
@endphp
<div class="module news-module module-news-slider">
  <h3>Les dernières actus {{ defined('NICKL_PDV') && NICKL_PDV === 'PDV' ? 'Place du Village' :  'Nickl' }}</h3>
  <div class="slider-wrapper">
    <div class="swiper slider js_news-slider">
      <div class="swiper-wrapper">
        @if ($posts = Dashboard::getLatestPostFromMain())
          {!! $posts !!}
        @endif
      </div>
    </div>
    <button type="button" class="slider-navigation prev js-btn-prev"></button>
    <button type="button" class="slider-navigation next js-btn-next"></button>
    <div class="slider-pagination js-pagination"></div>
  </div>
</div>
