import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import animateModule from '../util/animation';

gsap.registerPlugin(ScrollTrigger);

export default function initModuleGallery(el)
{
    animateModule(el, [
      { selector: '.title-module', props: { duration: .7, y: 25, opacity: 0 } },
      { selector: '.tabs', props: { duration: .7, y: 75, opacity: 0}, position: '-=.5' },
      { selector: '.list .item', props: { duration: .7, y: 75, opacity: 0, stagger: 0.1}, position: '-=.6'}
    ]);
}
