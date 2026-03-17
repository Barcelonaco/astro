@php
  $user_id = get_current_user_id();
  $current_page = max(1, get_query_var('paged', 1)); // Récupérer la page actuelle
  $per_page = 10; // Nombre de commandes par page

  // Récupération des commandes
  $query = new WC_Order_Query([
      'customer_id' => $user_id,
      'status'      => ['wc-completed', 'wc-processing', 'wc-on-hold'],
      'orderby'     => 'date',
      'order'       => 'DESC',
      'limit'       => $per_page,
      'offset'      => ($current_page - 1) * $per_page, // Ajout de l'offset pour la pagination
  ]);

  $orders = $query->get_orders();
  $total_orders = wc_get_orders([
      'customer_id' => $user_id,
      'status'      => ['wc-completed', 'wc-processing', 'wc-on-hold'],
      'return'      => 'ids',
  ]);

  $total_pages = ceil(count($total_orders) / $per_page);
@endphp

@if (!empty($orders))
  <table class="woocommerce-orders-table woocommerce-MyAccount-orders shop_table shop_table_responsive my_account_orders account-orders-table">
    <thead>
    <tr>
      @foreach (wc_get_account_orders_columns() as $column_id => $column_name)
        <th scope="col" class="woocommerce-orders-table__header woocommerce-orders-table__header-{{ esc_attr($column_id) }}">
          <span class="nobr">{{ esc_html($column_name) }}</span>
        </th>
      @endforeach
    </tr>
    </thead>
    <tbody>
    @foreach ($orders as $order)
      @php
        $item_count = $order->get_item_count() - $order->get_item_count_refunded();
      @endphp
      <tr class="woocommerce-orders-table__row woocommerce-orders-table__row--status-{{ esc_attr($order->get_status()) }} order">
        @foreach (wc_get_account_orders_columns() as $column_id => $column_name)
          @php $is_order_number = ($column_id === 'order-number'); @endphp
          @if ($is_order_number)
            <th class="woocommerce-orders-table__cell woocommerce-orders-table__cell-{{ esc_attr($column_id) }}" data-title="{{ esc_attr($column_name) }}" scope="row">
          @else
            <td class="woocommerce-orders-table__cell woocommerce-orders-table__cell-{{ esc_attr($column_id) }}" data-title="{{ esc_attr($column_name) }}">
              @endif

              @if (has_action('woocommerce_my_account_my_orders_column_' . $column_id))
                @php do_action('woocommerce_my_account_my_orders_column_' . $column_id, $order); @endphp

              @elseif ($is_order_number)
                <a href="{{ esc_url($order->get_view_order_url()) }}" aria-label="{{ esc_attr(sprintf(__('View order number %s', 'woocommerce'), $order->get_order_number())) }}">
                  {{ __('#', 'woocommerce') . $order->get_order_number() }}
                </a>

              @elseif ($column_id === 'order-date')
                <time datetime="{{ esc_attr($order->get_date_created()->date('c')) }}">{{ esc_html(wc_format_datetime($order->get_date_created())) }}</time>

              @elseif ($column_id === 'order-status')
                {{ esc_html(wc_get_order_status_name($order->get_status())) }}

              @elseif ($column_id === 'order-total')
                {!! wp_kses_post(sprintf(_n('%1$s for %2$s item', '%1$s for %2$s items', $item_count, 'woocommerce'), $order->get_formatted_order_total(), $item_count)) !!}

              @elseif ($column_id === 'order-actions')
                @php $actions = wc_get_account_orders_actions($order); @endphp
                @if (!empty($actions))
                  @foreach ($actions as $key => $action)
                    <a href="{{ esc_url($action['url']) }}" class="woocommerce-button button {{ sanitize_html_class($key) }}" aria-label="{{ esc_attr(sprintf(__('View order number %s', 'woocommerce'), $order->get_order_number())) }}">
                      {{ esc_html($action['name']) }}
                    </a>
                    @endforeach
                    @endif
                    @endif

                    @if ($is_order_number)
                      </th>
                    @else
            </td>
          @endif
        @endforeach
      </tr>
    @endforeach
    </tbody>
  </table>

  @php do_action('woocommerce_before_account_orders_pagination'); @endphp

  @if ($total_pages > 1)
    <div class="woocommerce-pagination woocommerce-pagination--without-numbers woocommerce-Pagination">
      @if ($current_page > 1)
        <a class="woocommerce-button woocommerce-button--previous woocommerce-Button woocommerce-Button--previous button" href="{{ esc_url(wc_get_endpoint_url('orders', $current_page - 1)) }}">{{ __('Previous', 'woocommerce') }}</a>
      @endif
      @if ($current_page < $total_pages)
        <a class="woocommerce-button woocommerce-button--next woocommerce-Button woocommerce-Button--next button" href="{{ esc_url(wc_get_endpoint_url('orders', $current_page + 1)) }}">{{ __('Next', 'woocommerce') }}</a>
      @endif
    </div>
  @endif

@else
  {!! wc_print_notice(__('No order has been made yet.', 'woocommerce') . ' <a class="woocommerce-Button wc-forward button" href="' . esc_url(apply_filters('woocommerce_return_to_shop_redirect', wc_get_page_permalink('shop'))) . '">' . __('Browse products', 'woocommerce') . '</a>', 'notice') !!}
@endif

@php do_action('woocommerce_after_account_orders', !empty($orders)); @endphp
