// ========== MEDIA LIBRARY ==========
// Extracted from app.js — media library functions
// Globals from state.js: mediaState, mediaTotalCount, mediaPickerState
// Globals from utils.js: escapeHtml, renderEmptyState, formatBytes, getOptimizedUrl

async function fetchMediaFolders() {
  try {
    const res = await apiFetch('/media/folders');
    mediaState.folders = res.folders || [];
    window.mediaTotalCount = res.total || 0;
  } catch (e) {
    mediaState.folders = [];
    window.mediaTotalCount = 0;
  }
}

async function fetchMediaItems(folderId = null) {
  const params = new URLSearchParams();
  if (mediaState.search) {
    params.set('search', mediaState.search);
    if (folderId) params.set('folder_id', folderId);
  } else if (folderId === null) {
    params.set('all', '1');
  } else {
    params.set('folder_id', folderId);
  }
  if (mediaState.typeFilter) params.set('type', mediaState.typeFilter);
  if (mediaState.sort) params.set('sort', mediaState.sort);
  try {
    mediaState.items = await apiFetch(`/media?${params.toString()}`);
  } catch (e) {
    mediaState.items = [];
  }
  mediaState.selectedIds = [];
}

async function renderMediaLibrary() {
  showLoading();
  await fetchMediaFolders();
  await fetchMediaItems(mediaState.currentFolderId);
  hideLoading();

  const folders = mediaState.folders;
  const currentFolder = mediaState.currentFolderId;

  return `
    <div class="page-header">
      <h1>Médiathèque</h1>
      <div class="actions">
        <label class="btn btn-outline media-upload-btn">
          <input type="file" multiple accept="image/*,video/*,application/pdf,.pdf" onchange="handleMediaUpload(event)" />
          Importer
        </label>
        ${!currentFolder ? `<button class="btn btn-outline" onclick="createMediaFolder()">+ Dossier</button>` : ''}
        ${currentFolder ? `<button class="btn btn-danger" onclick="deleteMediaFolder(${currentFolder})">Supprimer le dossier</button>` : ''}
        <button
          class="btn btn-outline media-select-all-btn"
          onclick="selectAllMedia()"
          ${mediaState.items.length === 0 ? 'disabled' : ''}
        >
          ${mediaState.selectedIds.length > 0 && mediaState.selectedIds.length === mediaState.items.length ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>
        <button
          class="btn btn-danger"
          onclick="deleteSelectedMedia()"
          ${!mediaState.selectedIds || mediaState.selectedIds.length === 0 ? 'disabled' : ''}
        >
          Supprimer la sélection (${mediaState.selectedIds ? mediaState.selectedIds.length : 0})
        </button>
      </div>
    </div>
    <div class="media-library" ondragenter="onMediaLibraryDragEnter(event)" ondragover="onMediaLibraryDragOver(event)" ondragleave="onMediaLibraryDragLeave(event)" ondrop="onMediaLibraryDrop(event)">
      <div class="media-drop-overlay">
        <div class="media-drop-overlay-inner">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span>Déposer fichiers ou dossiers ici</span>
        </div>
      </div>
      <aside class="media-sidebar">
        <div class="media-search">
          <input type="text" class="media-search-input" placeholder="Rechercher un média…" value="${escapeHtml(mediaState.search)}" oninput="handleMediaSearch(this.value)" />
          ${mediaState.search ? `<button class="media-search-clear" onclick="clearMediaSearch()" title="Effacer">&times;</button>` : ''}
        </div>
        <div class="media-filters">
          <div class="media-filter-group" role="group" aria-label="Filtrer par type">
            <button type="button" class="media-pill ${mediaState.typeFilter === '' ? 'is-active' : ''}" onclick="handleMediaTypeFilter('')" title="Tous">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              <span>Tous</span>
            </button>
            <button type="button" class="media-pill ${mediaState.typeFilter === 'image' ? 'is-active' : ''}" onclick="handleMediaTypeFilter('image')" title="Images">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L9 20"/></svg>
              <span>Images</span>
            </button>
            <button type="button" class="media-pill ${mediaState.typeFilter === 'video' ? 'is-active' : ''}" onclick="handleMediaTypeFilter('video')" title="Vidéos">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="m22 8-6 4 6 4V8z"/></svg>
              <span>Vidéos</span>
            </button>
            <button type="button" class="media-pill ${mediaState.typeFilter === 'document' ? 'is-active' : ''}" onclick="handleMediaTypeFilter('document')" title="PDF">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>PDF</span>
            </button>
          </div>
          <div class="media-sort-group" role="group" aria-label="Trier">
            ${['date','name','type'].map(key => {
              const active = mediaState.sort.startsWith(key + '_');
              const asc = mediaState.sort === key + '_asc';
              const next = active ? (asc ? key + '_desc' : key + '_asc') : (key === 'date' ? key + '_desc' : key + '_asc');
              const label = key === 'date' ? 'Date' : key === 'name' ? 'Nom' : 'Type';
              return `
                <button type="button" class="media-sort-btn ${active ? 'is-active' : ''}" onclick="handleMediaSort('${next}')" title="Trier par ${label}">
                  <span>${label}</span>
                  <svg class="media-sort-arrow ${active && asc ? 'is-asc' : ''}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
                </button>
              `;
            }).join('')}
          </div>
        </div>
        <button class="media-folder-item media-folder-all ${currentFolder === null ? 'is-active' : ''}" onclick="selectMediaFolder(null)" ondragover="onFolderDragOver(event)" ondragleave="onFolderDragLeave(event)" ondrop="onFolderDrop(event, null)">
          Tous les médias <span class="media-folder-count">${mediaTotalCount}</span>
        </button>
        <h3>Dossiers</h3>
        <div class="media-folder-list">
          ${folders.map(folder => `
            <button class="media-folder-item ${String(folder.id) === String(currentFolder) ? 'is-active' : ''}" onclick="selectMediaFolder(${folder.id ?? 'null'})" ondragover="onFolderDragOver(event)" ondragleave="onFolderDragLeave(event)" ondrop="onFolderDrop(event, ${folder.id})">
              ${escapeHtml(folder.name)} <span class="media-folder-count">${folder.media_count || 0}</span>
            </button>
          `).join('')}
        </div>
      </aside>
      <section class="media-grid">
        ${mediaState.items.length === 0
          ? (mediaState.search
            ? renderEmptyState('🔍', 'Aucun résultat', `Aucun média ne correspond à « ${escapeHtml(mediaState.search)} ».`)
            : renderEmptyState('🗂️', 'Aucun média', 'Importez des images ou vidéos pour commencer.'))
          : ''}
        ${mediaState.items.map(item => renderMediaCard(item)).join('')}
      </section>
    </div>
  `;
}

