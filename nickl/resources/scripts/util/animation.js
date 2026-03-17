import $ from "jquery";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
export default function animateModule(selector, steps = [], prev = [], start = 'top 80%')
{
    $(selector).each((_, elt) => {
        const $elt = $(elt);
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: elt,
                start: start,
            },
        });

    // Animations sur les éléments internes
    steps.forEach(step => {
        tl.from($elt.find(step.selector), step.props, step.position || undefined);
        });

    // Animations sur les éléments précédents
    prev.forEach(p => {
        tl.from($elt.prev(p.selector), p.props, p.position || undefined);
        });
    });
}
