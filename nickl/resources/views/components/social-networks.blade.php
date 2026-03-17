@php
  use App\Helpers\GlobalHelper;
@endphp
@if (!empty($socialNetworks['instagram']) || !empty($socialNetworks['facebook']) || !empty($socialNetworks['tiktok']) || !empty($socialNetworks['linkedin']) || !empty($socialNetworks['twitter'])  || !empty($socialNetworks['tripadvisor']) || !empty($socialNetworks['pinterest']) || !empty($socialNetworks['youtube']))

  <ul class="social-networks">

    @if (!empty($socialNetworks['instagram']))
      <li class="item-social">
        <a href="{{ $socialNetworks['instagram'] }}" title="Instagram" target="_blank" class="link">
          <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('instagram.svg') !!}</span>
        </a>
      </li>
    @endif

    @if (!empty($socialNetworks['facebook']))
      <li class="item-social">
        <a href="{{ $socialNetworks['facebook'] }}" title="Facebook" target="_blank" class="link">
          <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('facebook.svg') !!}</span>
        </a>
      </li>
    @endif

    @if (!empty($socialNetworks['threads']))
      <li class="item-social">
        <a href="{{ $socialNetworks['threads'] }}" title="Threads" target="_blank" class="link">
          <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('threads.svg') !!}</span>
        </a>
      </li>
    @endif

    @if (!empty($socialNetworks['tiktok']))
      <li class="item-social">
        <a href="{{ $socialNetworks['tiktok'] }}" title="TikTok" target="_blank" class="link">
          <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('tiktok.svg') !!}</span>
        </a>
      </li>
    @endif

    @if (!empty($socialNetworks['linkedin']))
      <li class="item-social">
        <a href="{{ $socialNetworks['linkedin'] }}" title="LinkedIn" target="_blank" class="link">
          <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('linkedin.svg') !!}</span>
        </a>
      </li>
    @endif

    @if (!empty($socialNetworks['twitter']))
      <li class="item-social">
        <a href="{{ $socialNetworks['twitter'] }}" title="Twitter" target="_blank" class="link">
          <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('x.svg') !!}</span>
        </a>
      </li>
    @endif

    @if (!empty($socialNetworks['tripadvisor']))
      <li class="item-social">
        <a href="{{ $socialNetworks['tripadvisor'] }}" title="Tripadvisor" target="_blank" class="link">
          <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('tripadvisor.svg') !!}</span>
        </a>
      </li>
    @endif

    @if (!empty($socialNetworks['pinterest']))
      <li class="item-social">
        <a href="{{ $socialNetworks['pinterest'] }}" title="Pinterest" target="_blank" class="link">
          <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('pinterest.svg') !!}</span>
        </a>
      </li>
    @endif

    @if (!empty($socialNetworks['youtube']))
      <li class="item-social">
        <a href="{{ $socialNetworks['youtube'] }}" title="YouTube" target="_blank" class="link">
          <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('youtube.svg') !!}</span>
        </a>
      </li>
    @endif

  </ul>{{-- /.social-networks --}}

@endif