function renderMediaCard(item, forPicker = false) {
  const isImage = item.type === 'image';
  const isVideo = item.type === 'video';
  const isDocument = item.type === 'document';
  const isSelected = forPicker && mediaPickerState.multiple && Array.isArray(mediaPickerState.selectedIds)
    ? mediaPickerState.selectedIds.includes(String(item.id))
    : (!forPicker && Array.isArray(mediaState.selectedIds) && mediaState.selectedIds.includes(String(item.id)));
  const thumbUrl = isImage ? getOptimizedUrl(item.url, 400, 70) : item.url;
  const thumb = isImage
    ? `<img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(item.original_name)}" loading="lazy">`
    : isDocument
    ? `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f8f9fa;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg></div>`
    : `<video src="${escapeHtml(item.url)}#t=0.5" preload="metadata" muted></video>`;
  const typeLabel = isImage ? 'Image' : isDocument ? 'PDF' : 'Vidéo';
  const meta = typeLabel;
  const folderSelect = forPicker ? '' : `
    <select class="media-move-select" onclick="event.stopPropagation()" onchange="moveMediaItem(${item.id}, this.value)">
      <option value="">Sans dossier</option>
      ${mediaState.folders.map(f => `
        <option value="${f.id}" ${String(f.id) === String(item.folder_id) ? 'selected' : ''}>${escapeHtml(f.name)}</option>
      `).join('')}
    </select>
  `;
  const actions = forPicker
    ? ''
    : `
        <div class="media-actions-row">
          <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); renameMediaItem(${item.id}, '${escapeHtml(item.original_name || '')}')">Renommer</button>
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteMediaItem(${item.id})">Suppr.</button>
        </div>
      `;
  return `
    <article class="media-card ${forPicker ? 'is-picker' : ''} ${isSelected ? 'is-selected' : ''}" ${!forPicker ? `data-media-id="${item.id}" draggable="true" ondragstart="onMediaDragStart(event, ${item.id})"` : ''} onclick="${forPicker ? `selectMediaFromPicker(${item.id})` : `onMediaCardClick(event, ${item.id})`}">
      ${!forPicker ? `
        <label class="media-select" onclick="event.stopPropagation()">
          <input type="checkbox" ${isSelected ? 'checked' : ''} onclick="onMediaCheckboxClick(event, ${item.id})" onchange="toggleMediaSelection(${item.id}, this.checked); event.stopPropagation();" />
        </label>
      ` : ''}
      <div class="media-thumb ${isImage ? '' : isDocument ? 'is-document' : 'is-video'}">${thumb}</div>
      <div class="media-meta">
        <div class="media-name" title="${escapeHtml(item.original_name)}">${escapeHtml(item.original_name)}</div>
        <div class="media-info">${escapeHtml(meta)}</div>
      </div>
      <div class="media-actions">
        ${folderSelect}
        ${actions}
      </div>
    </article>
  `;
}

async function selectMediaFolder(folderId) {
  mediaState.currentFolderId = folderId === 'null' ? null : folderId;
  mediaState.selectedIds = [];
  mediaState.search = '';
  const content = document.getElementById('content');
  if (!content) return;
  content.innerHTML = await renderMediaLibrary();
}

