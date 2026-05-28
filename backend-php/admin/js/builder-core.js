// builder-core.js — Page builder: open, render, block CRUD, drag & drop, save
// Extracted from app.js (lines 2843-2871, 2988-2994, 3218-3786, 3796-4722,
// 5754-6193, 7717-7828, 8018-8163, 10864-10941)

let _builderDirty = false;

function markBuilderDirty() {
  if (!_builderDirty) {
    window._builderDirty = true;
    _builderDirty = true;
    window.addEventListener('beforeunload', _beforeUnloadGuard);
  }
}

function clearBuilderDirty() {
  _builderDirty = false;
  window._builderDirty = false;
  window.removeEventListener('beforeunload', _beforeUnloadGuard);
}

function _beforeUnloadGuard(e) {
  if (_builderDirty) { e.preventDefault(); }
}

function isInBuilder() {
  const lastView = localStorage.getItem('adminLastView') || '';
  return lastView.startsWith('builder:') || lastView.startsWith('rb-builder:') || lastView.startsWith('cpt-edit:') || lastView.startsWith('cpt-add:');
}

async function guardedLoadSection(section) {
  if (_builderDirty) {
    const ok = await confirmModal('Vous avez des modifications non enregistrées. Quitter sans sauvegarder ?', 'Modifications non enregistrées');
    if (!ok) return;
    clearBuilderDirty();
  }
  loadSection(section);
}

function blockId() {
  return 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

function parsePageContent(content) {
  if (!content || !content.trim()) return [];
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) && parsed.every(b => b && typeof b.type === 'string') ? parsed : [];
  } catch (e) {
    return [];
  }
}

async function openPageBuilder(pageId) {
  clearBuilderDirty();
  pageBuilderState.editingPageId = pageId;
  pageBuilderState.blocks = [];
  pageBuilderState.meta = { title: '', slug: '', status: 'draft', show_in_menu: true, menu_order: 0, parent_id: null };
  pageBuilderState.colorOverrides = { enabled: false, primary_color: '', secondary_color: '', tertiary_color: '', text_color: '', background_color: '', bg_form_field: '' };
  pageBuilderState.seoMeta = { enabled: true, meta_title: '', meta_description: '' };
  pageBuilderState.cptMode = null;
  pageBuilderState.pageMenus = [];       // menus with per-menu toggle/position state
  window.selectedBlockId = null;
  // Mémoriser la dernière vue comme "builder" pour restaurer après rafraîchissement
  localStorage.setItem('adminLastView', `builder:${pageId ?? 'new'}`);
  await loadModuleFieldSchema();
  ensureBaseModuleStyles();
  if (pageId) {
    showLoading();
    try {
      const [pages, pageMenus] = await Promise.all([
        apiFetch('/pages'),
        apiFetch(`/pages/${pageId}/menus`),
      ]);
      const page = pages.find(p => p.id === pageId);
      if (page) {
        pageBuilderState.blocks = parsePageContent(page.content);
        pageBuilderState.meta = { title: page.title, slug: page.slug, status: page.status, show_in_menu: page.show_in_menu !== false, menu_order: page.menu_order || 0, parent_id: page.parent_id || null };
        // Load color overrides
        try {
          const co = page.color_overrides ? JSON.parse(page.color_overrides) : null;
          if (co) pageBuilderState.colorOverrides = { enabled: !!co.enabled, primary_color: co.primary_color || '', secondary_color: co.secondary_color || '', tertiary_color: co.tertiary_color || '', text_color: co.text_color || '', background_color: co.background_color || '', bg_form_field: co.bg_form_field || '' };
        } catch (e) {}
        // Load SEO meta
        try {
          const seo = page.seo_meta ? JSON.parse(page.seo_meta) : null;
          if (seo) pageBuilderState.seoMeta = { enabled: true, meta_title: seo.meta_title || '', meta_description: seo.meta_description || '', schema_org: seo.schema_org || '' };
        } catch (e) {}
      }
      pageBuilderState.pageMenus = pageMenus?.menus || [];
    } catch (e) {}
    hideLoading();
  } else {
    // New page — load menus with empty state
    try {
      const pageMenus = await apiFetch('/menus');
      pageBuilderState.pageMenus = (pageMenus || []).map(m => ({
        id: m.id, name: m.name, location: m.location,
        enabled: false, parent_id: null, menu_order: 0, items: [],
      }));
    } catch (e) {}
  }
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  const pagesNav = document.querySelector('.nav-item[data-section="pages"]');
  if (pagesNav) pagesNav.classList.add('active');
  document.getElementById('content').innerHTML = await renderPageBuilder();
  attachPageBuilderListeners();
  // Apply border-rounded class to canvas based on current settings
  if (siteSettingsCache) {
    const canvas = document.getElementById('builderCanvas');
    if (canvas) canvas.classList.toggle('border-rounded', siteSettingsCache.rounded === '1');
  }
  applyBlocksOnlyMode();
}

// Legacy buildMenuPositions/updatePagePositionOptions removed — now per-menu via renderPageMenuToggles

