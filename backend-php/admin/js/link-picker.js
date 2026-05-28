// ═══════════════════════════════════════════════════════════════════════════
// link-picker.js — Link picker modal (search pages, posts, CPTs)
// ═══════════════════════════════════════════════════════════════════════════

function getLinkPickerTypeLabel(resultType) {
  return LINK_PICKER_TYPE_LABELS[resultType] || resultType.replace(/^cpt_/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function ensureLinkPickerModal() {
  if (document.getElementById('linkPickerModal')) return;
  const modal = document.createElement('div');
  modal.id = 'linkPickerModal';
  modal.className = 'link-picker-modal';
  modal.innerHTML = `
    <div class="link-picker-backdrop" onclick="closeLinkPicker()"></div>
    <div class="link-picker-panel">
      <div class="link-picker-header">
        <div class="link-picker-title">Choisir un lien</div>
        <button style="background:none;border:none;cursor:pointer;padding:4px;color:var(--gray-400)" onclick="closeLinkPicker()" aria-label="Fermer"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="link-picker-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute;left:30px;top:50%;transform:translateY(-50%);color:var(--gray-400)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" class="form-input" id="linkPickerSearchInput" placeholder="Rechercher un contenu..." style="padding-left:36px" oninput="handleLinkPickerSearch(this.value)">
      </div>
      <div class="link-picker-results" id="linkPickerResults">
        <div class="link-picker-loading">Chargement...</div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function openLinkPicker(callback) {
  window._linkPickerCallback = callback;
  ensureLinkPickerModal();
  document.getElementById('linkPickerSearchInput').value = '';
  document.getElementById('linkPickerModal').classList.add('is-open');
  document.getElementById('linkPickerResults').innerHTML = '<div class="link-picker-loading">Chargement...</div>';
  try {
    const data = await apiFetch('/search?limit=100');
    renderLinkPickerResults(data.results || []);
  } catch (e) {
    document.getElementById('linkPickerResults').innerHTML = '<div class="link-picker-empty">Erreur de chargement</div>';
  }
  setTimeout(() => document.getElementById('linkPickerSearchInput').focus(), 100);
}

function closeLinkPicker() {
  window._linkPickerCallback = null;
  const modal = document.getElementById('linkPickerModal');
  if (modal) modal.classList.remove('is-open');
}

function handleLinkPickerSearch(q) {
  clearTimeout(window._linkPickerDebounce);
  window._linkPickerDebounce = setTimeout(async () => {
    const container = document.getElementById('linkPickerResults');
    container.innerHTML = '<div class="link-picker-loading">Recherche...</div>';
    try {
      const data = await apiFetch(`/search?q=${encodeURIComponent(q)}&limit=50`);
      renderLinkPickerResults(data.results || []);
    } catch (e) {
      container.innerHTML = '<div class="link-picker-empty">Erreur de recherche</div>';
    }
  }, 250);
}

function renderLinkPickerResults(results) {
  const container = document.getElementById('linkPickerResults');
  if (!results.length) {
    container.innerHTML = '<div class="link-picker-empty">Aucun resultat</div>';
    return;
  }
  container.innerHTML = results.map(r => {
    const url = (r.base_url || '/') + (r.slug || '');
    const typeLabel = getLinkPickerTypeLabel(r.result_type);
    const safeTitle = (r.title || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return `<button type="button" class="link-picker-item" onclick="selectLinkPickerItem('${escapeHtml(url)}', '${safeTitle}')">
      <span class="link-picker-item-title">${escapeHtml(r.title)}</span>
      <span class="link-picker-item-type">${escapeHtml(typeLabel)}</span>
    </button>`;
  }).join('');
}

function selectLinkPickerItem(url, title) {
  if (_linkPickerCallback) _linkPickerCallback(url, title);
  closeLinkPicker();
}

function openLinkPickerForField(btn) {
  const field = btn.closest('.link-field');
  if (!field) return;
  openLinkPicker((url, title) => {
    const urlInput = field.querySelector('.link-field-url') || field.querySelector('input[name$="__url"]') || field.querySelector('input[placeholder="URL"]');
    const titleInput = field.querySelector('.link-field-title') || field.querySelector('input[name$="__title"]') || field.querySelector('input[placeholder*="itre"]');
    if (urlInput) { urlInput.value = url; urlInput.dispatchEvent(new Event('input', { bubbles: true })); }
    if (titleInput) { titleInput.value = title; titleInput.dispatchEvent(new Event('input', { bubbles: true })); }
  });
}

// --- Expose on window ---
Object.assign(window, {
  getLinkPickerTypeLabel, ensureLinkPickerModal,
  openLinkPicker, closeLinkPicker, handleLinkPickerSearch,
  renderLinkPickerResults, selectLinkPickerItem, openLinkPickerForField,
});