let _mediaSearchTimer = null;
function handleMediaSearch(value) {
  clearTimeout(_mediaSearchTimer);
  window._mediaSearchTimer = setTimeout(async () => {
    mediaState.search = value;
    await fetchMediaItems(mediaState.currentFolderId);
    const grid = document.querySelector('.media-grid');
    const clearBtn = document.querySelector('.media-search-clear');
    if (grid) {
      grid.innerHTML = mediaState.items.length === 0
        ? (mediaState.search
          ? renderEmptyState('🔍', 'Aucun résultat', `Aucun média ne correspond à « ${escapeHtml(mediaState.search)} ».`)
          : renderEmptyState('🗂️', 'Aucun média', 'Importez des images ou vidéos pour commencer.'))
        : mediaState.items.map(item => renderMediaCard(item)).join('');
    }
    if (clearBtn) {
      clearBtn.style.display = value ? '' : 'none';
    } else if (value) {
      const input = document.querySelector('.media-search-input');
      if (input) {
        const btn = document.createElement('button');
        btn.className = 'media-search-clear';
        btn.title = 'Effacer';
        btn.innerHTML = '&times;';
        btn.onclick = clearMediaSearch;
        input.parentNode.appendChild(btn);
      }
    }
  }, 300);
}

async function clearMediaSearch() {
  mediaState.search = '';
  const input = document.querySelector('.media-search-input');
  if (input) input.value = '';
  await fetchMediaItems(mediaState.currentFolderId);
  const grid = document.querySelector('.media-grid');
  if (grid) {
    grid.innerHTML = mediaState.items.length === 0
      ? renderEmptyState('🗂️', 'Aucun média', 'Importez des images ou vidéos pour commencer.')
      : mediaState.items.map(item => renderMediaCard(item)).join('');
  }
  const clearBtn = document.querySelector('.media-search-clear');
  if (clearBtn) clearBtn.style.display = 'none';
}

async function handleMediaTypeFilter(value) {
  mediaState.typeFilter = value || '';
  document.querySelectorAll('.media-filter-group .media-pill').forEach(btn => {
    const onclickAttr = btn.getAttribute('onclick') || '';
    const m = onclickAttr.match(/handleMediaTypeFilter\('([^']*)'\)/);
    btn.classList.toggle('is-active', m && m[1] === mediaState.typeFilter);
  });
  await fetchMediaItems(mediaState.currentFolderId);
  const grid = document.querySelector('.media-grid');
  if (grid) {
    grid.innerHTML = mediaState.items.length === 0
      ? renderEmptyState('🗂️', 'Aucun média', 'Aucun média ne correspond à ce filtre.')
      : mediaState.items.map(item => renderMediaCard(item)).join('');
  }
}

async function handleMediaSort(value) {
  mediaState.sort = value || 'date_desc';
  const [activeKey, activeDir] = mediaState.sort.split('_');
  document.querySelectorAll('.media-sort-group .media-sort-btn').forEach(btn => {
    const label = (btn.querySelector('span')?.textContent || '').trim().toLowerCase();
    const key = label === 'date' ? 'date' : label === 'nom' ? 'name' : 'type';
    const isActive = key === activeKey;
    btn.classList.toggle('is-active', isActive);
    const next = isActive
      ? (activeDir === 'asc' ? key + '_desc' : key + '_asc')
      : (key === 'date' ? key + '_desc' : key + '_asc');
    btn.setAttribute('onclick', `handleMediaSort('${next}')`);
    const arrow = btn.querySelector('.media-sort-arrow');
    if (arrow) arrow.classList.toggle('is-asc', isActive && activeDir === 'asc');
  });
  await fetchMediaItems(mediaState.currentFolderId);
  const grid = document.querySelector('.media-grid');
  if (grid) {
    grid.innerHTML = mediaState.items.length === 0
      ? renderEmptyState('🗂️', 'Aucun média', 'Aucun média à afficher.')
      : mediaState.items.map(item => renderMediaCard(item)).join('');
  }
}

async function handleMediaUpload(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;
  const formData = new FormData();
  files.forEach(file => formData.append('files[]', file));
  if (mediaState.currentFolderId) formData.append('folder_id', mediaState.currentFolderId);
  showLoading();
  try {
    await apiUpload('/media/upload', formData);
    showToast('Médias importés', 'success');
    await fetchMediaItems(mediaState.currentFolderId);
    document.getElementById('content').innerHTML = await renderMediaLibrary();
  } catch (e) {
    showToast(e.message || 'Erreur lors de l\'import', 'error');
  } finally {
    hideLoading();
    event.target.value = '';
  }
}

async function createMediaFolder() {
  const name = await promptModal('Nom du dossier ?', '');
  if (!name) return;
  try {
    await apiFetch('/media/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parent_id: null })
    });
    await fetchMediaFolders();
    document.getElementById('content').innerHTML = await renderMediaLibrary();
    showToast('Dossier créé', 'success');
  } catch (e) {
    showToast(e.message || 'Erreur lors de la création', 'error');
  }
}

async function deleteMediaFolder(folderId) {
  const ok = await confirmModal('Supprimer ce dossier ? Les médias seront déplacés dans "Sans dossier".');
  if (!ok) return;
  try {
    await apiFetch(`/media/folders/${folderId}`, { method: 'DELETE' });
    mediaState.currentFolderId = null;
    await fetchMediaFolders();
    await fetchMediaItems(null);
    document.getElementById('content').innerHTML = await renderMediaLibrary();
    showToast('Dossier supprimé', 'success');
  } catch (e) {
    showToast(e.message || 'Erreur lors de la suppression', 'error');
  }
}

