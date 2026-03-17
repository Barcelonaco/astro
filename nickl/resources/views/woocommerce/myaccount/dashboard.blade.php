@php
  global $current_user;
  do_action('woocommerce_before_account_navigation');
  $current_endpoint = WC()->query->get_current_endpoint();

  // Récupération du type d'adresse (facturation ou livraison) depuis l'URL
  // Si l'endpoint est 'edit-address', récupère le dernier slug dans l'URL (ex: 'facturation' ou 'livraison')
  $url_path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
  $path_parts = explode('/', trim($url_path, '/'));
  $address_type = end($path_parts); // Récupère le dernier élément (facturation ou livraison)
@endphp

<nav class="woocommerce-MyAccount-navigation" aria-label="{{ __('Account pages', 'woocommerce') }}">
  <ul>
    @foreach (wc_get_account_menu_items() as $endpoint => $label)
      <li class="{{ wc_get_account_menu_item_classes($endpoint) }}">
        <a href="{{ esc_url(wc_get_account_endpoint_url($endpoint)) }}" @if($current_endpoint === $endpoint) aria-current="page" @endif>
          {{ bcn_pll($label) }}
        </a>
      </li>
    @endforeach
  </ul>
</nav>

@php do_action('woocommerce_after_account_navigation'); @endphp

<div class="woocommerce-MyAccount-content">
  @switch($current_endpoint)
    @case('orders')
      @include('woocommerce.myaccount.orders')
      @break
    @case('downloads')
      @include('woocommerce.myaccount.downloads')
      @break
    @case('edit-address')
      {{-- Vérifie le type d'adresse récupéré dans l'URL et affiche le formulaire correspondant --}}
      @if ($address_type === 'facturation')
        @include('woocommerce.myaccount.form-edit-address', ['address' => 'billing'])
      @elseif ($address_type === 'livraison')
        @include('woocommerce.myaccount.form-edit-address', ['address' => 'shipping'])
      @else
        @include('woocommerce.myaccount.my-address')
      @endif
      @break
    @case('edit-account')
      @include('woocommerce.myaccount.my-account')
      @break
    @case('view-order')
      @php
        $order_id = get_query_var('view-order');
        $order = wc_get_order($order_id);
      @endphp
      @include('woocommerce.myaccount.view-order', ['order' => $order])
      @break
    @default
      <div class="woocommerce-dashboard">
        <div class="editor">
          <h1>
            {!! sprintf(
              wp_kses(bcn_pll('BONJOUR %1$s'), ['a' => ['href' => []]]),
              '<strong>' . esc_html($current_user->display_name) . '</strong>',
              esc_url(wc_logout_url())
            ) !!}
          </h1>

          <p>
            @php
              $dashboard_desc = bcn_pll('À partir du tableau de bord de votre compte, vous pouvez visualiser vos <a href="%1$s">commandes récentes</a>, gérer vos <a href="%2$s">adresses de livraison et de facturation</a>, et <a href="%3$s">changer votre mot de passe et les détails de votre compte</a>.');
              if (wc_shipping_enabled()) {
                $dashboard_desc = bcn_pll('À partir du tableau de bord de votre compte, vous pouvez visualiser vos <a href="%1$s">commandes récentes</a>, gérer vos <a href="%2$s">adresses de livraison et de facturation</a>, et <a href="%3$s">changer votre mot de passe et les détails de votre compte</a>.');
              }
            @endphp
            {!! sprintf(
              wp_kses($dashboard_desc, ['a' => ['href' => []]]),
              esc_url(wc_get_endpoint_url('orders')),
              esc_url(wc_get_endpoint_url('edit-address')),
              esc_url(wc_get_endpoint_url('edit-account'))
            ) !!}
          </p>
        </div>
      </div>
  @endswitch
</div>

@php
  do_action('woocommerce_account_dashboard');
  do_action('woocommerce_before_my_account');
  do_action('woocommerce_after_my_account');
@endphp
