// pages.js — Pages list, CRUD, bulk actions, slug generation
// Extracted from app.js (lines 10955-11297, 13566-13875, 15138-15216)

async function renderPages() {
  showLoading();
  try {
    const [pages, menuInfo, menus] = await Promise.all([
      apiFetch('/pages'),
      apiFetch('/pages/menu-info'),
      apiFetch('/menus'),
    ]);
    window._pagesCache = pages;
    window._pagesMenuInfo = menuInfo || {};
    window._pagesMenusList = (menus || []).filter(m => m.location);
    window._pagesSearch = '';
    window._pagesCurrentPage = 1;
    window._pagesActiveMenu = null;
    window._pagesMenuItems = {};
    window._pagesSelected = new Set();
    hideLoading();
    return renderPagesView();
  } catch (error) {
    hideLoading();
    showToast('Erreur lors du chargement des pages', 'error');
    return '<div class="card"><p>Erreur de chargement</p></div>';
  }
}

function getFilteredPages() {
  if (!_pagesSearch) return _pagesCache;
  const q = _pagesSearch.toLowerCase();
  return _pagesCache.filter(p =>
    p.title.toLowerCase().includes(q) ||
    p.slug.toLowerCase().includes(q) ||
    (p.parent_title && p.parent_title.toLowerCase().includes(q))
  );
}

function renderPagesMenuButtons() {
  const allBtn = `<button type="button" class="pages-menu-btn ${_pagesActiveMenu === null ? 'active' : ''}" onclick="setActiveMenu(null)">Toutes les pages</button>`;
  const menuBtns = _pagesMenusList.map(m => {
    const loc = MENU_LOCATIONS.find(l => l.value === m.location);
    const label = loc && loc.value ? loc.label : m.name;
    return `<button type="button" class="pages-menu-btn ${_pagesActiveMenu === m.id ? 'active' : ''}" onclick="setActiveMenu(${m.id})">${escapeHtml(label)}</button>`;
  }).join('');
  return `<div class="pages-menu-buttons">${allBtn}${menuBtns}</div>`;
}

async function setActiveMenu(menuId) {
  window._pagesActiveMenu = menuId;
  window._pagesSearch = '';
  window._pagesCurrentPage = 1;
  if (menuId !== null && !_pagesMenuItems[menuId]) {
    showLoading();
    try {
      const menu = await apiFetch('/menus/' + menuId);
      window._pagesMenuItems[menuId] = menu.items || [];
    } catch (e) {
      window._pagesMenuItems[menuId] = [];
    }
    hideLoading();
  }
  refreshPagesView();
}

function flattenMenuHierarchy(items, depth) {
  const result = [];
  (items || []).forEach(item => {
    result.push({ ...item, _depth: depth || 0 });
    if (item.children && item.children.length > 0) {
      result.push(...flattenMenuHierarchy(item.children, (depth || 0) + 1));
    }
  });
  return result;
}