async function moveMediaItem(id, folderId) {
  try {
    await apiFetch(`/media/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ folder_id: folderId || null })
    });
    showToast('Média déplacé', 'success');
    await fetchMediaItems(mediaState.currentFolderId);
    document.getElementById('content').innerHTML = await renderMediaLibrary();
  } catch (e) {
    showToast(e.message || 'Erreur lors du déplacement', 'error');
  }
}

async function moveMediaItems(ids, folderId) {
  if (!ids || !ids.length) return;
  showLoading(`Déplacement ${ids.length} média(s)…`);
  try {
    await Promise.all(ids.map(id =>
      apiFetch(`/media/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ folder_id: folderId || null })
      }).catch(e => { console.warn(`move ${id} failed`, e); return null; })
    ));
    mediaState.selectedIds = [];
    window._lastSelectedMediaId = null;
    await fetchMediaFolders();
    await fetchMediaItems(mediaState.currentFolderId);
    document.getElementById('content').innerHTML = await renderMediaLibrary();
    showToast(`${ids.length} média(s) déplacé(s)`, 'success');
  } catch (e) {
    showToast(e.message || 'Erreur lors du déplacement', 'error');
  } finally {
    hideLoading();
  }
}

// ── Drag & drop media → folder ──
function onMediaDragStart(event, mediaId) {
  // If dragged item is part of current selection → drag the whole selection
  const key = String(mediaId);
  const selected = Array.isArray(mediaState.selectedIds) ? mediaState.selectedIds.map(String) : [];
  const ids = selected.includes(key) && selected.length > 1 ? selected : [key];

  event.dataTransfer.setData('text/plain', ids.join(','));
  event.dataTransfer.effectAllowed = 'move';
  event.currentTarget.classList.add('is-dragging');

  // Highlight all dragged cards (when multi)
  if (ids.length > 1) {
    ids.forEach(id => {
      const card = document.querySelector(`.media-card[data-media-id="${id}"]`);
      if (card) card.classList.add('is-dragging');
    });
    // Visual hint: show count badge near drag image (browser default uses single card thumbnail)
    try {
      const ghost = document.createElement('div');
      ghost.style.cssText = 'position:absolute;top:-1000px;left:-1000px;padding:6px 12px;background:#667eea;color:#fff;border-radius:6px;font-weight:600;font-size:13px;';
      ghost.textContent = `${ids.length} médias`;
      document.body.appendChild(ghost);
      event.dataTransfer.setDragImage(ghost, 20, 20);
      setTimeout(() => ghost.remove(), 0);
    } catch (e) { /* setDragImage unsupported */ }
  }

  // Highlight all folder targets
  document.querySelectorAll('.media-folder-item').forEach(el => el.classList.add('is-drop-target'));
}

document.addEventListener('dragend', () => {
  document.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
  document.querySelectorAll('.is-drop-target, .is-drag-over').forEach(el => el.classList.remove('is-drop-target', 'is-drag-over'));
});

// Prevent browser from opening files dropped outside designated drop zones in admin SPA
window.addEventListener('dragover', (e) => {
  if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
    if (!e.target.closest('.media-library')) e.preventDefault();
  }
});
window.addEventListener('drop', (e) => {
  if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
    if (!e.target.closest('.media-library')) e.preventDefault();
  }
});

function onFolderDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('is-drag-over');
}

function onFolderDragLeave(event) {
  event.currentTarget.classList.remove('is-drag-over');
}

async function onFolderDrop(event, folderId) {
  event.preventDefault();
  event.currentTarget.classList.remove('is-drag-over');
  document.querySelectorAll('.is-drop-target').forEach(el => el.classList.remove('is-drop-target'));
  // Ignore OS file drops here — handled by media-library drop zone
  if (event.dataTransfer.types && Array.from(event.dataTransfer.types).includes('Files')) return;
  const payload = event.dataTransfer.getData('text/plain');
  if (!payload) return;
  const ids = payload.split(',').map(s => parseInt(s, 10)).filter(n => Number.isFinite(n));
  if (!ids.length) return;
  if (ids.length === 1) {
    await moveMediaItem(ids[0], folderId);
  } else {
    await moveMediaItems(ids, folderId);
  }
}

// ── Drag & drop OS files/folders → media library ──
let _mediaDropDepth = 0;

function _isOsFileDrag(event) {
  const types = event.dataTransfer && event.dataTransfer.types;
  if (!types) return false;
  return Array.from(types).includes('Files');
}

function onMediaLibraryDragEnter(event) {
  if (!_isOsFileDrag(event)) return;
  event.preventDefault();
  window._mediaDropDepth = ++_mediaDropDepth;
  event.currentTarget.classList.add('is-os-dragover');
}

