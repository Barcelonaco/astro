@php
  use App\Helpers\GlobalHelper;
@endphp

<div class="swiper-slide item">
  <a href="{{ $post['permalink'] }}" target="_blank">
    <div class="illus-wrapper">
      @if($post['media_type'] === 'IMAGE' || $post['media_type'] === 'CAROUSEL_ALBUM')
        <img src="{{ $post['media_url'] }}" alt="{{ $post['caption'] ?? 'Instagram Post' }}">
      @endif
      <div class="overlay">
        <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('eye.svg') !!}</span>
        <span class="overlay-text">{{ bcn_pll('Voir sur Instagram') }}</span>
      </div>
    </div>
  </a>
</div>
