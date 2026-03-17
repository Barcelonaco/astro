export default async function initModuleTextImage(el) {
    const { default: gsap } = await import('gsap');
    const { default: ScrollTrigger } = await import('gsap/ScrollTrigger');

    gsap.registerPlugin(ScrollTrigger);

    const $el = jQuery(el); // <- utilisation uniforme de jQuery

    // Définir les animations pour chaque colonne
    const animations = [
        { selector: '.img-left .col-1', x: -75 },
        { selector: '.img-left .col-2', x: 75 },
        { selector: '.img-right .col-1', x: 75 },
        { selector: '.img-right .col-2', x: -75 },
    ];

    animations.forEach(({ selector, x }) => {
        gsap.from($el.find(selector), {
            scrollTrigger: {
                trigger: $el[0],
                start: 'top 80%',
            },
            duration: 0.7,
            x,
            opacity: 0,
        });
    });
}