function onMediaLibraryDragOver(event) {
  if (!_isOsFileDrag(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
}

function onMediaLibraryDragLeave(event) {
  if (!_isOsFileDrag(event)) return;
  _mediaDropDepth = Math.max(0, _mediaDropDepth - 1);
  window._mediaDropDepth = _mediaDropDepth;
  if (_mediaDropDepth === 0) {
    event.currentTarget.classList.remove('is-os-dragover');
  }
}

async function _readAllEntries(reader) {
  const all = [];
  while (true) {
    const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
    if (!batch.length) break;
    all.push(...batch);
  }
  return all;
}

async function _walkEntry(entry, files) {
  if (entry.isFile) {
    const file = await new Promise((res, rej) => entry.file(res, rej));
    files.push(file);
  } else if (entry.isDirectory) {
    const sub = await _readAllEntries(entry.createReader());
    for (const e of sub) await _walkEntry(e, files);
  }
}

async function _uploadBatch(files, folderId, onProgress) {
  // Filter out anything that isn't a real File (defensive)
  files = files.filter(f => f instanceof File && f.size >= 0);
  if (!files.length) return;

  // PHP limits: post_max_size 8M, max_file_uploads 20. Stay well under.
  const MAX_BYTES = 7 * 1024 * 1024; // 7 Mo per request
  const MAX_COUNT = 15;

  let i = 0;
  while (i < files.length) {
    const slice = [];
    let bytes = 0;
    while (i < files.length && slice.length < MAX_COUNT && (bytes + files[i].size) <= MAX_BYTES) {
      bytes += files[i].size;
      slice.push(files[i]);
      i++;
    }

    // Lone file bigger than MAX_BYTES → send alone (will fail server-side, surfaced clearly)
    if (slice.length === 0 && i < files.length) {
      slice.push(files[i]);
      i++;
    }

    const formData = new FormData();
    slice.forEach(f => formData.append('files[]', f));
    if (folderId) formData.append('folder_id', folderId);
    try {
      await apiUpload('/media/upload', formData);
      if (onProgress) onProgress(slice.length);
    } catch (e) {
      // If a single oversized file failed, skip it but keep going
      if (slice.length === 1) {
        console.warn(`Échec import "${slice[0].name}" (${(slice[0].size / 1024 / 1024).toFixed(1)} Mo) — fichier trop volumineux ?`, e);
        showToast(`Fichier ignoré : ${slice[0].name} (trop volumineux)`, 'error');
        if (onProgress) onProgress(0);
        continue;
      }
      throw e;
    }
  }
}

async function onMediaLibraryDrop(event) {
  if (!_isOsFileDrag(event)) return;
  event.preventDefault();
  _mediaDropDepth = 0;
  window._mediaDropDepth = 0;
  event.currentTarget.classList.remove('is-os-dragover');

  const items = event.dataTransfer.items;
  if (!items || !items.length) return;

  // Collect: top-level folders (each → new media folder) and loose files (→ current folder)
  const folderGroups = []; // { name, files[] }
  const looseFiles = [];

  // Snapshot entries first (items list is invalidated after async work)
  const entries = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry) entries.push(entry);
  }

  showLoading('Lecture des fichiers…');
  try {
    for (const entry of entries) {
      if (entry.isFile) {
        const file = await new Promise((res, rej) => entry.file(res, rej));
        looseFiles.push(file);
      } else if (entry.isDirectory) {
        const files = [];
        const sub = await _readAllEntries(entry.createReader());
        for (const e of sub) await _walkEntry(e, files);
        folderGroups.push({ name: entry.name, files });
      }
    }

    let totalFiles = looseFiles.length + folderGroups.reduce((n, g) => n + g.files.length, 0);
    if (totalFiles === 0 && folderGroups.length === 0) {
      showToast('Aucun fichier détecté', 'error');
      return;
    }

    let done = 0;
    const tick = (n) => { done += n; showLoading(`Import ${done}/${totalFiles}…`); };

    if (looseFiles.length) {
      await _uploadBatch(looseFiles, mediaState.currentFolderId, tick);
    }

    for (const g of folderGroups) {
      const folder = await apiFetch('/media/folders', {
        method: 'POST',
        body: JSON.stringify({ name: g.name, parent_id: null })
      });
      if (g.files.length) {
        await _uploadBatch(g.files, folder.id, tick);
      }
    }

    showToast(`Import terminé (${totalFiles} fichier${totalFiles > 1 ? 's' : ''})`, 'success');
    await fetchMediaFolders();
    await fetchMediaItems(mediaState.currentFolderId);
    document.getElementById('content').innerHTML = await renderMediaLibrary();
  } catch (e) {
    console.error(e);
    showToast(e.message || 'Erreur lors de l\'import', 'error');
  } finally {
    hideLoading();
  }
}

