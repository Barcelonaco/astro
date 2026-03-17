import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Swiper from 'swiper';
import { Navigation } from 'swiper/modules';
import animateModule from "@scripts/util/animation.js";

gsap.registerPlugin(ScrollTrigger);

export default function initModuleNewsSlider(el)
{
    const $el = jQuery(el);
    $el.find('.js_news-slider').each(function () {
        const $slider = jQuery(this);
        const isInModuleColumns2 = $slider.closest('.cols-wrapper.columns-2').length > 0;
        const isInModuleColumns3 = $slider.closest('.cols-wrapper.columns-3').length > 0;

        let slidesPerView = 1;
        let breakpoints = {};

        if ($slider.hasClass('columns-2') && !isInModuleColumns2 ) {
            breakpoints = {
                601: { slidesPerView: 2 },
            };
        } else if (!$slider.hasClass('columns-2') && isInModuleColumns2 ) {
            breakpoints = {
                601: { slidesPerView: 2 },
            };
        } else if ($slider.hasClass('columns-3') && !isInModuleColumns3) {
            breakpoints = {
                601: { slidesPerView: 1 },
                1025: { slidesPerView: 3 },
            };
        } else if (!$slider.hasClass('columns-3') && isInModuleColumns3) {
            breakpoints = {
                601: { slidesPerView: 1 }
            }; 
        } else if ($slider.hasClass('columns-4')) {
            breakpoints = {
                601: { slidesPerView: 1 },
                1025: { slidesPerView: 4 },
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
            breakpoints,
            spaceBetween: 26,
            navigation: {
                nextEl: $slider.closest('.slider-wrapper').find('.next')[0],
                prevEl: $slider.closest('.slider-wrapper').find('.prev')[0],
            },
        });
    });

    animateModule(
        el,
        [
        { selector: '.title-module', props: { duration: .7, y: 25, opacity: 0}},
        { selector: '.slider-wrapper', props: { duration: .7, y: 75, opacity: 0}, position: '-=.5' },
        { selector: '.btn-more-wrapper', props: { duration: .7, y: 75, opacity: 0}, position: '-=.5' },
        ]
    );

  // Animation

}
