import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import animateModule from '../util/animation';

gsap.registerPlugin(ScrollTrigger);

export default function initModuleIcons(el)
{
    animateModule(el, [
      { selector: '.title-module', props: { duration: .7, y: 25, opacity: 0} },
      { selector: '.list .item', props: { duration: .7, y: 75, opacity: 0, stagger: 0.1}, position: '-=.5'}
    ]);
}
