import Swiper from 'swiper';
import { Navigation, Autoplay } from 'swiper/modules';

export default async function initModuleHero(el) {
    const { default: gsap } = await import('gsap');
    const { default: ScrollTrigger } = await import('gsap/ScrollTrigger');
    gsap.registerPlugin(ScrollTrigger);

    const $el = jQuery(el);

    $el.find('.js_slider-hero').each(function () {
        const $slider = jQuery(this);
        const slideCount = $slider.find('.swiper-slide').length;

        if (slideCount <= 1) return;

        new Swiper(this, {
            modules: [Navigation, Autoplay],
            loop: slideCount > 2, 
            speed: 1000,
            autoplay: {
                delay: 4000,
                disableOnInteraction: false,
            },
            navigation: {
                nextEl: '.js_slider-hero-btn-next',
                prevEl: '.js_slider-hero-btn-prev',
            },
        });
    });

    $el.filter('.mode-list').each((elt) => {
        const $elt = jQuery(elt);

        gsap.from($elt.find('.item:nth-child(1)'), {
            scrollTrigger: {
                trigger: elt,
                start: 'top 80%',
            },
            duration: 0.7,
            x: -75,
            opacity: 0,
        });

        gsap.from($elt.find('.item:nth-child(2)'), {
            scrollTrigger: {
                trigger: elt,
                start: 'top 80%',
            },
            duration: 0.7,
            x: 75,
            opacity: 0,
        });
    });
}