// ========== BLOCS RÉUTILISABLES ==========

// Mutable state
window._reusableBlocsCache = [];
window._reusableBlocsSearch = '';
window._reusableBlocsCurrentPage = 1;
window.reusableBlocBuilderMode = false;

const REUSABLE_BLOCS_PER_PAGE = 10;

async function renderReusableBlocs() {
  showLoading();
  try {
    window._reusableBlocsCache = await apiFetch('/reusable-blocs');
    window._reusableBlocsSearch = '';
    window._reusableBlocsCurrentPage = 1;
    hideLoading();
    return renderReusableBlocsView();
  } catch (error) {
    hideLoading();
    showToast('Erreur lors du chargement des blocs réutilisables', 'error');
    return '<div class="card"><p>Erreur de chargement</p></div>';
  }
}

function getFilteredReusableBlocs() {
  if (!window._reusableBlocsSearch) return window._reusableBlocsCache;
  const q = window._reusableBlocsSearch.toLowerCase();
  return window._reusableBlocsCache.filter(b => b.title.toLowerCase().includes(q));
}

function renderReusableBlocsView() {
  const filtered = getFilteredReusableBlocs();
  const totalPages = Math.max(1, Math.ceil(filtered.length / REUSABLE_BLOCS_PER_PAGE));
  if (window._reusableBlocsCurrentPage > totalPages) window._reusableBlocsCurrentPage = totalPages;
  const start = (window._reusableBlocsCurrentPage - 1) * REUSABLE_BLOCS_PER_PAGE;
  const paginated = filtered.slice(start, start + REUSABLE_BLOCS_PER_PAGE);

  return `
    <div class="page-header">
      <h1>Blocs réutilisables</h1>
      <button class="btn btn-primary" onclick="openReusableBlocBuilder(null)">
        <span class="icon">➕</span>
        Nouveau bloc
      </button>
    </div>

    <div class="card">
      <div class="pages-toolbar">
        <div class="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="form-input pages-search-input" placeholder="Rechercher un bloc…" value="${escapeHtml(window._reusableBlocsSearch)}" oninput="handleReusableBlocsSearch(this.value)">
          ${window._reusableBlocsSearch ? '<button type="button" class="search-clear" onclick="handleReusableBlocsSearch(\'\')">✕</button>' : ''}
        </div>
        <span class="pages-count">${filtered.length} bloc${filtered.length > 1 ? 's' : ''}${window._reusableBlocsSearch ? ` trouvé${filtered.length > 1 ? 's' : ''}` : ''}</span>
      </div>
      ${paginated.length > 0 ? renderReusableBlocsTable(paginated) : renderEmptyState('📦', 'Aucun bloc réutilisable', 'Créez un bloc pour le réutiliser sur plusieurs pages')}
      ${totalPages > 1 ? renderReusableBlocsPagination(totalPages) : ''}
    </div>
  `;
}

function renderReusableBlocsTable(blocs) {
  return `
    <div class="pages-list">
      ${blocs.map(bloc => {
        const safeTitle = bloc.title.replace(/'/g, "\\'");
        return '<div class="page-item">'
          + '<div class="page-item__info">'
          +   '<div class="page-item__title">' + escapeHtml(bloc.title) + '</div>'
          + '</div>'
          + '<div class="page-item__meta">'
          +   (bloc.author?.name ? '<span class="page-item__author">' + escapeHtml(bloc.author.name) + '</span>' : '')
          +   '<span class="page-item__date">' + new Date(bloc.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) + '</span>'
          + '</div>'
          + '<div class="page-item__badges">'
          +   '<span class="badge ' + (bloc.status === 'published' ? 'badge-success' : 'badge-warning') + '">'
          +     (bloc.status === 'published' ? 'Publié' : 'Brouillon')
          +   '</span>'
          + '</div>'
          + '<div class="page-item__actions">'
          +   '<button class="btn-icon-action" onclick="editReusableBloc(' + bloc.id + ')" title="Modifier"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
          +   '<button class="btn-icon-action" onclick="duplicateReusableBloc(' + bloc.id + ')" title="Dupliquer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>'
          +   '<button class="btn-icon-action btn-icon-action--danger" onclick="deleteReusableBloc(' + bloc.id + ', \'' + safeTitle + '\')" title="Supprimer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>'
          + '</div>'
        + '</div>';
      }).join('')}
    </div>
  `;
}

