@php
    use App\Helpers\CookieHelper;
    use App\Helpers\GlobalHelper;

    if(isset($columns) && $columns == 'module-in-column'){
        $id_bloc = '';
    }
@endphp

<div id="{{ $id_bloc }}" class="module module-map {{ $module['is_fullscreen'] ? 'full-width' : '' }} @if ($module['bg_img'] && $module['bg_parallax']) {{ 'background-parallax' }} @endif {{ $module['bg_img'] ? 'has-background-image' : '' }} {{ $module['bloc_color'] }} {{ $module['padding_top'] ? $module['padding_top'] : '' }} {{ $module['padding_bottom'] ? $module['padding_bottom'] : '' }}">
    @if (!empty($title_bloc))
        <div class="container">
            @if (!isset($columns))
                @include('components.bloc-title-module', [
                    'title_bloc' => $title_bloc,
                    'title_style' => $title_style,
                    'title_align' => $title_align,
                ])
            @endif
        </div>
    @endif

    @if ($entrepriseAddress = $module['address'])
        @php
            $datasLatLng[] = [$entrepriseAddress['lng'], $entrepriseAddress['lat']];
        @endphp
        <div class="container-large container-1">
        <div class="map-wrapper js_show-content">
            <div id="{{ GlobalHelper::randomSlug() }}" class="map js_load-map" data-color="{{ $dataColor }}"
                 data-pin="{{ get_site_icon_url() }}"
                 data-markers="{{ json_encode($datasLatLng) }}"
                 data-lng="{{ $entrepriseAddress['lng'] }}" data-lat="{{ $entrepriseAddress['lat'] }}">
                 <a href="https://www.google.com/maps/place/?q=place_id:{{ $entrepriseAddress['place_id'] }}" class="btn btn-primary" title="Itinéraire" id="gps-go" target="_blank">{!! GlobalHelper::displaySvg('gps-go.svg') !!}</a></div>
            </div>
        </div>

        <div class="no-cookies-wrapper js_show-cookies">
            <div class="no-cookies">
                <span class="no-cookies-icon" aria-hidden="true">{!! GlobalHelper::displaySvg('cookies-light.svg') !!}</span>
                <p class="no-cookies-txt">
                    {!! bcn_pll('Pour afficher ce contenu vous devez<br>accepter les cookies') !!}
                    <button type="button" data-cc="show-preferencesModal" aria-haspopup="dialog">publicitaires</button> puis <button type="button" onclick="location.href = location.pathname + '?t=' + Date.now()">recharger la page</button>.
                </p>
            </div>{{-- /.no-cookies --}}
        </div>{{-- /.no-cookies-wrapper --}}

    @endif

</div>{{-- /.module-map --}}

<link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>
