@php
  use App\Helpers\CookieHelper;
  use App\Helpers\ThemeHelper;
@endphp

<head>
  <meta charset="utf-8">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">

  @if (!empty($heroImageUrl))
    <link rel="preload" as="image" href="{{ $heroImageUrl }}" fetchpriority="high">
  @endif

  @php
    $pluginActive = function_exists('is_plugin_active') && is_plugin_active('indus-core/indus-core.php');
    $fontGeneralValue = $fontGeneral['value'] ?? null;
    $fontTitleValue = $fontTitle['value'] ?? null;
  @endphp

  @if ($fontGeneralValue || $fontTitleValue)
    @php $fonts = $fontGeneralValue === $fontTitleValue ? [$fontGeneralValue] : array_filter([$fontGeneralValue, $fontTitleValue]); @endphp

    @foreach ($fonts as $font)
      @if ($pluginActive && view()->exists('indus-core::partials.fonts.' . $font))
        @include('indus-core::partials.fonts.' . $font)
      @elseif (view()->exists('partials.fonts.' . $font))
        @include('partials.fonts.' . $font)
      @endif
    @endforeach
  @else
    @include('partials.fonts.jakarta')
  @endif

  <style type="text/css">
    :root {
      --color-default:
        {{ $textColor }}
      ;
      --color-primary:
        {{ $primary }}
      ;
      --color-primary-bis:
        {{ $colorPrimaryBis }}
      ;
      --color-secondary:
        {{ $secondary }}
      ;
      --color-secondary-bis:
        {{ $colorSecondaryBis }}
      ;
      --color-tertiary:
        {{ $tertiary }}
      ;
      --color-background:
        {{ $backgroundColor }}
      ;
      --color-form:
        {{ $colorFormField }}
      ;
      --font-general: '{{ $fontGeneral['label'] ?? 'jakarta' }}';
      --font-title: '{{ $fontTitle['label'] ?? 'jakarta' }}';
      --logo-height:
        {{ ThemeHelper::getLogoHeight() ? ThemeHelper::getLogoHeight() . 'px' : '100px' }}
      ;
    }
  </style>

  @if (is_multisite())
    @if (get_field('favicon', 'options'))
      <link rel="icon" href="{{ get_field('favicon', 'options')['url'] }}" type="image/png">
    @endif
  @else
    @if (get_site_icon_url())
      <link rel="icon" href="{{ get_site_icon_url() }}" type="image/png">
    @endif
  @endif

  @php wp_head() @endphp

  @if (!has_site_icon())
    <link rel="icon" href="https://nickl.fr/app/uploads/2025/08/cropped-favicon-32x32.png" sizes="32x32" />
    <link rel="icon" href="https://nickl.fr/app/uploads/2025/08/cropped-favicon-192x192.png" sizes="192x192" />
    <link rel="apple-touch-icon" href="https://nickl.fr/app/uploads/2025/08/cropped-favicon-180x180.png" />
    <meta name="msapplication-TileImage" content="https://nickl.fr/app/uploads/2025/08/cropped-favicon-270x270.png" />
  @endif

  @php
    $gaCode = get_field('ga_code', 'options') ?? '';
  @endphp

  @if (empty(get_field('aw_code', 'options')))
    <!-- Global site tag (gtag.js) - Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id={{ $gaCode }}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() { dataLayer.push(arguments); }
      gtag('js', new Date());

      gtag('config', '{{ $gaCode }}');
    </script>
  @elseif ($awCode = get_field('aw_code', 'options'))
    <!-- Global site tag (gtag.js) - Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id={{ $gaCode }}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() { dataLayer.push(arguments); }
      gtag('js', new Date());

      gtag('config', '{{ $gaCode }}');
      gtag('config', '{{ $awCode }}');
    </script>
  @endif

  @if (CookieHelper::isCookieAccepted('analytics') && $MetaPixelCode = get_field('meta_pixel_code', 'options'))
    <!-- Meta Pixel Code -->
    <script>
      !function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () {
          n.callMethod ?
            n.callMethod.apply(n, arguments) : n.queue.push(arguments)
        };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
        n.queue = []; t = b.createElement(e); t.async = !0;
        t.src = v; s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s)
      }(window, document, 'script',
        'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '{{ $MetaPixelCode }}');
      fbq('track', 'PageView');
    </script>
    <noscript><img height="1" width="1" style="display:none"
        src="https://www.facebook.com/tr?id={{ $MetaPixelCode }}&ev=PageView&noscript=1" /></noscript>
    <!-- End Meta Pixel Code -->
  @endif

  @if (CookieHelper::isCookieAccepted('analytics') && $gtmCode = get_field('gtm_code', 'options'))
    <!-- Google Tag Manager -->
    <script>(function (w, d, s, l, i) {
        w[l] = w[l] || []; w[l].push({
          'gtm.start':
            new Date().getTime(), event: 'gtm.js'
        }); var f = d.getElementsByTagName(s)[0],
          j = d.createElement(s), dl = l != 'dataLayer' ? '&l=' + l : ''; j.async = true; j.src =
            'https://www.googletagmanager.com/gtm.js?id=' + i + dl; f.parentNode.insertBefore(j, f);
      })(window, document, 'script', 'dataLayer', '{{ $gtmCode }}');</script>
    <!-- End Google Tag Manager -->
  @endif

  @if (get_field('custom_balise', 'options'))
    {!! get_field('custom_balise', 'options') !!}
  @endif

  @include('components.shemas-org')

  <link rel="stylesheet" href="{{ asset("css/hero.css") }}">
  <link rel="stylesheet" href="{{ asset("css/banner.css") }}">

  @php
    use App\Helpers\GlobalHelper;

    $modules = get_field('flexible_modules') ?: [];
    $headerType = get_field('header_type') ?: null;

    $footer_id = get_field('footer_custom_bloc', 'option');

    $footer_modules = [];
    if ($footer_id) {
      foreach (['flexible_modules', 'modules', 'content', 'blocks'] as $key) {
        $val = get_field($key, $footer_id);
        if (is_array($val) && !empty($val)) {
          $footer_modules = $val;
          break;
        }
      }
    }

    $all_modules = array_merge(
      is_array($modules) ? $modules : [],
      is_array($footer_modules) ? $footer_modules : []
    );

    // Extraction des layouts
    $layouts = collect(GlobalHelper::extractLayouts($all_modules));

    if ($headerType && $headerType !== 'none') {
      $layouts->push($headerType === 'simple' ? 'banner' : $headerType);
    }

    $layouts = $layouts->unique()->values();
  @endphp

  @if($layouts)
    @foreach ($layouts as $layout)
      @if($layout == 'contact_elus')
        <link rel="stylesheet" href="{{ asset("css/team.css") }}" media="print" onload="this.media='all'">
      @endif
      <link rel="stylesheet" href="{{ asset("css/{$layout}.css") }}" media="print" onload="this.media='all'">
    @endforeach
  @endif

  @if (is_single() && in_array(get_post_type(), array('references', 'actualites', 'evenements'), true))
    <link rel="stylesheet" href="{{ asset("css/share.css") }}" media="print" onload="this.media='all'">
  @endif

  @if (class_exists('WooCommerce'))
    @php
      $layout = null;
      if (is_account_page()) {
        if (is_wc_endpoint_url('edit-account')) {
          $layout = 'woocommerce-account-edit-account';
        } elseif (is_wc_endpoint_url('orders')) {
          $layout = 'woocommerce-account-orders';
        } elseif (is_wc_endpoint_url('edit-address')) {
          $layout = 'woocommerce-account-addresses';
        } else {
          $layout = 'woocommerce-account';
        }
      } elseif (is_cart()) {
        $layout = 'woocommerce-cart';
      } elseif (is_checkout()) {
        $layout = 'woocommerce-checkout';
      } elseif (is_product()) {
        $layout = 'woocommerce-single-product';
      } elseif (is_shop() || is_product_category() || is_product_tag()) {
        $layout = 'woocommerce-archive-product';
      }
    @endphp

    @if ($layout)
      <link rel="stylesheet" href="{{ asset("css/{$layout}.css") }}" media="print" onload="this.media='all'">
      <noscript>
        <link rel="stylesheet" href="{{ asset("css/{$layout}.css") }}">
      </noscript>
    @endif
  @endif
</head>