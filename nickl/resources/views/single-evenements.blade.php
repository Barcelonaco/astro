@php
    use App\Helpers\EventsHelper as Event;
    use App\Helpers\GlobalHelper;
    use App\Helpers\ThemeHelper;
    use App\Helpers\CookieHelper;
    use App\Taxonomy\TaxoEventsType;
    use App\Posttype\CptEvents;

    $pid = get_the_ID();
    $taxoType = new TaxoEventsType();
    $eventDate = Event::getEventDate($pid);
    $cptEvent = new CptEvents();
    $imagesRatio = get_option('options_evenements_images_ratio');
    $soldOut = get_field('sold_out');
    $location = get_field('location');
    $link = get_field('cta');
    $startDate = get_field('start_date');
    $endDate = get_field('end_date');
    $startTime = get_field('start_time');
    $endTime = get_field('end_time');
    $description = get_field('desc');
    $showBreadcrumb = get_field('show_breadcrumb', 'options') && function_exists('yoast_breadcrumb');
    $showShareBtn = get_field('pages_share_btn', 'options') && !get_field('share_btn_position', 'options');
@endphp

@extends('layouts.app')

@section('content')

    <main id="main" class="main-page page-single-event" role="main" style="opacity: 1;">
        <section>
            @if ($showBreadcrumb || $showShareBtn)
                <div class="container sub-header">
                    @if ($showBreadcrumb)
                    @include('components.breadcrumb')
                    @endif

                    @if ($showShareBtn)
                    @include('modules.share', ['share_btn_position' => 'top'])
                    @endif
                </div>
            @endif
            <article>
                <div class="head">
                    <div class="container">
                        <div class="head-top">
                            <span class="category">{{ GlobalHelper::getTerms($pid, $taxoType->getSlug()) }}</span>
                            <a class="btn btn-tertiary btn-back" href="{{get_post_type_archive_link($cptEvent->getSlug())}}">
                                <span class="icon" aria-hidden="false"><?= GlobalHelper::displaySvg('chevron.svg') ?></span>
                                Retour aux événements
                            </a>
                        </div>
                        <h1 class="title-page">{{ html_entity_decode(get_the_title()) }}</h1>
                        <div class="head-bottom">
                            <p class="date">{{ $eventDate }}</p>
                            @if ($price = get_field('price'))
                                <p class="price">{{ $price }}{{ $soldOut ? ' - Complet' : '' }}</p>
                            @endif
                        </div>
                    </div>{{-- /.container --}}
                </div>{{-- /.head --}}

                <div class="container">
                    <div class="content-main {{ $imagesRatio ? $imagesRatio : '' }}">
                        @php $banner = ThemeHelper::getImgBanner($pid, $imagesRatio ? 'a4' : 'banner'); @endphp
                        <div class="illus-wrapper">
                            @if($banner && isset($banner['url']))
                                <img src="{{ $banner['url'] }}" alt="{{ $banner['alt'] ?? '' }}" class="illus">
                            @else
                                {{-- Fallback --}}
                                <img src="{{ ThemeHelper::getImgBanner(null, 'banner')['url'] }}" alt="" class="illus">
                            @endif
                        </div>
                        <div class="editor txt">
                            @if ($text = get_field('text'))
                                {!! $text !!}
                            @endif
                        </div>
                    </div>
                    <div class="btn-wrapper">
                        <button id="addToCal"
                                data-atc-start="{{ $startDate }} {{ !empty($startTime) ? $startTime : null }}"
                                data-atc-end="{{ !empty($endDate) ? $endDate : $startDate }} {{ !empty($endTime) ? $endTime : null }}"
                                data-atc-title="{{ get_bloginfo('name', 'display') }} - {{ get_the_title() }}"
                                data-atc-description="{{ $description }}"
                                @if ($location)
                                    data-atc-location="{!! isset($location['street_number']) ? $location['street_number'] : '' !!} {!! isset($location['street_name']) ? $location['street_name'] : '' !!}
                                            {!! isset($location['post_code']) ? $location['post_code'] : '' !!} {!! isset($location['city']) ? $location['city'] : '' !!}"
                                @endif
                                class="btn btn-primary">+ {{ __('Ajouter au calendrier', THEME_TEXTDOMAIN) }}</button>
                        @if (!empty($link['url']))
                            <a class="btn btn-secondary color-secondary-full" href="{{ $link['url'] }}" target="{{ $link['target']}}">{{ $link['title'] }}</a>
                        @endif
                    </div>
                    <div class="event-recapitulatif">
                        <div class="event-recapitulatif-title">
                            <h4>{{ __('Récapitulatif', THEME_TEXTDOMAIN) }}</h4> <span></span>
                        </div>
                        <div class="event-recapitulatif-content">
                            <div class="event-recapitulatif-item">
                                <div class="event-recapitulatif-sub-item">
                                    <h5>{{ __('Date et heure', THEME_TEXTDOMAIN) }}</h5>
                                    <p>{{ $eventDate }}</p>
                                </div>
                                @if (!empty($location))
                                    <div class="event-recapitulatif-sub-item">
                                        <h5>{{ __('Lieu', THEME_TEXTDOMAIN) }}</h5>
                                        <p>
                                            @if ($locationName = get_field('location_name'))
                                                <strong>{{ $locationName }}</strong>
                                                <br>
                                            @endif
                                            {!! isset($location['street_number']) ? $location['street_number'] : '' !!} {!! isset($location['street_name']) ? $location['street_name'] : '' !!}
                                            <br>
                                            {!! isset($location['post_code']) ? $location['post_code'] : '' !!} {!! isset($location['city']) ? $location['city'] : '' !!}
                                        </p>
                                    </div>
                                @endif
                                @if ($price = get_field('price'))
                                    <div class="event-recapitulatif-sub-item">
                                        <h5>{{ __('Tarif', THEME_TEXTDOMAIN) }}</h5>
                                        <p>{{ $price }}</p>
                                    </div>
                                @endif
                            </div>


                            @if (!empty($location))
                            <div class="module module-map padding-small">
                                @php
                                    $datasLatLng[] = [$location['lng'], $location['lat']];
                                @endphp
                                <div class="map-wrapper">
                                    <div id="{{ GlobalHelper::randomSlug() }}" class="map js_load-map"
                                            data-pin="{{ get_site_icon_url() }}"
                                            {{-- Liste des markers --}}
                                            data-markers="{{ json_encode($datasLatLng) }}"
                                            {{-- Coordonées pour le centrade la map --}}
                                            data-lng="{{ $location['lng'] }}" data-lat="{{ $location['lat'] }}"></div>
                                </div>
                            </div>{{-- /.module-map --}}

                            <div class="event-recapitulatif-item">
                                <div class="event-recapitulatif-sub-item">
                                    <h5>{{ __('Comment s\'y rendre', THEME_TEXTDOMAIN) }}</h5>
                                    <div class="locomotion">
                                        <a target="_blank" href="https://www.google.com/maps/dir/?api=1&destination={{ str_replace(' ', '+', $location['address']) }}&travelmode=walking" class="icon"
                                            aria-hidden="false"><?= GlobalHelper::displaySvg('walk.svg') ?></a>
                                        <a target="_blank" href="https://www.google.com/maps/dir/?api=1&destination={{ str_replace(' ', '+', $location['address']) }}&travelmode=bicycling" class="icon"
                                            aria-hidden="false"><?= GlobalHelper::displaySvg('bike.svg') ?></a>
                                        <a target="_blank" href="https://www.google.com/maps/dir/?api=1&destination={{ str_replace(' ', '+', $location['address']) }}&travelmode=driving" class="icon"
                                            aria-hidden="false"><?= GlobalHelper::displaySvg('car.svg') ?></a>
                                        <a target="_blank" href="https://www.google.com/maps/dir/?api=1&destination={{ str_replace(' ', '+', $location['address']) }}&travelmode=transit" class="icon"
                                            aria-hidden="false"><?= GlobalHelper::displaySvg('bus.svg') ?></a>
                                    </div>
                                </div>
                            </div>
                            @endif

                            <div class="event-recapitulatif-item">
                                @if ($contactName = get_field('contact_name'))
                                    <div class="event-recapitulatif-item-col-2">
                                        <h5>{{ __('Organisateur', THEME_TEXTDOMAIN) }}</h5>
                                        <p>{{ $contactName }}</p>
                                    </div>
                                @endif
                                @if ($website = get_field('website'))
                                    <div class="event-recapitulatif-item-col-2">
                                        <h5>{{ __('Site Web', THEME_TEXTDOMAIN) }}</h5>
                                        <a class="btn btn-tertiary" href="{{ $website }}" target="_blank">{{ $website }}</a>
                                    </div>
                                @endif
                            </div>

                            @php
                                $contactEmail = get_field('contact_email');
                                $contactPhone = get_field('contact_phone');
                            @endphp
                            @if ($contactEmail || $contactPhone)
                                <div class="event-recapitulatif-item">
                                    <div class="event-recapitulatif-sub-item">
                                        <h5 class="title title-section-5">{{ __('Contact', THEME_TEXTDOMAIN) }}</h5>
                                        <div class="txt editor">
                                            @if ($contactPhone)
                                                <a href="tel:{{ str_replace(' ', '', $contactPhone) }}" title="Appeler"
                                                    class="phone">{{ trim(strrev(chunk_split(strrev($contactPhone),2, ' '))) }}</a>
                                            @endif
                                            @if ($contactEmail && $contactPhone)
                                                -
                                            @endif
                                            @if ($contactEmail)
                                                <a href="mailto:{{ $contactEmail }}" title="Envoyer un email">{{ $contactEmail }}</span>
                                            @endif
                                        </div>
                                    </div>
                                </div>
                            @endif
                        </div>
                    </div>
                </div>                
            </article>

            @if (get_field('share_btn_position', 'options'))
                @include('modules.share', ['share_btn_position' => 'bottom'])
            @endif

        </section>
    </main>{{-- /.page-single-news --}}

@endsection

<link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>
