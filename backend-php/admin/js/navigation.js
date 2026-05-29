// navigation.js — App initialization, sidebar, navigation, section router
// Extracted from app.js (lines 131-497)

async function init() {
  // 1. Verify auth — only this should trigger logout on failure
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Auth failed');
    }

    window.currentUser = await response.json();
  } catch (error) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return;
  }

  // 2. Initialize app — errors here should NOT cause logout
  try {
    document.getElementById('userInfo').textContent = currentUser.name;

    // Show nav items based on role hierarchy
    const userLevel = ROLE_LEVELS[currentUser.role] ?? 0;
    const roleMinMap = { 'role-editor': 1, 'role-admin_site': 2, 'role-super_admin': 3 };
    for (const [cls, minLevel] of Object.entries(roleMinMap)) {
      if (userLevel >= minLevel) {
        document.querySelectorAll('.' + cls).forEach(el => el.style.display = '');
      }
    }

    // Appliquer le thème choisi au back-office
    await loadAdminTheme();

    // Charger les paramètres globaux du site (couleurs, etc.) pour les formulaires de modules
    await loadSiteSettings();

    // Must run before loadPlugins: plugin-injected nav-items have their own click handlers; a generic listener on top would close the accordion immediately after the parent's toggle opens it.
    setupNavigation();
    setupSidebarToggle();

    // Charger les plugins et injecter modules + CPT
    await loadPlugins();

    // Crédits IA disponibles (pour griser les boutons si à 0)
    refreshAiCreditsAvailable();

    // Admin top bar
    initAdminTopBar();

    // Restaurer la dernière vue ou le fragment d'URL
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      await loadSection(hash);
    } else {
      const lastView = localStorage.getItem('adminLastView');
      if (lastView && lastView.startsWith('builder:')) {
        const pageId = lastView.split(':')[1];
        await openPageBuilder(pageId === 'new' ? null : Number(pageId));
      } else if (lastView && lastView.startsWith('rb-builder:')) {
        const blocId = lastView.split(':')[1];
        await openReusableBlocBuilder(blocId === 'new' ? null : Number(blocId));
      } else if (lastView) {
        await loadSection(lastView);
      } else {
        loadSection('dashboard');
      }
    }
  } catch (error) {
    console.error('Init error (not auth):', error);
    // Fallback to dashboard instead of logging out
    try { loadSection('dashboard'); } catch(e) { /* ignore */ }
  }
}

function setupSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  if (!sidebar || !toggle) return;

  function applyState(collapsed) {
    sidebar.classList.toggle('collapsed', collapsed);
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    localStorage.setItem('sidebarCollapsed', collapsed);
  }

  // Restore state from localStorage
  if (localStorage.getItem('sidebarCollapsed') === 'true') {
    applyState(true);
  }

  toggle.addEventListener('click', () => {
    applyState(!sidebar.classList.contains('collapsed'));
  });
}

function initAdminTopBar() {
  const bar = document.getElementById('adminTopBar');
  if (!bar) return;

  // Frontend URL
  const frontendUrl = siteSettingsCache?.frontend_url || window.location.origin;
  const viewSiteLink = document.getElementById('topBarViewSite');
  if (viewSiteLink) viewSiteLink.href = frontendUrl;

  // User name
  const userEl = document.getElementById('topBarUser');
  if (userEl && currentUser) {
    userEl.textContent = `Bonjour, ${currentUser.name || currentUser.email}`;
  }

  // "Créer" dropdown items
  const menu = document.getElementById('topBarCreateMenu');
  if (menu) {
    const items = [
      { label: 'Page', action: "openPageBuilder(null)" },
      { label: 'Bloc réutilisable', action: "openReusableBlocBuilder(null)" },
    ];
    // Add CPTs from loaded plugins
    const activePlugins = loadedPlugins.filter(p => p._active !== false);
    for (const plugin of activePlugins) {
      if (plugin.postTypes) {
        for (const pt of plugin.postTypes) {
          items.push({ label: pt.label || pt.slug, action: `loadSection('cpt-add:${pt.slug}')` });
        }
      }
    }
    menu.innerHTML = items.map(i => `<a href="#" onclick="${i.action}; return false;">${i.label}</a>`).join('');
  }

  bar.style.display = '';
  document.body.classList.add('has-admin-top-bar');
}

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.preventDefault();
      const section = item.dataset.section;

      // Guard unsaved changes in builder
      if (_builderDirty) {
        const ok = await confirmModal('Vous avez des modifications non enregistrées. Quitter sans sauvegarder ?', 'Modifications non enregistrées');
        if (!ok) return;
        clearBuilderDirty();
      }

      // Mémoriser la dernière vue (section simple)
      localStorage.setItem('adminLastView', section);

      // Update active state
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      loadSection(section);
    });
  });
}

