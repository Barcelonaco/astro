<div class="loader" style="position: fixed; top: 0; left: 0; display: flex; width: 100%; height: 100%; z-index: 35; justify-content: center; align-items: center; background-color: #fff;">
    <div style="width: 85%; max-width: 225px;">
    @if ($logoLoader || $logo)
        <img src="{{ $logoLoader ? $logoLoader : $logo }}" alt="{{ get_bloginfo('name', 'display') }}" title="{{ get_bloginfo('name', 'display') }}"
        style="display: block; width: 100%; max-width: 100%; height: auto;" fetchpriority="high">
    @else
        <img src="https://nickl.lan/app/uploads/2023/12/LOGO-NIKL-Q.svg" alt="{{ get_bloginfo('name', 'display') }}" title="{{ get_bloginfo('name', 'display') }}"
        style="display: block; width: 100%; max-width: 100%; height: auto;" fetchpriority="high">
    @endif
    </div>
</div>{{-- /.loader --}}