async function renderPageBuilder() {
  const m = pageBuilderState.meta;
  const isCPT = !!pageBuilderState.cptMode;
  const cptDef = pageBuilderState.cptMode;
  const pages = await apiFetch('/pages').catch(() => []);
  pageBuilderState._allPages = pages || [];

  // Mode "blocks-only" (ex: depuis product-editor) → bouton Retour pointé vers
  // l'editor custom au lieu de la liste CPT.
  const backSection = pageBuilderState.blocksOnlyMode && pageBuilderState.blocksOnlyBackSection
    ? pageBuilderState.blocksOnlyBackSection
    : (isCPT ? `cpt:${cptDef.slug}` : 'pages');
  const saveFunc = isCPT ? 'saveCPTBuilder()' : 'savePageBuilder()';
  const viewUrl = isCPT
    ? `${siteSettingsCache?.frontend_url || window.location.origin}/${cptDef.slug}/${encodeURIComponent(m.slug)}`
    : `${siteSettingsCache?.frontend_url || window.location.origin}/${m.slug.split('/').map(encodeURIComponent).join('/')}`;
  const titlePlaceholder = isCPT ? `Titre de l'${cptDef.label.toLowerCase()}` : 'Titre de la page';

  // CPT sidebar: featured image, excerpt, categories, custom fields
  let cptSidebarHtml = '';
  let customFieldsSidebarHtml = '';
  if (isCPT) {
    const fi = pageBuilderState.cptFeaturedImage;
    const fiPreview = fi
      ? `<img src="${escapeHtml(getOptimizedUrl(fi.sizes?.thumbnail || fi.url || '', 200, 60))}" alt="" style="max-width:100%;max-height:150px;object-fit:cover;border-radius:8px;">`
      : '<div style="width:100%;height:100px;background:#f5f5f5;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;font-size:13px;">Aucune image</div>';

    const hasExcerpt = cptDef.supports?.includes('excerpt');
    const catsHtml = cptDef.hasCategories && pageBuilderState.cptCategories.length > 0
      ? `<div style="margin-top:16px;">
          <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">${escapeHtml(cptDef.categoryLabel || 'Catégories')}</label>
          <div class="cpt-builder-categories" style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:8px;">
            ${pageBuilderState.cptCategories.map(cat => `
              <label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;font-size:13px;">
                <input type="checkbox" name="cat_${cat.id}" value="${cat.id}" ${pageBuilderState.cptItemCategories.find(c => c.id === cat.id) ? 'checked' : ''}>
                ${escapeHtml(cat.name)}
              </label>
            `).join('')}
          </div>
        </div>`
      : '';

    // Build custom fields HTML for sidebar
    if (cptDef.fields && cptDef.fields.length > 0) {
      const cf = pageBuilderState.cptCustomFields;
      const allPages = pageBuilderState._allPages || [];
      customFieldsSidebarHtml = cptDef.fields.map(field => {
        const val = cf[field.name] || '';
        const ftype = (field.type || 'Text').toLowerCase();

        if (field.name === 'photos' || ftype === 'photos') {
          let photos = [];
          try { photos = JSON.parse(val || '[]'); } catch { photos = []; }
          if (!Array.isArray(photos)) photos = [];
          const photosPreview = photos.length > 0
            ? photos.map((url, i) => `<div class="cpt-photo-item" data-index="${i}" style="position:relative;display:inline-block;margin:4px;">
                <img src="${escapeHtml(getOptimizedUrl(url, 80, 60))}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;">
                <button type="button" onclick="removeCPTBuilderPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#e74c3c;color:#fff;border:0;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:18px;text-align:center;">×</button>
              </div>`).join('')
            : '';
          return `<div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">${escapeHtml(field.label)}</label>
            <div id="cptBuilderPhotosPreview" style="margin-bottom:8px;">${photosPreview}</div>
            <input type="hidden" id="cptBuilderPhotosInput" value="${escapeHtml(JSON.stringify(photos))}">
            <button type="button" class="btn btn-outline btn-xs" onclick="openCPTBuilderPhotoPicker()">Ajouter des photos</button>
          </div>`;
        }

        if (ftype === 'link') {
          let lObj = { url: '', title: '', target: '_self' };
          try { if (val) lObj = typeof val === 'string' ? JSON.parse(val) : val; } catch {}
          const fnEsc = escapeHtml(field.name);
          return `<div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">${escapeHtml(field.label)}</label>
            <div class="link-field" data-field="cptBf_${fnEsc}" style="font-size:12px;">
              <div style="display:flex;gap:6px;align-items:center;">
                <input type="text" class="form-input link-field-url" id="cptBf_${fnEsc}_url" value="${escapeHtml(lObj.url || '')}" placeholder="URL" style="font-size:12px;flex:1">
                <button type="button" class="btn-link-picker" onclick="openLinkPickerForField(this)" style="font-size:11px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Parcourir</button>
              </div>
              <input type="text" class="form-input link-field-title" id="cptBf_${fnEsc}_title" value="${escapeHtml(lObj.title || '')}" placeholder="Titre du lien" style="font-size:12px;">
              <select class="form-input" id="cptBf_${fnEsc}_target" style="font-size:12px;">
                <option value="_self" ${lObj.target !== '_blank' ? 'selected' : ''}>Même fenêtre</option>
                <option value="_blank" ${lObj.target === '_blank' ? 'selected' : ''}>Nouvel onglet</option>
              </select>
            </div>
          </div>`;
        }

        if (ftype === 'textarea') {
          return `<div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">${escapeHtml(field.label)}</label>
            <textarea class="form-input cpt-builder-cf" data-cf="${escapeHtml(field.name)}" rows="3" style="font-size:12px;resize:vertical;">${escapeHtml(val)}</textarea>
          </div>`;
        }

        if (ftype === 'truefalse') {
          const isOn = val === true || val === 1 || val === '1' || val === 'true';
          return `<div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">${escapeHtml(field.label)}</label>
            <div style="padding:4px 0;">
              <label class="cpt-toggle" style="display:inline-flex;align-items:center;gap:10px;cursor:pointer;user-select:none;">
                <input type="checkbox" class="cpt-builder-cf-toggle" data-cf="${escapeHtml(field.name)}" ${isOn ? 'checked' : ''} style="display:none;">
                <span class="cpt-toggle-track" style="position:relative;width:44px;height:24px;border-radius:12px;background:${isOn ? 'var(--primary,#224f5a)' : '#ccc'};transition:background .2s;">
                  <span class="cpt-toggle-thumb" style="position:absolute;top:2px;left:${isOn ? '22px' : '2px'};width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .2s;"></span>
                </span>
                <span class="cpt-toggle-label" style="font-size:13px;color:#666;">${isOn ? 'Oui' : 'Non'}</span>
              </label>
            </div>
          </div>`;
        }

        // Address (Mapbox geocoding + mini-map)
        if (ftype === 'address') {
          let addr = { address: '', city: '', post_code: '', street_name: '', street_number: '', lat: '', lng: '' };
          try { if (val) addr = typeof val === 'string' ? JSON.parse(val) : val; } catch {}
          const fnEsc = escapeHtml(field.name);
          const uid = `cptBAddress_${fnEsc}_${Date.now()}`;
          return `<div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">${escapeHtml(field.label)}</label>
            <div id="${uid}" class="cpt-address-field" data-field="${fnEsc}" style="position:relative;">
              <div style="position:relative;margin-bottom:8px;">
                <input type="text" class="form-input googlemap-search" value="${escapeHtml(addr.address || '')}" placeholder="Rechercher une adresse..." autocomplete="off" style="font-size:12px;">
                <div class="googlemap-suggestions" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:100;background:#fff;border:1px solid var(--border);border-top:0;border-radius:0 0 6px 6px;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,.1);"></div>
              </div>
              <div class="googlemap-preview" style="height:${(addr.lat && addr.lng) ? '150px' : '0'};border-radius:8px;overflow:hidden;margin-bottom:8px;"></div>
              <input type="hidden" name="cf_${fnEsc}__street_number" value="${escapeHtml(addr.street_number || '')}">
              <input type="hidden" name="cf_${fnEsc}__street_name" value="${escapeHtml(addr.street_name || '')}">
              <input type="hidden" name="cf_${fnEsc}__post_code" value="${escapeHtml(addr.post_code || '')}">
              <input type="hidden" name="cf_${fnEsc}__city" value="${escapeHtml(addr.city || '')}">
              <input type="hidden" name="cf_${fnEsc}__address" value="${escapeHtml(addr.address || '')}">
              <input type="hidden" name="cf_${fnEsc}__lat" value="${escapeHtml(addr.lat || '')}">
              <input type="hidden" name="cf_${fnEsc}__lng" value="${escapeHtml(addr.lng || '')}">
              <input type="hidden" name="cf_${fnEsc}__place_id" value="">
              <input type="hidden" name="cf_${fnEsc}__name" value="">
              <input type="hidden" name="cf_${fnEsc}__street_name_short" value="">
            </div>
          </div>`;
        }

        // Image / File / Video (media picker)
        if (ftype === 'image' || ftype === 'file' || ftype === 'video') {
          let img = null;
          try { if (val) img = typeof val === 'string' ? JSON.parse(val) : val; } catch { img = null; }
          const url = (img && typeof img === 'object') ? (img.url || '') : (typeof val === 'string' && val.startsWith('/') ? val : '');
          const fnEsc = escapeHtml(field.name);
          const hiddenVal = val ? (typeof val === 'string' ? val : JSON.stringify(val)) : '';
          return `<div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">${escapeHtml(field.label)}</label>
            <div class="cpt-cf-image-field" data-cf="${fnEsc}" data-cf-type="${ftype}">
              <div id="cptCfImagePreview_${fnEsc}" style="margin-bottom:8px;">
                ${url ? `<img src="${escapeHtml(getOptimizedUrl(url, 200, 70))}" style="max-width:100%;max-height:120px;object-fit:cover;border-radius:6px;display:block;">` : ''}
              </div>
              <input type="hidden" class="cpt-builder-cf" data-cf="${fnEsc}" id="cptCfImageInput_${fnEsc}" value="${escapeHtml(hiddenVal)}">
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button type="button" class="btn btn-outline btn-xs" onclick="openCPTCfImagePicker('${fnEsc}', '${ftype}')">Choisir</button>
                ${url ? `<button type="button" class="btn btn-outline btn-xs" onclick="clearCPTCfImage('${fnEsc}')">Retirer</button>` : ''}
              </div>
            </div>
          </div>`;
        }

        // Default: text input
        return `<div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">${escapeHtml(field.label)}</label>
          <input type="text" class="form-input cpt-builder-cf" data-cf="${escapeHtml(field.name)}" value="${escapeHtml(val)}" style="font-size:12px;">
        </div>`;
      }).join('');
    }

    cptSidebarHtml = `
      <div style="padding:12px;border-bottom:1px solid var(--border);">
        <h4 style="margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--gray-400);">Image à la une</h4>
        <div id="cptBuilderFeaturedPreview" style="margin-bottom:8px;">${fiPreview}</div>
        <input type="hidden" id="cptBuilderFeaturedInput" value="${fi ? escapeHtml(JSON.stringify(fi)) : ''}">
        <div style="display:flex;gap:6px;">
          <button type="button" class="btn btn-outline btn-xs" onclick="openCPTBuilderFeaturedPicker()">Choisir</button>
          ${fi ? '<button type="button" class="btn btn-xs btn-danger-outline" onclick="clearCPTBuilderFeatured()">Supprimer</button>' : ''}
        </div>
        ${hasExcerpt ? `
          <div style="margin-top:16px;">
            <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">Extrait</label>
            <textarea class="form-input" id="cptBuilderExcerpt" rows="3" placeholder="Résumé court…" style="font-size:13px;resize:vertical;">${escapeHtml(pageBuilderState.cptExcerpt)}</textarea>
          </div>
        ` : ''}
        ${catsHtml}
      </div>
      `;
  }

  return `
    <div class="page-builder">
      <header class="builder-header">
        <button type="button" class="btn btn-danger" onclick="guardedLoadSection('${backSection}')">← Retour</button>
        <div class="builder-meta">
          <div class="builder-field-group">
            <label class="builder-field-label">Titre</label>
            <input type="text" class="form-input builder-title" placeholder="${titlePlaceholder}" value="${escapeHtml(m.title)}" data-field="title">
          </div>
          <div class="builder-field-group">
            <label class="builder-field-label">Slug URL</label>
            <input type="text" class="form-input builder-slug" placeholder="mon-url" value="${escapeHtml(m.slug)}" data-field="slug">
          </div>
          <div class="builder-field-group">
            <label class="builder-field-label">Statut</label>
            <select class="form-select builder-status" data-field="status" onchange="onBuilderStatusChange(this.value)">
              <option value="draft" ${m.status === 'draft' ? 'selected' : ''}>Brouillon</option>
              <option value="published" ${m.status === 'published' ? 'selected' : ''}>Publié</option>
              <option value="private" ${m.status === 'private' ? 'selected' : ''}>Privé</option>
            </select>
          </div>
          <div class="builder-field-group builder-publish-date-group" style="display:${m.status === 'draft' ? 'none' : ''}">
            <label class="builder-field-label">Date de publication</label>
            <div style="display:flex;gap:6px;align-items:center">
              <select class="form-select builder-publish-mode" style="width:auto;min-width:120px" onchange="onPublishModeChange(this.value)">
                <option value="now" ${!m.published_date || m.published_date === 'now' ? 'selected' : ''}>Maintenant</option>
                <option value="schedule" ${m.published_date && new Date(m.published_date) > new Date() ? 'selected' : ''}>Planifier</option>
                <option value="backdate" ${m.published_date && new Date(m.published_date) <= new Date() && m.published_date !== 'now' ? 'selected' : ''}>Antérieur</option>
              </select>
              <input type="datetime-local" class="form-input builder-publish-date" data-field="published_date" value="${m.published_date && m.published_date !== 'now' ? m.published_date.slice(0,16) : ''}" style="display:${m.published_date && m.published_date !== 'now' && new Date(m.published_date).getTime() !== new Date(m.created_at).getTime() ? '' : 'none'};width:auto">
            </div>
          </div>
        </div>
        <div class="builder-actions">
          ${(() => { const a = aiButtonAttrs(); return `<button type="button" class="btn btn-ai" onclick="openAiModal()" title="${a.title}"${a.disabled ? ' disabled' : ''}>✨ IA</button>`; })()}
          <button type="button" class="btn btn-primary" onclick="${saveFunc}">Enregistrer</button>
          <a href="${viewUrl}" target="_blank" class="btn btn-outline" id="viewPageBtn">Voir ${isCPT ? (cptDef.isFemale ? 'la ' : "l'") + cptDef.label.toLowerCase() : 'la page'}</a>
        </div>
      </header>
      <div class="builder-body">
        <aside class="builder-sidebar">
          ${cptSidebarHtml}
          <!-- Menu settings panel (collapsible) -->
          <div class="builder-menu-settings-panel" id="builderMenuSettingsPanel" style="display:none">
            <div class="builder-menu-settings-header">
              <h3>Paramètres menu</h3>
              <button type="button" class="btn btn-xs" onclick="toggleMenuSettingsPanel(false)">&times;</button>
            </div>
            <div class="builder-menu-settings-body">
              ${renderPageMenuToggles()}
              ${pageBuilderState.pageMenus.length === 0 ? '<p class="text-muted" style="font-size:0.85rem">Aucun menu créé. <a href="#" onclick="loadSection(\'menus\');return false">Créer un menu</a></p>' : ''}
            </div>
          </div>
          <div class="builder-modules-panel" id="builderModulesPanel" style="${selectedBlockId ? 'display:none' : ''}">
            ${isCPT ? '' : `<button type="button" class="btn btn-sm btn-outline builder-menu-settings-btn" onclick="toggleMenuSettingsPanel(true)" style="margin-bottom:12px;${m.status === 'draft' ? 'display:none' : ''}">Menu</button>
            <div class="cpt-builder-tabs" style="display:flex;border-bottom:2px solid var(--border,#e5e7eb);margin-bottom:0;">
              <button type="button" class="cpt-builder-tab active" data-tab="page-modules" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;text-align:center;border-bottom:2px solid var(--primary,#224f5a);margin-bottom:-2px;color:var(--primary,#224f5a);">Modules</button>
              <button type="button" class="cpt-builder-tab" data-tab="page-seo" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;text-align:center;border-bottom:2px solid transparent;margin-bottom:-2px;color:#999;">SEO</button>
              <button type="button" class="cpt-builder-tab" data-tab="page-colors" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;text-align:center;border-bottom:2px solid transparent;margin-bottom:-2px;color:#999;">Couleurs</button>
            </div>
            <div class="cpt-builder-tab-content" data-tab="page-modules" style="padding-top:16px;">`}
            ${isCPT && !customFieldsSidebarHtml && cptDef?.hasModules !== false ? `
            <div class="cpt-builder-tabs" style="display:flex;border-bottom:2px solid var(--border,#e5e7eb);margin-bottom:0;">
              <button type="button" class="cpt-builder-tab active" data-tab="cpt-header" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;border-bottom:2px solid var(--primary,#224f5a);margin-bottom:-2px;color:var(--primary,#224f5a);">Header</button>
              <button type="button" class="cpt-builder-tab" data-tab="cpt-seo" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;border-bottom:2px solid transparent;margin-bottom:-2px;color:#999;">SEO Meta</button>
              <button type="button" class="cpt-builder-tab" data-tab="cpt-modules" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;border-bottom:2px solid transparent;margin-bottom:-2px;color:#999;">Modules</button>
            </div>
            <div class="cpt-builder-tab-content" data-tab="cpt-header" style="padding-top:16px;">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                <label class="toggle-switch"><input type="checkbox" name="h1_in_header" ${pageBuilderState.cptHeaderSettings.h1_in_header !== 'no' ? 'checked' : ''}><span class="toggle-slider"></span></label>
                <span class="toggle-label">Mettre le titre H1 dans le header</span>
              </div>
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;">
                <label class="toggle-switch"><input type="checkbox" name="title_in_header" ${pageBuilderState.cptHeaderSettings.title_in_header !== 'hideTitle' ? 'checked' : ''}><span class="toggle-slider"></span></label>
                <span class="toggle-label">Afficher le titre dans le header</span>
              </div>
            </div>
            <div class="cpt-builder-tab-content" data-tab="cpt-seo" style="display:none;padding-top:16px;">
              <div class="builder-seo-body">
                <div class="seo-toggle">
                  <label>
                    <span class="toggle-switch">
                      <input type="checkbox" id="seoEnabled" ${pageBuilderState.seoMeta.enabled ? 'checked' : ''} onchange="onSeoToggle(this.checked)" />
                      <span class="toggle-slider"></span>
                    </span>
                    <span>Activer les meta SEO</span>
                  </label>
                </div>
                <div id="seoFields" style="${pageBuilderState.seoMeta.enabled ? '' : 'display:none'}">
                  <button type="button" class="btn btn-primary seo-analyze-btn" onclick="analyzeSeoPage()">Analyser la page</button>
                  <div class="seo-image-audit" style="display:none"></div>
                  <div class="seo-field">
                    <label class="form-label">Balise Title <span class="seo-counter" id="seoTitleCount">(${pageBuilderState.seoMeta.meta_title.length}/60)</span></label>
                    <input type="text" class="form-input" id="seo_meta_title" value="${(pageBuilderState.seoMeta.meta_title || '').replace(/"/g, '&quot;')}" oninput="onSeoFieldChange()" maxlength="60" placeholder="Titre SEO de la page (max 60 car.)" />
                    <div class="seo-progress-bar"><div id="seoTitleBar" style="width:${Math.min(100, (pageBuilderState.seoMeta.meta_title.length / 60) * 100)}%;background:${pageBuilderState.seoMeta.meta_title.length <= 60 ? '#22c55e' : '#ef4444'}"></div></div>
                  </div>
                  <div class="seo-field">
                    <label class="form-label">Meta Description <span class="seo-counter" id="seoDescCount">(${pageBuilderState.seoMeta.meta_description.length}/160)</span></label>
                    <textarea class="form-input" id="seo_meta_description" oninput="onSeoFieldChange()" maxlength="160" rows="3" placeholder="Description SEO de la page (max 160 car.)" style="resize:vertical">${(pageBuilderState.seoMeta.meta_description || '').replace(/</g, '&lt;')}</textarea>
                    <div class="seo-progress-bar"><div id="seoDescBar" style="width:${Math.min(100, (pageBuilderState.seoMeta.meta_description.length / 160) * 100)}%;background:${pageBuilderState.seoMeta.meta_description.length <= 160 ? '#22c55e' : '#ef4444'}"></div></div>
                  </div>
                  <div id="seoSchemaPanel" class="seo-schema-panel">
                    <button type="button" class="btn btn-sm btn-outline seo-generate-btn" onclick="generateSchemaOrg()">Generer le schema.org</button>
                    <textarea class="form-input" id="seo_schema_org" oninput="onSchemaOrgChange()" rows="14" placeholder='{"@context":"https://schema.org",...}'>${(pageBuilderState.seoMeta.schema_org || '').replace(/</g, '&lt;')}</textarea>
                  </div>
                  <div id="seoPreview" class="seo-google-preview">
                    <div class="seo-preview-title">${pageBuilderState.seoMeta.meta_title || pageBuilderState.meta.title || 'Titre de la page'}</div>
                    <div class="seo-preview-url">example.com/${cptDef.slug}/${pageBuilderState.meta.slug || 'slug'}</div>
                    <div class="seo-preview-desc">${pageBuilderState.seoMeta.meta_description || 'Description de la page...'}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="cpt-builder-tab-content" data-tab="cpt-modules" style="display:none;padding-top:16px;">
            ` : isCPT && customFieldsSidebarHtml && cptDef?.hasModules !== false ? `
            <div class="cpt-builder-tabs" style="display:flex;border-bottom:2px solid var(--border,#e5e7eb);margin-bottom:0;">
              <button type="button" class="cpt-builder-tab active" data-tab="cpt-header" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;border-bottom:2px solid var(--primary,#224f5a);margin-bottom:-2px;color:var(--primary,#224f5a);">Header</button>
              <button type="button" class="cpt-builder-tab" data-tab="cpt-seo" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;border-bottom:2px solid transparent;margin-bottom:-2px;color:#999;">SEO Meta</button>
              <button type="button" class="cpt-builder-tab" data-tab="cpt-contenu" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;border-bottom:2px solid transparent;margin-bottom:-2px;color:#999;">Contenu</button>
              <button type="button" class="cpt-builder-tab" data-tab="cpt-modules" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;border-bottom:2px solid transparent;margin-bottom:-2px;color:#999;">Modules</button>
            </div>
            <div class="cpt-builder-tab-content" data-tab="cpt-header" style="padding-top:16px;">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                <label class="toggle-switch"><input type="checkbox" name="h1_in_header" ${pageBuilderState.cptHeaderSettings.h1_in_header !== 'no' ? 'checked' : ''}><span class="toggle-slider"></span></label>
                <span class="toggle-label">Mettre le titre H1 dans le header</span>
              </div>
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;">
                <label class="toggle-switch"><input type="checkbox" name="title_in_header" ${pageBuilderState.cptHeaderSettings.title_in_header !== 'hideTitle' ? 'checked' : ''}><span class="toggle-slider"></span></label>
                <span class="toggle-label">Afficher le titre dans le header</span>
              </div>
            </div>
            <div class="cpt-builder-tab-content" data-tab="cpt-seo" style="display:none;padding-top:16px;">
              <div class="builder-seo-body">
                <div class="seo-toggle">
                  <label>
                    <span class="toggle-switch">
                      <input type="checkbox" id="seoEnabled" ${pageBuilderState.seoMeta.enabled ? 'checked' : ''} onchange="onSeoToggle(this.checked)" />
                      <span class="toggle-slider"></span>
                    </span>
                    <span>Activer les meta SEO</span>
                  </label>
                </div>
                <div id="seoFields" style="${pageBuilderState.seoMeta.enabled ? '' : 'display:none'}">
                  <button type="button" class="btn btn-primary seo-analyze-btn" onclick="analyzeSeoPage()">Analyser la page</button>
                  <div class="seo-image-audit" style="display:none"></div>
                  <div class="seo-field">
                    <label class="form-label">Meta Title <span class="seo-counter" id="seoTitleCount">(${pageBuilderState.seoMeta.meta_title.length}/60)</span></label>
                    <input type="text" class="form-input" id="seo_meta_title" value="${(pageBuilderState.seoMeta.meta_title || '').replace(/"/g, '&quot;')}" oninput="onSeoFieldChange()" maxlength="60" placeholder="Titre SEO de la page (max 60 car.)" />
                    <div class="seo-progress-bar"><div id="seoTitleBar" style="width:${Math.min(100, (pageBuilderState.seoMeta.meta_title.length / 60) * 100)}%;background:${pageBuilderState.seoMeta.meta_title.length <= 60 ? '#22c55e' : '#ef4444'}"></div></div>
                  </div>
                  <div class="seo-field">
                    <label class="form-label">Meta Description <span class="seo-counter" id="seoDescCount">(${pageBuilderState.seoMeta.meta_description.length}/160)</span></label>
                    <textarea class="form-input" id="seo_meta_description" oninput="onSeoFieldChange()" maxlength="160" rows="3" placeholder="Description SEO de la page (max 160 car.)" style="resize:vertical">${(pageBuilderState.seoMeta.meta_description || '').replace(/</g, '&lt;')}</textarea>
                    <div class="seo-progress-bar"><div id="seoDescBar" style="width:${Math.min(100, (pageBuilderState.seoMeta.meta_description.length / 160) * 100)}%;background:${pageBuilderState.seoMeta.meta_description.length <= 160 ? '#22c55e' : '#ef4444'}"></div></div>
                  </div>
                  <div id="seoSchemaPanel" class="seo-schema-panel">
                    <button type="button" class="btn btn-sm btn-outline seo-generate-btn" onclick="generateSchemaOrg()">Generer le schema.org</button>
                    <textarea class="form-input" id="seo_schema_org" oninput="onSchemaOrgChange()" rows="14" placeholder='{"@context":"https://schema.org",...}'>${(pageBuilderState.seoMeta.schema_org || '').replace(/</g, '&lt;')}</textarea>
                  </div>
                  <div id="seoPreview" class="seo-google-preview">
                    <div class="seo-preview-title">${pageBuilderState.seoMeta.meta_title || pageBuilderState.meta.title || 'Titre de la page'}</div>
                    <div class="seo-preview-url">example.com/${cptDef.slug}/${pageBuilderState.meta.slug || 'slug'}</div>
                    <div class="seo-preview-desc">${pageBuilderState.seoMeta.meta_description || 'Description de la page...'}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="cpt-builder-tab-content" data-tab="cpt-contenu" style="display:none;padding-top:16px;">
              ${customFieldsSidebarHtml}
            </div>
            <div class="cpt-builder-tab-content" data-tab="cpt-modules" style="display:none;padding-top:16px;">
            ` : `
            `}
            ${cptDef?.hasModules !== false ? `
            <p class="form-help">Glissez un module dans la zone de droite.</p>
            <input type="text" class="form-input builder-module-search" placeholder="Rechercher un module…" oninput="filterBuilderModules(this.value)" style="margin-bottom:12px;font-size:13px;">
            <div class="builder-modules-list">
              ${MODULE_CATEGORIES.map(category => `
                <div class="builder-module-category">
                  <div class="builder-module-category-title">
                    <span class="icon">${category.icon || '▦'}</span>
                    <span>${category.label}</span>
                  </div>
                  <div class="builder-module-category-items">
                    ${category.modules.map(name => {
                      const type = toKebabCase(name);
                      const def = BLOCK_TYPES[type] || { label: MODULE_LABELS[name] || humanizeModuleName(name), icon: category.icon || '▦' };
                      return `
                        <div class="builder-module-item" draggable="true" data-block-type="${type}" onclick="addBlockByClick('${type}')" title="Glisser ici ou cliquer pour ajouter">
                          <span>${def.label}</span>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
            ` : ''}
            ${(customFieldsSidebarHtml && cptDef?.hasModules !== false) || (isCPT && !customFieldsSidebarHtml && cptDef?.hasModules !== false) ? `</div>` : ''}
            ${!isCPT ? `</div>
            <div class="cpt-builder-tab-content" data-tab="page-seo" style="display:none;padding-top:16px;">
              <div class="builder-seo-body">
                <button type="button" class="btn btn-primary seo-analyze-btn" onclick="analyzeSeoPage()">Analyser la page</button>
                <div class="seo-image-audit" style="display:none"></div>
                <div class="seo-field">
                  <label class="form-label">Balise Title <span class="seo-counter" id="seoTitleCount">(${pageBuilderState.seoMeta.meta_title.length}/60)</span></label>
                  <input type="text" class="form-input" id="seo_meta_title" value="${(pageBuilderState.seoMeta.meta_title || '').replace(/"/g, '&quot;')}" oninput="onSeoFieldChange()" maxlength="60" placeholder="Titre SEO de la page (max 60 car.)" />
                  <div class="seo-progress-bar"><div id="seoTitleBar" style="width:${Math.min(100, (pageBuilderState.seoMeta.meta_title.length / 60) * 100)}%;background:${pageBuilderState.seoMeta.meta_title.length <= 60 ? '#22c55e' : '#ef4444'}"></div></div>
                </div>
                <div class="seo-field">
                  <label class="form-label">Meta Description <span class="seo-counter" id="seoDescCount">(${pageBuilderState.seoMeta.meta_description.length}/160)</span></label>
                  <textarea class="form-input" id="seo_meta_description" oninput="onSeoFieldChange()" maxlength="160" rows="3" placeholder="Description SEO de la page (max 160 car.)" style="resize:vertical">${(pageBuilderState.seoMeta.meta_description || '').replace(/</g, '&lt;')}</textarea>
                  <div class="seo-progress-bar"><div id="seoDescBar" style="width:${Math.min(100, (pageBuilderState.seoMeta.meta_description.length / 160) * 100)}%;background:${pageBuilderState.seoMeta.meta_description.length <= 160 ? '#22c55e' : '#ef4444'}"></div></div>
                </div>
                <div id="seoSchemaPanel" class="seo-schema-panel">
                  <button type="button" class="btn btn-sm btn-outline seo-generate-btn" onclick="generateSchemaOrg()">Generer le schema.org</button>
                  <textarea class="form-input" id="seo_schema_org" oninput="onSchemaOrgChange()" rows="14" placeholder='{"@context":"https://schema.org",...}'>${(pageBuilderState.seoMeta.schema_org || '').replace(/</g, '&lt;')}</textarea>
                </div>
                <div id="seoPreview" class="seo-google-preview">
                  <div class="seo-preview-title">${pageBuilderState.seoMeta.meta_title || pageBuilderState.meta.title || 'Titre de la page'}</div>
                  <div class="seo-preview-url">example.com/${pageBuilderState.meta.slug || 'slug'}</div>
                  <div class="seo-preview-desc">${pageBuilderState.seoMeta.meta_description || 'Description de la page...'}</div>
                </div>
              </div>
            </div>
            <div class="cpt-builder-tab-content" data-tab="page-colors" style="display:none;padding-top:16px;">
              <div class="builder-color-overrides-body">
                <div class="form-group" style="margin-bottom:12px">
                  <label class="toggle-switch-label" style="display:flex;align-items:center;cursor:pointer">
                    <span class="toggle-switch">
                      <input type="checkbox" id="colorOverrideEnabled" ${pageBuilderState.colorOverrides.enabled ? 'checked' : ''} onchange="onColorOverrideToggle(this.checked)" />
                      <span class="toggle-slider"></span>
                    </span>
                    <span style="margin-left:8px;font-weight:600;font-size:14px">Activer la surcharge</span>
                  </label>
                </div>
                <div id="colorOverrideFields" style="${pageBuilderState.colorOverrides.enabled ? '' : 'display:none'}">
                  <div class="color-override-grid">
                    <div class="form-group">
                      <label class="form-label">Couleur Primaire</label>
                      <div class="color-picker-wrapper">
                        <input type="color" class="form-color" id="co_primary_color" value="${pageBuilderState.colorOverrides.primary_color || '#006a9b'}" onchange="onColorOverrideChange()" />
                        <input type="text" class="form-input form-input-sm" value="${pageBuilderState.colorOverrides.primary_color || ''}" oninput="syncColorFromText(this, 'co_primary_color')" placeholder="Défaut thème" />
                      </div>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Couleur Secondaire</label>
                      <div class="color-picker-wrapper">
                        <input type="color" class="form-color" id="co_secondary_color" value="${pageBuilderState.colorOverrides.secondary_color || '#ea644e'}" onchange="onColorOverrideChange()" />
                        <input type="text" class="form-input form-input-sm" value="${pageBuilderState.colorOverrides.secondary_color || ''}" oninput="syncColorFromText(this, 'co_secondary_color')" placeholder="Défaut thème" />
                      </div>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Couleur Tertiaire</label>
                      <div class="color-picker-wrapper">
                        <input type="color" class="form-color" id="co_tertiary_color" value="${pageBuilderState.colorOverrides.tertiary_color || '#d0d0d0'}" onchange="onColorOverrideChange()" />
                        <input type="text" class="form-input form-input-sm" value="${pageBuilderState.colorOverrides.tertiary_color || ''}" oninput="syncColorFromText(this, 'co_tertiary_color')" placeholder="Défaut thème" />
                      </div>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Couleur des textes</label>
                      <div class="color-picker-wrapper">
                        <input type="color" class="form-color" id="co_text_color" value="${pageBuilderState.colorOverrides.text_color || '#001527'}" onchange="onColorOverrideChange()" />
                        <input type="text" class="form-input form-input-sm" value="${pageBuilderState.colorOverrides.text_color || ''}" oninput="syncColorFromText(this, 'co_text_color')" placeholder="Défaut thème" />
                      </div>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Couleur de fond</label>
                      <div class="color-picker-wrapper">
                        <input type="color" class="form-color" id="co_background_color" value="${pageBuilderState.colorOverrides.background_color || '#ffffff'}" onchange="onColorOverrideChange()" />
                        <input type="text" class="form-input form-input-sm" value="${pageBuilderState.colorOverrides.background_color || ''}" oninput="syncColorFromText(this, 'co_background_color')" placeholder="Défaut thème" />
                      </div>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Fond champs formulaire</label>
                      <div class="color-picker-wrapper">
                        <input type="color" class="form-color" id="co_bg_form_field" value="${pageBuilderState.colorOverrides.bg_form_field || '#e3f3fc'}" onchange="onColorOverrideChange()" />
                        <input type="text" class="form-input form-input-sm" value="${pageBuilderState.colorOverrides.bg_form_field || ''}" oninput="syncColorFromText(this, 'co_bg_form_field')" placeholder="Défaut thème" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>` : ''}
          </div>
          <div class="builder-settings" id="builderSettings" style="${selectedBlockId ? '' : 'display:none'}">
            ${renderBuilderSettingsPanel()}
          </div>
          <div class="builder-sidebar-resize" id="builderSidebarResize"></div>
        </aside>
        ${cptDef?.hasModules === false ? '' : `<main class="builder-canvas" id="builderCanvas" data-drop-zone="true">
          <div class="builder-canvas-toolbar" id="builderToolbar" style="${pageBuilderState.blocks.length ? '' : 'display:none'}">
            <button type="button" class="btn btn-sm btn-danger" onclick="removeAllBlocks()">Tout supprimer</button>
          </div>
          <div class="builder-canvas-inner" id="builderCanvasInner" style="${buildColorOverrideStyle()}">
            <div class="builder-canvas-placeholder" id="builderPlaceholder">Glissez des modules ici ou cliquez sur un module à gauche pour l'ajouter.</div>
            <div class="builder-blocks" id="builderBlocks">
              ${renderBlocksWithInsertButtons(pageBuilderState.blocks)}
            </div>
          </div>
        </main>`}
      </div>
    </div>
  `;
}

