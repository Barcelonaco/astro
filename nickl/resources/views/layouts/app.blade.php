@php
  use App\Helpers\DeviceHelper;
  use App\Helpers\CookieHelper;

  $isMaintenance = get_field('is_maintenance', 'options');
  $withoutHeadAndFoot = isset($_GET['without_head_and_foot']) && $_GET['without_head_and_foot'] == 1;
  $rounded = $rounded ?? false;
  $uppercase = $uppercase ?? false;
  $isDarkBackground = $isDarkBackground ?? false;
  global $post;
@endphp

@if(!$withoutHeadAndFoot)
  <!doctype html>
  <html {!! get_language_attributes() !!}>

  @include('partials.head')

  @php
    $bodyClass = DeviceHelper::addDeviceClass();
    $bodyClass .= $rounded ? ' border-rounded' : '';
    $bodyClass .= $uppercase ? ' mode-uppercase' : '';
    $bodyClass .= $isDarkBackground ? ' background-dark' : ' background-light';
    $bodyClass .= get_field('override_colors') ? ' override_colors' : '';
  @endphp

  <body {{ body_class($bodyClass) }} role="document">

    @if (CookieHelper::isCookieAccepted('analytics') && ($gtmCode = get_field('gtm_code', 'options')))
      <!-- Google Tag Manager (noscript) -->
      <noscript>
        <iframe src="https://www.googletagmanager.com/ns.html?id={{ $gtmCode }}" height="0" width="0"
          style="display:none;visibility:hidden"></iframe>
      </noscript>
      <!-- End Google Tag Manager (noscript) -->
    @endif

    <div id="wrapper">
      @if (!$isMaintenance && is_front_page() && get_field('home_loader', 'options'))
        @include('partials.loader')
      @endif

      @php do_action('get_header') @endphp
@endif

    @if (is_user_logged_in() || !$isMaintenance)
      @if (!$withoutHeadAndFoot)
        @if (get_field('show_alert', 'options'))
          @include('components.popin-alert')
        @endif
        @if (defined('NICKL_PDV') && NICKL_PDV === 'PDV')
          @php
            $option_carte_inte = get_field("hide_navigation_and_footer", 'options_carte_interactive');
          @endphp
          @if(!isset($option_carte_inte) || $option_carte_inte == '0')
            @include('partials.header')
          @endif
        @else
          @include('partials.header')
        @endif

      @endif

      @if (post_password_required($post))
        @include('components.protected-form')
      @else

        @yield('content')

      @endif
    @else
      @include('maintenance')
    @endif

    @if(!$withoutHeadAndFoot)
          @php do_action('get_footer') @endphp

          @if (is_user_logged_in() || !$isMaintenance)

            @if (defined('NICKL_PDV') && NICKL_PDV === 'PDV')
              @php echo do_shortcode('[push_notifications_buttons]') @endphp
              @php
                $option_carte_inte = get_field("hide_navigation_and_footer", 'options_carte_interactive');
              @endphp

              @if(!isset($option_carte_inte) || $option_carte_inte == '0')
                @include('partials.footer')
              @endif
            @else
              @include('partials.footer')
            @endif
            @include('partials.search-form')
          @endif
          @include('partials.floating-btn')

          @php wp_footer() @endphp
        </div>{{-- /#wrapper --}}


      </body>

      </html>
    @endif