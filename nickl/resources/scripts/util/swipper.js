import Swiper from "swiper";

export function initSwiper(selector, params = {}, condition = () => true)
{
    $(selector).each(function (index) {
        const $slider = $(this);

        const $wrapper = $slider.closest('.module');
        if (!condition($slider)) {
            return;
        }

        $slider.attr('data-index', index);

        const $nextButton = $wrapper.find('.slider-navigation.next');
        const $prevButton = $wrapper.find('.slider-navigation.prev');

        $nextButton.attr('data-index', index);
        $prevButton.attr('data-index', index);

        const sliderParams = {
            ...params,
            navigation: {
                nextEl: $nextButton.get(0),
                prevEl: $prevButton.get(0)
            },
        };

        new Swiper($slider[0], sliderParams);
    });
}
