@php
  use App\Helpers\GlobalHelper;
  use App\Helpers\ThemeHelper;
  $pid = get_option('woocommerce_shop_page_id');
  $term = get_queried_object();
  $termName = (!empty($term->name) && $term->name !== 'product') ?  $term->name : null;
  $termDesc = (!empty($term->description) && $term->name !== 'product') ? $term->description : null;
  $terms = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => false]);
  $taxonomy = 'product_cat';
  $title = ThemeHelper::title($pid);
  if ($term->name == 'product') {
    $termChild = true;
  } else {
    $termLongDesc = get_term_meta($term->term_id, 'long_description', true);
    $termChild =  get_term_children($term->term_id ?? $term, $taxonomy);
  }
  if (($term->name !== 'product') && get_term_meta($term->term_id, 'thumbnail_id', true)){
    $imgBanner =  ['url' => wp_get_attachment_image_url(get_term_meta($term->term_id, 'thumbnail_id', true), 'banner')];
  } else {
    $imgBanner =  ['url' => get_the_post_thumbnail_url($pid, 'banner')];
  }
  $headerType = get_field('header_type', $pid);
  $heightBanner = get_field('banner_height', $pid);
  $modules = get_field('flexible_modules', $pid);
@endphp
@extends('layouts.app')
@section('content')
  @php do_action('get_header', 'shop'); @endphp
  <main id="main" class="main-page page-woocommerce-archive-product" role="main">
    <section>
      @if ($heightBanner !== 'none')
        @include('modules.banner', ['id' => $pid,'title' => $title, 'term' => $termName, 'h1InHeader' => get_field('h1_in_header', $pid), 'imgBanner' => $imgBanner, 'heightBanner' =>$heightBanner])
      @endif
      <div class="container-large archive-product-top">
        @php
          do_action('woocommerce_before_main_content')
        @endphp
        @if ($heightBanner === 'none')
          <h1 class="title title-section-1">
            {!! $term->name == 'product' ? $title : $termName !!}
          </h1>
        @endif
        @if (!empty($termDesc))
          <div class="txt editor desc">
            {!! $termDesc !!}
          </div>
        @endif
        @if (is_array($modules) && count($modules) > 0)
          <div class="modules-wrapper">
            @foreach($modules as $module)
              @if(!empty($module['acf_fc_layout']) && $module['is_visible'] !== 'no')
                @include('modules.' . $module['acf_fc_layout'], ['content' => $module])
              @endif
            @endforeach
          </div>
        @endif
      </div>
      </div>
      <div class="container-large archive-product-content">
        @if ((GlobalHelper::getShopSidebar($term, $terms)) && !empty($termChild))
          <div class="wrapper-sidebar">
            <aside class="sidebar">
              @include('partials.sidebar')
            </aside>
            <div class="content-primary">
              @else
                <div class="padding-top-small padding-bottom-small">
                  @endif
                  <section>
                    <div class="woof_products_loop">
                      @if (woocommerce_product_loop())
                        @php
                          do_action('woocommerce_before_main_content');
                          do_action('woocommerce_before_shop_loop');
                          woocommerce_product_loop_start();
                        @endphp
                        @while (have_posts())
                          @php the_post(); @endphp
                          @php echo view('woocommerce.content-product')->render(); @endphp
                        @endwhile
                        @php
                          woocommerce_product_loop_end();
                          do_action('woocommerce_after_shop_loop');
                        @endphp
                      @else
                        @php do_action('woocommerce_no_products_found'); @endphp
                      @endif
                      {{-- WooCommerce Pagination native --}}
                      @php do_action('woocommerce_after_main_content'); @endphp
                    </div>
                  </section>
                  @if (GlobalHelper::getShopSidebar($term, $terms))
                </div>{{-- /.content-primary --}}
            </div>{{-- /.wrapper-sidebar --}}
            @else
          </div>{{-- /.no-sidebar --}}
        @endif
      </div>
      <div class="container-large">
      @if (!empty($termLongDesc))
        <div class="txt editor desc">
          {!! wpautop($termLongDesc) !!}
        </div>
      @endif
    </div>
    </section>
  </main>
  @php do_action('get_footer', 'shop'); @endphp
@endsection