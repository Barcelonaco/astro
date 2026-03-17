import $ from 'jquery';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { initSwiper } from '../util/swipper';
import animateModule from '../util/animation';

gsap.registerPlugin(ScrollTrigger);

export default function initModuleInstaFeed(el)
{
    const $el = $(el);

    const totalSlides = parseInt($('#count_post_insta').val() || 0, 10);

    function getCurrentSlidesPerView()
    {
        const width = window.innerWidth;
        if (width >= 1625) {
            return 6;
        }
        if (width >= 1025) {
            return 6;
        }
        if (width >= 961) {
            return 4;
        }
        if (width >= 601) {
            return 3;
        }
        if (width >= 481) {
            return 2;
        }
        return 1;
    }

    const currentSlidesPerView = getCurrentSlidesPerView();
    const shouldLoop = totalSlides > currentSlidesPerView;

    initSwiper(
        $el.find('.js_insta-slider'),
        {
            loop: shouldLoop,
            speed: 750,
            slidesPerView: 4,
            spaceBetween: 5,
            effect: 'slide',
            navigation: {
                nextEl: '.next',
                prevEl: '.prev'
            },
            breakpoints: {
                481: { slidesPerView: 2 },
                601: { slidesPerView: 3 },
                961: { slidesPerView: 4, spaceBetween: 10 },
                1025: { slidesPerView: 5 },
                1625: { slidesPerView: 6, spaceBetween: 10, loop: shouldLoop }
            }
        },
        () => totalSlides > 1
    );

    animateModule(el, [
    { selector: '.title-module', props: { duration: 0.7, y: 25, opacity: 0 } },
    { selector: '.tabs', props: { duration: 0.7, y: 75, opacity: 0 }, position: '-=0.5' },
    { selector: '.btn-more-wrapper', props: { duration: 0.7, y: 75, opacity: 0, stagger: 0.1 }, position: '-=0.5' }
    ]);
}
