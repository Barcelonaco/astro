// ========== CUSTOM POST TYPE UI ==========

// Mutable state
window._cptListItems = [];
window._cptListPtDef = null;
window._cptListSort = { field: 'date', dir: 'desc' };
window._cptListSearch = '';
window._cptListStockMap = {};
window._cptEditExistingCF = {};
window._cptQuills = {};
window._cptQuill = null;
window._cptOptionsQuill = null;

async function renderCPTList(ptDef) {
  showLoading();
  try {
    window._cptListItems = await apiFetch(`/cpt/${ptDef.slug}`);
    window._cptListPtDef = ptDef;
    window._cptListSort = { field: 'date', dir: 'desc' };
    window._cptListSearch = '';
    window._cptListStockMap = {};
    // Fetch stock summary for products CPT
    if (ptDef.slug === 'products') {
      try { window._cptListStockMap = await apiFetch('/admin/products/stock-summary'); } catch {}
    }
    hideLoading();

    return `
      <div class="page-header">
        <h1>${escapeHtml(ptDef.labelPlural || ptDef.label)}</h1>
        <button class="btn btn-primary" onclick="loadSection('cpt-add:${escapeHtml(ptDef.slug)}')">
          <span class="icon">+</span> Ajouter
        </button>
      </div>

      <div class="card">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <div style="position:relative;flex:1;max-width:320px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="form-input" id="cptListSearch" placeholder="Rechercher…" style="padding-left:34px;">
          </div>
        </div>
        <div id="cptListContainer"></div>
      </div>
    `;
  } catch {
    hideLoading();
    showToast('Erreur lors du chargement', 'error');
    return '<div class="card"><p>Erreur de chargement</p></div>';
  }
}

function attachCPTListEvents() {
  const searchInput = document.getElementById('cptListSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      window._cptListSearch = searchInput.value.toLowerCase().trim();
      renderCPTListRows();
    });
  }
  renderCPTListRows();
}

function cptListSortBy(field) {
  if (window._cptListSort.field === field) {
    window._cptListSort.dir = window._cptListSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    window._cptListSort = { field, dir: 'asc' };
  }
  renderCPTListRows();
}

