@php
  defined('ABSPATH') || exit();
@endphp

@extends('layouts.app')

@section('content')
  <div id="main" class="main-page page-cart" role="main" style="opacity: 1">
    <section>
      <article>
        <div class="container">
            @php
              echo do_shortcode('[woocommerce_cart]');
            @endphp
        </div>
      </article>
    </section>

    </div>
@endsection
