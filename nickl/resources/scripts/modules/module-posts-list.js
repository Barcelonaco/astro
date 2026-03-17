export default async function initModulePostsList(el)
{
  const { default: gsap } = await import('gsap');
  const { default: ScrollTrigger } = await import('gsap/ScrollTrigger');
  const { default: animateModule } = await import('../util/animation.js');
    const $el = jQuery(el);

    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: $el[0],
            start: 'top 80%',
        },
    });

    tl.from($el.find('.title-module'), { duration: 0.7, y: 25, opacity: 0 })
    .from($el.find('.item'), {
        duration: 0.7,
        y: 75,
        opacity: 0,
        stagger: 0.1,
    }, '-=0.5');
}