async function loadSection(section) {
  localStorage.setItem('adminLastView', section);
  const content = document.getElementById('content');

  // Highlight the correct nav item(s) and open the parent sub-nav
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  document.querySelectorAll('.nav-sub-items').forEach(s => s.style.display = 'none');

  let parentSection = section;
  let subSection = section;
  if (/^cpt-(add|categories|options):/.test(section)) {
    parentSection = 'cpt:' + section.split(':')[1];
  } else if (/^cpt-edit:/.test(section)) {
    const slug = section.split(':')[1];
    parentSection = `cpt:${slug}`;
    subSection = `cpt:${slug}`;
  } else if (section.startsWith('builder:')) {
    parentSection = 'pages';
    subSection = 'pages';
  } else if (section.startsWith('rb-builder:')) {
    parentSection = 'reusable-blocs';
    subSection = 'reusable-blocs';
  } else if (/^form-(edit|entries|entry-detail):/.test(section)) {
    parentSection = 'forms';
    subSection = 'forms';
  }

  // Activate sub-item + open its container + activate the container's parent link
  const subItem = document.querySelector(`.nav-sub-items .nav-sub-item[data-section="${subSection}"]`);
  if (subItem) {
    subItem.classList.add('active');
    const container = subItem.closest('.nav-sub-items');
    if (container) {
      container.style.display = 'block';
      const parentKey = container.dataset.parent;
      if (parentKey) {
        const parentLink = document.querySelector(`.nav-item[data-section="${parentKey}"]:not(.nav-sub-item)`);
        if (parentLink) parentLink.classList.add('active');
      }
    }
  }

  // Activate top-level link (covers sections without sub-nav)
  const topLink = document.querySelector(`.nav-item[data-section="${parentSection}"]:not(.nav-sub-item)`);
  if (topLink) topLink.classList.add('active');

  // Section-level role guards
  const sectionMinRoles = {
    pages: 'editor', 'reusable-blocs': 'editor', media: 'editor',
    menus: 'admin_site', forms: 'admin_site', 'site-settings': 'admin_site', theme: 'admin_site',
    users: 'super_admin', plugins: 'super_admin', 'ai-credits': 'super_admin', 'admin-settings': 'super_admin',
  };
  const aliasMap = { builder: 'pages', 'rb-builder': 'reusable-blocs', 'form-edit': 'forms', 'form-entries': 'forms', 'form-entry-detail': 'forms' };
  let sectionBase = section.split(':')[0];
  if (aliasMap[sectionBase]) sectionBase = aliasMap[sectionBase];
  else if (sectionBase.startsWith('cpt-')) sectionBase = 'pages'; // CPT = editor level
  else if (sectionBase.startsWith('plugin-options')) sectionBase = 'site-settings'; // plugin options = admin_site level
  if (sectionMinRoles[sectionBase] && !hasMinRole(sectionMinRoles[sectionBase])) {
    navigateTo('dashboard'); return;
  }

  switch(section) {
    case 'dashboard':
      content.innerHTML = await renderDashboard();
      break;
    case 'pages':
      content.innerHTML = await renderPages();
      break;
    case 'menus':
      content.innerHTML = await renderMenus();
      attachMenuEvents();
      break;
    case 'media':
      content.innerHTML = await renderMediaLibrary();
      break;
    case 'site-settings':
      content.innerHTML = await renderSiteSettings();
      attachSiteSettingsTabs();
      initFontPreview();
      break;
    case 'theme':
      content.innerHTML = await renderTheme();
      break;
    case 'reusable-blocs':
      content.innerHTML = await renderReusableBlocs();
      break;
    case 'users':
      content.innerHTML = await renderUsers();
      break;
    case 'profile':
      content.innerHTML = await renderProfile();
      break;
    case 'plugins':
      content.innerHTML = await renderPluginsManager();
      break;
    case 'forms':
      content.innerHTML = await renderFormsList();
      break;
    case 'ai-credits':
      content.innerHTML = await renderAiCredits();
      attachAiCreditsEvents();
      break;
    case 'admin-settings':
      content.innerHTML = await renderAdminSettings();
      attachAdminSettingsTabs();
      break;
    default:
      if (section.startsWith('builder:')) {
        const pageId = section.split(':')[1];
        await openPageBuilder(pageId === 'new' ? null : Number(pageId));
      } else if (section.startsWith('rb-builder:')) {
        const blocId = section.split(':')[1];
        await openReusableBlocBuilder(blocId === 'new' ? null : Number(blocId));
      } else if (section.startsWith('cpt-add:')) {
        const slug = section.split(':')[1];
        const ptDef = findPostTypeDef(slug);
        if (ptDef) {
          const editorUrl = ptDef.editor && typeof ptDef.editor.url === 'string' ? ptDef.editor.url.trim() : '';
          if (editorUrl && editorUrl.startsWith('/plugin-assets/')) {
            const sep = editorUrl.includes('?') ? '&' : '?';
            const params = `id=&v=${Date.now()}`;
            const safeUrl = (editorUrl + sep + params).replace(/"/g, '&quot;');
            content.innerHTML = `<iframe src="${safeUrl}" style="width:100%;height:calc(100vh - 80px);border:0;" title="${escapeHtml(ptDef.label || slug)}"></iframe>`;
          } else if (ptDef.supports?.includes('content')) {
            await openCPTBuilder(ptDef, null);
          } else {
            content.innerHTML = await renderCPTEditPage(ptDef, null); attachCPTFormEvents(ptDef);
          }
        }
      } else if (section.startsWith('cpt-edit:')) {
        const parts = section.split(':');
        const slug = parts[1]; const itemId = parseInt(parts[2]);
        const ptDef = findPostTypeDef(slug);
        if (ptDef) {
          // Override : si la CPT déclare `editor: { url: "/plugin-assets/..." }`,
          // on charge l'éditeur custom du plugin dans une iframe au lieu du
          // formulaire générique. Mécanisme générique (réutilisable par tout plugin).
          const editorUrl = ptDef.editor && typeof ptDef.editor.url === 'string' ? ptDef.editor.url.trim() : '';
          if (editorUrl && editorUrl.startsWith('/plugin-assets/')) {
            const sep = editorUrl.includes('?') ? '&' : '?';
            const params = `id=${itemId || ''}&v=${Date.now()}`;
            const safeUrl = (editorUrl + sep + params).replace(/"/g, '&quot;');
            content.innerHTML = `<iframe src="${safeUrl}" style="width:100%;height:calc(100vh - 80px);border:0;" title="${escapeHtml(ptDef.label || slug)}"></iframe>`;
          } else if (ptDef.supports?.includes('content')) {
            await openCPTBuilder(ptDef, itemId);
          } else {
            content.innerHTML = await renderCPTEditPage(ptDef, itemId); attachCPTFormEvents(ptDef);
          }
        }
      } else if (section.startsWith('cpt-content:')) {
        // Force le block builder Nickl en mode "Modules uniquement", en bypassant
        // un éventuel editor.url override. Utilisé par les éditeurs custom (ex:
        // product-editor) qui veulent déléguer l'édition du contenu visuel au
        // builder natif. Le bouton "← Retour" renvoie vers `cpt-edit:slug:id`,
        // ce qui déclenche l'editor.url override et ouvre l'éditeur custom.
        const parts = section.split(':');
        const slug = parts[1]; const itemId = parseInt(parts[2]);
        const ptDef = findPostTypeDef(slug);
        if (ptDef) {
          await openCPTBuilder(ptDef, itemId || null, {
            blocksOnly: true,
            backSection: `cpt-edit:${slug}:${itemId}`,
          });
        }
      } else if (section.startsWith('cpt-categories:')) {
        const slug = section.split(':')[1];
        const ptDef = findPostTypeDef(slug);
        if (ptDef) { content.innerHTML = await renderCPTCategoriesPage(ptDef); }
      } else if (section.startsWith('cpt-options:')) {
        const slug = section.split(':')[1];
        const ptDef = findPostTypeDef(slug);
        if (ptDef) { content.innerHTML = await renderCPTOptionsPage(ptDef); attachCPTOptionsEvents(); }
      } else if (section.startsWith('plugin-options:')) {
        const pluginName = section.split(':')[1];
        const pluginDef = loadedPlugins.find(p => p.name === pluginName);
        if (pluginDef && pluginDef.options) { content.innerHTML = await renderPluginOptionsPage(pluginDef); attachPluginOptionsEvents(); }
      } else if (section.startsWith('plugin-page:')) {
        const parts = section.split(':');
        const pluginName = parts[1];
        const pageSlug = parts[2];
        const pluginDef = loadedPlugins.find(p => p.name === pluginName);
        const page = pluginDef && (pluginDef.admin_pages || []).find(p => p.slug === pageSlug);
        const url = page && typeof page.url === 'string' ? page.url.trim() : '';
        if (url && url.startsWith('/plugin-assets/')) {
          // Cache-bust : the browser may have a cached HTML with stale headers
          // (e.g. older X-Frame-Options DENY) that survives header updates.
          const sep = url.includes('?') ? '&' : '?';
          const safeUrl = (url + sep + 'v=' + Date.now()).replace(/"/g, '&quot;');
          content.innerHTML = `<iframe src="${safeUrl}" style="width:100%;height:calc(100vh - 80px);border:0;" title="${escapeHtml(page.label || page.slug)}"></iframe>`;
        } else {
          content.innerHTML = `<div style="padding:32px;text-align:center;color:#666"><h2>Page admin introuvable</h2><p>Le plugin <code>${escapeHtml(pluginName)}</code> n'a pas déclaré d'URL valide pour la page <code>${escapeHtml(pageSlug)}</code>.</p><p style="font-size:12px">Attendu : <code>/plugin-assets/&lt;plugin&gt;/admin/&lt;page&gt;.html</code> dans <code>plugin.json</code> → <code>admin_pages[]</code>.</p></div>`;
        }
      } else if (section.startsWith('form-edit:')) {
        const formId = parseInt(section.split(':')[1]) || null;
        content.innerHTML = await renderFormBuilder(formId);
        attachFormBuilderEvents();
      } else if (section.startsWith('form-entries:')) {
        const formId = parseInt(section.split(':')[1]);
        content.innerHTML = await renderFormEntries(formId);
      } else if (section.startsWith('form-entry-detail:')) {
        const parts = section.split(':');
        const formId = parseInt(parts[1]);
        const entryId = parseInt(parts[2]);
        content.innerHTML = await renderFormEntryDetail(formId, entryId);
      } else if (section.startsWith('cpt:')) {
        const slug = section.split(':')[1];
        const ptDef = findPostTypeDef(slug);
        if (ptDef) { content.innerHTML = await renderCPTList(ptDef); attachCPTListEvents(); }
      }
      break;
  }
}

const navigateTo = loadSection;

Object.assign(window, {
  init,
  setupSidebarToggle,
  initAdminTopBar,
  setupNavigation,
  loadSection,
  navigateTo,
});
