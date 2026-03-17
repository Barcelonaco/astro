/* eslint-disable */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import $ from "jquery";
import modules from './modules'
import header from './header'
import footer from './footer'
import '../autoload/add-to-calendar.js'

export default {
  init: function () {

    // JavaScript to be fired on all pages

    let scroll = $(window).scrollTop();
    let windowWidth = $(window).width();


    header.init();
    footer.init();
    modules.init();
    $(function () {
      if ($('#addToCal').length > 0) {
        new atc(document.querySelector('#addToCal'), {
          labels: false,
          timezone: "Europe/Paris",
        })
      }


      $(window).on('resize', function () {
        windowWidth = $(window).width();
      });


      // Blur on click
      $('a, button, input[type=\'submit\'], .btn').on('click', function () {
        $(this).trigger('blur');
      });


      // Button scroll down
      $('.js_btn-scroll-down').on('click', function () {
        $('html,body').stop().animate({
          scrollTop: $(this).closest('.module').offset().top + $(this).closest('.module').outerHeight(true),
        }, 1000);
      });

      // ========================================
      // Popin
      // ========================================
      function openPopin(popin, slide) {
        $('.popin-wrapper[data-popin="' + popin + '"]').show(0).addClass('active');
        $('html').addClass('disable-scroll');
        if (slide) {
          const slider = document.querySelector('.popin-wrapper[data-popin="' + popin + '"] .slider').swiper;
          console.log('slide to ', slide);
          slider.slideToLoop(slide - 1);
        }
      }

      function closePopin(popin) {
        if (popin) {
          $('.popin-wrapper[data-popin="' + popin + '"]').removeClass('active');
          setTimeout(function () {
            $('html').removeClass('disable-scroll');
            $('.popin-wrapper[data-popin="' + popin + '"]').hide(0);
          }, 600);
        } else {
          $('.popin-wrapper').removeClass('active');
          setTimeout(function () {
            $('html').removeClass('disable-scroll');
            $('.popin-wrapper').hide(0);
          }, 600);
        }
      }

      $(document).on('click', '.js_open-popin', function () {
        openPopin($(this).data('popin'), $(this).data('slide'));
      });


      $(document).on('click', '.js_close-popin', function () {
        closePopin();
      });
      $(document).on('click', '.popin-wrapper', function (e) {
        if (e.target !== this) {
          return;
        }
        closePopin();
      });




      // ========================================
      // Animations
      // ========================================
      gsap.registerPlugin(ScrollTrigger);

      // Page Archive news
      $('.page-archive-news').each(function (index, elt) {
        gsap.from($(elt).find('.title-page-wrapper'), {
          scrollTrigger: {
            trigger: elt,
            start: 'top 80%',
          },
          duration: .7,
          y: 25,
          opacity: 0,
        });
        gsap.from($(elt).find('.tabs'), {
          scrollTrigger: {
            trigger: elt,
            start: 'top 80%',
          },
          duration: .7,
          y: 75,
          opacity: 0,
        });
        gsap.from($(elt).find('.list-single .item'), {
          scrollTrigger: {
            trigger: elt,
            start: 'top 80%',
          },
          duration: .7,
          y: 75,
          opacity: 0,
          stagger: 0.1,
        });
      });


      // Page Archive references
      $('.page-archive-references').each(function (index, elt) {
        gsap.from($(elt).find('.title'), {
          scrollTrigger: {
            trigger: elt,
            start: 'top 80%',
          },
          duration: .7,
          y: 25,
          opacity: 0,
        });
      });

      // Loader
      if ($('.loader').length > 0) {
        gsap.to('.loader img', { duration: 1.1, y: -75, ease: 'power1.inOut' }, '+1.5');
        gsap.to('.loader', { duration: .9, opacity: 0 }, '+1.8');
        gsap.to('.loader', { duration: 0, className: 'loader disable' }, '+2.8');
      }


      // Event Toogle
      let eventToggle = document.getElementById("js_event-toggle");
      let toggleList = document.getElementById("js_select-list");
      let toggleGrid = document.getElementById("js_select-grid");
      let elt = document.getElementById('js_list-event');
      if (elt) {
        if (windowWidth > 1024) {
          eventToggle.addEventListener("click", function () {
            event.stopPropagation();
            eventToggle.classList.toggle('active');
          });
          toggleList.addEventListener("click", function () {
            event.stopPropagation();
            eventToggle.classList.remove('active');
            jQuery(elt).removeClass('grid').addClass('list');
            document.getElementById("toggle-text").innerHTML = "Vue liste";
            toggleList.classList.add('selected');
            toggleGrid.classList.remove('selected');
          });
          toggleGrid.addEventListener("click", function () {
            event.stopPropagation();
            eventToggle.classList.toggle('active');
            jQuery(elt).removeClass('list').addClass('grid');
            document.getElementById("toggle-text").innerHTML = "Vue photo";
            toggleGrid.classList.add('selected');
            toggleList.classList.remove('selected');
          });
        } else {
          jQuery(elt).removeClass('list').addClass('grid');
        }
      }
      $(document).on('click', '#js_event-toggle', function (e) {
        if (e.target !== this) {
          eventToggle.classList.remove('active');
        }
      });

      $('.module-clickable').each(function (index, element) {
        const $this = $(element);
        const $next = $('.module-clickable').eq(index + 1);

        if ($next.length === 0) return;

        const hasExplicitNoBottom = $this.hasClass('no-padding-bottom');
        const hasExplicitNoTop = $next.hasClass('no-padding-top');

        if (hasExplicitNoBottom && hasExplicitNoTop) {
          $next.addClass('padding-top-between');
        }
      });
    });

    $(document).ready(function() {
      $('.module-map, .module-contact .map-wrapper, .module-video, .module-text-image').each(function (index, element) {

        const $module = $(element).closest('.module-map, .module-contact, .module-video, .module-text-image');
        const $content = $module.find('.js_show-content').length ? 
                        $module.find('.js_show-content') : 
                        $('.js_show-content');
        const $notice = $module.find('.js_show-cookies').length ? 
                        $module.find('.js_show-cookies') : 
                        $('.js_show-cookies');

        function checkAdvertisingCookies() {
          const cookieConsent = document.cookie
            .split('; ')
            .find(row => row.startsWith('cookie-consent=') || row.startsWith('cookieconsent=') || row.startsWith('advertising-cookies='));
          const decoded = decodeURIComponent(document.cookie);
          const match = decoded.match(/cc_cookie=({.*?});/);
          if (match) {
            const json = match[1];
            try {
              const data = JSON.parse(json);
              if(data.categories.includes('ads')) {
                return true;
              }
            } catch (e) {
              console.error('Erreur de parsing JSON :', e);
            }
          }

          return false;
        }

        function updateVisibility() {
          const hasAdsConsent = checkAdvertisingCookies();

          if (hasAdsConsent) {
            $content.stop(true, true).show();
            $notice.stop(true, true).hide();
          } else {
            $content.stop(true, true).hide();
            $notice.stop(true, true).show();
          }
        }
        updateVisibility();

        $(document).on('cookieConsentChanged advertisingCookiesChanged', function () {
          updateVisibility();
        });
      });
    })

    $(window).on('load', function () {

      // Anchor for Chrome
      var isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
      if (window.location.hash && isChrome) {
        setTimeout(function () {
          var hash = window.location.hash;
          window.location.hash = "";
          window.location.hash = hash;
        }, 300);
      }

    });
  },
  finalize() {
    // JavaScript to be fired on all pages, after page specific JS is fired
  },
};
