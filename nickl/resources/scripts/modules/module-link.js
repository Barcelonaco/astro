import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import animateModule from '../util/animation';

gsap.registerPlugin(ScrollTrigger);

export default function initLink(el)
{
    animateModule(el, [
      { selector: '.btn-wrapper', props: { duration: .7, y: 75, opacity: 0 }},
    ]);

}