function renderBlockCard(block, visibleNum) {
  if (INACTIVE_PLUGIN_TYPES.has(block.type)) return '';
  const def = BLOCK_TYPES[block.type] || { label: block.type, icon: '▦' };
  const blockNum = typeof visibleNum === 'number'
    ? visibleNum
    : (() => {
        let n = 0;
        for (const b of pageBuilderState.blocks) {
          if (INACTIVE_PLUGIN_TYPES.has(b.type)) continue;
          n++;
          if (b === block) return n;
        }
        return '';
      })();
  const isHidden = block.data?.is_visible === 'no';
  const hiddenIcon = isHidden
    ? '<svg class="builder-block-hidden-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '';
  const richPreview = replaceEmptyImages(renderBlockPreviewHtml(block));
  return `
    <div class="builder-block-card builder-block-card--visual${selectedBlockId === block.id ? ' is-selected' : ''}${isHidden ? ' is-hidden-block' : ''}" data-block-id="${block.id}" draggable="true">
      <div class="builder-block-chrome">
        <span class="builder-block-number">${blockNum}</span>
        <span class="builder-block-handle">⋮⋮</span>
        <div class="builder-block-info">
          <strong>${escapeHtml(def.label)}</strong>
          ${hiddenIcon}
        </div>
        <div class="builder-block-actions">
          <button type="button" class="btn btn-sm btn-outline" onclick="editBlock('${block.id}')">Modifier</button>
          <button type="button" class="btn btn-sm btn-outline" onclick="duplicateBlock('${block.id}')">Dupliquer</button>
          <button type="button" class="btn btn-sm btn-danger" onclick="removeBlock('${block.id}')">Suppr.</button>
        </div>
      </div>
      ${richPreview ? `<div class="builder-block-render">${richPreview}</div>` : ''}
    </div>
  `;
}

function getBlockPreview(block) {
  const d = block.data || {};
  if (LEGACY_BLOCK_TYPES[block.type]) {
    if (block.type === 'heading') return (d.text || '').slice(0, 40);
    if (block.type === 'text') return (d.title || d.body || '').slice(0, 40);
    if (block.type === 'hero') return (d.title || '').slice(0, 40);
    if (block.type === 'cta') return (d.title || '').slice(0, 40);
    if (block.type === 'image') return d.src ? 'Image' : '';
    if (block.type === 'spacer') return 'Espace ' + (d.size || 'medium');
    if (block.type === 'html') return (d.content || '').slice(0, 30) + (d.content && d.content.length > 30 ? '…' : '');
  }
  const preferredKeys = ['title', 'text', 'name', 'label', 'content', 'summary', 'subtitle'];
  for (const key of preferredKeys) {
    if (typeof d[key] === 'string' && d[key].trim()) return d[key].trim().slice(0, 40);
  }
  const keys = Object.keys(d);
  if (keys.length === 0) return '';
  for (const key of keys) {
    const val = d[key];
    if (typeof val === 'string' && val.trim()) return `${key}: ${val.trim().slice(0, 32)}`;
  }
  return '';
}