// ── Media detail panel ──
function openMediaDetail(mediaId) {
  const item = mediaState.items.find(i => i.id === mediaId || String(i.id) === String(mediaId));
  if (!item) return;

  // Remove existing panel
  const existing = document.getElementById('mediaDetailPanel');
  if (existing) existing.remove();

  const isImage = item.type === 'image';
  const isDocument = item.type === 'document';
  const previewUrl = isImage ? getOptimizedUrl(item.url, 600, 80) : item.url;
  const dims = (item.width && item.height) ? `${item.width} × ${item.height} px` : '';
  const folderName = item.folder_id ? (mediaState.folders.find(f => String(f.id) === String(item.folder_id))?.name || '') : 'Aucun';

  const panel = document.createElement('div');
  panel.id = 'mediaDetailPanel';
  panel.className = 'media-detail-panel';
  panel.innerHTML = `
    <div class="media-detail-backdrop" onclick="closeMediaDetail()"></div>
    <div class="media-detail-content">
      <div class="media-detail-header">
        <h3>Détails du média</h3>
        <button class="media-detail-close" onclick="closeMediaDetail()">&times;</button>
      </div>
      <div class="media-detail-preview">
        ${isImage
          ? `<img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(item.alt || item.original_name)}">`
          : isDocument
          ? `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;gap:1rem;background:#f8f9fa;border-radius:8px;min-height:200px;">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg>
              <span style="font-weight:500">${escapeHtml(item.original_name)}</span>
              <a href="${escapeHtml(item.url)}" target="_blank" class="btn btn-sm btn-primary" onclick="event.stopPropagation()">Ouvrir le PDF</a>
            </div>`
          : `<video src="${escapeHtml(item.url)}" controls></video>`}
      </div>
      <div class="media-detail-infos">
        <span>${escapeHtml(item.mime_type)}</span>
        <span>${formatBytes(item.size)}</span>
        ${dims ? `<span>${dims}</span>` : ''}
      </div>
      <form class="media-detail-form" onsubmit="saveMediaDetail(event, ${item.id})">
        <label>
          <span>Texte alternatif</span>
          <textarea name="alt" rows="2" placeholder="Décrivez le but de l'image. Laissez vide si l'image est purement décorative.">${escapeHtml(item.alt || '')}</textarea>
        </label>
        <label>
          <span>Titre</span>
          <input type="text" name="title" value="${escapeHtml(item.title || item.original_name || '')}" />
        </label>
        <label>
          <span>Légende</span>
          <textarea name="caption" rows="2" placeholder="Texte affiché sous l'image">${escapeHtml(item.caption || '')}</textarea>
        </label>
        <label>
          <span>Description</span>
          <textarea name="description" rows="3" placeholder="Description détaillée du média">${escapeHtml(item.description || '')}</textarea>
        </label>
        <label>
          <span>Nom du fichier</span>
          <input type="text" name="original_name" value="${escapeHtml(item.original_name || '')}" />
        </label>
        <label>
          <span>Dossier</span>
          <select name="folder_id">
            <option value="">Sans dossier</option>
            ${mediaState.folders.map(f => `<option value="${f.id}" ${String(f.id) === String(item.folder_id) ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}
          </select>
        </label>
        <label>
          <span>URL du fichier</span>
          <div class="media-detail-url">
            <input type="text" value="${escapeHtml(item.url)}" readonly id="mediaDetailUrl" />
            <button type="button" class="btn btn-outline btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('mediaDetailUrl').value); showToast('URL copiée', 'success');">Copier</button>
          </div>
        </label>
        <div class="media-detail-actions">
          <button type="submit" class="btn btn-primary btn-sm">Enregistrer</button>
          ${isImage ? `<button type="button" class="btn btn-outline btn-sm" onclick="openCropEditor(${item.id}, '${escapeHtml(item.url)}')">Recadrer</button>` : ''}
          <button type="button" class="btn btn-danger btn-sm" onclick="deleteMediaItem(${item.id}); closeMediaDetail();">Supprimer</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(panel);
  // Animate in
  requestAnimationFrame(() => panel.classList.add('is-open'));
}

function closeMediaDetail() {
  const panel = document.getElementById('mediaDetailPanel');
  if (!panel) return;
  panel.classList.remove('is-open');
  setTimeout(() => panel.remove(), 200);
}

async function saveMediaDetail(event, id) {
  event.preventDefault();
  const form = event.target;
  const data = {
    original_name: form.original_name.value.trim(),
    alt: form.alt.value.trim(),
    title: form.title.value.trim(),
    caption: form.caption.value.trim(),
    description: form.description.value.trim(),
    folder_id: form.folder_id.value || null
  };
  try {
    await apiFetch(`/media/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    showToast('Média mis à jour', 'success');
    closeMediaDetail();
    await fetchMediaItems(mediaState.currentFolderId);
    document.getElementById('content').innerHTML = await renderMediaLibrary();
  } catch (e) {
    showToast(e.message || 'Erreur', 'error');
  }
}

// ── Crop editor ──
let _cropperInstance = null;
let _cropperOptions = null;

