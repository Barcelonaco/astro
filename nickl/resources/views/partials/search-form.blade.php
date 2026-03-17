<form role="search" method="get" id="search-form" class="search-form" action="/">
    <button type="button" type="button" class="btn-close js_btn-toggle-search" title="{{ bcn_pll('Fermer', 'sage') }}"></button>{{-- /.hamburger --}}
    <div class="form-content">
        <label for="search-field" class="screen-reader-text">{{ bcn_pll('Recherche', 'sage') }}</label>
        <input type="search" id="search-field" class="search-field" value="" name="s" placeholder="Je recherche">
        <button type="submit" class="search-submit" title="{{ bcn_pll('Chercher', 'sage') }}">
            <span class="icon" aria-hidden="true">{!! $displaySvg('search.svg') !!}</span>
        </button>
    </div>{{-- /.form-content --}}
</form>{{-- /.search-form --}}
