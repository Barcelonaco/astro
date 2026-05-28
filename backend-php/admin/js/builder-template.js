// builder-template.js — Blade-like template engine for block previews
// Extracted from app.js lines 4724-5752
// All global state lives on window (set up by state.js).
// Mutable writes use window.xxx = value.

const moduleAdminStylesLoaded = new Set();

function pickFirstString(data, keys) {
  for (const key of keys) {
    if (typeof data[key] === 'string' && data[key].trim()) return data[key].trim();
  }
  return '';
}

// Reverse map: layout slug → module class name (e.g. 'text' → 'TextSimple')
// Built lazily from moduleFieldSchema (declared near other module-level vars).

function getLayoutToModuleNameMap() {
  if (_layoutToModuleName) return _layoutToModuleName;
  window._layoutToModuleName = {};
  if (moduleFieldSchema?.modules) {
    for (const [className, mod] of Object.entries(moduleFieldSchema.modules)) {
      if (mod.layout) window._layoutToModuleName[mod.layout] = className;
    }
  }
  return _layoutToModuleName;
}

function getModuleLayout(block) {
  const def = BLOCK_TYPES[block.type] || {};
  const moduleName = def.moduleName || block.type;
  const mod = moduleFieldSchema?.modules?.[moduleName];
  if (mod?.layout) return mod.layout;
  // Fallback: block.type may be a layout slug (e.g. 'text' from acf_fc_layout
  // inside ColumnsTab). Resolve via reverse lookup.
  const map = getLayoutToModuleNameMap();
  if (map[block.type]) return block.type; // block.type IS the layout slug
  return null;
}

function queueModuleTemplateLoad(layout) {
  if (moduleTemplateCache[layout] || moduleTemplatePromises[layout]) return;
  moduleTemplatePromises[layout] = apiFetch(`/module-template?layout=${encodeURIComponent(layout)}`)
    .then((res) => {
      moduleTemplateCache[layout] = res;
      if (res?.cssUrl) ensureModuleStyles(layout, res.cssUrl);
      if (res?.adminCssUrl) ensureModuleAdminStyles(layout, res.adminCssUrl);
      updateAllPreviewsForLayout(layout);
    })
    .catch((err) => {
      console.error(`[ModuleTemplate] Failed to load layout "${layout}":`, err);
      // Store a minimal entry so the preview can show an error instead of
      // spinning on "Chargement du rendu…" forever.
      moduleTemplateCache[layout] = { template: '', cssUrl: null, adminCssUrl: null, _error: true };
      updateAllPreviewsForLayout(layout);
    })
    .finally(() => {
      delete moduleTemplatePromises[layout];
    });
}

