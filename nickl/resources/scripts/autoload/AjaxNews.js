/* eslint-disable */
(function ($) {
  var AjaxActu = function (item) {

    this.$container = item.find('.js_actu-container');
    this.$term = item.find('.js_change-term');
    this.$pagination = item.find('.pagination');
    this.$list = item.find('.js_list-actu');
    this.params = {};

    if (typeof ajaxObject !== 'undefined' && ajaxObject.ajaxurl) {
      this.params.ajaxUrl = ajaxObject.ajaxurl;
      this.params.nonce = ajaxObject.nonce;
    } else {
      console.error("ajaxObject n'est pas défini. Vérifie que wp_localize_script() est bien utilisé.");
      this.params.ajaxUrl = ''; // Valeur par défaut pour éviter une erreur
      this.params.nonce = ''; // Valeur par défaut pour éviter une erreur
    }
    this.params.ajaxActionChange = 'change_actu';
    this.params.ajaxActionLoadmore = 'loadmore_actu';
    this.params.ajaxMethod = 'actualites';

    this.init();
  };

  AjaxActu.prototype.init = function () {
    var self = this;
    var term = 'all';

    $(document).on('click', '.js_change-term', function (e) {
      e.stopImmediatePropagation();
      $('.js_change-term').removeClass('active');
      $(this).addClass('active');
      term = $(this).attr('data-value');
      self.change($(this).attr('data-value'));
    })

    $(document).on('click', '.js_load-more', function (e) {
      e.stopImmediatePropagation();
      self.loadmore(term, $('.js_load-more').attr('data-page'));
    })
  };


  AjaxActu.prototype.change = function (term) {
    var self = this;


    $.ajax({
      url: self.params.ajaxUrl,
      method: 'POST',
      data: {
        action: self.params.ajaxActionChange,
        term: term,
        nonce: self.params.nonce,
      },
      dataType: 'json',
      success: function (response) {

        if (response.success) {
          self.$list.empty().append(response.data.html);
          self.$pagination.empty().html(response.data.pagination);
        } else {
          console.error("Erreur de la requête Ajax : ", response);
        }
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error("Erreur AJAX", textStatus, errorThrown);
      }
    });
  };


  AjaxActu.prototype.loadmore = function (term, targetPage = 0) {
    var self = this;

    $.ajax({
      url: self.params.ajaxUrl,
      method: 'POST',
      data: {
        action: self.params.ajaxActionLoadmore,
        method: self.params.ajaxMethod,
        term: term,
        targetPage: targetPage,
        nonce: self.params.nonce,
      },
      dataType: 'json',
      success: function (response) {
        self.$list.append(response.data.html);
        self.$pagination.empty();
        self.$pagination.html(response.data.pagination);
      },
    }).fail(function (textStatus, errorThrown) {
      console.log(textStatus);
      console.log(errorThrown);
    });
  };
  $(document).ready(function () {

    if ($('.js_actu-container').length > 0) {
      new AjaxActu($(this));
    }
  });
})(jQuery);

