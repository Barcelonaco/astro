/* eslint-disable */
import Swiper from 'swiper/bundle';

(function ($) {
  var AjaxRefs = function (item) {
    this.$container = item.find('.js_refs-container');
    this.$term = item.find('.js_change-term');
    this.$pagination = item.find('.js_list-pagination');
    this.$list = item.find('.js_list-refs');
    this.$popinList = item.find('.js_popin-ref-container');

    this.params = {}; // Doit être un objet, pas un tableau

    // Vérifie si ajaxObject est défini avant de l'utiliser
    if (typeof ajaxObject !== 'undefined' && ajaxObject.ajaxurl) {
      this.params.ajaxUrl = ajaxObject.ajaxurl;
      this.params.nonce = ajaxObject.nonce; // Ajout de la nonce
    } else {
      console.error("ajaxObject n'est pas défini. Vérifie que wp_localize_script() est bien utilisé.");
      this.params.ajaxUrl = ''; // Valeur par défaut pour éviter une erreur
      this.params.nonce = ''; // Valeur par défaut pour éviter une erreur
    }

    this.params.ajaxActionChange = 'change_ref';
    this.params.ajaxActionLoadmore = 'loadmore_ref';
    this.params.ajaxMethod = 'references';

    this.init();
  };

  AjaxRefs.prototype.init = function () {
    var self = this;

    // Gestion du changement de terme
    $(document).on('click', '.js_change-term', function (e) {
      e.stopImmediatePropagation();
      $('.js_change-term').removeClass('active');
      $(this).addClass('active');
      self.change($(this).attr('data-value'));
    });

    // Gestion du bouton "Load More"
    $(document).on('click', '.js_load-more', function (e) {
      e.stopImmediatePropagation();
      self.loadmore($('.js_load-more').attr('data-term'), $('.js_load-more').attr('data-page'));
    });
  };

  // Ouverture de la popin
  AjaxRefs.prototype.openPopin = function (popin, slide) {
    $('.popin-wrapper[data-popin="' + popin + '"]').show(0).addClass('active');
    $('html').addClass('disable-scroll');
    if (slide) {
      sliderImage[$('.popin-wrapper[data-popin="' + popin + '"]').find('.slider').data('index')].slideTo(slide);
    }
  };

  // Fermeture de la popin
  AjaxRefs.prototype.closePopin = function () {
    $('.popin-wrapper').removeClass('active');
    $('html').removeClass('disable-scroll');
    setTimeout(function () {
      $('.popin-wrapper').hide(0);
    }, 600);
  };

  // Réinitialisation des événements de la popin
  AjaxRefs.prototype.reloadPopin = function () {
    var self = this;

    $(document).on('click', '.js_open-popin', function (e) {
      self.openPopin($(this).data('popin'), $(this).data('slide'));
    });

    $(document).on('click', '.js_close-popin', function (e) {
      self.closePopin();
    });
    $(document).on('click', '.popin-wrapper', function (e) {
      if (e.target !== this) {
        return;
      }
      self.closePopin();
    });
  };

  // Réinitialisation des sliders
  AjaxRefs.prototype.reloadSwipper = function () {
    $('.js_references-slider').each(function () {
      let elt = this;
      if ($(elt).find('.sub-item').length > 1) {
        new Swiper(elt, {
          loop: true,
          speed: 750,
          allowTouchMove: false,
          navigation: {
            nextEl: '.js_references-slider-btn-next',
            prevEl: '.js_references-slider-btn-prev',
          },
          pagination: {
            el: '.js_references-slider-pagination',
            type: 'bullets',
            clickable: true,
          },
        });
      }
    });

    $('.js_references-popin-slider').each(function () {
      let elt = this;
      if ($(elt).find('.item').length > 1) {
        new Swiper(elt, {
          loop: true,
          speed: 750,
          navigation: {
            nextEl: '.js_references-popin-slider-btn-next',
            prevEl: '.js_references-popin-slider-btn-prev',
          },
          pagination: {
            el: '.js_references-popin-slider-pagination',
            type: 'bullets',
            clickable: true,
          },
        });
      }
    });
  };

  // Méthode pour changer le terme via AJAX
  AjaxRefs.prototype.change = function (term) {

    let self = this;
    $.ajax({
      url: self.params.ajaxUrl,
      method: 'POST',
      data: {
        action: self.params.ajaxActionChange,
        term: term,
        method: self.params.ajaxMethod,
        nonce: self.params.nonce,
      },
      dataType: 'json',
      success: function (response) {

        if (response.success) {
          // Utilisation du HTML généré côté serveur
          self.$list.empty();
          self.$popinList.append(response.data.popin);
          self.$list.append(response.data.html); // Ajout des posts HTML générés
          self.$pagination.empty();
          self.$pagination.html(response.data.pagination); // Mise à jour de la pagination
          self.reloadSwipper(); // Actualisation du Swiper
        } else {
          console.error('Erreur AJAX: ', response.data.message);
        }
      },
    }).fail(function (textStatus, errorThrown, jqXHR) {
      console.log('Erreur AJAX:', textStatus, errorThrown);
      console.log('Réponse complète:', jqXHR);
    });
  };

  // Méthode pour charger plus de résultats via AJAX
  AjaxRefs.prototype.loadmore = function (term, targetPage = 0) {
    var self = this;

    $.ajax({
      url: self.params.ajaxUrl,
      method: 'POST',
      data: {
        action: self.params.ajaxActionLoadmore,
        term: term,
        targetPage: targetPage,
        nonce: self.params.nonce, // Ajout de la nonce dans la requête AJAX
      },
      dataType: 'json',
      success: function (response) {
        if (response.success) {
          self.$popinList.append(response.data.popin);
          self.$list.append(response.data.html);
          self.$pagination.empty();
          self.$pagination.html(response.data.pagination);
          self.reloadSwipper();
        } else {
          console.error('Erreur AJAX: ', response.data.message);
        }
      },
    }).fail(function (textStatus, errorThrown) {
      console.log('Erreur AJAX:', textStatus, errorThrown);
    });
  };

  // Initialisation du script lorsque le DOM est prêt
  jQuery(document).ready(function ($) {
    if ($('.js_refs-container').length > 0) {
      new AjaxRefs($('.js_refs-container'));
    }
    $('.js_references-slider').each(function () {
      let elt = this;
      if ($(elt).find('.sub-item').length > 1) {
        new Swiper(elt, {
          loop: true,
          speed: 750,
          allowTouchMove: false,
          navigation: {
            nextEl: '.slider-navigation.next',
            prevEl: '.slider-navigation.prev',
          },
          pagination: {
            el: '.js_references-slider-pagination',
            type: 'bullets',
            clickable: true,
          },
        });
      }
    });

    $('.js_references-popin-slider').each(function () {
      let elt = this;
      if ($(elt).find('.item').length > 1) {
        new Swiper(elt, {
          loop: true,
          speed: 750,
          navigation: {
            nextEl: '.js_references-popin-slider-btn-next',
            prevEl: '.js_references-popin-slider-btn-prev',
          },
          pagination: {
            el: '.js_references-popin-slider-pagination',
            type: 'bullets',
            clickable: true,
          },
        });
      }
    });
  });
})(jQuery);
