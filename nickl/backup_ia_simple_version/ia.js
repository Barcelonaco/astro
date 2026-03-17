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

    // Gestion du Reset d'urgence
    if (promptText && promptText.includes('#start-0#')) {
      handleReset($inputField, promptText, $btn, originalText);
      return;
    }

    // Validation
    if (!promptText || promptText.trim() === '') {
      alert('Veuillez coller le JSON dans le champ.');
      return;
    }

    // État de chargement
    $btn.text('Traitement du JSON...').prop('disabled', true);

    var modulesData = [];

    try {
      var jsonString = promptText.trim();
      // Nettoyage Markdown
      if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
      }

      var parsedData = JSON.parse(jsonString);

      // Normalisation
      if (Array.isArray(parsedData)) {
        modulesData = parsedData;
      } else if (parsedData.modules && Array.isArray(parsedData.modules)) {
        modulesData = parsedData.modules;
      } else {
        throw new Error("Le JSON doit être un tableau [...] ou un objet {modules:[...]}");
      }

      console.log("JSON valide. Modules trouvés :", modulesData.length);

      // Lancement de la construction
      buildAcfLayouts(modulesData, $btn, originalText);

    } catch (err) {
      console.error('Erreur Parsing JSON:', err);
      alert('Erreur: Le contenu n\'est pas un JSON valide.\n' + err.message);
      $btn.text(originalText).prop('disabled', false);
    }
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
      'module-contact-elus': 'contact_elus',
      'module-video': 'video'
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
          if (item.link) fillLinkObject($subRow, 'link', item.link);
        });
      },
      'module-contact': function (data, $row) {
        fillCommonFields(data, $row);

        // Auto-activate map if an address is present (and is_map not explicitly defined)
        var hasAddress = false;
        if (data.items && Array.isArray(data.items)) {
          hasAddress = data.items.some(function (item) { return item.address; });
        }
        var showMap = data.is_map !== undefined ? data.is_map : hasAddress;
        fillField($row, 'is_map', showMap);

        processRepeater($row, 'addresses', data.items, function ($subRow, item) {
          if (item.address) fillGoogleMapAddress($subRow, 'address', item.address, item);
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
      'module-images-slider': function (data, $row) {
        fillCommonFields(data, $row);
        processRepeater($row, 'list', data.items, function ($subRow, item) {
          fillField($subRow, 'titre', item.title);
          fillField($subRow, 'desc', item.desc);
          if (item.image) fillImage($subRow, 'image', item.image);
          if (item.link) fillLinkObject($subRow, 'link', item.link);
        });
      },
      'module-posts-list': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.mode) fillField($row, 'mode', data.mode);
        if (data.category) fillField($row, 'category', data.category);
        if (data.number) fillField($row, 'number', data.number);
      },
      'module-quote': function (data, $row) {
        fillCommonFields(data, $row);
        fillField($row, 'quote', data.content);
        fillField($row, 'author', data.author);
        fillField($row, 'fonction', data.function);
      },
      'module-illustration-video': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.image) fillImage($row, 'image', data.image);
        if (data.video_link) fillField($row, 'video_link', data.video_link);
        if (data.video_file) fillFile($row, 'video_file', data.video_file);
      },
      'module-link': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.link) fillLinkObject($row, 'link', data.link);
      },
      'module-separator': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.height) fillField($row, 'height', data.height);
        if (data.style) fillField($row, 'style', data.style);
      },
      'module-team': function (data, $row) {
        fillCommonFields(data, $row);
        processRepeater($row, 'list', data.items, function ($subRow, item) {
          fillField($subRow, 'prenom', item.firstname);
          fillField($subRow, 'nom', item.lastname);
          fillField($subRow, 'fonction', item.function);
          fillField($subRow, 'mail', item.email);
          if (item.photo) fillImage($subRow, 'photo', item.photo);
        });
      },
      'module-text-scrolling': function (data, $row) {
        fillCommonFields(data, $row);
        fillField($row, 'text', data.content);
        if (data.speed) fillField($row, 'speed', data.speed);
      },
      'module-newsletter-form': function (data, $row) {
        fillCommonFields(data, $row);
        fillField($row, 'text', data.content);
        fillField($row, 'shortcode', data.shortcode);
      },
      'module-widget': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.widget) fillField($row, 'widget', data.widget);
      },
      'module-logos-slider': function (data, $row) {
        fillCommonFields(data, $row);
        processRepeater($row, 'list', data.items, function ($subRow, item) {
          if (item.logo) fillImage($subRow, 'logo', item.logo);
          if (item.link) fillLinkObject($subRow, 'link', item.link);
        });
      },
      'module-icons': function (data, $row) {
        fillCommonFields(data, $row);
        processRepeater($row, 'list', data.items, function ($subRow, item) {
          fillField($subRow, 'title', item.title);
          fillField($subRow, 'text', item.text);
          if (item.icon) fillImage($subRow, 'icon', item.icon);
        });
      },
      'module-text-video-slider': function (data, $row) {
        fillCommonFields(data, $row);
        processRepeater($row, 'list', data.items, function ($subRow, item) {
          fillField($subRow, 'title', item.title);
          fillField($subRow, 'text', item.text);
          if (item.video) fillFile($subRow, 'video', item.video);
        });
      },
      'module-images-videos-parallax': function (data, $row) {
        fillCommonFields(data, $row);
        processRepeater($row, 'list', data.items, function ($subRow, item) {
          if (item.image) fillImage($subRow, 'image', item.image);
          if (item.video) fillFile($subRow, 'video', item.video);
        });
      },
      'module-ornament': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.style) fillField($row, 'style', data.style);
      },
      'module-plansite': function (data, $row) {
        fillCommonFields(data, $row);
      },
      'module-references': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.selection_mode) fillField($row, 'selection_mode', data.selection_mode);
        processRepeater($row, 'list', data.items, function ($subRow, item) {
          if (item.reference) fillField($subRow, 'reference', item.reference);
        });
      },
      'module-events-slider': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.category) fillField($row, 'category', data.category);
        if (data.number) fillField($row, 'number', data.number);
      },
      'module-event-slider': function (data, $row) { // Alias
        fillCommonFields(data, $row);
        if (data.category) fillField($row, 'category', data.category);
        if (data.number) fillField($row, 'number', data.number);
      },
      'module-news-slider': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.category) fillField($row, 'category', data.category);
        if (data.number) fillField($row, 'number', data.number);
      },
      'module-review': function (data, $row) {
        fillCommonFields(data, $row);
        processRepeater($row, 'list', data.items, function ($subRow, item) {
          fillField($subRow, 'author', item.author);
          fillField($subRow, 'text', item.text);
          fillField($subRow, 'note', item.rating);
          if (item.date) fillField($subRow, 'date', item.date);
        });
      },
      'module-summary': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.title) fillField($row, 'title', data.title);
      },
      'module-map': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.address) fillGoogleMapAddress($row, 'map', data.address);
      },
      'module-form': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.form_id) fillField($row, 'form_id', data.form_id);
      },
      'module-reusable-bloc': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.bloc_id) fillField($row, 'bloc_id', data.bloc_id);
      },
      'module-files': function (data, $row) {
        fillCommonFields(data, $row);
        processRepeater($row, 'list', data.items, function ($subRow, item) {
          fillField($subRow, 'title', item.title);
          if (item.file) fillFile($subRow, 'file', item.file);
        });
      },
      'module-one-click-services': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.buttons_color) fillField($row, 'buttons_color', data.buttons_color);
      },
      'module-meteo': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.city) fillField($row, 'city', data.city);
      },
      'module-contribution-citoyenne': function (data, $row) {
        fillCommonFields(data, $row);
      },
      'module-video': function (data, $row) {
        fillCommonFields(data, $row);

        // Auto-detect mode
        // Logic: If explicitly set, use it. 
        // Else if video source/link/file present, use Video (false).
        // Else if image present, use Image (true).
        var mediaChoice = data.media_choice;

        if (mediaChoice === undefined) {
          if (data.video_src || data.video_link || data.video || data.video_file) {
            mediaChoice = false; // Video mode
          } else if (data.image) {
            mediaChoice = true; // Image mode
          }
        }

        if (mediaChoice !== undefined) fillField($row, 'media_choice', mediaChoice);

        if (data.media_ratio) fillField($row, 'media_ratio', data.media_ratio);

        // Preview Image (for video or image mode)
        if (data.preview) fillImage($row, 'preview', data.preview);
        // Image mode
        if (data.image) fillImage($row, 'image', data.image);

        // Video fields
        if (data.video_src) {
          fillField($row, 'video_src', data.video_src);
          // When changing radio, sometimes we need to refresh state
        }

        if (data.video_link) {
          var fieldKey = data.video_src === 'youtube' ? 'youtube_link' :
            (data.video_src === 'vimeo' ? 'vimeo_link' : 'dailymotion_link');
          fillField($row, fieldKey, data.video_link);
        }

        // Handle 'video' or 'video_file' keys for file upload
        var videoFile = data.video_file || data.video;
        if (videoFile) fillFile($row, 'video', videoFile);
      },
      'module-contact-elus': function (data, $row) {
        fillCommonFields(data, $row);
        if (data.service) fillField($row, 'service', data.service);
      },
      // Ajout générique (default)
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
      if (!linkData || !linkData.url) return;

      var $field = $row.find('.acf-field[data-name="' + fieldName + '"]').first();
      if (!$field.length) {
        console.warn('[fillLinkObject] Field not found: ' + fieldName);
        return;
      }

      var acfField = acf.getField($field);
      var title = linkData.title || linkData.url;
      var url = linkData.url;
      var target = linkData.target || '';

      // 1. Essai via API ACF standard
      if (acfField) {
        acfField.val({
          url: url,
          title: title,
          target: target
        });
      }

      // 2. Forçage manuel du DOM (Backup vital)
      var $linkWrap = $field.find('.acf-link');

      // Mise à jour des inputs hidden
      $linkWrap.find('input[type="hidden"].input-title').val(title);
      $linkWrap.find('input[type="hidden"].input-url').val(url);
      $linkWrap.find('input[type="hidden"].input-target').val(target);

      // Mise à jour de l'état visuel
      $linkWrap.addClass('-value');
      $linkWrap.find('.link-title').text(title);
      $linkWrap.find('.link-url').attr('href', url).text(url);
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

    // Safety Check: Do not try to fill Google Maps or other complex fields with raw values
    if ($field.hasClass('acf-field-google-map')) {
      console.warn('Skipping fillField for google map field: ' + fieldName + '. Use fillGoogleMapAddress instead.');
      return;
    }

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

  function fillGoogleMapAddress($container, fieldName, address, optData) {
    var $field = $container.find('.acf-field[data-name="' + fieldName + '"]').first();
    if (!$field.length) return;

    var acfField = acf.getField($field);

    function extractAddressDetails(result) {
      var details = {
        address: result.formatted_address,
        lat: result.geometry.location.lat(),
        lng: result.geometry.location.lng(),
        zoom: 14,
        place_id: result.place_id,
        name: result.formatted_address, // Default name
        street_number: '',
        street_name: '',
        street_name_short: '',
        city: '',
        state: '',
        post_code: '',
        country: '',
        country_short: ''
      };

      // Extract component parts
      if (result.address_components) {
        console.log('[fillGoogleMapAddress] Geocode result components:', result.address_components);
        result.address_components.forEach(function (comp) {
          var types = comp.types;
          if (types.indexOf('street_number') !== -1) {
            details.street_number = comp.long_name;
            console.log(' -> Found street_number:', comp.long_name);
          }
          if (types.indexOf('route') !== -1) {
            details.street_name = comp.long_name;
            details.street_name_short = comp.short_name;
            console.log(' -> Found route:', comp.long_name);
          }
          if (types.indexOf('locality') !== -1) {
            details.city = comp.long_name;
            console.log(' -> Found locality (city):', comp.long_name);
          }
          if (types.indexOf('administrative_area_level_1') !== -1) {
            details.state = comp.long_name;
            console.log(' -> Found state:', comp.long_name);
          }
          if (types.indexOf('postal_code') !== -1) {
            details.post_code = comp.long_name;
            console.log(' -> Found postal_code:', comp.long_name);
          }
          if (types.indexOf('country') !== -1) {
            details.country = comp.long_name;
            details.country_short = comp.short_name;
            console.log(' -> Found country:', comp.long_name);
          }
        });
      }

      // Better name heuristic
      if (details.street_number && details.street_name) {
        details.name = details.street_number + ' ' + details.street_name_short;
      } else if (details.street_name) {
        details.name = details.street_name;
      }

      return details;
    }

    function setMapValue(details) {
      // 1. Validation des coordonnées
      var finalLat = parseFloat(details.lat);
      var finalLng = parseFloat(details.lng);

      if (isNaN(finalLat) || isNaN(finalLng)) {
        finalLat = '';
        finalLng = '';
      }

      details.lat = finalLat;
      details.lng = finalLng;

      // 2. Essai via API ACF (peut crasher si la map n'est pas encore init)
      if (acfField) {
        try {
          // Vérification défensive : parfois ACF n'a pas encore créé l'objet map interne
          // Si on passe lat/lng, ACF tente de déplacer le marker.
          acfField.val(details);
        } catch (e) {
          console.warn('Erreur non bloquante lors de acfField.val() map :', e);
        }
      }

      // 3. Forçage manuel de l'input hidden (Crucial pour la sauvegarde de toutes les métadonnées)
      // L'input hidden est celui qui n'a pas la classe 'input-search'
      var $hiddenInput = $field.find('input[type="hidden"]').not('.input-search');
      if ($hiddenInput.length) {
        // On doit passer une string JSON
        $hiddenInput.val(JSON.stringify(details)).trigger('change');
      }

      // 4. Update visuel (Search input)
      var $searchInput = $field.find('.input-search');
      if ($searchInput.length) {
        $searchInput.val(details.address).trigger('change');
      }

      // 5. Trigger resize du map
      if (typeof google !== 'undefined' && google.maps && finalLat !== '' && finalLng !== '') {
        var $map = $field.find('.acf-google-map');
        if ($map.length) {
          google.maps.event.trigger($map[0], 'resize');
        }
      }
    }

    // A. Check if full data is provided in JSON (Fast Path)
    // Supports both old signature (addr, lat, lng) and new (addr, dataObj)
    var dataObj = null;
    var providedLat = null;
    var providedLng = null;

    if (typeof optData === 'object' && optData !== null) {
      dataObj = optData;
      providedLat = dataObj.lat;
      providedLng = dataObj.lng;
    } else {
      // Handle old signature: (address, lat, lng)
      providedLat = optData;
      providedLng = arguments.length > 3 ? arguments[3] : null;
    }

    // If we have full details in dataObj, use them directly
    if (dataObj && dataObj.city && dataObj.country) {
      // Construct details from dataObj
      var fullDetails = {};
      // Copy all relevant fields
      ['address', 'lat', 'lng', 'zoom', 'place_id', 'street_number', 'street_name', 'street_name_short',
        'city', 'state', 'post_code', 'country', 'country_short', 'name'].forEach(function (key) {
          if (dataObj[key] !== undefined) fullDetails[key] = dataObj[key];
        });

      // Ensure critical fields
      fullDetails.address = fullDetails.address || address;
      if (!fullDetails.zoom) fullDetails.zoom = 14;

      setTimeout(function () {
        setMapValue(fullDetails);
      }, 50);
      return;
    }

    // B. Fallback: Geocode if missing details
    if (typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
      setTimeout(function () {
        var geocoder = new google.maps.Geocoder();
        geocoder.geocode({ 'address': address }, function (results, status) {
          if (status === 'OK' && results[0]) {
            var fullDetails = extractAddressDetails(results[0]);

            // If user provided specific lat/lng, respect them if they are better? 
            // Usually we trust geocoder, but if providedLat is distinct, maybe use it?
            // For now, Geocoder is authoritative for metadata.

            setMapValue(fullDetails);
          } else {
            console.warn('Geocoding failed for "' + address + '": ' + status);
            // Fallback: use basic info + provided lat/lng
            setMapValue({
              address: address,
              lat: providedLat || '',
              lng: providedLng || '',
              zoom: 14
              // other fields empty
            });
          }
        });
      }, 200);
    } else {
      // No Geocoding available
      setMapValue({
        address: address,
        lat: providedLat || '',
        lng: providedLng || '',
        zoom: 14
      });
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
    console.log('[fillImage] Processing:', fieldName, src);
    src = getCleanImageUrl(src);
    console.log('[fillImage] Cleaned URL:', src);

    if (!src) return;
    var $field = $container.find('.acf-field[data-name="' + fieldName + '"]').first();
    if (!$field.length) {
      console.warn('[fillImage] Field not found: ' + fieldName);
      return;
    }

    if (typeof AjaxIa2 === 'undefined') {
      console.error('[fillImage] Custom error: AjaxIa2/AjaxIa is not defined. Cannot fetch image.');
      return;
    }

    $.ajax({
      url: AjaxIa2.ajax_url,
      type: 'POST',
      dataType: 'json',
      data: { action: 'find_image_by_url', url: src, _ajax_nonce: AjaxIa2.nonce },
      success: function (res) {
        if (res.success && res.data.id) {
          console.log('[fillImage] Image found, ID:', res.data.id);

          // 1. Essai via API JS ACF standard
          var acfField = acf.getField($field);
          if (acfField) {
            acfField.val(res.data.id);
          }

          // 2. Forçage manuel du DOM (car l'API ACF échoue souvent le refresh visuel en async/repeater)
          var $uploader = $field.find('.acf-image-uploader');

          // Ajout de la classe has-value
          if (!$uploader.hasClass('has-value')) {
            $uploader.addClass('has-value');
          }

          // Mise à jour de l'input hidden
          var $input = $uploader.find('input[type="hidden"]');
          if ($input.length) {
            $input.val(res.data.id).trigger('change');
          }

          // Mise à jour de la prévisualisation image
          var $img = $uploader.find('.show-if-value img');
          if ($img.length) {
            $img.attr('src', res.data.url);
          }

        } else {
          console.warn('[fillImage] Server could not find image:', src, res);
        }
      },
      error: function (err) {
        console.error('[fillImage] AJAX Error:', err);
      }
    });
  }

  function fillFile($container, fieldName, src) {
    console.log('[fillFile] Processing:', fieldName, src);
    src = getCleanImageUrl(src);
    if (!src) return;

    var $field = $container.find('.acf-field[data-name="' + fieldName + '"]').first();
    if (!$field.length) {
      console.warn('[fillFile] Field not found:', fieldName);
      return;
    }

    if (typeof AjaxIa2 === 'undefined') {
      console.error('[fillFile] AjaxIa2 undefined');
      return;
    }

    $.ajax({
      url: AjaxIa2.ajax_url,
      type: 'POST',
      dataType: 'json',
      data: { action: 'find_image_by_url', url: src, _ajax_nonce: AjaxIa2.nonce },
      success: function (res) {
        if (res.success && res.data.id) {
          console.log('[fillFile] File found ID:', res.data.id);
          var id = res.data.id;
          var url = res.data.url;
          // Best guess filename from URL
          var filename = url.substring(url.lastIndexOf('/') + 1);

          // 1. ACF API
          var acfField = acf.getField($field);
          if (acfField) {
            acfField.val(id);
          }

          // 2. Manual DOM force
          var $uploader = $field.find('.acf-file-uploader');
          $uploader.addClass('has-value');

          // Set ID
          var $input = $uploader.find('input[type="hidden"][data-name="id"]');
          // If data-name="id" not explicitly set by ACF sometimes, look for name ending in [id] or just the hidden one
          if (!$input.length) $input = $uploader.find('input[type="hidden"]');

          if ($input.length) {
            $input.val(id).trigger('change');
          }

          // Update visual details
          var $info = $uploader.find('.file-info');
          $info.find('[data-name="filename"]').text(filename).attr('href', url);
          $info.find('[data-name="title"]').text(filename); // Fallback title

          // Icon update?
          var $iconImg = $uploader.find('.file-icon img');
          // If it's a video, try to set a video icon if we can guess, otherwise keep default
          if (url.match(/\.(mp4|mov|avi)$/i) && $iconImg.length) {
            // Use WordPress default video icon if possible
            // $iconImg.attr('src', '/wp-includes/images/media/video.png'); 
            // We leave it alone or let ACF trying to fetch. 
          }

        } else {
          console.warn('[fillFile] File not found by URL:', src);
        }
      },
      error: function (e) {
        console.error('[fillFile] AJAX Error', e);
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