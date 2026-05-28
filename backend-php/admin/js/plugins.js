// ── Plugins module ───────────────────────────────────────────────
// Extracted from app.js – plugin loading, sidebar injection, manager UI.

function buildCorePseudoManifests(registry) {
  const cpts = registry?.cpts || [];
  const modules = registry?.modules || [];
  // Group modules by CPT slug via category.id (matches CPT slug).
  const modulesBySlug = {};
  for (const m of modules) {
    const slug = m.category?.id;
    if (!slug) continue;
    (modulesBySlug[slug] = modulesBySlug[slug] || []).push(m);
  }
  return cpts.map(pt => {
    const slug = pt.slug;
    const items = modulesBySlug[slug] || [];
    const category = items[0]?.category || { id: slug, label: pt.labelPlural || pt.label };
    return {
      name: slug,
      label: pt.labelPlural || pt.label,
      _dir: slug,
      _core: true,
      _active: true,
      postTypes: [pt],
      modules: items.length ? { category, items: items.map(({ name, label }) => ({ name, label })) } : null,
    };
  });
}

async function loadPlugins() {
  let pluginManifests = [];
  let coreManifests = [];
  try {
    const [plugins, core] = await Promise.all([
      apiFetch('/plugins').catch(() => ({ plugins: [] })),
      apiFetch('/core/registry').catch(() => ({ cpts: [], modules: [] })),
    ]);
    pluginManifests = plugins.plugins || [];
    coreManifests = buildCorePseudoManifests(core);
  } catch {
    window.loadedPlugins = [];
    return;
  }
  window.loadedPlugins = [...coreManifests, ...pluginManifests];

  // Remove previously injected plugin sidebar entries before re-rendering
  document.querySelectorAll('.nav-item[data-section^="cpt:"], .nav-sub-items[data-parent^="cpt:"], .nav-item[data-section^="plugin-options:"], .nav-item[data-section^="plugin-page:"], .nav-item[data-section^="plugin-group:"], .nav-sub-items[data-parent^="plugin-group:"]').forEach(el => el.remove());

  // Strip prior plugin-injected entries from MODULE_CATEGORIES and BLOCK_TYPES
  // so deactivated plugins disappear from the page builder's "add module" list.
  for (let i = MODULE_CATEGORIES.length - 1; i >= 0; i--) {
    if (typeof MODULE_CATEGORIES[i]?.id === 'string' && MODULE_CATEGORIES[i].id.startsWith('plugin-')) {
      MODULE_CATEGORIES.splice(i, 1);
    }
  }
  for (const key of Object.keys(BLOCK_TYPES)) {
    if (BLOCK_TYPES[key]?.plugin) delete BLOCK_TYPES[key];
  }

  // Track types belonging to disabled plugins so we can hide their previews
  window.INACTIVE_PLUGIN_TYPES = new Set();
  for (const p of loadedPlugins.filter(p => p._active === false)) {
    for (const mod of p.modules?.items || []) {
      INACTIVE_PLUGIN_TYPES.add(toKebabCase(mod.name));
      INACTIVE_PLUGIN_TYPES.add(mod.name);
    }
  }

  const activePlugins = loadedPlugins.filter(p => p._active !== false);

  for (const plugin of activePlugins) {
    // Register plugin modules in MODULE_CATEGORIES and BLOCK_TYPES
    if (plugin.modules && plugin.modules.category && plugin.modules.items) {
      const cat = {
        id: `plugin-${plugin.name}`,
        label: plugin.modules.category.label || plugin.label,
        icon: plugin.modules.category.icon || '🔌',
        modules: plugin.modules.items.map(m => m.name)
      };
      MODULE_CATEGORIES.push(cat);

      for (const mod of plugin.modules.items) {
        MODULE_LABELS[mod.name] = mod.label || humanizeModuleName(mod.name);
        const type = toKebabCase(mod.name);
        const def = { label: mod.label || humanizeModuleName(mod.name), icon: cat.icon, defaultData: {}, moduleName: mod.name, categoryId: cat.id, plugin: plugin.name };
        window.BLOCK_TYPES[type] = def;
        window.BLOCK_TYPES[mod.name] = { ...def, aliasFor: type };
      }
    }

    // ── Grouped plugin (≥ 2 nav-worthy items) : single parent folder ─────
    // Triggers when the plugin has multiple postTypes/admin_pages — keeps the
    // sidebar tidy. Single-CPT plugins (references, actualites, evenements)
    // keep their legacy structure below.
    const navWorthyCount = (plugin.postTypes?.length || 0) + (plugin.admin_pages?.length || 0);
    const isGrouped = navWorthyCount > 1;

    if (isGrouped) {
      const nav = document.querySelector('.sidebar .nav');
      const settingsLink = nav ? nav.querySelector('[data-section="site-settings"]') : null;
      const groupKey = `plugin-group:${plugin.name}`;
      if (nav && !nav.querySelector(`[data-section="${groupKey}"]`)) {
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'nav-item nav-item-parent';
        a.dataset.section = groupKey;
        const iconClass = plugin.faIcon || 'fa-solid fa-cube';
        a.innerHTML = `<i class="${iconClass}"></i><span>${escapeHtml(plugin.label || plugin.name)}</span>`;

        // Insert after Pages link (or before settings)
        const pagesLink = nav.querySelector('[data-section="pages"]');
        const pagesSubItems = pagesLink ? pagesLink.nextElementSibling : null;
        const insertRef = pagesSubItems && pagesSubItems.classList.contains('nav-sub-items') ? pagesSubItems.nextSibling : (pagesLink ? pagesLink.nextSibling : settingsLink);
        if (insertRef) nav.insertBefore(a, insertRef);
        else nav.appendChild(a);

        // Sub-items container
        const sub = document.createElement('div');
        sub.className = 'nav-sub-items';
        sub.dataset.parent = groupKey;
        sub.style.display = 'none';

        // CPT links (flat — click goes to list page, where Add/Options are accessible)
        for (const pt of plugin.postTypes || []) {
          const sa = document.createElement('a');
          sa.href = '#'; sa.className = 'nav-item nav-sub-item';
          sa.dataset.section = `cpt:${pt.slug}`;
          sa.textContent = pt.labelPlural || pt.label;
          sub.appendChild(sa);
        }

        // Admin pages (custom HTML rendered in iframe)
        for (const page of plugin.admin_pages || []) {
          const minRole = page.min_role || 'admin_site';
          const pa = document.createElement('a');
          pa.href = '#'; pa.className = `nav-item nav-sub-item role-${minRole}`;
          pa.dataset.section = `plugin-page:${plugin.name}:${page.slug}`;
          pa.textContent = page.label || page.slug;
          if (!hasMinRole(minRole)) pa.style.display = 'none';
          sub.appendChild(pa);
        }

        // Plugin-level options (vat_rate, default_pro_discount, …)
        if (plugin.options && plugin.options.length > 0) {
          const oa = document.createElement('a');
          oa.href = '#'; oa.className = 'nav-item nav-sub-item';
          oa.dataset.section = `plugin-options:${plugin.name}`;
          oa.textContent = 'Options';
          sub.appendChild(oa);
        }

        if (a.nextSibling) nav.insertBefore(sub, a.nextSibling);
        else nav.appendChild(sub);

        // Toggle sub-items on parent click
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          const isVisible = sub.style.display !== 'none';
          document.querySelectorAll('.nav-sub-items').forEach(s => s.style.display = 'none');
          sub.style.display = isVisible ? 'none' : 'block';
        });

        // Sub-item click handlers
        sub.querySelectorAll('.nav-sub-item').forEach(subItem => {
          subItem.addEventListener('click', (ev) => {
            ev.preventDefault();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            subItem.classList.add('active');
            a.classList.add('active');
            loadSection(subItem.dataset.section);
          });
        });
      }
      // Skip the legacy per-CPT and per-admin_page loops below for this plugin
      continue;
    }

    // Inject sidebar items for custom post types with sub-navigation
    if (plugin.postTypes && plugin.postTypes.length > 0) {
      const nav = document.querySelector('.sidebar .nav');
      const settingsLink = nav ? nav.querySelector('[data-section="site-settings"]') : null;
      for (const pt of plugin.postTypes) {
        if (!nav || nav.querySelector(`[data-section="cpt:${pt.slug}"]`)) continue;
        // Main CPT link
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'nav-item nav-item-parent';
        a.dataset.section = `cpt:${pt.slug}`;
        const cptIconMap = {
          references: 'fa-solid fa-star',
          actualites: 'fa-solid fa-globe',
          evenements: 'fa-solid fa-chart-bar',
        };
        const cptIconClass = cptIconMap[pt.slug] || pt.faIcon || 'fa-regular fa-folder-open';
        a.innerHTML = `<i class="${cptIconClass}"></i><span>${escapeHtml(pt.labelPlural || pt.label)}</span>`;
        // Insert after Pages link
        const pagesLink = nav.querySelector('[data-section="pages"]');
        const pagesSubItems = pagesLink ? pagesLink.nextElementSibling : null;
        const insertRef = pagesSubItems && pagesSubItems.classList.contains('nav-sub-items') ? pagesSubItems.nextSibling : (pagesLink ? pagesLink.nextSibling : settingsLink);
        if (insertRef) nav.insertBefore(a, insertRef);
        else nav.appendChild(a);

        // Sub-items container
        const sub = document.createElement('div');
        sub.className = 'nav-sub-items';
        sub.dataset.parent = `cpt:${pt.slug}`;
        sub.style.display = 'none';

        // Sub: All items
        const subAll = document.createElement('a');
        subAll.href = '#'; subAll.className = 'nav-item nav-sub-item';
        subAll.dataset.section = `cpt:${pt.slug}`;
        subAll.textContent = `Toutes les ${(pt.labelPlural || pt.label).toLowerCase()}`;
        sub.appendChild(subAll);

        // Sub: Add new
        const subAdd = document.createElement('a');
        subAdd.href = '#'; subAdd.className = 'nav-item nav-sub-item';
        subAdd.dataset.section = `cpt-add:${pt.slug}`;
        subAdd.textContent = 'Ajouter';
        sub.appendChild(subAdd);

        // Sub: Categories (if enabled)
        if (pt.hasCategories) {
          const subCat = document.createElement('a');
          subCat.href = '#'; subCat.className = 'nav-item nav-sub-item';
          subCat.dataset.section = `cpt-categories:${pt.slug}`;
          subCat.textContent = pt.categoryLabel || 'Catégories';
          sub.appendChild(subCat);
        }

        // Sub: Options
        const subOpt = document.createElement('a');
        subOpt.href = '#'; subOpt.className = 'nav-item nav-sub-item';
        subOpt.dataset.section = `cpt-options:${pt.slug}`;
        subOpt.textContent = 'Options';
        sub.appendChild(subOpt);

        // Insert sub-items right after the parent link
        if (a.nextSibling) nav.insertBefore(sub, a.nextSibling);
        else nav.appendChild(sub);

        // Toggle sub-items on parent click
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          const isVisible = sub.style.display !== 'none';
          // Close all other sub-navs
          document.querySelectorAll('.nav-sub-items').forEach(s => s.style.display = 'none');
          sub.style.display = isVisible ? 'none' : 'block';
          if (!isVisible) {
            // Show list by default
            loadSection(`cpt:${pt.slug}`);
          }
        });

        // Add click handlers for sub-items
        sub.querySelectorAll('.nav-sub-item').forEach(subItem => {
          subItem.addEventListener('click', (ev) => {
            ev.preventDefault();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            subItem.classList.add('active');
            a.classList.add('active');
            loadSection(subItem.dataset.section);
          });
        });
      }
    }

    // Inject sidebar items for plugin admin_pages[] (custom HTML pages
    // shipped by the plugin, rendered inside an iframe).
    if (plugin.admin_pages && plugin.admin_pages.length > 0) {
      const nav = document.querySelector('.sidebar .nav');
      const settingsLink = nav ? nav.querySelector('[data-section="site-settings"]') : null;
      for (const page of plugin.admin_pages) {
        const sectionId = `plugin-page:${plugin.name}:${page.slug}`;
        if (!nav || nav.querySelector(`[data-section="${sectionId}"]`)) continue;
        // min_role par page (défaut admin_site). Une page peut exiger super_admin
        // (ex. page de configuration de paiement avec clés secrètes Stripe).
        const minRole = page.min_role || 'admin_site';
        const a = document.createElement('a');
        a.href = '#';
        a.className = `nav-item role-${minRole}`;
        a.dataset.section = sectionId;
        if (!hasMinRole(minRole)) a.style.display = 'none';
        const iconClass = page.faIcon || 'fa-solid fa-cube';
        a.innerHTML = `<i class="${iconClass}"></i><span>${escapeHtml(page.label || page.slug)}</span>`;
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
          a.classList.add('active');
          loadSection(sectionId);
        });
        if (settingsLink) nav.insertBefore(a, settingsLink);
        else nav.appendChild(a);
      }
    }

    // Inject sidebar items for plugins with options but no postTypes
    if (plugin.options && plugin.options.length > 0 && (!plugin.postTypes || plugin.postTypes.length === 0)) {
      const nav = document.querySelector('.sidebar .nav');
      const settingsLink = nav ? nav.querySelector('[data-section="site-settings"]') : null;
      if (nav && !nav.querySelector(`[data-section="plugin-options:${plugin.name}"]`)) {
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'nav-item role-admin_site';
        a.dataset.section = `plugin-options:${plugin.name}`;
        if (!hasMinRole('admin_site')) a.style.display = 'none';
        const pluginIconMap = {
          'google-reviews': 'fa-brands fa-google',
        };
        const pluginIconClass = pluginIconMap[plugin.name] || plugin.faIcon || 'fa-solid fa-plug';
        a.innerHTML = `<i class="${pluginIconClass}"></i><span>${escapeHtml(plugin.label || plugin.name)}</span>`;
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
          a.classList.add('active');
          loadSection(`plugin-options:${plugin.name}`);
        });
        if (settingsLink) nav.insertBefore(a, settingsLink);
        else nav.appendChild(a);
      }
    }
  }
}

