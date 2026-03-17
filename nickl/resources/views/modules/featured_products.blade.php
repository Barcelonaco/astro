@php
  use App\Helpers\GlobalHelper;
  use App\Helpers\ProductHelper as Product;
    if (!empty($backgroundImage)) {
        if(isset($reusable_bloc) && !empty($reusable_bloc)) {
            $background_image = GlobalHelper::displayBackground($backgroundImage['url']);
        } else {
            $background_image = 'background-image: url('. e($backgroundImage['url']) .')';
        }
    }
  if (isset($columns) && $columns == 'module-in-column') {
    $id_bloc = '';
  }
@endphp

<div id="{{ $id_bloc }}"
  class="module module-featured-product @if(!isset($columns) || $columns == 0) {{  $classes }} @endif">

  @if (!empty($backgroundImage) && !isset($columns))
    <div class="background"
      style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
    </div>
  @endif

  <div class="container">

    @if ($products = $module['products_id'])
      @include('woocommerce.single-product.related', ['related_products' => Product::getFeaturedProducts($products)['related_products'], 'title_style' => $title_style, 'title_align' => $title_align, 'title_bloc' => $title_bloc])
    @endif

    @if (!empty($module['cta']) && !empty($module['cta']['url']))
      <div class="btn-wrapper">
        <a href="{{ $module['cta']['url'] }}" class="btn btn-tertiary color-primary"
          target="{{ !empty($module['cta']['target']) ? $module['cta']['target'] : '_self' }}">
          {{ !empty($module['cta']['title']) ? $module['cta']['title'] : bcn_pll('En savoir plus') }}
        </a>
      </div>{{-- /.btn-wrapper --}}
    @endif
  </div>{{-- /.container --}}
</div>{{-- /.module-product --}}