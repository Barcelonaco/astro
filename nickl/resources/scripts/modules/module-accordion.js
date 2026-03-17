import $ from 'jquery';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import animateModule from '../util/animation';

gsap.registerPlugin(ScrollTrigger);

export default function initModuleAccordion(el)
{
    const $el = $(el);

    $el.find('.js_toggle-accordion').on('click', function () {
        const $btn = $(this);
        const speed = 400;
        const $accordion = $btn.closest('.accordion');
        const $titles = $accordion.find('.title');
        const $txt = $titles.next('.txt');

        if ($btn.hasClass('active')) {
            $titles.removeClass('active');
            $txt.slideUp(speed);
        } else {
            $titles.removeClass('active');
            $txt.slideUp(speed);
            $btn.addClass('active').next('.txt').slideDown(speed);
        }
    });

    animateModule(el, [
    { selector: '.title-module', props: { duration: 0.7, y: 25, opacity: 0 } },
    { selector: '.title', props: { duration: 0.7, x: 75, opacity: 0, stagger: 0.1 }, position: '-=0.5' }
    ]);
}
