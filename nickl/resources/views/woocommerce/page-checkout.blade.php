@php
  defined('ABSPATH') || exit;
  WC()->checkout()->get_checkout_fields();
  $checkout = $checkout ?? WC()->checkout();
  if (!WC()->session->has_session()) {
          WC()->session->set_customer_session_cookie(true);
      }
@endphp
@extends('layouts.app')

@section('content')
  <div id="main" class="main-page page-checkout" role="main" style="opacity: 1">
    <section>
      <article>
        <div class="container">
          @php
            echo do_shortcode('[woocommerce_checkout]');
          @endphp

        </div>
      </article>
    </section>
  </div>
@endsection
