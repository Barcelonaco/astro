export default async function initModuleContact(el)
{
    const { default: gsap } = await import('gsap');
    const { default: ScrollTrigger } = await import('gsap/ScrollTrigger');
    const { default: animateModule } = await import('../util/animation.js');

    gsap.registerPlugin(ScrollTrigger);

    animateModule(el, [
    { selector: '.title-module', props: { duration: .7, y: 25, opacity: 0 } },
    { selector: '.col-1', props: { duration: .7, y: -75, opacity: 0 }, position: '-=.5' },
    { selector: '.col-2', props: { duration: .7, y: 75, opacity: 0, stagger: 0.1 }, position: '-=.7' }
    ]);
}
