import $ from 'jquery';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function initModuleTextVideoSlider(el)
{
    const $el = $(el);

    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: $el[0],
            start: 'top 80%',
        },
    });

    tl.from($el.find('.slider-wrapper'), {
        duration: 0.7,
        y: 75,
        opacity: 0,
    });
}
