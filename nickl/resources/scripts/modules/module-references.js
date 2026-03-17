import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Swiper from 'swiper';
import { Navigation, Pagination } from 'swiper/modules';
import animateModule from '../util/animation';

gsap.registerPlugin(ScrollTrigger);

export default function initModuleReferences(el) {
    const $el = jQuery(el);

    $el.find('.js_references-slider').each(function () {
        const $slider = jQuery(this);

        const itemCount = $slider.find('.sub-item').length;
        if (itemCount <1) {
            return;
        }

        new Swiper(this, {
            modules: [Navigation, Pagination],
            loop: true,
            speed: 750,
            allowTouchMove: false,
            navigation: {
                nextEl: $slider.closest('.slider-wrapper').find('.next')[0],
                prevEl: $slider.closest('.slider-wrapper').find('.prev')[0],
            },
            pagination: {
                el: $slider.closest('.slider-wrapper').find('.js_references-slider-pagination')[0],
                type: 'bullets',
                clickable: true,
            },
        });
    });
    $el.find('.js_references-popin-slider').each(function () {
        const $slider = jQuery(this);

        const itemCount = $slider.find('.item').length;
        if (itemCount <1) {
            return;
        }

        new Swiper(this, {
            modules: [Navigation, Pagination],
            loop: true,
            speed: 750,
            allowTouchMove: false,
            navigation: {
                nextEl: $slider.closest('.slider-wrapper').find('.next')[0],
                prevEl: $slider.closest('.slider-wrapper').find('.prev')[0],
            },
            pagination: {
                el: $slider.closest('.slider-wrapper').find('.js_references-popin-slider-pagination')[0],
                type: 'bullets',
                clickable: true,
            },
        });
    });
    animateModule(el, [
        { selector: '.title-module', props: { duration: 0.7, y: 25, opacity: 0 } },
        { selector: '.tabs', props: { duration: 0.7, y: 75, opacity: 0 }, position: '-=0.5' },
        { selector: '.list .item', props: { duration: 0.7, y: 75, opacity: 0, stagger: 0.1 }, position: '-=0.5' },
        { selector: '.btn-more-wrapper', props: { duration: 0.7, y: 75, opacity: 0 }, position: '-=0.5' },
    ]);
}