function renderHeroPreviewHtml(data) {
  const isSlider = data.is_hero_banner_slider !== false
    && data.is_hero_banner_slider !== 0
    && data.is_hero_banner_slider !== '0';

  if (isSlider) {
    const sliders = Array.isArray(data.hero_sliders) ? data.hero_sliders : [];
    if (sliders.length === 0) {
      return '<div class="preview-hero-banner"><div class="preview-hero-desc"><span class="preview-hero-empty-label">Hero banner · slider (vide)</span></div></div>';
    }
    const slide = sliders[0];
    const imgUrl = slide.image?.url || '';
    const title = slide.title || '';
    const catchphrase = slide.catchphrase || '';
    return `<div class="preview-hero-banner">
      ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" class="preview-hero-bg" alt="">` : _noImagePlaceholderHtml}
      <div class="preview-hero-desc">
        ${title ? `<p class="preview-hero-title">${escapeHtml(title)}</p>` : ''}
        ${catchphrase ? `<p class="preview-hero-sub">${escapeHtml(catchphrase)}</p>` : ''}
        ${sliders.length > 1 ? `<p class="preview-hero-count">${sliders.length} slides</p>` : ''}
      </div>
    </div>`;
  }

  // Double-bloc mode
  const blocs = [data.left_bloc, data.right_bloc].filter(Boolean);
  if (blocs.length === 0) {
    return '<div class="preview-hero-banner"><div class="preview-hero-desc"><span class="preview-hero-empty-label">Hero banner · double bloc (vide)</span></div></div>';
  }
  const parts = blocs.map((bloc) => {
    const imgUrl = bloc.image?.url || '';
    return `<div class="preview-hero-bloc">
      ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" class="preview-hero-bloc-img" alt="">` : _noImagePlaceholderHtml}
      ${bloc.title ? `<p class="preview-hero-bloc-title">${escapeHtml(bloc.title)}</p>` : ''}
    </div>`;
  });
  return `<div class="preview-hero-list">${parts.join('')}</div>`;
}

/**
 * Fallback preview for sub-modules inside ColumnsTab when the Blade template
 * engine produces empty output. Extracts key visual data (images, text, titles)
 * and renders a simple but meaningful preview.
 */
function renderSubModuleFallback(layout, data) {
  const def = BLOCK_TYPES[layout] || {};
  const label = def.label || MODULE_LABELS[layout] || layout;
  const parts = [];

  // Try to find and display an image from common field names
  const imgFields = ['image', 'file', 'video', 'bg_img', 'preview'];
  for (const key of imgFields) {
    const val = data[key];
    if (val) {
      const url = typeof val === 'string' ? val : (val.url || val.sizes?.['medium-large'] || val.sizes?.large || '');
      if (url) { parts.push(`<img src="${escapeHtml(url)}" alt="" style="max-width:100%;height:auto;border-radius:4px;">`); break; }
    }
  }
  // Try to find images inside common repeater fields
  if (parts.length === 0) {
    const repeaterFields = ['list', 'list_interlocking', 'sliders', 'logos', 'images', 'slider', 'items'];
    for (const key of repeaterFields) {
      const arr = data[key];
      if (Array.isArray(arr) && arr.length > 0) {
        const item = arr[0];
        for (const imgKey of ['file', 'image', 'logo', 'slide']) {
          const val = item[imgKey];
          if (val) {
            const url = typeof val === 'string' ? val : (val.url || '');
            if (url) { parts.push(`<img src="${escapeHtml(url)}" alt="" style="max-width:100%;height:auto;border-radius:4px;">`); break; }
          }
        }
        if (parts.length > 0) break;
      }
    }
  }

  // Try to extract text content
  const textFields = ['text', 'title', 'title_bloc', 'catchphrase', 'description', 'desc'];
  for (const key of textFields) {
    const val = data[key];
    if (val && typeof val === 'string' && val.trim()) {
      parts.push(`<div style="font-size:0.9em;">${escapeHtml(val.replace(/<[^>]*>/g, '').slice(0, 150))}</div>`);
      break;
    }
  }

  if (parts.length === 0) {
    parts.push(`<span style="opacity:0.5">${escapeHtml(label)}</span>`);
  }

  return `<div class="module" style="padding:1em 0;">${parts.join('')}</div>`;
}

function renderColumnsTabPreviewHtml(data) {
  // Ensure columns-tab CSS is loaded (display:flex, column widths, etc.)
  const colsLayout = moduleFieldSchema?.modules?.ColumnsTab?.layout || 'columns-tab';
  if (!moduleTemplateCache[colsLayout]) {
    queueModuleTemplateLoad(colsLayout);
  }

  const columnsList = Array.isArray(data.columns_list) ? data.columns_list : [];
  if (columnsList.length === 0) {
    return '<div class="module module-columns"><div class="container"><p style="text-align:center;opacity:0.5;">Colonnes (vide)</p></div></div>';
  }
  const columnsCount = columnsList.length;
  const columnsDisplay = data.columns_display || 'columns-2_2-2';
  const columnsBackground = data.columns_background || 'no-background';
  const containerWidth = data.container_width == 1 || data.container_width === true || data.container_width === '1';
  const colsJustifyCenter = data.cols_justify_items == 1 || data.cols_justify_items === true || data.cols_justify_items === '1';
  const containerClass = containerWidth ? 'container-large' : 'container';

  // Bloc title
  let titleHtml = '';
  const titleBloc = data.title_bloc || data.title || '';
  if (titleBloc) {
    const titleStyle = data.title_style || 2;
    const titleAlign = data.title_align || 'center';
    titleHtml = `<h${titleStyle} class="title-module title-section-${titleStyle} align-${escapeHtml(String(titleAlign))}">${escapeHtml(String(titleBloc))}</h${titleStyle}>`;
  }

  // Background image
  let bgHtml = '';
  const bgImg = data.bg_img;
  if (bgImg) {
    const bgUrl = typeof bgImg === 'string' ? bgImg : (bgImg.url || '');
    const bgOpacity = (data.bg_opacity ?? 10) / 100;
    if (bgUrl) {
      bgHtml = `<div class="background" style="background-image: url(${escapeHtml(bgUrl)}); opacity: ${bgOpacity}; background-size: cover; background-position: center; position: absolute; inset: 0;"></div>`;
    }
  }

  // Ensure sub-module CSS is loaded
  const ensureSubModuleTemplates = (layout) => {
    if (!moduleTemplateCache[layout]) {
      queueModuleTemplateLoad(layout);
    }
  };

  // Build columns HTML — render each sub-module via renderBlockPreviewHtml
  const colsHtml = columnsList.map((column) => {
    const subModules = Array.isArray(column.columns_module) ? column.columns_module : [];
    const subHtmlParts = subModules.map((subModule) => {
      const layout = subModule.acf_fc_layout || subModule.type || '';
      if (!layout) return '';
      // Ensure sub-module template & CSS are loaded
      const subDef = BLOCK_TYPES[layout] || {};
      const subModuleName = subDef.moduleName || layout;
      let subLayout = moduleFieldSchema?.modules?.[subModuleName]?.layout || null;
      // Fallback: layout slug may itself be the layout (e.g. 'text' from acf_fc_layout)
      if (!subLayout) {
        const map = getLayoutToModuleNameMap();
        if (map[layout]) subLayout = layout;
      }
      if (subLayout) ensureSubModuleTemplates(subLayout);
      // Create a fake block and recursively render the sub-module preview
      // Mark as inside columns so templates can suppress title/background
      // _isSubModule bypasses the legacy block check (e.g. layout slug 'text'
      // is both a legacy block AND the Nickl TextSimple module slug)
      const subBlock = { id: 'sub-' + Math.random().toString(36).slice(2), type: layout, data: { ...subModule, columns: 1 }, _isSubModule: true };
      let subHtml = '';
      try { subHtml = replaceEmptyImages(renderBlockPreviewHtml(subBlock)); } catch (e) { console.warn('Sub-module render error:', layout, e); }
      // If template rendering produced empty/whitespace-only output (no text
      // AND no images), show a meaningful fallback so the column isn't invisible.
      const isVisualOnly = layout === 'separator' || layout === 'Separator';
      if (!isVisualOnly && (!subHtml || (!subHtml.replace(/<[^>]*>/g, '').trim() && !/<img\s/i.test(subHtml) && !/<video\s/i.test(subHtml)))) {
        subHtml = renderSubModuleFallback(layout, subModule);
      }
      return `<div class="module-in-column" style="width:100%">${subHtml}</div>`;
    }).filter(Boolean);
    return `<div class="col">${subHtmlParts.join('')}</div>`;
  }).join('');

  const extraClasses = [];
  if (data.bloc_color && data.bloc_color !== 'no-background-color') extraClasses.push(data.bloc_color);
  if (data.padding_top) extraClasses.push(data.padding_top);
  if (data.padding_bottom) extraClasses.push(data.padding_bottom);
  if (columnsBackground !== 'no-background') extraClasses.push('cols_have_background');
  if (data.bg_img) extraClasses.push('has-background-image');
  if (data.bg_parallax === true || data.bg_parallax === 1 || data.bg_parallax === '1') extraClasses.push('background-parallax');

  // Inline styles pour garantir le rendu visuel (contourne les conflits de cascade CSS)
  const inlineStyles = [];
  const COLOR_VALUES = getResolvedColorMap();
  const bc = data.bloc_color || '';
  if (bc && COLOR_VALUES[bc]) {
    inlineStyles.push(`background-color: ${COLOR_VALUES[bc]} !important`);
  }
  // Padding
  const pt = data.padding_top || '';
  const pb = data.padding_bottom || '';
  if (pt === 'no-padding-top') inlineStyles.push('padding-top: 0 !important');
  else if (pt === 'padding-top-small') inlineStyles.push('padding-top: calc(37.5px + 1.95vw) !important');
  if (pb === 'no-padding-bottom') inlineStyles.push('padding-bottom: 0 !important');
  else if (pb === 'padding-bottom-small') inlineStyles.push('padding-bottom: calc(37.5px + 1.95vw) !important');

  const styleAttr = inlineStyles.length > 0 ? ` style="${inlineStyles.join('; ')}"` : '';

  return `<div class="module module-columns ${extraClasses.join(' ')}"${styleAttr}>
    ${bgHtml}
    <div class="${escapeHtml(containerClass)}">
      ${titleHtml}
      <div class="cols-wrapper ${escapeHtml(columnsBackground)} columns-${columnsCount} ${escapeHtml(columnsDisplay)}${colsJustifyCenter ? ' cols_justify_center' : ''}">
        ${colsHtml}
      </div>
    </div>
  </div>`;
}

function renderBlockPreviewHtml(block) {
  const d = block.data || {};
  // Sub-modules inside ColumnsTab may have layout slugs that collide with
  // legacy block types (e.g. 'text' is both a legacy type AND the Nickl
  // TextSimple layout slug). Skip the legacy path for sub-modules so they
  // are rendered through the Blade template engine instead.
  if (LEGACY_BLOCK_TYPES[block.type] && !block._isSubModule) {
    if (block.type === 'heading') return `<div class="preview-heading">${escapeHtml(d.text || '')}</div>`;
    if (block.type === 'text') return `<div class="preview-title">${escapeHtml(d.title || '')}</div><div class="preview-text">${escapeHtml(d.body || '')}</div>`;
    if (block.type === 'hero') return `<div class="preview-hero"><div class="preview-title">${escapeHtml(d.title || '')}</div><div class="preview-text">${escapeHtml(d.subtitle || '')}</div></div>`;
    if (block.type === 'cta') return `<div class="preview-cta"><div class="preview-title">${escapeHtml(d.title || '')}</div><div class="preview-text">${escapeHtml(d.description || '')}</div></div>`;
    if (block.type === 'image') return d.src ? `<img class="preview-image" src="${escapeHtml(d.src)}" alt="${escapeHtml(d.alt || '')}">` : _noImagePlaceholderHtml;
    if (block.type === 'spacer') return `<div class="preview-spacer">Espace: ${escapeHtml(d.size || 'medium')}</div>`;
    if (block.type === 'html') return d.content ? `<div class="preview-html">${escapeHtml(String(d.content).slice(0, 240))}</div>` : '';
  }
  // Module Hero — custom visual preview (template has PHP helpers that can't render in JS)
  if (block.type === 'Hero' || block.type === 'hero') {
    return renderHeroPreviewHtml(d);
  }
  // IllusVideo — custom preview (video element needs explicit dimensions)
  if (block.type === 'illus-video' || block.type === 'IllusVideo') {
    const vid = d.video || {};
    const url = typeof vid === 'string' ? vid : (vid.url || '');
    if (!url) return '<div class="preview-loading">Aucune vidéo sélectionnée</div>';
    const w = Number(vid.width) || 0;
    const h = Number(vid.height) || 0;
    const ratio = h > 0 ? Math.floor(w / h) : 2;
    const isFs = d.is_fullscreen === true || d.is_fullscreen === 1 || d.is_fullscreen === '1';
    const cls = [isFs ? 'full-width' : '', d.bloc_color || '', d.padding_top || '', d.padding_bottom || ''].filter(Boolean).join(' ');
    return `<div class="module module-illustration-video ${escapeHtml(cls)}"><div class="container-large"><div class="video-wrapper" style="height:calc(100vh / ${ratio});position:relative"><video class="video" autoplay loop muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"><source src="${escapeHtml(url)}" type="video/mp4"></video></div></div></div>`;
  }
  // NewsSlider — custom preview (fetches actualités from CPT API)
  if (block.type === 'news-slider' || block.type === 'NewsSlider') {
    const nsCols = d.display_posts || '1';
    const nsExtraCls = [d.bloc_color || '', d.padding_top || '', d.padding_bottom || ''].filter(Boolean).join(' ');
    let nsBgHtml = '';
    const nsBgImg = d.bg_img;
    if (nsBgImg) {
      const nsBgUrl = typeof nsBgImg === 'string' ? nsBgImg : (nsBgImg.url || '');
      const nsBgOpacity = (d.bg_opacity ?? 10) / 100;
      if (nsBgUrl) nsBgHtml = `<div class="background" style="background-image:url(${escapeHtml(nsBgUrl)});opacity:${nsBgOpacity};background-size:cover;background-position:center;position:absolute;inset:0;"></div>`;
    }
    let nsTitleHtml = '';
    const nsTitleBloc = d.title_bloc || d.title || '';
    if (nsTitleBloc) {
      const nsTitleStyle = d.title_style || 2;
      const nsTitleAlign = d.title_align || 'center';
      nsTitleHtml = `<h${nsTitleStyle} class="title-module title-section-${nsTitleStyle} align-${escapeHtml(String(nsTitleAlign))}">${escapeHtml(String(nsTitleBloc))}</h${nsTitleStyle}>`;
    }
    const nsShowLink = d.display_archive_link === true || d.display_archive_link === 1 || d.display_archive_link === '1';
    const nsLinkLabel = d.archive_link_label || 'Voir toutes les actualités';
    const nsLinkHtml = nsShowLink ? `<div class="btn-more-wrapper"><a href="/actualites" class="btn btn-tertiary">${escapeHtml(nsLinkLabel)}</a></div>` : '';
    const nsId = 'ns_preview_' + Math.random().toString(36).slice(2, 8);

    // Async fetch actualités and inject
    setTimeout(async () => {
      const el = document.getElementById(nsId);
      if (!el) return;
      try {
        const data = await apiFetch('/cpt/actualites?status=published&limit=6');
        const items = data.items || data || [];
        if (items.length === 0) { el.innerHTML = '<p class="no-content">Aucune actualité publiée</p>'; return; }
        el.innerHTML = items.map(item => {
          const fi = item.featured_image;
          const imgUrl = fi ? (fi.sizes?.half || fi.url || '') : '';
          const cat = (item.categories || [])[0]?.name || '';
          const date = item.published_date || item.created_at;
          const dateStr = date ? new Date(date).toLocaleDateString('fr-FR') : '';
          return `<div class="swiper-slide item"><a href="#" class="link" onclick="return false"><div class="illus-wrapper">${imgUrl ? `<img src="${escapeHtml(getOptimizedUrl(imgUrl, 600, 70))}" alt="${escapeHtml(item.title)}" class="illus">` : _noImagePlaceholderHtml}<div class="overlay"><span>Lire l'actualité</span></div></div><div class="desc">${cat ? `<p class="category">${escapeHtml(cat)}</p>` : ''}${dateStr ? `<time class="date">${dateStr}</time>` : ''}<h3 class="title">${escapeHtml(item.title)}</h3>${item.excerpt ? `<p class="txt">${escapeHtml(item.excerpt)}</p>` : ''}</div></a></div>`;
        }).join('');
      } catch (e) {
        el.innerHTML = '<p style="text-align:center;opacity:.5">Erreur de chargement</p>';
      }
    }, 50);

    // Ensure CSS is loaded
    if (!moduleTemplateCache['news-slider']) queueModuleTemplateLoad('news-slider');
    return `<div class="module module-news-slider ${escapeHtml(nsExtraCls)}" style="position:relative">${nsBgHtml}<div class="container-large">${nsTitleHtml}<div class="slider-wrapper"><div class="swiper slider js_news-slider columns-${escapeHtml(nsCols)}"><div class="swiper-wrapper" id="${nsId}"><p style="text-align:center;opacity:.5">Chargement des actualités…</p></div></div></div>${nsLinkHtml}</div></div>`;
  }
  // Separator — custom preview (Blade uses $width top-level var not in ctx)
  if (block.type === 'separator' || block.type === 'Separator') {
    const sepStyle = d.separator_style || 'style-3';
    const sepWidth = d.width || 80;
    const sepHeight = d.height || 2;
    const sepText = d.text || '';
    const sepCls = [d.bloc_color || '', d.padding_top || '', d.padding_bottom || ''].filter(Boolean).join(' ');
    const withTextCls = sepText ? ' separator-with-text' : '';
    let sepInner = '';
    if (sepStyle === 'style-1') {
      sepInner = `<span class="points-wrapper"><span class="point point-1"></span><span class="point point-2"></span><span class="point point-3"></span></span>`;
      if (sepText) sepInner += `<span class="title title-section-3">${escapeHtml(sepText)}</span><span class="points-wrapper"><span class="point point-1"></span><span class="point point-2"></span><span class="point point-3"></span></span>`;
    } else if (sepStyle === 'style-2') {
      sepInner = `<hr class="default">`;
      if (sepText) sepInner += `<span class="title title-section-3">${escapeHtml(sepText)}</span><hr class="default">`;
    } else if (sepStyle === 'style-3') {
      const hrStyle = `width:${sepWidth}%;height:${sepHeight}px;`;
      sepInner = `<hr class="custom" style="${hrStyle}">`;
      if (sepText) sepInner += `<span class="title title-section-3">${escapeHtml(sepText)}</span><hr class="custom" style="${hrStyle}">`;
    }
    // style-0 = no visual separator
    if (!moduleTemplateCache['separator']) queueModuleTemplateLoad('separator');
    return `<div class="module module-separator ${escapeHtml(sepCls)}${withTextCls}">${sepInner}</div>`;
  }
  // Accordion — empty state: render add button directly
  if ((block.type === 'accordion' || block.type === 'Accordion') && (!Array.isArray(d.accordions) || d.accordions.length === 0)) {
    return `<div class="module module-accordion"><div class="container"><div class="accordion"><button type="button" class="accordion-add-btn">+ Ajouter un élément</button></div></div></div>`;
  }
  // ColumnsTab — custom preview (renders sub-modules recursively)
  if (block.type === 'columns-tab' || block.type === 'ColumnsTab') {
    return renderColumnsTabPreviewHtml(d);
  }
  // IconLogo — custom preview (@php block stripped by JS Blade engine → $img unresolved)
  if (block.type === 'icon-logo' || block.type === 'IconLogo' || block.type === 'icons') {
    const logos = Array.isArray(d.logos) ? d.logos : [];
    const greyFilter = d.grey_filter === true || d.grey_filter === 1 || d.grey_filter === '1';
    const iconType = d.icon_type !== false && d.icon_type !== 0 && d.icon_type !== '0';
    const extraCls = [];
    if (d.bloc_color) extraCls.push(d.bloc_color);
    if (d.padding_top) extraCls.push(d.padding_top);
    if (d.padding_bottom) extraCls.push(d.padding_bottom);
    // Background image
    let bgHtml = '';
    const bgImg = d.bg_img;
    if (bgImg) {
      const bgUrl = typeof bgImg === 'string' ? bgImg : (bgImg.url || '');
      const bgOpacity = (d.bg_opacity ?? 10) / 100;
      if (bgUrl) {
        bgHtml = `<div class="background" style="background-image: url(${escapeHtml(bgUrl)}); opacity: ${bgOpacity}; background-size: cover; background-position: center; position: absolute; inset: 0;"></div>`;
        extraCls.push('has-background-image');
      }
    }
    // Bloc title
    let titleHtml = '';
    const titleBloc = d.title_bloc || d.title || '';
    if (titleBloc) {
      const titleStyle = d.title_style || 2;
      const titleAlign = d.title_align || 'center';
      titleHtml = `<h${titleStyle} class="title-module title-section-${titleStyle} align-${escapeHtml(String(titleAlign))}">${escapeHtml(String(titleBloc))}</h${titleStyle}>`;
    }
    const listCls = `list${greyFilter ? ' grey_filter' : ''}${!iconType ? ' icon_type_jpg' : ''}`;
    const itemsHtml = logos.map(logo => {
      const logoObj = logo.logo || {};
      const imgUrl = typeof logoObj === 'string' ? logoObj : (logoObj.url || '');
      const link = logo.link || {};
      const linkUrl = typeof link === 'string' ? link : (link.url || '');
      const linkTarget = (typeof link === 'object' && link.target) ? link.target : '_self';
      const titre = logo.titre || '';
      const desc = logo.desc || '';
      const imgCls = `illus${!iconType ? ' icon_type_jpg' : ''}`;
      let inner = `<div class="illus-wrapper">${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="" class="${imgCls}">` : _noImagePlaceholderHtml}</div>`;
      if (titre || desc) {
        inner += `<div class="desc">${titre ? `<p class="title">${escapeHtml(titre)}</p>` : ''}${desc ? `<div class="txt editor"><p>${desc.replace(/\n/g, '<br>')}</p></div>` : ''}</div>`;
      }
      if (linkUrl) {
        inner = `<a href="${escapeHtml(linkUrl)}" class="link" target="${escapeHtml(linkTarget)}">${inner}</a>`;
      }
      return `<li class="item">${inner}</li>`;
    }).join('');
    // Ensure icons CSS is loaded
    const iconsLayout = moduleFieldSchema?.modules?.IconLogo?.layout || 'icons';
    if (!moduleTemplateCache[iconsLayout]) queueModuleTemplateLoad(iconsLayout);
    return `<div class="module module-icons ${extraCls.join(' ')}">${bgHtml}<div class="container">${titleHtml}${logos.length > 0 ? `<ul class="${listCls}">${itemsHtml}</ul>` : ''}</div></div>`;
  }
  // Contact — custom preview (Blade template uses @php blocks that JS engine strips)
  const _socialSvg = {
    instagram: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><path d="M7.64,25.92a9.47,9.47,0,0,1-3.16-.6,6.5,6.5,0,0,1-2.3-1.5,6.41,6.41,0,0,1-1.5-2.3,9.73,9.73,0,0,1-.6-3.16C0,17,0,16.52,0,13S0,9,.08,7.64a9.73,9.73,0,0,1,.6-3.16A6.66,6.66,0,0,1,4.48.68,9.73,9.73,0,0,1,7.64.08C9,0,9.48,0,13,0s4,0,5.36.08a9.78,9.78,0,0,1,3.16.6,6.66,6.66,0,0,1,3.8,3.8,10,10,0,0,1,.6,3.16C26,9,26,9.46,26,13s0,4-.08,5.36a9.52,9.52,0,0,1-.6,3.16,6.65,6.65,0,0,1-3.8,3.8,10,10,0,0,1-3.15.6C17,26,16.54,26,13,26S9,26,7.64,25.92Zm.11-23.5a7.15,7.15,0,0,0-2.42.45,4.09,4.09,0,0,0-1.49,1,4.07,4.07,0,0,0-1,1.5,7.34,7.34,0,0,0-.44,2.41C2.36,9.12,2.34,9.53,2.34,13s0,3.88.08,5.25a7.15,7.15,0,0,0,.45,2.42,4,4,0,0,0,1,1.49,4,4,0,0,0,1.49,1,7.15,7.15,0,0,0,2.42.45c1.36.07,1.77.08,5.25.08s3.89,0,5.25-.08a7.11,7.11,0,0,0,2.42-.45,4.26,4.26,0,0,0,2.46-2.46,7.15,7.15,0,0,0,.45-2.42c.07-1.36.08-1.77.08-5.25s0-3.89-.08-5.25a7.15,7.15,0,0,0-.45-2.42,4,4,0,0,0-1-1.49,4.11,4.11,0,0,0-1.49-1,7.4,7.4,0,0,0-2.42-.44c-1.37-.06-1.79-.08-5.25-.08s-3.88,0-5.25.08ZM6.32,13A6.68,6.68,0,1,1,13,19.67,6.68,6.68,0,0,1,6.32,13Zm2.35,0A4.33,4.33,0,1,0,13,8.67h0A4.33,4.33,0,0,0,8.67,13Zm9.71-6.94a1.56,1.56,0,1,1,1.56,1.56h0A1.56,1.56,0,0,1,18.38,6.06Z"/></svg>',
    facebook: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 25.73 25.74"><path d="M24.31,0H1.42A1.43,1.43,0,0,0,0,1.42H0V24.31a1.42,1.42,0,0,0,1.42,1.42H13.75v-10H10.4v-3.9h3.35V9c0-3.32,2-5.13,5-5.13a24.85,24.85,0,0,1,3,.15V7.51h-2c-1.61,0-1.93.76-1.93,1.89v2.48h3.86l-.5,3.9H17.75v10h6.56a1.42,1.42,0,0,0,1.42-1.42h0V1.42A1.42,1.42,0,0,0,24.31,0Z"/></svg>',
    threads: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><path d="M18.9,11.9c.1,0,.2.1.3.2,1.6.8,2.7,1.9,3.3,3.3.9,2,.9,5.2-1.6,7.8-2,2-4.3,2.8-7.7,2.9h0c-3.8,0-6.7-1.3-8.7-3.8-1.7-2.2-2.6-5.3-2.7-9.2h0c0-3.9.9-7,2.7-9.2C6.5,1.3,9.4,0,13.2,0h0c3.8,0,6.8,1.3,8.8,3.8,1,1.2,1.7,2.7,2.2,4.4l-2.2.6c-.4-1.4-1-2.6-1.7-3.5-1.6-1.9-4-2.9-7.1-3-3.1,0-5.4,1-6.9,2.9-1.4,1.8-2.2,4.4-2.2,7.8,0,3.3.8,6,2.2,7.8,1.5,1.9,3.9,2.9,6.9,2.9,2.8,0,4.6-.7,6.2-2.2,1.7-1.7,1.7-3.9,1.2-5.2-.3-.8-.9-1.4-1.7-1.9-.2,1.5-.6,2.6-1.3,3.5-.9,1.2-2.2,1.8-3.9,1.9-1.3,0-2.5-.2-3.5-.9-1.1-.7-1.8-1.9-1.9-3.2-.1-2.6,1.9-4.5,5.2-4.7,1.1,0,2.2,0,3.2.2-.1-.8-.4-1.4-.8-1.9-.5-.6-1.4-1-2.5-1h0c-.9,0-2.1.2-2.9,1.4l-1.9-1.3c1-1.6,2.7-2.4,4.8-2.4h0c3.4,0,5.4,2.1,5.6,5.8h0s0,0,0,0ZM10.4,15.6c0,1.4,1.5,2,3,1.9,1.4,0,3-.6,3.2-4-.7-.2-1.5-.2-2.4-.2s-.5,0-.8,0c-2.3.1-3.1,1.3-3,2.3h0s0,0,0,0Z"/></svg>',
    tiktok: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="26" viewBox="0 0 25.152 29.022"><path d="M22.02,6.207a6.609,6.609,0,0,1-.571-.333,8.033,8.033,0,0,1-1.467-1.247,6.921,6.921,0,0,1-1.653-3.412h.006A4.2,4.2,0,0,1,18.268,0H13.284V19.273c0,.259,0,.515-.011.767,0,.031,0,.06,0,.094a.206.206,0,0,1,0,.043v.011a4.232,4.232,0,0,1-2.129,3.359,4.159,4.159,0,0,1-2.062.544,4.232,4.232,0,0,1,0-8.464,4.164,4.164,0,0,1,1.294.2l.006-5.075A9.258,9.258,0,0,0,3.24,12.845a9.782,9.782,0,0,0-2.134,2.632,9.121,9.121,0,0,0-1.1,4.186,9.88,9.88,0,0,0,.535,3.309v.012a9.74,9.74,0,0,0,1.353,2.468,10.129,10.129,0,0,0,2.159,2.037v-.012l.012.012a9.326,9.326,0,0,0,5.088,1.532,9.007,9.007,0,0,0,3.776-.835A9.477,9.477,0,0,0,16,25.881,9.58,9.58,0,0,0,17.667,23.1a10.4,10.4,0,0,0,.6-3.176V9.7c.06.036.866.569.866.569A11.527,11.527,0,0,0,22.1,11.5a17.1,17.1,0,0,0,3.048.417V6.969a6.463,6.463,0,0,1-3.132-.762"/></svg>',
    linkedin: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"><path d="M22.224,24H1.77A1.753,1.753,0,0,1,0,22.268V1.731A1.753,1.753,0,0,1,1.77,0H22.224A1.756,1.756,0,0,1,24,1.731V22.268A1.756,1.756,0,0,1,22.224,24ZM9.353,9V20.451h3.555V14.786c0-1.454.254-2.941,2.134-2.941,1.85,0,1.85,1.755,1.85,3.036v5.571h3.559V14.17a7.2,7.2,0,0,0-.784-3.886,3.764,3.764,0,0,0-3.487-1.571,3.763,3.763,0,0,0-3.368,1.849h-.049V9Zm-5.8,0V20.451H7.118V9ZM5.339,3.3A2.065,2.065,0,1,0,7.4,5.368,2.068,2.068,0,0,0,5.339,3.3Z"/></svg>',
    twitter: '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="23" viewBox="0 0 25 22.6"><path d="M19.7,0h3.8l-8.4,9.6L25,22.6h-7.7l-6-7.9-6.9,7.9H0.5l8.9-10.2L0,0h7.9l5.5,7.2L19.7,0z M18.4,20.3h2.1L6.8,2.2H4.4 L18.4,20.3z"/></svg>',
    tripadvisor: '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="22" viewBox="0 0 39.932 25.64"><path d="M36.668,7.468l3.264-3.551H32.695a22.612,22.612,0,0,0-25.439,0H0L3.264,7.468a9.977,9.977,0,1,0,13.5,14.691l3.2,3.481,3.2-3.478A9.98,9.98,0,1,0,36.668,7.468M9.988,21.593a6.751,6.751,0,1,1,6.751-6.751,6.75,6.75,0,0,1-6.751,6.751m9.978-6.948c0-4.443-3.23-8.256-7.494-9.885a19.477,19.477,0,0,1,14.986,0C23.2,6.392,19.966,10.2,19.966,14.645m9.976,6.948a6.751,6.751,0,1,1,6.751-6.751,6.75,6.75,0,0,1-6.751,6.751m0-10.293a3.539,3.539,0,1,0,3.539,3.539A3.538,3.538,0,0,0,29.942,11.3M13.526,14.842A3.539,3.539,0,1,1,9.988,11.3a3.538,3.538,0,0,1,3.539,3.539"/></svg>',
    pinterest: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 25.75 25.74"><path d="M12.87,0A12.87,12.87,0,0,0,8.18,24.85a12.34,12.34,0,0,1,0-3.69c.24-1,1.51-6.4,1.51-6.4a4.69,4.69,0,0,1-.38-1.91c0-1.79,1-3.13,2.32-3.13a1.61,1.61,0,0,1,1.64,1.6,1.7,1.7,0,0,1,0,.22,25.28,25.28,0,0,1-1.07,4.28,1.87,1.87,0,0,0,1.35,2.27,1.78,1.78,0,0,0,.56.06c2.29,0,4-2.41,4-5.89A5.09,5.09,0,0,0,13.27,7h-.46A5.58,5.58,0,0,0,7,12.34v.27a5,5,0,0,0,1,2.93.41.41,0,0,1,.09.37c-.1.41-.32,1.28-.36,1.46s-.19.28-.43.17c-1.61-.75-2.61-3.1-2.61-5,0-4.06,2.95-7.79,8.5-7.79,4.46,0,7.93,3.18,7.93,7.43,0,4.44-2.8,8-6.68,8a3.43,3.43,0,0,1-3-1.48s-.64,2.46-.8,3.06a14.14,14.14,0,0,1-1.6,3.38A12.87,12.87,0,1,0,16.69.58,12.73,12.73,0,0,0,12.87,0"/></svg>',
    youtube: '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="24" viewBox="0 0 40.402 28.283"><path d="M39.558,4.417A5.059,5.059,0,0,0,35.986.845C32.836,0,20.2,0,20.2,0S7.566,0,4.417.845A5.06,5.06,0,0,0,.845,4.417C0,7.566,0,14.142,0,14.142s0,6.575.845,9.725a5.06,5.06,0,0,0,3.572,3.572c3.15.845,15.784.845,15.784.845s12.635,0,15.784-.845a5.059,5.059,0,0,0,3.572-3.572c.845-3.15.845-9.725.845-9.725s0-6.575-.845-9.725M16.157,20.2V8.083l10.5,6.06Z"/></svg>',
  };
  if (block.type === 'contact' || block.type === 'Contact') {
    const addresses = Array.isArray(d.addresses) ? d.addresses : [];
    const isMapMode = d.is_map === true || d.is_map === 1 || d.is_map === '1';
    const contactExtraCls = [];
    if (d.bloc_color) contactExtraCls.push(d.bloc_color);
    if (d.padding_top) contactExtraCls.push(d.padding_top);
    if (d.padding_bottom) contactExtraCls.push(d.padding_bottom);
    let contactBgHtml = '';
    const contactBgImg = d.bg_img;
    if (contactBgImg) {
      const bgUrl = typeof contactBgImg === 'string' ? contactBgImg : (contactBgImg.url || '');
      const bgOpacity = (d.bg_opacity ?? 10) / 100;
      if (bgUrl) {
        contactBgHtml = `<div class="background" style="background-image: url(${escapeHtml(bgUrl)}); opacity: ${bgOpacity}; background-size: cover; background-position: center; position: absolute; inset: 0;"></div>`;
        contactExtraCls.push('has-background-image');
      }
    }
    let contactTitleHtml = '';
    const contactTitle = d.title_bloc || d.title || '';
    if (contactTitle) {
      const ts = d.title_style || 2;
      const ta = d.title_align || 'center';
      contactTitleHtml = `<h${ts} class="title-module title-section-${ts} align-${escapeHtml(String(ta))}">${escapeHtml(String(contactTitle))}</h${ts}>`;
    }
    const cMarkers = [];
    let cCenterLat = 0, cCenterLng = 0;
    const cItemsHtml = addresses.map(contact => {
      const addr = contact.address || {};
      const lat = parseFloat(addr.lat) || 0;
      const lng = parseFloat(addr.lng) || 0;
      if (lat && lng) { cMarkers.push([lng, lat]); cCenterLat += lat; cCenterLng += lng; }
      const streetNumber = addr.street_number || '';
      const streetName = addr.street_name || '';
      const postCode = addr.post_code || '';
      const city = addr.city || '';
      const addressName = addr.name || addr.address || '';
      const addressStreet = `${streetNumber} ${streetName}`.trim();
      const addressStreetShort = `${streetNumber} ${addr.street_name_short || ''}`.trim();
      const placeId = addr.place_id || '';
      const logoObj = contact.logo || {};
      const logoUrl = typeof logoObj === 'string' ? logoObj : (logoObj.url || '');
      let h = '';
      if (logoUrl) h += `<div class="logo-wrapper"><img src="${escapeHtml(logoUrl)}" alt="" class="logo"></div>`;
      if (contact.name) h += `<p class="title title-section-4">${escapeHtml(contact.name)}</p>`;
      if (lat) {
        h += '<address class="address">';
        if (addressName && addressName !== addressStreet && addressName !== addressStreetShort && !addressName.includes(addressStreet)) h += `${escapeHtml(addressName)}<br>`;
        if (streetName) h += `${escapeHtml(addressStreet)}<br>`;
        h += escapeHtml(`${postCode} ${city}`.trim());
        h += '</address>';
        if (addresses.length > 1 && placeId) h += `<a href="https://www.google.com/maps/place/?q=place_id:${escapeHtml(placeId)}" class="btn btn-tertiary" title="Itin\u00e9raire" target="_blank">Itin\u00e9raire</a>`;
      }
      if (contact.phone) h += `<p class="phone-wrapper">Tel. <a href="tel:${escapeHtml(String(contact.phone).replace(/\s/g, ''))}" class="phone">${escapeHtml(contact.phone)}</a></p>`;
      if (contact.mail) h += `<div class="mail-wrapper"><a href="mailto:${escapeHtml(contact.mail)}">${escapeHtml(contact.mail)}</a></div>`;
      if (contact.schedule) h += `<div class="editor txt"><p><b>Horaires d\u2019ouverture</b></p><p>${escapeHtml(contact.schedule).replace(/\n/g, '<br>')}</p></div>`;
      const socialKeys = ['instagram','facebook','threads','tiktok','linkedin','twitter','tripadvisor','pinterest','youtube'];
      const socials = socialKeys.filter(k => contact[k]);
      if (socials.length > 0) {
        h += '<ul class="social-networks">' + socials.map(k => {
          const ttl = k === 'twitter' ? 'X (Twitter)' : k.charAt(0).toUpperCase() + k.slice(1);
          const svgMarkup = _socialSvg[k] || '';
          return `<li class="item-social"><a href="${escapeHtml(contact[k])}" title="${ttl}" target="_blank" class="link"><span class="icon" aria-hidden="true">${svgMarkup}</span></a></li>`;
        }).join('') + '</ul>';
      }
      return `<li class="item">${h}</li>`;
    }).join('');
    if (cMarkers.length > 0) { cCenterLat /= cMarkers.length; cCenterLng /= cMarkers.length; }
    let col2Html = '';
    if (!isMapMode) {
      const photoObj = d.photo || {};
      const photoUrl = typeof photoObj === 'string' ? photoObj : (photoObj.url || '');
      col2Html = photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" class="illus">` : _noImagePlaceholderHtml;
    } else if (cMarkers.length > 0) {
      const contactMapId = 'contact-map-preview-' + (block.id || Math.random().toString(36).slice(2));
      let gpsHtml = '';
      if (addresses.length === 1 && addresses[0]?.address?.place_id) {
        gpsHtml = `<a href="https://www.google.com/maps/place/?q=place_id:${escapeHtml(addresses[0].address.place_id)}" class="btn btn-primary" title="Itin\u00e9raire" target="_blank" style="position:absolute;z-index:99;top:97px;right:10px;">\ud83d\udccd</a>`;
      }
      col2Html = `<div class="map-wrapper js_show-content"><div id="${contactMapId}" class="map js_load-map" data-markers='${JSON.stringify(cMarkers)}' data-lng="${cCenterLng}" data-lat="${cCenterLat}">${gpsHtml}</div></div>`;
      setTimeout(async () => {
        const el = document.getElementById(contactMapId);
        if (!el || el.dataset.mapInit) return;
        el.dataset.mapInit = '1';
        await ensureMapboxGL();
        if (!window.mapboxgl) return;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        const map = new mapboxgl.Map({ container: el, style: 'mapbox://styles/mapbox/streets-v12', center: [cCenterLng, cCenterLat], zoom: 16, pitch: 50 });
        map.scrollZoom.disable();
        map.addControl(new mapboxgl.NavigationControl());
        cMarkers.forEach(coord => {
          const markerEl = document.createElement('div');
          const pin = document.createElement('div');
          pin.classList.add('container-pin');
          const img = document.createElement('div');
          img.classList.add('img-pin');
          img.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>';
          pin.append(img);
          markerEl.append(pin);
          markerEl.classList.add('marker');
          new mapboxgl.Marker(markerEl).setLngLat(coord).addTo(map);
        });
        const bounds = new mapboxgl.LngLatBounds();
        cMarkers.forEach(c => bounds.extend(c));
        map.fitBounds(bounds, { padding: 100 });
        if (cMarkers.length === 1) { map.on('load', () => { map.setZoom(17); map.setPitch(65); }); }
        map.on('load', () => map.resize());
        setTimeout(() => map.resize(), 300);
        setTimeout(() => map.resize(), 800);
      }, 100);
    }
    const contactLayout = moduleFieldSchema?.modules?.Contact?.layout || 'contact';
    if (!moduleTemplateCache[contactLayout]) queueModuleTemplateLoad(contactLayout);
    return `<div class="module module-contact ${contactExtraCls.join(' ')}" style="position:relative;">${contactBgHtml}<div class="container">${contactTitleHtml}<div class="cols-wrapper"><div class="col col-1">${addresses.length > 0 ? '<ul class="list">' + cItemsHtml + '</ul>' : ''}</div><div class="col col-2">${col2Html}</div></div></div></div>`;
  }
  // Map — custom preview (Blade template uses PHP assignment in @if which JS engine can't parse)
  if (block.type === 'map' || block.type === 'Map') {
    const address = d.address || null;
    const lat = address ? parseFloat(address.lat) : 0;
    const lng = address ? parseFloat(address.lng) : 0;
    const placeId = address?.place_id || '';
    const addrText = address?.address || '';
    const isFs = d.is_fullscreen === true || d.is_fullscreen === 1 || d.is_fullscreen === '1';
    const mapExtraCls = [];
    if (d.bloc_color) mapExtraCls.push(d.bloc_color);
    if (d.padding_top) mapExtraCls.push(d.padding_top);
    if (d.padding_bottom) mapExtraCls.push(d.padding_bottom);
    if (isFs) mapExtraCls.push('full-width');
    // Background image
    let mapBgHtml = '';
    const mapBgImg = d.bg_img;
    if (mapBgImg) {
      const bgUrl = typeof mapBgImg === 'string' ? mapBgImg : (mapBgImg.url || '');
      const bgOpacity = (d.bg_opacity ?? 10) / 100;
      if (bgUrl) {
        mapBgHtml = `<div class="background" style="background-image: url(${escapeHtml(bgUrl)}); opacity: ${bgOpacity}; background-size: cover; background-position: center; position: absolute; inset: 0;"></div>`;
        mapExtraCls.push('has-background-image');
      }
    }
    // Bloc title
    let mapTitleHtml = '';
    const mapTitle = d.title_bloc || d.title || '';
    if (mapTitle) {
      const ts = d.title_style || 4;
      const ta = d.title_align || 'center';
      mapTitleHtml = `<div class="container"><h${ts} class="title-module title-section-${ts} align-${escapeHtml(String(ta))}">${escapeHtml(String(mapTitle))}</h${ts}></div>`;
    }
    let mapContentHtml = '';
    const mapPreviewId = 'map-live-preview-' + (block.id || Math.random().toString(36).slice(2));
    if (lat && lng) {
      const gpsLink = placeId ? `<a href="https://www.google.com/maps/place/?q=place_id:${escapeHtml(placeId)}" title="Itinéraire" target="_blank" style="position:absolute;z-index:99;bottom:12px;left:12px;padding:6px 12px;background:var(--color-primary,#333);color:#fff;border:none;border-radius:4px;font-size:12px;text-decoration:none;display:flex;align-items:center;gap:4px;">📍 Itinéraire</a>` : '';
      const containerPad = isFs ? 'padding:0;' : '';
      mapContentHtml = `<div class="container-large container-1" style="${containerPad}"><div class="map-wrapper" style="position:relative;height:400px;background:#e5e3df;border-radius:${isFs ? '0' : 'var(--border-radius,8px)'};overflow:hidden;"><div id="${mapPreviewId}" class="map" style="position:absolute;inset:0;">${gpsLink}</div></div></div>`;
      // Initialize live Mapbox map in the preview after DOM insert
      setTimeout(async () => {
        const el = document.getElementById(mapPreviewId);
        if (!el || el.dataset.mapInit) return;
        el.dataset.mapInit = '1';
        await ensureMapboxGL();
        if (!window.mapboxgl) return;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        const map = new mapboxgl.Map({
          container: el,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [lng, lat],
          zoom: 16,
          pitch: 50,
        });
        map.scrollZoom.disable();
        map.addControl(new mapboxgl.NavigationControl());
        new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map);
        map.on('load', () => map.resize());
        setTimeout(() => map.resize(), 300);
        setTimeout(() => map.resize(), 800);
      }, 100);
    } else {
      mapContentHtml = `<div class="container"><p style="color:#999;text-align:center;padding:2em 0;">Aucune adresse configurée.</p></div>`;
    }
    // Ensure map CSS is loaded
    const mapLayout = moduleFieldSchema?.modules?.Map?.layout || 'map';
    if (!moduleTemplateCache[mapLayout]) queueModuleTemplateLoad(mapLayout);
    return `<div class="module module-map ${mapExtraCls.join(' ')}" style="position:relative;">${mapBgHtml}${mapTitleHtml}${mapContentHtml}</div>`;
  }
  // Form — custom preview (Blade uses gravity_form() PHP function which JS can't execute)
  if (block.type === 'form' || block.type === 'Form') {
    const formId = d.form_id;
    const formCls = [d.bloc_color || '', d.padding_top || '', d.padding_bottom || ''].filter(Boolean).join(' ');
    let formBgHtml = '';
    const formBgImg = d.bg_img;
    if (formBgImg) {
      const bgUrl = typeof formBgImg === 'string' ? formBgImg : (formBgImg.url || '');
      const bgOpacity = (d.bg_opacity ?? 10) / 100;
      if (bgUrl) {
        formBgHtml = `<div class="background" style="background-image: url(${escapeHtml(bgUrl)}); opacity: ${bgOpacity}; background-size: cover; background-position: center; position: absolute; inset: 0;"></div>`;
      }
    }
    let formTitleHtml = '';
    const formTitle = d.title_bloc || d.title || '';
    if (formTitle) {
      const ts = d.title_style || 2;
      const ta = d.title_align || 'center';
      formTitleHtml = `<h${ts} class="title-module title-section-${ts} align-${escapeHtml(String(ta))}">${escapeHtml(String(formTitle))}</h${ts}>`;
    }
    if (!formId) {
      return `<div class="module module-form ${escapeHtml(formCls)}" style="position:relative;">${formBgHtml}<div class="container">${formTitleHtml}<p style="text-align:center;opacity:0.5;">Aucun formulaire sélectionné.</p></div></div>`;
    }
    const formPreviewId = 'form-preview-' + (block.id || Math.random().toString(36).slice(2));
    setTimeout(async () => {
      const el = document.getElementById(formPreviewId);
      if (!el || el.dataset.loaded) return;
      el.dataset.loaded = '1';
      try {
        const formData = await apiFetch(`/forms/public/${formId}`);
        if (!formData || !formData.fields || formData.fields.length === 0) {
          el.innerHTML = '<p style="text-align:center;opacity:0.5;">Formulaire vide ou introuvable.</p>';
          return;
        }
        const submitText = formData.settings?.submit_text || 'Envoyer';
        const fieldsHtml = formData.fields.map(field => {
          const width = field.settings?.width || '100';
          const req = field.required;
          const reqStar = req ? '<span style="color:#e53e3e;margin-left:2px;">*</span>' : '';
          if (field.type === 'hidden') return '';
          if (field.type === 'html') {
            return `<div class="nickl-form-field nickl-form-field--html w-${escapeHtml(width)}">${field.settings?.html_content || ''}</div>`;
          }
          if (field.type === 'name') {
            const firstLabel = field.settings?.first_label || 'Prénom';
            const lastLabel = field.settings?.last_label || 'Nom';
            return `<div class="nickl-form-field nickl-form-field--name w-${escapeHtml(width)}"><div class="nickl-form-name-row"><div class="nickl-form-name-col"><div class="nickl-form-floating"><input type="text" class="nickl-form-input" placeholder=" " disabled><label class="nickl-form-label">${escapeHtml(firstLabel)}${reqStar}</label></div></div><div class="nickl-form-name-col"><div class="nickl-form-floating"><input type="text" class="nickl-form-input" placeholder=" " disabled><label class="nickl-form-label">${escapeHtml(lastLabel)}${reqStar}</label></div></div></div></div>`;
          }
          const isFloatable = ['text', 'email', 'phone', 'number', 'url', 'date', 'time', 'textarea'].includes(field.type);
          if (isFloatable) {
            const inputEl = field.type === 'textarea'
              ? `<textarea class="nickl-form-textarea" placeholder=" " rows="${field.settings?.rows || 4}" disabled></textarea>`
              : `<input type="${field.type === 'phone' ? 'tel' : escapeHtml(field.type)}" class="nickl-form-input" placeholder=" " disabled>`;
            return `<div class="nickl-form-field nickl-form-field--${escapeHtml(field.type)} w-${escapeHtml(width)}"><div class="nickl-form-floating">${inputEl}<label class="nickl-form-label">${escapeHtml(field.label)}${reqStar}</label></div></div>`;
          }
          if (field.type === 'select') {
            const opts = (field.options || []).map(opt => {
              const parts = opt.includes('|') ? opt.split('|') : [opt, opt];
              return `<option>${escapeHtml(parts[0])}</option>`;
            }).join('');
            return `<div class="nickl-form-field nickl-form-field--select w-${escapeHtml(width)}"><label class="nickl-form-label nickl-form-label--static">${escapeHtml(field.label)}${reqStar}</label><select class="nickl-form-select" disabled><option>${escapeHtml(field.placeholder || '— Choisir —')}</option>${opts}</select></div>`;
          }
          if (field.type === 'radio') {
            const opts = (field.options || []).map(opt => {
              const parts = opt.includes('|') ? opt.split('|') : [opt, opt];
              return `<label class="nickl-form-radio-label"><input type="radio" disabled><span>${escapeHtml(parts[0])}</span></label>`;
            }).join('');
            return `<div class="nickl-form-field nickl-form-field--radio w-${escapeHtml(width)}"><label class="nickl-form-label nickl-form-label--static">${escapeHtml(field.label)}${reqStar}</label><div class="nickl-form-radio-group">${opts}</div></div>`;
          }
          if (field.type === 'checkbox') {
            const opts = (field.options || []).map(opt => {
              const parts = opt.includes('|') ? opt.split('|') : [opt, opt];
              return `<label class="nickl-form-checkbox-label"><input type="checkbox" disabled><span>${escapeHtml(parts[0])}</span></label>`;
            }).join('');
            return `<div class="nickl-form-field nickl-form-field--checkbox w-${escapeHtml(width)}"><label class="nickl-form-label nickl-form-label--static">${escapeHtml(field.label)}${reqStar}</label><div class="nickl-form-checkbox-group">${opts}</div></div>`;
          }
          if (field.type === 'file') {
            return `<div class="nickl-form-field nickl-form-field--file w-${escapeHtml(width)}"><label class="nickl-form-label nickl-form-label--static">${escapeHtml(field.label)}${reqStar}</label><input type="file" class="nickl-form-input" disabled></div>`;
          }
          return `<div class="nickl-form-field w-${escapeHtml(width)}"><label class="nickl-form-label nickl-form-label--static">${escapeHtml(field.label)}${reqStar}</label><input type="text" class="nickl-form-input" placeholder=" " disabled></div>`;
        }).join('');
        el.innerHTML = `<form class="nickl-form" style="pointer-events:none;"><div class="nickl-form-fields">${fieldsHtml}</div><div class="nickl-form-submit"><button type="button" class="nickl-form-btn" disabled>${escapeHtml(submitText)}</button></div></form>`;
      } catch (e) {
        el.innerHTML = '<p style="text-align:center;color:red;">Erreur: ' + escapeHtml(e.message) + '</p>';
      }
    }, 50);
    return `<div class="module module-form ${escapeHtml(formCls)}" style="position:relative;">${formBgHtml}<div class="container">${formTitleHtml}<div id="${formPreviewId}"><p style="text-align:center;opacity:0.5;">Chargement du formulaire…</p></div></div></div>`;
  }
  // PlanSite — custom preview (Blade calls do_shortcode which JS can't process)
  if (block.type === 'plansite' || block.type === 'plan-site' || block.type === 'PlanSite') {
    const psCls = [d.bloc_color || '', d.padding_top || '', d.padding_bottom || ''].filter(Boolean).join(' ');
    let psTitleHtml = '';
    if (d.title_bloc || d.title) {
      const t = d.title_bloc || d.title;
      const s = d.title_style || '2';
      const a = d.title_align || 'center';
      psTitleHtml = `<h${s} class="title-module title-section-${s} align-${a}">${escapeHtml(t)}</h${s}>`;
    }
    if (!moduleTemplateCache['plansite']) queueModuleTemplateLoad('plansite');
    return `<div class="module module-plansite ${psCls}" style="position:relative;">` +
      `<div class="container">${psTitleHtml}` +
      `<div class="list">` +
      `<div class="item"><h2>Les pages</h2><ul><li style="color:#999;">Toutes les pages publiées…</li></ul></div>` +
      `<div class="item"><h2>Les articles</h2><ul><li style="color:#999;">Tous les articles publiés…</li></ul></div>` +
      `<div class="item"><h2>Références</h2><ul><li style="color:#999;">Toutes les références…</li></ul></div>` +
      `</div></div></div>`;
  }
  // Summary — custom preview (Blade uses wp_nav_menu which JS can't render)
  if (block.type === 'summary' || block.type === 'Summary') {
    const sumCls = [d.bloc_color || '', d.padding_top || '', d.padding_bottom || ''].filter(Boolean).join(' ');
    let sumTitleHtml = '';
    if (d.title_bloc || d.title) {
      const t = d.title_bloc || d.title;
      const s = d.title_style || '2';
      const a = d.title_align || 'center';
      sumTitleHtml = `<h${s} class="title-module title-section-${s} align-${a}">${escapeHtml(t)}</h${s}>`;
    }
    const useMenu = d.links_type === true || d.links_type === 1 || d.links_type === '1';
    let sumContent = '';
    if (useMenu && d.menu_id) {
      const sumMenuId = 'summary-menu-preview-' + (block.id || '');
      setTimeout(async () => {
        const el = document.getElementById(sumMenuId);
        if (!el) return;
        try {
          const items = await apiFetch(`/menus/${d.menu_id}/navigation`);
          if (!items || !items.length) { el.innerHTML = '<p style="color:#999">Menu vide</p>'; return; }
          el.innerHTML = '<ul class="menu">' + items.map(item => {
            const children = item.children || [];
            if (children.length) {
              return `<li class="menu-item sub"><p class="title">${escapeHtml(item.title)}</p><ul class="sub-menu">${children.map(c => `<li class="menu-item"><a href="#">${escapeHtml(c.title)}</a></li>`).join('')}</ul></li>`;
            }
            return `<li class="menu-item"><a href="#">${escapeHtml(item.title)}</a></li>`;
          }).join('') + '</ul>';
        } catch (e) { el.innerHTML = '<p style="color:#999">Erreur de chargement du menu</p>'; }
      }, 0);
      sumContent = `<div id="${sumMenuId}"><p style="color:#999">Chargement du menu…</p></div>`;
    } else if (useMenu) {
      sumContent = '<p style="color:#999">Aucun menu sélectionné</p>';
    } else {
      const customItems = Array.isArray(d.custom_menu) ? d.custom_menu : [];
      if (customItems.length) {
        sumContent = '<ul class="menu">' + customItems.map(item => {
          const links = Array.isArray(item.links) ? item.links : [];
          return `<li class="menu-item sub">${item.title ? `<p class="title">${escapeHtml(item.title)}</p>` : ''}${links.length ? '<ul class="sub-menu">' + links.map(l => {
            const lk = l.link || {};
            return `<li class="menu-item"><a href="#">${escapeHtml(lk.title || lk.url || '')}</a></li>`;
          }).join('') + '</ul>' : ''}</li>`;
        }).join('') + '</ul>';
      } else {
        sumContent = '<p style="color:#999">Aucun lien personnalisé</p>';
      }
    }
    if (!moduleTemplateCache['summary']) queueModuleTemplateLoad('summary');
    return `<div class="module module-summary ${sumCls}" style="position:relative;"><div class="container">${sumTitleHtml}${sumContent}</div></div>`;
  }
  // ReusableBloc — fetch bloc content and render sub-blocks
  if (block.type === 'reusable-bloc' || block.type === 'ReusableBloc') {
    const blocId = d.bloc_id;
    const rbPreviewId = 'rb-preview-' + (block.id || Math.random().toString(36).slice(2));
    if (!blocId) {
      return `<div class="module module-reusable-bloc" style="padding:40px 20px;text-align:center;opacity:0.5;">Aucun bloc réutilisable sélectionné</div>`;
    }
    setTimeout(async () => {
      const el = document.getElementById(rbPreviewId);
      if (!el) return;
      try {
        const bloc = await apiFetch(`/reusable-blocs/${blocId}`);
        if (!bloc || !bloc.content) {
          el.innerHTML = '<p style="text-align:center;opacity:0.5;">Bloc réutilisable vide</p>';
          return;
        }
        let subBlocks;
        try { subBlocks = typeof bloc.content === 'string' ? JSON.parse(bloc.content) : bloc.content; } catch (e) { subBlocks = []; }
        if (!Array.isArray(subBlocks) || subBlocks.length === 0) {
          el.innerHTML = '<p style="text-align:center;opacity:0.5;">Bloc réutilisable vide</p>';
          return;
        }
        let html = '';
        for (const sub of subBlocks) {
          try {
            const subHtml = replaceEmptyImages(renderBlockPreviewHtml(sub));
            if (subHtml) html += subHtml;
          } catch (e) { console.warn('ReusableBloc sub-block render error:', e); }
        }
        el.innerHTML = html || '<p style="text-align:center;opacity:0.5;">Aucun aperçu disponible</p>';
      } catch (e) {
        el.innerHTML = '<p style="text-align:center;color:red;">Erreur: ' + escapeHtml(e.message) + '</p>';
      }
    }, 50);
    return `<div class="module module-reusable-bloc"><div id="${rbPreviewId}"><p style="text-align:center;opacity:0.5;">Chargement du bloc réutilisable…</p></div></div>`;
  }
  // BlocReferences — live preview from server-side render
  if (block.type === 'bloc-references' || block.type === 'BlocReferences') {
    const refCls = [d.bloc_color || '', d.padding_top || '', d.padding_bottom || ''].filter(Boolean).join(' ');
    const refId = 'ref-preview-' + (block.id || Math.random().toString(36).slice(2));
    const refTitle = d.title_bloc || d.title || '';
    const refTitleStyle = d.title_style || '2';
    const refTitleAlign = d.title_align || 'center';
    const refTitleHtml = refTitle ? `<h${refTitleStyle} class="title-module title-section-${refTitleStyle} align-${escapeHtml(String(refTitleAlign))}">${escapeHtml(String(refTitle))}</h${refTitleStyle}>` : '';
    let refBgHtml = '';
    const refBgExtraCls = [];
    const refBgImg = d.bg_img;
    if (refBgImg) {
      const bgUrl = typeof refBgImg === 'string' ? refBgImg : (refBgImg.url || '');
      const bgOpacity = (d.bg_opacity ?? 10) / 100;
      if (bgUrl) {
        refBgHtml = `<div class="background" style="background-image: url(${escapeHtml(bgUrl)}); opacity: ${bgOpacity}; background-size: cover; background-position: center; position: absolute; inset: 0;"></div>`;
        refBgExtraCls.push('has-background-image');
      }
    }
    if (!moduleTemplateCache['references']) queueModuleTemplateLoad('references');
    setTimeout(async () => {
      const el = document.getElementById(refId);
      if (!el || el.dataset.loaded) return;
      el.dataset.loaded = '1';
      try {
        const res = await apiFetch('/render-block', { method: 'POST', body: JSON.stringify({ type: 'bloc-references', data: d }) });
        if (res.html) el.innerHTML = res.html;
        else el.innerHTML = '<p style="text-align:center;opacity:0.6;">Aucune référence à afficher</p>';
      } catch (e) {
        el.innerHTML = '<p style="text-align:center;color:red;">Erreur: ' + escapeHtml(e.message) + '</p>';
      }
    }, 50);
    return `<div class="module module-references ${escapeHtml(refCls)} ${refBgExtraCls.join(' ')}" style="position:relative;">${refBgHtml}<div class="container-large">${refTitleHtml}<div id="${refId}"><p style="text-align:center;opacity:0.5;">Chargement des références…</p></div></div></div>`;
  }
  // GoogleReviews — live preview from plugin API
  if (block.type === 'google-reviews' || block.type === 'GoogleReviews') {
    const grCls = [d.bloc_color || '', d.padding_top || '', d.padding_bottom || ''].filter(Boolean).join(' ');
    const grId = 'gr-preview-' + (block.id || Math.random().toString(36).slice(2));
    const grTitle = d.title_bloc || d.title || '';
    const grTitleStyle = d.title_style || '2';
    const grTitleAlign = d.title_align || 'center';
    const grTitleHtml = grTitle ? `<h${grTitleStyle} class="title-module title-section-${grTitleStyle} align-${escapeHtml(String(grTitleAlign))}">${escapeHtml(String(grTitle))}</h${grTitleStyle}>` : '';
    let grBgHtml = '';
    const grBgExtraCls = [];
    const grBgImg = d.bg_img;
    if (grBgImg) {
      const bgUrl = typeof grBgImg === 'string' ? grBgImg : (grBgImg.url || '');
      const bgOpacity = (d.bg_opacity ?? 10) / 100;
      if (bgUrl) {
        grBgHtml = `<div class="background" style="background-image: url(${escapeHtml(bgUrl)}); opacity: ${bgOpacity}; background-size: cover; background-position: center; position: absolute; inset: 0;"></div>`;
        grBgExtraCls.push('has-background-image');
      }
    }
    setTimeout(async () => {
      const el = document.getElementById(grId);
      if (!el || el.dataset.loaded) return;
      el.dataset.loaded = '1';
      try {
        const res = await apiFetch('/render-block', { method: 'POST', body: JSON.stringify({ type: 'google-reviews', data: d }) });
        if (res.html) el.innerHTML = res.html;
        else el.innerHTML = '<p style="text-align:center;opacity:0.6;">Aucun aperçu disponible</p>';
      } catch (e) {
        el.innerHTML = '<p style="text-align:center;color:red;">Erreur: ' + escapeHtml(e.message) + '</p>';
      }
    }, 50);
    return `<div class="module module-google-reviews ${escapeHtml(grCls)} ${grBgExtraCls.join(' ')}" style="position:relative;">${grBgHtml}<div class="container-large">${grTitleHtml}<div id="${grId}"><p style="text-align:center;opacity:0.5;">Chargement des avis Google…</p></div></div></div>`;
  }
  const layout = getModuleLayout(block);
  if (!layout) return '';
  const cached = moduleTemplateCache[layout];
  if (!cached) {
    queueModuleTemplateLoad(layout);
    return `<div class="preview-loading">Chargement du rendu…</div>`;
  }
  if (cached._error) {
    return `<div class="preview-loading" style="color:#c00;">Erreur : impossible de charger le template « ${escapeHtml(layout)} »</div>`;
  }
  let ctx, html;
  try {
    ctx = buildTemplateContext(block);
    html = renderBladeTemplate(cached.template, ctx);
  } catch (e) {
    console.error(`[PreviewRender] Error rendering block type="${block.type}" layout="${layout}":`, e);
    return `<div class="preview-loading" style="color:#c00;">Erreur de rendu (${escapeHtml(layout)}). Voir la console.</div>`;
  }
  // S'assurer que les classes calculées (bloc_color, padding_top, etc.)
  // sont bien appliquées au wrapper .module, même si l'expression Blade
  // originale n'est pas parfaitement interprétée par notre moteur.
  if (ctx.classes) {
    html = html.replace(/class="module([^"]*)"/, (match, rest) => {
      const existing = rest.trim();
      // éviter les doublons si les classes sont déjà présentes
      const toAdd = ctx.classes;
      return existing
        ? `class="module${rest} ${toAdd}"`
        : `class="module ${toAdd}"`;
    });
  }
  // Remplacer les &nbsp; par des espaces normaux pour permettre le retour
  // à la ligne naturel entre les mots dans la prévisualisation
  html = html.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');
  // Nettoyer les .txt.editor vides (supprimer le whitespace interne)
  // pour que le pseudo-élément CSS :empty::before affiche le placeholder
  html = html.replace(/<div class="txt editor">\s*<\/div>/g, '<div class="txt editor"></div>');
  return html;
}

