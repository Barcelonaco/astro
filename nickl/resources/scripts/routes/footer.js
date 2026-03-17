import $ from "jquery";

export default {
    init() {
        $('.js_footer-btn-scroll').on('click', function () {
            $('html,body').stop().animate({
                scrollTop: 0,
            }, 1500);
        });
    }
};
