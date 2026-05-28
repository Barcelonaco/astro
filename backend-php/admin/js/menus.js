// ========== MENUS ==========

// Mutable state
window._menusCache = [];
window._menuEditId = null;
window._menuItems = [];
window._menuAvailablePages = [];
window._menuCptSections = [];
window._menuTempIdCounter = 1;

async function renderMenus() {
  showLoading();
  try {
    window._menusCache = await apiFetch('/menus');
    hideLoading();
    return renderMenusList();
  } catch (error) {
    hideLoading();
    showToast('Erreur lors du chargement des menus', 'error');
    return '<div class="card"><p>Erreur de chargement</p></div>';
  }
}

function renderMenusList() {
  return `
    <div class="page-header">
      <h1>Menus</h1>
      <button class="btn btn-primary" onclick="openCreateMenuModal()">
        <span class="icon">➕</span>
        Nouveau menu
      </button>
    </div>

    <div class="card">
      ${window._menusCache.length > 0 ? `
        <div class="pages-list">
          <div class="pages-list-header">
            <span class="page-item__info">Menu</span>
            <span class="page-item__parent">Emplacement</span>
            <span class="page-item__actions" style="opacity:1">Actions</span>
          </div>
          ${window._menusCache.map(m => {
            const safeName = escapeHtml(m.name).replace(/'/g, "\\'");
            const loc = m.location ? (MENU_LOCATIONS.find(l => l.value === m.location)?.label || m.location) : '<em style="color:var(--gray-400);">Non assigné</em>';
            return '<div class="page-item">'
              + '<div class="page-item__info" style="cursor:pointer" onclick="openMenuEditor(' + m.id + ')">'
              +   '<div class="page-item__title">' + escapeHtml(m.name) + '</div>'
              + '</div>'
              + '<div class="page-item__parent">' + loc + '</div>'
              + '<div class="page-item__actions">'
              +   '<button class="btn-icon-action" onclick="openMenuEditor(' + m.id + ')" title="Modifier">' + _svgEdit + '</button>'
              +   '<button class="btn-icon-action btn-icon-action--danger" onclick="deleteMenu(' + m.id + ', \'' + safeName + '\')" title="Supprimer">' + _svgDelete + '</button>'
              + '</div>'
            + '</div>';
          }).join('')}
        </div>
      ` : renderEmptyState('📋', 'Aucun menu', 'Créez votre premier menu de navigation')}
    </div>
  `;
}

function openCreateMenuModal() {
  const html = `
    <div class="modal-overlay active" id="menuModal">
      <div class="modal" style="max-width:450px">
        <div class="modal-header">
          <h2>Nouveau menu</h2>
          <button class="modal-close" onclick="closeMenuModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Nom du menu</label>
            <input type="text" class="form-input" id="menuNameInput" placeholder="Ex : Menu principal">
          </div>
          <div class="form-group">
            <label class="form-label">Emplacement</label>
            <select class="form-input" id="menuLocationInput">
              ${MENU_LOCATIONS.map(l => `<option value="${l.value}">${l.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" onclick="closeMenuModal()">Annuler</button>
          <button class="btn btn-primary" onclick="createMenu()">Créer</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('menuNameInput').focus();
}

function closeMenuModal() {
  const modal = document.getElementById('menuModal');
  if (modal) modal.remove();
}

async function createMenu() {
  const name = document.getElementById('menuNameInput').value.trim();
  const location = document.getElementById('menuLocationInput').value;
  if (!name) { showToast('Le nom est obligatoire', 'error'); return; }

  try {
    await apiFetch('/menus', { method: 'POST', body: JSON.stringify({ name, location }) });
    showToast('Menu créé', 'success');
    closeMenuModal();
    document.getElementById('content').innerHTML = await renderMenus();
    attachMenuEvents();
  } catch (error) {
    showToast('Erreur : ' + error.message, 'error');
  }
}

async function deleteMenu(id, name) {
  const ok = await confirmModal(`Voulez-vous vraiment supprimer le menu "${name}" ?`);
  if (!ok) return;
  try {
    await apiFetch(`/menus/${id}`, { method: 'DELETE' });
    showToast('Menu supprimé', 'success');
    document.getElementById('content').innerHTML = await renderMenus();
    attachMenuEvents();
  } catch (error) {
    showToast('Erreur : ' + error.message, 'error');
  }
}

async function openMenuEditor(menuId) {
  showLoading();
  try {
    const [menu, pages, cptSections] = await Promise.all([
      apiFetch(`/menus/${menuId}`),
      apiFetch('/menus/pages'),
      apiFetch('/menus/cpt-items').catch(() => [])
    ]);
    window._menuEditId = menuId;
    window._menuAvailablePages = pages;
    window._menuCptSections = cptSections;
    window._menuTempIdCounter = 1;

    // Convert flatItems to our working format
    window._menuItems = (menu.flatItems || []).map(item => ({
      id: item.id,
      temp_id: null,
      title: item.title || (item.type === 'page' ? item.page_title : '') || '',
      url: item.url || '',
      type: item.type || 'custom',
      page_id: item.page_id || null,
      parent_id: item.parent_id || null,
      menu_order: item.menu_order || 0,
      open_in_new_tab: !!item.open_in_new_tab,
      _page_title: item.page_title || '',
      _page_slug: item.page_slug || '',
    }));

    hideLoading();
    document.getElementById('content').innerHTML = renderMenuEditor(menu);
    attachMenuEditorEvents();
  } catch (error) {
    hideLoading();
    showToast('Erreur lors du chargement du menu', 'error');
  }
}

function renderMenuEditor(menu) {
  const cptSectionsHtml = window._menuCptSections.map(section => {
    return `
      <div class="menu-add-section">
        <h4>${section.icon ? section.icon + ' ' : ''}${escapeHtml(section.label)}</h4>
        <div style="margin-bottom:6px">
          <button class="btn btn-sm btn-outline" onclick="addCptArchiveLink('${escapeHtml(section.archivePath || '/' + section.slug)}', '${escapeHtml(section.label)}')">+ Archive « ${escapeHtml(section.label)} »</button>
        </div>
        ${section.items && section.items.length > 0 ? `
          <input type="text" class="form-input form-input-sm menu-search-input" placeholder="Rechercher…" oninput="filterMenuCptList(this, '${escapeHtml(section.slug)}')">
          <div class="menu-pages-list" id="menuCptList_${escapeHtml(section.slug)}">
            ${section.items.map(item => `
              <label class="menu-page-checkbox" data-search="${escapeHtml(item.title.toLowerCase())}">
                <input type="checkbox" value="${item.id}" data-title="${escapeHtml(item.title)}" data-slug="${escapeHtml(item.slug)}" data-cpt="${escapeHtml(section.slug)}">
                ${escapeHtml(item.title)}
              </label>
            `).join('')}
          </div>
          <button class="btn btn-sm" onclick="addSelectedCptItems('${escapeHtml(section.slug)}')" style="margin-top:8px">Ajouter au menu</button>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="page-header">
      <div>
        <button class="btn btn-sm" onclick="backToMenusList()" style="margin-bottom:8px">&larr; Retour aux menus</button>
        <h1>Modifier : ${escapeHtml(menu.name)}</h1>
      </div>
      <button class="btn btn-primary" onclick="saveCurrentMenu()">Enregistrer le menu</button>
    </div>

    <div class="menu-editor-layout">
      <!-- Left: Add items panel -->
      <div class="card menu-add-panel">
        <h3>Ajouter des éléments</h3>

        <!-- Add page -->
        <div class="menu-add-section">
          <h4>Pages</h4>
          <input type="text" class="form-input form-input-sm menu-search-input" placeholder="Rechercher une page…" oninput="filterMenuPagesList(this)">
          <div class="menu-pages-list" id="menuPagesList">
            ${window._menuAvailablePages.map(p => `
              <label class="menu-page-checkbox" data-search="${escapeHtml(p.title.toLowerCase())}">
                <input type="checkbox" value="${p.id}" data-title="${escapeHtml(p.title)}" data-slug="${escapeHtml(p.slug)}">
                ${escapeHtml(p.title)}${p.parent_title ? ` <small>(${escapeHtml(p.parent_title)})</small>` : ''}
              </label>
            `).join('')}
          </div>
          <button class="btn btn-sm" onclick="addSelectedPages()" style="margin-top:8px">Ajouter au menu</button>
        </div>

        ${cptSectionsHtml}

        <!-- Add custom link -->
        <div class="menu-add-section">
          <h4>Lien personnalisé</h4>
          <div class="form-group">
            <label class="form-label">URL</label>
            <input type="text" class="form-input" id="customLinkUrl" placeholder="https://...">
          </div>
          <div class="form-group">
            <label class="form-label">Texte du lien</label>
            <input type="text" class="form-input" id="customLinkTitle" placeholder="Mon lien">
          </div>
          <button class="btn btn-sm" onclick="addCustomLink()">Ajouter au menu</button>
        </div>

        <!-- Menu settings -->
        <div class="menu-add-section">
          <h4>Paramètres du menu</h4>
          <div class="form-group">
            <label class="form-label">Nom</label>
            <input type="text" class="form-input" id="menuEditorName" value="${escapeHtml(menu.name)}">
          </div>
          <div class="form-group">
            <label class="form-label">Emplacement</label>
            <select class="form-input" id="menuEditorLocation">
              ${MENU_LOCATIONS.map(l => `<option value="${l.value}" ${menu.location === l.value ? 'selected' : ''}>${l.label}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Right: Items structure -->
      <div class="card menu-items-panel">
        <h3>Structure du menu</h3>
        <div id="menuItemsList">
          ${renderMenuItemsList()}
        </div>
        ${window._menuItems.length === 0 ? '<p class="text-muted" style="padding:16px;text-align:center">Ajoutez des éléments depuis le panneau de gauche</p>' : ''}
      </div>
    </div>
  `;
}

function _flattenMenuTree() {
  // Build flat ordered list from parent_id tree
  const sorted = [...window._menuItems].sort((a, b) => a.menu_order - b.menu_order);
  const childrenOf = (parentId) => sorted.filter(i => {
    const pid = i.parent_id;
    if (!parentId) return !pid;
    return pid === parentId || (typeof pid === 'string' && typeof parentId === 'number' && parseInt(pid) === parentId);
  });
  const flat = [];
  function walk(parentId, depth) {
    for (const item of childrenOf(parentId)) {
      const itemId = item.id || item.temp_id;
      flat.push({ item, itemId, depth });
      walk(itemId, depth + 1);
    }
  }
  walk(null, 0);
  return flat;
}

function _syncParentsFromDOM() {
  const rows = [...document.querySelectorAll('#menuItemsList .menu-item-row')];
  const stack = []; // stack of { id, depth }
  rows.forEach((row, idx) => {
    const itemId = row.getAttribute('data-item-id');
    const depth = parseInt(row.getAttribute('data-depth')) || 0;
    const item = window._menuItems.find(i => String(i.id) === String(itemId) || String(i.temp_id) === String(itemId));
    if (!item) return;

    // Find parent: nearest previous item with depth = depth - 1
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) stack.pop();
    const parentId = stack.length > 0 ? stack[stack.length - 1].id : null;
    item.parent_id = parentId && !String(parentId).startsWith('temp_') ? parseInt(parentId) : parentId;
    item.menu_order = idx;
    stack.push({ id: itemId, depth });
  });
}

function renderMenuItemsList() {
  const flat = _flattenMenuTree();

  return flat.map(({ item, itemId, depth }) => {
    const indent = depth * 30;
    const typeLabel = item.type === 'page' ? 'Page' : item.type === 'category' ? 'Catégorie' : 'Lien';

    return `
      <div class="menu-item-row" data-item-id="${itemId}" data-depth="${depth}" style="margin-left:${indent}px">
        <div class="menu-item-header">
          <span class="menu-item-drag" title="Glisser pour réordonner / indenter">☰</span>
          <span class="menu-item-title">${escapeHtml(item.title || '(sans titre)')}</span>
          <span class="menu-item-type">${typeLabel}</span>
          <button class="btn btn-xs" onclick="toggleMenuItemEdit('${itemId}')">▼</button>
          <button class="btn btn-xs btn-danger-outline" onclick="removeMenuItem('${itemId}')">✕</button>
        </div>
        <div class="menu-item-edit" id="menuItemEdit_${itemId}" style="display:none">
          <div class="form-group">
            <label class="form-label">Titre de navigation</label>
            <input type="text" class="form-input" value="${escapeHtml(item.title || '')}" onchange="updateMenuItemField('${itemId}', 'title', this.value)">
          </div>
          ${item.type === 'custom' ? `
            <div class="form-group">
              <label class="form-label">URL</label>
              <input type="text" class="form-input" value="${escapeHtml(item.url || '')}" onchange="updateMenuItemField('${itemId}', 'url', this.value)">
            </div>
          ` : ''}
          <div class="form-group">
            <label class="menu-page-checkbox">
              <input type="checkbox" ${item.open_in_new_tab ? 'checked' : ''} onchange="updateMenuItemField('${itemId}', 'open_in_new_tab', this.checked)">
              Ouvrir dans un nouvel onglet
            </label>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleMenuItemEdit(itemId) {
  const el = document.getElementById('menuItemEdit_' + itemId);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function updateMenuItemField(itemId, field, value) {
  const item = window._menuItems.find(i => String(i.id) === String(itemId) || String(i.temp_id) === String(itemId));
  if (!item) return;
  if (field === 'open_in_new_tab') {
    item.open_in_new_tab = !!value;
  } else {
    item[field] = value;
  }
  refreshMenuItemsList();
}

function removeMenuItem(itemId) {
  // Also remove children
  const idsToRemove = new Set();
  function collectChildren(id) {
    idsToRemove.add(String(id));
    window._menuItems.filter(i => String(i.parent_id) === String(id)).forEach(c => {
      collectChildren(c.id || c.temp_id);
    });
  }
  collectChildren(itemId);
  window._menuItems = window._menuItems.filter(i => !idsToRemove.has(String(i.id || i.temp_id)));
  refreshMenuItemsList();
}

function addSelectedPages() {
  const checks = document.querySelectorAll('#menuPagesList input[type="checkbox"]:checked');
  if (checks.length === 0) { showToast('Sélectionnez au moins une page', 'error'); return; }

  const maxOrder = window._menuItems.length > 0 ? Math.max(...window._menuItems.map(i => i.menu_order || 0)) : -1;

  checks.forEach((cb, i) => {
    const pageId = parseInt(cb.value);
    const title = cb.getAttribute('data-title');
    const slug = cb.getAttribute('data-slug');
    const tempId = 'temp_' + (window._menuTempIdCounter++);
    window._menuItems.push({
      id: null,
      temp_id: tempId,
      title: title,
      url: `/${slug}`,
      type: 'page',
      page_id: pageId,
      parent_id: null,
      menu_order: maxOrder + 1 + i,
      open_in_new_tab: false,
      _page_title: title,
      _page_slug: slug,
    });
    cb.checked = false;
  });
  refreshMenuItemsList();
}

function addCustomLink() {
  const url = document.getElementById('customLinkUrl').value.trim();
  const title = document.getElementById('customLinkTitle').value.trim();
  if (!url || !title) { showToast('URL et titre requis', 'error'); return; }

  const maxOrder = window._menuItems.length > 0 ? Math.max(...window._menuItems.map(i => i.menu_order || 0)) : -1;
  const tempId = 'temp_' + (window._menuTempIdCounter++);
  window._menuItems.push({
    id: null,
    temp_id: tempId,
    title: title,
    url: url,
    type: 'custom',
    page_id: null,
    parent_id: null,
    menu_order: maxOrder + 1,
    open_in_new_tab: false,
  });

  document.getElementById('customLinkUrl').value = '';
  document.getElementById('customLinkTitle').value = '';
  refreshMenuItemsList();
}

function filterMenuPagesList(input) {
  const query = input.value.toLowerCase().trim();
  const labels = document.querySelectorAll('#menuPagesList .menu-page-checkbox');
  labels.forEach(label => {
    const text = label.getAttribute('data-search') || '';
    label.style.display = !query || text.includes(query) ? '' : 'none';
  });
}

function filterMenuCptList(input, cptSlug) {
  const query = input.value.toLowerCase().trim();
  const labels = document.querySelectorAll(`#menuCptList_${cptSlug} .menu-page-checkbox`);
  labels.forEach(label => {
    const text = label.getAttribute('data-search') || '';
    label.style.display = !query || text.includes(query) ? '' : 'none';
  });
}

function addCptArchiveLink(archivePath, label) {
  const maxOrder = window._menuItems.length > 0 ? Math.max(...window._menuItems.map(i => i.menu_order || 0)) : -1;
  const tempId = 'temp_' + (window._menuTempIdCounter++);
  window._menuItems.push({
    id: null,
    temp_id: tempId,
    title: label,
    url: archivePath,
    type: 'custom',
    page_id: null,
    parent_id: null,
    menu_order: maxOrder + 1,
    open_in_new_tab: false,
  });
  refreshMenuItemsList();
}

function addSelectedCptItems(cptSlug) {
  const container = document.getElementById('menuCptList_' + cptSlug);
  if (!container) return;
  const checks = container.querySelectorAll('input[type="checkbox"]:checked');
  if (checks.length === 0) { showToast('Sélectionnez au moins un élément', 'error'); return; }

  const maxOrder = window._menuItems.length > 0 ? Math.max(...window._menuItems.map(i => i.menu_order || 0)) : -1;

  checks.forEach((cb, i) => {
    const title = cb.getAttribute('data-title');
    const slug = cb.getAttribute('data-slug');
    const tempId = 'temp_' + (window._menuTempIdCounter++);
    window._menuItems.push({
      id: null,
      temp_id: tempId,
      title: title,
      url: `/${cptSlug}/${slug}`,
      type: 'custom',
      page_id: null,
      parent_id: null,
      menu_order: maxOrder + 1 + i,
      open_in_new_tab: false,
    });
    cb.checked = false;
  });
  refreshMenuItemsList();
}

function refreshMenuItemsList() {
  const container = document.getElementById('menuItemsList');
  if (container) container.innerHTML = renderMenuItemsList();
  // Update empty message
  const panel = document.querySelector('.menu-items-panel .text-muted');
  if (panel && window._menuItems.length > 0) panel.remove();
}

async function saveCurrentMenu() {
  if (!window._menuEditId) return;

  const name = document.getElementById('menuEditorName').value.trim();
  const location = document.getElementById('menuEditorLocation').value;
  if (!name) { showToast('Le nom du menu est obligatoire', 'error'); return; }

  // Sync parent_ids and menu_order from DOM
  _syncParentsFromDOM();

  // Build flat items array for API
  const itemsPayload = window._menuItems.map(item => ({
    old_id: item.id || undefined,
    temp_id: item.temp_id || undefined,
    title: item.title,
    url: item.url || null,
    type: item.type,
    page_id: item.page_id || null,
    parent_id: item.parent_id || null,
    menu_order: item.menu_order,
    open_in_new_tab: item.open_in_new_tab,
  }));

  showLoading();
  try {
    await Promise.all([
      apiFetch(`/menus/${window._menuEditId}`, { method: 'PUT', body: JSON.stringify({ name, location }) }),
      apiFetch(`/menus/${window._menuEditId}/items`, { method: 'PUT', body: JSON.stringify({ items: itemsPayload }) }),
    ]);
    showToast('Menu enregistré', 'success');
    // Reload to get fresh IDs
    await openMenuEditor(window._menuEditId);
  } catch (error) {
    showToast('Erreur : ' + error.message, 'error');
  }
  hideLoading();
}

async function backToMenusList() {
  window._menuEditId = null;
  window._menuItems = [];
  document.getElementById('content').innerHTML = await renderMenus();
  attachMenuEvents();
}

function attachMenuEvents() {
  // Nothing special needed for the list view — events are inline onclick
}

function attachMenuEditorEvents() {
  const list = document.getElementById('menuItemsList');
  if (!list) return;

  const INDENT_PX = 30; // pixels per depth level
  const INDENT_THRESHOLD = 20; // min horizontal px to trigger indent change
  let dragItem = null;
  let startX = 0;
  let startDepth = 0;
  let currentDepth = 0;
  let placeholder = null;

  list.addEventListener('mousedown', function(e) {
    const handle = e.target.closest('.menu-item-drag');
    if (!handle) return;
    e.preventDefault();

    dragItem = handle.closest('.menu-item-row');
    if (!dragItem) return;

    startX = e.clientX;
    startDepth = parseInt(dragItem.getAttribute('data-depth')) || 0;
    currentDepth = startDepth;

    // Create placeholder
    placeholder = document.createElement('div');
    placeholder.className = 'menu-item-placeholder';
    placeholder.style.marginLeft = (currentDepth * INDENT_PX) + 'px';
    dragItem.parentNode.insertBefore(placeholder, dragItem);

    // Float the dragged item
    dragItem.classList.add('dragging');
    dragItem.style.position = 'fixed';
    dragItem.style.width = (list.offsetWidth - currentDepth * INDENT_PX) + 'px';
    dragItem.style.zIndex = '9999';
    dragItem.style.left = list.getBoundingClientRect().left + 'px';
    dragItem.style.top = (e.clientY - 20) + 'px';
    dragItem.style.marginLeft = '0';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      // Move dragged item visually
      dragItem.style.top = (ev.clientY - 20) + 'px';

      // Compute new depth from horizontal delta
      const deltaX = ev.clientX - startX;
      let newDepth = startDepth + Math.round(deltaX / INDENT_PX);
      if (newDepth < 0) newDepth = 0;

      // Max depth = previous sibling's depth + 1
      const rows = [...list.querySelectorAll('.menu-item-row:not(.dragging)')];
      const placeholderIdx = [...list.children].indexOf(placeholder);

      // Find the row just before the placeholder
      let prevRow = null;
      for (let i = placeholderIdx - 1; i >= 0; i--) {
        const el = list.children[i];
        if (el.classList.contains('menu-item-row') && !el.classList.contains('dragging')) {
          prevRow = el;
          break;
        }
      }

      const maxDepth = prevRow ? (parseInt(prevRow.getAttribute('data-depth')) || 0) + 1 : 0;
      if (newDepth > maxDepth) newDepth = maxDepth;

      // First item must be depth 0
      if (placeholderIdx === 0 || (!prevRow && placeholderIdx <= 1)) newDepth = 0;

      currentDepth = newDepth;
      placeholder.style.marginLeft = (currentDepth * INDENT_PX) + 'px';

      // Vertical reordering: move placeholder
      const y = ev.clientY;
      let insertAfter = null;
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (y > rect.top + rect.height / 2) insertAfter = row;
      }

      if (insertAfter) {
        if (insertAfter.nextSibling !== placeholder) {
          insertAfter.insertAdjacentElement('afterend', placeholder);
        }
      } else if (rows.length > 0) {
        const firstRow = rows[0];
        if (list.firstChild !== placeholder || (list.firstChild === placeholder && list.children[1] !== firstRow)) {
          list.insertBefore(placeholder, firstRow);
        }
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';

      // Reset drag styles
      dragItem.classList.remove('dragging');
      dragItem.style.position = '';
      dragItem.style.width = '';
      dragItem.style.zIndex = '';
      dragItem.style.left = '';
      dragItem.style.top = '';

      // Place item where placeholder is
      dragItem.setAttribute('data-depth', currentDepth);
      dragItem.style.marginLeft = (currentDepth * INDENT_PX) + 'px';
      placeholder.replaceWith(dragItem);
      placeholder = null;
      dragItem = null;

      // Sync parent_ids and menu_order from DOM
      _syncParentsFromDOM();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// Expose all on window
Object.assign(window, {
  renderMenus,
  renderMenusList,
  openCreateMenuModal,
  closeMenuModal,
  createMenu,
  deleteMenu,
  openMenuEditor,
  renderMenuEditor,
  _flattenMenuTree,
  _syncParentsFromDOM,
  renderMenuItemsList,
  toggleMenuItemEdit,
  updateMenuItemField,
  removeMenuItem,
  addSelectedPages,
  addCustomLink,
  filterMenuPagesList,
  filterMenuCptList,
  addCptArchiveLink,
  addSelectedCptItems,
  refreshMenuItemsList,
  saveCurrentMenu,
  backToMenusList,
  attachMenuEvents,
  attachMenuEditorEvents,
});
