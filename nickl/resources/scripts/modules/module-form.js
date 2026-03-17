import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import animateModule from '../util/animation';

gsap.registerPlugin(ScrollTrigger);

export default function initModuleForm(el)
{
    animateModule(el, [
      { selector: '.title-module', props: { duration: .7, y: 25, opacity: 0 } },
      { selector: '.gfield', props: { duration: .7, y: 75, opacity: 0, stagger: 0.1 }, position: '-=.5' },
      { selector: '.gform_footer', props: { duration: .7, y: 25, opacity: 0}}
    ]);
}
