import $ from 'jquery';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function initModuleText(el)
{
    const $el = $(el);

    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: $el[0],
            start: 'top 80%',
        },
    });

    tl.from($el.find('.txt'), { duration: 0.7, y: 75, opacity: 0 })
    .from($el.find('.btn-wrapper'), { duration: 0.7, y: 75, opacity: 0 }, '-=0.5');
}
