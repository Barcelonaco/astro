@php
    use App\Helpers\CookieHelper;
    use App\Helpers\GlobalHelper;

    if (!empty($backgroundImage)) {
        if(isset($reusable_bloc) && !empty($reusable_bloc)) {
            $background_image = GlobalHelper::displayBackground($backgroundImage['url']);
        } else {
            $background_image = 'background-image: url('. e($backgroundImage['url']) .')';
        }
    }

    if(isset($columns) && $columns == 'module-in-column') {
        $id_bloc = '';
    }
@endphp

<div id="{{ $id_bloc }}" class="module module-contact {{isset($columns) ? '' : $classes }}">

    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif

    <div class="container">
        @if (!isset($columns))
            @include('components.bloc-title-module', [
                'title_bloc' => $title_bloc,
                'title_style' => $title_style,
                'title_align' => $title_align,
            ])
        @endif
        <div class="cols-wrapper">
            <div class="col col-1">
                @if (!empty($module['addresses']))
                    @php
                        $datasLatLng = [];
                        $centerLat = 0;
                        $centerLng = 0;
                    @endphp
                    <ul class="list">

                        @foreach($module['addresses'] as $contact)

                        @php
                            $socialNetwork = [
                                'instagram' => $contact['instagram'],
                                'facebook' => $contact['facebook'],
                                'threads' => $contact['threads'],
                                'tiktok' => $contact['tiktok'],
                                'linkedin' => $contact['linkedin'],
                                'twitter' => $contact['twitter'],
                                'tripadvisor' => $contact['tripadvisor'],
                                'pinterest' => $contact['pinterest'],
                                'youtube' => $contact['youtube'],
                            ];
                        @endphp

                        <li class="item">
                            @if (!empty($contact['logo']))
                                <div class="logo-wrapper">
                                    <img src="{{ $contact['logo']['sizes']['logo'] }}" alt="{{ get_bloginfo('name', 'display') }}" title="{{ get_bloginfo('name', 'display') }}" class="logo">
                                </div>
                            @endif
                            @if (!empty($contact['name']))
                                <p class="title title-section-4">{{ $contact['name'] }}</p>
                            @endif
                            @if (!empty($contact['address']))
                                @php
                                    $address = $contact['address'];
                                    $datasLatLng[] = [$address['lng'], $address['lat']];
                                    $centerLat = $centerLat + $address['lat'];
                                    $centerLng = $centerLng + $address['lng'];
                                    $addressStreet = ($address['street_number'] ?? '') . ' ' .($address['street_name'] ?? '');
                                    $addressStreetShort = ($address['street_number'] ?? '') . ' ' . ($address['street_name_short'] ?? '');
                                @endphp

                                    <address class="address">
                                        @if (($address['name'] != $addressStreet) && ($address['name'] != $addressStreetShort))
                                            {{ $address['name']}}<br>
                                        @endif
                                        @if (!empty($address['street_name']))
                                            {{ ($address['street_number'] ?? '') . ' ' .($address['street_name'] ?? '') }}<br>
                                        @endif
                                        {{ ($address['post_code'] ?? '') . ' ' .($address['city'] ?? '') }}
                                    </address>
                                @if (count($module['addresses']) > 1)
                                    <a href="https://www.google.com/maps/place/?q=place_id:{{ $address['place_id'] }}" class="btn btn-tertiary" title="Itinéraire" id="gps-go" target="_blank">Itinéraire</a>
                                @endif
                            @endif
                            @if (!empty($contact['phone']))
                                <p class="phone-wrapper">
                                    {{ bcn_pll('Tel.') }}
                                    <a href="tel:{{ str_replace(' ', '', $contact['phone']) }}" class="phone">{{ $contact['phone'] }}</a>
                                </p>
                            @endif
                            @if (!empty($contact['mail']))
                            <div class="mail-wrapper">
                                {!! GlobalHelper::obfuscate_email($contact['mail']) !!}
                            </div>
                            @endif
                            @if (!empty($contact['schedule']))
                                <div class="editor txt">
                                    <p><b>{{ bcn_pll('Horaires d’ouverture') }}</b></p>
                                    <p>{!! nl2br($contact['schedule']) !!}</p>
                                </div>{{-- /.txt --}}
                            @endif
                            @include('components.social-networks', ['socialNetworks' => $socialNetwork])
                        </li>{{-- /.item --}}

                        @endforeach

                    </ul>{{-- /.list --}}
                @endif
            </div>{{-- /.col-1 --}}

            <div class="col col-2">

                @if($is_map === false)
                    @if (!empty($module['photo']))
                        <img src="{{ $module['photo']['sizes']['text-image-default'] }}" alt="{{ get_post_meta($module['photo']['id'], '_wp_attachment_image_alt', TRUE) }}" class="illus">
                    @endif
                @else
                    <div class="map-wrapper js_show-content">
                        <div id="{{ GlobalHelper::randomSlug() }}" class="map js_load-map"
                            data-pin="{{ get_site_icon_url() }}"
                            data-markers="{{ json_encode($datasLatLng) }}"
                            data-lng="{{ $centerLng / count($datasLatLng) }}"
                            data-lat="{{ $centerLat / count($datasLatLng) }}">
                            @if (count($module['addresses']) == 1)
                                <a href="https://www.google.com/maps/place/?q=place_id:{{ $address['place_id'] }}" class="btn btn-primary" title="Itinéraire" id="gps-go" target="_blank">{!! GlobalHelper::displaySvg('gps-go.svg') !!}</a>
                            @endif
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
            </div>{{-- /.col-2 --}}

        </div>{{-- /.cols-wrapper --}}
    </div>{{-- /.container --}}
</div>{{-- /.module-contact --}}

<link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>
