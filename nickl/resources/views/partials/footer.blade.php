@php
  use App\Helpers\ThemeHelper;
  use App\Helpers\GlobalHelper;
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

      $link1 = get_field('link_1', 'options');
      $link2 = get_field('link_2', 'options');
      $content = [
              'bg_img' => get_field('bg_img', 'options'),
              'bg_parallax' => get_field('bg_parallax', 'options'),
              'bg_opacity' => get_field('bg_opacity', 'options'),
              'footer_custom_bloc' => get_field('footer_custom_bloc', 'options'),
              'footer_custom_bloc_location' => get_field('footer_custom_bloc_location', 'options'),
      ];

      if (get_field('change_logo_footer') && get_field('logo_footer'))
          /* Srucharge du logo */
          $logo = get_field('logo_footer')['url'];
      else if ($footColor == 'has-background-primary' || $footColor == 'has-background-secondary' || ($footColor == 'has-background-dark' && !ThemeHelper::isDarkBackground())) {
          $logo = $logoWhite;
      } else {
          $logo;
      }
      if ($content['footer_custom_bloc']) {
          $transient = get_transient('_reusable_bloc_list');
          if (empty($transient) || !isset($transient[$content['footer_custom_bloc']])) {
              $contents = '';
          }
          $contents = get_fields($content['footer_custom_bloc']);
      }
      if (get_field('newsletter_form', 'options')) {
        $newsForm = get_field('newsletter_form', 'options');
      }
      else{
        $newsForm = '';
      }
@endphp

@if (isset($content['footer_custom_bloc']) && $content['footer_custom_bloc_location'] == 'before')
  @if (isset($contents['flexible_modules']) && !empty($contents['flexible_modules']))
    @foreach($contents['flexible_modules'] as $content2)
    <div class="footer-before">
      @include('modules.' . $content2['acf_fc_layout'], ['module' => $content2, 'reusable_bloc' => 'reusable-bloc'])
    </div>
    @endforeach
  @endif
@endif

@if (is_plugin_active('bcnco-footer/bcnco-footer.php'))
@includeIf('pdv-footer::pdv-footer')
@endif

