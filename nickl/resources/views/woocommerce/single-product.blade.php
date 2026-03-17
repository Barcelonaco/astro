@php
  $modules = get_field('flexible_modules');
@endphp
@extends('layouts.app')

@section('content')
  @php
    do_action('get_header', 'shop');
  @endphp
  <main id="main" class="main-page page-woocommerce-single-product" role="main">
    <section>

        @include('modules.banner', ['h1_in_header' => get_field('h1_in_header')])
        @php
          do_action('woocommerce_before_main_content')
        @endphp
        @while(have_posts())
          @php
            the_post()
          @endphp
          @include('woocommerce.content-single-product')

        @endwhile
        @php
          do_action('woocommerce_after_main_content')
        @endphp
    </section>
    @if(is_array($modules) && count($modules) > 0)
      <div class="modules-wrapper" >
        @foreach($modules as $module)
          @if(isset($module['acf_fc_layout']) && !empty($module['acf_fc_layout']) && $module['is_visible'] !== 'no')
            @include('modules.' . $module['acf_fc_layout'], ['h1_in_header' => get_field('h1_in_header'), 'content' => $module])
          @endif
        @endforeach
      </div>
    @endif
  </main>{{-- /.page-woocommerce-single-product --}}
  @php
    do_action('get_footer', 'shop');
  @endphp
@endsection
