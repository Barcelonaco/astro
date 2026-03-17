import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import animateModule from '../util/animation';

gsap.registerPlugin(ScrollTrigger);

export default function initModuleQuote(el)
{
    animateModule(el, [
      { selector: '.title-module', props: { duration: .7, y: 25, opacity: 0 } },
      { selector: '.txt', props: { duration: .7, y: 75, opacity: 0 }, position: '-=.5' },
      { selector: '.illus-wrapper', props: { duration: .7, y: 75, opacity: 0}, position: '-=.6' },
      { selector: '.name', props: { duration: .7, y: 75, opacity: 0}, position: '-=.6' },
      { selector: '.function', props: { duration: .7, y: 75, opacity: 0}, position: '-=.6' }
    ]);

}
