import $ from "jquery";

export default {
    init() {
        let self = this; // <-- Stocke `this`

        this.windowWidth = $(window).width();
        this.position = $(window).scrollTop();
        this.keepHeaderVisible = false;
        this.headerSticky = 0;
        this.$header = $('#header');

        $(function () {
            $('.js_toggle-menu').on('click', function () {
                if (self.windowWidth <= 1024) { // <-- Utilise `self` au lieu de `this`
                    $(this).toggleClass('close');
                    $('html').toggleClass('disable-scroll');
                    $('body').toggleClass('menu-active');
                }
            });

            $('.js_copy-link').on('click', function () {
                let URL = document.location.href;
                navigator.clipboard.writeText(URL);
                if (self.windowWidth > 1024) { // <-- Utilise `self`
                    $(this).toggleClass('copied');
                }
            });

            $('.js_secret-menu-trigger').on('click', function () {
                $('#header').toggleClass('secret-menu-reveal');
                let $trigger = $('.secret-menu-trigger');

                if ($trigger.hasClass('secret-menu-trigger-close')) {
                    $trigger.toggleClass('secret-menu-trigger-close secret-menu-trigger-reverse');
                } else {
                    $trigger.addClass('secret-menu-trigger-close').removeClass('secret-menu-trigger-reverse');
                }
            });

            $('.js_toggle-mega-menu').on('click', function () {
                if (self.windowWidth > 1024) { // <-- Utilise `self`
                    $(this).toggleClass('close');
                    $('body').toggleClass('mega-menu-active');
                    setTimeout(() => {
                        $('html').toggleClass('disable-scroll', $('body').hasClass('mega-menu-active'));
                    }, 300);
                }
            });

            $('#header .mega-menu-primary .menu > li.menu-item-has-children > a').on('click', function (e) {
                if (self.windowWidth > 1024) {
                    e.preventDefault();
                    let $elt = $(this);
                    $elt.closest('li').siblings('li').removeClass('active');
                    $elt.closest('li').siblings('li').find('> .sub-menu').slideUp(400);
                    $elt.closest('li').toggleClass('active').find('.sub-menu').first().slideToggle(400);
                }
            });

            $('.js_btn-toggle-search').on('click', function () {
                $('body').toggleClass('search-active');
                $('html').toggleClass('disable-scroll');
                setTimeout(() => {
                    if ($('body').hasClass('search-active')) {
                        $('.search-form .search-field').focus();
                    }
                }, 100);
            });

            $(window).on('scroll', function () {
                self.posHeader(); // <-- Utilise `self`
            });

            self.posHeader(); // <-- Utilise `self`
        });
    },

    posHeader() {
        let scroll = $(window).scrollTop();
        let headerHeight = this.$header.outerHeight(true);
        let headerTop = this.$header.offset().top;

        if (scroll <= headerTop) {
            $('body').removeClass('scroll-up scroll-down');
        } else {
            $('body').toggleClass('scroll-down', scroll > headerTop);
            $('body').toggleClass('scroll-up', scroll <= headerTop);
        }

        if ($(document).width() > 1024) {
            if (scroll > this.position) {
                if (scroll > headerHeight + headerTop) {
                    this.headerSticky = headerHeight + headerTop;
                    this.$header.addClass('transition');
                } else if (!this.keepHeaderVisible) {
                    this.headerSticky = scroll;
                    this.$header.removeClass('transition');
                }
            } else {
                if (scroll > headerHeight + headerTop) {
                    this.headerSticky = headerTop;
                    this.$header.addClass('transition');
                    this.keepHeaderVisible = true;
                } else if (this.keepHeaderVisible && scroll > headerTop) {
                    this.headerSticky = headerTop;
                    this.$header.addClass('transition');
                } else {
                    this.headerSticky = scroll;
                    this.$header.removeClass('transition');
                    this.keepHeaderVisible = false;
                }
            }

            if (scroll <= 0) {
                this.headerSticky = 0;
                this.keepHeaderVisible = false;
            }

            $('#header .header-wrapper').css('transform', `translateY(-${this.headerSticky}px)`);
            this.position = scroll;
        } else {
            $('#header .header-wrapper').css('transform', '');
        }
    }
};