function findPostTypeDef(slug) {
  for (const plugin of loadedPlugins) {
    for (const pt of plugin.postTypes || []) {
      if (pt.slug === slug) return pt;
    }
  }
  return null;
}

async function renderPluginsManager() {
  let plugins = [];
  try {
    const data = await apiFetch('/plugins');
    plugins = (data.plugins || []).filter(p => !p._core);
  } catch {
    return '<h1>Plugins</h1><p>Erreur lors du chargement des plugins.</p>';
  }

  if (plugins.length === 0) {
    return '<h1>Plugins</h1><p>Aucun plugin installé.</p>';
  }

  const rows = plugins.map(p => {
    const isActive = p._active !== false;
    const dir = escapeHtml(p._dir || '');
    const name = escapeHtml(p.label || p.name || p._dir || '');
    const desc = escapeHtml(p.description || '');
    const modules = (p.modules?.items || []).length;
    const cpts = (p.postTypes || []).length;

    let details = [];
    if (modules > 0) details.push(`${modules} module${modules > 1 ? 's' : ''}`);
    if (cpts > 0) details.push(`${cpts} CPT`);
    if (p.options?.length > 0) details.push(`${p.options.length} option${p.options.length > 1 ? 's' : ''}`);

    return `
      <div class="plugin-item">
        <div class="plugin-item__info">
          <div class="plugin-item__name">${name}</div>
          ${desc ? `<div class="plugin-item__desc">${desc}</div>` : ''}
          ${details.length ? `<div class="plugin-item__meta">${details.join(' &middot; ')}</div>` : ''}
        </div>
        <div class="plugin-item__toggle">
          <label class="toggle-switch" title="${isActive ? 'Désactiver' : 'Activer'}">
            <input type="checkbox" ${isActive ? 'checked' : ''} onchange="togglePlugin('${dir}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    `;
  }).join('');

  return `
    <h1>Plugins</h1>
    <div class="card">
      <div class="plugin-list-header">
        <span class="plugin-list-header__label">Plugin</span>
        <span class="plugin-list-header__label">Actif</span>
      </div>
      ${rows}
    </div>
    <style>
      .plugin-list-header { display:flex; justify-content:space-between; padding:10px 20px; border-bottom:1px solid var(--gray-100); }
      .plugin-list-header__label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--gray-400); }
      .plugin-item { display:flex; align-items:center; gap:16px; padding:16px 20px; border-bottom:1px solid var(--gray-100); transition:background .15s; }
      .plugin-item:last-child { border-bottom:none; }
      .plugin-item:hover { background:var(--gray-50); }
      .plugin-item__info { flex:1; min-width:0; }
      .plugin-item__name { font-size:15px; font-weight:600; color:var(--gray-900); }
      .plugin-item__desc { font-size:13px; color:var(--gray-500); margin-top:2px; }
      .plugin-item__meta { font-size:12px; color:var(--gray-400); margin-top:2px; }
      .plugin-item__toggle { flex-shrink:0; }
    </style>
  `;
}

async function togglePlugin(dir, active) {
  try {
    await apiFetch(`/plugins/${dir}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ active })
    });
    showToast(active ? 'Plugin activé' : 'Plugin désactivé', 'success');
    // Reload plugins to update sidebar
    await loadPlugins();
    // Re-render plugin manager
    document.getElementById('content').innerHTML = await renderPluginsManager();
  } catch (e) {
    showToast('Erreur: ' + e.message, 'error');
    // Re-render to reset toggle state
    document.getElementById('content').innerHTML = await renderPluginsManager();
  }
}

Object.assign(window, {
  buildCorePseudoManifests,
  loadPlugins,
  findPostTypeDef,
  renderPluginsManager,
  togglePlugin,
});
