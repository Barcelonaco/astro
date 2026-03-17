import $ from 'jquery';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function initModuleTeam(el)
{
    const $el = $(el);

    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: $el[0],
            start: 'top 80%',
        },
    });

    tl.from($el.find('.title-module'), { duration: 0.7, y: 25, opacity: 0 })
    .from($el.find('.tabs'), { duration: 0.7, y: 75, opacity: 0 }, '-=0.5')
    .from($el.find('.list .item'), {
        duration: 0.7,
        y: 75,
        opacity: 0,
        stagger: 0.1,
    }, '-=0.6');
}
