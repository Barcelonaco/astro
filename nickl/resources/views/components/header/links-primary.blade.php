@php
    use App\Helpers\GlobalHelper;
@endphp

@if ($showSearch || has_nav_menu('header-translate') || IS_COMMERCIAL)
    <div class="btn-wrapper desktop">
        @if (has_nav_menu('header-translate'))
            <div class="translate-menu desktop">
                {!! wp_nav_menu(['theme_location' => 'header-translate', 'container_class' => 'menu-wrapper', 'depth' => 1]) !!}
            </div>
        @endif

        @if(isset($showSearch) && $showSearch)
        <button type="button" title="{{ bcn_pll('Recherche') }}" class="btn-search js_btn-toggle-search">
            <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('search.svg') !!}</span>
        </button>
        @endif

        @if ( IS_COMMERCIAL )
            <a href="{{ wc_get_cart_url() }}" title="{{ bcn_pll('Panier') }}" class="btn-cart">
                <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('cart.svg') !!}</span>
                @php
                    $countCartItems = WC()->cart->get_cart_contents_count();
                @endphp
                @if ($countCartItems > 0)
                    <span class="nbr header-cart-count" aria-hidden="true">{{ $countCartItems }}</span>
                @else
                    <span class="nbr header-cart-count" aria-hidden="true" style="display: none"></span>
                @endif
            </a>
            <a href="{{ wc_get_account_endpoint_url('dashboard') }}" title="{{ bcn_pll('Mon compte') }}" class="btn-account">
                <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('account.svg') !!}</span>
            </a>
        @endif
    </div>
@endif