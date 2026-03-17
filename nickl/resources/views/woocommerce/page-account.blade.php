@extends('layouts.app')

@section('content')
  <div id="main" class="main-page page-account" role="main" style="opacity: 1">
    <section>
      <article>
        <div class="container">
          <div class="woocommerce">
            @if(!is_user_logged_in())
              @include('woocommerce.myaccount.form-login')
            @else
              @include('woocommerce.myaccount.dashboard')
            @endif
          </div>

        </div>
      </article>
    </section>
  </div>
@endsection