// ── Drag & drop ─────────────────────────────────────────────────────────────

function getDropInsertIndex(mouseY) {
  const cards = Array.from(document.querySelectorAll('.builder-block-card'));
  if (cards.length === 0) return pageBuilderState.blocks.length;
  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i].getBoundingClientRect();
    if (mouseY < rect.top + rect.height / 2) {
      const id = cards[i].dataset.blockId;
      const idx = pageBuilderState.blocks.findIndex(b => b.id === id);
      return idx >= 0 ? idx : i;
    }
  }
  return pageBuilderState.blocks.length;
}

function handleBuilderDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  clearDropIndicators();
  const canvas = document.getElementById('builderCanvas');
  if (canvas) canvas.classList.remove('builder-drag-over');
  let raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
  try {
    const payload = typeof raw === 'string' ? JSON.parse(raw) : null;
    if (!payload) return;
    if (payload.type === 'new' && payload.blockType && BLOCK_TYPES[payload.blockType]) {
      const def = BLOCK_TYPES[payload.blockType];
      const block = { id: blockId(), type: payload.blockType, data: { ...def.defaultData } };
      const insertAt = getDropInsertIndex(e.clientY);
      pageBuilderState.blocks.splice(insertAt, 0, block);
      markBuilderDirty();
      rebuildBuilderBlocksDOM();
      reattachBlockCardListeners();
      selectBlock(block.id);
      return;
    }
    if (payload.type === 'move' && payload.blockId) {
      const idx = pageBuilderState.blocks.findIndex(b => b.id === payload.blockId);
      if (idx < 0) return;
      const [block] = pageBuilderState.blocks.splice(idx, 1);
      const insertAt = getDropInsertIndex(e.clientY);
      pageBuilderState.blocks.splice(insertAt, 0, block);
      markBuilderDirty();
      rebuildBuilderBlocksDOM();
      reattachBlockCardListeners();
    }
  } catch (err) {}
}