function renderMenuHierarchyTable(menuId) {
  const items = _pagesMenuItems[menuId] || [];
  if (items.length === 0) return renderEmptyState('📋', 'Menu vide', 'Aucune page dans ce menu');
  const hierarchy = flattenMenuHierarchy(items, 0);
  return `
    <div class="pages-list">
      <div class="pages-list-header">
        <span class="page-item__info">Page</span>
        <span class="page-item__meta">Modifié</span>
        <span class="page-item__badges">Statut</span>
        <span class="page-item__actions" style="opacity:1">Actions</span>
      </div>
      ${hierarchy.map(item => {
        const page = item.page_id ? _pagesCache.find(p => p.id === item.page_id) : null;
        const title = item.title || (page ? page.title : 'Sans titre');
        const slug = page ? page.slug : (item.url || '');
        const indent = item._depth * 28;
        const isChild = item._depth > 0;
        const safeTitle = title.replace(/'/g, "\\'");
        return '<div class="page-item" style="padding-left: ' + (20 + indent) + 'px">'
          + '<div class="page-item__info">'
          +   '<div class="page-item__title">'
          +     (isChild ? '<span class="page-item__child-icon">↳</span>' : '') + escapeHtml(title)
          +   '</div>'
          +   '<div class="page-item__slug">/' + escapeHtml(slug) + '</div>'
          + '</div>'
          + '<div class="page-item__meta">'
          +   (page && page.author?.name ? '<span class="page-item__author">' + escapeHtml(page.author.name) + '</span>' : '')
          +   (page ? '<span class="page-item__date">' + new Date(page.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) + '</span>' : '')
          + '</div>'
          + '<div class="page-item__badges">'
          +   (page ? '<span class="badge ' + (page.status === 'published' ? 'badge-success' : 'badge-warning') + '">' + (page.status === 'published' ? 'Publié' : 'Brouillon') + '</span>' : '<span class="badge badge-muted">Lien externe</span>')
          + '</div>'
          + '<div class="page-item__actions">'
          +   (page ? '<button class="btn-icon-action" onclick="editPage(' + page.id + ')" title="Modifier"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
          +     '<button class="btn-icon-action" onclick="duplicatePage(' + page.id + ')" title="Dupliquer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>'
          +     '<button class="btn-icon-action btn-icon-action--danger" onclick="deletePage(' + page.id + ', \'' + safeTitle + '\')" title="Supprimer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>'
          :   '')
          + '</div>'
        + '</div>';
      }).join('')}
    </div>
  `;
}

function renderPagesView() {
  const isMenuView = _pagesActiveMenu !== null;
  const menuButtons = _pagesMenusList.length > 0 ? renderPagesMenuButtons() : '';

  if (isMenuView) {
    const menuId = _pagesActiveMenu;
    const menu = _pagesMenusList.find(m => m.id === menuId);
    const loc = menu ? (MENU_LOCATIONS.find(l => l.value === menu.location)?.label || menu.name) : '';
    const items = _pagesMenuItems[menuId] || [];
    return `
      <div class="page-header">
        <h1>Pages</h1>
        <button class="btn btn-primary" onclick="openPageBuilder(null)">
          <span class="icon">➕</span>
          Nouvelle page
        </button>
      </div>
      <div class="card">
        ${menuButtons}
        <div class="pages-toolbar">
          <span class="pages-count">${flattenMenuHierarchy(items, 0).length} élément${flattenMenuHierarchy(items, 0).length > 1 ? 's' : ''} dans ${escapeHtml(loc)}</span>
        </div>
        ${renderMenuHierarchyTable(menuId)}
      </div>
    `;
  }

  const filtered = getFilteredPages();
  const sorted = filtered.slice().sort((a, b) => {
    let cmp = 0;
    if (_pagesSortField === 'updated_at') {
      cmp = new Date(a.updated_at) - new Date(b.updated_at);
    } else {
      cmp = (a.title || '').localeCompare(b.title || '');
    }
    return _pagesSortDir === 'desc' ? -cmp : cmp;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGES_PER_PAGE));
  if (_pagesCurrentPage > totalPages) window._pagesCurrentPage = totalPages;
  const start = (_pagesCurrentPage - 1) * PAGES_PER_PAGE;
  const paginated = sorted.slice(start, start + PAGES_PER_PAGE);

  return `
    <div class="page-header">
      <h1>Pages</h1>
      <div class="page-header-actions">
        ${(() => { const a = aiButtonAttrs(); return `<button class="btn btn-ai" onclick="openBulkAiModal()" title="${a.title}"${a.disabled ? ' disabled' : ''}>
          <i class="fa-solid fa-wand-magic-sparkles"></i> Générer par IA
        </button>`; })()}
        <button class="btn btn-primary" onclick="openPageBuilder(null)">
          <i class="fa-solid fa-plus"></i> Nouvelle page
        </button>
      </div>
    </div>
    <div class="card">
      ${menuButtons}
      <div class="pages-toolbar">
        <div class="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="form-input pages-search-input" placeholder="Rechercher une page…" value="${escapeHtml(_pagesSearch)}" oninput="handlePagesSearch(this.value)">
          ${_pagesSearch ? '<button type="button" class="search-clear" onclick="handlePagesSearch(\'\')">✕</button>' : ''}
        </div>
        <span class="pages-count">${sorted.length} page${sorted.length > 1 ? 's' : ''}${_pagesSearch ? ` trouvée${sorted.length > 1 ? 's' : ''}` : ''}</span>
      </div>
      ${_pagesSelected.size > 0 ? renderPagesBulkBar() : ''}
      ${paginated.length > 0 ? renderPagesTable(paginated) : renderEmptyState('🔍', 'Aucune page trouvée', 'Essayez un autre terme de recherche')}
      ${totalPages > 1 ? renderPagesPagination(totalPages) : ''}
    </div>
  `;
}

