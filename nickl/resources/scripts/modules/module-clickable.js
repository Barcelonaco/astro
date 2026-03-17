import animateModule from '../util/animation';

export default function initModuleClickable(el)
{
    animateModule(el, [
    { selector: '.item', props: { duration: 0.7, y: 75, opacity: 0, stagger: 0.1 }, position: '-=.5' },
    ], [
    { selector: '.title-module', props: { duration: 0.7, y: 25, opacity: 0 }},
    ]);

}