function handleBuilderDragover(e) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'copy';
  const canvas = document.getElementById('builderCanvas');
  if (canvas) canvas.classList.add('builder-drag-over');
}

function handleBuilderDragleave(e) {
  const canvas = document.getElementById('builderCanvas');
  if (!canvas) return;
  const related = e.relatedTarget;
  if (related && canvas.contains(related)) return;
  canvas.classList.remove('builder-drag-over');
}

function attachPageBuilderListeners() {
  const canvas = document.getElementById('builderCanvas');
  const blocksEl = document.getElementById('builderBlocks');
  const placeholder = document.getElementById('builderPlaceholder');

  if (canvas && blocksEl) {
    document.querySelectorAll('.builder-module-item').forEach(el => {
      el.addEventListener('dragstart', e => {
        const payload = { type: 'new', blockType: el.dataset.blockType };
        const str = JSON.stringify(payload);
        e.dataTransfer.setData('application/json', str);
        e.dataTransfer.setData('text/plain', str);
        e.dataTransfer.effectAllowed = 'copy';
      });
    });

    reattachBlockCardListeners();

    canvas.addEventListener('dragover', handleBuilderDragover);
    canvas.addEventListener('dragleave', handleBuilderDragleave);
    canvas.addEventListener('drop', handleBuilderDrop);
    blocksEl.addEventListener('dragover', handleBuilderDragover);
    blocksEl.addEventListener('drop', handleBuilderDrop);
    if (placeholder) {
      placeholder.addEventListener('dragover', handleBuilderDragover);
      placeholder.addEventListener('drop', handleBuilderDrop);
    }
  }

  document.querySelectorAll('.builder-meta input, .builder-meta select, .builder-title, .builder-slug, .builder-status').forEach(el => {
    const field = el.dataset?.field || (el.classList.contains('builder-title') ? 'title' : el.classList.contains('builder-slug') ? 'slug' : null);
    if (!field) return;
    el.addEventListener('input', () => syncBuilderMetaFromDOM());
    el.addEventListener('change', () => syncBuilderMetaFromDOM());
  });

  // Auto-generate slug from title
  const builderTitleInput = document.querySelector('.builder-title');
  const builderSlugInput = document.querySelector('.builder-slug');
  let _slugManuallyEdited = false;
  if (builderTitleInput && builderSlugInput) {
    // Only block auto-slug if the user manually edits the slug field
    builderSlugInput.addEventListener('input', () => { _slugManuallyEdited = true; });
    builderTitleInput.addEventListener('input', () => {
      if (_slugManuallyEdited) return;
      generateBuilderSlug();
    });
  }

  // No more .builder-parent in header — parent_id derived from primary menu

  // CPT builder sidebar: init Address fields (Mapbox geocoding)
  document.querySelectorAll('.builder-sidebar .cpt-address-field').forEach(el => {
    initGoogleMapField(el.id);
  });

  // CPT builder sidebar: toggle switches
  document.querySelectorAll('.builder-sidebar .cpt-toggle').forEach(wrapper => {
    const cb = wrapper.querySelector('input[type="checkbox"]');
    if (!cb) return;
    const track = wrapper.querySelector('.cpt-toggle-track');
    const thumb = wrapper.querySelector('.cpt-toggle-thumb');
    const lbl = wrapper.querySelector('.cpt-toggle-label');
    function sync() {
      if (track) track.style.background = cb.checked ? 'var(--primary,#224f5a)' : '#ccc';
      if (thumb) thumb.style.left = cb.checked ? '22px' : '2px';
      if (lbl) lbl.textContent = cb.checked ? 'Oui' : 'Non';
    }
    cb.addEventListener('change', sync);
  });

  // CPT builder sidebar: tab switching (Contenu / Modules)
  document.querySelectorAll('.cpt-builder-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.cpt-builder-tab').forEach(b => {
        const isActive = b.dataset.tab === tab;
        b.classList.toggle('active', isActive);
        b.style.borderBottomColor = isActive ? 'var(--primary,#224f5a)' : 'transparent';
        b.style.color = isActive ? 'var(--primary,#224f5a)' : '#999';
      });
      document.querySelectorAll('.cpt-builder-tab-content').forEach(c => {
        c.style.display = c.dataset.tab === tab ? '' : 'none';
      });
    });
  });

  // CPT builder sidebar: link page selectors
  document.querySelectorAll('.builder-sidebar .cpt-link-page-select').forEach(sel => {
    const targetId = sel.dataset.target;
    if (!targetId) return;
    const urlInput = document.getElementById(targetId);
    if (urlInput) {
      sel.addEventListener('change', () => { if (sel.value) urlInput.value = sel.value; });
    }
  });

  // ── Accordion toggle avec slideUp/slideDown (reproduit le JS Nickl) ──
  const adminSlideProp = 'height 400ms ease, padding 400ms ease';

  function adminSlideDown(el, duration) {
    if (!el || !el.classList.contains('txt')) return;
    if (el._slideTimer) { clearTimeout(el._slideTimer); el._slideTimer = null; }
    el.style.transition = 'none';
    el.style.display = 'block';
    el.style.overflow = 'hidden';
    el.style.paddingTop = '0px';
    el.style.paddingBottom = '0px';
    el.style.height = '0px';
    el.offsetHeight;
    el.style.paddingTop = '';
    el.style.paddingBottom = '';
    el.style.height = '';
    const cs = getComputedStyle(el);
    const targetH = el.scrollHeight;
    const targetPT = cs.paddingTop;
    const targetPB = cs.paddingBottom;
    el.style.height = '0px';
    el.style.paddingTop = '0px';
    el.style.paddingBottom = '0px';
    el.offsetHeight;
    el.style.transition = adminSlideProp;
    el.style.height = targetH + 'px';
    el.style.paddingTop = targetPT;
    el.style.paddingBottom = targetPB;
    el._slideTimer = setTimeout(() => {
      el._slideTimer = null;
      el.style.height = '';
      el.style.overflow = '';
      el.style.transition = '';
      el.style.paddingTop = '';
      el.style.paddingBottom = '';
    }, duration);
  }

  function adminSlideUp(el, duration) {
    if (!el || !el.classList.contains('txt')) return;
    if (el._slideTimer) { clearTimeout(el._slideTimer); el._slideTimer = null; }
    el.style.transition = 'none';
    el.style.overflow = 'hidden';
    el.style.height = el.scrollHeight + 'px';
    el.offsetHeight;
    el.style.transition = adminSlideProp;
    el.style.height = '0px';
    el.style.paddingTop = '0px';
    el.style.paddingBottom = '0px';
    el._slideTimer = setTimeout(() => {
      el._slideTimer = null;
      el.style.display = 'none';
      el.style.height = '';
      el.style.overflow = '';
      el.style.transition = '';
      el.style.paddingTop = '';
      el.style.paddingBottom = '';
    }, duration);
  }

  // ── Accordion : click on title text → inline editing ──
  canvas.addEventListener('click', (e) => {
    const titleText = e.target.closest('.accordion-title-text');
    if (!titleText) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const card = titleText.closest('.builder-block-card');
    if (!card) return;
    const blockId = card.dataset.blockId;
    const block = pageBuilderState.blocks.find(b => b.id === blockId);
    if (!block) return;
    const allTitleTexts = Array.from(card.querySelectorAll('.builder-block-render .accordion .accordion-title-text'));
    const idx = allTitleTexts.indexOf(titleText);
    if (idx === -1 || !Array.isArray(block.data.accordions) || !block.data.accordions[idx]) return;
    if (selectedBlockId !== blockId) selectBlock(blockId);
    enableInlineEditing(blockId, titleText, block.data.accordions[idx], 'title');
  });

  // ── Accordion : add item button ──
  canvas.addEventListener('click', (e) => {
    const addBtn = e.target.closest('.accordion-add-btn');
    if (!addBtn) return;
    e.preventDefault();
    e.stopPropagation();
    const card = addBtn.closest('.builder-block-card');
    if (!card) return;
    const blockId = card.dataset.blockId;
    const block = pageBuilderState.blocks.find(b => b.id === blockId);
    if (!block) return;
    if (!Array.isArray(block.data.accordions)) block.data.accordions = [];
    block.data.accordions.push({ title: 'Nouvel élément', text: '' });
    updateBlockCardPreview(blockId);
    if (selectedBlockId === blockId) renderBlockSettings();
  });

  canvas.addEventListener('click', (e) => {
    const btn = e.target.closest('.js_toggle-accordion');
    if (!btn) return;
    // Skip toggle if title is being edited inline
    if (btn.getAttribute('contenteditable') === 'true') return;
    e.preventDefault();
    e.stopPropagation();
    const accordion = btn.closest('.accordion');
    if (!accordion) return;
    const speed = 400;
    const targetTxt = btn.nextElementSibling;

    if (btn.classList.contains('active')) {
      btn.classList.remove('active');
      btn.blur();
      adminSlideUp(targetTxt, speed);
    } else {
      accordion.querySelectorAll('.title').forEach(t => {
        if (t === btn) return;
        t.classList.remove('active');
        const next = t.nextElementSibling;
        if (next && next.classList.contains('txt')) adminSlideUp(next, speed);
      });
      btn.classList.add('active');
      adminSlideDown(targetTxt, speed);
    }
  });

  // ── Parallax background dans la preview ──
  function initAdminParallax() {
    const mods = canvas.querySelectorAll('.module.has-background-image.background-parallax');
    if (mods.length === 0) return;
    function update() {
      const wh = window.innerHeight;
      mods.forEach(mod => {
        const rect = mod.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > wh) return;
        const bg = mod.querySelector('.background');
        if (!bg) return;
        const progress = (wh - rect.top) / (wh + rect.height);
        bg.style.transform = 'translateY(' + (progress * 25) + '%)';
      });
      requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }
  initAdminParallax();

  updateBuilderPlaceholder();
  renderBlockSettings();
  initPreviewScaling();
  initBuilderSidebarResize();
}