function ensureCropperLib() {
  return new Promise((resolve) => {
    if (window.Cropper) return resolve();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js';
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

async function openCropEditor(mediaId, imageUrl, options = {}) {
  await ensureCropperLib();
  window._cropperOptions = options || {};
  _cropperOptions = window._cropperOptions;

  // Remove existing
  const existing = document.getElementById('cropEditorModal');
  if (existing) existing.remove();
  if (_cropperInstance) { _cropperInstance.destroy(); window._cropperInstance = null; _cropperInstance = null; }

  const modal = document.createElement('div');
  modal.id = 'cropEditorModal';
  modal.className = 'crop-modal';
  modal.innerHTML = `
    <div class="crop-modal-backdrop" onclick="closeCropEditor()"></div>
    <div class="crop-modal-panel">
      <div class="crop-modal-header">
        <h3>Recadrer l'image</h3>
        <button class="media-detail-close" onclick="closeCropEditor()">&times;</button>
      </div>
      <div class="crop-modal-body">
        <img id="cropEditorImage" src="${imageUrl}?t=${Date.now()}" crossorigin="anonymous" />
      </div>
      <div class="crop-modal-toolbar">
        <div class="crop-ratios">
          <button type="button" class="btn btn-outline btn-sm crop-ratio-btn is-active" onclick="setCropRatio(NaN, this)">Libre</button>
          <button type="button" class="btn btn-outline btn-sm crop-ratio-btn" onclick="setCropRatio(1, this)">1:1</button>
          <button type="button" class="btn btn-outline btn-sm crop-ratio-btn" onclick="setCropRatio(16/9, this)">16:9</button>
          <button type="button" class="btn btn-outline btn-sm crop-ratio-btn" onclick="setCropRatio(4/3, this)">4:3</button>
          <button type="button" class="btn btn-outline btn-sm crop-ratio-btn" onclick="setCropRatio(3/2, this)">3:2</button>
        </div>
        <div class="crop-actions">
          <button type="button" class="btn btn-outline btn-sm" onclick="closeCropEditor()">Annuler</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="applyCrop(${mediaId})">Appliquer</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => {
    modal.classList.add('is-open');
    const img = document.getElementById('cropEditorImage');
    _cropperInstance = new Cropper(img, {
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 1,
      responsive: true,
      background: true,
    });
    window._cropperInstance = _cropperInstance;
  });
}

function setCropRatio(ratio, btn) {
  if (!_cropperInstance) return;
  _cropperInstance.setAspectRatio(ratio);
  document.querySelectorAll('.crop-ratio-btn').forEach(b => b.classList.remove('is-active'));
  btn.classList.add('is-active');
}

async function applyCrop(mediaId) {
  if (!_cropperInstance) return;
  const data = _cropperInstance.getData(true); // rounded integers
  const opts = _cropperOptions || {};
  showLoading();
  try {
    await apiFetch(`/media/${mediaId}/crop`, {
      method: 'POST',
      body: JSON.stringify({
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height
      })
    });
    showToast('Image recadrée', 'success');
    closeCropEditor();
    if (typeof opts.onApply === 'function') {
      try { await opts.onApply(); } catch (cbErr) { console.error(cbErr); }
    }
    if (!opts.skipMediaRefresh) {
      closeMediaDetail();
      await fetchMediaItems(mediaState.currentFolderId);
      const contentEl = document.getElementById('content');
      if (contentEl && document.querySelector('.media-library')) {
        contentEl.innerHTML = await renderMediaLibrary();
      }
    }
  } catch (e) {
    showToast(e.message || 'Erreur lors du recadrage', 'error');
  } finally {
    hideLoading();
  }
}

async function openCropEditorForField(mediaId, imageUrl, blockId, inputName, btn) {
  const field = btn?.closest('.media-field') || document.querySelector(`.media-field[data-field="${CSS.escape(inputName)}"]`);
  await openCropEditor(mediaId, imageUrl, {
    skipMediaRefresh: true,
    onApply: () => {
      if (!field) return;
      const img = field.querySelector('.media-preview img');
      if (img) {
        const base = (imageUrl || '').split('?')[0];
        const opt = getOptimizedUrl(base, 400, 70);
        const sep = opt.includes('?') ? '&' : '?';
        img.src = `${opt}${sep}t=${Date.now()}`;
      }
    }
  });
}

function closeCropEditor() {
  if (_cropperInstance) { _cropperInstance.destroy(); window._cropperInstance = null; _cropperInstance = null; }
  const modal = document.getElementById('cropEditorModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  setTimeout(() => modal.remove(), 200);
}

async function renameMediaItem(id, currentName) {
  const name = await promptModal('Nouveau nom du média ?', currentName || '');
  if (!name) return;
  try {
    await apiFetch(`/media/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ original_name: name })
    });
    showToast('Média renommé', 'success');
    await fetchMediaItems(mediaState.currentFolderId);
    document.getElementById('content').innerHTML = await renderMediaLibrary();
  } catch (e) {
    showToast(e.message || 'Erreur lors du renommage', 'error');
  }
}

async function deleteMediaItem(id) {
  const ok = await confirmModal('Supprimer ce média ?');
  if (!ok) return;
  try {
    await apiFetch(`/media/${id}`, { method: 'DELETE' });
    if (Array.isArray(mediaState.selectedIds)) {
      mediaState.selectedIds = mediaState.selectedIds.filter(sid => String(sid) !== String(id));
    }
    await fetchMediaItems(mediaState.currentFolderId);
    document.getElementById('content').innerHTML = await renderMediaLibrary();
    showToast('Média supprimé', 'success');
  } catch (e) {
    showToast(e.message || 'Erreur lors de la suppression', 'error');
  }
}

// ── Selection ──
function selectAllMedia() {
  const allIds = mediaState.items.map(item => String(item.id));
  const allSelected = allIds.length > 0 && allIds.every(id => mediaState.selectedIds.includes(id));
  if (allSelected) {
    mediaState.selectedIds = [];
    window._lastSelectedMediaId = null;
  } else {
    mediaState.selectedIds = [...allIds];
  }
  syncMediaCardSelectionUI();
  updateMediaSelectionUI();
}

function toggleMediaSelection(id, isChecked) {
  if (!Array.isArray(mediaState.selectedIds)) {
    mediaState.selectedIds = [];
  }
  const key = String(id);
  const set = new Set(mediaState.selectedIds);
  if (isChecked) set.add(key);
  else set.delete(key);
  mediaState.selectedIds = Array.from(set);
  window._lastSelectedMediaId = id;
  syncMediaCardSelectionUI();
  updateMediaSelectionUI();
}

let _lastSelectedMediaId = null;

