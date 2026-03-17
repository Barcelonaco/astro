@php
  use App\Helpers\GlobalHelper;
  $link1 = get_field('top_link_1', 'options');
  $icon1 = get_field('icon_link_1', 'options');
  $link2 = get_field('top_link_2', 'options');
  $icon2 = get_field('icon_link_2', 'options');
  $phone = get_field('phone', 'options');
  $socialNetwork = [
      'instagram' => get_field('instagram', 'options'),
      'facebook' => get_field('facebook', 'options'),
      'threads' => get_field('threads', 'options'),
      'tiktok' => get_field('tiktok', 'options'),
      'linkedin' => get_field('linkedin', 'options'),
      'twitter' => get_field('twitter', 'options'),
      'tripadvisor' => get_field('tripadvisor', 'options'),
      'pinterest' => get_field('pinterest', 'options'),
      'youtube' => get_field('youtube', 'options'),
  ];
@endphp


@if (!empty($link1) || !empty($link1['url']) || !empty($socialNetwork) || !empty($phone))
  <div class="links-secondary">
    @if (!empty($link1) && !empty($link1['url']))
      <a href="{{ $link1['url'] }}"
         class="btn btn-primary color-primary"
         target="{{ !empty($link1['target']) ? $link1['target'] : '_self' }}">
        @if (!empty($icon1) && !empty($icon1['url']))
          @if (GlobalHelper::displaySvgPng($icon1['ID']))
            {!! GlobalHelper::displaySvgPng($icon1['ID']) !!}
          @else
            <img src="{!! $icon1['url'] !!}" class="illus" />
          @endif
        @endif
        {{ !empty($link1['title']) ? $link1['title'] : bcn_pll('En savoir plus') }}
      </a>
    @endif
    @if (!empty($link2) && !empty($link2['url']))
      <a href="{{ $link2['url'] }}"
         class="btn btn-primary color-secondary"
         target="{{ !empty($link2['target']) ? $link2['target'] : '_self' }}">
        @if (!empty($icon2) && !empty($icon2['url']))
          @if (GlobalHelper::displaySvgPng($icon2['ID']))
            {!! GlobalHelper::displaySvgPng($icon2['ID']) !!}
          @else
            <img src="{!! $icon2['url'] !!}" class="illus" />
          @endif
        @endif
        {{ !empty($link2['title']) ? $link2['title'] : bcn_pll('En savoir plus') }}
      </a>
    @endif
    @if (!empty($showPhone))
      @if ($phone)
        <p class="phone-wrapper">
          <a href="tel:{{ str_replace(' ', '', $phone) }}" class="phone">{{ $phone }}</a>
        </p>
      @endif
    @endif
    @if (!empty($showSocials))
      @include('components.social-networks', ['socialNetworks' => $socialNetwork])
    @endif
  </div>
@endif
