@php
  use Automattic\WooCommerce\Internal\Admin\Orders\ListTable;
    use App\Helpers\Dashboard;
@endphp

@if (IS_COMMERCIAL)
  <div class="module woocommerce-module">
    @php
      $table =  wc_get_container()->get( ListTable::class );
    @endphp
    @if ($orders = Dashboard::getLatestOrders())
      <h3>{{ bcn_pll('Vos dernières commandes non traitées') }}</h3>
      <hr>
      <table>
        @foreach($orders as $order)
          @php
            $wcOrder = wc_get_order($order->ID);
          @endphp
          <tr>
            <td class="first">{!! $table->render_order_number_column($wcOrder) !!}</td>
            <td class="second">{!! $wcOrder->get_payment_method_title() !!}</td>
            <td class="third">{!! $table->render_order_total_column($wcOrder) !!}</td>
            <td class="four">{!! $table->render_order_status_column($wcOrder) !!}</td>
          </tr>
        @endforeach
      </table>
      <a class="link" href="{{ admin_url() . 'edit.php?post_type=shop_order' }}">{{ bcn_pll('Voir toutes vos commandes') }}</a>
    @else
      <h3>{{ bcn_pll('Vous n\'avez aucune commande en attente de traitement.') }}</h3>
    @endif
  </div>
@endif
