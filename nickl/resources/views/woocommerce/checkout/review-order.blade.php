<table class="shop_table woocommerce-checkout-review-order-table">
  <thead>
  <tr>
    <th class="product-name">{{ __('Product', 'woocommerce') }}</th>
    <th class="product-total">{{ __('Subtotal', 'woocommerce') }}</th>
  </tr>
  </thead>
  <tbody>
  @php do_action('woocommerce_review_order_before_cart_contents') @endphp

  @foreach (WC()->cart->get_cart() as $cart_item_key => $cart_item)
    @php
      $_product = apply_filters('woocommerce_cart_item_product', $cart_item['data'], $cart_item, $cart_item_key);
    @endphp

    @if ($_product && $_product->exists() && $cart_item['quantity'] > 0 && apply_filters('woocommerce_checkout_cart_item_visible', true, $cart_item, $cart_item_key))
      <tr class="{{ esc_attr(apply_filters('woocommerce_cart_item_class', 'cart_item', $cart_item, $cart_item_key)) }}">
        <td class="product-name">
          {!! apply_filters('woocommerce_checkout_cart_item_quantity', '<strong class="product-quantity">' . sprintf('%s&nbsp;&times;', $cart_item['quantity']) . '</strong>', $cart_item, $cart_item_key) !!}
          {!! wp_kses_post(apply_filters('woocommerce_cart_item_name', $_product->get_name(), $cart_item, $cart_item_key)) !!}
          {!! wc_get_formatted_cart_item_data($cart_item) !!}
        </td>
        <td class="product-total">
          {!! apply_filters('woocommerce_cart_item_subtotal', WC()->cart->get_product_subtotal($_product, $cart_item['quantity']), $cart_item, $cart_item_key) !!}
        </td>
      </tr>
    @endif
  @endforeach

  @php do_action('woocommerce_review_order_after_cart_contents') @endphp
  </tbody>
  <tfoot>

  <tr class="cart-subtotal">
    <th>{{ __('Subtotal', 'woocommerce') }}</th>
    <td>{!! wc_cart_totals_subtotal_html() !!}</td>
  </tr>

  @foreach (WC()->cart->get_coupons() as $code => $coupon)
    <tr class="cart-discount coupon-{{ esc_attr(sanitize_title($code)) }}">
      <th>{!! wc_cart_totals_coupon_label($coupon) !!}</th>
      <td>{!! wc_cart_totals_coupon_html($coupon) !!}</td>
    </tr>
  @endforeach

  @if (WC()->cart->needs_shipping() && WC()->cart->show_shipping())
    @php do_action('woocommerce_review_order_before_shipping') @endphp
    {!! wc_cart_totals_shipping_html() !!}
    @php do_action('woocommerce_review_order_after_shipping') @endphp
  @endif

  @foreach (WC()->cart->get_fees() as $fee)
    <tr class="fee">
      <th>{{ esc_html($fee->name) }}</th>
      <td>{!! wc_cart_totals_fee_html($fee) !!}</td>
    </tr>
  @endforeach

  @if (wc_tax_enabled() && ! WC()->cart->display_prices_including_tax())
    @if (get_option('woocommerce_tax_total_display') === 'itemized')
      @foreach (WC()->cart->get_tax_totals() as $code => $tax)
        <tr class="tax-rate tax-rate-{{ esc_attr(sanitize_title($code)) }}">
          <th>{{ esc_html($tax->label) }}</th>
          <td>{!! wp_kses_post($tax->formatted_amount) !!}</td>
        </tr>
      @endforeach
    @else
      <tr class="tax-total">
        <th>{{ esc_html(WC()->countries->tax_or_vat()) }}</th>
        <td>{!! wc_cart_totals_taxes_total_html() !!}</td>
      </tr>
    @endif
  @endif

  @php do_action('woocommerce_review_order_before_order_total') @endphp

  <tr class="order-total">
    <th>{{ __('Total', 'woocommerce') }}</th>
    <td>{!! wc_cart_totals_order_total_html() !!}</td>
  </tr>

  @php do_action('woocommerce_review_order_after_order_total') @endphp

  </tfoot>
</table>
