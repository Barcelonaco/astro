// ── Builder Meta: Menu toggles, Color overrides ──

function derivePrimaryParentPageId() {
  const menus = pageBuilderState.pageMenus || [];
  const primary = menus.find(m => m.location === 'primary');
  if (!primary) return null;

  // Read current parent from the DOM select
  const parentSelect = document.querySelector(`.menu-parent-select[data-menu-id="${primary.id}"]`);
  if (!parentSelect || !parentSelect.value) return null;

  const parentItemId = parseInt(parentSelect.value, 10);
  // Find that menu item and get its page_id
  const parentItem = (primary.items || []).find(i => i.id === parentItemId);
  return parentItem?.page_id || null;
}

function renderPageMenuToggles() {
  const menus = pageBuilderState.pageMenus || [];
  if (menus.length === 0) return '';

  const currentPageId = pageBuilderState.editingPageId;

  return menus.map(menu => {
    const loc = MENU_LOCATIONS.find(l => l.value === menu.location);
    const locLabel = loc && loc.value ? loc.label : '';

    // Build position options from items in this menu (excluding current page)
    const siblings = (menu.items || []).filter(i => i.page_id !== currentPageId);

    function buildPositionOpts(parentId) {
      const filtered = siblings
        .filter(i => (i.parent_id || null) == parentId)
        .sort((a, b) => (a.menu_order || 0) - (b.menu_order || 0));
      if (filtered.length === 0) return [{ value: 0, label: 'Première position' }];
      return [
        { value: 0, label: `Avant "${escapeHtml(filtered[0].title)}"` },
        ...filtered.map(item => ({ value: (item.menu_order || 0) + 1, label: `Après "${escapeHtml(item.title)}"` }))
      ];
    }

    const parentItems = siblings.filter(i => !i.parent_id);
    const posOpts = buildPositionOpts(menu.parent_id);
    let selPos = 0;
    for (const p of posOpts) { if (p.value <= (menu.menu_order || 0)) selPos = p.value; }

    return `
      <div class="menu-toggle-block" data-menu-id="${menu.id}">
        <div class="menu-toggle-header">
          <label class="toggle-field toggle-compact">
            <span class="toggle-switch">
              <input type="checkbox" class="menu-toggle-cb" data-menu-id="${menu.id}" ${menu.enabled ? 'checked' : ''} onchange="onPageMenuToggle(${menu.id})">
              <span class="toggle-slider" aria-hidden="true"></span>
            </span>
            <span class="menu-toggle-name">${escapeHtml(menu.name)}</span>
          </label>
        </div>
        <div class="menu-toggle-options" data-menu-id="${menu.id}" style="${menu.enabled ? '' : 'display:none'}">
          <div class="form-group">
            <label class="form-label-sm">Parent</label>
            <select class="form-input form-input-sm menu-parent-select" data-menu-id="${menu.id}" onchange="onPageMenuParentChange(${menu.id})">
              <option value="">— Racine —</option>
              ${parentItems.map(item => `<option value="${item.id}" ${menu.parent_id == item.id ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label-sm">Position</label>
            <select class="form-input form-input-sm menu-order-select" data-menu-id="${menu.id}">
              ${posOpts.map(o => `<option value="${o.value}" ${selPos === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function onPageMenuToggle(menuId) {
  const cb = document.querySelector(`.menu-toggle-cb[data-menu-id="${menuId}"]`);
  const opts = document.querySelector(`.menu-toggle-options[data-menu-id="${menuId}"]`);
  if (opts) opts.style.display = cb?.checked ? '' : 'none';
}

function onPageMenuParentChange(menuId) {
  const parentSelect = document.querySelector(`.menu-parent-select[data-menu-id="${menuId}"]`);
  const orderSelect = document.querySelector(`.menu-order-select[data-menu-id="${menuId}"]`);
  if (!parentSelect || !orderSelect) return;

  const parentId = parentSelect.value || null;
  const menu = (pageBuilderState.pageMenus || []).find(m => m.id === menuId);
  if (!menu) return;

  const currentPageId = pageBuilderState.editingPageId;
  const siblings = (menu.items || [])
    .filter(i => i.page_id !== currentPageId && (i.parent_id || null) == parentId)
    .sort((a, b) => (a.menu_order || 0) - (b.menu_order || 0));

  let opts = '';
  if (siblings.length === 0) {
    opts = '<option value="0">Première position</option>';
  } else {
    opts = `<option value="0">Avant "${escapeHtml(siblings[0].title)}"</option>`;
    siblings.forEach(item => {
      opts += `<option value="${(item.menu_order || 0) + 1}">Après "${escapeHtml(item.title)}"</option>`;
    });
  }
  orderSelect.innerHTML = opts;
}

function getPageMenuAssignments() {
  const assignments = [];
  document.querySelectorAll('.menu-toggle-cb:checked').forEach(cb => {
    const menuId = parseInt(cb.getAttribute('data-menu-id'));
    const parentSelect = document.querySelector(`.menu-parent-select[data-menu-id="${menuId}"]`);
    const orderSelect = document.querySelector(`.menu-order-select[data-menu-id="${menuId}"]`);
    assignments.push({
      menuId,
      parent_id: parentSelect?.value ? parseInt(parentSelect.value) : null,
      menu_order: orderSelect?.value ? parseInt(orderSelect.value) : 0,
    });
  });
  return assignments;
}

function toggleMenuSettingsPanel(show) {
  const panel = document.getElementById('builderMenuSettingsPanel');
  const modules = document.getElementById('builderModulesPanel');
  if (!panel) return;
  if (show) {
    panel.style.display = '';
    if (modules) modules.style.display = 'none';
    // Also hide settings panel if open
    const settings = document.getElementById('builderSettings');
    if (settings) settings.style.display = 'none';
  } else {
    panel.style.display = 'none';
    if (modules && !selectedBlockId) modules.style.display = '';
    const settings = document.getElementById('builderSettings');
    if (settings && selectedBlockId) settings.style.display = '';
  }
}

function toggleColorOverridesPanel(show) {
  const panel = document.getElementById('builderColorOverridesPanel');
  const modules = document.getElementById('builderModulesPanel');
  if (!panel) return;
  if (show) {
    panel.style.display = '';
    if (modules) modules.style.display = 'none';
    const settings = document.getElementById('builderSettings');
    if (settings) settings.style.display = 'none';
    // Also hide menu settings panel and SEO panel
    const menuPanel = document.getElementById('builderMenuSettingsPanel');
    if (menuPanel) menuPanel.style.display = 'none';
    const seoPanel = document.getElementById('builderSeoPanel');
    if (seoPanel) seoPanel.style.display = 'none';
  } else {
    panel.style.display = 'none';
    if (modules && !selectedBlockId) modules.style.display = '';
    const settings = document.getElementById('builderSettings');
    if (settings && selectedBlockId) settings.style.display = '';
  }
}

function buildColorOverrideStyle() {
  const co = pageBuilderState.colorOverrides;
  if (!co || !co.enabled) return '';
  const vars = [];
  if (co.primary_color) { vars.push(`--color-primary:${co.primary_color}`); vars.push(`--color-primary-bis:${co.primary_color}`); }
  if (co.secondary_color) { vars.push(`--color-secondary:${co.secondary_color}`); vars.push(`--color-secondary-bis:${co.secondary_color}`); }
  if (co.tertiary_color) vars.push(`--color-tertiary:${co.tertiary_color}`);
  if (co.text_color) vars.push(`--color-default:${co.text_color}`);
  if (co.background_color) vars.push(`--color-background:${co.background_color}`);
  if (co.bg_form_field) vars.push(`--color-form:${co.bg_form_field}`);
  return vars.join(';');
}

function applyColorOverridesToCanvas() {
  const inner = document.getElementById('builderCanvasInner');
  if (inner) inner.style.cssText = buildColorOverrideStyle();
  // Re-apply inline background colors on all block previews to pick up override values
  pageBuilderState.blocks.forEach(block => {
    const card = document.querySelector(`.builder-block-card[data-block-id="${block.id}"]`);
    if (!card) return;
    const richEl = card.querySelector('.builder-block-render');
    if (richEl) syncModuleBlocColorClasses(richEl, block.data);
  });
}

function getResolvedColorMap() {
  const site = siteSettingsCache || {};
  const co = pageBuilderState.colorOverrides;
  const useOverride = co && co.enabled;
  return {
    'has-background-primary': (useOverride && co.primary_color) || site.primary_color || 'var(--color-primary, #006a9b)',
    'has-background-secondary': (useOverride && co.secondary_color) || site.secondary_color || 'var(--color-secondary, #ea644e)',
    'has-background-tertiary': (useOverride && co.tertiary_color) || site.tertiary_color || 'var(--color-tertiary, #d6d6d6)',
  };
}

function onColorOverrideToggle(enabled) {
  pageBuilderState.colorOverrides.enabled = enabled;
  const fields = document.getElementById('colorOverrideFields');
  if (fields) fields.style.display = enabled ? '' : 'none';
  applyColorOverridesToCanvas();
}

function onColorOverrideChange() {
  const keys = ['primary_color', 'secondary_color', 'tertiary_color', 'text_color', 'background_color', 'bg_form_field'];
  keys.forEach(key => {
    const input = document.getElementById('co_' + key);
    if (input) pageBuilderState.colorOverrides[key] = input.value;
  });
  applyColorOverridesToCanvas();
}

function syncColorFromText(textInput, colorInputId) {
  const colorInput = document.getElementById(colorInputId);
  if (!colorInput) return;
  const val = textInput.value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    colorInput.value = val;
  }
  // Update state
  const key = colorInputId.replace('co_', '');
  pageBuilderState.colorOverrides[key] = val;
  applyColorOverridesToCanvas();
}

// Expose all on window
Object.assign(window, {
  derivePrimaryParentPageId,
  renderPageMenuToggles,
  onPageMenuToggle,
  onPageMenuParentChange,
  getPageMenuAssignments,
  toggleMenuSettingsPanel,
  toggleColorOverridesPanel,
  buildColorOverrideStyle,
  applyColorOverridesToCanvas,
  getResolvedColorMap,
  onColorOverrideToggle,
  onColorOverrideChange,
  syncColorFromText,
});
