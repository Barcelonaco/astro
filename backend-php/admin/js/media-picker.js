// ========== MEDIA PICKER ==========
// Extracted from app.js — media picker modal functions
// Globals from state.js: mediaPickerState, settingsMediaPickerTarget
// Globals from media.js: renderMediaCard, getOptimizedUrl (utils.js)

function ensureMediaPickerModal() {
  if (document.getElementById('mediaPickerModal')) return;
  const modal = document.createElement('div');
  modal.id = 'mediaPickerModal';
  modal.className = 'media-modal';
  modal.innerHTML = `
    <div class="media-modal-backdrop" onclick="closeMediaPicker()"></div>
    <div class="media-modal-panel">
      <div class="media-modal-header">
        <div>
          <div class="media-modal-title">Médiathèque</div>
          <div class="media-modal-subtitle">Sélectionnez un média</div>
        </div>
        <div class="media-modal-header-actions">
          <div class="media-modal-actions" id="mediaPickerActions"></div>
          <button class="btn-close-modal" onclick="createMediaPickerFolder()">+ Dossier</button>
          <label class="btn-upload">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
            Importer
            <input type="file" multiple accept="image/*,video/*,application/pdf,.pdf" onchange="handleMediaPickerUpload(event)" style="display:none">
          </label>
          <button class="btn-close-modal" onclick="closeMediaPicker()">Fermer</button>
        </div>
      </div>
      <div class="media-modal-body">
        <aside class="media-sidebar">
          <div class="media-search">
            <input type="text" class="media-search-input" id="mediaPickerSearchInput" placeholder="Rechercher un média…" oninput="handleMediaPickerSearch(this.value)" />
            <button class="media-search-clear" id="mediaPickerSearchClear" onclick="clearMediaPickerSearch()" title="Effacer" style="display:none">&times;</button>
          </div>
          <h3>Dossiers</h3>
          <div class="media-folder-list" id="mediaPickerFolders"></div>
        </aside>
        <section class="media-grid" id="mediaPickerGrid"></section>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ── Settings media picker (for logo/favicon fields) ──
let settingsMediaPickerTarget = null;

async function openSettingsMediaPicker(settingName) {
  window.settingsMediaPickerTarget = settingName;
  settingsMediaPickerTarget = settingName;
  window.mediaPickerState = {
    isOpen: true,
    blockId: '__settings__',
    fieldName: settingName,
    type: 'image',
    folderId: null,
    folders: [],
    items: [],
    multiple: false,
    selectedIds: []
  };
  ensureMediaPickerModal();
  showLoading();
  try {
    const fRes = await apiFetch('/media/folders');
    mediaPickerState.folders = fRes.folders || [];
    mediaPickerState.totalCount = fRes.total || 0;
    mediaPickerState.items = await apiFetch('/media?all=1');
  } catch (e) {
    mediaPickerState.folders = [];
    mediaPickerState.items = [];
  } finally {
    hideLoading();
  }
  updateMediaPickerContent();
  document.getElementById('mediaPickerModal').classList.add('is-open');
}

function clearSettingsMedia(settingName) {
  const field = document.querySelector(`.settings-media-field[data-setting="${settingName}"]`);
  if (!field) return;
  field.querySelector('input[type="hidden"]').value = '';
  field.querySelector('.settings-media-preview').innerHTML = '';
  const removeBtn = field.querySelector('.btn-danger-outline');
  if (removeBtn) removeBtn.remove();
  if (settingName === 'footer_bg_img') toggleFooterBgOptions();
}

async function openMediaPicker(type, blockId, fieldName, options = {}) {
  const normalizedOptions = typeof options === 'boolean' ? { multiple: options } : options;
  // trigger is the button element clicked — used to scope DOM writes to the
  // correct .media-field when duplicate field names exist in the form (e.g.
  // two same-type sub-modules in ColumnsTab columns).
  const triggerEl = normalizedOptions.trigger || null;
  const fieldEl = triggerEl ? triggerEl.closest('.media-field') : null;
  window.mediaPickerState = {
    isOpen: true,
    blockId,
    fieldName,
    fieldEl,
    type: type || 'all',
    folderId: null,
    folders: [],
    items: [],
    multiple: !!normalizedOptions.multiple,
    selectedIds: Array.isArray(normalizedOptions.selectedIds)
      ? normalizedOptions.selectedIds.map(id => String(id))
      : []
  };
  ensureMediaPickerModal();
  showLoading();
  try {
    const fRes = await apiFetch('/media/folders');
    mediaPickerState.folders = fRes.folders || [];
    mediaPickerState.totalCount = fRes.total || 0;
    mediaPickerState.items = await apiFetch('/media?all=1');
  } catch (e) {
    mediaPickerState.folders = [];
    mediaPickerState.items = [];
  } finally {
    hideLoading();
  }
  updateMediaPickerContent();
  const searchInput = document.getElementById('mediaPickerSearchInput');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('mediaPickerSearchClear');
  if (clearBtn) clearBtn.style.display = 'none';
  document.getElementById('mediaPickerModal').classList.add('is-open');
}

function closeMediaPicker() {
  mediaPickerState.isOpen = false;
  const modal = document.getElementById('mediaPickerModal');
  if (modal) modal.classList.remove('is-open');
}

async function handleMediaPickerUpload(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;
  const formData = new FormData();
  files.forEach(file => formData.append('files[]', file));
  if (mediaPickerState.folderId) formData.append('folder_id', mediaPickerState.folderId);
  showLoading();
  try {
    await apiUpload('/media/upload', formData);
    showToast('Médias importés', 'success');
    const [items, fRes] = await Promise.all([
      apiFetch(`/media?${mediaPickerState.folderId === null ? 'all=1' : 'folder_id=' + mediaPickerState.folderId}`),
      apiFetch('/media/folders')
    ]);
    mediaPickerState.items = items;
    mediaPickerState.folders = fRes.folders || [];
    mediaPickerState.totalCount = fRes.total || 0;
    updateMediaPickerContent();
  } catch (e) {
    showToast(e.message || "Erreur lors de l'import", 'error');
  } finally {
    hideLoading();
    event.target.value = '';
  }
}

async function createMediaPickerFolder() {
  const name = await promptModal('Nom du dossier ?', '');
  if (!name) return;
  try {
    await apiFetch('/media/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parent_id: null })
    });
    const fRes2 = await apiFetch('/media/folders');
    mediaPickerState.folders = fRes2.folders || [];
    mediaPickerState.totalCount = fRes2.total || 0;
    updateMediaPickerContent();
    showToast('Dossier créé', 'success');
  } catch (e) {
    showToast(e.message || 'Erreur lors de la création', 'error');
  }
}

async function selectMediaPickerFolder(folderId) {
  mediaPickerState.folderId = folderId;
  mediaPickerState.search = '';
  const searchInput = document.getElementById('mediaPickerSearchInput');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('mediaPickerSearchClear');
  if (clearBtn) clearBtn.style.display = 'none';
  showLoading();
  try {
    const query = folderId === null ? 'all=1' : `folder_id=${folderId}`;
    mediaPickerState.items = await apiFetch(`/media?${query}`);
  } catch (e) {
    mediaPickerState.items = [];
  } finally {
    hideLoading();
  }
  updateMediaPickerContent();
}

let _mediaPickerSearchTimer = null;
function handleMediaPickerSearch(value) {
  clearTimeout(_mediaPickerSearchTimer);
  window._mediaPickerSearchTimer = setTimeout(async () => {
    mediaPickerState.search = value;
    const params = new URLSearchParams();
    if (value) {
      params.set('search', value);
      if (mediaPickerState.folderId) params.set('folder_id', mediaPickerState.folderId);
    } else if (mediaPickerState.folderId === null) {
      params.set('all', '1');
    } else {
      params.set('folder_id', mediaPickerState.folderId);
    }
    try {
      mediaPickerState.items = await apiFetch(`/media?${params.toString()}`);
    } catch (e) {
      mediaPickerState.items = [];
    }
    updateMediaPickerContent();
    const clearBtn = document.getElementById('mediaPickerSearchClear');
    if (clearBtn) clearBtn.style.display = value ? '' : 'none';
  }, 300);
}

async function clearMediaPickerSearch() {
  mediaPickerState.search = '';
  const input = document.getElementById('mediaPickerSearchInput');
  if (input) input.value = '';
  const clearBtn = document.getElementById('mediaPickerSearchClear');
  if (clearBtn) clearBtn.style.display = 'none';
  try {
    mediaPickerState.items = await apiFetch(`/media?${mediaPickerState.folderId === null ? 'all=1' : 'folder_id=' + mediaPickerState.folderId}`);
  } catch (e) {
    mediaPickerState.items = [];
  }
  updateMediaPickerContent();
}

function updateMediaPickerContent() {
  const folderEl = document.getElementById('mediaPickerFolders');
  const gridEl = document.getElementById('mediaPickerGrid');
  const actionsEl = document.getElementById('mediaPickerActions');
  if (!folderEl || !gridEl) return;
  folderEl.innerHTML = `
    <button class="media-folder-item media-folder-all ${mediaPickerState.folderId === null ? 'is-active' : ''}" onclick="selectMediaPickerFolder(null)">
      Tous les médias <span class="media-folder-count">${mediaPickerState.totalCount || 0}</span>
    </button>
    <h3 style="margin:8px 0 4px;font-size:13px;font-weight:600;color:var(--gray-600)">Dossiers</h3>
  ` + mediaPickerState.folders.map(folder => `
    <button class="media-folder-item ${String(folder.id) === String(mediaPickerState.folderId) ? 'is-active' : ''}" onclick="selectMediaPickerFolder(${folder.id ?? 'null'})">
      ${escapeHtml(folder.name)} <span class="media-folder-count">${folder.media_count || 0}</span>
    </button>
  `).join('');
  const filtered = mediaPickerState.type === 'all'
    ? mediaPickerState.items
    : mediaPickerState.items.filter(item => item.type === mediaPickerState.type);
  gridEl.innerHTML = filtered.length === 0
    ? renderEmptyState('🖼️', 'Aucun média', 'Importez un média dans la médiathèque.')
    : filtered.map(item => renderMediaCard(item, true)).join('');
  if (actionsEl) {
    actionsEl.innerHTML = mediaPickerState.multiple
      ? `
          <button class="btn btn-outline btn-sm" onclick="clearMediaPickerSelection()">Tout effacer</button>
          <button class="btn btn-primary btn-sm" onclick="confirmMediaPickerSelection()">
            Ajouter (${mediaPickerState.selectedIds?.length || 0})
          </button>
        `
      : '';
  }
}

function selectMediaFromPicker(id) {
  const key = String(id);
  if (mediaPickerState.multiple) {
    const selected = new Set(mediaPickerState.selectedIds || []);
    if (selected.has(key)) selected.delete(key);
    else selected.add(key);
    mediaPickerState.selectedIds = Array.from(selected);
    updateMediaPickerContent();
    return;
  }
  const item = mediaPickerState.items.find(m => String(m.id) === key);
  if (!item) return;

  // Settings media picker (logo/favicon)
  if (mediaPickerState.blockId === '__settings__' && settingsMediaPickerTarget) {
    const settingName = settingsMediaPickerTarget;
    const field = document.querySelector(`.settings-media-field[data-setting="${settingName}"]`);
    if (field) {
      field.querySelector('input[type="hidden"]').value = item.url;
      field.querySelector('.settings-media-preview').innerHTML = `<img src="${escapeHtml(getOptimizedUrl(item.url, 400, 70))}" alt="${escapeHtml(item.original_name || '')}">`;
      // Add remove button if not present
      const actions = field.querySelector('.settings-media-actions');
      if (actions && !actions.querySelector('.btn-danger-outline')) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-sm btn-danger-outline';
        removeBtn.textContent = 'Supprimer';
        removeBtn.onclick = () => clearSettingsMedia(settingName);
        actions.appendChild(removeBtn);
      }
    }
    if (settingName === 'footer_bg_img') toggleFooterBgOptions();
    window.settingsMediaPickerTarget = null;
    settingsMediaPickerTarget = null;
    closeMediaPicker();
    return;
  }

  // CPT Featured image picker
  if (mediaPickerState.blockId === '__cpt_featured__') {
    const payload = { id: item.id, url: item.url, alt: item.alt || item.original_name || '', title: item.title || '', caption: item.caption || '', width: item.width || null, height: item.height || null, sizes: { thumbnail: item.url, half: item.url, banner: item.url } };
    document.getElementById('cptFeaturedInput').value = JSON.stringify(payload);
    document.getElementById('cptFeaturedPreview').innerHTML = `<img src="${escapeHtml(getOptimizedUrl(item.url, 400, 70))}" style="max-width:200px;max-height:150px;object-fit:cover;border-radius:8px;">`;
    closeMediaPicker();
    return;
  }

  // CPT Builder featured image picker
  if (mediaPickerState.blockId === '__cpt_builder_featured__') {
    const payload = { id: item.id, url: item.url, alt: item.alt || item.original_name || '', title: item.title || '', caption: item.caption || '', width: item.width || null, height: item.height || null, sizes: { thumbnail: item.url, half: item.url, banner: item.url } };
    document.getElementById('cptBuilderFeaturedInput').value = JSON.stringify(payload);
    pageBuilderState.cptFeaturedImage = payload;
    document.getElementById('cptBuilderFeaturedPreview').innerHTML = `<img src="${escapeHtml(getOptimizedUrl(item.url, 400, 70))}" style="max-width:100%;max-height:150px;object-fit:cover;border-radius:8px;">`;
    closeMediaPicker();
    return;
  }

  // CPT custom_fields image picker (Image/File/Video field types)
  if (mediaPickerState.blockId === '__cpt_cf__') {
    const fn = mediaPickerState.fieldName;
    const payload = { id: item.id, url: item.url, alt: item.alt || item.original_name || '', title: item.title || '', caption: item.caption || '', width: item.width || null, height: item.height || null, sizes: { thumbnail: item.url, half: item.url, banner: item.url } };
    const input = document.getElementById(`cptCfImageInput_${fn}`);
    const preview = document.getElementById(`cptCfImagePreview_${fn}`);
    if (input) input.value = JSON.stringify(payload);
    if (preview) preview.innerHTML = `<img src="${escapeHtml(getOptimizedUrl(item.url, 400, 70))}" style="max-width:240px;max-height:160px;object-fit:cover;border-radius:8px;display:block;">`;
    closeMediaPicker();
    return;
  }

  // External callback (ex: product-editor en iframe)
  if (mediaPickerState.blockId === '__external_callback__') {
    const cb = mediaPickerState.onSelect;
    closeMediaPicker();
    if (typeof cb === 'function') cb(item);
    return;
  }

  // CPT Options image picker (header_img)
  if (mediaPickerState.blockId === '__cpt_options_img__') {
    const input = document.getElementById('cptOptionsImgInput');
    const preview = document.getElementById('cptOptionsImgPreview');
    if (input) input.value = item.url;
    if (preview) preview.innerHTML = `<img src="${escapeHtml(getOptimizedUrl(item.url, 400, 70))}" style="max-width:100%;max-height:200px;object-fit:cover;border-radius:8px;">`;
    closeMediaPicker();
    return;
  }

  applyMediaSelection(mediaPickerState.blockId, mediaPickerState.fieldName, item);
  closeMediaPicker();
}

/** Update block.data for a (possibly compound) field name, handling repeater/group nesting. */
function setBlockDataField(block, fieldName, value) {
  if (!block || !block.data || typeof block.data !== 'object') return;
  if (!fieldName.includes('::')) {
    block.data = { ...block.data, [fieldName]: value };
    return;
  }
  const parts = fieldName.split('::');
  // Navigate to the deepest container and set the value
  let target = block.data;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (/^\d+$/.test(part)) {
      const idx = parseInt(part, 10);
      if (!Array.isArray(target) || !target[idx]) return;
      target = target[idx];
    } else {
      if (!target[part] || typeof target[part] !== 'object') return;
      target = target[part];
    }
  }
  const lastKey = parts[parts.length - 1];
  if (/^\d+$/.test(lastKey)) {
    if (Array.isArray(target)) target[parseInt(lastKey, 10)] = value;
  } else {
    target[lastKey] = value;
  }
}

function applyMediaSelection(blockId, fieldName, item) {
  const panel = document.getElementById('builderSettings');
  if (!panel) return;
  // Prefer the exact .media-field element the user clicked. Falls back to
  // name-based lookup for callers that don't supply a trigger element.
  const scopedField = mediaPickerState.fieldEl && document.contains(mediaPickerState.fieldEl)
    ? mediaPickerState.fieldEl
    : null;
  const input = scopedField
    ? scopedField.querySelector('input[type="hidden"]')
    : panel.querySelector(`input[name="${CSS.escape(fieldName)}"]`);
  if (!input) return;
  const payload = {
    id: item.id,
    url: item.url,
    alt: item.alt || '',
    title: item.title || '',
    caption: item.caption || '',
    type: item.type,
    original_name: item.original_name,
    mime_type: item.mime_type,
    size: item.size,
    width: item.width || null,
    height: item.height || null
  };
  input.value = JSON.stringify(payload);
  const wrapper = input.closest('.media-field');
  if (wrapper) {
    const preview = wrapper.querySelector('.media-preview');
    if (preview) {
      const isPdfItem = item.type === 'document' || item.mime_type === 'application/pdf' || /\.pdf$/i.test(item.url);
      preview.innerHTML = item.type === 'image'
        ? `<img src="${escapeHtml(getOptimizedUrl(item.url, 400, 70))}" alt="${escapeHtml(item.original_name)}">`
        : isPdfItem
        ? `<div class="media-preview-icon" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f8f9fa;border-radius:8px;padding:1rem;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg></div>`
        : `<div class="media-preview-icon">🎬</div>`;
    }
    const meta = wrapper.querySelector('.media-preview-meta');
    if (meta) meta.textContent = item.original_name || item.url;
  }
  // Synchroniser avec les données du bloc pour la sauvegarde et la prévisualisation
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  setBlockDataField(block, fieldName, payload);
  // Mettre à jour les champs conditionnels (ex: bg_opacity/bg_parallax dépendent de bg_img)
  const form = document.querySelector('#builderSettings form');
  if (form) {
    updateSchemaConditionals(form);
    // Full sync pour les champs profondément imbriqués (sub-modules dans colonnes)
    liveUpdateFromSettingsForm(form);
  } else {
    updateBlockCardPreview(blockId);
  }
}

function openMediaPickerMulti(type, blockId, fieldName) {
  const panel = document.getElementById('builderSettings');
  const input = panel?.querySelector(`input[name="${CSS.escape(fieldName)}"]`);
  let selectedIds = [];
  if (input?.value) {
    try {
      const parsed = JSON.parse(input.value);
      if (Array.isArray(parsed)) {
        selectedIds = parsed.map(item => String(item?.image?.id || item?.id || '')).filter(Boolean);
      }
    } catch (e) {
      selectedIds = [];
    }
  }
  openMediaPicker(type, blockId, fieldName, { multiple: true, selectedIds });
}

function clearMediaPickerSelection() {
  mediaPickerState.selectedIds = [];
  updateMediaPickerContent();
}

function confirmMediaPickerSelection() {
  const items = mediaPickerState.items.filter(item => (mediaPickerState.selectedIds || []).includes(String(item.id)));

  // External multi callback (ex: product-editor gallery en iframe)
  if (mediaPickerState.blockId === '__external_callback_multi__') {
    const cb = mediaPickerState.onSelectMulti;
    closeMediaPicker();
    if (typeof cb === 'function') cb(items);
    return;
  }

  // CPT Photos gallery picker (classic form)
  if (mediaPickerState.blockId === '__cpt_photos__') {
    const input = document.getElementById('cptPhotosInput');
    let existing = [];
    try { existing = JSON.parse(input.value || '[]'); } catch { existing = []; }
    const newUrls = items.map(item => item.url);
    const merged = [...existing, ...newUrls];
    input.value = JSON.stringify(merged);
    updateCPTPhotosPreview(merged);
    closeMediaPicker();
    return;
  }

  // CPT Builder Photos gallery picker
  if (mediaPickerState.blockId === '__cpt_builder_photos__') {
    const input = document.getElementById('cptBuilderPhotosInput');
    let existing = [];
    try { existing = JSON.parse(input.value || '[]'); } catch { existing = []; }
    const newUrls = items.map(item => item.url);
    const merged = [...existing, ...newUrls];
    input.value = JSON.stringify(merged);
    updateCPTBuilderPhotosPreview(merged);
    closeMediaPicker();
    return;
  }

  applyMediaSelectionMultiple(mediaPickerState.blockId, mediaPickerState.fieldName, items);
  closeMediaPicker();
}

function applyMediaSelectionMultiple(blockId, fieldName, items) {
  const panel = document.getElementById('builderSettings');
  if (!panel) return;
  const scopedField = mediaPickerState.fieldEl && document.contains(mediaPickerState.fieldEl)
    ? mediaPickerState.fieldEl
    : null;
  const input = scopedField
    ? scopedField.querySelector('input[type="hidden"]')
    : panel.querySelector(`input[name="${CSS.escape(fieldName)}"]`);
  if (!input) return;
  const payloadItems = items.map(item => ({
    id: item.id,
    url: item.url,
    alt: item.alt || '',
    title: item.title || '',
    caption: item.caption || '',
    type: item.type,
    original_name: item.original_name,
    mime_type: item.mime_type,
    size: item.size,
    width: item.width || null,
    height: item.height || null
  }));
  const payload = fieldName === 'list'
    ? payloadItems.map(media => ({ image: media }))
    : payloadItems;
  input.value = JSON.stringify(payload);
  const wrapper = input.closest('.media-field');
  if (wrapper) {
    const grid = wrapper.querySelector('.media-multi-grid');
    if (grid) {
      grid.innerHTML = payloadItems.map(item => `
        <div class="media-multi-thumb">
          <img src="${escapeHtml(getOptimizedUrl(item.url, 200, 60))}" alt="${escapeHtml(item.original_name || item.url)}">
        </div>
      `).join('');
    }
    const meta = wrapper.querySelector('.media-preview-meta');
    if (meta) {
      meta.textContent = payloadItems.length === 0
        ? 'Aucune photo sélectionnée'
        : `${payloadItems.length} photo${payloadItems.length > 1 ? 's' : ''} sélectionnée${payloadItems.length > 1 ? 's' : ''}`;
    }
  }
  // Synchroniser avec les données du bloc pour la sauvegarde et la prévisualisation
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  setBlockDataField(block, fieldName, payload);
  const form = document.querySelector('#builderSettings form');
  if (form) {
    liveUpdateFromSettingsForm(form);
  } else {
    updateBlockCardPreview(blockId);
  }
}

function clearMediaSelection(blockId, fieldName, triggerEl) {
  const panel = document.getElementById('builderSettings');
  if (!panel) return;
  // Scope to the .media-field the user clicked when available — avoids
  // collisions when multiple sub-modules share the same field name.
  const scopedField = triggerEl ? triggerEl.closest('.media-field') : null;
  const input = scopedField
    ? scopedField.querySelector('input[type="hidden"]')
    : panel.querySelector(`input[name="${CSS.escape(fieldName)}"]`);
  if (!input) return;
  input.value = '';
  const wrapper = input.closest('.media-field');
  if (wrapper) {
    const preview = wrapper.querySelector('.media-preview');
    if (preview) preview.innerHTML = '';
    const meta = wrapper.querySelector('.media-preview-meta');
    if (meta) meta.textContent = wrapper.classList.contains('media-field-multi') ? 'Aucune photo sélectionnée' : 'Aucun média sélectionné';
    const grid = wrapper.querySelector('.media-multi-grid');
    if (grid) grid.innerHTML = '';
  }
  // Mettre à jour les données du bloc pour refléter la suppression
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  setBlockDataField(block, fieldName, null);
  const form = document.querySelector('#builderSettings form');
  if (form) {
    liveUpdateFromSettingsForm(form);
  } else {
    updateBlockCardPreview(blockId);
  }
}

// ── Expose on window ──
Object.assign(window, {
  ensureMediaPickerModal,
  openSettingsMediaPicker,
  clearSettingsMedia,
  openMediaPicker,
  closeMediaPicker,
  handleMediaPickerUpload,
  createMediaPickerFolder,
  selectMediaPickerFolder,
  handleMediaPickerSearch,
  clearMediaPickerSearch,
  updateMediaPickerContent,
  selectMediaFromPicker,
  setBlockDataField,
  applyMediaSelection,
  applyMediaSelectionMultiple,
  openMediaPickerMulti,
  clearMediaPickerSelection,
  confirmMediaPickerSelection,
  clearMediaSelection,
});
