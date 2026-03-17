@php
  global $post;
  use App\Helpers\GlobalHelper;
  use App\Helpers\ThemeHelper;
@endphp

@php
  $headerType = get_field('header_type');
  $img = ThemeHelper::getImgBanner();
  $address = get_field('schema_address') ? get_field('schema_address') : get_field('address', 'options');
  if (get_field('schema_socials')) {
    foreach (get_field('schema_socials') as $k => $social) {
      $socials[$k] = $social['link'];
    }
  } else {
    $socials = [
      'instagram' => get_field('instagram', 'options'),
      'facebook' => get_field('facebook', 'options'),
      'tiktok' => get_field('tiktok', 'options'),
      'linkedin' => get_field('linkedin', 'options'),
      'twitter' => get_field('twitter', 'options'),
      'tripadvisor' => get_field('tripadvisor', 'options'),
      'pinterest' => get_field('pinterest', 'options'),
      'youtube' => get_field('youtube', 'options'),
    ];
  }
  if ($address) {
    $street = ($address['street_number'] ?? '') . ' ' . ($address['street_name'] ?? '');
    $city = $address['city'] ?? '';
    $postCode = $address['post_code'] ?? '';
    $region = $address['state'] ?? '';
    $country = $address['country_short'] ?? '';
    $lat = $address['lat'] ?? '';
    $lng = $address['lng'] ?? '';
  }
  $pid = get_the_ID();
  $showBreadcrumb = get_field('show_breadcrumb', 'options') && function_exists('yoast_breadcrumb');
  $showShareBtn = get_field('pages_share_btn', 'options') && !get_field('share_btn_position', 'options');
@endphp

@extends('layouts.app')
@section('content')

  <main id="main" class="main-page" role="main">
    <section>
      <article>

        @if ($headerType == 'hero')
          @include('modules.hero')
        @elseif ($headerType == 'simple')
          @include('modules.banner')
        @endif
        @if ($showBreadcrumb || $showShareBtn)
          <div class="container sub-header">
            @if ($showBreadcrumb)
              @include('components.breadcrumb')
            @endif

            @if ($showShareBtn)
              @include('modules.share', ['share_btn_position' => 'top'])
            @endif
          </div>
        @endif
        @php
          $modules = get_field('flexible_modules');
        @endphp
        @if(is_array($modules) && count($modules) > 0)
          @php($number = 0)
          @foreach($modules as $module)
            @if(isset($module['acf_fc_layout']) && !empty($module['acf_fc_layout']) && ($module['is_visible'] ?? 'yes') !== 'no')
              @php($layout = $module['acf_fc_layout'] ?? null)
              @php
                try {
              @endphp
              @if($layout == 'meteo')
                @includeIf('meteo::modules.meteo', ['module' => $module, 'number' => $number])
              @elseif($layout == 'one-click-services')
                @includeIf('one-click-services::modules.one-click-services', ['module' => $module, 'number' => $number])
              @elseif($layout == 'contact_elus')
                @includeIf('contact-elus::modules.contact-elus', ['module' => $module, 'number' => $number])
              @elseif($layout == 'contribution_citoyenne')
                @includeIf('contribution-citoyenne::modules.contribution-citoyenne', ['module' => $module, 'number' => $number])
              @else
                @includeIf('modules.' . $layout, ['module' => $module, 'number' => $number])
              @endif
              @php
                } catch (\Throwable $e) {
                  if (defined('WP_DEBUG') && WP_DEBUG) {
                    echo '<!-- MODULE ERROR ['.$layout.']: '.esc_html($e->getMessage()).' -->';
                    error_log('Module render error ['.$layout.']: '.$e->getMessage().' in '.$e->getFile().':'.$e->getLine());
                  }
                }
              @endphp
              @php($number++)
            @endif
          @endforeach
        @endif
        @if (get_field('pages_share_btn', 'options') && get_field('share_btn_position', 'options'))
          @include('modules.share', ['share_btn_position' => 'bottom'])
        @endif
      </article>
    </section>
  </main>{{-- /.page-single --}}

@endsection