// ── Resizable builder sidebar ───────────────────────────────────────────────
function initBuilderSidebarResize() {
  const handle = document.getElementById('builderSidebarResize');
  const sidebar = handle?.closest('.builder-sidebar');
  if (!handle || !sidebar) return;

  const MIN_W = 280;
  const MAX_W = 700;
  const saved = localStorage.getItem('builderSidebarWidth');
  if (saved) {
    const w = Math.min(MAX_W, Math.max(MIN_W, parseInt(saved, 10)));
    sidebar.style.setProperty('--builder-sidebar-width', w + 'px');
  }

  let startX = 0, startW = 0;

  function onMove(e) {
    const dx = (e.clientX || e.touches?.[0]?.clientX || 0) - startX;
    const w = Math.min(MAX_W, Math.max(MIN_W, startW + dx));
    sidebar.style.setProperty('--builder-sidebar-width', w + 'px');
  }

  function onUp() {
    document.body.classList.remove('builder-resizing');
    handle.classList.remove('is-dragging');
    const w = parseInt(getComputedStyle(sidebar).width, 10);
    localStorage.setItem('builderSidebarWidth', w);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
    applyPreviewScaling();
  }

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    startX = e.clientX;
    startW = sidebar.getBoundingClientRect().width;
    document.body.classList.add('builder-resizing');
    handle.classList.add('is-dragging');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  handle.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startW = sidebar.getBoundingClientRect().width;
    document.body.classList.add('builder-resizing');
    handle.classList.add('is-dragging');
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onUp);
  }, { passive: true });

  // Double-click → reset to default
  handle.addEventListener('dblclick', () => {
    sidebar.style.removeProperty('--builder-sidebar-width');
    localStorage.removeItem('builderSidebarWidth');
    applyPreviewScaling();
  });
}

// ── Preview scaling ─────────────────────────────────────────────────────────
// Renders each .builder-block-render at the real frontend width (--preview-width)
// then scales it down to fit inside the canvas. The wrapper card height is
// adjusted so that no content is clipped.

const PREVIEW_FRONT_WIDTH = 1430; // must match --preview-width in CSS

let _previewResizeObserver = null;

function initPreviewScaling() {
  const canvas = document.getElementById('builderCanvas');
  if (!canvas) return;
  if (_previewResizeObserver) _previewResizeObserver.disconnect();
  window._previewResizeObserver = new ResizeObserver(() => applyPreviewScaling());
  _previewResizeObserver = window._previewResizeObserver;
  _previewResizeObserver.observe(canvas);
  applyPreviewScaling();
}

function applyPreviewScaling() {
  const canvas = document.getElementById('builderCanvas');
  if (!canvas) return;
  const canvasWidth = canvas.clientWidth;
  const scale = Math.min(1, canvasWidth / PREVIEW_FRONT_WIDTH);
  document.querySelectorAll('.builder-block-render').forEach(el => {
    el.style.width = PREVIEW_FRONT_WIDTH + 'px';
    el.style.zoom = scale;
  });
}

function syncBuilderMetaFromDOM() {
  const get = (sel, attr) => { const e = document.querySelector(sel); return e ? (attr ? e[attr] : e.value) : null; };
  const oldTitle = pageBuilderState.meta.title;
  const oldSlug = pageBuilderState.meta.slug;
  const oldStatus = pageBuilderState.meta.status;
  pageBuilderState.meta.title = get('.builder-title') || get('input[data-field="title"]') || '';
  pageBuilderState.meta.slug = get('.builder-slug') || get('input[data-field="slug"]') || '';
  pageBuilderState.meta.status = get('.builder-status') || get('select[data-field="status"]') || 'draft';

  // Resolve published_date from mode + date input
  const mode = get('.builder-publish-mode') || 'now';
  const dateVal = get('.builder-publish-date') || '';
  if (pageBuilderState.meta.status === 'draft') {
    pageBuilderState.meta.published_date = null;
  } else if (mode === 'now') {
    pageBuilderState.meta.published_date = null; // backend auto-sets to now
  } else if (dateVal) {
    pageBuilderState.meta.published_date = dateVal.includes('T') ? dateVal.replace('T', ' ') + ':00' : dateVal;
  } else {
    pageBuilderState.meta.published_date = null;
  }

  if (pageBuilderState.meta.title !== oldTitle || pageBuilderState.meta.slug !== oldSlug || pageBuilderState.meta.status !== oldStatus) {
    markBuilderDirty();
  }

  // show_in_menu derived from menu toggles
  const anyMenuChecked = document.querySelectorAll('.menu-toggle-cb:checked').length > 0;
  pageBuilderState.meta.show_in_menu = anyMenuChecked;

  // parent_id derived from primary menu hierarchy
  pageBuilderState.meta.parent_id = derivePrimaryParentPageId();
  pageBuilderState.meta.menu_order = 0;
}

// ── Builder status + blocks DOM ─────────────────────────────────────────────

function onBuilderStatusChange(status) {
  const btn = document.querySelector('.builder-menu-settings-btn');
  if (btn) {
    btn.style.display = status === 'draft' ? 'none' : '';
  }
  // If switching to draft, close the menu settings panel
  if (status === 'draft') {
    toggleMenuSettingsPanel(false);
  }
  // Show/hide publish date group
  const dateGroup = document.querySelector('.builder-publish-date-group');
  if (dateGroup) {
    dateGroup.style.display = status === 'draft' ? 'none' : '';
  }
}

function onPublishModeChange(mode) {
  const dateInput = document.querySelector('.builder-publish-date');
  if (!dateInput) return;
  if (mode === 'now') {
    dateInput.style.display = 'none';
    dateInput.value = '';
  } else {
    dateInput.style.display = '';
    if (!dateInput.value) {
      const now = new Date();
      if (mode === 'schedule') {
        now.setDate(now.getDate() + 1);
      }
      dateInput.value = now.toISOString().slice(0, 16);
    }
  }
}

function updateBuilderPlaceholder() {
  const hasBlocks = pageBuilderState.blocks.length > 0;
  const ph = document.getElementById('builderPlaceholder');
  if (ph) ph.style.display = hasBlocks ? 'none' : 'block';
  const tb = document.getElementById('builderToolbar');
  if (tb) tb.style.display = hasBlocks ? '' : 'none';
}

function updateBuilderParallax() {
  const canvas = document.getElementById('builderCanvas');
  if (!canvas) return;
  const canvasRect = canvas.getBoundingClientRect();
  const viewportH = canvasRect.height;
  document.querySelectorAll('.builder-block-render .module.background-parallax.has-background-image').forEach(module => {
    const bg = module.querySelector('.background');
    if (!bg) return;
    const rect = module.getBoundingClientRect();
    // Position du module relative au canvas visible
    const relTop = rect.top - canvasRect.top;
    // progress: 0 quand le module entre par le bas, 1 quand il sort par le haut
    const progress = Math.max(0, Math.min(1, (viewportH - relTop) / (viewportH + rect.height)));
    bg.style.transform = `translateY(${progress * 25}%)`;
  });
}

