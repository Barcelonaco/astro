import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Swiper from 'swiper';
import { Navigation, Autoplay } from 'swiper/modules';
import animateModule from '../util/animation';

gsap.registerPlugin(ScrollTrigger);

export default function initModuleLogosSlider(el) {
    const $el = jQuery(el);

    $el.find('.js_logos-slider').each(function () {
        const $slider = jQuery(this);
        const isInModuleColumns2 = $slider.closest('.columns-2').length > 0;
        const isInModuleColumns3 = $slider.closest('.columns-3').length > 0;

        let slidesPerView = 2;
        let breakpoints = {
            481: { slidesPerView: 2 },
            601: { slidesPerView: 3 },
            961: { slidesPerView: 4 },
            1025: { slidesPerView: 6 },
        };

        if (isInModuleColumns2) {
            slidesPerView = 3;
            breakpoints = { 481: { slidesPerView: 2 } };
        } else if (isInModuleColumns3) {
            slidesPerView = 2;
            breakpoints = { 481: { slidesPerView: 2 } };
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
            modules: [Navigation, Autoplay],
            loop: true,
            speed: 750,
            slidesPerView,
            breakpoints,
            spaceBetween: 26,
            autoplay: {
                delay: 3000,
                disableOnInteraction: true,
            },
            navigation: {
                nextEl: $slider.closest('.slider-wrapper').find('.js_logos-slider-btn-next')[0],
                prevEl: $slider.closest('.slider-wrapper').find('.js_logos-slider-btn-prev')[0],
            },
        });
    });

    animateModule(el, [
        { selector: '.title-module', props: { duration: 0.7, y: 25, opacity: 0 } },
        { selector: '.slider-wrapper', props: { duration: 0.7, y: 75, opacity: 0 }, position: '-=0.5' },
    ]);
}
