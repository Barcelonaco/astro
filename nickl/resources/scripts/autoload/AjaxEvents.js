/* eslint-disable */
(function ($) {
  var AjaxEvents = function (item) {
    this.$container = item.find('.js_event-container');
    this.$term = item.find('.js_change-term');
    this.$pagination = item.find('.js_list-pagination');
    this.$list = item.find('.js_list-event');

    this.params = {};

    if (typeof ajaxObject !== 'undefined' && ajaxObject.ajaxurl) {
      this.params.ajaxUrl = ajaxObject.ajaxurl;
      this.params.nonce = ajaxObject.nonce; // Ajout de la nonce
    } else {
      console.error("ajaxObject n'est pas défini. Vérifie que wp_localize_script() est bien utilisé.");
      this.params.ajaxUrl = ''; // Valeur par défaut pour éviter une erreur
      this.params.nonce = ''; // Valeur par défaut pour éviter une erreur
    }
    this.params.ajaxActionChange = 'change_events';
    this.params.ajaxActionLoadmore = 'loadmore_events';
    this.params.ajaxMethod = 'events';

    this.init();
  };

  AjaxEvents.prototype.init = function () {
    var self = this;

    $(document).on('click', '.js_change-term', function (e) {
      e.stopImmediatePropagation();
      $('.js_change-term').removeClass('active');
      $(this).addClass('active');
      self.change($(this).attr('data-value'));
    })
    // self.$term.on('change', function (e) {
    //     self.change($(self.$term).val());
    // });

    $(document).on('click', '.js_load-more', function (e) {
      e.stopImmediatePropagation();
      self.loadmore($(self.$term).val(), $('.js_load-more').attr('data-page'));
    })
  };


  AjaxEvents.prototype.change = function (term) {
    var self = this;
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
          self.$list.empty().append(response.data.html);
          self.$pagination.empty().html(response.data.pagination);
        } else {
          console.error("Erreur de la requête Ajax : ", response);
        }
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error("Erreur AJAX", textStatus, errorThrown);
      }
    }).fail(function (textStatus, errorThrown) {
      console.log(textStatus);
      console.log(errorThrown);
    });
  };


  AjaxEvents.prototype.loadmore = function (term, targetPage = 0) {
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

    if ($('.js_event-container').length > 0) {
      new AjaxEvents($(this));
    }
  });
})(jQuery);
