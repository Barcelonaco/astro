@php
    use App\Helpers\GlobalHelper as Helper;
    use App\Helpers\ThemeHelper;

    $pid = get_option('woocommerce_shop_page_id');
    $headerType = get_field('header_type');
    $headerHeight = get_field('banner_height', $pid);
    $modules = get_field('flexible_modules', $pid);
    // Définitions pour éviter variables non définies
    $titleInHeader = get_field('title_in_header', $pid);
    $h1InHeader = get_field('h1_in_header', $pid);

    $term = get_queried_object();
    if (isset($term->name) && ($term->name === 'product' || empty($term->name))) {
        $termName = null;
        $termDesc = null;
    } else {
        $termName = isset($term->name) ? ' > ' . $term->name : null;
        $termDesc = isset($term->description) ? $term->description : null;
    }

    $terms = get_terms(['taxonomy' => 'product_cat','hide_empty' => false]);
    $termLongDesc = get_term_meta($term->term_id, 'long_description', true);
@endphp

@extends('layouts.app')

@section('content')
    @php do_action('get_header', 'shop'); @endphp

    <main id="main" class="main-page page-woocommerce-archive-product" role="main">
        <section>
            {{-- Banner --}}
            @if ($headerHeight !== 'none')
                @include('modules.banner', [
                    'id' => $pid,
                    'term' => $termName,
                    'h1_in_header' => $h1InHeader
                ])
            @endif
            <div class="container">
                {{-- Title si pas de banner --}}
                @if ($headerHeight === 'none')
                    @if ($titleInHeader !== 'hideTitle' && $titleInHeader != 0)
                        @if ($h1InHeader === 'yes' || $h1InHeader != 0)
                            <h1 class="title title-section-1">{!! ThemeHelper::title($pid) !!} {!! $termName ?? '' !!}</h1>
                        @else
                            <p class="title title-section-1">{!! ThemeHelper::title($pid) !!} {!! $termName ?? '' !!}</p>
                        @endif
                    @endif
                @endif

                {{-- Term description --}}
                @if (!empty($termDesc))
                    <div class="txt editor desc">{!! $termDesc !!}</div>
                @endif

                {{-- Flexible modules --}}
                @if(is_array($modules) && count($modules) > 0)
                    <div class="modules-wrapper">
                        @foreach($modules as $module)
                            @if(isset($module['acf_fc_layout']) && !empty($module['acf_fc_layout']) && ($module['is_visible'] ?? 'yes') !== 'no')
                                @include('modules.' . $module['acf_fc_layout'], ['content' => $module])
                            @endif
                        @endforeach
                    </div>
                @endif
            </div>{{-- /.container --}}

            {{-- Sidebar + products --}}
            <div class="container">
                @if (Helper::getShopSidebar($term, $terms))
                    <div class="wrapper-sidebar">
                        <aside class="sidebar">
                            <button class="btn btn-primary color-tertiary open-filter-mobile">{{ bcn_pll('Filtrer les résultats') }}</button>
                            @include('partials.sidebar')
                        </aside>
                        <div class="content-primary">
                            @else
                                <div class="padding-top-small padding-bottom-small">
                                    @endif

                                    {{-- WOOF products loop --}}
                                    <section>
                                        <div class="woof_products_loop">
                                            {!! do_shortcode('[woof_products sid="widget" taxonomies="product_cat:' . $term->term_id . '"]') !!}
                                        </div>
                                    </section>

                                    @if (Helper::getShopSidebar($term, $terms))
                                </div>{{-- /.content-primary --}}
                        </div>{{-- /.wrapper-sidebar --}}
                        @else
                    </div>{{-- /.padding-top-small --}}
                @endif
            </div>{{-- /.container --}}
            @if (!empty($termLongDesc))
                <div class="container">
                    <div class="txt editor desc">
                    {!! wpautop($termLongDesc) !!}
                    </div>
                </div>
            @endif
        </section>
    </main>

    @php do_action('get_footer', 'shop'); @endphp
@endsection