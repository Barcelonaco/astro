import $ from "jquery";
import Swiper from "swiper";
import mapboxgl from "mapbox-gl";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

export default {
    init() {
        $(function () {
            mapboxgl.accessToken = 'pk.eyJ1IjoiYmFyY2Vsb25hLWNvIiwiYSI6ImNsbm9mZmN3bzBpM2Yya29kcWYxbnZpcGkifQ.gsHaJQAk_Ua4vBbt3DxNGQ';
            const windowWidth = $(window).width();
            gsap.registerPlugin(ScrollTrigger);

            // Main
            // gsap.to('#main', { duration: .7, opacity: 1 });

            // Pour activer / désactiver les animations
            if (!$('body').hasClass('woocommerce')) {
                $('.module.has-background-image.background-parallax').each(function (index, elt) {
                    gsap.to($(elt).find('.background'), {
                        yPercent: 25,
                        ease: "none",
                        scrollTrigger: {
                            trigger: elt,
                            scrub: true
                        },
                    });
                });
            }


          // ========================================
          // Module Images vidéos parallax
          // ========================================

          // Animation
            $('.module-images-videos-parallax .item').each(function (index, elt) {
              // Video
                let eltVideo = $(elt).find('.video');
                if (eltVideo.length > 0) {
                    ScrollTrigger.create({
                        trigger: eltVideo,
                        start: 'top 100%',
                        end: 'bottom 0',
                        onEnter: () => {
                            eltVideo[0].currentTime = 0;
                            eltVideo[0].play();
                        },
                        onEnterBack: () => {
                            eltVideo[0].currentTime = 0;
                            eltVideo[0].play();
                        },
                        onLeave: () => eltVideo[0].pause(),
                        onLeaveBack: () => eltVideo[0].pause(),
                    });
                }

                if (windowWidth > 1024) {
                    let eltDesc = $(elt).find('.desc');

                  // First item
                    if ($(elt).is(':first-child')) {
                      // Fixe media
                        let tlModuleImagesVideosParallax = gsap.timeline({
                            scrollTrigger: {
                                trigger: elt,
                                start: 'top 0%',
                                end: 'bottom 100%',
                                pin: $(elt).find('.media-wrapper'),
                                toggleActions: "restart reverse restart reverse",
                            },
                        })

                      // Parallax image
                        gsap.to($(elt).find('.illus-content'), {
                            scrollTrigger: {
                                trigger: elt,
                                scrub: true,
                                start: 'top 0%',
                                end: 'bottom 100%',
                            },
                            y: '-15vh',
                        });

                      // Hide desc
                        gsap.to($(elt).find('.desc'), {
                            scrollTrigger: {
                                trigger: eltDesc,
                                scrub: true,
                                start: 'top +=300',
                                end: 'top 0',
                            },
                            opacity: 0,
                        });

                      // Only one item
                        if (!$(elt).is(':last-child')) {
                              // Hide media
                              gsap.to($(elt).find('.media'), {
                                    scrollTrigger: {
                                        trigger: elt,
                                        scrub: true,
                                        start: 'bottom 130%',
                                        end: 'bottom 100%',
                                    },
                                    opacity: 0.1,
                                    });
                        }
                    } else {
                      // Fixe media
                        let tlModuleImagesVideosParallax = gsap.timeline({
                            scrollTrigger: {
                                trigger: elt,
                                start: 'top 100%',
                                end: 'top 0',
                                pin: $(elt).find('.media-wrapper'),
                            },
                        });

                      // Show media
                        gsap.to($(elt).find('.media'), {
                            scrollTrigger: {
                                trigger: elt,
                                scrub: true,
                                start: 'top 100%',
                                end: "top 65%",
                            },
                            opacity: 1,
                        });

                        if (!$(elt).is(':last-child')) {
                          // Hide media
                            gsap.from($(elt).find('.media'), {
                                scrollTrigger: {
                                    trigger: elt,
                                    scrub: true,
                                    start: 'top 45%',
                                    end: "top 0",
                                    immediateRender: false,
                                    toggleActions: "restart reverse restart reverse",
                                },
                                opacity: 1,
                            });
                        }

                      // Parallax image
                        gsap.to($(elt).find('.illus-content'), {
                            scrollTrigger: {
                                trigger: elt,
                                scrub: true,
                                start: 'top 100%',
                                end: 'top 0',
                            },
                            y: '-15vh',
                        });

                      // Show desc
                        gsap.from($(elt).find('.desc'), {
                            scrollTrigger: {
                                trigger: eltDesc,
                                scrub: true,
                                start: '50% 100%',
                                end: "+=300",
                            },
                            opacity: 0,
                        });

                        if (!$(elt).is(':last-child')) {
                          // Hide desc
                            gsap.to($(elt).find('.desc .container-custom'), {
                                scrollTrigger: {
                                    trigger: eltDesc,
                                    scrub: true,
                                    start: 'top +=300',
                                    end: "top 0",
                                    immediateRender: false,
                                },
                                opacity: 0,
                            });
                        }
                    }
                }
            });


          // ========================================
          // Module Ornament
          // ========================================

          // Animation
            $('.module-ornament').each(function (index, elt) {
                gsap.from($(elt), {
                    scrollTrigger: {
                        trigger: elt,
                        start: 'top 100%',
                    },
                    duration: .7,
                    opacity: 0,
                });
            });

          // Animation — images parralax
            $('.module-ornament .illus-wrapper').each(function (index, elt) {
                gsap.to($(elt).find('.illus'), {
                    scrollTrigger: {
                        trigger: elt,
                        scrub: true,
                        start: 'top bottom',
                        end: 'bottom top',
                    },
                    y: '14vh',
                });
            });


          // ========================================
          // Module Text image/video
          // ========================================

          // Animation
            /*$('.module-text-image').each(function (index, elt) {
                gsap.from($(elt).find('.img-left .col-1'), {
                    scrollTrigger: {
                        trigger: elt,
                        start: 'top 80%',
                    },
                    duration: .7,
                    x: -75,
                    opacity: 0,
                });
                gsap.from($(elt).find('.img-left .col-2'), {
                    scrollTrigger: {
                        trigger: elt,
                        start: 'top 80%',
                    },
                    duration: .7,
                    x: 75,
                    opacity: 0,
                });
                gsap.from($(elt).find('.img-right .col-1'), {
                    scrollTrigger: {
                        trigger: elt,
                        start: 'top 80%',
                    },
                    duration: .7,
                    x: 75,
                    opacity: 0,
                });
                gsap.from($(elt).find('.img-right .col-2'), {
                    scrollTrigger: {
                        trigger: elt,
                        start: 'top 80%',
                    },
                    duration: .7,
                    x: -75,
                    opacity: 0,
                });
            });*/


          // ========================================
          // Module Text image/video
          // ========================================

          // Animation
            $('.module-text-image.img-parallax .illus-wrapper').each(function (index, elt) {
                gsap.from($(elt).find('.illus'), {
                    scrollTrigger: {
                        trigger: elt,
                        scrub: true,
                        start: 'top bottom',
                        end: 'bottom top',
                        toggleActions: "restart reverse restart reverse",
                    },
                    y: '200px',
                    ease: 'none',
                });
            });

        })
    }
};