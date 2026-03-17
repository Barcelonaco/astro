import $ from 'jquery';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function initModuleVideo(el) {
    const $el = $(el);

    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: $el[0],
            start: 'top 80%',
        },
    });

    tl.from($el.find('.title-module'), {
        duration: 0.7,
        y: 25,
        opacity: 0,
    }).from($el.find('.video, .illus-wrapper'), {
        duration: 0.7,
        y: 75,
        opacity: 0,
    }, '-=0.5');

    $el.find('.js_btn-video').on('click', function () {
        let $elt = $(this);
        let $video = $elt.closest('.video-wrapper');
        let $iframe = $video.find('iframe');
        let src = '';

        if ($elt.data('src')) {
            src = 'https://www.youtube-nocookie.com/embed/' + $elt.data('src') + '?rel=0&showinfo=0&enablejsapi=1&autoplay=1';
        } else if ($elt.data('src-vimeo')) {
            src = 'https://player.vimeo.com/video/' + $elt.data('src-vimeo') + '?autoplay=1';
        } else if ($elt.data('src-dailymotion')) {
            src = 'https://geo.dailymotion.com/player.html?video=' + $elt.data('src-dailymotion') + '&autoplay=1';
        }

        $iframe.attr('src', src);
        $video.addClass('active');

        if (src.includes('youtube.com')) {
            setTimeout(function () {
                $iframe[0].contentWindow.postMessage(
                    '{"event":"command","func":"playVideo","args":""}', '*'
                );
            }, 600);
        }
    });
}