let _parallaxListenerAdded = false;
function initBuilderParallax() {
  if (!_parallaxListenerAdded) {
    const canvas = document.getElementById('builderCanvas');
    if (canvas) canvas.addEventListener('scroll', updateBuilderParallax, { passive: true });
    window._parallaxListenerAdded = true;
    _parallaxListenerAdded = true;
  }
  updateBuilderParallax();
}

function renderInsertButton(index) {
  return `<div class="builder-insert-between" data-insert-index="${index}"><button type="button" class="builder-insert-btn" title="Insérer un bloc ici"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button></div>`;
}

function renderBlocksWithInsertButtons(blocks) {
  let visibleNum = 0;
  const parts = [];
  blocks.forEach((block, i) => {
    if (INACTIVE_PLUGIN_TYPES.has(block.type)) return;
    visibleNum++;
    parts.push(renderBlockCard(block, visibleNum));
    parts.push(renderInsertButton(i));
  });
  return parts.join('');
}

function rebuildBuilderBlocksDOM() {
  const blocksEl = document.getElementById('builderBlocks');
  if (!blocksEl) return;
  blocksEl.innerHTML = renderBlocksWithInsertButtons(pageBuilderState.blocks);
  pageBuilderState.blocks.forEach(block => {
    const card = blocksEl.querySelector(`[data-block-id="${block.id}"]`);
    if (!card) return;
    const richEl = card.querySelector('.builder-block-render');
    if (richEl) syncModulePaddingClasses(richEl, block.data);
  });
  reattachBlockCardListeners();
  updateBuilderPlaceholder();
  updateSelectedBlockCard();
  initBuilderParallax();
  applyPreviewScaling();
}

function clearDropIndicators() {
  document.querySelectorAll('.builder-block-card').forEach(c => c.classList.remove('drop-before', 'drop-after'));
}

function reattachBlockCardListeners() {
  document.querySelectorAll('.builder-block-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea') || e.target.closest('select') || e.target.closest('[contenteditable="true"]')) return;
      e.stopPropagation();
      e.dataTransfer.setData('application/json', JSON.stringify({ type: 'move', blockId: card.dataset.blockId }));
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => card.classList.add('is-dragging'), 0);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      clearDropIndicators();
      document.getElementById('builderCanvas')?.classList.remove('builder-drag-over');
    });

    card.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      clearDropIndicators();
      const rect = card.getBoundingClientRect();
      const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      card.classList.add(position === 'before' ? 'drop-before' : 'drop-after');
    });

    card.addEventListener('dragleave', e => {
      if (e.relatedTarget && card.contains(e.relatedTarget)) return;
      card.classList.remove('drop-before', 'drop-after');
    });

    card.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      clearDropIndicators();
      document.getElementById('builderCanvas')?.classList.remove('builder-drag-over');
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      try {
        const payload = raw ? JSON.parse(raw) : null;
        if (!payload) return;
        const targetId = card.dataset.blockId;
        const rect = card.getBoundingClientRect();
        const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
        if (payload.type === 'new' && payload.blockType && BLOCK_TYPES[payload.blockType]) {
          const def = BLOCK_TYPES[payload.blockType];
          const newBlock = { id: blockId(), type: payload.blockType, data: { ...def.defaultData } };
          const targetIdx = pageBuilderState.blocks.findIndex(b => b.id === targetId);
          pageBuilderState.blocks.splice(position === 'before' ? targetIdx : targetIdx + 1, 0, newBlock);
          markBuilderDirty();
          rebuildBuilderBlocksDOM();
          selectBlock(newBlock.id);
        } else if (payload.type === 'move' && payload.blockId && payload.blockId !== targetId) {
          const fromIdx = pageBuilderState.blocks.findIndex(b => b.id === payload.blockId);
          const toIdx = pageBuilderState.blocks.findIndex(b => b.id === targetId);
          if (fromIdx < 0 || toIdx < 0) return;
          const [moved] = pageBuilderState.blocks.splice(fromIdx, 1);
          const newToIdx = pageBuilderState.blocks.findIndex(b => b.id === targetId);
          pageBuilderState.blocks.splice(position === 'before' ? newToIdx : newToIdx + 1, 0, moved);
          markBuilderDirty();
          rebuildBuilderBlocksDOM();
        }
      } catch (err) {}
    });

    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      if (e.target.closest('[contenteditable="true"]')) return;
      const blockId = card.dataset.blockId;

      // Detect click on .txt.editor area → enable inline editing
      const txtTarget = e.target.closest('.txt.editor');
      if (txtTarget && card.querySelector('.builder-block-render')?.contains(txtTarget)) {
        const block = pageBuilderState.blocks.find(b => b.id === blockId);
        if (block) {
          const def = BLOCK_TYPES[block.type] || {};
          const moduleName = def.moduleName || block.type;

          // Direct TextSimple block
          if (moduleName === 'TextSimple') {
            if (selectedBlockId !== blockId) selectBlock(blockId);
            enableInlineEditing(blockId);
            return;
          }

          // Direct TextImage block
          if (moduleName === 'TextImage') {
            if (selectedBlockId !== blockId) selectBlock(blockId);
            enableInlineEditing(blockId, txtTarget, block.data);
            return;
          }

          // Direct HeadText block
          if (moduleName === 'HeadText') {
            if (selectedBlockId !== blockId) selectBlock(blockId);
            enableInlineEditing(blockId, txtTarget, block.data);
            return;
          }

          // Accordion block — find which accordion item was clicked
          if (moduleName === 'Accordion') {
            const allTxtEditors = Array.from(card.querySelectorAll('.builder-block-render .accordion .txt.editor'));
            const idx = allTxtEditors.indexOf(txtTarget);
            if (idx !== -1 && Array.isArray(block.data.accordions) && block.data.accordions[idx]) {
              if (selectedBlockId !== blockId) selectBlock(blockId);
              enableInlineEditing(blockId, txtTarget, block.data.accordions[idx]);
              return;
            }
          }

          // SliderTextVideo block — find which slide was clicked
          if (moduleName === 'SliderTextVideo') {
            const allTxtEditors = Array.from(card.querySelectorAll('.builder-block-render .swiper-slide .txt.editor'));
            const idx = allTxtEditors.indexOf(txtTarget);
            if (idx !== -1 && Array.isArray(block.data.slider) && block.data.slider[idx]) {
              if (selectedBlockId !== blockId) selectBlock(blockId);
              enableInlineEditing(blockId, txtTarget, block.data.slider[idx], 'desc');
              return;
            }
          }

          // TextSimple sub-module inside ColumnsTab
          if (moduleName === 'ColumnsTab') {
            // Find which .module-text contains this .txt.editor
            const moduleText = txtTarget.closest('.module-text');
            if (moduleText) {
              const dataRef = _findColumnsSubModuleData(block, moduleText, card);
              if (dataRef) {
                if (selectedBlockId !== blockId) selectBlock(blockId);
                enableInlineEditing(blockId, txtTarget, dataRef);
                return;
              }
            }
          }
        }
      }

      selectBlock(blockId);
    });
  });
  // Attach insert-between button listeners
  document.querySelectorAll('.builder-insert-between').forEach(wrapper => {
    const btn = wrapper.querySelector('.builder-insert-btn');
    if (btn) {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const insertIndex = parseInt(wrapper.dataset.insertIndex, 10);
        window._pendingInsertIndex = insertIndex;
        deselectBlock();
      });
    }
    wrapper.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      wrapper.style.opacity = '1';
      wrapper.style.height = '24px';
    });
    wrapper.addEventListener('dragleave', () => {
      wrapper.style.opacity = '';
      wrapper.style.height = '';
    });
    wrapper.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      wrapper.style.opacity = '';
      wrapper.style.height = '';
      clearDropIndicators();
      document.getElementById('builderCanvas')?.classList.remove('builder-drag-over');
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      try {
        const payload = raw ? JSON.parse(raw) : null;
        if (!payload) return;
        const insertIndex = parseInt(wrapper.dataset.insertIndex, 10);
        if (payload.type === 'new' && payload.blockType && BLOCK_TYPES[payload.blockType]) {
          const def = BLOCK_TYPES[payload.blockType];
          const newBlock = { id: blockId(), type: payload.blockType, data: { ...def.defaultData } };
          pageBuilderState.blocks.splice(insertIndex + 1, 0, newBlock);
          markBuilderDirty();
          rebuildBuilderBlocksDOM();
          selectBlock(newBlock.id);
        } else if (payload.type === 'move' && payload.blockId) {
          const fromIdx = pageBuilderState.blocks.findIndex(b => b.id === payload.blockId);
          if (fromIdx < 0) return;
          const [moved] = pageBuilderState.blocks.splice(fromIdx, 1);
          const adjustedIdx = insertIndex >= fromIdx ? insertIndex : insertIndex + 1;
          pageBuilderState.blocks.splice(adjustedIdx, 0, moved);
          markBuilderDirty();
          rebuildBuilderBlocksDOM();
        }
      } catch (err) {}
    });
  });
  updateSelectedBlockCard();
}

// ── Block CRUD + filter ─────────────────────────────────────────────────────

function filterBuilderModules(query) {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  document.querySelectorAll('.builder-modules-list .builder-module-category').forEach(cat => {
    const items = cat.querySelectorAll('.builder-module-item');
    let visibleCount = 0;
    items.forEach(item => {
      const label = (item.textContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const match = !q || label.includes(q);
      item.style.display = match ? '' : 'none';
      if (match) visibleCount++;
    });
    cat.style.display = visibleCount > 0 ? '' : 'none';
  });
}

function addBlockByClick(blockType, insertAfterIndex) {
  if (!BLOCK_TYPES[blockType]) return;
  const def = BLOCK_TYPES[blockType];
  const block = { id: blockId(), type: blockType, data: { ...def.defaultData } };
  const pendingIdx = window._pendingInsertIndex;
  if (typeof insertAfterIndex === 'number' && insertAfterIndex >= 0) {
    pageBuilderState.blocks.splice(insertAfterIndex + 1, 0, block);
  } else if (typeof pendingIdx === 'number' && pendingIdx >= 0) {
    pageBuilderState.blocks.splice(pendingIdx + 1, 0, block);
  } else if (selectedBlockId) {
    const idx = pageBuilderState.blocks.findIndex(b => b.id === selectedBlockId);
    if (idx >= 0) {
      pageBuilderState.blocks.splice(idx + 1, 0, block);
    } else {
      pageBuilderState.blocks.push(block);
    }
  } else {
    pageBuilderState.blocks.push(block);
  }
  window._pendingInsertIndex = undefined;
  markBuilderDirty();
  rebuildBuilderBlocksDOM();
  reattachBlockCardListeners();
  editBlock(block.id);
}

function editBlock(id) {
  selectBlock(id);
}

function duplicateBlock(id) {
  const idx = pageBuilderState.blocks.findIndex(b => b.id === id);
  if (idx === -1) return;
  const original = pageBuilderState.blocks[idx];
  const copy = { type: original.type, id: blockId(), data: JSON.parse(JSON.stringify(original.data || {})) };
  pageBuilderState.blocks.splice(idx + 1, 0, copy);
  markBuilderDirty();
  rebuildBuilderBlocksDOM();
  selectBlock(copy.id);
  const newCard = document.querySelector(`.builder-block-card[data-block-id="${copy.id}"]`);
  if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function removeBlock(id) {
  pageBuilderState.blocks = pageBuilderState.blocks.filter(b => b.id !== id);
  markBuilderDirty();
  rebuildBuilderBlocksDOM();
  if (selectedBlockId === id) {
    deselectBlock();
  }
}

async function removeAllBlocks() {
  if (!pageBuilderState.blocks.length) return;
  if (!await confirmModal('Supprimer tous les blocs ?')) return;
  pageBuilderState.blocks = [];
  markBuilderDirty();
  rebuildBuilderBlocksDOM();
  deselectBlock();
}

function updateSelectedBlockCard() {
  document.querySelectorAll('.builder-block-card').forEach(card => {
    if (card.dataset.blockId === selectedBlockId) {
      card.classList.add('is-selected');
    } else {
      card.classList.remove('is-selected');
    }
  });
}

function selectBlock(id) {
  window.selectedBlockId = id;
  renderBlockSettings();
  updateSelectedBlockCard();
  // Show settings, hide modules list and color overrides panel
  const modulesPanel = document.getElementById('builderModulesPanel');
  const settingsPanel = document.getElementById('builderSettings');
  const colorPanel = document.getElementById('builderColorOverridesPanel');
  const seoPanel = document.getElementById('builderSeoPanel');
  if (modulesPanel) modulesPanel.style.display = 'none';
  if (colorPanel) colorPanel.style.display = 'none';
  if (seoPanel) seoPanel.style.display = 'none';
  if (settingsPanel) settingsPanel.style.display = '';
  // Auto-enable inline editing for TextSimple
  const block = pageBuilderState.blocks.find(b => b.id === id);
  if (block) {
    const def = BLOCK_TYPES[block.type] || {};
    const moduleName = def.moduleName || block.type;
    if (moduleName === 'TextSimple') {
      // Small delay to ensure the card preview is rendered
      setTimeout(() => enableInlineEditing(id), 50);
    }
  }
}

function deselectBlock() {
  disableInlineEditing();
  window.selectedBlockId = null;
  updateSelectedBlockCard();
  // Show modules list, hide settings
  const modulesPanel = document.getElementById('builderModulesPanel');
  const settingsPanel = document.getElementById('builderSettings');
  if (settingsPanel) {
    destroyWysiwygEditors(settingsPanel);
    settingsPanel.innerHTML = '';
    settingsPanel.style.display = 'none';
  }
  if (modulesPanel) modulesPanel.style.display = '';
}

// ── Save page builder ───────────────────────────────────────────────────────

async function savePageBuilder() {
  // Sync inline editing content if active
  if (_inlineEditingBlockId && _inlineEditingElement) {
    _syncInlineContentToBlockData(_inlineEditingElement);
  }
  syncBuilderMetaFromDOM();
  // Force-sync all Quill editors to their hidden textareas before reading form values
  _quillInstances.forEach((quill, id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const textarea = el.parentElement?.querySelector('.wysiwyg-source');
    if (textarea) textarea.value = (quill.getSemanticHTML() || '').replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');
  });
  // Sync the currently open block settings form to block.data before saving
  const panel = document.getElementById('builderSettings');
  const form = panel?.querySelector('form.builder-block-form');
  if (form && selectedBlockId) {
    liveUpdateFromSettingsForm(form);
  }
  const { title, slug, status, published_date, parent_id } = pageBuilderState.meta;
  if (!title || !slug) { showToast('Titre et slug requis', 'error'); return; }

  // Derive show_in_menu from menu toggles
  const assignments = getPageMenuAssignments();
  const show_in_menu = assignments.length > 0;

  const content = JSON.stringify(pageBuilderState.blocks);
  const color_overrides = pageBuilderState.colorOverrides.enabled ? JSON.stringify(pageBuilderState.colorOverrides) : null;
  const seo_meta = JSON.stringify(pageBuilderState.seoMeta);
  showLoading();
  try {
    if (pageBuilderState.editingPageId) {
      await apiFetch(`/pages/${pageBuilderState.editingPageId}`, { method: 'PUT', body: JSON.stringify({ title, slug, content, color_overrides, seo_meta, status, published_date, show_in_menu, menu_order: 0, parent_id: parent_id || null }) });
      showToast('Page mise à jour', 'success');
    } else {
      const res = await apiFetch('/pages', { method: 'POST', body: JSON.stringify({ title, slug, content, color_overrides, seo_meta, status, published_date, show_in_menu, menu_order: 0, parent_id: parent_id || null }) });
      showToast('Page créée', 'success');
      if (res && res.id) {
        pageBuilderState.editingPageId = res.id;
        localStorage.setItem('adminLastView', `builder:${res.id}`);
      }
    }

    // Sync menu assignments (title + slug sent so menu_items stay up to date)
    if (pageBuilderState.editingPageId && pageBuilderState.pageMenus.length > 0) {
      await apiFetch(`/pages/${pageBuilderState.editingPageId}/menus`, {
        method: 'PUT',
        body: JSON.stringify({ assignments, title, slug })
      });
    }

    // Reload menus with full item data and re-render toggles panel
    if (pageBuilderState.editingPageId) {
      try {
        const freshMenus = await apiFetch(`/pages/${pageBuilderState.editingPageId}/menus`);
        if (freshMenus?.menus) {
          pageBuilderState.pageMenus = freshMenus.menus;
          const body = document.querySelector('#builderMenuSettingsPanel .builder-menu-settings-body');
          if (body) {
            body.innerHTML = renderPageMenuToggles() ||
              '<p class="text-muted" style="font-size:0.85rem">Aucun menu créé. <a href="#" onclick="loadSection(\'menus\');return false">Créer un menu</a></p>';
          }
        }
      } catch (e) {}
    }

    // Update "Voir la page" link with current slug
    const viewBtn = document.getElementById('viewPageBtn');
    if (viewBtn) viewBtn.href = `${siteSettingsCache?.frontend_url || window.location.origin}/${slug.split('/').map(encodeURIComponent).join('/')}`;
    clearBuilderDirty();
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
    return;
  }
  hideLoading();
}

// ── Expose on window ────────────────────────────────────────────────────────
Object.assign(window, {
  markBuilderDirty,
  clearBuilderDirty,
  isInBuilder,
  guardedLoadSection,
  blockId,
  parsePageContent,
  openPageBuilder,
  renderPageBuilder,
  renderBlockCard,
  getBlockPreview,
  renderHeroPreviewHtml,
  renderSubModuleFallback,
  renderColumnsTabPreviewHtml,
  renderBlockPreviewHtml,
  getDropInsertIndex,
  handleBuilderDrop,
  handleBuilderDragover,
  handleBuilderDragleave,
  attachPageBuilderListeners,
  initBuilderSidebarResize,
  initPreviewScaling,
  applyPreviewScaling,
  syncBuilderMetaFromDOM,
  onBuilderStatusChange,
  onPublishModeChange,
  updateBuilderPlaceholder,
  updateBuilderParallax,
  initBuilderParallax,
  renderInsertButton,
  renderBlocksWithInsertButtons,
  rebuildBuilderBlocksDOM,
  clearDropIndicators,
  reattachBlockCardListeners,
  filterBuilderModules,
  addBlockByClick,
  editBlock,
  duplicateBlock,
  removeBlock,
  removeAllBlocks,
  updateSelectedBlockCard,
  selectBlock,
  deselectBlock,
  savePageBuilder,
});
