import $ from 'jquery';
import mapboxgl from 'mapbox-gl';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import animateModule from '../util/animation';

gsap.registerPlugin(ScrollTrigger);

export default function initModuleMap(el)
{
    mapboxgl.accessToken = 'pk.eyJ1IjoiYmFyY2Vsb25hLWNvIiwiYSI6ImNsbm9mZmN3bzBpM2Yya29kcWYxbnZpcGkifQ.gsHaJQAk_Ua4vBbt3DxNGQ';
    const $el = $(el);

    $el.find('.js_load-map').each(function () {
        const elt = this;
        const $elt = $(elt);

        const markersData = $elt.attr('data-markers');
        if (!markersData) {
            return;
        }

        const markers = JSON.parse(markersData);
        const lat = parseFloat($elt.attr('data-lat'));
        const lng = parseFloat($elt.attr('data-lng'));
        const pinUrl = $elt.attr('data-pin');

        const map = new mapboxgl.Map({
            container: elt,
            style: 'mapbox://styles/barcelona-co/cmf54n5a801qo01pj0bdi739c',
            center: [lng, lat],
            zoom: 17,
            pitch: 65,
        });

        map.scrollZoom.disable();
        map.addControl(new mapboxgl.NavigationControl());

        const bounds = new mapboxgl.LngLatBounds();

        markers.forEach(coord => {
            const el = document.createElement('div');
            const containerLogo = document.createElement('div');
            containerLogo.classList.add('container-pin');

            const logo = document.createElement('img');
            logo.classList.add('img-pin');
            logo.src = pinUrl;

            containerLogo.append(logo);
            el.append(containerLogo);
            el.classList.add('marker');

            new mapboxgl.Marker(el).setLngLat(coord).addTo(map);
            bounds.extend(coord);
        });

        map.fitBounds(bounds, { padding: 100 });

        if (markers.length === 1) {
            map.setZoom(map.getZoom() - 1);
        }
    });

    animateModule(el, [
    { selector: '.title-module', props: { duration: 0.7, y: 25, opacity: 0 } },
    { selector: '.map-wrapper', props: { duration: 0.7, opacity: 0 }, position: '-=0.5' },
    ]);
    setTimeout(() => {
        map.resize();
    }, 750);
}