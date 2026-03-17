@php

  use App\Helpers\GlobalHelper;

@endphp

@if (IS_COMMERCIAL)
  <div class="nickl-widget-dashboard-content">
    <div class="col col-1">
      <div class="module link-module">
        <h3>{{ bcn_pll('Boutique en ligne') }}</h3>
        <hr>
        <div class="wrapper">
          <div class="row">
            <div class="links">
              <a href="{{ admin_url() . 'edit.php?post_type=product' }}"
                title="{{ bcn_pll('Voir la liste des produits') }}">
                <span class="icon">{!! GlobalHelper::displaySvg('products.svg') !!}</span>
                <span>{{ bcn_pll('Liste des produits') }}</span></a>
              <a href="{{ admin_url() . 'post-new.php?post_type=product' }}" title="{{ bcn_pll('Ajouter un produit') }}">
                <span class="icon add">{!! GlobalHelper::displaySvg('products.svg') !!}</span>
                <span>{{ bcn_pll('Ajouter') }}</span> </a>
              <a href="{{ admin_url() . 'edit.php?post_type=shop_order' }}"
                title="{{ bcn_pll('Voir toutes les commandes') }}">
                <span class="icon">{!! GlobalHelper::displaySvg('order_list.svg') !!}</span>
                <span>{{ bcn_pll('Commandes') }}</span></a>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col col-2">
      @include('widget.blocs.woocommerce')
    </div>
  </div>
@endif
<div class="nickl-widget-dashboard-content">
  <div class="col col-1">
    @include('widget.blocs.quick_access')
  </div>
  @if (defined('NICKL_PDV') && NICKL_PDV === 'PDV')
    <div class="col col-1">
      @include('widget.blocs.quick_access_pdv')
    </div>
  @endif
  <div class="col col-2">
    @if (is_multisite())
      @include('widget.blocs.news_slider')
    @endif
    @include('widget.blocs.gforms')
  </div>
  <div class="col col-2">
    @include('widget.blocs.ia_stats')
  </div>

</div>