function renderPagesPagination(totalPages) {
  let btns = '';
  for (let i = 1; i <= totalPages; i++) {
    btns += `<button type="button" class="pagination-btn ${i === _pagesCurrentPage ? 'active' : ''}" onclick="goToPagesPage(${i})">${i}</button>`;
  }
  return `<div class="pages-pagination">${btns}</div>`;
}

function handlePagesSearch(value) {
  window._pagesSearch = value;
  window._pagesCurrentPage = 1;
  refreshPagesView();
}

function goToPagesPage(page) {
  window._pagesCurrentPage = page;
  refreshPagesView();
}

function refreshPagesView() {
  const container = document.getElementById('content');
  if (!container) return;
  container.innerHTML = renderPagesView();
  // Restore focus on search input and place cursor at the end
  const input = container.querySelector('.pages-search-input');
  if (input && _pagesSearch) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

// ========== PAGES BULK ACTIONS ==========

function togglePageSelect(id, checked) {
  if (checked) _pagesSelected.add(id);
  else _pagesSelected.delete(id);
  refreshPagesView();
}

function toggleAllPagesOnPage(checked, ids) {
  ids.forEach(id => checked ? _pagesSelected.add(id) : _pagesSelected.delete(id));
  refreshPagesView();
}

function clearPagesSelection() {
  _pagesSelected.clear();
  refreshPagesView();
}

function renderPagesBulkBar() {
  const count = _pagesSelected.size;
  return `
    <div class="pages-bulk-bar">
      <span class="pages-bulk-bar__count">${count} page${count > 1 ? 's' : ''} sélectionnée${count > 1 ? 's' : ''}</span>
      <div class="pages-bulk-bar__actions">
        <button type="button" class="btn btn-sm btn-outline" onclick="bulkPagesStatus('published')">Publier</button>
        <button type="button" class="btn btn-sm btn-outline" onclick="bulkPagesStatus('private')">Privé</button>
        <button type="button" class="btn btn-sm btn-outline" onclick="bulkPagesStatus('draft')">Brouillon</button>
        <button type="button" class="btn btn-sm btn-outline" onclick="bulkPagesDuplicate()">Dupliquer</button>
        <button type="button" class="btn btn-sm btn-danger" onclick="bulkPagesDelete()">Supprimer</button>
      </div>
      <button type="button" class="pages-bulk-bar__close" onclick="clearPagesSelection()" title="Annuler la sélection">✕</button>
    </div>
  `;
}

async function bulkPagesStatus(status) {
  const ids = [..._pagesSelected];
  const label = status === 'published' ? 'publiée' : status === 'private' ? 'mise en privé' : 'mise en brouillon';
  showLoading();
  try {
    await Promise.all(ids.map(id => {
      const source = _pagesCache.find(p => p.id === id);
      if (!source) return null;
      return apiFetch(`/pages/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: source.title,
          slug: source.slug,
          content: source.content,
          color_overrides: source.color_overrides,
          seo_meta: source.seo_meta,
          status,
          show_in_menu: source.show_in_menu ?? false,
          menu_order: source.menu_order ?? 0,
          parent_id: source.parent_id || null,
        }),
      });
    }));
    showToast(`${ids.length} page${ids.length > 1 ? 's' : ''} ${label}${ids.length > 1 ? 's' : ''}`, 'success');
    _pagesSelected.clear();
    loadSection('pages');
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
  }
}

async function bulkPagesDuplicate() {
  const ids = [..._pagesSelected];
  showLoading();
  try {
    const pages = _pagesCache;
    const existingSlugs = new Set(pages.map(p => p.slug));
    for (const id of ids) {
      const source = pages.find(p => p.id === id);
      if (!source) continue;
      const baseSlug = source.slug + '-copie';
      let slug = baseSlug;
      let counter = 1;
      while (existingSlugs.has(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      existingSlugs.add(slug);
      await apiFetch('/pages', {
        method: 'POST',
        body: JSON.stringify({
          title: source.title + ' (copie)',
          slug,
          content: source.content,
          status: 'draft',
          show_in_menu: false,
          menu_order: 0,
          parent_id: source.parent_id || null,
        }),
      });
    }
    showToast(`${ids.length} page${ids.length > 1 ? 's' : ''} dupliquée${ids.length > 1 ? 's' : ''}`, 'success');
    _pagesSelected.clear();
    loadSection('pages');
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
  }
}

async function bulkPagesDelete() {
  const ids = [..._pagesSelected];
  const ok = await confirmModal(`Voulez-vous vraiment supprimer ${ids.length} page${ids.length > 1 ? 's' : ''} ?`);
  if (!ok) return;

  showLoading();
  try {
    await Promise.all(ids.map(id => apiFetch(`/pages/${id}`, { method: 'DELETE' })));
    showToast(`${ids.length} page${ids.length > 1 ? 's' : ''} supprimée${ids.length > 1 ? 's' : ''}`, 'success');
    _pagesSelected.clear();
    loadSection('pages');
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
  }
}

/**
 * Sort pages hierarchically based on primary menu structure.
 * Pages in the primary menu come first (ordered by menu_order), with children nested under parents.
 * Pages not in any menu come last, sorted by title.
 */
function sortPagesHierarchically(pages) {
  // Build a map: pageId → primaryParent page_id (from menu info)
  const parentMap = {}; // pageId → parent page_id
  Object.entries(_pagesMenuInfo).forEach(([pid, info]) => {
    if (info.primaryParent && info.primaryParent.page_id) {
      parentMap[parseInt(pid)] = info.primaryParent.page_id;
    }
  });

  const roots = pages.filter(p => !parentMap[p.id]).sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  const childrenMap = {};
  pages.filter(p => parentMap[p.id]).forEach(p => {
    const parentPageId = parentMap[p.id];
    if (!childrenMap[parentPageId]) childrenMap[parentPageId] = [];
    childrenMap[parentPageId].push(p);
  });
  Object.values(childrenMap).forEach(arr => arr.sort((a, b) => (a.title || '').localeCompare(b.title || '')));
  const sorted = [];
  roots.forEach(parent => {
    sorted.push(parent);
    if (childrenMap[parent.id]) sorted.push(...childrenMap[parent.id]);
  });
  // Append orphans
  const inSorted = new Set(sorted.map(p => p.id));
  pages.forEach(p => { if (!inSorted.has(p.id)) sorted.push(p); });
  return sorted;
}

/**
 * Check if a page is a child in the primary menu
 */
function getPagePrimaryParent(pageId) {
  const info = _pagesMenuInfo[pageId];
  return info?.primaryParent || null;
}

function renderPageMenuBadges(pageId) {
  const info = _pagesMenuInfo[pageId];
  if (!info || !info.menus || info.menus.length === 0) {
    return '<span class="badge badge-muted">Hors menu</span>';
  }
  return info.menus.map(m => {
    const loc = MENU_LOCATIONS.find(l => l.value === m.location);
    const label = loc && loc.value ? loc.label : m.name;
    return `<span class="badge badge-success">${escapeHtml(label)}</span>`;
  }).join(' ');
}

function togglePagesSort(field) {
  if (_pagesSortField === field) {
    window._pagesSortDir = _pagesSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    window._pagesSortField = field;
    window._pagesSortDir = field === 'updated_at' ? 'desc' : 'asc';
  }
  window._pagesCurrentPage = 1;
  document.querySelector('.main-content').innerHTML = renderPagesView();
}

function renderPagesTable(pages) {
  const arrow = (field) => _pagesSortField === field ? (_pagesSortDir === 'asc' ? ' ▲' : ' ▼') : '';
  const activeStyle = (field) => _pagesSortField === field ? 'font-weight:700;' : '';
  const allIds = pages.map(p => p.id);
  const allChecked = allIds.length > 0 && allIds.every(id => _pagesSelected.has(id));
  return `
    <div class="pages-list">
      <div class="pages-list-header">
        <label class="page-item__checkbox"><input type="checkbox" ${allChecked ? 'checked' : ''} onchange="toggleAllPagesOnPage(this.checked, [${allIds.join(',')}])"></label>
        <span class="page-item__info sortable-header" style="cursor:pointer;${activeStyle('title')}" onclick="togglePagesSort('title')">Page${arrow('title')}</span>
        <span class="page-item__meta sortable-header" style="cursor:pointer;${activeStyle('updated_at')}" onclick="togglePagesSort('updated_at')">Modifié${arrow('updated_at')}</span>
        <span class="page-item__badges">Statut</span>
        <span class="page-item__actions" style="opacity:1">Actions</span>
      </div>
      ${pages.map(page => {
        const safeTitle = page.title.replace(/'/g, "\\'");
        const checked = _pagesSelected.has(page.id);
        return '<div class="page-item' + (checked ? ' page-item--selected' : '') + '">'
          + '<label class="page-item__checkbox"><input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="togglePageSelect(' + page.id + ', this.checked)"></label>'
          + '<div class="page-item__info">'
          +   '<div class="page-item__title">' + escapeHtml(page.title) + '</div>'
          +   '<div class="page-item__slug">/' + escapeHtml(page.slug) + '</div>'
          + '</div>'
          + '<div class="page-item__meta">'
          +   (page.author?.name ? '<span class="page-item__author">' + escapeHtml(page.author.name) + '</span>' : '')
          +   '<span class="page-item__date">' + new Date(page.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) + '</span>'
          + '</div>'
          + '<div class="page-item__badges">'
          +   renderPageMenuBadges(page.id)
          +   '<span class="badge ' + (page.status === 'published' ? 'badge-success' : page.status === 'private' ? 'badge-info' : 'badge-warning') + '">'
          +     (page.status === 'published' ? 'Publié' : page.status === 'private' ? 'Privé' : 'Brouillon')
          +   '</span>'
          +   (page.published_date && new Date(page.published_date) > new Date() ? '<span class="badge badge-outline" title="Planifié le ' + new Date(page.published_date).toLocaleDateString('fr-FR') + '">⏱</span>' : '')
          + '</div>'
          + '<div class="page-item__actions">'
          +   '<button class="btn-icon-action" onclick="editPage(' + page.id + ')" title="Modifier"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
          +   '<button class="btn-icon-action" onclick="duplicatePage(' + page.id + ')" title="Dupliquer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>'
          +   '<button class="btn-icon-action btn-icon-action--danger" onclick="deletePage(' + page.id + ', \'' + safeTitle + '\')" title="Supprimer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>'
          + '</div>'
        + '</div>';
      }).join('')}
    </div>
  `;
}

async function showPageForm(pageId = null) {
  showLoading();

  const pages = await apiFetch('/pages');
  let page = null;
  if (pageId) {
    page = pages.find(p => p.id === pageId);
  }

  // Get available parent pages (excluding current page and its children)
  const availableParents = pages.filter(p => p.id !== pageId && p.parent_id !== pageId);

  hideLoading();

  const modal = document.getElementById('pageModal');
  modal.style.display = 'block';
  modal.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;" onclick="if(event.target === this) closeModal()">
      <div class="card" style="max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h2>${pageId ? 'Modifier la page' : 'Nouvelle page'}</h2>
          <button class="btn btn-outline btn-sm" onclick="closeModal()">✕</button>
        </div>

        <form id="pageForm" onsubmit="savePage(event, ${pageId})">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Titre *</label>
              <input type="text" class="form-input" id="pageTitle" name="title" value="${page?.title || ''}" oninput="generatePageSlug(${pageId})" required>
            </div>

            <div class="form-group">
              <label class="form-label">Slug *</label>
              <input type="text" class="form-input" id="pageSlug" name="slug" value="${page?.slug || ''}" required>
              <div class="form-help" id="slugHelp">URL de la page (ex: a-propos)</div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Contenu *</label>
            <textarea class="form-textarea" name="content" rows="10" required>${page?.content || ''}</textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Statut *</label>
              <select class="form-select" name="status" required onchange="document.getElementById('pagePublishDateGroup').style.display = this.value === 'draft' ? 'none' : ''">
                <option value="draft" ${page?.status === 'draft' ? 'selected' : ''}>Brouillon</option>
                <option value="published" ${page?.status === 'published' ? 'selected' : ''}>Publié</option>
                <option value="private" ${page?.status === 'private' ? 'selected' : ''}>Privé</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Afficher dans le menu</label>
              <select class="form-select" name="show_in_menu">
                <option value="true" ${page?.show_in_menu !== false ? 'selected' : ''}>Oui</option>
                <option value="false" ${page?.show_in_menu === false ? 'selected' : ''}>Non</option>
              </select>
            </div>
          </div>

          <div class="form-row" id="pagePublishDateGroup" style="display:${!page || page.status === 'draft' ? 'none' : ''}">
            <div class="form-group">
              <label class="form-label">Mode de publication</label>
              <select class="form-select" name="publish_mode" onchange="document.getElementById('pagePublishDate').style.display = this.value === 'now' ? 'none' : ''">
                <option value="now" ${!page?.published_date || !page ? 'selected' : ''}>Maintenant</option>
                <option value="schedule" ${page?.published_date && new Date(page.published_date) > new Date() ? 'selected' : ''}>Planifier</option>
                <option value="backdate" ${page?.published_date && new Date(page.published_date) <= new Date() && page?.published_date ? 'selected' : ''}>Antérieur</option>
              </select>
            </div>
            <div class="form-group" id="pagePublishDate" style="display:${page?.published_date ? '' : 'none'}">
              <label class="form-label">Date de publication</label>
              <input type="datetime-local" class="form-input" name="published_date" value="${page?.published_date ? page.published_date.slice(0,16) : ''}">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Position dans le menu</label>
              <input type="number" class="form-input" name="menu_order" value="${page?.menu_order || 0}" min="0">
              <div class="form-help">Ordre d'affichage (0 = premier)</div>
            </div>

            <div class="form-group">
              <label class="form-label">Page parente (sous-menu)</label>
              <select class="form-select" name="parent_id" id="pageParent">
                <option value="">Aucune (page principale)</option>
                ${availableParents.filter(p => !p.parent_id).map(p => `
                  <option value="${p.id}" ${page?.parent_id === p.id ? 'selected' : ''}>
                    ${p.title}
                  </option>
                `).join('')}
              </select>
              <div class="form-help">Créer un sous-menu${availableParents.filter(p => !p.parent_id).length === 0 ? ' (Créez d\'abord une page principale)' : ''}</div>
            </div>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 32px;">
            <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary">
              ${pageId ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function savePage(event, pageId) {
  event.preventDefault();
  const formData = new FormData(event.target);

  const publishMode = formData.get('publish_mode') || 'now';
  let publishedDate = null;
  if (formData.get('status') !== 'draft' && publishMode !== 'now') {
    const dateVal = formData.get('published_date');
    if (dateVal) publishedDate = dateVal.replace('T', ' ') + ':00';
  }

  const data = {
    title: formData.get('title'),
    slug: formData.get('slug'),
    content: formData.get('content'),
    status: formData.get('status'),
    published_date: publishedDate,
    show_in_menu: formData.get('show_in_menu') === 'true',
    menu_order: parseInt(formData.get('menu_order')) || 0,
    parent_id: formData.get('parent_id') ? parseInt(formData.get('parent_id')) : null
  };

  showLoading();
  try {
    if (pageId) {
      await apiFetch(`/pages/${pageId}`, { method: 'PUT', body: JSON.stringify(data) });
      showToast('Page mise à jour avec succès', 'success');
    } else {
      await apiFetch('/pages', { method: 'POST', body: JSON.stringify(data) });
      showToast('Page créée avec succès', 'success');
    }
    closeModal();
    loadSection('pages');
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
  }
}

async function editPage(id) {
  await openPageBuilder(id);
}

async function duplicatePage(id) {
  showLoading();
  try {
    const pages = await apiFetch('/pages');
    const source = pages.find(p => p.id === id);
    if (!source) { hideLoading(); showToast('Page introuvable', 'error'); return; }

    // Generate unique slug
    const baseSlug = source.slug + '-copie';
    const existingSlugs = new Set(pages.map(p => p.slug));
    let slug = baseSlug;
    let counter = 1;
    while (existingSlugs.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    await apiFetch('/pages', {
      method: 'POST',
      body: JSON.stringify({
        title: source.title + ' (copie)',
        slug,
        content: source.content,
        status: 'draft',
        show_in_menu: false,
        menu_order: 0,
        parent_id: source.parent_id || null,
      }),
    });
    showToast('Page dupliquée', 'success');
    loadSection('pages');
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
  }
}

async function deletePage(id, title) {
  const ok = await confirmModal(`Voulez-vous vraiment supprimer la page "${title}" ?`);
  if (!ok) return;

  showLoading();
  try {
    await apiFetch(`/pages/${id}`, { method: 'DELETE' });
    showToast('Page supprimée', 'success');
    loadSection('pages');
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
  }
}

async function generateBuilderSlug() {
  const titleInput = document.querySelector('.builder-title');
  const slugInput = document.querySelector('.builder-slug');
  if (!titleInput || !slugInput) return;

  const title = titleInput.value;
  if (!title) {
    slugInput.value = '';
    syncBuilderMetaFromDOM();
    return;
  }

  let slug = slugify(title);
  const editingPageId = pageBuilderState.editingPageId;

  try {
    const pages = await apiFetch('/pages');
    const existingSlugs = pages
      .filter(p => p.id !== editingPageId)
      .map(p => p.slug);

    if (existingSlugs.includes(slug)) {
      let counter = 1;
      let newSlug = slug;
      while (existingSlugs.includes(newSlug)) {
        newSlug = `${slug}-${counter}`;
        counter++;
      }
      slug = newSlug;
    }
  } catch (error) {
    console.error('Error checking slug:', error);
  }

  slugInput.value = slug;
  syncBuilderMetaFromDOM();
}

async function generatePageSlug(editingPageId = null) {
  const titleInput = document.getElementById('pageTitle');
  const slugInput = document.getElementById('pageSlug');
  const slugHelp = document.getElementById('slugHelp');

  if (!titleInput || !slugInput) return;

  const title = titleInput.value;
  if (!title) {
    slugInput.value = '';
    return;
  }

  let slug = slugify(title);

  // Check if slug already exists
  try {
    const pages = await apiFetch('/pages');
    const existingSlugs = pages
      .filter(p => p.id !== editingPageId)
      .map(p => p.slug);

    if (existingSlugs.includes(slug)) {
      // Add number suffix if slug exists
      let counter = 1;
      let newSlug = slug;
      while (existingSlugs.includes(newSlug)) {
        newSlug = `${slug}-${counter}`;
        counter++;
      }
      slug = newSlug;
      slugHelp.innerHTML = `<span style="color: var(--warning)">⚠️ Slug modifié (original déjà utilisé)</span>`;
    } else {
      slugHelp.innerHTML = `<span style="color: var(--success)">✓ Slug disponible</span>`;
    }
  } catch (error) {
    console.error('Error checking slug:', error);
  }

  slugInput.value = slug;
}

Object.assign(window, {
  renderPages,
  getFilteredPages,
  renderPagesMenuButtons,
  setActiveMenu,
  flattenMenuHierarchy,
  renderMenuHierarchyTable,
  renderPagesView,
  renderPagesTable,
  renderPagesPagination,
  handlePagesSearch,
  goToPagesPage,
  refreshPagesView,
  togglePageSelect,
  toggleAllPagesOnPage,
  clearPagesSelection,
  renderPagesBulkBar,
  bulkPagesStatus,
  bulkPagesDuplicate,
  bulkPagesDelete,
  sortPagesHierarchically,
  getPagePrimaryParent,
  renderPageMenuBadges,
  togglePagesSort,
  showPageForm,
  savePage,
  editPage,
  duplicatePage,
  deletePage,
  generateBuilderSlug,
  generatePageSlug,
});
