import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Swiper from 'swiper';
import { Navigation, Autoplay, Pagination } from 'swiper/modules';
import animateModule from '../util/animation';

gsap.registerPlugin(ScrollTrigger);

export default function initModuleGoogleReviews(el) {
    const $el = jQuery(el);

    $el.find('.js_google-reviews-slider').each(function (index) {
        const elt = this;
        const $slider = jQuery(elt);
        const itemCount = $slider.find('.swiper-slide').length;

        if (itemCount <= 0) return;

        $slider.data('index', index);
        $slider.addClass('ready');

        const swiperInstance = new Swiper(elt, {
            modules: [Navigation, Autoplay, Pagination],
            loop: itemCount > 1,
            speed: 750,
            slidesPerView: 1, // Default mobile
            spaceBetween: 20,
            autoHeight: true,
            autoplay: {
                delay: 6000,
                disableOnInteraction: true,
            },
            breakpoints: {
                768: {
                    slidesPerView: 2,
                    spaceBetween: 30,
                },
                1024: {
                    slidesPerView: 3,
                    spaceBetween: 30,
                }
            },
            navigation: {
                nextEl: $el.find('.google-reviews-nav.next')[0],
                prevEl: $el.find('.google-reviews-nav.prev')[0],
            },
            pagination: {
                el: $el.find('.google-reviews-pagination')[0],
                type: 'bullets',
                clickable: true,
            },
        });

        // Read more functionality included here to be driven by JS events if needed
        // but simpler to do native delegation
    });

    // Read More handling
    $el.on('click', '.read-more-btn', function(e) {
        e.preventDefault();
        const $btn = jQuery(this);
        const $content = $btn.prev('.review-text-content');

        if ($content.hasClass('expanded')) {
            $content.removeClass('expanded');
            $btn.text('Lire plus');
            $content.css('max-height', '100px'); // Restore limit
        } else {
            $content.addClass('expanded');
            $btn.text('Lire moins');
            $content.css('max-height', 'none'); // Remove limit
        }

        // Update swiper if inside one, as height changes
        const swiper = $el.find('.swiper')[0]?.swiper;
        if (swiper) {
            swiper.update();
        }
    });

    animateModule(
        $el.filter(':not(.popin-wrapper .module-google-reviews)'),
        [
            { selector: '.google-reviews-header', props: { duration: 0.7, y: 30, opacity: 0 } },
            { selector: '.reviews-slider-wrapper', props: { duration: 0.7, y: 50, opacity: 0 }, position: '-=0.5' },
        ]
    );
}