<footer id="footer" class="footer-page @if ($content['bg_img'] && $content['bg_parallax']){{ ' parallax' }}@endif{{ $content['bg_img'] ? ' has-background-image' : '' }}{{ ' '. ThemeHelper::getFooterColor() }}{{ $newsForm ? ' has-news-form' : ''}}" role="contentinfo">

  @if (!empty($content['bg_img'] && is_array($content['bg_img'])))
    <div class="background" style="{{ GlobalHelper::displayBackground($content['bg_img']['url'])}}; @if ($content['bg_img']) {{ 'opacity: ' . ($content['bg_opacity'] / 100) }} @endif"></div>
  @endif
  <button type="button" class="btn-scroll btn-scroll-up js_footer-btn-scroll">En haut</button>
  <div class="container">
    <div class="top">
      <div class="col col-1">
        @if ($logo)
          <div class="logo-wrapper">
            <img src="{{ $logo }}" alt="{{ get_bloginfo('name', 'display') }}" title="{{ get_bloginfo('name', 'display') }}" class="logo">
          </div>
        @endif

        @php
          $address = get_field('address', 'options') ?? [];
        @endphp
          @if (!empty($address))
            @php
              $addressStreet = ($address['street_number'] ?? '') . ' ' .($address['street_name'] ?? '');
              $addressStreetShort = ($address['street_number'] ?? '') . ' ' . ($address['street_name_short'] ?? '');
            @endphp
            <address class="address">
              @if (($address['name'] != $addressStreet) && ($address['name'] != $addressStreetShort))
                {{ $address['name']}}<br>
              @endif
              @if (!empty($address['street_name']))
                {{ ($address['street_number'] ?? '') . ' ' .($address['street_name'] ?? '') }}<br>
              @endif
              {{ ($address['post_code'] ?? '') . ' ' .($address['city'] ?? '') }}
            </address>
          @endif
          @if (get_field('address-2', 'options') && $phone = get_field('phone', 'options'))
            <p class="phone-wrapper">Tel.
              <a href="tel:{{ str_replace(' ', '', $phone) }}" class="phone">{{ $phone }}</a>
            </p>
          @endif
          @if ($address2 = get_field('address-2', 'options'))
            @php
              $address2Street = ($address2['street_number'] ?? '') . ' ' .($address2['street_name'] ?? '');
              $address2StreetShort = ($address2['street_number'] ?? '') . ' ' .($address2['street_name_short'] ?? '');
            @endphp
            <address class="address">
              @if (($address2['name'] != $address2Street) && ($address2['name'] != $address2StreetShort))
                {{ $address2['name']}}<br>
              @endif
              @if (!empty($address2['street_name']))
                {{ ($address2['street_number'] ?? '') . ' ' .($address2['street_name'] ?? '') }}<br>
              @endif
                {{ ($address2['post_code'] ?? '') . ' ' .($address2['city'] ?? '') }}
            </address>
            @if ($phone2 = get_field('phone-2', 'options'))
              <p class="phone-wrapper">Tel.
                <a href="tel:{{ str_replace(' ', '', $phone2) }}" class="phone">{{ $phone2 }}</a>
              </p>
            @endif
          @endif
        @if (!empty($link1) || !empty($link2))
          <div class="btn-wrapper">
            @if (!empty($link1) && !empty($link1['url']))
              <a href="{{ $link1['url'] }}" target="{{ !empty($link1['target']) ? $link1['target'] : "_self" }}" class="btn btn-primary">{{ $link1['title'] }}</a>
            @endif
            @if (!empty($link2) && !empty($link2['url']))
              <a href="{{ $link2['url'] }}" target="{{ !empty($link2['target']) ? $link2['target'] : "_self" }}" class="btn btn-secondary">{{ $link2['title'] }}</a>
            @endif
          </div>
        @endif
          @if (!get_field('address-2', 'options') && $phone = get_field('phone', 'options'))
          <p class="phone-wrapper">Tel.
            <a href="tel:{{ str_replace(' ', '', $phone) }}" class="phone">{{ $phone }}</a>
          </p>
        @endif
      </div>{{-- /.col-1 --}}
      @if (has_nav_menu('footer-navigation'))
        <div class="col col-2">
          {!! wp_nav_menu(['theme_location' => 'footer-navigation', 'container_class' => 'menu-wrapper', 'depth' => 1]) !!}
        </div>{{-- /.col-2 --}}
      @endif
      <div class="col col-3">
        @if ($textFooter = get_field('footer_text', 'options'))
          <div class="editor txt-1">
            <p>{!! nl2br($textFooter) !!}</p>
          </div>{{-- /.txt-1 --}}
        @endif
        @if ($schedule = get_field('schedule', 'options'))
          <div class="editor txt-2">
            <p><b>Horaires d’ouverture</b></p>
            <p>{!! nl2br($schedule) !!}</p>
          </div>{{-- /.txt-2 --}}
        @endif
        @include('components.social-networks', ['socialNetworks' => $socialNetwork])
      </div>{{-- /.col-3 --}}

      @if ($newsForm && shortcode_exists( 'acymailing_form_shortcode' ) )
        <div class="col col-4 newsletter-form">
          @if (get_field('newsletter_form_title', 'options'))
            <p class="title-section-4"><?= get_field('newsletter_form_title', 'options') ?></p>
          @endif
          @if (get_field('newsletter_form_desc', 'options'))
            <p class="desc"><?= get_field('newsletter_form_desc', 'options') ?></p>
          @endif
            <?= do_shortcode('[acymailing_form_shortcode id="1"]') ?>
        </div>{{-- /.col-4  --}}
      @endif

    </div><!-- /.top -->
    <div class="bottom">
      <ul class="nav">
        <li class="item">
           Copyright © {{ date('Y') }} {!! get_bloginfo('name', 'display') !!}
        </li>
        <li class="item">
          @if (defined('NICKL_PDV') && NICKL_PDV === 'PDV')
            <a href="https://place-du-village.fr" target="_blank" class="link">
              Un site web développé par Place du Village
            </a>
          @else
            <a href="https://nickl.fr" target="_blank" class="link">Un site web développé par Nickl / Barcelona&co</a>
          @endif
        </li>
        <li class="item">
          <button type="button" class="link"  data-cc="show-preferencesModal" aria-haspopup="dialog">
            <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('cookies2.svg') !!}</span>
            <span class="cookies-link">Gestion des cookies</span>
          </button>
        </li>
      </ul>{{-- /.nav --}}
      <ul class="nav footer-legals">
        @if (has_nav_menu('credit-navigation'))
          {!! wp_nav_menu(['theme_location' => 'credit-navigation']) !!}
        @endif
      </ul>{{-- /.nav --}}
    </div>{{-- /.bottom --}}
  </div><!-- /.container -->
</footer><!-- /#footer -->

@if (isset($content['footer_custom_bloc']) && $content['footer_custom_bloc_location'] == 'after')
  <div class="footer-custom-block">
    @if (isset($contents['flexible_modules']) && !empty($contents['flexible_modules']))
      @foreach($contents['flexible_modules'] as $content2)
        @include('modules.' . $content2['acf_fc_layout'], ['module' => $content2, 'reusable_bloc' => 'reusable-bloc'])
      @endforeach
    @endif
  </div>
@endif


@if (defined('NICKL_PDV') && NICKL_PDV === 'PDV')
  @if(get_field('accessibility', 'options'))
    @include('partials.accessibilityButton')
    @include('partials.accessibilityBox')
  @endif
@endif