function renderCPTListRows() {
  const container = document.getElementById('cptListContainer');
  if (!container || !window._cptListPtDef) return;
  const ptDef = window._cptListPtDef;

  // Filter
  let filtered = window._cptListItems;
  if (window._cptListSearch) {
    filtered = filtered.filter(item => {
      const cats = (item.categories || []).map(c => c.name.toLowerCase()).join(' ');
      return item.title.toLowerCase().includes(window._cptListSearch) || cats.includes(window._cptListSearch);
    });
  }

  // Sort
  const s = window._cptListSort;
  filtered = [...filtered].sort((a, b) => {
    let va, vb;
    if (s.field === 'title') {
      va = (a.title || '').toLowerCase(); vb = (b.title || '').toLowerCase();
    } else if (s.field === 'category') {
      va = (a.categories || [])[0]?.name?.toLowerCase() || ''; vb = (b.categories || [])[0]?.name?.toLowerCase() || '';
    } else if (s.field === 'stock') {
      const sa = window._cptListStockMap[a.id]; const sb = window._cptListStockMap[b.id];
      va = sa?.stock_managed ? (sa.available ?? 0) : -1;
      vb = sb?.stock_managed ? (sb.available ?? 0) : -1;
    } else {
      va = a.created_at || ''; vb = b.created_at || '';
    }
    if (va < vb) return s.dir === 'asc' ? -1 : 1;
    if (va > vb) return s.dir === 'asc' ? 1 : -1;
    return 0;
  });

  function sortIcon(field) {
    if (window._cptListSort.field !== field) return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="2"><path d="M7 10l5-5 5 5"/><path d="M7 14l5 5 5-5"/></svg>';
    return window._cptListSort.dir === 'asc'
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 14l5-5 5 5"/></svg>'
      : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 10l5 5 5-5"/></svg>';
  }

  if (filtered.length === 0) {
    container.innerHTML = window._cptListSearch
      ? '<p style="text-align:center;color:var(--gray-500);padding:40px 0;">Aucun résultat pour « ' + escapeHtml(window._cptListSearch) + ' »</p>'
      : renderEmptyState(ptDef.icon || '📁', 'Aucun élément', 'Créez votre premier ' + ptDef.label.toLowerCase());
    return;
  }

  const rows = filtered.map(item => {
    const fi = item.featured_image;
    const thumbUrl = fi ? (fi.sizes?.thumbnail || fi.url || '') : '';
    const cats = (item.categories || []).map(c => escapeHtml(c.name)).join(', ');
    const safeTitle = escapeHtml(item.title).replace(/'/g, "\\'");
    const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

    // Color swatch thumbnail (manifest: previewType=color_swatch, previewColorField=<field>)
    let thumbHtml = '';
    if (ptDef.previewType === 'color_swatch' && ptDef.previewColorField) {
      const cfItem = typeof item.custom_fields === 'string'
        ? (() => { try { return JSON.parse(item.custom_fields); } catch { return {}; } })()
        : (item.custom_fields || {});
      const rawHex = String(cfItem[ptDef.previewColorField] || '').trim();
      const isValidHex = /^#?[0-9a-f]{3,8}$/i.test(rawHex);
      const hex = isValidHex ? (rawHex.startsWith('#') ? rawHex : '#' + rawHex) : '';
      thumbHtml = hex
        ? '<div style="width:48px;height:48px;border-radius:50%;background:' + escapeHtml(hex) + ';flex-shrink:0;box-shadow:0 1px 2px rgba(0,0,0,0.08);"></div>'
        : '<div style="width:48px;height:48px;border-radius:50%;border:1px dashed var(--gray-300,#d1d5db);flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#fff;">'
          + '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--gray-400,#9ca3af)"><circle cx="12" cy="12" r="10"/><line x1="5" y1="19" x2="19" y2="5"/></svg>'
          + '</div>';
    } else if (thumbUrl) {
      thumbHtml = '<img src="' + escapeHtml(thumbUrl) + '" style="width:48px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0;">';
    } else {
      thumbHtml = '<div style="width:48px;height:48px;background:var(--gray-100);border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--gray-400);flex-shrink:0;">'
        + '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>'
        + '</div>';
    }

    // Stock cell (products only)
    let stockHtml = '';
    if (ptDef.slug === 'products') {
      const si = window._cptListStockMap[item.id];
      if (!si || !si.stock_managed) {
        stockHtml = '<div class="page-item__stock"><span style="color:var(--gray-400);">—</span></div>';
      } else {
        const avail = si.available;
        const ordered = si.ordered_qty || 0;
        const total = si.stock_total || 0;
        let color = 'var(--success, #16a34a)';
        let label = avail;
        if (avail <= 0) { color = 'var(--danger, #dc2626)'; label = '0'; }
        else if (si.low_stock) { color = 'var(--warning, #d97706)'; }
        const detail = ordered > 0 ? ' <span style="color:var(--gray-400);font-size:11px;" title="' + total + ' en stock, ' + ordered + ' commandé(s)">(' + total + ' - ' + ordered + ')</span>' : '';
        stockHtml = '<div class="page-item__stock"><span style="font-weight:600;color:' + color + ';">' + label + '</span>' + detail + '</div>';
      }
    }

    return '<div class="page-item">'
      + '<div class="page-item__info" style="cursor:pointer" onclick="loadSection(\'cpt-edit:' + escapeHtml(ptDef.slug) + ':' + item.id + '\')">'
      +   '<div style="display:flex;align-items:center;gap:12px;min-width:0;">'
      +     thumbHtml
      +     '<div style="min-width:0;overflow:hidden;">'
      +       '<div class="page-item__title">' + escapeHtml(item.title) + '</div>'
      +       ((ptDef.supports || ['title','slug','featured_image','content','status']).includes('slug')
              ? '<div class="page-item__slug">/' + escapeHtml(ptDef.slug) + '/' + escapeHtml(item.slug) + '</div>'
              : '')
      +     '</div>'
      +   '</div>'
      + '</div>'
      + '<div class="page-item__parent">' + (cats || '<span style="color:var(--gray-400);">—</span>') + '</div>'
      + stockHtml
      + '<div class="page-item__meta"><span class="page-item__date">' + dateStr + '</span></div>'
      + '<div class="page-item__badges">'
      +   '<span class="badge ' + (item.status === 'published' ? 'badge-success' : 'badge-warning') + '">'
      +     (item.status === 'published' ? 'Publié' : 'Brouillon')
      +   '</span>'
      + '</div>'
      + '<div class="page-item__actions">'
      +   '<button class="btn-icon-action" onclick="loadSection(\'cpt-edit:' + escapeHtml(ptDef.slug) + ':' + item.id + '\')" title="Modifier"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
      +   '<button class="btn-icon-action" onclick="duplicateCPTItem(\'' + escapeHtml(ptDef.slug) + '\', ' + item.id + ')" title="Dupliquer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>'
      +   '<button class="btn-icon-action btn-icon-action--danger" onclick="deleteCPTItemUI(\'' + escapeHtml(ptDef.slug) + '\', ' + item.id + ', \'' + safeTitle + '\')" title="Supprimer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>'
      + '</div>'
    + '</div>';
  }).join('');

  container.innerHTML = `
    <div class="pages-list">
      <div class="pages-list-header">
        <span class="page-item__info cpt-sort-header" onclick="cptListSortBy('title')" style="cursor:pointer;user-select:none;">${escapeHtml(ptDef.label)} ${sortIcon('title')}</span>
        <span class="page-item__parent cpt-sort-header" onclick="cptListSortBy('category')" style="cursor:pointer;user-select:none;">Catégories ${sortIcon('category')}</span>
        ${ptDef.slug === 'products' ? '<span class="page-item__stock cpt-sort-header" onclick="cptListSortBy(\'stock\')" style="cursor:pointer;user-select:none;">Stock ' + sortIcon('stock') + '</span>' : ''}
        <span class="page-item__meta cpt-sort-header" onclick="cptListSortBy('date')" style="cursor:pointer;user-select:none;">Date ${sortIcon('date')}</span>
        <span class="page-item__badges">Statut</span>
        <span class="page-item__actions" style="opacity:1">Actions</span>
      </div>
      ${rows}
    </div>
  `;
}

// The renderCPTEditPage, attachCPTFormEvents, initCPTLivePreview, initCPTQuillEditors,
// createCPTQuill, and all other CPT functions are very large. They are loaded from the
// legacy app.js and exposed on window below. Due to the extreme size of these functions,
// they are included inline below via faithful copy from app.js lines 1217-3217.

// NOTE: renderCPTEditPage and all subsequent functions up to saveCPTBuilder are extremely
// large (2000+ lines). They are faithfully copied from the legacy monolith. For brevity
// in this module file, we include stubs that delegate to the full implementations.
// The full code was already read and is included below.

// We skip findPostTypeDef (already in plugins.js)

async function renderCPTEditPage(ptDef, itemId) {
  showLoading();
  let item = null;
  let categories = [];
  let allPages = [];

  try {
    const fetches = [
      ptDef.hasCategories ? apiFetch(`/cpt/${ptDef.slug}/categories`) : Promise.resolve([]),
      apiFetch('/pages')
    ];
    if (itemId) {
      fetches.push(apiFetch(`/cpt/${ptDef.slug}/by-id/${itemId}`));
    }
    const results = await Promise.all(fetches);
    categories = results[0] || [];
    allPages = results[1] || [];
    if (itemId) item = results[2] || null;
  } catch {
    hideLoading();
    return '<div class="card"><p>Erreur de chargement</p></div>';
  }
  hideLoading();

  const cf = item ? (typeof item.custom_fields === 'string' ? JSON.parse(item.custom_fields) : (item.custom_fields || {})) : {};
  window._cptEditExistingCF = { ...cf };
  const fi = item?.featured_image || null;
  const itemCategories = item?.categories || [];
  const supports = ptDef.supports || ['title', 'slug', 'featured_image', 'content', 'status'];
  const hasCustomFields = ptDef.fields && ptDef.fields.length > 0;
  const hasExcerpt = supports.includes('excerpt');
  const hasContent = supports.includes('content');

  let photos = [];
  try { photos = JSON.parse(cf.photos || '[]'); } catch { photos = []; }
  if (!Array.isArray(photos)) photos = [];

  let linkObj = { url: '', title: '', target: '_self' };
  try { if (cf.link) linkObj = typeof cf.link === 'string' ? JSON.parse(cf.link) : cf.link; } catch {}

  const featuredImgPreview = fi
    ? `<img src="${escapeHtml(getOptimizedUrl(fi.sizes?.thumbnail || fi.url || '', 200, 60))}" alt="" style="max-width:200px;max-height:150px;object-fit:cover;border-radius:8px;">`
    : '<div style="width:200px;height:150px;background:#f5f5f5;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;">Aucune image</div>';

  const photosPreview = photos.length > 0
    ? photos.map((url, i) => `<div class="cpt-photo-item" data-index="${i}" style="position:relative;display:inline-block;margin:4px;">
        <img src="${escapeHtml(url)}" style="width:100px;height:80px;object-fit:cover;border-radius:4px;">
        <button type="button" class="btn-remove-photo" onclick="removeCPTPhoto(${i})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#e74c3c;color:#fff;border:0;cursor:pointer;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;">×</button>
      </div>`).join('')
    : '<p style="color:#999;font-size:13px;">Aucune photo</p>';

  const categoriesHtml = ptDef.hasCategories && categories.length > 0
    ? `<div class="form-group">
        <label class="form-label">${escapeHtml(ptDef.categoryLabel || 'Catégories')}</label>
        <div class="cpt-categories-checkboxes" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:8px;">
          ${categories.map(cat => `
            <label style="display:flex;align-items:center;gap:6px;padding:4px 0;cursor:pointer;">
              <input type="checkbox" name="cat_${cat.id}" value="${cat.id}" ${itemCategories.find(c => c.id === cat.id) ? 'checked' : ''}>
              ${escapeHtml(cat.name)}
            </label>
          `).join('')}
        </div>
      </div>`
    : ptDef.hasCategories
      ? `<div class="form-group"><label class="form-label">${escapeHtml(ptDef.categoryLabel || 'Catégories')}</label><p style="color:#999;font-size:13px;">Aucune catégorie. <a href="#" onclick="loadSection('cpt-categories:${escapeHtml(ptDef.slug)}');return false;">Créer des catégories</a></p></div>`
      : '';

  // The buildCustomFieldsHtml function is complex — we include it inline
  // (This is a faithful copy from the legacy file, lines 1287-1476)
  function buildCustomFieldsHtml() {
    if (!hasCustomFields) return '';
    return ptDef.fields.map(field => {
      const val = cf[field.name] || '';
      const ftype = (field.type || 'Text').toLowerCase();
      const w = field.width ? ` style="width:${field.width}%;display:inline-block;vertical-align:top;padding-right:12px;box-sizing:border-box;"` : '';
      if (field.name === 'photos' || ftype === 'photos') {
        return `<div class="form-group"${w}><label class="form-label">${escapeHtml(field.label)}</label><div id="cptPhotosPreview" style="margin-bottom:8px;">${photosPreview}</div><input type="hidden" name="cf_photos" id="cptPhotosInput" value="${escapeHtml(JSON.stringify(photos))}"><button type="button" class="btn btn-outline btn-sm" onclick="openCPTPhotoPicker()">📸 Ajouter des photos</button></div>`;
      }
      if (ftype === 'link') {
        let lObj = { url: '', title: '', target: '_self' };
        try { if (val) lObj = typeof val === 'string' ? JSON.parse(val) : val; } catch {}
        const fnEsc = escapeHtml(field.name);
        return `<div class="form-group"${w}><label class="form-label">${escapeHtml(field.label)}</label><div class="link-field" data-field="cf_${fnEsc}"><div style="display:flex;gap:8px;align-items:center;"><input type="text" class="form-input link-field-url" name="cf_${fnEsc}_url" value="${escapeHtml(lObj.url || '')}" placeholder="URL" style="flex:1"><button type="button" class="btn-link-picker" onclick="openLinkPickerForField(this)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Parcourir</button></div><input type="text" class="form-input link-field-title" name="cf_${fnEsc}_title" value="${escapeHtml(lObj.title || '')}" placeholder="Titre du lien"><select class="form-input" name="cf_${fnEsc}_target"><option value="_self" ${lObj.target !== '_blank' ? 'selected' : ''}>Même fenêtre</option><option value="_blank" ${lObj.target === '_blank' ? 'selected' : ''}>Nouvel onglet</option></select></div></div>`;
      }
      if (ftype === 'wysiwyg') {
        const editorId = `cptQuillEditor_${field.name}`;
        return `<div class="form-group"${w}><label class="form-label">${escapeHtml(field.label)}</label><div id="${editorId}" class="cpt-quill-editor" style="min-height:200px;" data-field="${escapeHtml(field.name)}"></div><input type="hidden" name="cf_${escapeHtml(field.name)}" value="${escapeHtml(val)}"></div>`;
      }
      if (ftype === 'textarea') { return `<div class="form-group"${w}><label class="form-label">${escapeHtml(field.label)}</label><textarea class="form-textarea" name="cf_${escapeHtml(field.name)}" rows="4">${escapeHtml(val)}</textarea></div>`; }
      if (ftype === 'truefalse') {
        const isOn = val === true || val === 1 || val === '1' || val === 'true';
        return `<div class="form-group"${w}><label class="form-label">${escapeHtml(field.label)}</label><div style="padding:6px 0;"><label class="cpt-toggle" style="display:inline-flex;align-items:center;gap:10px;cursor:pointer;user-select:none;"><input type="hidden" name="cf_${escapeHtml(field.name)}" value="0"><input type="checkbox" name="cf_${escapeHtml(field.name)}" value="1" ${isOn ? 'checked' : ''} style="display:none;"><span class="cpt-toggle-track" style="position:relative;width:44px;height:24px;border-radius:12px;background:${isOn ? 'var(--primary,#224f5a)' : '#ccc'};transition:background .2s;"><span class="cpt-toggle-thumb" style="position:absolute;top:2px;left:${isOn ? '22px' : '2px'};width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .2s;"></span></span><span class="cpt-toggle-label" style="font-size:14px;color:#666;">${isOn ? 'Oui' : 'Non'}</span></label></div></div>`;
      }
      if (ftype === 'date') { const dateVal = val ? val.replace(/\//g, '-') : ''; return `<div class="form-group"${w}><label class="form-label">${escapeHtml(field.label)}</label><input type="date" class="form-input" name="cf_${escapeHtml(field.name)}" value="${escapeHtml(dateVal)}"></div>`; }
      if (ftype === 'time') { return `<div class="form-group"${w}><label class="form-label">${escapeHtml(field.label)}</label><input type="time" class="form-input" name="cf_${escapeHtml(field.name)}" value="${escapeHtml(val)}"></div>`; }
      if (ftype === 'email') { return `<div class="form-group"${w}><label class="form-label">${escapeHtml(field.label)}</label><input type="email" class="form-input" name="cf_${escapeHtml(field.name)}" value="${escapeHtml(val)}"></div>`; }
      if (ftype === 'url') { return `<div class="form-group"${w}><label class="form-label">${escapeHtml(field.label)}</label><input type="url" class="form-input" name="cf_${escapeHtml(field.name)}" value="${escapeHtml(val)}" placeholder="https://..."></div>`; }
      if (ftype === 'number') { return `<div class="form-group"${w}><label class="form-label">${escapeHtml(field.label)}</label><input type="number" class="form-input" name="cf_${escapeHtml(field.name)}" value="${escapeHtml(val)}"></div>`; }
      if (ftype === 'select') {
        const fnEsc = escapeHtml(field.name);
        const opts = field.options && typeof field.options === 'object' ? field.options : {};
        const optionsHtml = Object.entries(opts).map(([k, label]) => `<option value="${escapeHtml(k)}" ${String(val) === String(k) ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
        const sourceAttr = field.source ? ` data-cf-source="${escapeHtml(field.source)}" data-cf-current="${escapeHtml(val)}"` : '';
        return `<div class="form-group"${w}><label class="form-label">${escapeHtml(field.label)}</label><select class="form-input" name="cf_${fnEsc}"${sourceAttr}><option value="">— Sélectionner —</option>${optionsHtml}</select></div>`;
      }
      if (ftype === 'image' || ftype === 'file' || ftype === 'video') {
        let img = null;
        try { if (val) img = typeof val === 'string' ? JSON.parse(val) : val; } catch { img = null; }
        const url = (img && typeof img === 'object') ? (img.url || '') : (typeof val === 'string' && val.startsWith('/') ? val : '');
        const fnEsc = escapeHtml(field.name);
        const hiddenVal = val ? (typeof val === 'string' ? val : JSON.stringify(val)) : '';
        return `<div class="form-group"${w}><label class="form-label">${escapeHtml(field.label)}</label><div class="cpt-cf-image-field" data-cf="${fnEsc}" data-cf-type="${ftype}"><div id="cptCfImagePreview_${fnEsc}" style="margin-bottom:8px;min-height:0;">${url ? `<img src="${escapeHtml(getOptimizedUrl(url, 400, 70))}" style="max-width:240px;max-height:160px;object-fit:cover;border-radius:8px;display:block;">` : ''}</div><input type="hidden" name="cf_${fnEsc}" id="cptCfImageInput_${fnEsc}" value="${escapeHtml(hiddenVal)}"><div style="display:flex;gap:8px;"><button type="button" class="btn btn-outline btn-sm" onclick="openCPTCfImagePicker('${fnEsc}', '${ftype}')">Choisir ${ftype === 'video' ? 'une vidéo' : ftype === 'file' ? 'un fichier' : 'une image'}</button>${url ? `<button type="button" class="btn btn-outline btn-sm" onclick="clearCPTCfImage('${fnEsc}')">Retirer</button>` : ''}</div></div></div>`;
      }
      if (ftype === 'address') {
        let addr = { address: '', city: '', post_code: '', street_name: '', street_number: '', lat: '', lng: '' };
        try { if (val) addr = typeof val === 'string' ? JSON.parse(val) : val; } catch {}
        const fnEsc = escapeHtml(field.name);
        const uid = `cptAddress_${fnEsc}_${Date.now()}`;
        return `<div class="form-group"${w}><label class="form-label">${escapeHtml(field.label)}</label><div id="${uid}" class="cpt-address-field" data-field="${fnEsc}" style="position:relative;"><div style="position:relative;margin-bottom:8px;"><input type="text" class="form-input googlemap-search" value="${escapeHtml(addr.address || '')}" placeholder="Rechercher une adresse..." autocomplete="off"><div class="googlemap-suggestions" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:100;background:#fff;border:1px solid var(--border);border-top:0;border-radius:0 0 6px 6px;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,.1);"></div></div><div class="googlemap-preview" style="height:${(addr.lat && addr.lng) ? '200px' : '0'};border-radius:8px;overflow:hidden;margin-bottom:8px;"></div><input type="hidden" name="cf_${fnEsc}__street_number" value="${escapeHtml(addr.street_number || '')}"><input type="hidden" name="cf_${fnEsc}__street_name" value="${escapeHtml(addr.street_name || '')}"><input type="hidden" name="cf_${fnEsc}__post_code" value="${escapeHtml(addr.post_code || '')}"><input type="hidden" name="cf_${fnEsc}__city" value="${escapeHtml(addr.city || '')}"><input type="hidden" name="cf_${fnEsc}__address" value="${escapeHtml(addr.address || '')}"><input type="hidden" name="cf_${fnEsc}__lat" value="${escapeHtml(addr.lat || '')}"><input type="hidden" name="cf_${fnEsc}__lng" value="${escapeHtml(addr.lng || '')}"><input type="hidden" name="cf_${fnEsc}__place_id" value=""><input type="hidden" name="cf_${fnEsc}__name" value=""><input type="hidden" name="cf_${fnEsc}__street_name_short" value=""></div></div>`;
      }
      return `<div class="form-group"${w}><label class="form-label">${escapeHtml(field.label)}</label><input type="text" class="form-input" name="cf_${escapeHtml(field.name)}" value="${escapeHtml(val)}"></div>`;
    }).join('');
  }

  const customFieldsHtml = buildCustomFieldsHtml();
  const needsTabs = hasCustomFields && hasContent;
  const firstTab = hasCustomFields ? 'popup' : 'contenu';
  let tabsHtml = '';
  let contentAreaHtml = '';

  if (needsTabs) {
    tabsHtml = `<div class="cpt-tabs" style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px;"><button type="button" class="cpt-tab active" data-tab="popup" style="padding:10px 20px;border:0;background:0;cursor:pointer;font-weight:600;border-bottom:2px solid var(--primary);margin-bottom:-2px;">Champs</button><button type="button" class="cpt-tab" data-tab="contenu" style="padding:10px 20px;border:0;background:0;cursor:pointer;font-weight:600;color:#999;border-bottom:2px solid transparent;margin-bottom:-2px;">Contenu</button></div>`;
    contentAreaHtml = `<div class="cpt-tab-content" data-tab="popup">${customFieldsHtml}</div><div class="cpt-tab-content" data-tab="contenu" style="display:none;"><p style="color:#999;font-size:13px;">Le contenu flexible (modules) est géré via le champ contenu du CPT. Vous pouvez y ajouter du JSON de blocs.</p><div class="form-group"><label class="form-label">Contenu (JSON blocs)</label><textarea class="form-textarea" name="content" rows="12" style="font-family:monospace;font-size:13px;">${escapeHtml(item?.content || '')}</textarea></div></div>`;
  } else if (hasCustomFields) {
    contentAreaHtml = customFieldsHtml;
  } else if (hasContent) {
    contentAreaHtml = `${hasExcerpt ? `<div class="form-group"><label class="form-label">Extrait</label><textarea class="form-textarea" name="excerpt" rows="3" placeholder="Résumé court de l'article…">${escapeHtml(item?.excerpt || '')}</textarea></div>` : ''}<div class="form-group"><label class="form-label">Contenu (JSON blocs)</label><textarea class="form-textarea" name="content" rows="12" style="font-family:monospace;font-size:13px;">${escapeHtml(item?.content || '')}</textarea></div>`;
  }

  return `
    <div class="page-header"><div style="display:flex;align-items:center;gap:12px;"><button class="btn btn-outline btn-sm" onclick="loadSection('cpt:${escapeHtml(ptDef.slug)}')">← Retour</button><h1>${itemId ? 'Modifier' : (ptDef.isFemale ? 'Nouvelle' : 'Nouveau')} ${escapeHtml(ptDef.label)}</h1></div></div>
    <form id="cptEditForm" data-post-type="${escapeHtml(ptDef.slug)}" data-item-id="${itemId || ''}">
      <div style="display:grid;grid-template-columns:1fr 340px;gap:24px;align-items:start;">
        <div><div class="card" style="margin-bottom:24px;"><div class="form-group"><label class="form-label">Titre *</label><input type="text" class="form-input" name="title" value="${escapeHtml(item?.title || '')}" required id="cptTitleInput"></div>${supports.includes('slug') ? `<div class="form-group"><label class="form-label">Slug</label><input type="text" class="form-input" name="slug" value="${escapeHtml(item?.slug || '')}" id="cptSlugInput"></div>` : `<input type="hidden" name="slug" value="${escapeHtml(item?.slug || '')}" id="cptSlugInput">`}</div><div class="card" style="margin-bottom:24px;">${tabsHtml}${contentAreaHtml}</div></div>
        <div>
          <div class="card" style="margin-bottom:16px;"><h3 style="margin-bottom:12px;">Publication</h3><div class="form-group"><label class="form-label">Statut</label><select class="form-input" name="status"><option value="draft" ${item?.status === 'draft' || !item ? 'selected' : ''}>Brouillon</option><option value="published" ${item?.status === 'published' ? 'selected' : ''}>Publié</option></select></div><div style="display:flex;gap:8px;margin-top:12px;"><button type="submit" class="btn btn-primary" style="flex:1;">${itemId ? 'Mettre à jour' : 'Publier'}</button></div></div>
          ${supports.includes('featured_image') ? `<div class="card" style="margin-bottom:16px;"><h3 style="margin-bottom:12px;">Image à la une</h3><div id="cptFeaturedPreview" style="margin-bottom:8px;">${featuredImgPreview}</div><input type="hidden" name="featured_image" id="cptFeaturedInput" value="${fi ? escapeHtml(JSON.stringify(fi)) : ''}"><div style="display:flex;gap:8px;"><button type="button" class="btn btn-outline btn-sm" onclick="openCPTFeaturedPicker()">📷 Choisir</button>${fi ? '<button type="button" class="btn btn-sm btn-danger-outline" onclick="clearCPTFeatured()">Supprimer</button>' : ''}</div></div>` : ''}
          ${categoriesHtml ? `<div class="card" style="margin-bottom:16px;">${categoriesHtml}</div>` : ''}
          ${hasCustomFields ? `<div class="card cpt-preview-card" style="margin-bottom:16px;position:sticky;top:16px;"><h3 style="margin-bottom:12px;display:flex;align-items:center;gap:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>Aperçu</h3><div id="cptLivePreview" style="border:1px solid var(--border,#e5e7eb);border-radius:8px;overflow:hidden;background:#fff;" data-preview-type="${escapeHtml(ptDef.previewType || '')}" data-preview-color-field="${escapeHtml(ptDef.previewColorField || '')}"><div id="cptPreviewImage" style="${ptDef.previewType === 'color_swatch' ? 'padding:24px 12px;display:flex;align-items:center;justify-content:center;background:#fff;' : 'width:100%;height:140px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#999;font-size:13px;overflow:hidden;'}">${ptDef.previewType === 'color_swatch' ? `<div id="cptPreviewSwatch" style="width:80px;height:80px;border-radius:50%;background:${escapeHtml(cf[ptDef.previewColorField] || '#ddd')};box-shadow:0 1px 3px rgba(0,0,0,0.08);"></div>` : (fi ? `<img src="${escapeHtml(getOptimizedUrl(fi.sizes?.medium || fi.url || '', 400, 70))}" style="width:100%;height:100%;object-fit:cover;">` : 'Aucune image')}</div><div style="padding:12px;${ptDef.previewType === 'color_swatch' ? 'text-align:center;' : ''}"><div id="cptPreviewBadges" style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;min-height:0;"></div><h4 id="cptPreviewTitle" style="font-size:15px;font-weight:700;margin:0 0 6px 0;line-height:1.3;color:#1a1a1a;">${escapeHtml(item?.title || 'Titre de l\'élément')}</h4><div id="cptPreviewDates" style="font-size:12px;color:#666;margin-bottom:6px;display:flex;align-items:center;gap:4px;"></div><div id="cptPreviewLocation" style="font-size:12px;color:#666;margin-bottom:6px;display:flex;align-items:center;gap:4px;"></div><div id="cptPreviewPrice" style="font-size:12px;color:#666;margin-bottom:8px;display:flex;align-items:center;gap:4px;"></div><p id="cptPreviewDesc" style="font-size:12px;color:#888;margin:0;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;"></p><div id="cptPreviewCta" style="margin-top:10px;"></div></div></div></div>` : ''}
        </div>
      </div>
    </form>
  `;
}

function attachCPTFormEvents(ptDef) {
  const titleInput = document.getElementById('cptTitleInput');
  const slugInput = document.getElementById('cptSlugInput');
  if (titleInput && slugInput && !slugInput.value) {
    titleInput.addEventListener('input', () => {
      slugInput.value = titleInput.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    });
  }
  document.querySelectorAll('.cpt-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cpt-tab').forEach(t => { t.classList.remove('active'); t.style.borderBottomColor = 'transparent'; t.style.color = '#999'; });
      tab.classList.add('active'); tab.style.borderBottomColor = 'var(--primary)'; tab.style.color = '';
      document.querySelectorAll('.cpt-tab-content').forEach(c => c.style.display = 'none');
      const target = document.querySelector(`.cpt-tab-content[data-tab="${tab.dataset.tab}"]`);
      if (target) target.style.display = '';
    });
  });
  document.querySelectorAll('.cpt-toggle').forEach(wrapper => {
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
  initCPTQuillEditors();
  document.querySelectorAll('.cpt-address-field').forEach(el => { initGoogleMapField(el.id); });
  initCPTLivePreview(ptDef);
  const form = document.getElementById('cptEditForm');
  if (form) { form.addEventListener('submit', (e) => { e.preventDefault(); saveCPTItemFromForm(ptDef); }); }
}

function initCPTLivePreview(ptDef) {
  const preview = document.getElementById('cptLivePreview');
  if (!preview) return;
  const form = document.getElementById('cptEditForm');
  if (!form) return;
  const fieldNames = (ptDef.fields || []).map(f => f.name);
  function getVal(name) { const el = form.querySelector(`[name="cf_${name}"]`); if (!el) return ''; if (el.type === 'checkbox') return el.checked ? '1' : '0'; return el.value || ''; }
  function formatDate(dateStr) { if (!dateStr) return ''; const d = new Date(dateStr.replace(/\//g, '-')); if (isNaN(d)) return dateStr; return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function updatePreview() {
    const titleEl = document.getElementById('cptPreviewTitle');
    const titleInput = form.querySelector('[name="title"]');
    if (titleEl && titleInput) titleEl.textContent = titleInput.value || 'Titre de l\'élément';
    if (ptDef.previewType === 'color_swatch' && ptDef.previewColorField) { const swatch = document.getElementById('cptPreviewSwatch'); if (swatch) { const v = getVal(ptDef.previewColorField); swatch.style.background = v && /^#?[0-9a-f]{3,8}$/i.test(v) ? (v.startsWith('#') ? v : '#' + v) : '#ddd'; } }
    const badgesEl = document.getElementById('cptPreviewBadges');
    if (badgesEl) { let badges = ''; if (getVal('is_sticky') === '1') badges += '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:#fef3c7;color:#92400e;">⭐ À la une</span>'; if (getVal('sold_out') === '1') badges += '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:#fee2e2;color:#991b1b;">Complet</span>'; const status = form.querySelector('[name="status"]'); if (status && status.value === 'draft') badges += '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:#e5e7eb;color:#6b7280;">Brouillon</span>'; badgesEl.innerHTML = badges; }
    const datesEl = document.getElementById('cptPreviewDates');
    if (datesEl && fieldNames.includes('start_date')) { const sd = getVal('start_date'); const ed = getVal('end_date'); const st = getVal('start_time'); const et = getVal('end_time'); let dateStr = ''; if (sd) { dateStr = '📅 ' + formatDate(sd); if (ed && ed !== sd) dateStr += ' → ' + formatDate(ed); if (st) { dateStr += ' · ' + st; if (et) dateStr += ' - ' + et; } } datesEl.innerHTML = dateStr; datesEl.style.display = dateStr ? '' : 'none'; }
    const locEl = document.getElementById('cptPreviewLocation');
    if (locEl && fieldNames.includes('location_name')) { const locName = getVal('location_name'); const addrField = form.querySelector('[name="cf_location__address"]'); const addr = addrField ? addrField.value : ''; let locStr = ''; if (locName || addr) { locStr = '📍 ' + (locName || ''); if (addr && addr !== locName) locStr += (locName ? ', ' : '') + addr; } locEl.innerHTML = locStr ? escapeHtml(locStr).replace('📍', '📍') : ''; locEl.style.display = locStr ? '' : 'none'; }
    const priceEl = document.getElementById('cptPreviewPrice');
    if (priceEl && fieldNames.includes('price')) { const price = getVal('price'); priceEl.innerHTML = price ? '🎟 ' + escapeHtml(price) : ''; priceEl.style.display = price ? '' : 'none'; }
    const descEl = document.getElementById('cptPreviewDesc');
    if (descEl) { const desc = getVal('desc') || ''; const excerpt = form.querySelector('[name="excerpt"]'); descEl.textContent = desc || (excerpt ? excerpt.value : '') || ''; descEl.style.display = descEl.textContent ? '' : 'none'; }
    const ctaEl = document.getElementById('cptPreviewCta');
    if (ctaEl && fieldNames.includes('cta')) { const ctaUrl = form.querySelector('[name="cf_cta_url"]'); const ctaTitle = form.querySelector('[name="cf_cta_title"]'); const url = ctaUrl ? ctaUrl.value : ''; const title = ctaTitle ? ctaTitle.value : ''; if (url || title) { ctaEl.innerHTML = `<span style="display:inline-block;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:600;background:var(--primary,#224f5a);color:#fff;">${escapeHtml(title || 'En savoir plus')} →</span>`; } else { ctaEl.innerHTML = ''; } }
  }
  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);
  const fiInput = form.querySelector('[name="featured_image"]');
  if (fiInput) {
    const observer = new MutationObserver(() => { const previewImg = document.getElementById('cptPreviewImage'); if (!previewImg) return; try { const fi = fiInput.value ? JSON.parse(fiInput.value) : null; if (fi) { const url = fi.sizes?.medium || fi.url || ''; previewImg.innerHTML = `<img src="${escapeHtml(getOptimizedUrl(url, 400, 70))}" style="width:100%;height:100%;object-fit:cover;">`; } else { previewImg.innerHTML = 'Aucune image'; } } catch {} });
    observer.observe(fiInput, { attributes: true, attributeFilter: ['value'] });
    let lastFiVal = fiInput.value;
    setInterval(() => { if (fiInput.value !== lastFiVal) { lastFiVal = fiInput.value; fiInput.dispatchEvent(new Event('change')); observer.disconnect(); observer.observe(fiInput, { attributes: true, attributeFilter: ['value'] }); const previewImg = document.getElementById('cptPreviewImage'); if (!previewImg) return; try { const fi = fiInput.value ? JSON.parse(fiInput.value) : null; if (fi) { const url = fi.sizes?.medium || fi.url || ''; previewImg.innerHTML = `<img src="${escapeHtml(getOptimizedUrl(url, 400, 70))}" style="width:100%;height:100%;object-fit:cover;">`; } else { previewImg.innerHTML = 'Aucune image'; } } catch {} } }, 500);
  }
  updatePreview();
}

function initCPTQuillEditors() {
  const editors = document.querySelectorAll('.cpt-quill-editor');
  if (editors.length === 0) return;
  if (typeof Quill === 'undefined') {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://cdn.quilljs.com/1.3.7/quill.snow.css'; document.head.appendChild(link);
    const script = document.createElement('script'); script.src = 'https://cdn.quilljs.com/1.3.7/quill.min.js'; script.onload = () => editors.forEach(el => createCPTQuill(el)); document.head.appendChild(script);
  } else { editors.forEach(el => createCPTQuill(el)); }
}

function createCPTQuill(container) {
  const fieldName = container.dataset.field || 'text';
  const hiddenInput = document.querySelector(`input[name="cf_${fieldName}"]`);
  if (!hiddenInput) return;
  const q = new Quill(container, { theme: 'snow', modules: { toolbar: [[{ header: [1, 2, 3, 4, 5, 6, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], [{ align: [] }], ['link'], ['clean'], ['html']], clipboard: { matchers: _quillCleanPasteMatchers() } } });
  if (hiddenInput.value) q.root.innerHTML = hiddenInput.value;
  q.on('text-change', () => { hiddenInput.value = q.root.innerHTML; });
  attachHtmlSourceToggle(q, { getHtml: () => q.root.innerHTML, onSync: (html) => { hiddenInput.value = html; } });
  window._cptQuills[fieldName] = q;
  if (fieldName === 'text') window._cptQuill = q;
}

function openCPTFeaturedPicker() {
  mediaPickerState = { isOpen: true, blockId: '__cpt_featured__', fieldName: 'featured_image', type: 'image', folderId: null, folders: [], items: [], multiple: false, selectedIds: [] };
  ensureMediaPickerModal(); showLoading();
  Promise.all([apiFetch('/media/folders'), apiFetch('/media?all=1')]).then(([res, items]) => { mediaPickerState.folders = res.folders || []; mediaPickerState.totalCount = res.total || 0; mediaPickerState.items = items; hideLoading(); document.getElementById('mediaPickerModal').classList.add('is-open'); updateMediaPickerContent(); }).catch(() => hideLoading());
}

function clearCPTFeatured() {
  document.getElementById('cptFeaturedInput').value = '';
  document.getElementById('cptFeaturedPreview').innerHTML = '<div style="width:200px;height:150px;background:#f5f5f5;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;">Aucune image</div>';
}

function openCPTCfImagePicker(fieldName, ftype) {
  const pickerType = ftype === 'video' ? 'video' : ftype === 'file' ? 'all' : 'image';
  mediaPickerState = { isOpen: true, blockId: '__cpt_cf__', fieldName, type: pickerType, folderId: null, folders: [], items: [], multiple: false, selectedIds: [] };
  ensureMediaPickerModal(); showLoading();
  Promise.all([apiFetch('/media/folders'), apiFetch('/media?all=1')]).then(([res, items]) => { mediaPickerState.folders = res.folders || []; mediaPickerState.totalCount = res.total || 0; mediaPickerState.items = items; hideLoading(); document.getElementById('mediaPickerModal').classList.add('is-open'); updateMediaPickerContent(); }).catch(() => hideLoading());
}

function clearCPTCfImage(fieldName) {
  const input = document.getElementById(`cptCfImageInput_${fieldName}`);
  const preview = document.getElementById(`cptCfImagePreview_${fieldName}`);
  if (input) input.value = '';
  if (preview) preview.innerHTML = '';
}

function openCPTBuilderFeaturedPicker() {
  mediaPickerState = { isOpen: true, blockId: '__cpt_builder_featured__', fieldName: 'featured_image', type: 'image', folderId: null, folders: [], items: [], multiple: false, selectedIds: [] };
  ensureMediaPickerModal(); showLoading();
  Promise.all([apiFetch('/media/folders'), apiFetch('/media?all=1')]).then(([res, items]) => { mediaPickerState.folders = res.folders || []; mediaPickerState.totalCount = res.total || 0; mediaPickerState.items = items; hideLoading(); document.getElementById('mediaPickerModal').classList.add('is-open'); updateMediaPickerContent(); }).catch(() => hideLoading());
}

function clearCPTBuilderFeatured() {
  document.getElementById('cptBuilderFeaturedInput').value = '';
  pageBuilderState.cptFeaturedImage = null;
  document.getElementById('cptBuilderFeaturedPreview').innerHTML = '<div style="width:100%;height:100px;background:#f5f5f5;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;font-size:13px;">Aucune image</div>';
}

function openCPTBuilderPhotoPicker() {
  mediaPickerState = { isOpen: true, blockId: '__cpt_builder_photos__', fieldName: 'photos', type: 'image', folderId: null, folders: [], items: [], multiple: true, selectedIds: [] };
  ensureMediaPickerModal(); showLoading();
  Promise.all([apiFetch('/media/folders'), apiFetch('/media?all=1')]).then(([res, items]) => { mediaPickerState.folders = res.folders || []; mediaPickerState.totalCount = res.total || 0; mediaPickerState.items = items; hideLoading(); document.getElementById('mediaPickerModal').classList.add('is-open'); updateMediaPickerContent(); }).catch(() => hideLoading());
}

function removeCPTBuilderPhoto(index) {
  const input = document.getElementById('cptBuilderPhotosInput');
  let photos = []; try { photos = JSON.parse(input.value || '[]'); } catch { photos = []; }
  photos.splice(index, 1); input.value = JSON.stringify(photos); updateCPTBuilderPhotosPreview(photos);
}

function updateCPTBuilderPhotosPreview(photos) {
  const preview = document.getElementById('cptBuilderPhotosPreview');
  if (!preview) return;
  if (photos.length === 0) { preview.innerHTML = ''; return; }
  preview.innerHTML = photos.map((url, i) => `<div class="cpt-photo-item" data-index="${i}" style="position:relative;display:inline-block;margin:4px;"><img src="${escapeHtml(getOptimizedUrl(url, 80, 60))}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;"><button type="button" onclick="removeCPTBuilderPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#e74c3c;color:#fff;border:0;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:18px;text-align:center;">×</button></div>`).join('');
}

function openCPTPhotoPicker() {
  mediaPickerState = { isOpen: true, blockId: '__cpt_photos__', fieldName: 'photos', type: 'image', folderId: null, folders: [], items: [], multiple: true, selectedIds: [] };
  ensureMediaPickerModal(); showLoading();
  Promise.all([apiFetch('/media/folders'), apiFetch('/media?all=1')]).then(([res, items]) => { mediaPickerState.folders = res.folders || []; mediaPickerState.totalCount = res.total || 0; mediaPickerState.items = items; hideLoading(); document.getElementById('mediaPickerModal').classList.add('is-open'); updateMediaPickerContent(); }).catch(() => hideLoading());
}

function removeCPTPhoto(index) {
  const input = document.getElementById('cptPhotosInput');
  let photos = []; try { photos = JSON.parse(input.value || '[]'); } catch { photos = []; }
  photos.splice(index, 1); input.value = JSON.stringify(photos); updateCPTPhotosPreview(photos);
}

function updateCPTPhotosPreview(photos) {
  const preview = document.getElementById('cptPhotosPreview');
  if (!preview) return;
  if (photos.length === 0) { preview.innerHTML = '<p style="color:#999;font-size:13px;">Aucune photo</p>'; return; }
  preview.innerHTML = photos.map((url, i) => `<div class="cpt-photo-item" data-index="${i}" style="position:relative;display:inline-block;margin:4px;"><img src="${escapeHtml(url)}" style="width:100px;height:80px;object-fit:cover;border-radius:4px;"><button type="button" class="btn-remove-photo" onclick="removeCPTPhoto(${i})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#e74c3c;color:#fff;border:0;cursor:pointer;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;">×</button></div>`).join('');
}

async function saveCPTItemFromForm(ptDef) {
  const form = document.getElementById('cptEditForm');
  if (!form) return;
  const formData = new FormData(form);
  const itemId = form.dataset.itemId ? parseInt(form.dataset.itemId) : null;
  const hasCustomFields = ptDef.fields && ptDef.fields.length > 0;
  for (const [fieldName, q] of Object.entries(window._cptQuills)) { const inp = form.querySelector(`input[name="cf_${fieldName}"]`); if (inp && q) inp.value = q.root.innerHTML; }
  const custom_fields = { ...window._cptEditExistingCF };
  if (hasCustomFields) {
    for (const field of ptDef.fields) {
      const ftype = (field.type || 'Text').toLowerCase();
      if (ftype === 'link') { const fn = field.name; const linkUrl = formData.get(`cf_${fn}_url`) || ''; const linkTitle = formData.get(`cf_${fn}_title`) || ''; const linkTarget = formData.get(`cf_${fn}_target`) || '_self'; custom_fields[fn] = linkUrl ? JSON.stringify({ url: linkUrl, title: linkTitle, target: linkTarget }) : ''; }
      else if (ftype === 'address') { const fn = field.name; const addr = { address: formData.get(`cf_${fn}__address`) || '', street_number: formData.get(`cf_${fn}__street_number`) || '', street_name: formData.get(`cf_${fn}__street_name`) || '', post_code: formData.get(`cf_${fn}__post_code`) || '', city: formData.get(`cf_${fn}__city`) || '', lat: formData.get(`cf_${fn}__lat`) || '', lng: formData.get(`cf_${fn}__lng`) || '' }; const hasAny = Object.values(addr).some(v => v !== ''); custom_fields[fn] = hasAny ? JSON.stringify(addr) : ''; }
      else if (field.name === 'photos' || ftype === 'photos') { custom_fields.photos = formData.get('cf_photos') || '[]'; }
      else if (ftype === 'truefalse') { const vals = formData.getAll(`cf_${field.name}`); custom_fields[field.name] = vals.includes('1') ? '1' : '0'; }
      else if (ftype === 'date') { const dateVal = formData.get(`cf_${field.name}`) || ''; custom_fields[field.name] = dateVal.replace(/-/g, '/'); }
      else if (ftype === 'json') { const val = formData.get(`cf_${field.name}`); if (val) custom_fields[field.name] = val; }
      else { custom_fields[field.name] = formData.get(`cf_${field.name}`) || ''; }
    }
  }
  const fiRaw = document.getElementById('cptFeaturedInput')?.value || '';
  let featured_image = null; try { if (fiRaw) featured_image = JSON.parse(fiRaw); } catch {}
  const categories = [];
  form.querySelectorAll('.cpt-categories-checkboxes input[type="checkbox"]:checked').forEach(cb => { categories.push(parseInt(cb.value)); });
  const _status = formData.get('status') || 'draft';
  const payload = { title: formData.get('title'), slug: formData.get('slug'), excerpt: formData.get('excerpt') || '', content: formData.get('content') || '', status: _status, featured_image, custom_fields, categories, published_date: _status === 'published' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null };
  try { showLoading(); if (itemId) { await apiFetch(`/cpt/${ptDef.slug}/${itemId}`, { method: 'PUT', body: JSON.stringify(payload) }); showToast(`${ptDef.label} mis à jour`, 'success'); } else { await apiFetch(`/cpt/${ptDef.slug}`, { method: 'POST', body: JSON.stringify(payload) }); showToast(`${ptDef.label} créé`, 'success'); } hideLoading(); loadSection(`cpt:${ptDef.slug}`); } catch (error) { hideLoading(); showToast(error.message || 'Erreur lors de la sauvegarde', 'error'); }
}

async function duplicateCPTItem(postTypeSlug, itemId) {
  showLoading();
  try {
    const source = await apiFetch(`/cpt/${postTypeSlug}/by-id/${itemId}`);
    if (!source) { hideLoading(); showToast('Élément introuvable', 'error'); return; }
    const allItems = await apiFetch(`/cpt/${postTypeSlug}`);
    const existingSlugs = new Set(allItems.map(i => i.slug));
    const baseSlug = source.slug + '-copie'; let slug = baseSlug; let counter = 1;
    while (existingSlugs.has(slug)) { slug = `${baseSlug}-${counter}`; counter++; }
    const cf = typeof source.custom_fields === 'string' ? JSON.parse(source.custom_fields) : (source.custom_fields || {});
    const categories = (source.categories || []).map(c => c.id);
    await apiFetch(`/cpt/${postTypeSlug}`, { method: 'POST', body: JSON.stringify({ title: source.title + ' (copie)', slug, excerpt: source.excerpt || '', content: source.content || '', status: 'draft', featured_image: source.featured_image || null, custom_fields: cf, categories }) });
    showToast('Élément dupliqué', 'success'); loadSection(`cpt:${postTypeSlug}`);
  } catch (error) { hideLoading(); showToast('Erreur: ' + error.message, 'error'); }
}

async function deleteCPTItemUI(postTypeSlug, itemId, title) {
  if (!confirm(`Supprimer "${title}" ?`)) return;
  try { await apiFetch(`/cpt/${postTypeSlug}/${itemId}`, { method: 'DELETE' }); showToast('Élément supprimé', 'success'); loadSection(`cpt:${postTypeSlug}`); } catch { showToast('Erreur lors de la suppression', 'error'); }
}

// ========== CPT CATEGORIES PAGE ==========
// (renderCPTCategoriesPage, createCPTCategoryUI, editCPTCategory, closeCPTCatModal,
//  submitCPTCatEdit, deleteCPTCategory, confirmDeleteCPTCategory)
// These remain in legacy app.js — they are already on window and work via globals.

// ========== PLUGIN OPTIONS PAGE ==========
// (renderPluginOptionsPage, attachPluginOptionsEvents, savePluginOptions)
// These remain in legacy app.js.

// ========== CPT OPTIONS PAGE ==========
// (renderCPTOptionsPage, attachCPTOptionsEvents, createCPTOptionsQuill,
//  openCPTOptionsImgPicker, clearCPTOptionsImg, saveCPTOptions)
// These remain in legacy app.js.

// ========== CPT BUILDER ==========
// (openCPTBuilder, applyBlocksOnlyMode, saveCPTBuilder)
// These remain in legacy app.js.

// Expose all extracted functions on window
// ========== CPT CATEGORIES PAGE ==========

async function renderCPTCategoriesPage(ptDef) {
  showLoading();
  try {
    const categories = await apiFetch(`/cpt/${ptDef.slug}/categories`);
    hideLoading();

    const rows = categories.map(cat => {
      const safeName = escapeHtml(cat.name).replace(/'/g, "\\'");
      return '<div class="page-item">'
        + '<div class="page-item__info" style="cursor:pointer" onclick="editCPTCategory(\'' + escapeHtml(ptDef.slug) + '\', ' + cat.id + ', \'' + safeName + '\')">'
        +   '<div class="page-item__title">' + escapeHtml(cat.name) + '</div>'
        + '</div>'
        + '<div class="page-item__parent"><span class="page-item__slug" style="display:inline">' + escapeHtml(cat.slug) + '</span></div>'
        + '<div class="page-item__actions">'
        +   '<button class="btn-icon-action" onclick="editCPTCategory(\'' + escapeHtml(ptDef.slug) + '\', ' + cat.id + ', \'' + safeName + '\')" title="Modifier">' + _svgEdit + '</button>'
        +   '<button class="btn-icon-action btn-icon-action--danger" onclick="deleteCPTCategory(\'' + escapeHtml(ptDef.slug) + '\', ' + cat.id + ', \'' + safeName + '\')" title="Supprimer">' + _svgDelete + '</button>'
        + '</div>'
      + '</div>';
    }).join('');

    return `
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <button class="btn btn-outline btn-sm" onclick="loadSection('cpt:${escapeHtml(ptDef.slug)}')">← Retour</button>
          <h1>${escapeHtml(ptDef.categoryLabel || 'Catégories')}</h1>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:350px 1fr;gap:24px;align-items:start;">
        <div class="card">
          <h3 style="margin-bottom:12px;">Ajouter une catégorie</h3>
          <form onsubmit="createCPTCategoryUI(event, '${escapeHtml(ptDef.slug)}')">
            <div class="form-group">
              <label class="form-label">Nom</label>
              <input type="text" class="form-input" name="name" required>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Ajouter</button>
          </form>
        </div>

        <div class="card">
          ${categories.length > 0 ? `
            <div class="pages-list">
              <div class="pages-list-header">
                <span class="page-item__info">Nom</span>
                <span class="page-item__parent">Slug</span>
                <span class="page-item__actions" style="opacity:1">Actions</span>
              </div>
              ${rows}
            </div>
          ` : renderEmptyState('🏷️', 'Aucune catégorie', 'Ajoutez votre première catégorie')}
        </div>
      </div>
    `;
  } catch {
    hideLoading();
    return '<div class="card"><p>Erreur de chargement</p></div>';
  }
}

async function createCPTCategoryUI(event, postTypeSlug) {
  event.preventDefault();
  const form = event.target;
  const name = new FormData(form).get('name');
  try {
    await apiFetch(`/cpt/${postTypeSlug}/categories`, { method: 'POST', body: JSON.stringify({ name }) });
    showToast('Catégorie créée', 'success');
    loadSection(`cpt-categories:${postTypeSlug}`);
  } catch (error) {
    showToast(error.message || 'Erreur', 'error');
  }
}

function editCPTCategory(postTypeSlug, catId, currentName) {
  // Remove previous modal if any
  const prev = document.getElementById('cptCatModal');
  if (prev) prev.remove();

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay active" id="cptCatModal">
      <div class="modal" style="max-width:420px">
        <div class="modal-header">
          <h2>Modifier la catégorie</h2>
          <button class="modal-close" onclick="closeCPTCatModal()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="cptCatEditForm" onsubmit="submitCPTCatEdit(event, '${escapeHtml(postTypeSlug)}', ${catId})">
            <div class="form-group">
              <label class="form-label">Nom</label>
              <input type="text" class="form-input" name="name" value="${escapeHtml(currentName)}" required autofocus>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-outline" onclick="closeCPTCatModal()">Annuler</button>
              <button type="submit" class="btn btn-primary">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `);

  // Focus input & select text
  const input = document.querySelector('#cptCatEditForm input[name="name"]');
  if (input) { input.focus(); input.select(); }

  // Close on overlay click
  document.getElementById('cptCatModal').addEventListener('click', function(e) {
    if (e.target === this) closeCPTCatModal();
  });
}

function closeCPTCatModal() {
  const m = document.getElementById('cptCatModal');
  if (m) m.remove();
}

async function submitCPTCatEdit(event, postTypeSlug, catId) {
  event.preventDefault();
  const name = new FormData(event.target).get('name');
  try {
    await apiFetch(`/cpt/${postTypeSlug}/categories/${catId}`, { method: 'PUT', body: JSON.stringify({ name }) });
    closeCPTCatModal();
    showToast('Catégorie mise à jour', 'success');
    loadSection(`cpt-categories:${postTypeSlug}`);
  } catch (error) {
    showToast(error.message || 'Erreur', 'error');
  }
}

function deleteCPTCategory(postTypeSlug, catId, name) {
  const prev = document.getElementById('cptCatModal');
  if (prev) prev.remove();

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay active" id="cptCatModal">
      <div class="modal" style="max-width:420px">
        <div class="modal-header">
          <h2>Supprimer la catégorie</h2>
          <button class="modal-close" onclick="closeCPTCatModal()">&times;</button>
        </div>
        <div class="modal-body">
          <p>Supprimer la catégorie <strong>${escapeHtml(name)}</strong> ?</p>
          <p style="color:var(--gray-500);font-size:13px;margin-top:4px;">Cette action est irréversible.</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" onclick="closeCPTCatModal()">Annuler</button>
            <button type="button" class="btn btn-danger" onclick="confirmDeleteCPTCategory('${escapeHtml(postTypeSlug)}', ${catId})">Supprimer</button>
          </div>
        </div>
      </div>
    </div>
  `);

  document.getElementById('cptCatModal').addEventListener('click', function(e) {
    if (e.target === this) closeCPTCatModal();
  });
}

async function confirmDeleteCPTCategory(postTypeSlug, catId) {
  try {
    await apiFetch(`/cpt/${postTypeSlug}/categories/${catId}`, { method: 'DELETE' });
    closeCPTCatModal();
    showToast('Catégorie supprimée', 'success');
    loadSection(`cpt-categories:${postTypeSlug}`);
  } catch {
    showToast('Erreur lors de la suppression', 'error');
  }
}

// ========== PLUGIN OPTIONS PAGE ==========

async function renderPluginOptionsPage(pluginDef) {
  showLoading();
  const prefix = `plugin_${pluginDef.name.replace(/-/g, '_')}_`;
  let settings = {};
  try {
    const allSettings = await apiFetch('/settings');
    for (const [key, value] of Object.entries(allSettings)) {
      if (key.startsWith(prefix)) {
        settings[key.replace(prefix, '')] = value;
      }
    }
  } catch { /* ignore */ }
  hideLoading();

  let fieldsHtml = '';
  for (const opt of pluginDef.options || []) {
    const val = settings[opt.name] !== undefined ? settings[opt.name] : (opt.default || '');
    const helper = opt.helperText ? `<small style="color:#888;display:block;margin-top:4px;">${escapeHtml(opt.helperText)}</small>` : '';
    const required = opt.required ? ' <span style="color:red;">*</span>' : '';

    if (opt.type === 'text') {
      fieldsHtml += `
        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label">${escapeHtml(opt.label)}${required}</label>
          <input type="text" class="form-input" name="${escapeHtml(opt.name)}" value="${escapeHtml(val)}"${opt.required ? ' required' : ''}>
          ${helper}
        </div>`;
    } else if (opt.type === 'range') {
      fieldsHtml += `
        <div class="form-group" style="margin-bottom:16px;max-width:300px;">
          <label class="form-label">${escapeHtml(opt.label)}${required}</label>
          <div style="display:flex;align-items:center;gap:12px;">
            <input type="range" name="${escapeHtml(opt.name)}" min="${opt.min || 1}" max="${opt.max || 10}" value="${escapeHtml(val)}" oninput="this.nextElementSibling.textContent=this.value" style="flex:1;">
            <span style="min-width:24px;text-align:center;font-weight:600;">${escapeHtml(val || opt.default || '3')}</span>
          </div>
          ${helper}
        </div>`;
    } else if (opt.type === 'select') {
      const optionsHtml = (opt.choices || []).map(c =>
        `<option value="${escapeHtml(c.value)}"${c.value === val ? ' selected' : ''}>${escapeHtml(c.label)}</option>`
      ).join('');
      fieldsHtml += `
        <div class="form-group" style="margin-bottom:16px;max-width:300px;">
          <label class="form-label">${escapeHtml(opt.label)}${required}</label>
          <select class="form-input" name="${escapeHtml(opt.name)}">${optionsHtml}</select>
          ${helper}
        </div>`;
    } else if (opt.type === 'toggle') {
      fieldsHtml += `
        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label">${escapeHtml(opt.label)}</label>
          <div class="cpt-toggle-group" data-name="${escapeHtml(opt.name)}">
            <button type="button" class="cpt-toggle-btn ${val !== '0' ? 'active' : ''}" data-value="1">Oui</button>
            <button type="button" class="cpt-toggle-btn ${val === '0' ? 'active' : ''}" data-value="0">Non</button>
          </div>
          <input type="hidden" name="${escapeHtml(opt.name)}" value="${escapeHtml(val || opt.default || '1')}">
          ${helper}
        </div>`;
    }
  }

  return `
    <div class="page-header">
      <h1>${pluginDef.icon || '🔌'} ${escapeHtml(pluginDef.label || pluginDef.name)} — Options</h1>
    </div>
    <div class="card">
      <form id="pluginOptionsForm" onsubmit="savePluginOptions(event, '${escapeHtml(pluginDef.name)}')">
        ${fieldsHtml}
        <div style="display:flex;justify-content:flex-end;margin-top:24px;">
          <button type="submit" class="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </div>
  `;
}

function attachPluginOptionsEvents() {
  document.querySelectorAll('#pluginOptionsForm .cpt-toggle-group').forEach(group => {
    const name = group.dataset.name;
    const hiddenInput = group.parentElement.querySelector(`input[name="${name}"]`);
    group.querySelectorAll('.cpt-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.cpt-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (hiddenInput) hiddenInput.value = btn.dataset.value;
      });
    });
  });
}

async function savePluginOptions(event, pluginName) {
  event.preventDefault();
  const form = event.target;
  const prefix = `plugin_${pluginName.replace(/-/g, '_')}_`;
  const formData = new FormData(form);
  const settings = {};
  for (const [key, value] of formData.entries()) {
    settings[`${prefix}${key}`] = value;
  }
  try {
    await apiFetch('/settings', { method: 'PUT', body: JSON.stringify({ settings }) });
    showToast('Options enregistrées', 'success');
  } catch (error) {
    showToast(error.message || 'Erreur', 'error');
  }
}

// ========== CPT OPTIONS PAGE ==========

window._cptOptionsQuill = null;

async function renderCPTOptionsPage(ptDef) {
  showLoading();
  let settings = {};
  try {
    const allSettings = await apiFetch('/settings');
    for (const [key, value] of Object.entries(allSettings)) {
      if (key.startsWith(`cpt_${ptDef.slug}_`)) {
        settings[key.replace(`cpt_${ptDef.slug}_`, '')] = value;
      }
    }
  } catch { /* ignore */ }
  hideLoading();

  const headerImg = settings.header_img || '';
  const headerImgPreview = headerImg
    ? `<img src="${escapeHtml(headerImg)}" style="max-width:200px;max-height:120px;object-fit:cover;border-radius:6px;">`
    : '<span style="color:#999;font-size:13px;">Aucune image sélectionnée</span>';

  return `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px;">
        <button class="btn btn-outline btn-sm" onclick="loadSection('cpt:${escapeHtml(ptDef.slug)}')">← Retour</button>
        <h1>Page d'archive des ${escapeHtml((ptDef.labelPlural || ptDef.label).toLowerCase())}</h1>
      </div>
    </div>

    <div class="settings-tabs" style="margin-bottom:0;">
      <button type="button" class="settings-tab is-active" data-cpt-opt-tab="general">Général</button>
      <button type="button" class="settings-tab" data-cpt-opt-tab="affichage">Affichage</button>
    </div>

    <div class="card" style="margin-bottom:24px;border-top-left-radius:0;">
      <form id="cptOptionsForm" onsubmit="saveCPTOptions(event, '${escapeHtml(ptDef.slug)}')">

        <!-- Tab: Général -->
        <div class="cpt-opt-panel" data-cpt-opt-panel="general">
          <div class="form-row" style="grid-template-columns:2fr 1fr 1fr;">
            <div class="form-group">
              <label class="form-label">Titre de la page (h1)</label>
              <input type="text" class="form-input" name="archive_title" value="${escapeHtml(settings.archive_title || ptDef.labelPlural || 'Références')}">
            </div>
            <div class="form-group">
              <label class="form-label">Afficher le titre ?</label>
              <div class="cpt-toggle-group" data-name="title_in_header">
                <button type="button" class="cpt-toggle-btn ${settings.title_in_header !== 'hideTitle' ? 'active' : ''}" data-value="showTitle">Oui</button>
                <button type="button" class="cpt-toggle-btn ${settings.title_in_header === 'hideTitle' ? 'active' : ''}" data-value="hideTitle">Non</button>
              </div>
              <input type="hidden" name="title_in_header" value="${escapeHtml(settings.title_in_header || 'showTitle')}">
            </div>
            <div class="form-group">
              <label class="form-label">Balise H1 dans le titre ?</label>
              <div class="cpt-toggle-group" data-name="h1_in_header">
                <button type="button" class="cpt-toggle-btn ${settings.h1_in_header !== 'no' ? 'active' : ''}" data-value="yes">Oui</button>
                <button type="button" class="cpt-toggle-btn ${settings.h1_in_header === 'no' ? 'active' : ''}" data-value="no">Non</button>
              </div>
              <input type="hidden" name="h1_in_header" value="${escapeHtml(settings.h1_in_header || 'yes')}">
            </div>
          </div>
          <div class="form-row" style="grid-template-columns:1fr 1fr;margin-top:16px;">
            <div class="form-group">
              <label class="form-label">Description</label>
              <div id="cptOptionsDescEditor" style="min-height:200px;"></div>
              <input type="hidden" name="archive_desc" value="${escapeHtml(settings.archive_desc || '')}">
            </div>
            <div class="form-group">
              <label class="form-label">Image de fond</label>
              <div id="cptOptionsImgPreview" style="margin-bottom:8px;">${headerImgPreview}</div>
              <input type="hidden" name="header_img" id="cptOptionsImgInput" value="${escapeHtml(headerImg)}">
              <div style="display:flex;gap:8px;">
                <button type="button" class="btn btn-outline btn-sm" onclick="openCPTOptionsImgPicker()">Ajouter image</button>
                ${headerImg ? '<button type="button" class="btn btn-sm btn-danger-outline" onclick="clearCPTOptionsImg()">Supprimer</button>' : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- Tab: Affichage -->
        <div class="cpt-opt-panel" data-cpt-opt-panel="affichage" style="display:none;">
          <div class="form-group" style="max-width:25%;">
            <label class="form-label">Disposition du contenu</label>
            <div class="cpt-toggle-group" data-name="archive_display">
              <button type="button" class="cpt-toggle-btn ${settings.archive_display !== 'columns-2' ? 'active' : ''}" data-value="column-1">1 colonne</button>
              <button type="button" class="cpt-toggle-btn ${settings.archive_display === 'columns-2' ? 'active' : ''}" data-value="columns-2">2 colonnes</button>
            </div>
            <input type="hidden" name="archive_display" value="${escapeHtml(settings.archive_display || 'column-1')}">
          </div>
          <div class="form-group" style="max-width:25%;margin-top:16px;">
            <label class="form-label">Affichage individuel</label>
            <div class="cpt-toggle-group cpt-toggle-vertical" data-name="ref_display">
              <button type="button" class="cpt-toggle-btn ${settings.ref_display === 'page' ? 'active' : ''}" data-value="page">Page</button>
              <button type="button" class="cpt-toggle-btn ${settings.ref_display === 'popup' || !settings.ref_display ? 'active' : ''}" data-value="popup">Pop-up</button>
              <button type="button" class="cpt-toggle-btn ${settings.ref_display === 'both' ? 'active' : ''}" data-value="both">Les deux</button>
            </div>
            <input type="hidden" name="ref_display" value="${escapeHtml(settings.ref_display || 'popup')}">
          </div>
          <div class="form-group" style="max-width:25%;margin-top:16px;">
            <label class="form-label">Ordre d'affichage</label>
            <div class="cpt-toggle-group" data-name="randomise_refs">
              <button type="button" class="cpt-toggle-btn ${settings.randomise_refs !== 'random' ? 'active' : ''}" data-value="asc">Chronologique</button>
              <button type="button" class="cpt-toggle-btn ${settings.randomise_refs === 'random' ? 'active' : ''}" data-value="random">Aléatoire</button>
            </div>
            <input type="hidden" name="randomise_refs" value="${escapeHtml(settings.randomise_refs || 'asc')}">
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;margin-top:24px;">
          <button type="submit" class="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </div>
  `;
}

function attachCPTOptionsEvents() {
  // Tab switching
  document.querySelectorAll('[data-cpt-opt-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-cpt-opt-tab]').forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      document.querySelectorAll('[data-cpt-opt-panel]').forEach(p => p.style.display = 'none');
      const panel = document.querySelector(`[data-cpt-opt-panel="${tab.dataset.cptOptTab}"]`);
      if (panel) panel.style.display = '';
    });
  });

  // Toggle button groups
  document.querySelectorAll('.cpt-toggle-group').forEach(group => {
    const name = group.dataset.name;
    const hiddenInput = group.parentElement.querySelector(`input[name="${name}"]`);
    group.querySelectorAll('.cpt-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.cpt-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (hiddenInput) hiddenInput.value = btn.dataset.value;
      });
    });
  });

  // Init Quill for description
  const descContainer = document.getElementById('cptOptionsDescEditor');
  const descInput = document.querySelector('#cptOptionsForm input[name="archive_desc"]');
  if (descContainer && descInput) {
    if (typeof Quill === 'undefined') {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = 'https://cdn.quilljs.com/1.3.7/quill.snow.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://cdn.quilljs.com/1.3.7/quill.min.js';
      script.onload = () => createCPTOptionsQuill(descContainer, descInput);
      document.head.appendChild(script);
    } else {
      createCPTOptionsQuill(descContainer, descInput);
    }
  }
}

function createCPTOptionsQuill(container, hiddenInput) {
  window._cptOptionsQuill = new Quill(container, {
    theme: 'snow',
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, 4, 5, 6, false] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ align: [] }],
        ['link'],
        ['clean'],
        ['html']
      ],
      clipboard: { matchers: _quillCleanPasteMatchers() }
    }
  });
  if (hiddenInput.value) window._cptOptionsQuill.root.innerHTML = hiddenInput.value;
  window._cptOptionsQuill.on('text-change', () => {
    hiddenInput.value = window._cptOptionsQuill.root.innerHTML;
  });
  attachHtmlSourceToggle(window._cptOptionsQuill, {
    getHtml: () => window._cptOptionsQuill.root.innerHTML,
    onSync: (html) => { hiddenInput.value = html; }
  });
}

function openCPTOptionsImgPicker() {
  mediaPickerState = {
    isOpen: true,
    blockId: '__cpt_options_img__',
    fieldName: 'header_img',
    type: 'image',
    folderId: null,
    folders: [],
    items: [],
    multiple: false,
    selectedIds: []
  };
  ensureMediaPickerModal();
  showLoading();
  Promise.all([apiFetch('/media/folders'), apiFetch('/media?all=1')])
    .then(([res, items]) => {
      mediaPickerState.folders = res.folders || [];
      mediaPickerState.totalCount = res.total || 0;
      mediaPickerState.items = items;
      hideLoading();
      updateMediaPickerContent();
    })
    .catch(() => hideLoading());
}

function clearCPTOptionsImg() {
  document.getElementById('cptOptionsImgInput').value = '';
  document.getElementById('cptOptionsImgPreview').innerHTML = '<span style="color:#999;font-size:13px;">Aucune image sélectionnée</span>';
}

async function saveCPTOptions(event, postTypeSlug) {
  event.preventDefault();
  const form = event.target;
  // Sync Quill
  if (window._cptOptionsQuill) {
    form.querySelector('input[name="archive_desc"]').value = window._cptOptionsQuill.root.innerHTML;
  }
  const formData = new FormData(form);
  const settings = {};
  for (const [key, value] of formData.entries()) {
    settings[`cpt_${postTypeSlug}_${key}`] = value;
  }
  try {
    await apiFetch('/settings', { method: 'PUT', body: JSON.stringify({ settings }) });
    showToast('Options enregistrées', 'success');
  } catch (error) {
    showToast(error.message || 'Erreur', 'error');
  }
}

// ========== CPT BUILDER MODE ==========
// Reuses the page builder for CPTs that have content support and no custom fields

async function openCPTBuilder(ptDef, itemId, opts = {}) {
  clearBuilderDirty();
  window.pageBuilderState.editingPageId = itemId;
  window.pageBuilderState.blocks = [];
  window.pageBuilderState.meta = { title: '', slug: '', status: 'draft', show_in_menu: false, menu_order: 0, parent_id: null };
  window.pageBuilderState.colorOverrides = { enabled: false, primary_color: '', secondary_color: '', tertiary_color: '', text_color: '', background_color: '', bg_form_field: '' };
  window.pageBuilderState.seoMeta = { enabled: true, meta_title: '', meta_description: '' };
  // Reset puis applique le mode "blocks-only" si demandé (ex: depuis product-editor).
  // Dans ce mode, seul l'onglet Modules est affiché et le bouton ← Retour pointe
  // vers la section custom indiquée (typiquement cpt-edit:slug:id pour rouvrir l'editor.url override).
  window.pageBuilderState.blocksOnlyMode = !!opts.blocksOnly;
  window.pageBuilderState.blocksOnlyBackSection = opts.backSection || null;
  window.pageBuilderState.cptMode = ptDef;
  window.pageBuilderState.cptExcerpt = '';
  window.pageBuilderState.cptFeaturedImage = null;
  window.pageBuilderState.cptCategories = [];
  window.pageBuilderState.cptItemCategories = [];
  window.pageBuilderState.cptCustomFields = {};
  window.pageBuilderState.cptHeaderSettings = { h1_in_header: 'yes', title_in_header: 'showTitle' };
  window.pageBuilderState.pageMenus = [];
  window.selectedBlockId = null;

  localStorage.setItem('adminLastView', `cpt-${itemId ? 'edit' : 'add'}:${ptDef.slug}${itemId ? ':' + itemId : ''}`);
  await loadModuleFieldSchema();
  ensureBaseModuleStyles();

  if (itemId) {
    showLoading();
    try {
      const fetches = [
        apiFetch(`/cpt/${ptDef.slug}/by-id/${itemId}`),
        ptDef.hasCategories ? apiFetch(`/cpt/${ptDef.slug}/categories`) : Promise.resolve([]),
      ];
      const [item, categories] = await Promise.all(fetches);
      if (item) {
        window.pageBuilderState.blocks = parsePageContent(item.content);
        window.pageBuilderState.meta = { title: item.title, slug: item.slug, status: item.status, show_in_menu: false, menu_order: 0, parent_id: null };
        window.pageBuilderState.cptExcerpt = item.excerpt || '';
        window.pageBuilderState.cptFeaturedImage = item.featured_image || null;
        window.pageBuilderState.cptItemCategories = item.categories || [];
        window.pageBuilderState.cptCustomFields = typeof item.custom_fields === 'string' ? JSON.parse(item.custom_fields || '{}') : (item.custom_fields || {});
        // Load header settings from custom_fields
        const cf = window.pageBuilderState.cptCustomFields;
        window.pageBuilderState.cptHeaderSettings = {
          h1_in_header: cf.h1_in_header || 'yes',
          title_in_header: cf.title_in_header || 'showTitle',
        };
        if (item.seo_meta) {
          const seo = typeof item.seo_meta === 'string' ? JSON.parse(item.seo_meta) : item.seo_meta;
          window.pageBuilderState.seoMeta = { enabled: true, meta_title: seo.meta_title || '', meta_description: seo.meta_description || '', schema_org: seo.schema_org || '' };
        }
      }
      window.pageBuilderState.cptCategories = categories || [];
    } catch (e) { console.error(e); }
    hideLoading();
  } else {
    // New item — load categories
    if (ptDef.hasCategories) {
      try { window.pageBuilderState.cptCategories = await apiFetch(`/cpt/${ptDef.slug}/categories`) || []; } catch {}
    }
  }

  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  const cptNav = document.querySelector(`.nav-item[data-section="cpt:${ptDef.slug}"]`);
  if (cptNav) cptNav.classList.add('active');
  document.getElementById('content').innerHTML = await renderPageBuilder();
  attachPageBuilderListeners();
  if (siteSettingsCache) {
    const canvas = document.getElementById('builderCanvas');
    if (canvas) canvas.classList.toggle('border-rounded', siteSettingsCache.rounded === '1');
  }
  applyBlocksOnlyMode();
}

/**
 * Post-render hook : si blocksOnlyMode actif (ex: depuis product-editor),
 * ne montre que l'onglet "Modules" dans la sidebar du builder + masque
 * les autres tabs (Header / SEO Meta / Contenu) et l'image à la une (gérée
 * par l'éditeur custom).
 */
function applyBlocksOnlyMode() {
  if (!window.pageBuilderState.blocksOnlyMode) return;
  const sidebar = document.querySelector('.builder-modules-panel') || document.getElementById('content');
  if (!sidebar) return;

  // Masque tous les onglets sauf "cpt-modules" et "page-modules", auto-active Modules.
  sidebar.querySelectorAll('.cpt-builder-tab').forEach(tab => {
    const t = tab.dataset.tab || '';
    const isModules = t === 'cpt-modules' || t === 'page-modules';
    tab.style.display = isModules ? '' : 'none';
    if (isModules) {
      tab.classList.add('active');
      tab.style.borderBottomColor = 'var(--primary,#224f5a)';
      tab.style.color = 'var(--primary,#224f5a)';
    } else {
      tab.classList.remove('active');
    }
  });
  sidebar.querySelectorAll('.cpt-builder-tab-content').forEach(panel => {
    const t = panel.dataset.tab || '';
    panel.style.display = (t === 'cpt-modules' || t === 'page-modules') ? '' : 'none';
  });

  // Masque featured image / excerpt / cats / custom fields (gérés par l'editor custom).
  document.querySelectorAll('[data-builder-cpt-sidebar]').forEach(el => el.style.display = 'none');
  // Heuristique : la sidebar gauche peut contenir un bloc "IMAGE À LA UNE" identifiable
  // par son data-attr ou par sa structure. Si ton thème expose une classe spécifique,
  // ajuste le sélecteur ici.
}

async function saveCPTBuilder() {
  const ptDef = window.pageBuilderState.cptMode;
  if (!ptDef) return;

  // Sync inline editing
  if (_inlineEditingBlockId && _inlineEditingElement) {
    _syncInlineContentToBlockData(_inlineEditingElement);
  }
  syncBuilderMetaFromDOM();
  // Sync all Quill editors
  _quillInstances.forEach((quill, id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const textarea = el.parentElement?.querySelector('.wysiwyg-source');
    if (textarea) textarea.value = (quill.getSemanticHTML() || '').replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');
  });
  // Sync currently open block settings
  const panel = document.getElementById('builderSettings');
  const form = panel?.querySelector('form.builder-block-form');
  if (form && window.selectedBlockId) {
    liveUpdateFromSettingsForm(form);
  }

  const { title, slug, status } = window.pageBuilderState.meta;
  if (!title || !slug) { showToast('Titre et slug requis', 'error'); return; }

  const content = JSON.stringify(window.pageBuilderState.blocks);

  // Read excerpt from DOM
  const excerptEl = document.getElementById('cptBuilderExcerpt');
  const excerpt = excerptEl ? excerptEl.value : window.pageBuilderState.cptExcerpt;

  // Read featured image
  const fiInput = document.getElementById('cptBuilderFeaturedInput');
  let featured_image = null;
  try { if (fiInput?.value) featured_image = JSON.parse(fiInput.value); } catch {}

  // Read categories
  const categories = [];
  document.querySelectorAll('.cpt-builder-categories input[type="checkbox"]:checked').forEach(cb => {
    categories.push(parseInt(cb.value));
  });

  // Read custom fields from sidebar — start from existing to preserve plugin-managed fields
  const custom_fields = { ...(window.pageBuilderState.cptCustomFields || {}) };
  if (ptDef.fields && ptDef.fields.length > 0) {
    for (const field of ptDef.fields) {
      const ftype = (field.type || 'Text').toLowerCase();
      if (ftype === 'link') {
        const fn = field.name;
        const linkUrl = document.getElementById(`cptBf_${fn}_url`)?.value || '';
        const linkTitle = document.getElementById(`cptBf_${fn}_title`)?.value || '';
        const linkTarget = document.getElementById(`cptBf_${fn}_target`)?.value || '_self';
        custom_fields[fn] = linkUrl ? JSON.stringify({ url: linkUrl, title: linkTitle, target: linkTarget }) : '';
      } else if (field.name === 'photos' || ftype === 'photos') {
        custom_fields.photos = document.getElementById('cptBuilderPhotosInput')?.value || '[]';
      } else if (ftype === 'address') {
        const fn = field.name;
        const addr = {
          address: document.querySelector(`input[name="cf_${fn}__address"]`)?.value || '',
          street_number: document.querySelector(`input[name="cf_${fn}__street_number"]`)?.value || '',
          street_name: document.querySelector(`input[name="cf_${fn}__street_name"]`)?.value || '',
          post_code: document.querySelector(`input[name="cf_${fn}__post_code"]`)?.value || '',
          city: document.querySelector(`input[name="cf_${fn}__city"]`)?.value || '',
          lat: document.querySelector(`input[name="cf_${fn}__lat"]`)?.value || '',
          lng: document.querySelector(`input[name="cf_${fn}__lng"]`)?.value || ''
        };
        const hasAny = Object.values(addr).some(v => v !== '');
        custom_fields[fn] = hasAny ? JSON.stringify(addr) : '';
      } else if (ftype === 'truefalse') {
        const cb = document.querySelector(`.cpt-builder-cf-toggle[data-cf="${field.name}"]`);
        if (cb) custom_fields[field.name] = cb.checked ? '1' : '0';
      } else if (ftype === 'json') {
        // Json fields managed by plugin editors — preserve existing value, don't overwrite from DOM
        const el = document.querySelector(`.cpt-builder-cf[data-cf="${field.name}"]`);
        if (el && el.value) custom_fields[field.name] = el.value;
      } else {
        const el = document.querySelector(`.cpt-builder-cf[data-cf="${field.name}"]`);
        if (el) custom_fields[field.name] = el.value || '';
      }
    }
  }

  // Read header settings from DOM (checkbox toggles)
  const h1Cb = document.querySelector('input[name="h1_in_header"]');
  const titleCb = document.querySelector('input[name="title_in_header"]');
  if (h1Cb) custom_fields.h1_in_header = h1Cb.checked ? 'yes' : 'no';
  if (titleCb) custom_fields.title_in_header = titleCb.checked ? 'showTitle' : 'hideTitle';

  const published_date = status === 'published' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
  const seo_meta = JSON.stringify(window.pageBuilderState.seoMeta);
  const payload = { title, slug, excerpt, content, status, featured_image, custom_fields, categories, published_date, seo_meta };

  showLoading();
  try {
    if (window.pageBuilderState.editingPageId) {
      await apiFetch(`/cpt/${ptDef.slug}/${window.pageBuilderState.editingPageId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast(`${ptDef.label} mis à jour`, 'success');
    } else {
      const res = await apiFetch(`/cpt/${ptDef.slug}`, { method: 'POST', body: JSON.stringify(payload) });
      showToast(`${ptDef.label} créé`, 'success');
      if (res?.id) {
        window.pageBuilderState.editingPageId = res.id;
        localStorage.setItem('adminLastView', `cpt-edit:${ptDef.slug}:${res.id}`);
      }
    }
    clearBuilderDirty();
  } catch (error) {
    showToast(error.message || 'Erreur lors de la sauvegarde', 'error');
  }
  hideLoading();
}

Object.assign(window, {
  renderCPTList,
  attachCPTListEvents,
  cptListSortBy,
  renderCPTListRows,
  renderCPTEditPage,
  attachCPTFormEvents,
  initCPTLivePreview,
  initCPTQuillEditors,
  createCPTQuill,
  openCPTFeaturedPicker,
  clearCPTFeatured,
  openCPTCfImagePicker,
  clearCPTCfImage,
  openCPTBuilderFeaturedPicker,
  clearCPTBuilderFeatured,
  openCPTBuilderPhotoPicker,
  removeCPTBuilderPhoto,
  updateCPTBuilderPhotosPreview,
  openCPTPhotoPicker,
  removeCPTPhoto,
  updateCPTPhotosPreview,
  saveCPTItemFromForm,
  duplicateCPTItem,
  deleteCPTItemUI,
  renderCPTCategoriesPage,
  createCPTCategoryUI,
  editCPTCategory,
  closeCPTCatModal,
  submitCPTCatEdit,
  deleteCPTCategory,
  confirmDeleteCPTCategory,
  renderPluginOptionsPage,
  attachPluginOptionsEvents,
  savePluginOptions,
  renderCPTOptionsPage,
  attachCPTOptionsEvents,
  createCPTOptionsQuill,
  openCPTOptionsImgPicker,
  clearCPTOptionsImg,
  saveCPTOptions,
  openCPTBuilder,
  applyBlocksOnlyMode,
  saveCPTBuilder,
});

