@php
  use App\Helpers\Dashboard;
@endphp

<div class="module gforms-module">
  <h3>{{ bcn_pll('Vos messages non-lus') }}</h3>
  {!! GFForms::dashboard() !!}
</div>
