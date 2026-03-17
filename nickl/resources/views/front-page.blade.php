@php
  use App\Helpers\ThemeHelper;
  $img = ThemeHelper::getImgBanner();
  $headerType = get_field('header_type');
  $address = get_field('schema_address') ? get_field('schema_address') : get_field('address', 'options');
  if (get_field('schema_socials')) {
    foreach (get_field('schema_socials') as $k => $social) {
      $socials[$k] = $social['link'];
    }
  } else {
    $socials = [
      'instagram' => get_field('instagram', 'options') ?? '',
      'facebook' => get_field('facebook', 'options') ?? '',
      'tiktok' => get_field('tiktok', 'options') ?? '',
      'linkedin' => get_field('linkedin', 'options') ?? '',
      'twitter' => get_field('twitter', 'options') ?? '',
      'tripadvisor' => get_field('tripadvisor', 'options') ?? '',
      'pinterest' => get_field('pinterest', 'options') ?? '',
      'youtube' => get_field('youtube', 'options') ?? '',
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
  //dd($modules);
@endphp

@extends('layouts.app')

@section('content')

<main id="main" class="main-page page-home" role="main">
  <section>

    @if ($headerType == 'hero')
      @include('modules.hero', ['h1_in_header' => get_field('h1_in_header')])
    @elseif ($headerType == 'simple')
      @include('modules.banner', ['h1_in_header' => get_field('h1_in_header')])
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
    @if($layout == 'scanzi_illustration')
      @includeIf('indus-core-illustration::illustrations')
    @elseif($layout == 'meteo')
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
  </section>

</main>{{-- /.page-home --}}

@endsection
