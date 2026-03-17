@php
  $customer_id = get_current_user_id();
  $get_addresses = wc_ship_to_billing_address_only() || !wc_shipping_enabled()
      ? ['billing' => __('Billing address', 'woocommerce')]
      : [
          'billing' => __('Billing address', 'woocommerce'),
          'shipping' => __('Shipping address', 'woocommerce')
      ];
  $get_addresses = apply_filters('woocommerce_my_account_get_addresses', $get_addresses, $customer_id);
@endphp

<h4>{{ apply_filters('woocommerce_my_account_my_address_description', __('The following addresses will be used on the checkout page by default.', 'woocommerce')) }}</h4>

@if (!wc_ship_to_billing_address_only() && wc_shipping_enabled())
  <div class="u-columns woocommerce-Addresses col2-set addresses">
    @endif

    @foreach ($get_addresses as $name => $address_title)
      @php
        $address = wc_get_account_formatted_address($name);
      @endphp

      <div class="u-column{{ $loop->index % 2 == 0 ? 1 : 2 }} col-{{ $loop->index % 2 == 0 ? 1 : 2 }} woocommerce-Address">
        <header class="woocommerce-Address-title title">
          <h2>{{ $address_title }}</h2>
          <a href="{{ esc_url(wc_get_endpoint_url('edit-address', $name)) }}" class="edit">
            {{ $address ? sprintf(__('Modifier', 'woocommerce'), $address_title) : sprintf(__('Ajouter', 'woocommerce'), $address_title) }}
          </a>
        </header>
        <address>
          {!! $address ? wp_kses_post($address) : __('You have not set up this type of address yet.', 'woocommerce') !!}
          @php do_action('woocommerce_my_account_after_my_address', $name); @endphp
        </address>
      </div>
    @endforeach

    @if (!wc_ship_to_billing_address_only() && wc_shipping_enabled())
  </div>
@endif
