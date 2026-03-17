jQuery(document).ready(function ($) {

  // Listener principal sur le bouton "Générer"
  $(document).on('click', '#generateaicontent', function (e) {
    e.preventDefault();

    var $btn = $(this);
    var originalText = $btn.text();

    // 1. Récupération du Prompt utilisateur
    var $inputField = $('.acf-field[data-name="content_html"]');
    var promptText = '';

    if ($inputField.length) {
      promptText = $inputField.find('textarea').val();
    }

    // Gestion du Reset d'urgence (si le prompt contient le code #start-0#)
    if (promptText && promptText.includes('#start-0#')) {
      handleReset($inputField, promptText, $btn, originalText);
      return;
    }

    // Validation du prompt
    if (!promptText || promptText.trim() === '') {
      alert('Veuillez entrer une instruction pour l\'IA dans le champ.');
      return;
    }

    // État de chargement
    $btn.text('Interrogation de l\'IA...').prop('disabled', true);

    // 2. Appel AJAX vers le serveur (PHP -> Gemini)
    $.ajax({
      url: AjaxIa.ajax_url,
      type: 'POST',
      dataType: 'json',
      data: {
        action: 'generer_contenu_ia_via_ajax',
        prompt: promptText,
        _ajax_nonce: AjaxIa.nonce
      },
      success: function (response) {
        if (response.success) {
          $btn.text('Construction des modules...');

          var jsonString = response.data;
          var modulesData = [];

          try {
            // Si l'objet est déjà parsé (cas optimal)
            if (typeof jsonString === 'object') {
              var parsedData = jsonString;
            } else {
              // Nettoyage du Markdown json si présent (ex: ```json ... ```)
              if (typeof jsonString === 'string') {
                jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
              }
              var parsedData = JSON.parse(jsonString);
            }

            // Normalisation des données
            if (Array.isArray(parsedData)) {
              modulesData = parsedData;
            } else if (parsedData.modules && Array.isArray(parsedData.modules)) {
              modulesData = parsedData.modules;
            } else {
              throw new Error("Format JSON invalide. Structure attendue : tableau ou objet {modules: []}");
            }

            // Lancement de la construction ACF
            buildAcfLayouts(modulesData, $btn, originalText);

          } catch (err) {
            console.error('Erreur Parsing JSON:', err);
            console.log('Données reçues:', jsonString);
            alert('L\'IA a renvoyé des données illisibles. Consultez la console.');
            $btn.text(originalText).prop('disabled', false);
          }

        } else {
          alert('Erreur IA : ' + (response.data || 'Erreur inconnue'));
          $btn.text(originalText).prop('disabled', false);
        }
      },
      error: function (xhr, status, error) {
        console.error(error);
        alert('Erreur de communication avec le serveur.');
        $btn.text(originalText).prop('disabled', false);
      }
    });
  });

  /**
   * Fonction principale de construction des layouts ACF
   */
  function buildAcfLayouts(modulesData, $btn, originalText) {

    // Trouver le conteneur Flexible Content
    var $flexibleEl = $('.acf-field[data-name="flexible_modules"]');
    var flexible = acf.getField($flexibleEl);

    if (!flexible) {
      console.error('Instance ACF Flexible Content introuvable via acf.getField');
      $btn.text(originalText).prop('disabled', false);
      return;
    }

    // --- Définitions des Mappings et Handlers ---

    var layoutMap = {
      'module-clickable': 'clickable-tiles',
      'module-text-image': 'text-image',
      'module-key-figures': 'key-figures',
      'module-images-slider': 'images-slider',
      'module-posts-list': 'posts-list',
      'module-quote': 'quote',
      'module-illustration-video': 'illustration-video',
      'module-accordion': 'accordion',
      'module-gallery': 'gallery',
      'module-link': 'link',
      'module-separator': 'separator',
      'module-team': 'team',
      'module-text-scrolling': 'text-scrolling',
      'module-newsletter-form': 'newsletter-form',
      'module-widget': 'widget',
      'module-logos-slider': 'logos-slider',
      'module-icons': 'icons',
      'module-text-video-slider': 'text-video-slider',
      'module-images-videos-parallax': 'images-videos-parallax',
      'module-ornament': 'ornament',
      'module-plansite': 'plansite',
      'module-references': 'references',
      'module-events-slider': 'events-slider',
      'module-event-slider': 'events-slider',
      'module-news-slider': 'news-slider',
      'module-review': 'review',
      'module-summary': 'summary',
      'module-map': 'map',
      'module-contact': 'contact',
      'module-form': 'form',
      'module-reusable-bloc': 'reusable-bloc',
      'module-text': 'text',
      'module-head-text': 'head-text',
      'module-files': 'files',
      'module-columns': 'columns-tab',
      'module-one-click-services': 'one-click-services',
      'module-meteo': 'meteo',
      'module-contribution-citoyenne': 'contribution_citoyenne',
      'module-contact-elus': 'contact_elus'
    };

    var moduleHandlers = {
      'module-banner-page': function (data, $row) {
        // Gestion des champs globaux (Header)
        if ($row && $row.length) {
          // Supprimer la row car c'est de la config globale
          flexible.remove($row.attr('data-id'));
        }
        var $headerType = $('.acf-field[data-name="header_type"]');
        $headerType.find('input[value="simple"]').click(); // Force Simple Header

        if (data.bg_img) fillFeaturedImage(data.bg_img);

        if (data.background) {
          var $bannerHeight = $('.acf-field[data-name="banner_height"]');
          $bannerHeight.find('input[value="' + data.background + '"]').click();
        }
        // Titre H1 géré par WP standard ou autre champ global
      },
      'module-clickable': function (data, $row) {
        fillCommonFields(data, $row);
        fillField($row, 'clickable_block', data.is_clickable !== false);
        fillField($row, 'interlocking_tiles', data.interlocking_tiles !== false);
        fillField($row, 'orientation', data.orientation !== false);
        if (data.style) fillField($row, 'style_choice', data.style);
        if (data.main_bloc_position !== undefined) fillField($row, 'main-bloc-position', data.main_bloc_position);

        processRepeater($row, 'list_interlocking', data.items, function ($subRow, item) {
          fillField($subRow, 'title', item.title);
          fillField($subRow, 'catchphrase', item.text);
          if (item.image) fillFile($subRow, 'file', item.image);
          if (item.link) fillLinkObject($subRow, 'primary_link', item.link);
        });
      },
      'module-text-image': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.link_align) fillField($row, 'link_align', data.link_align);
        if (data.link_style) fillField($row, 'link_style', data.link_style);
        if (data.text_width) fillField($row, 'text_width', data.text_width);
        if (data.img_to_left !== undefined) fillField($row, 'img_to_left', data.img_to_left);
        if (data.media_ratio) fillField($row, 'media_ratio', data.media_ratio);
        if (data.text_align) fillField($row, 'text_align', data.text_align);

        var isImage = !data.video_src;
        fillField($row, 'media_choice', isImage);

        if (isImage && data.image) {
          fillImage($row, 'image', data.image);
        } else if (!isImage) {
          fillField($row, 'video_src', data.video_src);
          if (data.video_link) {
            var fieldKey = data.video_src === 'youtube' ? 'youtube_link' :
              (data.video_src === 'vimeo' ? 'vimeo_link' : 'dailymotion_link');
            fillField($row, fieldKey, data.video_link);
          }
        }
        fillField($row, 'text', data.content);
        if (data.cta) fillLinkObject($row, 'cta', data.cta);
      },
      'module-text': function (data, $row) {
        fillCommonFields(data, $row);
        fillField($row, 'text', data.content);
      },
      'module-head-text': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.is_h1 !== undefined) fillField($row, 'is_h1', data.is_h1);
        if (data.columns) fillField($row, 'nbr_column', data.columns);
        fillField($row, 'text', data.content);
        if (data.title) fillField($row, 'title', data.title);
      },
      'module-key-figures': function (data, $row) {
        fillCommonFields(data, $row);
        processRepeater($row, 'key_list', data.items, function ($subRow, item) {
          fillField($subRow, 'value', item.value);
          fillField($subRow, 'titre', item.title);
          fillField($subRow, 'desc', item.desc);
          if (item.icon) fillImage($subRow, 'icone', item.icon);
        });
      },
      'module-accordion': function (data, $row) {
        fillCommonFields(data, $row);
        processRepeater($row, 'accordions', data.items, function ($subRow, item) {
          fillField($subRow, 'title', item.title);
          fillField($subRow, 'text', item.content);
        });
      },
      'module-gallery': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.style) fillField($row, 'style_choice', data.style);
        if (data.width) fillField($row, 'container-width', data.width);
        if (data.columns) fillField($row, 'nbr_column', data.columns);
        if (data.type_img) fillField($row, 'type_img', data.type_img);

        processRepeater($row, 'list', data.items, function ($subRow, item) {
          fillField($subRow, 'titre', item.title);
          fillField($subRow, 'desc', item.desc);
          fillField($subRow, 'tag', item.category);
          if (item.image) fillImage($subRow, 'image', item.image);
        });
      },
      'module-contact': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.is_map) fillField($row, 'is_map', true);

        processRepeater($row, 'addresses', data.items, function ($subRow, item) {
          if (item.address) fillGoogleMapAddress($subRow, 'address', item.address);
          if (item.phone) fillField($subRow, 'phone', item.phone);
          if (item.email) fillField($subRow, 'mail', item.email);
          if (item.name) fillField($subRow, 'name', item.name);
          if (item.schedule) fillField($subRow, 'schedule', item.schedule);
        });
      },
      'module-columns': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.container_width !== undefined) fillField($row, 'container_width', data.container_width);
        if (data.justify) fillField($row, 'cols_justify_items', data.justify);
        fillField($row, 'nbr_cols', data.columns_count === 3);
        if (data.display) fillField($row, 'columns_display', data.display);

        // Traitement récursif des colonnes
        ['col1', 'col2', 'col3'].forEach(function (colKey, index) {
          if (data[colKey] && data[colKey].modules) {
            var $target = $row.find('.acf-field[data-name="columns_module_' + (index + 1) + '"]');
            processSubModules(data[colKey].modules, $target);
          }
        });
      },
      // Ajout générique pour les modules manquants qui ont juste des champs communs
      'default': function (data, $row) {
        fillCommonFields(data, $row);
      }
    };

    // --- Fonctions Utilitaires Internes ---

    function processRepeater($row, repeaterName, items, callback) {
      if (!items || !Array.isArray(items)) return;
      var $repeaterField = $row.find('.acf-field[data-name="' + repeaterName + '"]');
      var $existingRows = $repeaterField.find('.acf-row:not(.acf-clone)');
      var rowIndex = 0;

      items.forEach(function (item) {
        var $subRow;
        if (rowIndex < $existingRows.length) {
          $subRow = $existingRows.eq(rowIndex);
        } else {
          $subRow = addRepeaterRow($row, repeaterName);
        }
        rowIndex++;
        if ($subRow && callback) callback($subRow, item);
      });
    }

    function processSubModules(modulesList, $targetFlexibleContent) {
      if (!modulesList || !Array.isArray(modulesList)) return;
      modulesList.forEach(function (subMod) {
        var layoutKey = subMod.layout;
        var layoutName = layoutMap[layoutKey] || layoutKey;
        var handler = moduleHandlers[layoutKey] || moduleHandlers['default'];

        console.log('  -> Sub-module:', layoutName);
        var field = acf.getField($targetFlexibleContent);
        if (field) {
          field.add({ layout: layoutName });
          // Petit délai pour laisser le DOM se mettre à jour si nécessaire, 
          // mais ici synchrone devrait aller car field.add est souvent sync
          var $subRow = $targetFlexibleContent.find('.layout:last');
          handler(subMod.data, $subRow);
        }
      });
    }

    function fillCommonFields(data, $row) {
      if (data.padding_top) fillField($row, 'padding_top', data.padding_top);
      if (data.padding_bottom) fillField($row, 'padding_bottom', data.padding_bottom);
      if (data.background) fillField($row, 'bloc_color', data.background);
      if (data.full_width) fillField($row, 'is_fullscreen', data.full_width);
      if (data.title) fillField($row, 'title', data.title);
      if (data.title_align) fillField($row, 'title_align', data.title_align);
      if (data.title_style) fillField($row, 'title_style', data.title_style);
    }

    function fillLinkObject($row, fieldName, linkData) {
      var $field = $row.find('.acf-field[data-name="' + fieldName + '"]');
      var acfField = acf.getField($field);
      if (acfField) {
        acfField.val({
          url: linkData.url,
          title: linkData.title,
          target: linkData.target || ''
        });
      }
    }

    // --- Queue de Traitement Asynchrone ---

    var modulesQueue = [];
    modulesData.forEach(function (mod) {
      var layoutKey = mod.layout;
      var layoutName = layoutMap[layoutKey];
      var handler = moduleHandlers[layoutKey] || moduleHandlers['default'];

      // Si layoutName existe, c'est un vrai layout ACF. 
      // Sinon si handler existe (ex: banner-page), c'est un module virtuel de config.
      var isVirtual = !layoutName && !!moduleHandlers[layoutKey];

      if (layoutName || isVirtual) {
        modulesQueue.push({
          layout: layoutName || layoutKey,
          data: mod.data,
          handler: handler,
          isVirtual: isVirtual
        });
      } else {
        console.warn('Layout ignoré (inconnu) :', layoutKey);
      }
    });

    // Fonction récursive pour traiter la queue un par un
    function processNext() {
      if (modulesQueue.length === 0) {
        $btn.text(originalText).prop('disabled', false);
        console.log('Génération terminée !');
        // Switcher vers l'onglet Contenu
        var $contenuTab = $('.acf-tab-button:contains("Contenu")');
        if ($contenuTab.length) $contenuTab.click();
        return;
      }

      var item = modulesQueue.shift();
      var layoutName = item.layout;
      console.log('Traitement:', layoutName);

      // Gestion module virtuel (pas de création de row)
      if (item.isVirtual) {
        try {
          item.handler(item.data, null);
        } catch (e) { console.error(e); }
        setTimeout(processNext, 50);
        return;
      }

      // Gestion module ACF Flexible
      var isProcessed = false;

      // Listener temporaire pour savoir quand la row est prête dans le DOM
      var onAppend = function ($el) {
        if (isProcessed) return;
        // Vérification souple du layout
        if ($el.hasClass('layout') && ($el.data('layout') === layoutName || layoutName.includes($el.data('layout')))) {
          isProcessed = true;
          try {
            item.handler(item.data, $el);
          } catch (err) {
            console.error('Erreur remplissage ' + layoutName, err);
          }
          cleanup();
          setTimeout(processNext, 100); // Petit délai visuel
        }
      };

      function cleanup() {
        acf.removeAction('append', onAppend);
      }

      acf.addAction('append', onAppend);

      // Action d'ajout
      var res = false;
      try {
        res = flexible.add({ layout: layoutName });
      } catch (e) { console.error(e); }

      // Si add() retourne false ou échoue, fallback manuel
      if (!res && !isProcessed) {
        var $addBtn = flexible.$el.find('> .acf-actions .acf-fc-add');
        if ($addBtn.length) {
          $addBtn.click();
          setTimeout(function () {
            var $popup = $('.acf-fc-popup');
            var $layoutLink = $popup.find('a[data-layout="' + layoutName + '"]');
            if ($layoutLink.length) {
              $layoutLink.click();
            } else {
              // Layout introuvable dans la popup
              cleanup();
              setTimeout(processNext, 50);
            }
          }, 300);
        } else {
          cleanup();
          setTimeout(processNext, 50);
        }
      }
    }

    // Démarrage
    processNext();
  }

  // --- Helpers DOM Généraux (existant conservés) ---

  function handleReset($inputField, jsonString, $btn, originalText) {
    var $flexibleEl = $('.acf-field[data-name="flexible_modules"]');
    var flexible = acf.getField($flexibleEl);

    if (flexible) {
      var layouts = flexible.$el.find('.layout');
      for (var i = layouts.length - 1; i >= 0; i--) {
        flexible.remove(layouts.eq(i).attr('data-id'));
      }
    }

    var cleanText = jsonString.replace('#start-0#', '');
    if ($inputField.length) {
      $inputField.find('textarea').val(cleanText);
    }

    console.log('Contenu effacé.');
    $btn.text(originalText).prop('disabled', false);
    // On ne relance pas automatiquement le clic pour éviter une boucle infinie de reset
  }

  function fillField($container, fieldName, value) {
    var $field = $container.find('.acf-field[data-name="' + fieldName + '"]').first();
    if (!$field.length) return;

    // WYSIWYG
    if ($field.find('.acf-editor-wrap').length) {
      var editorId = $field.find('textarea').attr('id');
      if (editorId && typeof tinymce !== 'undefined' && tinymce.get(editorId)) {
        tinymce.get(editorId).setContent(value);
      } else {
        $field.find('textarea').val(value).trigger('change');
      }
      return;
    }

    // Button Group / Radio
    if ($field.find('.acf-button-group').length || $field.find('input[type="radio"]').length) {
      var acfField = acf.getField($field);
      if (acfField && acfField.val) {
        acfField.val(value);
      } else {
        // Fallback jQuery
        var $input = $field.find('input[value="' + value + '"]');
        if ($input.length) $input.prop('checked', true).trigger('change').parent('label').addClass('selected');
      }
      return;
    }

    // Checkbox (True/False)
    if ($field.find('input[type="checkbox"]').length) {
      var $checkbox = $field.find('input[type="checkbox"]');
      var isChecked = $checkbox.is(':checked');
      if (value === 'true') value = true;
      if (value === 'false') value = false;
      if ((value && !isChecked) || (!value && isChecked)) {
        $checkbox.click();
      }
      return;
    }

    // Standard Text/Select
    var $input = $field.find('input, textarea, select').first();
    if ($input.length) {
      $input.val(value).trigger('change');
    }
  }

  function fillGoogleMapAddress($container, fieldName, address) {
    var $field = $container.find('.acf-field[data-name="' + fieldName + '"]').first();
    if (!$field.length) return;

    if (typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
      var geocoder = new google.maps.Geocoder();
      geocoder.geocode({ 'address': address }, function (results, status) {
        if (status === 'OK' && results[0]) {
          var result = results[0];
          var location = result.geometry.location;

          var acfField = acf.getField($field);
          if (acfField) {
            acfField.val({
              address: result.formatted_address || address,
              lat: location.lat(),
              lng: location.lng()
            });
          }
        } else {
          // Fallback
          fillField($container, fieldName, address);
        }
      });
    } else {
      fillField($container, fieldName, address);
    }
  }

  function getCleanImageUrl(source) {
    if (!source) return '';
    var url = source;
    if (typeof url === 'string' && url.trim().startsWith('<img')) {
      var match = url.match(/src=["']([^"']+)["']/);
      if (match) url = match[1];
    }
    if (!url) return '';
    return url.replace(/-\d+x\d+(\.[a-zA-Z0-9]+)$/, '$1').replace(/-\d+x\d+$/, '');
  }

  function fillImage($container, fieldName, src) {
    src = getCleanImageUrl(src);
    if (!src) return;
    var $field = $container.find('.acf-field[data-name="' + fieldName + '"]').first();
    if (!$field.length) return;

    $.ajax({
      url: AjaxIa.ajax_url,
      type: 'POST',
      dataType: 'json',
      data: { action: 'find_image_by_url', url: src, _ajax_nonce: AjaxIa.nonce },
      success: function (res) {
        if (res.success) {
          var acfField = acf.getField($field);
          if (acfField) acfField.val(res.data.id);
        }
      }
    });
  }

  function fillFile($container, fieldName, src) {
    src = getCleanImageUrl(src);
    if (!src) return;
    var $field = $container.find('.acf-field[data-name="' + fieldName + '"]').first();
    if (!$field.length) return;

    $.ajax({
      url: AjaxIa.ajax_url,
      type: 'POST',
      dataType: 'json',
      data: { action: 'find_image_by_url', url: src, _ajax_nonce: AjaxIa.nonce },
      success: function (res) {
        if (res.success) {
          var acfField = acf.getField($field);
          if (acfField) acfField.val(res.data.id);
        }
      }
    });
  }

  function fillFeaturedImage(src) {
    src = getCleanImageUrl(src);
    if (!src) return;
    $.ajax({
      url: AjaxIa.ajax_url,
      type: 'POST',
      dataType: 'json',
      data: { action: 'find_image_by_url', url: src, _ajax_nonce: AjaxIa.nonce },
      success: function (res) {
        if (res.success) {
          var id = res.data.id;
          var url = res.data.url;
          var $container = $('#postimagediv .inside');
          var $input = $('#_thumbnail_id');
          if ($input.length) $input.val(id);
          var html = '<p class="hide-if-no-js"><a href="#"><img width="266" src="' + url + '" /></a></p>' +
            '<a href="#" id="remove-post-thumbnail">Supprimer</a>';
          $container.html(html).removeClass('hide-if-no-js');
        }
      }
    });
  }

  function addRepeaterRow($container, repeaterName) {
    var $repeaterField = $container.find('.acf-field[data-name="' + repeaterName + '"]').first();
    if (!$repeaterField.length) return null;
    var field = acf.getField($repeaterField);
    if (field) {
      field.add();
      return $repeaterField.find('.acf-row:not(.acf-clone)').last();
    }
    return null;
  }

});