function ensureModuleStyles(layout, cssUrl) {
  if (!cssUrl || moduleStylesLoaded.has(layout)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssUrl;
  link.dataset.moduleLayout = layout;
  document.head.appendChild(link);
  moduleStylesLoaded.add(layout);
}

function ensureModuleAdminStyles(layout, adminCssUrl) {
  if (!adminCssUrl || moduleAdminStylesLoaded.has(layout)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = adminCssUrl;
  link.dataset.moduleAdminLayout = layout;
  document.head.appendChild(link);
  moduleAdminStylesLoaded.add(layout);
}

function ensureBaseModuleStyles() {
  // Désormais, le CSS Nickl pour l'admin est chargé via nickl-app-admin.css dans index.html
  window.baseStylesLoaded = true;
}

function updateAllPreviewsForLayout(layout) {
  pageBuilderState.blocks.forEach((block) => {
    const blockLayout = getModuleLayout(block);
    if (blockLayout === layout) {
      updateBlockCardPreview(block.id);
      return;
    }
    // Also refresh ColumnsTab blocks — they may contain sub-modules of this layout
    if (block.type === 'columns-tab' || block.type === 'ColumnsTab') {
      updateBlockCardPreview(block.id);
    }
  });
}

function buildTemplateContext(block) {
  const raw = block.data && typeof block.data === 'object' ? block.data : {};
  // Certaines structures stockent les données réelles du module dans raw.module.
  // On fusionne les deux pour couvrir tous les cas possibles.
  const moduleData = raw.module && typeof raw.module === 'object' ? { ...raw.module, ...raw } : raw;
  const data = { ...moduleData, ...raw };
  const ctx = { ...data };
  ctx.module = moduleData;
  ctx.id = data.id_bloc || data.id || '';

  const extraClasses = [];
  // Couleur de fond du bloc : prise en charge de plusieurs clés possibles.
  const backgroundClass =
    data.bloc_color ||
    data.background ||
    moduleData.bloc_color ||
    moduleData.background ||
    '';
  if (backgroundClass) {
    extraClasses.push(backgroundClass);
    ctx.module = { ...ctx.module, bloc_color: backgroundClass };
  }
  const paddingTop = data.padding_top || moduleData.padding_top || '';
  const paddingBottom = data.padding_bottom || moduleData.padding_bottom || '';
  if (paddingTop) extraClasses.push(paddingTop);
  if (paddingBottom) extraClasses.push(paddingBottom);

  const baseClasses = data.classes || moduleData.classes || '';
  ctx.classes = [baseClasses, ...extraClasses].filter(Boolean).join(' ');
  const def = BLOCK_TYPES[block.type] || {};
  let moduleName = def.moduleName || block.type;
  // Fallback: block.type may be a layout slug (e.g. 'text' for TextSimple inside ColumnsTab)
  if (!moduleFieldSchema?.modules?.[moduleName]) {
    const map = getLayoutToModuleNameMap();
    if (map[block.type]) moduleName = map[block.type];
  }
  const schemaFields = moduleFieldSchema?.modules?.[moduleName]?.fields || [];
  schemaFields.forEach((field) => {
    if (!['Image', 'File', 'Video'].includes(field.type)) return;
    const current = ctx[field.name];
    if (typeof current === 'string' && current) {
      ctx[field.name] = { url: current, type: field.type === 'Video' ? 'video' : 'image' };
    }
  });
  if (data.title && !ctx.title_bloc) ctx.title_bloc = data.title;
  if (data.bg_img || data.backgroundImage) {
    const url = data.bg_img?.url || data.bg_img || data.backgroundImage?.url || '';
    let opacity = data.backgroundImage && typeof data.backgroundImage.opacity !== 'undefined'
      ? data.backgroundImage.opacity
      : null;
    if (opacity == null || opacity === '') {
      const raw = data.bg_opacity;
      if (raw !== undefined && raw !== null && raw !== '') {
        const num = Number(raw);
        if (Number.isFinite(num)) {
          opacity = num > 1 ? num / 100 : num;
        }
      }
    }
    if (opacity == null || opacity === '') {
      opacity = 0.1;
    }
    ctx.backgroundImage = { url, opacity };
    if (url) {
      // Reproduire la variable $background_image calculée dans le @php (strippé par le moteur JS)
      ctx.background_image = `background-image: url(${url})`;
      extraClasses.push('has-background-image');
      const parallax = data.bg_parallax === true || data.bg_parallax === 1 || data.bg_parallax === '1';
      if (parallax) extraClasses.push('background-parallax');
    }
  }
  if (data.cta && typeof data.cta === 'string') {
    ctx.cta = { url: data.cta, title: data.cta_title || data.cta };
  }
  if (block.type === 'hero' || block.type === 'Hero') {
    const isSlider = data.is_hero_banner_slider !== false
      && data.is_hero_banner_slider !== 0
      && data.is_hero_banner_slider !== '0';
    ctx.isSlider = isSlider;
    ctx.sliders = Array.isArray(data.hero_sliders) ? data.hero_sliders : [];
    ctx.blocks = [data.left_bloc, data.right_bloc].filter(Boolean);
    ctx.heroBgColor = data.bloc_color || '';
    ctx.seamlessMenu = false;
    ctx.number = data.id_bloc || 'section_0';
    // $fields est défini dans @php (strippé), on le reconstitue ici
    ctx.fields = {
      hero_banner_align:   data.hero_banner_align   || 'left',
      h1_in_header:        data.h1_in_header        || 'yes',
      hero_banner_height:  data.hero_banner_height  || false,
      hero_banner_marquise: data.hero_banner_marquise || false,
    };
  }
  if (block.type === 'banner' || block.type === 'Banner') {
    ctx.number = data.id_bloc || 'section_0';
    ctx.heightBanner = data.banner_height || 'small';
    ctx.titleInHeader = data.title_in_header !== 'hideTitle' ? 'showTitle' : 'hideTitle';
    ctx.h1InHeader = data.h1_in_header || 'yes';
    ctx.imgBanner = data.image?.url ? { url: data.image.url } : null;
    ctx.title = data.title || 'Titre de page';
    ctx.title_size = data.title_size || '';
    ctx.isWooCommercePage = false;
    ctx.term = null;
  }
  if (block.type === 'gallery' || block.type === 'Gallery') {
    const typeImg = data?.type_img || data?.options?.type_img || data?.options?.typeImg || 'img-fluid';
    const columns = data?.nbr_column || data?.options?.nbr_column || data?.options?.nbrColumn || 'columns-3';
    const styleChoice = data?.style_choice || 'style-1';
    extraClasses.push(styleChoice);
    ctx.options = {
      width: data['container-width'] === 'large' ? '-large' : '',
      nbr_column: columns,
      type_img: typeImg
    };
    ctx.indexPopin = data.indexPopin || block.id || 'gallery';
    if (typeImg === 'img-fluid') {
      ctx.sizes = 'module-gallery-fluid';
    } else if (typeImg === 'img-fixe' && columns === 'columns-1') {
      ctx.sizes = 'banner';
    } else {
      ctx.sizes = 'module-gallery-fixe';
    }
  }
  // IllusVideo : le View Composer PHP fournit $url et $ratio
  if (block.type === 'illus-video' || block.type === 'IllusVideo') {
    const vid = data.video || {};
    ctx.url = typeof vid === 'string' ? vid : (vid.url || '');
    const w = Number(vid.width) || 0;
    const h = Number(vid.height) || 0;
    ctx.ratio = h > 0 ? Math.floor(w / h) : 2;
  }
  // ClickableTiles : reproduire le View Composer PHP
  if (block.type === 'clickable-tiles' || block.type === 'ClickableTiles') {
    const listItems = Array.isArray(data.list_interlocking) ? data.list_interlocking : [];
    ctx.list_items = listItems;
    ctx.first_item = listItems.slice(0, 1);
    ctx.other_items = listItems.slice(1);
    ctx.interlocking_tiles = data.interlocking_tiles === true || data.interlocking_tiles === 1 || data.interlocking_tiles === '1';
    ctx.orientation = data.orientation === true || data.orientation === 1 || data.orientation === '1';
    ctx.clickable_block = data.clickable_block === true || data.clickable_block === 1 || data.clickable_block === '1';
    const mainRight = data['main-bloc-position'] === true || data['main-bloc-position'] === 1 || data['main-bloc-position'] === '1';
    if (mainRight) extraClasses.push('main-bloc-right');
    else extraClasses.push('main-bloc-left');
    const styleChoice = data.style_choice || 'style-1';
    extraClasses.push(styleChoice);
    ctx.module = { ...ctx.module, clickable_block: ctx.clickable_block };
  }
  // Separator : largeur divisée par 2 si texte présent + classe separator-with-text
  if (block.type === 'separator' || block.type === 'Separator') {
    const rawWidth = parseInt(data.width || moduleData.width || 100, 10);
    const hasText = !!(data.text || moduleData.text);
    ctx.width = hasText ? Math.floor(rawWidth / 2) : rawWidth;
    if (hasText) extraClasses.push('separator-with-text');
    ctx.module = { ...ctx.module, text: data.text || moduleData.text || '', style: data.style || moduleData.style || 'style-0', width: ctx.width };
  }
  // Quote : objet quote assemblé
  if (block.type === 'quote' || block.type === 'Quote') {
    ctx.quote = {
      photo: data.photo || moduleData.photo || null,
      quote: data.quote || moduleData.quote || '',
      name: data.name || moduleData.name || '',
      job: data.job || moduleData.job || ''
    };
  }
  // Ornament : largeur image en % de 1920px
  if (block.type === 'ornament' || block.type === 'Ornament') {
    const imgWidth = parseInt(data.img_width || moduleData.img_width || 0, 10);
    if (imgWidth > 0) {
      ctx.widthImage = Math.round(imgWidth * 100 / 1920 * 100) / 100;
    } else {
      const img = data.image || moduleData.image;
      const bannerWidth = img?.sizes?.['banner-width'] || img?.width || 0;
      ctx.widthImage = bannerWidth > 0 ? Math.round(bannerWidth * 100 / 1920 * 100) / 100 : 10;
    }
    ctx.module = { ...ctx.module, img_width: data.img_width || moduleData.img_width || '' };
  }
  // TextImage : placement, ratioImg, classes parallax + media_ratio, image, media_choice normalization
  if (block.type === 'text-image' || block.type === 'TextImage') {
    const imgToLeft = data.img_to_left === true || data.img_to_left === 1 || data.img_to_left === '1'
      || moduleData.img_to_left === true || moduleData.img_to_left === 1 || moduleData.img_to_left === '1';
    ctx.placement = imgToLeft ? 'img-left' : 'img-right';
    const ratio = data.media_ratio || moduleData.media_ratio || '';
    // full-height is kept as-is; CSS overrides in style.css (.builder-block-render
    // .module-text-image .cols-wrapper.full-height) neutralise 100vh / absolute
    // positioning and apply a tall aspect-ratio instead.
    const ratioMap = { landscape: 'banner', portrait: 'portrait', square: 'square-large' };
    ctx.ratioImg = ratioMap[ratio] || 'background-module';
    ctx.link_align = data.link_align || moduleData.link_align || '';
    ctx.link_style = data.link_style || moduleData.link_style || '';
    if (ratio) extraClasses.push(ratio);
    const imgParallax = data.img_parallax === true || data.img_parallax === 1 || data.img_parallax === '1';
    const mediaChoice = data.media_choice === true || data.media_choice === 1 || data.media_choice === '1';
    if (imgParallax && mediaChoice) extraClasses.push('img-parallax');
    // Normalize media_choice to numeric 1/0 so Blade @if ($module['media_choice'] == 1) works
    // (PHP loose comparison: true == 1 is true, but JS String(true) !== '1')
    ctx.module = { ...ctx.module, media_choice: mediaChoice ? 1 : 0, media_ratio: ratio };
    // Replicate the @php block that creates $img (stripped by the JS Blade engine)
    const imgData = data.image || moduleData.image || ctx.image;
    if (imgData) {
      const imgUrl = typeof imgData === 'string' ? imgData
        : (imgData?.sizes?.[ctx.ratioImg] || imgData?.sizes?.banner || imgData?.url || '');
      const imgAlt = typeof imgData === 'object' ? (imgData?.alt || '') : '';
      ctx.img = { url: imgUrl, alt: imgAlt };
    }
  }
  // TextScrolling : textes, taille, direction, vitesse
  if (block.type === 'text-scrolling' || block.type === 'TextScrolling') {
    ctx.texts = Array.isArray(data.texts || moduleData.texts) ? (data.texts || moduleData.texts) : [];
    ctx.text_size = data.text_size || moduleData.text_size || '';
    ctx.text_direction = data.text_direction || moduleData.text_direction || '';
    ctx.text_speed = data.text_speed || moduleData.text_speed || '';
  }
  // KeyFigures : liste des chiffres clés
  if (block.type === 'key-figures' || block.type === 'KeyFigures') {
    ctx.key_list = Array.isArray(data.key_list || moduleData.key_list) ? (data.key_list || moduleData.key_list) : [];
  }
  // Team : membres, format photos, alignement
  if (block.type === 'team' || block.type === 'Team') {
    ctx.team_members = Array.isArray(data.list || moduleData.list) ? (data.list || moduleData.list) : [];
    ctx.pictures_format = data.pictures_format || moduleData.pictures_format || 'portrait';
    ctx.align = data.align || moduleData.align || 'center';
  }
  // Video : image résolue, classe img-parallax
  if (block.type === 'video' || block.type === 'Video') {
    const imgData = data.image || moduleData.image || data.preview || moduleData.preview;
    const imgUrl = typeof imgData === 'string' ? imgData : (imgData?.url || imgData?.sizes?.['square-large'] || '');
    const imgAlt = typeof imgData === 'object' ? (imgData?.alt || '') : '';
    ctx.image = { src: imgUrl, alt: imgAlt };
    const imgParallax = data.img_parallax === true || data.img_parallax === 1 || data.img_parallax === '1';
    const mediaChoice = data.media_choice === true || data.media_choice === 1 || data.media_choice === '1';
    if (imgParallax && !mediaChoice) extraClasses.push('img-parallax');
  }
  // ColumnsTab : display, background, count
  if (block.type === 'columns-tab' || block.type === 'ColumnsTab') {
    ctx.id = data.id_bloc || data.id || '';
    ctx.display = data.columns_display || moduleData.columns_display || '';
    ctx.columnsBackground = data.columns_background || moduleData.columns_background || 'no-background';
    const colsList = Array.isArray(data.columns_list || moduleData.columns_list) ? (data.columns_list || moduleData.columns_list) : [];
    ctx.columnsCount = colsList.length;
    ctx.colsHaveBackground = ctx.columnsBackground !== 'no-background' ? 'cols_have_background' : '';
    if (ctx.colsHaveBackground) extraClasses.push(ctx.colsHaveBackground);
  }
  // SliderTextVideo : slider, h1_in_header
  if (block.type === 'text-video-slider' || block.type === 'SliderTextVideo') {
    ctx.slider = Array.isArray(data.slider || moduleData.slider) ? (data.slider || moduleData.slider) : [];
    ctx.h1_in_header = data.h1_in_header || moduleData.h1_in_header || '';
  }
  // ImagesSlider : images normalisées, full-width
  if (block.type === 'images-slider' || block.type === 'ImagesSlider') {
    const rawSliders = Array.isArray(data.sliders || moduleData.sliders) ? (data.sliders || moduleData.sliders) : [];
    ctx.images = rawSliders.map(function(slide) {
      const img = slide.image || {};
      const imgUrl = typeof img === 'string' ? img : (img.url || '');
      const imgAlt = typeof img === 'object' ? (img.alt || '') : '';
      const link1 = slide.link || {};
      const link1Url = typeof link1 === 'string' ? link1 : (link1.url || '');
      const link1Title = typeof link1 === 'string' ? link1 : (link1.title || 'En savoir plus');
      const link1Target = typeof link1 === 'object' ? (link1.target || '_self') : '_self';
      const link2Raw = slide.link_2;
      const link2Url = typeof link2Raw === 'string' ? link2Raw : ((link2Raw && link2Raw.url) || '');
      const link2 = link2Url
        ? {
            url: link2Url,
            title: (typeof link2Raw === 'object' && link2Raw && link2Raw.title) || 'En savoir plus',
            target: (typeof link2Raw === 'object' && link2Raw && link2Raw.target) || '_self',
          }
        : null;
      return {
        image_url: imgUrl,
        image_alt: imgAlt,
        legend: slide.legend || '',
        text: slide.text || '',
        has_desc: !!(slide.legend || slide.text || link1Url),
        link_url: link1Url,
        link_title: link1Title,
        link_target: link1Target,
        link2: link2
      };
    });
    const isFullscreen = data.is_fullscreen === true || data.is_fullscreen === 1 || data.is_fullscreen === '1';
    if (isFullscreen) extraClasses.push('full-width');
  }
  // HeadText : text, h1_in_header, nbr_column class
  if (block.type === 'head-text' || block.type === 'HeadText') {
    ctx.text = data.text || moduleData.text || '';
    ctx.h1_in_header = data.h1_in_header || moduleData.h1_in_header || '';
    const nbrColumn = data.nbr_column || moduleData.nbr_column || '';
    if (nbrColumn) extraClasses.push(nbrColumn);
    const bgParallax = data.bg_parallax === true || data.bg_parallax === 1 || data.bg_parallax === '1';
    if (bgParallax && !extraClasses.includes('background-parallax')) extraClasses.push('background-parallax');
  }
  // Contact : content (full module), is_map, main-bloc-position
  if (block.type === 'contact' || block.type === 'Contact') {
    ctx.content = { ...moduleData };
    ctx.is_map = data.is_map === true || data.is_map === 1 || data.is_map === '1'
      || moduleData.is_map === true || moduleData.is_map === 1 || moduleData.is_map === '1';
    const mainRight = data['main-bloc-position'] === true || data['main-bloc-position'] === 1 || data['main-bloc-position'] === '1';
    if (mainRight) extraClasses.push('main-bloc-right');
    else extraClasses.push('main-bloc-left');
  }
  // Files : files, files_preview, main-bloc-position
  if (block.type === 'files' || block.type === 'Files') {
    ctx.files = Array.isArray(data.files || moduleData.files) ? (data.files || moduleData.files) : [];
    ctx.files_preview = data.files_preview || moduleData.files_preview || '';
    const mainRight = data['main-bloc-position'] === true || data['main-bloc-position'] === 1 || data['main-bloc-position'] === '1';
    if (mainRight) extraClasses.push('main-bloc-right');
    else extraClasses.push('main-bloc-left');
  }
  // LogosSlider : indexPopin
  if (block.type === 'logos-slider' || block.type === 'LogosSlider' || block.type === 'slider-logo' || block.type === 'SliderLogo') {
    ctx.indexPopin = Math.floor(Math.random() * 1000);
    delete ctx.columns;
  }
  // ImagesVideosParallax : blocs
  if (block.type === 'images-videos-parallax' || block.type === 'ImagesVideosParallax') {
    ctx.blocs = Array.isArray(data.blocs || moduleData.blocs) ? (data.blocs || moduleData.blocs) : [];
  }
  // Reconstruire ctx.classes avec tous les extraClasses ajoutés (y compris par les blocs spécifiques)
  const baseClasses2 = data.classes || moduleData.classes || '';
  ctx.classes = [baseClasses2, ...extraClasses].filter(Boolean).join(' ');
  return ctx;
}

function renderBladeTemplate(template, ctx) {
  let html = String(template || '');
  html = html.replace(/@php[\s\S]*?@endphp/g, '');
  html = html.replace(/<\?php[\s\S]*?\?>/g, '');
  html = html.replace(/<\?(?!xml)[\s\S]*?\?>/g, '');
  html = html.replace(/<\?=[\s\S]*?\?>/g, '');
  html = html.replace(/{{--[\s\S]*?--}}/g, '');
  html = html.replace(/@include\(\s*['"]components\.bloc-title-module['"][\s\S]*?\)/g, () => renderBlocTitle(ctx));
  html = renderForLoops(html, ctx);
  html = renderForeach(html, ctx);
  html = renderIfBlocks(html, ctx);
  html = renderSwitchBlocks(html, ctx);
  html = html.replace(/@include\(\s*['"]components\.clickable-item['"][^)]*\)/g, () => renderClickableItem(ctx));
  html = html.replace(/@includeIf\([\s\S]*?\)/g, '');
  html = html.replace(/@include\([\s\S]*?\)/g, '');
  html = html.replace(/@endphp/g, '');
  html = html.replace(/\{!!\s*([^}]+)\s*!!\}/g, (_, expr) => resolveExpression(expr, ctx, true));
  html = html.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expr) => resolveExpression(expr, ctx, false));
  html = html.replace(/@\w+\b/g, '');
  return html;
}

function renderBlocTitle(ctx) {
  const title = ctx.title_bloc || ctx.title || '';
  if (!title) return '';
  const level = ctx.title_style || 2;
  const align = ctx.title_align || 'center';
  const safeTitle = escapeHtml(String(title));
  return `<h${level} class="title-module title-section-${level} align-${escapeHtml(String(align))}">${safeTitle}</h${level}>`;
}

function renderClickableItem(ctx) {
  const item = ctx.item || {};
  const mod = ctx.module || {};
  const clickableBlock = mod.clickable_block || ctx.clickable_block || false;
  const orientation = ctx.orientation ?? false;
  const file = item.file || {};
  const fileUrl = typeof file === 'string' ? file : (file.url || '');
  const mime = file.mime_type || file.type || '';
  const isVid = mime.startsWith('video/') || /\.(mp4|mov|mpeg|mpg)$/i.test(fileUrl);
  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(fileUrl);
  const title = item.title || '';
  const catchphrase = item.catchphrase || '';
  const primaryLink = item.primary_link || {};
  const secondaryLink = item.secondary_link || {};
  const hasDescription = !!(title || catchphrase || (!clickableBlock && (primaryLink.url || secondaryLink.url)));
  const descClass = hasDescription ? 'has-desc' : 'no-desc';
  const orientClass = !orientation ? ' landscape' : '';

  let mediaHtml = '';
  if (isPdf && fileUrl) {
    mediaHtml = `<div class="illus-wrapper" style="display:flex;align-items:center;justify-content:center;background:#f8f9fa;min-height:120px;"><a href="${escapeHtml(fileUrl)}" target="_blank" style="display:flex;flex-direction:column;align-items:center;gap:8px;text-decoration:none;color:#333;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg><span style="font-size:12px;">Visualiser</span></a></div>`;
  } else if (isVid && fileUrl) {
    mediaHtml = `<div class="video-wrapper"><video class="background-video" autoplay loop muted playsinline><source src="${escapeHtml(fileUrl)}" type="video/mp4"></video></div>`;
  } else if (fileUrl) {
    mediaHtml = `<div class="illus-wrapper"><img src="${escapeHtml(fileUrl)}" alt="" class="illus"></div>`;
  }

  let descHtml = '';
  if (hasDescription) {
    let inner = '';
    if (title) inner += `<h3 class="title">${escapeHtml(title)}</h3>`;
    if (catchphrase) inner += `<div class="editor txt"><p>${escapeHtml(catchphrase)}</p></div>`;
    if (!clickableBlock && (primaryLink.url || secondaryLink.url)) {
      let btns = '';
      if (primaryLink.url) btns += `<a href="${escapeHtml(primaryLink.url)}" class="btn btn-primary" target="${escapeHtml(primaryLink.target || '_self')}">${escapeHtml(primaryLink.title || '')}</a>`;
      if (secondaryLink.url) btns += `<a href="${escapeHtml(secondaryLink.url)}" class="btn btn-secondary" target="${escapeHtml(secondaryLink.target || '_self')}">${escapeHtml(secondaryLink.title || '')}</a>`;
      inner += `<div class="btn-wrapper">${btns}</div>`;
    }
    descHtml = `<div class="desc">${inner}</div>`;
  }

  const contentInner = mediaHtml + descHtml;
  let contentHtml;
  if (clickableBlock && primaryLink.url) {
    contentHtml = `<a href="${escapeHtml(primaryLink.url)}" class="item-content" target="${escapeHtml(primaryLink.target || '_self')}" rel="bookmark">${contentInner}</a>`;
  } else {
    contentHtml = `<div class="item-content">${contentInner}</div>`;
  }

  return `<div class="item ${descClass}${orientClass}" role="article">${contentHtml}</div>`;
}

function findMatchingEndfor(source, startIndex) {
  let depth = 0;
  let i = startIndex;
  while (i < source.length) {
    // Find next @for that is NOT @foreach/@forelse (char after @for must be '(' or whitespace)
    let nextFor = -1;
    let sf = i;
    while (true) {
      const pos = source.indexOf('@for', sf);
      if (pos === -1) break;
      const ch = source[pos + 4] || '';
      if (ch === '(' || ch === ' ') { nextFor = pos; break; }
      sf = pos + 4;
    }
    // Find next @endfor that is NOT @endforeach/@endforelse (char after @endfor must not be a letter)
    let nextEnd = -1;
    sf = i;
    while (true) {
      const pos = source.indexOf('@endfor', sf);
      if (pos === -1) break;
      const ch = source[pos + 7] || '';
      if (!/[a-zA-Z]/.test(ch)) { nextEnd = pos; break; }
      sf = pos + 7;
    }
    if (nextEnd === -1) return -1;
    if (nextFor !== -1 && nextFor < nextEnd) {
      depth++;
      i = nextFor + 4;
      continue;
    }
    if (depth === 0) return nextEnd;
    depth--;
    i = nextEnd + 7;
  }
  return -1;
}

function renderForLoops(input, ctx) {
  // Handles @for($i = 0; $i < N; $i++) ... @endfor
  const headerRegex = /@for\s*\(\s*\$([A-Za-z0-9_]+)\s*=\s*(\d+)\s*;\s*\$\1\s*<\s*(\d+)\s*;\s*\$\1\+\+\s*\)/;
  let html = input;
  let safety = 0;
  while (safety++ < 50) {
    const headerMatch = headerRegex.exec(html);
    if (!headerMatch) break;
    const start = headerMatch.index;
    const bodyStart = start + headerMatch[0].length;
    const endIndex = findMatchingEndfor(html, bodyStart);
    if (endIndex === -1) break;
    const initVal = parseInt(headerMatch[2], 10);
    const limitVal = parseInt(headerMatch[3], 10);
    const body = html.slice(bodyStart, endIndex);
    let rendered = '';
    for (let idx = initVal; idx < limitVal; idx++) {
      rendered += renderBladeTemplate(body, { ...ctx });
    }
    html = html.slice(0, start) + rendered + html.slice(endIndex + 7); // '@endfor'.length = 7
  }
  return html;
}

function findMatchingEndforeach(source, startIndex) {
  let depth = 0;
  let i = startIndex;
  while (i < source.length) {
    const nextForeach = source.indexOf('@foreach', i);
    const nextEnd = source.indexOf('@endforeach', i);
    if (nextEnd === -1) return -1;
    if (nextForeach !== -1 && nextForeach < nextEnd) {
      depth++;
      i = nextForeach + 8; // '@foreach'.length
      continue;
    }
    if (depth === 0) return nextEnd;
    depth--;
    i = nextEnd + 11; // '@endforeach'.length
  }
  return -1;
}

function renderForeach(input, ctx) {
  const headerRegex = /@foreach\s*\(\s*([^)]+?)\s+as\s+\$([A-Za-z0-9_]+)(?:\s*=>\s*\$([A-Za-z0-9_]+))?\s*\)/;
  let html = input;
  let safety = 0;
  while (safety++ < 200) {
    const headerMatch = headerRegex.exec(html);
    if (!headerMatch) break;
    const start = headerMatch.index;
    const bodyStart = start + headerMatch[0].length;
    const endIndex = findMatchingEndforeach(html, bodyStart);
    if (endIndex === -1) break;
    const listExpr = headerMatch[1];
    const firstVar = headerMatch[2];
    const secondVar = headerMatch[3];
    const body = html.slice(bodyStart, endIndex);
    const list = resolveValue(listExpr, ctx);
    if (!Array.isArray(list) || list.length === 0) {
      html = html.slice(0, start) + html.slice(endIndex + 11);
      continue;
    }
    const rendered = list.map((item, index) => {
      const nestedCtx = { ...ctx };
      if (secondVar) {
        nestedCtx[firstVar] = index;
        nestedCtx[secondVar] = item;
      } else {
        nestedCtx[firstVar] = item;
      }
      return renderBladeTemplate(body, nestedCtx);
    }).join('');
    html = html.slice(0, start) + rendered + html.slice(endIndex + 11);
  }
  return html;
}

function renderIfBlocks(input, ctx) {
  let html = input;
  let i = 0;
  while (i < html.length) {
    const start = html.indexOf('@if', i);
    if (start === -1) break;
    html = html.slice(0, start) + processIfBlock(html.slice(start), ctx);
    i = start + 1;
  }
  return html;
}

function renderSwitchBlocks(input, ctx) {
  let html = input;
  let i = 0;
  while (i < html.length) {
    const start = html.indexOf('@switch', i);
    if (start === -1) break;
    const openParen = html.indexOf('(', start);
    if (openParen === -1) break;
    const exprResult = readParenExpr(html, openParen);
    if (!exprResult) break;
    const { expr, end: exprEnd } = exprResult;
    const bodyStart = exprEnd + 1;
    const endIndex = findMatchingEndswitch(html, bodyStart);
    if (endIndex === -1) break;
    const body = html.slice(bodyStart, endIndex);
    const rendered = processSwitchBody(body, expr, ctx);
    html = html.slice(0, start) + rendered + html.slice(endIndex + '@endswitch'.length);
    i = start + rendered.length;
  }
  return html;
}

function findMatchingEndswitch(fragment, startIndex) {
  let depth = 1;
  let i = startIndex;
  while (i < fragment.length) {
    const nextSwitch = fragment.indexOf('@switch', i);
    const nextEnd = fragment.indexOf('@endswitch', i);
    if (nextEnd === -1) return -1;
    if (nextSwitch !== -1 && nextSwitch < nextEnd) {
      depth += 1;
      i = nextSwitch + 7;
      continue;
    }
    depth -= 1;
    if (depth === 0) return nextEnd;
    i = nextEnd + 10;
  }
  return -1;
}

function processSwitchBody(body, expr, ctx) {
  const switchValue = resolveValue(expr, ctx);
  const caseRegex = /@case\s*\(([\s\S]*?)\)|@default/g;
  const matches = [];
  let match;
  while ((match = caseRegex.exec(body)) !== null) {
    matches.push({
      type: match[0].startsWith('@default') ? 'default' : 'case',
      expr: match[1],
      index: match.index,
      end: match.index + match[0].length
    });
  }
  if (matches.length === 0) return body.replace(/@break\b/g, '');
  let defaultContent = '';
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const content = body.slice(current.end, next ? next.index : body.length).replace(/@break\b/g, '');
    if (current.type === 'default') {
      defaultContent = content;
      continue;
    }
    const caseValue = resolveValue(current.expr, ctx);
    if (String(caseValue) === String(switchValue)) {
      return content;
    }
  }
  return defaultContent;
}

function processIfBlock(fragment, ctx) {
  if (!fragment.startsWith('@if')) return fragment;
  const openParen = fragment.indexOf('(');
  if (openParen === -1) return fragment;
  const condResult = readParenExpr(fragment, openParen);
  if (!condResult) return fragment;
  const { expr: cond, end: condEnd } = condResult;
  const bodyStart = condEnd + 1;
  const endifIndex = findMatchingEndif(fragment, bodyStart);
  if (endifIndex === -1) return fragment;
  const body = fragment.slice(bodyStart, endifIndex);
  const { contents, conditions, elseContent } = splitIfBranches(body);
  let chosen = '';
  if (evaluateCondition(cond, ctx)) {
    chosen = contents[0] || '';
  } else {
    let applied = false;
    for (let idx = 0; idx < conditions.length; idx++) {
      if (evaluateCondition(conditions[idx], ctx)) {
        chosen = contents[idx + 1] || '';
        applied = true;
        break;
      }
    }
    if (!applied && elseContent != null) {
      chosen = elseContent;
    }
  }
  return chosen + fragment.slice(endifIndex + '@endif'.length);
}

function readParenExpr(source, openIndex) {
  if (source[openIndex] !== '(') return null;
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(') depth += 1;
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        return { expr: source.slice(openIndex + 1, i), end: i };
      }
    }
  }
  return null;
}

function findMatchingEndif(source, startIndex) {
  let idx = startIndex;
  let depth = 0;
  while (idx < source.length) {
    const nextIf = source.indexOf('@if', idx);
    const nextEndif = source.indexOf('@endif', idx);
    if (nextEndif === -1) return -1;
    if (nextIf !== -1 && nextIf < nextEndif) {
      depth += 1;
      idx = nextIf + 3;
      continue;
    }
    if (depth === 0) return nextEndif;
    depth -= 1;
    idx = nextEndif + 6;
  }
  return -1;
}

function splitIfBranches(body) {
  const contents = [];
  const conditions = [];
  let elseContent = null;
  let current = '';
  let i = 0;
  let nested = 0;
  while (i < body.length) {
    if (body.startsWith('@if', i)) {
      nested += 1;
      current += '@if';
      i += 3;
      continue;
    }
    if (body.startsWith('@endif', i)) {
      nested = Math.max(0, nested - 1);
      current += '@endif';
      i += 6;
      continue;
    }
    if (nested === 0 && body.startsWith('@elseif', i)) {
      contents.push(current);
      current = '';
      const open = body.indexOf('(', i + 7);
      if (open === -1) {
        i += 7;
        continue;
      }
      const exprResult = readParenExpr(body, open);
      if (!exprResult) {
        i += 7;
        continue;
      }
      conditions.push(exprResult.expr);
      i = exprResult.end + 1;
      continue;
    }
    if (nested === 0 && body.startsWith('@else', i)) {
      contents.push(current);
      current = '';
      elseContent = '';
      i += 5;
      continue;
    }
    current += body[i];
    i += 1;
  }
  if (elseContent != null) {
    elseContent = current;
  } else {
    contents.push(current);
  }
  return { contents, conditions, elseContent };
}

function evaluateCondition(cond, ctx) {
  const raw = String(cond || '').trim();
  if (!raw) return false;
  const orParts = raw.split('||').map(p => p.trim()).filter(Boolean);
  if (orParts.length > 1) return orParts.some(p => evaluateCondition(p, ctx));
  const andParts = raw.split('&&').map(p => p.trim()).filter(Boolean);
  if (andParts.length > 1) return andParts.every(p => evaluateCondition(p, ctx));

  const negated = raw.startsWith('!');
  const expr = negated ? raw.slice(1).trim() : raw;

  let result = false;
  const emptyMatch = expr.match(/^empty\(\s*(.+)\s*\)$/);
  const notEmptyMatch = expr.match(/^!empty\(\s*(.+)\s*\)$/);
  const issetMatch = expr.match(/^isset\(\s*(.+)\s*\)$/);
  const notIssetMatch = expr.match(/^!isset\(\s*(.+)\s*\)$/);
  const equalityMatch = expr.match(/(.+?)(===|!==|==|!=|>=|<=|>|<)\s*(['"].*?['"]|\$[\w\[\]'".->]+|\d+|true|false|null)/);

  if (notEmptyMatch) {
    const value = resolveValue(notEmptyMatch[1], ctx);
    result = !isEmpty(value);
  } else if (emptyMatch) {
    const value = resolveValue(emptyMatch[1], ctx);
    result = isEmpty(value);
  } else if (notIssetMatch) {
    const value = resolveValue(notIssetMatch[1], ctx);
    result = value === undefined || value === null;
  } else if (issetMatch) {
    const value = resolveValue(issetMatch[1], ctx);
    result = value !== undefined && value !== null;
  } else if (equalityMatch) {
    const left = resolveValue(equalityMatch[1], ctx);
    const rightRaw = equalityMatch[3].trim();
    const right = rightRaw === 'false' ? false : rightRaw === 'true' ? true : rightRaw === 'null' ? null : resolveValue(rightRaw, ctx);
    const op = equalityMatch[2];
    if (op === '===') result = left === right;
    else if (op === '==') result = left == right;
    else if (op === '!==') result = left !== right;
    else if (op === '!=') result = left != right;
    else if (op === '>') result = Number(left) > Number(right);
    else if (op === '>=') result = Number(left) >= Number(right);
    else if (op === '<') result = Number(left) < Number(right);
    else if (op === '<=') result = Number(left) <= Number(right);
  } else {
    const value = resolveValue(expr, ctx);
    result = !!value;
  }

  return negated ? !result : result;
}

function resolveExpression(expr, ctx, allowHtml) {
  const cleaned = String(expr).trim();
  const bgMatch = cleaned.match(/^GlobalHelper::displayBackground\((.+)\)$/);
  if (bgMatch) {
    const firstArg = bgMatch[1].split(',')[0].trim();
    const url = resolveValue(firstArg, ctx);
    if (!url) return '';
    return `background-image: url(${url})`;
  }
  // str_replace — resolve the last argument and apply string replacements
  const strReplaceMatch = cleaned.match(/^str_replace\(\s*\[([^\]]*)\]\s*,\s*(['"][^'"]*['"])\s*,\s*(.+)\)$/);
  if (strReplaceMatch) {
    const needles = strReplaceMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    const replacement = strReplaceMatch[2].replace(/^['"]|['"]$/g, '');
    let val = resolveValue(strReplaceMatch[3].trim(), ctx);
    if (val == null) return '';
    val = String(val);
    needles.forEach(n => { val = val.replaceAll(n, replacement); });
    return allowHtml ? val : escapeHtml(val);
  }
  // nl2br — resolve inner expression (supports nesting like nl2br(e($var))) and convert newlines to <br>
  const nl2brMatch = cleaned.match(/^nl2br\((.+)\)$/);
  if (nl2brMatch) {
    const val = resolveExpression(nl2brMatch[1].trim(), ctx, true);
    if (!val) return '';
    const out = String(val).replace(/\n/g, '<br>');
    return allowHtml ? out : escapeHtml(out);
  }
  const ternaryMatch = cleaned.match(/(.+)\?(.+):(.+)/);
  if (ternaryMatch) {
    const cond = ternaryMatch[1].trim();
    const truthy = ternaryMatch[2].trim();
    const falsy = ternaryMatch[3].trim();
    const chosen = evaluateCondition(cond, ctx) ? truthy : falsy;
    return resolveExpression(chosen, ctx, allowHtml);
  }
  // PHP string concatenation with '.'
  if (/\s\.\s/.test(cleaned)) {
    const parts = cleaned.split(/\s\.\s/).map(p => resolveExpression(p.trim(), ctx, true));
    const output = parts.join('');
    return allowHtml ? output : escapeHtml(output);
  }
  const funcMatch = cleaned.match(/^(e|esc_url)\((.+)\)$/);
  const value = funcMatch ? resolveValue(funcMatch[2], ctx) : resolveValue(cleaned, ctx);
  const output = value == null ? '' : String(value);
  return allowHtml ? output : escapeHtml(output);
}

function resolveValue(expr, ctx) {
  const value = String(expr).trim();
  if (/Cookie(?:Helper)?::isCookieAccepted\s*\(/.test(value)) return true;
  const pllMatch = value.match(/^bcn_pll\((.+)\)$/);
  if (pllMatch) return resolveValue(pllMatch[1], ctx);
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1);
  }
  if (/^\d+$/.test(value)) return Number(value);
  // null coalescing (??) — PHP $a ?? $b returns $a if not null/undefined, else $b
  if (value.includes('??')) {
    const parts = value.split(/\s*\?\?\s*/);
    if (parts.length > 1) {
      for (const part of parts) {
        const v = resolveValue(part, ctx);
        if (v !== undefined && v !== null) return v;
      }
      return undefined;
    }
  }
  // count($var) → array length
  const countMatch = value.match(/^count\(\s*(.+?)\s*\)$/);
  if (countMatch) {
    const arr = resolveValue(countMatch[1], ctx);
    return Array.isArray(arr) ? arr.length : 0;
  }
  // array_slice($var, start, length)
  const sliceMatch = value.match(/^array_slice\(\s*(.+?)\s*,\s*(\d+)\s*(?:,\s*(\d+))?\s*\)$/);
  if (sliceMatch) {
    const arr = resolveValue(sliceMatch[1], ctx);
    if (!Array.isArray(arr)) return [];
    const start = Number(sliceMatch[2]);
    return sliceMatch[3] ? arr.slice(start, start + Number(sliceMatch[3])) : arr.slice(start);
  }
  if (value.startsWith('$')) return resolveVar(value, ctx);
  return resolveVar(`$${value}`, ctx);
}

function resolveVar(varExpr, ctx) {
  const raw = varExpr.replace(/^\$/, '');
  const parts = [];
  let current = '';
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '[') {
      if (current) {
        parts.push(current);
        current = '';
      }
      const end = raw.indexOf(']', i);
      if (end === -1) break;
      let key = raw.slice(i + 1, end).trim();
      key = key.replace(/^['"]|['"]$/g, '');
      parts.push(key);
      i = end + 1;
      continue;
    }
    if (ch === '-' && raw[i + 1] === '>') {
      if (current) {
        parts.push(current);
        current = '';
      }
      i += 2;
      continue;
    }
    if (ch === '.') {
      if (current) {
        parts.push(current);
        current = '';
      }
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  if (current) parts.push(current);

  let value = ctx;
  let lastImageUrl = null;
  for (const part of parts) {
    if (value == null) return undefined;
    let key = part;
    if (key.startsWith('$')) {
      const resolvedKey = resolveValue(key, ctx);
      key = resolvedKey != null ? String(resolvedKey) : key;
    }
    if (key === 'image' && value[key] && typeof value[key] === 'object' && value[key].url) {
      lastImageUrl = value[key].url;
    }
    if (key === 'sizes') {
      const sizesObj = value[key];
      if (!sizesObj && value.url) return value.url;
      value = sizesObj;
      continue;
    }
    if (value[key] === undefined && lastImageUrl) return lastImageUrl;
    value = value[key];
  }
  return value;
}

function isEmpty(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

// Expose all functions on window
Object.assign(window, {
  pickFirstString,
  getLayoutToModuleNameMap,
  getModuleLayout,
  queueModuleTemplateLoad,
  ensureModuleStyles,
  ensureModuleAdminStyles,
  ensureBaseModuleStyles,
  updateAllPreviewsForLayout,
  buildTemplateContext,
  renderBladeTemplate,
  renderBlocTitle,
  renderClickableItem,
  findMatchingEndfor,
  renderForLoops,
  findMatchingEndforeach,
  renderForeach,
  renderIfBlocks,
  renderSwitchBlocks,
  findMatchingEndswitch,
  processSwitchBody,
  processIfBlock,
  readParenExpr,
  findMatchingEndif,
  splitIfBranches,
  evaluateCondition,
  resolveExpression,
  resolveValue,
  resolveVar,
  isEmpty,
});