function renderReusableBlocsPagination(totalPages) {
  let btns = '';
  for (let i = 1; i <= totalPages; i++) {
    btns += `<button type="button" class="pagination-btn ${i === window._reusableBlocsCurrentPage ? 'active' : ''}" onclick="goToReusableBlocsPage(${i})">${i}</button>`;
  }
  return `<div class="pages-pagination">${btns}</div>`;
}

function handleReusableBlocsSearch(value) {
  window._reusableBlocsSearch = value;
  window._reusableBlocsCurrentPage = 1;
  refreshReusableBlocsView();
}

function goToReusableBlocsPage(page) {
  window._reusableBlocsCurrentPage = page;
  refreshReusableBlocsView();
}

function refreshReusableBlocsView() {
  const container = document.getElementById('content');
  if (!container) return;
  container.innerHTML = renderReusableBlocsView();
  const input = container.querySelector('.pages-search-input');
  if (input && window._reusableBlocsSearch) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

async function openReusableBlocBuilder(blocId) {
  clearBuilderDirty();
  window.reusableBlocBuilderMode = true;
  pageBuilderState.editingPageId = blocId;
  pageBuilderState.blocks = [];
  pageBuilderState.meta = { title: '', slug: '', status: 'published', show_in_menu: false, menu_order: 0, parent_id: null };
  pageBuilderState.pageMenus = [];
  selectedBlockId = null;
  localStorage.setItem('adminLastView', `rb-builder:${blocId ?? 'new'}`);
  await loadModuleFieldSchema();
  ensureBaseModuleStyles();
  if (blocId) {
    showLoading();
    try {
      const bloc = await apiFetch(`/reusable-blocs/${blocId}`);
      if (bloc) {
        pageBuilderState.blocks = parsePageContent(bloc.content);
        pageBuilderState.meta = { title: bloc.title, slug: '', status: bloc.status || 'published', show_in_menu: false, menu_order: 0, parent_id: null };
      }
    } catch (e) {}
    hideLoading();
  }
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  const rbNav = document.querySelector('[data-section="reusable-blocs"]');
  if (rbNav) rbNav.classList.add('active');
  document.getElementById('content').innerHTML = await renderReusableBlocBuilder();
  attachPageBuilderListeners();
  // Apply border-rounded class to canvas based on current settings
  if (siteSettingsCache) {
    const canvas = document.getElementById('builderCanvas');
    if (canvas) canvas.classList.toggle('border-rounded', siteSettingsCache.rounded === '1');
  }
}

async function renderReusableBlocBuilder() {
  const m = pageBuilderState.meta;

  // Filter out reusable-bloc from module categories to prevent recursion
  const filteredCategories = MODULE_CATEGORIES.map(category => ({
    ...category,
    modules: category.modules.filter(name => toKebabCase(name) !== 'reusable-bloc')
  })).filter(category => category.modules.length > 0);

  return `
    <div class="page-builder">
      <header class="builder-header">
        <button type="button" class="btn btn-danger" onclick="closeReusableBlocBuilder()">← Retour</button>
        <div class="builder-meta">
          <div class="builder-field-group">
            <label class="builder-field-label">Titre du bloc</label>
            <input type="text" class="form-input builder-title" placeholder="Nom du bloc réutilisable" value="${escapeHtml(m.title)}" data-field="title">
          </div>
        </div>
        <div class="builder-actions">
          <button type="button" class="btn btn-primary" onclick="saveReusableBlocBuilder()">Enregistrer</button>
        </div>
      </header>
      <div class="builder-body">
        <aside class="builder-sidebar">
          <div class="builder-modules-panel" id="builderModulesPanel" style="${selectedBlockId ? 'display:none' : ''}">
            <h3>Modules</h3>
            <p class="form-help">Glissez un module dans la zone de droite.</p>
            <div class="builder-modules-list">
              ${filteredCategories.map(category => `
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
          </div>
          <div class="builder-settings" id="builderSettings" style="${selectedBlockId ? '' : 'display:none'}">
            ${renderBuilderSettingsPanel()}
          </div>
          <div class="builder-sidebar-resize" id="builderSidebarResize"></div>
        </aside>
        <main class="builder-canvas" id="builderCanvas" data-drop-zone="true">
          <div class="builder-canvas-inner" id="builderCanvasInner" style="${buildColorOverrideStyle()}">
            <div class="builder-canvas-placeholder" id="builderPlaceholder">Glissez des modules ici ou cliquez sur un module à gauche pour l'ajouter.</div>
            <div class="builder-blocks" id="builderBlocks">
              ${renderBlocksWithInsertButtons(pageBuilderState.blocks)}
            </div>
          </div>
        </main>
      </div>
    </div>
  `;
}

async function closeReusableBlocBuilder() {
  if (_builderDirty) {
    const ok = await confirmModal('Vous avez des modifications non enregistrées. Quitter sans sauvegarder ?', 'Modifications non enregistrées');
    if (!ok) return;
    clearBuilderDirty();
  }
  window.reusableBlocBuilderMode = false;
  loadSection('reusable-blocs');
}

async function saveReusableBlocBuilder() {
  // Sync inline editing content if active
  if (_inlineEditingBlockId && _inlineEditingElement) {
    _syncInlineContentToBlockData(_inlineEditingElement);
  }
  // Sync title from DOM
  const titleInput = document.querySelector('.builder-title');
  const title = titleInput ? titleInput.value.trim() : pageBuilderState.meta.title;
  if (!title) { showToast('Le titre est requis', 'error'); return; }

  // Force-sync all Quill editors
  _quillInstances.forEach((quill, id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const textarea = el.parentElement?.querySelector('.wysiwyg-source');
    if (textarea) textarea.value = (quill.getSemanticHTML() || '').replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');
  });
  // Sync the currently open block settings form
  const panel = document.getElementById('builderSettings');
  const form = panel?.querySelector('form.builder-block-form');
  if (form && selectedBlockId) {
    liveUpdateFromSettingsForm(form);
  }

  const content = JSON.stringify(pageBuilderState.blocks);
  showLoading();
  try {
    if (pageBuilderState.editingPageId) {
      await apiFetch(`/reusable-blocs/${pageBuilderState.editingPageId}`, { method: 'PUT', body: JSON.stringify({ title, content, status: 'published' }) });
      showToast('Bloc réutilisable mis à jour', 'success');
    } else {
      const res = await apiFetch('/reusable-blocs', { method: 'POST', body: JSON.stringify({ title, content, status: 'published' }) });
      showToast('Bloc réutilisable créé', 'success');
      if (res && res.id) {
        pageBuilderState.editingPageId = res.id;
        localStorage.setItem('adminLastView', `rb-builder:${res.id}`);
      }
    }
    clearBuilderDirty();
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
    return;
  }
  hideLoading();
}

async function editReusableBloc(id) {
  await openReusableBlocBuilder(id);
}

async function duplicateReusableBloc(id) {
  showLoading();
  try {
    const blocs = await apiFetch('/reusable-blocs');
    const source = blocs.find(b => b.id === id);
    if (!source) { hideLoading(); showToast('Bloc introuvable', 'error'); return; }

    await apiFetch('/reusable-blocs', {
      method: 'POST',
      body: JSON.stringify({
        title: source.title + ' (copie)',
        content: source.content,
        status: 'published',
      }),
    });
    showToast('Bloc dupliqué', 'success');
    loadSection('reusable-blocs');
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
  }
}

async function deleteReusableBloc(id, title) {
  const ok = await confirmModal(`Voulez-vous vraiment supprimer le bloc "${title}" ?`);
  if (!ok) return;

  showLoading();
  try {
    await apiFetch(`/reusable-blocs/${id}`, { method: 'DELETE' });
    showToast('Bloc supprimé', 'success');
    loadSection('reusable-blocs');
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
  }
}

// Expose all on window
Object.assign(window, {
  renderReusableBlocs,
  getFilteredReusableBlocs,
  renderReusableBlocsView,
  renderReusableBlocsTable,
  renderReusableBlocsPagination,
  handleReusableBlocsSearch,
  goToReusableBlocsPage,
  refreshReusableBlocsView,
  openReusableBlocBuilder,
  renderReusableBlocBuilder,
  closeReusableBlocBuilder,
  saveReusableBlocBuilder,
  editReusableBloc,
  duplicateReusableBloc,
  deleteReusableBloc,
});