function onMediaCardClick(event, id) {
  // Shift-click → range select
  if (event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    rangeSelectMedia(id);
    return;
  }
  // Cmd/Ctrl-click → toggle single without opening detail
  if (event.metaKey || event.ctrlKey) {
    event.preventDefault();
    event.stopPropagation();
    const key = String(id);
    const already = mediaState.selectedIds.includes(key);
    toggleMediaSelection(id, !already);
    return;
  }
  // Default → open detail panel
  openMediaDetail(id);
}

function onMediaCheckboxClick(event, id) {
  // Shift+click on checkbox → range select instead of toggle
  if (event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    rangeSelectMedia(id);
  }
  // Otherwise let `onchange` (toggleMediaSelection) handle it
}

function rangeSelectMedia(targetId) {
  const ids = mediaState.items.map(i => String(i.id));
  const target = String(targetId);
  const targetIdx = ids.indexOf(target);
  if (targetIdx < 0) return;

  // No prior anchor → just toggle current and remember
  if (_lastSelectedMediaId === null) {
    toggleMediaSelection(targetId, !mediaState.selectedIds.includes(target));
    return;
  }

  const anchor = String(_lastSelectedMediaId);
  const anchorIdx = ids.indexOf(anchor);
  if (anchorIdx < 0) {
    toggleMediaSelection(targetId, !mediaState.selectedIds.includes(target));
    return;
  }

  const [from, to] = anchorIdx < targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
  const range = ids.slice(from, to + 1);
  const set = new Set(mediaState.selectedIds);
  range.forEach(id => set.add(id));
  mediaState.selectedIds = Array.from(set);
  syncMediaCardSelectionUI();
  updateMediaSelectionUI();
}

function syncMediaCardSelectionUI() {
  const selected = new Set(mediaState.selectedIds.map(String));
  document.querySelectorAll('.media-card[data-media-id]').forEach(card => {
    const id = card.dataset.mediaId;
    const isSel = selected.has(id);
    card.classList.toggle('is-selected', isSel);
    const cb = card.querySelector('.media-select input[type="checkbox"]');
    if (cb) cb.checked = isSel;
  });
}

async function deleteSelectedMedia() {
  if (!Array.isArray(mediaState.selectedIds) || mediaState.selectedIds.length === 0) return;
  const ok = await confirmModal(`Supprimer ${mediaState.selectedIds.length} média(s) sélectionné(s) ?`);
  if (!ok) return;
  showLoading();
  try {
    await Promise.all(
      mediaState.selectedIds.map(id =>
        apiFetch(`/media/${id}`, { method: 'DELETE' }).catch(() => null)
      )
    );
    mediaState.selectedIds = [];
    await fetchMediaItems(mediaState.currentFolderId);
    document.getElementById('content').innerHTML = await renderMediaLibrary();
    showToast('Médias supprimés', 'success');
  } catch (e) {
    showToast(e.message || 'Erreur lors de la suppression multiple', 'error');
  } finally {
    hideLoading();
  }
}

function updateMediaSelectionUI() {
  const btn = document.querySelector('.page-header .actions button.btn.btn-danger:last-of-type');
  if (btn) {
    const count = Array.isArray(mediaState.selectedIds) ? mediaState.selectedIds.length : 0;
    btn.disabled = count === 0;
    btn.textContent = `Supprimer la sélection (${count})`;
  }
  const selectAllBtn = document.querySelector('.media-select-all-btn');
  if (selectAllBtn) {
    const allIds = mediaState.items.map(item => String(item.id));
    const allSelected = allIds.length > 0 && allIds.every(id => mediaState.selectedIds.includes(id));
    selectAllBtn.textContent = allSelected ? 'Tout désélectionner' : 'Tout sélectionner';
  }
}

function normalizeMediaValue(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (e) {
      return { url: value };
    }
  }
  return value;
}

function normalizeRepeaterMedia(value) {
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      return normalizeRepeaterMedia(JSON.parse(value));
    } catch (e) {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (item && item.image) return normalizeMediaValue(item.image);
    return normalizeMediaValue(item);
  }).filter(Boolean);
}

// ── Expose on window ──
Object.assign(window, {
  fetchMediaFolders,
  fetchMediaItems,
  renderMediaLibrary,
  renderMediaCard,
  selectMediaFolder,
  handleMediaSearch,
  clearMediaSearch,
  handleMediaTypeFilter,
  handleMediaSort,
  handleMediaUpload,
  createMediaFolder,
  deleteMediaFolder,
  moveMediaItem,
  moveMediaItems,
  onMediaDragStart,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
  _isOsFileDrag,
  onMediaLibraryDragEnter,
  onMediaLibraryDragOver,
  onMediaLibraryDragLeave,
  onMediaLibraryDrop,
  _readAllEntries,
  _walkEntry,
  _uploadBatch,
  openMediaDetail,
  closeMediaDetail,
  saveMediaDetail,
  ensureCropperLib,
  openCropEditor,
  setCropRatio,
  applyCrop,
  openCropEditorForField,
  closeCropEditor,
  renameMediaItem,
  deleteMediaItem,
  selectAllMedia,
  toggleMediaSelection,
  onMediaCardClick,
  onMediaCheckboxClick,
  rangeSelectMedia,
  syncMediaCardSelectionUI,
  deleteSelectedMedia,
  updateMediaSelectionUI,
  normalizeMediaValue,
  normalizeRepeaterMedia,
});
