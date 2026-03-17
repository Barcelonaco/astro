@php
  use App\Helpers\GlobalHelper;
  $displayTopMenu = has_nav_menu('header-secondary-navigation') ||
                    (!empty(get_field('top_link_1', 'options')) && !empty(get_field('top_link_1', 'options')['url'])) ||
                    (!empty(get_field('top_link_2', 'options')) && !empty(get_field('top_link_2', 'options')['url'])) ||
                    !empty($showPhone) ||
                    !empty($showSocials);
@endphp

@if (!IS_ONEPAGE)

  <header id="header"
          class="header-page {{ $seamlessMenu ? 'background-transparent' : '' }} {{ get_field('menu_style', 'options') == 'burger' ? 'has-mega-menu' : null }} {{ get_field('menu_style', 'options') == 'center' ? 'has-center-menu' : null }} {{ $displayTopMenu ? 'has-top-menu' : null }} {{ get_field('hero_banner_marquise') && (get_field('header_type') == 'hero') ? ' hero_banner_marquise' : null }}" role="banner">
    {{-- Mega menu --}}
    @if (get_field('menu_style', 'options') == 'burger')
      <div class="mega-menu-wrapper">
        <div class="mega-menu">
          <div class="mega-menu-primary">
            @include('components.header.menu-primary')
          </div>
          <div class="top-menu">
            @include('components.header.menu-secondary')
            <div class="links-secondary">
              @include('components.header.links-secondary')
            </div>
          </div>{{-- /.top-menu --}}
        </div>{{-- /.mega-menu --}}
      </div>{{-- /.mega-menu-wrapper --}}
    @endif

    <div class="header-wrapper">
      <div class="container-large">
        <div class="header-content">
          <button type="button" title="{{ bcn_pll('Menu') }}" class="hamburger mobile js_toggle-menu">
                        <span class="line-wrapper">
                            <span class="line line-1"></span>
                            <span class="line line-2"></span>
                            <span class="line line-3"></span>
                        </span>
          </button>{{-- /.hamburger --}}

          @if (get_field('menu_style', 'options') == 'center')
            {{-- Menu centré gauche--}}
            <div class="menu-primary classic desktop{{ has_nav_menu('header-right-navigation') ? '' : ' align-left'}}">
              @if (has_nav_menu('header-left-navigation'))
                {!! wp_nav_menu(['theme_location' => 'header-left-navigation', 'container_class' => 'menu-wrapper', 'depth' => 3]) !!}
              @endif
            </div>{{-- /.menu-primary --}}
          @endif

          @if ($logo)

            <a href="{{ home_url('/') }}" title="{{ get_bloginfo('name', 'display') }}"
               class="logo-wrapper">
              @if (get_field('change_logo_header') && get_field('logo_header'))
                {{-- Surcharge logo --}}
                <img src="{{ GlobalHelper::getImageOrReplacement('', get_field('logo_header')) }}"
                     alt="{{ get_bloginfo('name', 'display') }}"
                     title="{{ get_bloginfo('name', 'display') }}" class="logo">
              @elseif ($logoWhite)
                <img src="{{ $logo }}" alt="{{ get_bloginfo('name', 'display') }}"
                     title="{{ get_bloginfo('name', 'display') }}" class="logo logo-dark">
                <img src="{{ $logoWhite }}" alt="{{ get_bloginfo('name', 'display') }}"
                     title="{{ get_bloginfo('name', 'display') }}"
                     class="logo logo-white">
              @else
                <img src="{{ $logo }}" alt="{{ get_bloginfo('name', 'display') }}"
                     title="{{ get_bloginfo('name', 'display') }}" class="logo">
              @endif
            </a>
          @endif

          @if (get_field('menu_style', 'options') == 'burger')

            <div class="menu-primary classic desktop">
              <div class="btn-wrapper desktop">
                @include('components.header.links-primary')
                <button type="button" title="{{ bcn_pll('Menu') }}"
                        class="hamburger desktop js_toggle-mega-menu">
                                    <span class="line-wrapper">
                                        <span class="line line-1"></span>
                                        <span class="line line-2"></span>
                                        <span class="line line-3"></span>
                                    </span>
                </button>{{-- /.hamburger --}}
              </div>{{-- /.btn-wrapper --}}
            </div>{{-- /.menu-primary --}}
          @elseif (get_field('menu_style', 'options') == 'center')
            {{-- Menu centré droite--}}
            @if (has_nav_menu('header-right-navigation'))
              <div class="menu-primary menu-primary-right classic desktop">
                {!! wp_nav_menu(['theme_location' => 'header-right-navigation', 'container_class' => 'menu-wrapper', 'depth' => 3]) !!}
              </div>{{-- /.menu-primary --}}
            @else
              <div class="menu-primary menu-primary-right top-menu classic desktop">
                @include('components.header.links-secondary')
              </div>
            @endif
          @else

            {{-- Menu classic --}}
            <div class="menu-primary classic desktop">
              @include('components.header.menu-primary')
              @if (!$displayTopMenu)
                @include('components.header.links-primary')
              @endif
            </div>{{-- /.menu-primary --}}

            @if ($displayTopMenu)
              <div class="top-menu classic desktop">
                @include('components.header.menu-secondary')
                @include('components.header.links-secondary')
                @include('components.header.links-primary')
              </div>{{-- /.top-menu --}}
            @endif
          @endif

          <div class="btn-wrapper mobile">
            @include('components.header.links-primary')
          </div>
        </div>{{-- /.header-content --}}

        {{-- Menu mobile --}}
        <div class="menu-mobile-wrapper">
          <div class="menu-mobile container-large">
            <div class="menu-primary mobile">
              @if (get_field('menu_style', 'options') !== 'center')
                @include('components.header.menu-primary')
              @else
                @if (has_nav_menu('header-left-navigation'))
                  {!! wp_nav_menu(['theme_location' => 'header-left-navigation', 'container_class' => 'menu-wrapper', 'depth' => 3]) !!}
                @endif
                @if (has_nav_menu('header-right-navigation'))
                  {!! wp_nav_menu(['theme_location' => 'header-right-navigation', 'container_class' => 'menu-wrapper', 'depth' => 3]) !!}
                @endif
              @endif
            </div>
            <div class="top-menu mobile">
              @include('components.header.menu-secondary')
              @include('components.header.links-secondary')
              @if (has_nav_menu('header-translate'))
                {!! wp_nav_menu(['theme_location' => 'header-translate', 'container_class' => 'menu-wrapper', 'depth' => 3]) !!}
              @endif
            </div>{{-- /.top-menu --}}
          </div>{{-- /.menu --}}
        </div>{{-- /.menu-mobile-wrapper --}}

      </div>{{-- /.container-large --}}
      @if (get_field('menu_style', 'options') == 'center')
        @if (get_field('secret_menu', 'options') == 1)
          <div class="secret-menu-trigger js_secret-menu-trigger">
            <button type="button" title="{{ bcn_pll('Menu') }}" class="hamburger">
                            <span class="line-wrapper">
                                <span class="line line-1"></span>
                                <span class="line line-2"></span>
                            </span>
            </button>{{-- /.hamburger --}}
          </div>
          <div class="top-menu classic desktop secret-menu">
            @include('components.header.links-secondary')
            @include('components.header.links-primary')
          </div>
        @endif
      @endif
    </div>{{-- /.header-wrapper --}}
  </header>{{-- /#header --}}

@elseif (IS_ONEPAGE)
  <header id="header" class="header-page d-none {{ $seamlessMenu ? 'background-transparent' : '' }}"></header>
@endif