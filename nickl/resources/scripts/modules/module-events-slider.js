import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Swiper from 'swiper';
import { Navigation } from 'swiper/modules';
import animateModule from '../util/animation';

gsap.registerPlugin(ScrollTrigger);

export default function initModuleEventsSlider(el) {
    const $el = jQuery(el);

    $el.find('.js_events-slider').each(function () {
        const $slider = jQuery(this);
        const isInModuleColumns2 = $slider.closest('.cols-wrapper.columns-2').length > 0;
        const isInModuleColumns3 = $slider.closest('.cols-wrapper.columns-3').length > 0;
        const isA4 = $slider.hasClass('a4');

        let slidesPerView = 1;
        let breakpoints = {
            601: { slidesPerView: 1 },
            1025: { slidesPerView: isA4 ? 4 : 3 },
        };

        if (isInModuleColumns2 || isInModuleColumns3) {
            slidesPerView = 1;
            breakpoints = {
            601: { slidesPerView: 1 },
            1025: { slidesPerView: isA4 ? 2 : 1 },
        };
        }

        const windowWidth = window.innerWidth;
        let slidesPerViewCurrent = slidesPerView;

        for (const bp in breakpoints) {
            if (windowWidth >= bp) {
                slidesPerViewCurrent = breakpoints[bp].slidesPerView;
            }
        }

        const itemCount = $slider.find('.item').length;
        if (itemCount <= slidesPerViewCurrent) {
            return;
        }

        new Swiper(this, {
            modules: [Navigation],
            loop: true,
            speed: 750,
            slidesPerView,
            spaceBetween: 26,
            breakpoints,
            navigation: {
                nextEl: $slider.closest('.slider-wrapper').find('.next')[0],
                prevEl: $slider.closest('.slider-wrapper').find('.prev')[0],
            },
        });
    });

    animateModule(el, [
        { selector: '.title-module', props: { duration: 0.7, y: 25, opacity: 0 } },
        { selector: '.slider-wrapper', props: { duration: 0.7, y: 75, opacity: 0 }, position: '-=0.5' },
    ]);
}
