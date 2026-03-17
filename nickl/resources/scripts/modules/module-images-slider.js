import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Swiper from 'swiper';
import { Navigation, Autoplay, Pagination } from 'swiper/modules';
import animateModule from '../util/animation';

gsap.registerPlugin(ScrollTrigger);

export default function initModuleImagesSlider(el) {
    const $el = jQuery(el);

    $el.find('.js_images-slider').each(function (index) {
        const elt = this;
        const $slider = jQuery(elt);
        const itemCount = $slider.find('.item').length;

        if (itemCount <= 1) return;

        $slider.data('index', index);

        $slider
          .siblings('.js_images-slider-btn-prev, .js_images-slider-btn-next, .js_images-slider-pagination')
          .addClass('index-' + index);

        const swiperInstance = new Swiper(elt, {
            modules: [Navigation, Autoplay, Pagination],
            loop: true,
            speed: 750,
            slidesPerView: 1,
            autoplay: {
                delay: 4000,
                disableOnInteraction: true,
            },
            navigation: {
                nextEl: $slider.closest('.slider-wrapper').find('.next')[0],
                prevEl: $slider.closest('.slider-wrapper').find('.prev')[0],
            },
            pagination: {
                el: '.js_images-slider-pagination.index-' + index,
                type: 'bullets',
                clickable: true,
            },
        });

        $slider.data('swiper', swiperInstance);
    });

    animateModule(
        $el.filter(':not(.popin-wrapper .module-images-slider)'),
        [
            { selector: '.title-module', props: { duration: 0.7, y: 25, opacity: 0 } },
            { selector: '.slider-wrapper', props: { duration: 0.7, y: 75, opacity: 0 }, position: '-=0.5' },
        ]
    );
}
