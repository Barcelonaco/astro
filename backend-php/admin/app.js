const API_BASE = window.location.origin + '/api';
let token = localStorage.getItem('token');
let currentUser = null;
let aiCreditsAvailable = null; // null = unknown, number = credits in USD/EUR
let aiEnabled = true; // false when an admin has temporarily disabled AI
const ROLE_LEVELS = { reader: 0, editor: 1, admin_site: 2, super_admin: 3, admin: 3 };

async function refreshAiCreditsAvailable() {
  try {
    const data = await apiFetch('/ai-credits/available');
    aiCreditsAvailable = typeof data?.available === 'number' ? data.available : null;
    aiEnabled = data?.enabled !== false;
  } catch (e) {
    aiCreditsAvailable = null;
    aiEnabled = true;
  }
}

function aiButtonAttrs() {
  if (!aiEnabled) {
    return { disabled: true, title: 'Génération IA temporairement désactivée par un administrateur' };
  }
  if (aiCreditsAvailable !== null && aiCreditsAvailable <= 0) {
    return { disabled: true, title: 'Crédits IA épuisés — rechargez les crédits pour générer' };
  }
  return { disabled: false, title: 'Générer avec l\'IA' };
}
function hasMinRole(minRole) { return (ROLE_LEVELS[currentUser?.role] ?? 0) >= (ROLE_LEVELS[minRole] ?? 99); }

const MENU_LOCATIONS = [
  { value: '', label: '— Aucun —' },
  { value: 'primary', label: 'Menu principal' },
  { value: 'secondary', label: 'Menu secondaire (top)' },
  { value: 'footer', label: 'Menu footer' },
];

// --- Inactivity auto-logout (1h) ---
const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1h
let _inactivityTimer = null;

function resetInactivityTimer() {
  clearTimeout(_inactivityTimer);
  _inactivityTimer = setTimeout(() => {
    localStorage.removeItem('token');
    window.location.href = '/login?reason=inactivity';
  }, INACTIVITY_TIMEOUT);
}

function startInactivityTracker() {
  ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'].forEach(evt =>
    document.addEventListener(evt, resetInactivityTimer, { passive: true })
  );
  resetInactivityTimer();
}

// Check auth on load
if (!token) {
  window.location.href = '/login';
} else {
  startInactivityTracker();
  init();
}

// Thèmes admin (alignés sur les thèmes du site) – appliqués au back-office
const ADMIN_THEMES = {
  default: { primary: '#667eea', primaryDark: '#5568d3', dark: false },
  dark: { primary: '#00d4ff', primaryDark: '#0088cc', dark: true },
  minimal: { primary: '#000000', primaryDark: '#333333', dark: false },
  colorful: { primary: '#ff6b6b', primaryDark: '#ee5a5a', dark: false },
  nature: { primary: '#2ecc71', primaryDark: '#27ae60', dark: false }
};

function applyAdminTheme(useChildTheme, activeTheme) {
  const root = document.documentElement;
  if (!useChildTheme) {
    root.style.removeProperty('--primary');
    root.style.removeProperty('--primary-dark');
    root.removeAttribute('data-admin-theme');
    return;
  }
  const theme = ADMIN_THEMES[activeTheme];
  if (!theme) return;
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--primary-dark', theme.primaryDark);
  if (theme.dark) {
    root.setAttribute('data-admin-theme', 'dark');
  } else {
    root.removeAttribute('data-admin-theme');
  }
}

async function loadAdminTheme() {
  try {
    const res = await fetch(`${API_BASE}/settings/theme`);
    if (!res.ok) return;
    const data = await res.json();
    applyAdminTheme(data.useChildTheme, data.activeTheme || 'default');
  } catch (e) {}
}

async function init() {
  // 1. Verify auth — only this should trigger logout on failure
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Auth failed');
    }

    currentUser = await response.json();
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

    // Charger les plugins et injecter modules + CPT
    await loadPlugins();

    // Crédits IA disponibles (pour griser les boutons si à 0)
    refreshAiCreditsAvailable();

    // Admin top bar
    initAdminTopBar();

    // Setup navigation
    setupNavigation();
    setupSidebarToggle();

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

  // Highlight the correct nav item
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  let navSection = section;
  if (/^cpt-(add|edit|categories|options):/.test(section)) {
    navSection = 'cpt:' + section.split(':')[1];
  } else if (section.startsWith('builder:')) {
    navSection = 'pages';
  } else if (/^form-(edit|entries|entry-detail):/.test(section)) {
    navSection = 'forms';
  }
  const activeNav = document.querySelector(`.nav-item[data-section="${navSection}"]`);
  if (activeNav) activeNav.classList.add('active');

  // Section-level role guards
  const sectionMinRoles = {
    pages: 'editor', 'reusable-blocs': 'editor', media: 'editor',
    menus: 'admin_site', forms: 'admin_site', 'site-settings': 'admin_site', theme: 'admin_site',
    users: 'super_admin', plugins: 'super_admin', 'ai-credits': 'super_admin',
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
          if (ptDef.supports?.includes('content')) {
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
          if (ptDef.supports?.includes('content')) {
            await openCPTBuilder(ptDef, itemId);
          } else {
            content.innerHTML = await renderCPTEditPage(ptDef, itemId); attachCPTFormEvents(ptDef);
          }
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

// ========== DASHBOARD ==========
async function renderDashboard() {
  showLoading();
  try {
    const fetches = [apiFetch('/pages')];
    if (hasMinRole('super_admin')) {
      fetches.push(apiFetch('/ai-credits').catch(() => null));
    }
    const [pages, aiCredits] = await Promise.all(fetches);

    hideLoading();

    let aiHtml = '';
    if (aiCredits) {
      const pct = aiCredits.total_credits > 0
        ? Math.round((aiCredits.available / aiCredits.total_credits) * 100)
        : 0;
      const barColor = aiCredits.available > 1 ? 'var(--success, #22c55e)' : aiCredits.available > 0.2 ? 'var(--warning, #f59e0b)' : 'var(--danger, #ef4444)';
      aiHtml = `
        <div class="stat-card" style="cursor:pointer" onclick="navigateTo('ai-credits')" title="Gérer les crédits IA">
          <div class="label">Crédits IA disponibles</div>
          <div class="value" style="color:${barColor}">${aiCredits.available.toFixed(2)} €</div>
          <div style="margin-top:8px;background:var(--border-color,#e5e7eb);border-radius:6px;height:8px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${barColor};border-radius:6px;transition:width .3s"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:12px;color:var(--text-muted,#6b7280)">
            <span>Utilisé ce mois : ${aiCredits.total_used.toFixed(4)} €</span>
            <span>Alloué : ${aiCredits.total_credits.toFixed(2)} €</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="page-header">
        <h1>Tableau de bord</h1>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Pages</div>
          <div class="value">${pages.length}</div>
        </div>
        ${aiHtml}
      </div>
    `;
  } catch (error) {
    hideLoading();
    return `<div class="card"><p style="color: var(--danger)">Erreur: ${error.message}</p></div>`;
  }
}

const _svgEdit = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const _svgDelete = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
const _svgEye = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const _svgStar = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
const _svgStarFill = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
const _svgInbox = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>';
const _svgCopy = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const _svgDownload = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
const _svgTrash = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
const _svgX = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

// ========== PAGES & PAGE BUILDER ==========
const LEGACY_BLOCK_TYPES = {
  heading: { label: 'Titre', icon: '📌', defaultData: { level: 'h2', text: 'Nouveau titre' }, legacy: true },
  text: { label: 'Texte', icon: '📝', defaultData: { title: '', body: '' }, legacy: true },
  image: { label: 'Image', icon: '🖼️', defaultData: { src: '', alt: '', caption: '' }, legacy: true },
  cta: { label: 'Appel à l\'action', icon: '🔘', defaultData: { title: '', description: '', buttonText: '', buttonUrl: '' }, legacy: true },
  spacer: { label: 'Espaceur', icon: '↕️', defaultData: { size: 'medium' }, legacy: true },
  html: { label: 'HTML libre', icon: '💻', defaultData: { content: '' }, legacy: true }
};

const MODULE_LABELS = {
  Banner: 'Bannière',
  Hero: 'Hero banner',
  TextSimple: 'Texte simple',
  TextImage: 'Texte + image/vidéo',

  SliderTextVideo: 'Texte + vidéo (slider)',
  Accordion: 'Accordéons',
  KeyFigures: 'Chiffres clés',
  Quote: 'Citation',
  TextScrolling: 'Texte défilement',
  LinkAlone: 'Liens',
  Gallery: 'Galerie',
  Video: 'Image / Vidéo',
  ImagesSlider: 'Carrousel d\'images',
  Files: 'Aperçu (pdf)',
  ImagesVideosParallax: 'Images vidéos parallaxe',
  IconLogo: 'Icône + texte',
  SliderLogo: 'Slider de logo',
  Ornament: 'Ornement',
  IllusVideo: 'Séparateur vidéo',
  ClickableTiles: 'Tuiles cliquables',
  NewsSlider: 'Actualités à la une',
  EventsSlider: 'Événements à la une',
  BlocReferences: 'Références à la une',
  Team: 'Trombinoscope',
  Contact: 'Contact',
  Map: 'Carte',
  GoogleReviews: 'Avis Google',
  Summary: 'Sommaire',
  Form: 'Formulaire',
  ReusableBloc: 'Bloc réutilisable',
  ColumnsTab: 'Colonnes',
  Separator: 'Séparateur',
  Review: 'Avis client',
  Widget: 'Widget',
  PlanSite: 'Plan du site',
  InstaFeed: 'Feed Instagram',
  ThreadsFeed: 'Feed Threads',
  Product: 'Produits à la une'
};

const MODULE_CATEGORIES = [
  {
    id: 'banners',
    label: 'Bannières & en-têtes',
    icon: '🏔️',
    modules: ['Banner', 'Hero']
  },
  {
    id: 'content',
    label: 'Texte & contenu',
    icon: '📝',
    modules: ['TextSimple', 'TextImage', 'SliderTextVideo', 'Accordion', 'KeyFigures', 'Quote', 'TextScrolling', 'LinkAlone']
  },
  {
    id: 'media',
    label: 'Médias',
    icon: '🎞️',
    modules: ['Gallery', 'Video', 'ImagesSlider', 'Files', 'ImagesVideosParallax', 'IconLogo', 'SliderLogo', 'Ornament', 'IllusVideo', 'ClickableTiles']
  },
  {
    id: 'tools',
    label: 'Fonctionnels & outils',
    icon: '🧰',
    modules: ['Team', 'Contact', 'Map', 'Summary', 'Form', 'ReusableBloc', 'ColumnsTab', 'Separator', 'Widget', 'PlanSite']
  },
];

function humanizeModuleName(name) {
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
}

function toKebabCase(name) {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

const NICKL_MODULE_TYPES = MODULE_CATEGORIES.reduce((acc, category) => {
  category.modules.forEach((name) => {
    const type = toKebabCase(name);
    const label = MODULE_LABELS[name] || humanizeModuleName(name);
    const def = { label, icon: category.icon || '▦', defaultData: {}, moduleName: name, categoryId: category.id };
    acc[type] = def;
    acc[name] = { ...def, aliasFor: type };
  });
  return acc;
}, {});

const BLOCK_TYPES = { ...NICKL_MODULE_TYPES, ...LEGACY_BLOCK_TYPES };

// ========== PLUGIN SYSTEM ==========
let loadedPlugins = [];
let INACTIVE_PLUGIN_TYPES = new Set();

async function loadPlugins() {
  try {
    const data = await apiFetch('/plugins');
    loadedPlugins = data.plugins || [];
  } catch {
    loadedPlugins = [];
    return;
  }

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
  INACTIVE_PLUGIN_TYPES = new Set();
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
        BLOCK_TYPES[type] = def;
        BLOCK_TYPES[mod.name] = { ...def, aliasFor: type };
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
          const pa = document.createElement('a');
          pa.href = '#'; pa.className = 'nav-item nav-sub-item';
          pa.dataset.section = `plugin-page:${plugin.name}:${page.slug}`;
          pa.textContent = page.label || page.slug;
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
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'nav-item role-admin_site';
        a.dataset.section = sectionId;
        if (!hasMinRole('admin_site')) a.style.display = 'none';
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

// ========== CUSTOM POST TYPE UI ==========

let _cptListItems = [];
let _cptListPtDef = null;
let _cptListSort = { field: 'date', dir: 'desc' };
let _cptListSearch = '';

async function renderCPTList(ptDef) {
  showLoading();
  try {
    _cptListItems = await apiFetch(`/cpt/${ptDef.slug}`);
    _cptListPtDef = ptDef;
    _cptListSort = { field: 'date', dir: 'desc' };
    _cptListSearch = '';
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
      _cptListSearch = searchInput.value.toLowerCase().trim();
      renderCPTListRows();
    });
  }
  renderCPTListRows();
}

function cptListSortBy(field) {
  if (_cptListSort.field === field) {
    _cptListSort.dir = _cptListSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    _cptListSort = { field, dir: 'asc' };
  }
  renderCPTListRows();
}

function renderCPTListRows() {
  const container = document.getElementById('cptListContainer');
  if (!container || !_cptListPtDef) return;
  const ptDef = _cptListPtDef;

  // Filter
  let filtered = _cptListItems;
  if (_cptListSearch) {
    filtered = filtered.filter(item => {
      const cats = (item.categories || []).map(c => c.name.toLowerCase()).join(' ');
      return item.title.toLowerCase().includes(_cptListSearch) || cats.includes(_cptListSearch);
    });
  }

  // Sort
  const s = _cptListSort;
  filtered = [...filtered].sort((a, b) => {
    let va, vb;
    if (s.field === 'title') {
      va = (a.title || '').toLowerCase(); vb = (b.title || '').toLowerCase();
    } else if (s.field === 'category') {
      va = (a.categories || [])[0]?.name?.toLowerCase() || ''; vb = (b.categories || [])[0]?.name?.toLowerCase() || '';
    } else {
      va = a.created_at || ''; vb = b.created_at || '';
    }
    if (va < vb) return s.dir === 'asc' ? -1 : 1;
    if (va > vb) return s.dir === 'asc' ? 1 : -1;
    return 0;
  });

  function sortIcon(field) {
    if (_cptListSort.field !== field) return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="2"><path d="M7 10l5-5 5 5"/><path d="M7 14l5 5 5-5"/></svg>';
    return _cptListSort.dir === 'asc'
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 14l5-5 5 5"/></svg>'
      : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 10l5 5 5-5"/></svg>';
  }

  if (filtered.length === 0) {
    container.innerHTML = _cptListSearch
      ? '<p style="text-align:center;color:var(--gray-500);padding:40px 0;">Aucun résultat pour « ' + escapeHtml(_cptListSearch) + ' »</p>'
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
        <span class="page-item__meta cpt-sort-header" onclick="cptListSortBy('date')" style="cursor:pointer;user-select:none;">Date ${sortIcon('date')}</span>
        <span class="page-item__badges">Statut</span>
        <span class="page-item__actions" style="opacity:1">Actions</span>
      </div>
      ${rows}
    </div>
  `;
}

// ========== CPT EDIT PAGE (full page, not modal) ==========

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
  const fi = item?.featured_image || null;
  const itemCategories = item?.categories || [];
  const supports = ptDef.supports || ['title', 'slug', 'featured_image', 'content', 'status'];
  const hasCustomFields = ptDef.fields && ptDef.fields.length > 0;
  const hasExcerpt = supports.includes('excerpt');
  const hasContent = supports.includes('content');

  // Parse photos gallery (for CPTs with photos custom field)
  let photos = [];
  try { photos = JSON.parse(cf.photos || '[]'); } catch { photos = []; }
  if (!Array.isArray(photos)) photos = [];

  // Parse link (for CPTs with link custom field)
  let linkObj = { url: '', title: '', target: '_self' };
  try { if (cf.link) linkObj = typeof cf.link === 'string' ? JSON.parse(cf.link) : cf.link; } catch { /* keep defaults */ }

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

  // --- Build custom fields HTML dynamically ---
  function buildCustomFieldsHtml() {
    if (!hasCustomFields) return '';
    return ptDef.fields.map(field => {
      const val = cf[field.name] || '';
      const ftype = (field.type || 'Text').toLowerCase();
      const w = field.width ? ` style="width:${field.width}%;display:inline-block;vertical-align:top;padding-right:12px;box-sizing:border-box;"` : '';

      // --- Photos gallery ---
      if (field.name === 'photos' || ftype === 'photos') {
        return `<div class="form-group"${w}>
          <label class="form-label">${escapeHtml(field.label)}</label>
          <div id="cptPhotosPreview" style="margin-bottom:8px;">${photosPreview}</div>
          <input type="hidden" name="cf_photos" id="cptPhotosInput" value="${escapeHtml(JSON.stringify(photos))}">
          <button type="button" class="btn btn-outline btn-sm" onclick="openCPTPhotoPicker()">📸 Ajouter des photos</button>
        </div>`;
      }

      // --- Link (generic — works for any field name) ---
      if (ftype === 'link') {
        let lObj = { url: '', title: '', target: '_self' };
        try { if (val) lObj = typeof val === 'string' ? JSON.parse(val) : val; } catch { /* keep defaults */ }
        const fnEsc = escapeHtml(field.name);
        return `<div class="form-group"${w}>
          <label class="form-label">${escapeHtml(field.label)}</label>
          <div class="form-row" style="display:grid;grid-template-columns:1fr 2fr 1fr auto;gap:8px;">
            <div class="form-group" style="margin:0;">
              <select class="form-input cpt-link-page-select" data-target="cf_${fnEsc}_url">
                <option value="">— Page du site —</option>
                ${allPages.filter(p => p.status === 'published').map(p => `<option value="/${escapeHtml(p.slug)}" ${lObj.url === '/' + p.slug ? 'selected' : ''}>${escapeHtml(p.title)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="margin:0;">
              <input type="text" class="form-input" name="cf_${fnEsc}_url" value="${escapeHtml(lObj.url || '')}" placeholder="URL (ou choisir une page)">
            </div>
            <div class="form-group" style="margin:0;">
              <input type="text" class="form-input" name="cf_${fnEsc}_title" value="${escapeHtml(lObj.title || '')}" placeholder="Titre du lien">
            </div>
            <div class="form-group" style="margin:0;">
              <select class="form-input" name="cf_${fnEsc}_target">
                <option value="_self" ${lObj.target !== '_blank' ? 'selected' : ''}>Même fenêtre</option>
                <option value="_blank" ${lObj.target === '_blank' ? 'selected' : ''}>Nouvel onglet</option>
              </select>
            </div>
          </div>
        </div>`;
      }

      // --- WYSIWYG (Quill editor) ---
      if (ftype === 'wysiwyg') {
        const editorId = `cptQuillEditor_${field.name}`;
        return `<div class="form-group"${w}>
          <label class="form-label">${escapeHtml(field.label)}</label>
          <div id="${editorId}" class="cpt-quill-editor" style="min-height:200px;" data-field="${escapeHtml(field.name)}"></div>
          <input type="hidden" name="cf_${escapeHtml(field.name)}" value="${escapeHtml(val)}">
        </div>`;
      }

      // --- Textarea ---
      if (ftype === 'textarea') {
        return `<div class="form-group"${w}>
          <label class="form-label">${escapeHtml(field.label)}</label>
          <textarea class="form-textarea" name="cf_${escapeHtml(field.name)}" rows="4">${escapeHtml(val)}</textarea>
        </div>`;
      }

      // --- TrueFalse (toggle slider) ---
      if (ftype === 'truefalse') {
        const isOn = val === true || val === 1 || val === '1' || val === 'true';
        return `<div class="form-group"${w}>
          <label class="form-label">${escapeHtml(field.label)}</label>
          <div style="padding:6px 0;">
            <label class="cpt-toggle" style="display:inline-flex;align-items:center;gap:10px;cursor:pointer;user-select:none;">
              <input type="hidden" name="cf_${escapeHtml(field.name)}" value="0">
              <input type="checkbox" name="cf_${escapeHtml(field.name)}" value="1" ${isOn ? 'checked' : ''} style="display:none;">
              <span class="cpt-toggle-track" style="position:relative;width:44px;height:24px;border-radius:12px;background:${isOn ? 'var(--primary,#224f5a)' : '#ccc'};transition:background .2s;">
                <span class="cpt-toggle-thumb" style="position:absolute;top:2px;left:${isOn ? '22px' : '2px'};width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .2s;"></span>
              </span>
              <span class="cpt-toggle-label" style="font-size:14px;color:#666;">${isOn ? 'Oui' : 'Non'}</span>
            </label>
          </div>
        </div>`;
      }

      // --- Date ---
      if (ftype === 'date') {
        // Convert stored format YYYY/MM/DD to YYYY-MM-DD for input[type=date]
        const dateVal = val ? val.replace(/\//g, '-') : '';
        return `<div class="form-group"${w}>
          <label class="form-label">${escapeHtml(field.label)}</label>
          <input type="date" class="form-input" name="cf_${escapeHtml(field.name)}" value="${escapeHtml(dateVal)}">
        </div>`;
      }

      // --- Time ---
      if (ftype === 'time') {
        return `<div class="form-group"${w}>
          <label class="form-label">${escapeHtml(field.label)}</label>
          <input type="time" class="form-input" name="cf_${escapeHtml(field.name)}" value="${escapeHtml(val)}">
        </div>`;
      }

      // --- Email ---
      if (ftype === 'email') {
        return `<div class="form-group"${w}>
          <label class="form-label">${escapeHtml(field.label)}</label>
          <input type="email" class="form-input" name="cf_${escapeHtml(field.name)}" value="${escapeHtml(val)}">
        </div>`;
      }

      // --- URL ---
      if (ftype === 'url') {
        return `<div class="form-group"${w}>
          <label class="form-label">${escapeHtml(field.label)}</label>
          <input type="url" class="form-input" name="cf_${escapeHtml(field.name)}" value="${escapeHtml(val)}" placeholder="https://...">
        </div>`;
      }

      // --- Number ---
      if (ftype === 'number') {
        return `<div class="form-group"${w}>
          <label class="form-label">${escapeHtml(field.label)}</label>
          <input type="number" class="form-input" name="cf_${escapeHtml(field.name)}" value="${escapeHtml(val)}">
        </div>`;
      }

      // --- Select (static options or CPT-sourced) ---
      if (ftype === 'select') {
        const fnEsc = escapeHtml(field.name);
        const opts = field.options && typeof field.options === 'object' ? field.options : {};
        const optionsHtml = Object.entries(opts).map(([k, label]) =>
          `<option value="${escapeHtml(k)}" ${String(val) === String(k) ? 'selected' : ''}>${escapeHtml(label)}</option>`
        ).join('');
        const sourceAttr = field.source ? ` data-cf-source="${escapeHtml(field.source)}" data-cf-current="${escapeHtml(val)}"` : '';
        return `<div class="form-group"${w}>
          <label class="form-label">${escapeHtml(field.label)}</label>
          <select class="form-input" name="cf_${fnEsc}"${sourceAttr}>
            <option value="">— Sélectionner —</option>
            ${optionsHtml}
          </select>
        </div>`;
      }

      // --- Image / File / Video (media picker) ---
      if (ftype === 'image' || ftype === 'file' || ftype === 'video') {
        let img = null;
        try { if (val) img = typeof val === 'string' ? JSON.parse(val) : val; } catch { img = null; }
        const url = (img && typeof img === 'object') ? (img.url || '') : (typeof val === 'string' && val.startsWith('/') ? val : '');
        const fnEsc = escapeHtml(field.name);
        const hiddenVal = val ? (typeof val === 'string' ? val : JSON.stringify(val)) : '';
        return `<div class="form-group"${w}>
          <label class="form-label">${escapeHtml(field.label)}</label>
          <div class="cpt-cf-image-field" data-cf="${fnEsc}" data-cf-type="${ftype}">
            <div id="cptCfImagePreview_${fnEsc}" style="margin-bottom:8px;min-height:0;">
              ${url ? `<img src="${escapeHtml(getOptimizedUrl(url, 400, 70))}" style="max-width:240px;max-height:160px;object-fit:cover;border-radius:8px;display:block;">` : ''}
            </div>
            <input type="hidden" name="cf_${fnEsc}" id="cptCfImageInput_${fnEsc}" value="${escapeHtml(hiddenVal)}">
            <div style="display:flex;gap:8px;">
              <button type="button" class="btn btn-outline btn-sm" onclick="openCPTCfImagePicker('${fnEsc}', '${ftype}')">Choisir ${ftype === 'video' ? 'une vidéo' : ftype === 'file' ? 'un fichier' : 'une image'}</button>
              ${url ? `<button type="button" class="btn btn-outline btn-sm" onclick="clearCPTCfImage('${fnEsc}')">Retirer</button>` : ''}
            </div>
          </div>
        </div>`;
      }

      // --- Address (Mapbox geocoding + mini-map) ---
      if (ftype === 'address') {
        let addr = { address: '', city: '', post_code: '', street_name: '', street_number: '', lat: '', lng: '' };
        try { if (val) addr = typeof val === 'string' ? JSON.parse(val) : val; } catch { /* keep defaults */ }
        const fnEsc = escapeHtml(field.name);
        const uid = `cptAddress_${fnEsc}_${Date.now()}`;
        return `<div class="form-group"${w}>
          <label class="form-label">${escapeHtml(field.label)}</label>
          <div id="${uid}" class="cpt-address-field" data-field="${fnEsc}" style="position:relative;">
            <div style="position:relative;margin-bottom:8px;">
              <input type="text" class="form-input googlemap-search" value="${escapeHtml(addr.address || '')}" placeholder="Rechercher une adresse..." autocomplete="off">
              <div class="googlemap-suggestions" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:100;background:#fff;border:1px solid var(--border);border-top:0;border-radius:0 0 6px 6px;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,.1);"></div>
            </div>
            <div class="googlemap-preview" style="height:${(addr.lat && addr.lng) ? '200px' : '0'};border-radius:8px;overflow:hidden;margin-bottom:8px;"></div>
            <input type="hidden" name="cf_${fnEsc}__street_number" value="${escapeHtml(addr.street_number || '')}">
            <input type="hidden" name="cf_${fnEsc}__street_name" value="${escapeHtml(addr.street_name || '')}">
            <input type="hidden" name="cf_${fnEsc}__post_code" value="${escapeHtml(addr.post_code || '')}">
            <input type="hidden" name="cf_${fnEsc}__city" value="${escapeHtml(addr.city || '')}">
            <input type="hidden" name="cf_${fnEsc}__address" value="${escapeHtml(addr.address || '')}">
            <input type="hidden" name="cf_${fnEsc}__lat" value="${escapeHtml(addr.lat || '')}">
            <input type="hidden" name="cf_${fnEsc}__lng" value="${escapeHtml(addr.lng || '')}">
            <input type="hidden" name="cf_${fnEsc}__place_id" value="">
            <input type="hidden" name="cf_${fnEsc}__name" value="">
            <input type="hidden" name="cf_${fnEsc}__street_name_short" value="">
          </div>
        </div>`;
      }

      // Default: Text
      return `<div class="form-group"${w}>
        <label class="form-label">${escapeHtml(field.label)}</label>
        <input type="text" class="form-input" name="cf_${escapeHtml(field.name)}" value="${escapeHtml(val)}">
      </div>`;
    }).join('');
  }

  // --- Build tabs and content area ---
  const customFieldsHtml = buildCustomFieldsHtml();
  const needsTabs = hasCustomFields && hasContent;
  const firstTab = hasCustomFields ? 'popup' : 'contenu';

  let tabsHtml = '';
  let contentAreaHtml = '';

  if (needsTabs) {
    // Both custom fields and content: show tabs
    tabsHtml = `
      <div class="cpt-tabs" style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px;">
        <button type="button" class="cpt-tab active" data-tab="popup" style="padding:10px 20px;border:0;background:0;cursor:pointer;font-weight:600;border-bottom:2px solid var(--primary);margin-bottom:-2px;">Champs</button>
        <button type="button" class="cpt-tab" data-tab="contenu" style="padding:10px 20px;border:0;background:0;cursor:pointer;font-weight:600;color:#999;border-bottom:2px solid transparent;margin-bottom:-2px;">Contenu</button>
      </div>`;
    contentAreaHtml = `
      <div class="cpt-tab-content" data-tab="popup">${customFieldsHtml}</div>
      <div class="cpt-tab-content" data-tab="contenu" style="display:none;">
        <p style="color:#999;font-size:13px;">Le contenu flexible (modules) est géré via le champ contenu du CPT. Vous pouvez y ajouter du JSON de blocs.</p>
        <div class="form-group">
          <label class="form-label">Contenu (JSON blocs)</label>
          <textarea class="form-textarea" name="content" rows="12" style="font-family:monospace;font-size:13px;">${escapeHtml(item?.content || '')}</textarea>
        </div>
      </div>`;
  } else if (hasCustomFields) {
    // Only custom fields, no content
    contentAreaHtml = customFieldsHtml;
  } else if (hasContent) {
    // Only content (like actualités)
    contentAreaHtml = `
      ${hasExcerpt ? `
        <div class="form-group">
          <label class="form-label">Extrait</label>
          <textarea class="form-textarea" name="excerpt" rows="3" placeholder="Résumé court de l'article…">${escapeHtml(item?.excerpt || '')}</textarea>
        </div>
      ` : ''}
      <div class="form-group">
        <label class="form-label">Contenu (JSON blocs)</label>
        <textarea class="form-textarea" name="content" rows="12" style="font-family:monospace;font-size:13px;">${escapeHtml(item?.content || '')}</textarea>
      </div>`;
  }

  return `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px;">
        <button class="btn btn-outline btn-sm" onclick="loadSection('cpt:${escapeHtml(ptDef.slug)}')">← Retour</button>
        <h1>${itemId ? 'Modifier' : (ptDef.isFemale ? 'Nouvelle' : 'Nouveau')} ${escapeHtml(ptDef.label)}</h1>
      </div>
    </div>

    <form id="cptEditForm" data-post-type="${escapeHtml(ptDef.slug)}" data-item-id="${itemId || ''}">
      <div style="display:grid;grid-template-columns:1fr 340px;gap:24px;align-items:start;">
        <!-- Main column -->
        <div>
          <div class="card" style="margin-bottom:24px;">
            <div class="form-group">
              <label class="form-label">Titre *</label>
              <input type="text" class="form-input" name="title" value="${escapeHtml(item?.title || '')}" required id="cptTitleInput">
            </div>
            ${supports.includes('slug') ? `
            <div class="form-group">
              <label class="form-label">Slug</label>
              <input type="text" class="form-input" name="slug" value="${escapeHtml(item?.slug || '')}" id="cptSlugInput">
            </div>
            ` : `<input type="hidden" name="slug" value="${escapeHtml(item?.slug || '')}" id="cptSlugInput">`}
          </div>

          <div class="card" style="margin-bottom:24px;">
            ${tabsHtml}
            ${contentAreaHtml}
          </div>
        </div>

        <!-- Sidebar -->
        <div>
          <div class="card" style="margin-bottom:16px;">
            <h3 style="margin-bottom:12px;">Publication</h3>
            <div class="form-group">
              <label class="form-label">Statut</label>
              <select class="form-input" name="status">
                <option value="draft" ${item?.status === 'draft' || !item ? 'selected' : ''}>Brouillon</option>
                <option value="published" ${item?.status === 'published' ? 'selected' : ''}>Publié</option>
              </select>
            </div>
            <div style="display:flex;gap:8px;margin-top:12px;">
              <button type="submit" class="btn btn-primary" style="flex:1;">${itemId ? 'Mettre à jour' : 'Publier'}</button>
            </div>
          </div>

          ${supports.includes('featured_image') ? `
          <div class="card" style="margin-bottom:16px;">
            <h3 style="margin-bottom:12px;">Image à la une</h3>
            <div id="cptFeaturedPreview" style="margin-bottom:8px;">${featuredImgPreview}</div>
            <input type="hidden" name="featured_image" id="cptFeaturedInput" value="${fi ? escapeHtml(JSON.stringify(fi)) : ''}">
            <div style="display:flex;gap:8px;">
              <button type="button" class="btn btn-outline btn-sm" onclick="openCPTFeaturedPicker()">📷 Choisir</button>
              ${fi ? '<button type="button" class="btn btn-sm btn-danger-outline" onclick="clearCPTFeatured()">Supprimer</button>' : ''}
            </div>
          </div>
          ` : ''}

          ${categoriesHtml ? `<div class="card" style="margin-bottom:16px;">${categoriesHtml}</div>` : ''}

          <!-- Live Preview -->
          ${hasCustomFields ? `
          <div class="card cpt-preview-card" style="margin-bottom:16px;position:sticky;top:16px;">
            <h3 style="margin-bottom:12px;display:flex;align-items:center;gap:6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
              Aperçu
            </h3>
            <div id="cptLivePreview" style="border:1px solid var(--border,#e5e7eb);border-radius:8px;overflow:hidden;background:#fff;" data-preview-type="${escapeHtml(ptDef.previewType || '')}" data-preview-color-field="${escapeHtml(ptDef.previewColorField || '')}">
              <div id="cptPreviewImage" style="${ptDef.previewType === 'color_swatch' ? 'padding:24px 12px;display:flex;align-items:center;justify-content:center;background:#fff;' : 'width:100%;height:140px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#999;font-size:13px;overflow:hidden;'}">
                ${ptDef.previewType === 'color_swatch'
                  ? `<div id="cptPreviewSwatch" style="width:80px;height:80px;border-radius:50%;background:${escapeHtml(cf[ptDef.previewColorField] || '#ddd')};box-shadow:0 1px 3px rgba(0,0,0,0.08);"></div>`
                  : (fi ? `<img src="${escapeHtml(getOptimizedUrl(fi.sizes?.medium || fi.url || '', 400, 70))}" style="width:100%;height:100%;object-fit:cover;">` : 'Aucune image')}
              </div>
              <div style="padding:12px;${ptDef.previewType === 'color_swatch' ? 'text-align:center;' : ''}">
                <div id="cptPreviewBadges" style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;min-height:0;"></div>
                <h4 id="cptPreviewTitle" style="font-size:15px;font-weight:700;margin:0 0 6px 0;line-height:1.3;color:#1a1a1a;">${escapeHtml(item?.title || 'Titre de l\'élément')}</h4>
                <div id="cptPreviewDates" style="font-size:12px;color:#666;margin-bottom:6px;display:flex;align-items:center;gap:4px;"></div>
                <div id="cptPreviewLocation" style="font-size:12px;color:#666;margin-bottom:6px;display:flex;align-items:center;gap:4px;"></div>
                <div id="cptPreviewPrice" style="font-size:12px;color:#666;margin-bottom:8px;display:flex;align-items:center;gap:4px;"></div>
                <p id="cptPreviewDesc" style="font-size:12px;color:#888;margin:0;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;"></p>
                <div id="cptPreviewCta" style="margin-top:10px;"></div>
              </div>
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    </form>
  `;
}

function attachCPTFormEvents(ptDef) {
  // Auto-slug from title
  const titleInput = document.getElementById('cptTitleInput');
  const slugInput = document.getElementById('cptSlugInput');
  if (titleInput && slugInput && !slugInput.value) {
    titleInput.addEventListener('input', () => {
      slugInput.value = titleInput.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    });
  }

  // Tab switching
  document.querySelectorAll('.cpt-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cpt-tab').forEach(t => { t.classList.remove('active'); t.style.borderBottomColor = 'transparent'; t.style.color = '#999'; });
      tab.classList.add('active'); tab.style.borderBottomColor = 'var(--primary)'; tab.style.color = '';
      document.querySelectorAll('.cpt-tab-content').forEach(c => c.style.display = 'none');
      const target = document.querySelector(`.cpt-tab-content[data-tab="${tab.dataset.tab}"]`);
      if (target) target.style.display = '';
    });
  });

  // Link page selectors → URL sync (generic, supports multiple link fields)
  document.querySelectorAll('.cpt-link-page-select').forEach(sel => {
    const targetName = sel.dataset.target;
    if (!targetName) return;
    const urlInput = document.querySelector(`input[name="${targetName}"]`);
    if (urlInput) {
      sel.addEventListener('change', () => { if (sel.value) urlInput.value = sel.value; });
    }
  });

  // TrueFalse toggle slider sync
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
    // The <label> already toggles the checkbox on click, just sync the visuals
    cb.addEventListener('change', sync);
  });

  // Init all Quill editors (supports multiple WYSIWYG fields)
  initCPTQuillEditors();

  // Init Address fields (Mapbox geocoding + mini-map)
  document.querySelectorAll('.cpt-address-field').forEach(el => {
    initGoogleMapField(el.id);
  });

  // Live preview updates
  initCPTLivePreview(ptDef);

  // Form submit
  const form = document.getElementById('cptEditForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveCPTItemFromForm(ptDef);
    });
  }
}

// ── CPT Live Preview ──

function initCPTLivePreview(ptDef) {
  const preview = document.getElementById('cptLivePreview');
  if (!preview) return;

  const form = document.getElementById('cptEditForm');
  if (!form) return;

  const fieldNames = (ptDef.fields || []).map(f => f.name);

  function getVal(name) {
    const el = form.querySelector(`[name="cf_${name}"]`);
    if (!el) return '';
    if (el.type === 'checkbox') return el.checked ? '1' : '0';
    return el.value || '';
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr.replace(/\//g, '-'));
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function updatePreview() {
    // Title
    const titleEl = document.getElementById('cptPreviewTitle');
    const titleInput = form.querySelector('[name="title"]');
    if (titleEl && titleInput) {
      titleEl.textContent = titleInput.value || 'Titre de l\'élément';
    }

    // Color swatch preview (manifest: previewType=color_swatch, previewColorField=<field>)
    if (ptDef.previewType === 'color_swatch' && ptDef.previewColorField) {
      const swatch = document.getElementById('cptPreviewSwatch');
      if (swatch) {
        const v = getVal(ptDef.previewColorField);
        swatch.style.background = v && /^#?[0-9a-f]{3,8}$/i.test(v) ? (v.startsWith('#') ? v : '#' + v) : '#ddd';
      }
    }

    // Badges
    const badgesEl = document.getElementById('cptPreviewBadges');
    if (badgesEl) {
      let badges = '';
      if (getVal('is_sticky') === '1') {
        badges += '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:#fef3c7;color:#92400e;">⭐ À la une</span>';
      }
      if (getVal('sold_out') === '1') {
        badges += '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:#fee2e2;color:#991b1b;">Complet</span>';
      }
      const status = form.querySelector('[name="status"]');
      if (status && status.value === 'draft') {
        badges += '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:#e5e7eb;color:#6b7280;">Brouillon</span>';
      }
      badgesEl.innerHTML = badges;
    }

    // Dates
    const datesEl = document.getElementById('cptPreviewDates');
    if (datesEl && fieldNames.includes('start_date')) {
      const sd = getVal('start_date');
      const ed = getVal('end_date');
      const st = getVal('start_time');
      const et = getVal('end_time');
      let dateStr = '';
      if (sd) {
        dateStr = '📅 ' + formatDate(sd);
        if (ed && ed !== sd) dateStr += ' → ' + formatDate(ed);
        if (st) { dateStr += ' · ' + st; if (et) dateStr += ' - ' + et; }
      }
      datesEl.innerHTML = dateStr;
      datesEl.style.display = dateStr ? '' : 'none';
    }

    // Location
    const locEl = document.getElementById('cptPreviewLocation');
    if (locEl && fieldNames.includes('location_name')) {
      const locName = getVal('location_name');
      const addrField = form.querySelector('[name="cf_location__address"]');
      const addr = addrField ? addrField.value : '';
      let locStr = '';
      if (locName || addr) {
        locStr = '📍 ' + (locName || '');
        if (addr && addr !== locName) locStr += (locName ? ', ' : '') + addr;
      }
      locEl.innerHTML = locStr ? escapeHtml(locStr).replace('📍', '📍') : '';
      locEl.style.display = locStr ? '' : 'none';
    }

    // Price
    const priceEl = document.getElementById('cptPreviewPrice');
    if (priceEl && fieldNames.includes('price')) {
      const price = getVal('price');
      priceEl.innerHTML = price ? '🎟 ' + escapeHtml(price) : '';
      priceEl.style.display = price ? '' : 'none';
    }

    // Description
    const descEl = document.getElementById('cptPreviewDesc');
    if (descEl) {
      const desc = getVal('desc') || '';
      const excerpt = form.querySelector('[name="excerpt"]');
      descEl.textContent = desc || (excerpt ? excerpt.value : '') || '';
      descEl.style.display = descEl.textContent ? '' : 'none';
    }

    // CTA
    const ctaEl = document.getElementById('cptPreviewCta');
    if (ctaEl && fieldNames.includes('cta')) {
      const ctaUrl = form.querySelector('[name="cf_cta_url"]');
      const ctaTitle = form.querySelector('[name="cf_cta_title"]');
      const url = ctaUrl ? ctaUrl.value : '';
      const title = ctaTitle ? ctaTitle.value : '';
      if (url || title) {
        ctaEl.innerHTML = `<span style="display:inline-block;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:600;background:var(--primary,#224f5a);color:#fff;">${escapeHtml(title || 'En savoir plus')} →</span>`;
      } else {
        ctaEl.innerHTML = '';
      }
    }
  }

  // Listen to all input changes
  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);

  // Watch for featured image changes (MutationObserver on hidden input)
  const fiInput = form.querySelector('[name="featured_image"]');
  if (fiInput) {
    const observer = new MutationObserver(() => {
      const previewImg = document.getElementById('cptPreviewImage');
      if (!previewImg) return;
      try {
        const fi = fiInput.value ? JSON.parse(fiInput.value) : null;
        if (fi) {
          const url = fi.sizes?.medium || fi.url || '';
          previewImg.innerHTML = `<img src="${escapeHtml(getOptimizedUrl(url, 400, 70))}" style="width:100%;height:100%;object-fit:cover;">`;
        } else {
          previewImg.innerHTML = 'Aucune image';
        }
      } catch { /* ignore parse errors */ }
    });
    observer.observe(fiInput, { attributes: true, attributeFilter: ['value'] });
    // Also poll for value changes (some programmatic sets don't trigger mutation)
    let lastFiVal = fiInput.value;
    setInterval(() => {
      if (fiInput.value !== lastFiVal) {
        lastFiVal = fiInput.value;
        const evt = new Event('change');
        fiInput.dispatchEvent(evt);
        observer.disconnect();
        observer.observe(fiInput, { attributes: true, attributeFilter: ['value'] });
        // Update preview image
        const previewImg = document.getElementById('cptPreviewImage');
        if (!previewImg) return;
        try {
          const fi = fiInput.value ? JSON.parse(fiInput.value) : null;
          if (fi) {
            const url = fi.sizes?.medium || fi.url || '';
            previewImg.innerHTML = `<img src="${escapeHtml(getOptimizedUrl(url, 400, 70))}" style="width:100%;height:100%;object-fit:cover;">`;
          } else {
            previewImg.innerHTML = 'Aucune image';
          }
        } catch { /* ignore */ }
      }
    }, 500);
  }

  // Initial render
  updatePreview();
}

function initCPTQuillEditors() {
  const editors = document.querySelectorAll('.cpt-quill-editor');
  if (editors.length === 0) return;

  // Load Quill if not already loaded
  if (typeof Quill === 'undefined') {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = 'https://cdn.quilljs.com/1.3.7/quill.snow.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://cdn.quilljs.com/1.3.7/quill.min.js';
    script.onload = () => editors.forEach(el => createCPTQuill(el));
    document.head.appendChild(script);
  } else {
    editors.forEach(el => createCPTQuill(el));
  }
}

let _cptQuills = {};
let _cptQuill = null; // backward compat
function createCPTQuill(container) {
  const fieldName = container.dataset.field || 'text';
  const hiddenInput = document.querySelector(`input[name="cf_${fieldName}"]`);
  if (!hiddenInput) return;

  const q = new Quill(container, {
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
  // Set initial content
  if (hiddenInput.value) {
    q.root.innerHTML = hiddenInput.value;
  }
  // Sync on change
  q.on('text-change', () => {
    hiddenInput.value = q.root.innerHTML;
  });
  attachHtmlSourceToggle(q, {
    getHtml: () => q.root.innerHTML,
    onSync: (html) => { hiddenInput.value = html; }
  });
  _cptQuills[fieldName] = q;
  if (fieldName === 'text') _cptQuill = q;
}

// Featured image picker
function openCPTFeaturedPicker() {
  mediaPickerState = {
    isOpen: true,
    blockId: '__cpt_featured__',
    fieldName: 'featured_image',
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
      document.getElementById('mediaPickerModal').classList.add('is-open');
      updateMediaPickerContent();
    })
    .catch(() => hideLoading());
}

function clearCPTFeatured() {
  document.getElementById('cptFeaturedInput').value = '';
  document.getElementById('cptFeaturedPreview').innerHTML = '<div style="width:200px;height:150px;background:#f5f5f5;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;">Aucune image</div>';
}

// CPT custom_fields image picker — opens shared media picker, scoped to a single cf field
function openCPTCfImagePicker(fieldName, ftype) {
  const pickerType = ftype === 'video' ? 'video' : ftype === 'file' ? 'all' : 'image';
  mediaPickerState = {
    isOpen: true,
    blockId: '__cpt_cf__',
    fieldName,
    type: pickerType,
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
      document.getElementById('mediaPickerModal').classList.add('is-open');
      updateMediaPickerContent();
    })
    .catch(() => hideLoading());
}

function clearCPTCfImage(fieldName) {
  const input = document.getElementById(`cptCfImageInput_${fieldName}`);
  const preview = document.getElementById(`cptCfImagePreview_${fieldName}`);
  if (input) input.value = '';
  if (preview) preview.innerHTML = '';
}

// CPT Builder featured image picker (for page builder CPT mode)
function openCPTBuilderFeaturedPicker() {
  mediaPickerState = {
    isOpen: true,
    blockId: '__cpt_builder_featured__',
    fieldName: 'featured_image',
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
      document.getElementById('mediaPickerModal').classList.add('is-open');
      updateMediaPickerContent();
    })
    .catch(() => hideLoading());
}

function clearCPTBuilderFeatured() {
  document.getElementById('cptBuilderFeaturedInput').value = '';
  pageBuilderState.cptFeaturedImage = null;
  document.getElementById('cptBuilderFeaturedPreview').innerHTML = '<div style="width:100%;height:100px;background:#f5f5f5;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;font-size:13px;">Aucune image</div>';
}

// Builder photos gallery picker
function openCPTBuilderPhotoPicker() {
  mediaPickerState = {
    isOpen: true,
    blockId: '__cpt_builder_photos__',
    fieldName: 'photos',
    type: 'image',
    folderId: null,
    folders: [],
    items: [],
    multiple: true,
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
      document.getElementById('mediaPickerModal').classList.add('is-open');
      updateMediaPickerContent();
    })
    .catch(() => hideLoading());
}

function removeCPTBuilderPhoto(index) {
  const input = document.getElementById('cptBuilderPhotosInput');
  let photos = [];
  try { photos = JSON.parse(input.value || '[]'); } catch { photos = []; }
  photos.splice(index, 1);
  input.value = JSON.stringify(photos);
  updateCPTBuilderPhotosPreview(photos);
}

function updateCPTBuilderPhotosPreview(photos) {
  const preview = document.getElementById('cptBuilderPhotosPreview');
  if (!preview) return;
  if (photos.length === 0) {
    preview.innerHTML = '';
    return;
  }
  preview.innerHTML = photos.map((url, i) => `<div class="cpt-photo-item" data-index="${i}" style="position:relative;display:inline-block;margin:4px;">
    <img src="${escapeHtml(getOptimizedUrl(url, 80, 60))}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;">
    <button type="button" onclick="removeCPTBuilderPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#e74c3c;color:#fff;border:0;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:18px;text-align:center;">×</button>
  </div>`).join('');
}

// Photos gallery picker (classic form)
function openCPTPhotoPicker() {
  mediaPickerState = {
    isOpen: true,
    blockId: '__cpt_photos__',
    fieldName: 'photos',
    type: 'image',
    folderId: null,
    folders: [],
    items: [],
    multiple: true,
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
      document.getElementById('mediaPickerModal').classList.add('is-open');
      updateMediaPickerContent();
    })
    .catch(() => hideLoading());
}

function removeCPTPhoto(index) {
  const input = document.getElementById('cptPhotosInput');
  let photos = [];
  try { photos = JSON.parse(input.value || '[]'); } catch { photos = []; }
  photos.splice(index, 1);
  input.value = JSON.stringify(photos);
  updateCPTPhotosPreview(photos);
}

function updateCPTPhotosPreview(photos) {
  const preview = document.getElementById('cptPhotosPreview');
  if (!preview) return;
  if (photos.length === 0) {
    preview.innerHTML = '<p style="color:#999;font-size:13px;">Aucune photo</p>';
    return;
  }
  preview.innerHTML = photos.map((url, i) => `<div class="cpt-photo-item" data-index="${i}" style="position:relative;display:inline-block;margin:4px;">
    <img src="${escapeHtml(url)}" style="width:100px;height:80px;object-fit:cover;border-radius:4px;">
    <button type="button" class="btn-remove-photo" onclick="removeCPTPhoto(${i})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#e74c3c;color:#fff;border:0;cursor:pointer;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;">×</button>
  </div>`).join('');
}

// Hook into selectMediaFromPicker for CPT fields
const _origSelectMediaForCPT = typeof selectMediaFromPicker === 'function' ? selectMediaFromPicker : null;
const _origConfirmMediaForCPT = typeof confirmMediaPickerSelection === 'function' ? confirmMediaPickerSelection : null;

// We'll override in a non-destructive way by hooking into the existing flow
// The media picker calls selectMediaFromPicker(id) for single, confirmMediaPickerSelection() for multi

async function saveCPTItemFromForm(ptDef) {
  const form = document.getElementById('cptEditForm');
  if (!form) return;

  const formData = new FormData(form);
  const itemId = form.dataset.itemId ? parseInt(form.dataset.itemId) : null;
  const hasCustomFields = ptDef.fields && ptDef.fields.length > 0;

  // Sync all Quill editors content
  for (const [fieldName, q] of Object.entries(_cptQuills)) {
    const inp = form.querySelector(`input[name="cf_${fieldName}"]`);
    if (inp && q) inp.value = q.root.innerHTML;
  }

  // Build custom_fields dynamically from ptDef.fields
  const custom_fields = {};
  if (hasCustomFields) {
    for (const field of ptDef.fields) {
      const ftype = (field.type || 'Text').toLowerCase();

      if (ftype === 'link') {
        // Link type: compose JSON from sub-inputs
        const fn = field.name;
        const linkUrl = formData.get(`cf_${fn}_url`) || '';
        const linkTitle = formData.get(`cf_${fn}_title`) || '';
        const linkTarget = formData.get(`cf_${fn}_target`) || '_self';
        custom_fields[fn] = linkUrl ? JSON.stringify({ url: linkUrl, title: linkTitle, target: linkTarget }) : '';
      } else if (ftype === 'address') {
        // Address type: compose JSON from sub-inputs (double underscore matches initGoogleMapField)
        const fn = field.name;
        const addr = {
          address: formData.get(`cf_${fn}__address`) || '',
          street_number: formData.get(`cf_${fn}__street_number`) || '',
          street_name: formData.get(`cf_${fn}__street_name`) || '',
          post_code: formData.get(`cf_${fn}__post_code`) || '',
          city: formData.get(`cf_${fn}__city`) || '',
          lat: formData.get(`cf_${fn}__lat`) || '',
          lng: formData.get(`cf_${fn}__lng`) || ''
        };
        const hasAny = Object.values(addr).some(v => v !== '');
        custom_fields[fn] = hasAny ? JSON.stringify(addr) : '';
      } else if (field.name === 'photos' || ftype === 'photos') {
        custom_fields.photos = formData.get('cf_photos') || '[]';
      } else if (ftype === 'truefalse') {
        // Checkbox: last value wins (hidden=0, checked=1)
        const vals = formData.getAll(`cf_${field.name}`);
        custom_fields[field.name] = vals.includes('1') ? '1' : '0';
      } else if (ftype === 'date') {
        // Convert YYYY-MM-DD back to YYYY/MM/DD for consistency with ACF
        const dateVal = formData.get(`cf_${field.name}`) || '';
        custom_fields[field.name] = dateVal.replace(/-/g, '/');
      } else {
        custom_fields[field.name] = formData.get(`cf_${field.name}`) || '';
      }
    }
  }

  // Featured image
  const fiRaw = document.getElementById('cptFeaturedInput')?.value || '';
  let featured_image = null;
  try { if (fiRaw) featured_image = JSON.parse(fiRaw); } catch { /* ignore */ }

  // Categories
  const categories = [];
  form.querySelectorAll('.cpt-categories-checkboxes input[type="checkbox"]:checked').forEach(cb => {
    categories.push(parseInt(cb.value));
  });

  const _status = formData.get('status') || 'draft';
  const payload = {
    title: formData.get('title'),
    slug: formData.get('slug'),
    excerpt: formData.get('excerpt') || '',
    content: formData.get('content') || '',
    status: _status,
    featured_image,
    custom_fields,
    categories,
    published_date: _status === 'published' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null
  };

  try {
    showLoading();
    if (itemId) {
      await apiFetch(`/cpt/${ptDef.slug}/${itemId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast(`${ptDef.label} mis à jour`, 'success');
    } else {
      await apiFetch(`/cpt/${ptDef.slug}`, { method: 'POST', body: JSON.stringify(payload) });
      showToast(`${ptDef.label} créé`, 'success');
    }
    hideLoading();
    loadSection(`cpt:${ptDef.slug}`);
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Erreur lors de la sauvegarde', 'error');
  }
}

async function duplicateCPTItem(postTypeSlug, itemId) {
  showLoading();
  try {
    const source = await apiFetch(`/cpt/${postTypeSlug}/by-id/${itemId}`);
    if (!source) { hideLoading(); showToast('Élément introuvable', 'error'); return; }

    // Generate unique slug
    const allItems = await apiFetch(`/cpt/${postTypeSlug}`);
    const existingSlugs = new Set(allItems.map(i => i.slug));
    const baseSlug = source.slug + '-copie';
    let slug = baseSlug;
    let counter = 1;
    while (existingSlugs.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const cf = typeof source.custom_fields === 'string' ? JSON.parse(source.custom_fields) : (source.custom_fields || {});
    const categories = (source.categories || []).map(c => c.id);

    await apiFetch(`/cpt/${postTypeSlug}`, {
      method: 'POST',
      body: JSON.stringify({
        title: source.title + ' (copie)',
        slug,
        excerpt: source.excerpt || '',
        content: source.content || '',
        status: 'draft',
        featured_image: source.featured_image || null,
        custom_fields: cf,
        categories,
      }),
    });
    showToast('Élément dupliqué', 'success');
    loadSection(`cpt:${postTypeSlug}`);
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
  }
}

async function deleteCPTItemUI(postTypeSlug, itemId, title) {
  if (!confirm(`Supprimer "${title}" ?`)) return;
  try {
    await apiFetch(`/cpt/${postTypeSlug}/${itemId}`, { method: 'DELETE' });
    showToast('Élément supprimé', 'success');
    loadSection(`cpt:${postTypeSlug}`);
  } catch {
    showToast('Erreur lors de la suppression', 'error');
  }
}

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
    for (const s of allSettings) {
      if (s.setting_key.startsWith(prefix)) {
        settings[s.setting_key.replace(prefix, '')] = s.setting_value;
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

let _cptOptionsQuill = null;

async function renderCPTOptionsPage(ptDef) {
  showLoading();
  let settings = {};
  try {
    const allSettings = await apiFetch('/settings');
    for (const s of allSettings) {
      if (s.setting_key.startsWith(`cpt_${ptDef.slug}_`)) {
        settings[s.setting_key.replace(`cpt_${ptDef.slug}_`, '')] = s.setting_value;
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
  _cptOptionsQuill = new Quill(container, {
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
  if (hiddenInput.value) _cptOptionsQuill.root.innerHTML = hiddenInput.value;
  _cptOptionsQuill.on('text-change', () => {
    hiddenInput.value = _cptOptionsQuill.root.innerHTML;
  });
  attachHtmlSourceToggle(_cptOptionsQuill, {
    getHtml: () => _cptOptionsQuill.root.innerHTML,
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
  if (_cptOptionsQuill) {
    form.querySelector('input[name="archive_desc"]').value = _cptOptionsQuill.root.innerHTML;
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

let pageBuilderState = { editingPageId: null, blocks: [], meta: { title: '', slug: '', status: 'draft', show_in_menu: true, menu_order: 0, parent_id: null }, colorOverrides: { enabled: false, primary_color: '', secondary_color: '', tertiary_color: '', text_color: '', background_color: '', bg_form_field: '' }, seoMeta: { enabled: true, meta_title: '', meta_description: '', schema_org: '' }, cptMode: null, cptExcerpt: '', cptFeaturedImage: null, cptCategories: [], cptItemCategories: [], cptCustomFields: {} };
let selectedBlockId = null;
let reusableBlocBuilderMode = false;

// --- Unsaved changes guard ---
let _builderDirty = false;

function markBuilderDirty() {
  if (!_builderDirty) {
    _builderDirty = true;
    window.addEventListener('beforeunload', _beforeUnloadGuard);
  }
}

function clearBuilderDirty() {
  _builderDirty = false;
  window.removeEventListener('beforeunload', _beforeUnloadGuard);
}

function _beforeUnloadGuard(e) {
  if (_builderDirty) { e.preventDefault(); }
}

function isInBuilder() {
  const lastView = localStorage.getItem('adminLastView') || '';
  return lastView.startsWith('builder:') || lastView.startsWith('rb-builder:') || lastView.startsWith('cpt-edit:') || lastView.startsWith('cpt-add:');
}

async function guardedLoadSection(section) {
  if (_builderDirty) {
    const ok = await confirmModal('Vous avez des modifications non enregistrées. Quitter sans sauvegarder ?', 'Modifications non enregistrées');
    if (!ok) return;
    clearBuilderDirty();
  }
  loadSection(section);
}
let _inlineEditingBlockId = null;
let _inlineEditingFieldName = null;
let _inlineEditingDataRef = null;  // direct ref to the data object (block.data or sub-module data)
let _inlineEditingElement = null;  // the .txt.editor DOM element being edited
let moduleFieldSchema = null;
let _layoutToModuleName = null; // reverse map: layout slug → module class name
const moduleTemplateCache = {};
const moduleTemplatePromises = {};
const moduleStylesLoaded = new Set();
let baseStylesLoaded = false;
let mediaState = { folders: [], items: [], currentFolderId: null, selectedIds: [], search: '' };
let mediaPickerState = { isOpen: false, blockId: null, fieldName: null, fieldEl: null, type: 'all', folderId: null, folders: [], items: [], search: '' };
let siteSettingsCache = null;

function applyCssVariablesFromSettings(settings) {
  if (!settings || typeof document === 'undefined') return;
  const rootStyle = document.documentElement.style;

  const colorDefault = settings.text_color || '#001527';
  const colorPrimary = settings.primary_color || '#006a9b';
  const colorPrimaryBis = settings.brand_primary_dark || colorPrimary;
  const colorSecondary = settings.secondary_color || '#ea644e';
  const colorSecondaryBis = settings.brand_secondary_dark || colorSecondary;
  const colorTertiary = settings.tertiary_color || '#d0d0d0';
  const colorBackground = settings.background_color || '#ffffff';
  const colorForm = settings.bg_form_field || '#e3f3fc';

  rootStyle.setProperty('--color-default', colorDefault);
  rootStyle.setProperty('--color-primary', colorPrimary);
  rootStyle.setProperty('--color-primary-bis', colorPrimaryBis);
  rootStyle.setProperty('--color-secondary', colorSecondary);
  rootStyle.setProperty('--color-secondary-bis', colorSecondaryBis);
  rootStyle.setProperty('--color-tertiary', colorTertiary);
  rootStyle.setProperty('--color-background', colorBackground);
  rootStyle.setProperty('--color-form', colorForm);

  const FONT_TITLES = {
    poppins: 'Poppins',
    raleway: 'Raleway',
    archivo: 'Archivo',
    dm: 'DM Sans',
    sora: 'Sora'
  };

  const FONT_GENERALS = {
    barlow: 'Barlow',
    bitter: 'Bitter',
    'cormorant-garamond': 'Cormorant Garamond',
    encode: 'Encode Sans Expanded',
    exo: 'Exo',
    inter: 'Inter',
    jakarta: 'Plus Jakarta Sans',
    jost: 'Jost',
    kanit: 'Kanit',
    lora: 'Lora',
    montserrat: 'Montserrat',
    onest: 'Onest',
    'open-sans': 'Open Sans',
    roboto: 'Roboto',
    rubik: 'Rubik'
  };

  const fontTitleKey = settings.font_title || 'poppins';
  const fontGeneralKey = settings.font_general || 'jakarta';
  const fontTitle = FONT_TITLES[fontTitleKey] || 'Poppins';
  const fontGeneral = FONT_GENERALS[fontGeneralKey] || 'Plus Jakarta Sans';

  rootStyle.setProperty('--font-title', `'${fontTitle}', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`);
  rootStyle.setProperty('--font-general', `'${fontGeneral}', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`);

  const logoHeight = parseInt(settings.logo_height || '100', 10);
  if (!Number.isNaN(logoHeight)) {
    rootStyle.setProperty('--logo-height', `${logoHeight}px`);
  }

  // Toggle border-rounded class on builderCanvas so module previews
  // render with rounded corners when the setting is active
  const canvas = document.getElementById('builderCanvas');
  if (canvas) {
    canvas.classList.toggle('border-rounded', settings.rounded === '1');
  }
}

async function loadSiteSettings() {
  if (siteSettingsCache) return siteSettingsCache;
  try {
    siteSettingsCache = await apiFetch('/settings');
    applyCssVariablesFromSettings(siteSettingsCache);
    applyAdminFavicon(siteSettingsCache.favicon || '');
  } catch (e) {
    siteSettingsCache = {};
  }
  return siteSettingsCache;
}

function applyAdminFavicon(favicon) {
  if (!favicon) return;
  const el = document.getElementById('adminFavicon');
  if (!el) return;
  el.href = favicon;
  const ext = (favicon.split('?')[0].match(/\.([a-z0-9]+)$/i) || [])[1] || '';
  const map = { svg: 'image/svg+xml', png: 'image/png', ico: 'image/x-icon', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
  if (map[ext.toLowerCase()]) el.type = map[ext.toLowerCase()];
}

async function loadModuleFieldSchema() {
  if (moduleFieldSchema) return moduleFieldSchema;
  try {
    moduleFieldSchema = await apiFetch('/module-fields');
  } catch (e) {
    moduleFieldSchema = { modules: {} };
  }
  _layoutToModuleName = null; // invalidate reverse map cache
  return moduleFieldSchema;
}

function blockId() {
  return 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

// ========== CPT BUILDER MODE ==========
// Reuses the page builder for CPTs that have content support and no custom fields

async function openCPTBuilder(ptDef, itemId) {
  clearBuilderDirty();
  pageBuilderState.editingPageId = itemId;
  pageBuilderState.blocks = [];
  pageBuilderState.meta = { title: '', slug: '', status: 'draft', show_in_menu: false, menu_order: 0, parent_id: null };
  pageBuilderState.colorOverrides = { enabled: false, primary_color: '', secondary_color: '', tertiary_color: '', text_color: '', background_color: '', bg_form_field: '' };
  pageBuilderState.seoMeta = { enabled: true, meta_title: '', meta_description: '' };
  pageBuilderState.cptMode = ptDef;
  pageBuilderState.cptExcerpt = '';
  pageBuilderState.cptFeaturedImage = null;
  pageBuilderState.cptCategories = [];
  pageBuilderState.cptItemCategories = [];
  pageBuilderState.cptCustomFields = {};
  pageBuilderState.cptHeaderSettings = { h1_in_header: 'yes', title_in_header: 'showTitle' };
  pageBuilderState.pageMenus = [];
  selectedBlockId = null;

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
        pageBuilderState.blocks = parsePageContent(item.content);
        pageBuilderState.meta = { title: item.title, slug: item.slug, status: item.status, show_in_menu: false, menu_order: 0, parent_id: null };
        pageBuilderState.cptExcerpt = item.excerpt || '';
        pageBuilderState.cptFeaturedImage = item.featured_image || null;
        pageBuilderState.cptItemCategories = item.categories || [];
        pageBuilderState.cptCustomFields = typeof item.custom_fields === 'string' ? JSON.parse(item.custom_fields || '{}') : (item.custom_fields || {});
        // Load header settings from custom_fields
        const cf = pageBuilderState.cptCustomFields;
        pageBuilderState.cptHeaderSettings = {
          h1_in_header: cf.h1_in_header || 'yes',
          title_in_header: cf.title_in_header || 'showTitle',
        };
        if (item.seo_meta) {
          const seo = typeof item.seo_meta === 'string' ? JSON.parse(item.seo_meta) : item.seo_meta;
          pageBuilderState.seoMeta = { enabled: true, meta_title: seo.meta_title || '', meta_description: seo.meta_description || '', schema_org: seo.schema_org || '' };
        }
      }
      pageBuilderState.cptCategories = categories || [];
    } catch (e) { console.error(e); }
    hideLoading();
  } else {
    // New item — load categories
    if (ptDef.hasCategories) {
      try { pageBuilderState.cptCategories = await apiFetch(`/cpt/${ptDef.slug}/categories`) || []; } catch {}
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
}

async function saveCPTBuilder() {
  const ptDef = pageBuilderState.cptMode;
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
    if (textarea) textarea.value = quill.getSemanticHTML();
  });
  // Sync currently open block settings
  const panel = document.getElementById('builderSettings');
  const form = panel?.querySelector('form.builder-block-form');
  if (form && selectedBlockId) {
    liveUpdateFromSettingsForm(form);
  }

  const { title, slug, status } = pageBuilderState.meta;
  if (!title || !slug) { showToast('Titre et slug requis', 'error'); return; }

  const content = JSON.stringify(pageBuilderState.blocks);

  // Read excerpt from DOM
  const excerptEl = document.getElementById('cptBuilderExcerpt');
  const excerpt = excerptEl ? excerptEl.value : pageBuilderState.cptExcerpt;

  // Read featured image
  const fiInput = document.getElementById('cptBuilderFeaturedInput');
  let featured_image = null;
  try { if (fiInput?.value) featured_image = JSON.parse(fiInput.value); } catch {}

  // Read categories
  const categories = [];
  document.querySelectorAll('.cpt-builder-categories input[type="checkbox"]:checked').forEach(cb => {
    categories.push(parseInt(cb.value));
  });

  // Read custom fields from sidebar
  const custom_fields = {};
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
        custom_fields[field.name] = cb?.checked ? '1' : '0';
      } else {
        const el = document.querySelector(`.cpt-builder-cf[data-cf="${field.name}"]`);
        custom_fields[field.name] = el?.value || '';
      }
    }
  }

  // Read header settings from DOM (checkbox toggles)
  const h1Cb = document.querySelector('input[name="h1_in_header"]');
  const titleCb = document.querySelector('input[name="title_in_header"]');
  if (h1Cb) custom_fields.h1_in_header = h1Cb.checked ? 'yes' : 'no';
  if (titleCb) custom_fields.title_in_header = titleCb.checked ? 'showTitle' : 'hideTitle';

  const published_date = status === 'published' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
  const seo_meta = JSON.stringify(pageBuilderState.seoMeta);
  const payload = { title, slug, excerpt, content, status, featured_image, custom_fields, categories, published_date, seo_meta };

  showLoading();
  try {
    if (pageBuilderState.editingPageId) {
      await apiFetch(`/cpt/${ptDef.slug}/${pageBuilderState.editingPageId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast(`${ptDef.label} mis à jour`, 'success');
    } else {
      const res = await apiFetch(`/cpt/${ptDef.slug}`, { method: 'POST', body: JSON.stringify(payload) });
      showToast(`${ptDef.label} créé`, 'success');
      if (res?.id) {
        pageBuilderState.editingPageId = res.id;
        localStorage.setItem('adminLastView', `cpt-edit:${ptDef.slug}:${res.id}`);
      }
    }
    clearBuilderDirty();
  } catch (error) {
    showToast(error.message || 'Erreur lors de la sauvegarde', 'error');
  }
  hideLoading();
}

function parsePageContent(content) {
  if (!content || !content.trim()) return [];
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) && parsed.every(b => b && typeof b.type === 'string') ? parsed : [];
  } catch (e) {
    return [];
  }
}

async function openPageBuilder(pageId) {
  clearBuilderDirty();
  pageBuilderState.editingPageId = pageId;
  pageBuilderState.blocks = [];
  pageBuilderState.meta = { title: '', slug: '', status: 'draft', show_in_menu: true, menu_order: 0, parent_id: null };
  pageBuilderState.colorOverrides = { enabled: false, primary_color: '', secondary_color: '', tertiary_color: '', text_color: '', background_color: '', bg_form_field: '' };
  pageBuilderState.seoMeta = { enabled: true, meta_title: '', meta_description: '' };
  pageBuilderState.cptMode = null;
  pageBuilderState.pageMenus = [];       // menus with per-menu toggle/position state
  selectedBlockId = null;
  // Mémoriser la dernière vue comme "builder" pour restaurer après rafraîchissement
  localStorage.setItem('adminLastView', `builder:${pageId ?? 'new'}`);
  await loadModuleFieldSchema();
  ensureBaseModuleStyles();
  if (pageId) {
    showLoading();
    try {
      const [pages, pageMenus] = await Promise.all([
        apiFetch('/pages'),
        apiFetch(`/pages/${pageId}/menus`),
      ]);
      const page = pages.find(p => p.id === pageId);
      if (page) {
        pageBuilderState.blocks = parsePageContent(page.content);
        pageBuilderState.meta = { title: page.title, slug: page.slug, status: page.status, show_in_menu: page.show_in_menu !== false, menu_order: page.menu_order || 0, parent_id: page.parent_id || null };
        // Load color overrides
        try {
          const co = page.color_overrides ? JSON.parse(page.color_overrides) : null;
          if (co) pageBuilderState.colorOverrides = { enabled: !!co.enabled, primary_color: co.primary_color || '', secondary_color: co.secondary_color || '', tertiary_color: co.tertiary_color || '', text_color: co.text_color || '', background_color: co.background_color || '', bg_form_field: co.bg_form_field || '' };
        } catch (e) {}
        // Load SEO meta
        try {
          const seo = page.seo_meta ? JSON.parse(page.seo_meta) : null;
          if (seo) pageBuilderState.seoMeta = { enabled: true, meta_title: seo.meta_title || '', meta_description: seo.meta_description || '', schema_org: seo.schema_org || '' };
        } catch (e) {}
      }
      pageBuilderState.pageMenus = pageMenus?.menus || [];
    } catch (e) {}
    hideLoading();
  } else {
    // New page — load menus with empty state
    try {
      const pageMenus = await apiFetch('/menus');
      pageBuilderState.pageMenus = (pageMenus || []).map(m => ({
        id: m.id, name: m.name, location: m.location,
        enabled: false, parent_id: null, menu_order: 0, items: [],
      }));
    } catch (e) {}
  }
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  const pagesNav = document.querySelector('.nav-item[data-section="pages"]');
  if (pagesNav) pagesNav.classList.add('active');
  document.getElementById('content').innerHTML = await renderPageBuilder();
  attachPageBuilderListeners();
  // Apply border-rounded class to canvas based on current settings
  if (siteSettingsCache) {
    const canvas = document.getElementById('builderCanvas');
    if (canvas) canvas.classList.toggle('border-rounded', siteSettingsCache.rounded === '1');
  }
}

// Legacy buildMenuPositions/updatePagePositionOptions removed — now per-menu via renderPageMenuToggles

async function renderPageBuilder() {
  const m = pageBuilderState.meta;
  const isCPT = !!pageBuilderState.cptMode;
  const cptDef = pageBuilderState.cptMode;
  const pages = await apiFetch('/pages').catch(() => []);
  pageBuilderState._allPages = pages || [];

  const backSection = isCPT ? `cpt:${cptDef.slug}` : 'pages';
  const saveFunc = isCPT ? 'saveCPTBuilder()' : 'savePageBuilder()';
  const viewUrl = isCPT
    ? `${siteSettingsCache?.frontend_url || window.location.origin}/${cptDef.slug}/${encodeURIComponent(m.slug)}`
    : `${siteSettingsCache?.frontend_url || window.location.origin}/${m.slug.split('/').map(encodeURIComponent).join('/')}`;
  const titlePlaceholder = isCPT ? `Titre de l'${cptDef.label.toLowerCase()}` : 'Titre de la page';

  // CPT sidebar: featured image, excerpt, categories, custom fields
  let cptSidebarHtml = '';
  let customFieldsSidebarHtml = '';
  if (isCPT) {
    const fi = pageBuilderState.cptFeaturedImage;
    const fiPreview = fi
      ? `<img src="${escapeHtml(getOptimizedUrl(fi.sizes?.thumbnail || fi.url || '', 200, 60))}" alt="" style="max-width:100%;max-height:150px;object-fit:cover;border-radius:8px;">`
      : '<div style="width:100%;height:100px;background:#f5f5f5;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;font-size:13px;">Aucune image</div>';

    const hasExcerpt = cptDef.supports?.includes('excerpt');
    const catsHtml = cptDef.hasCategories && pageBuilderState.cptCategories.length > 0
      ? `<div style="margin-top:16px;">
          <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">${escapeHtml(cptDef.categoryLabel || 'Catégories')}</label>
          <div class="cpt-builder-categories" style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:8px;">
            ${pageBuilderState.cptCategories.map(cat => `
              <label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;font-size:13px;">
                <input type="checkbox" name="cat_${cat.id}" value="${cat.id}" ${pageBuilderState.cptItemCategories.find(c => c.id === cat.id) ? 'checked' : ''}>
                ${escapeHtml(cat.name)}
              </label>
            `).join('')}
          </div>
        </div>`
      : '';

    // Build custom fields HTML for sidebar
    if (cptDef.fields && cptDef.fields.length > 0) {
      const cf = pageBuilderState.cptCustomFields;
      const allPages = pageBuilderState._allPages || [];
      customFieldsSidebarHtml = cptDef.fields.map(field => {
        const val = cf[field.name] || '';
        const ftype = (field.type || 'Text').toLowerCase();

        if (field.name === 'photos' || ftype === 'photos') {
          let photos = [];
          try { photos = JSON.parse(val || '[]'); } catch { photos = []; }
          if (!Array.isArray(photos)) photos = [];
          const photosPreview = photos.length > 0
            ? photos.map((url, i) => `<div class="cpt-photo-item" data-index="${i}" style="position:relative;display:inline-block;margin:4px;">
                <img src="${escapeHtml(getOptimizedUrl(url, 80, 60))}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;">
                <button type="button" onclick="removeCPTBuilderPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#e74c3c;color:#fff;border:0;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:18px;text-align:center;">×</button>
              </div>`).join('')
            : '';
          return `<div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">${escapeHtml(field.label)}</label>
            <div id="cptBuilderPhotosPreview" style="margin-bottom:8px;">${photosPreview}</div>
            <input type="hidden" id="cptBuilderPhotosInput" value="${escapeHtml(JSON.stringify(photos))}">
            <button type="button" class="btn btn-outline btn-xs" onclick="openCPTBuilderPhotoPicker()">Ajouter des photos</button>
          </div>`;
        }

        if (ftype === 'link') {
          let lObj = { url: '', title: '', target: '_self' };
          try { if (val) lObj = typeof val === 'string' ? JSON.parse(val) : val; } catch {}
          const fnEsc = escapeHtml(field.name);
          return `<div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">${escapeHtml(field.label)}</label>
            <select class="form-input cpt-link-page-select" data-target="cptBf_${fnEsc}_url" style="font-size:12px;margin-bottom:4px;">
              <option value="">— Page du site —</option>
              ${allPages.filter(p => p.status === 'published').map(p => `<option value="/${escapeHtml(p.slug)}" ${lObj.url === '/' + p.slug ? 'selected' : ''}>${escapeHtml(p.title)}</option>`).join('')}
            </select>
            <input type="text" class="form-input" id="cptBf_${fnEsc}_url" value="${escapeHtml(lObj.url || '')}" placeholder="URL" style="font-size:12px;margin-bottom:4px;">
            <input type="text" class="form-input" id="cptBf_${fnEsc}_title" value="${escapeHtml(lObj.title || '')}" placeholder="Titre du lien" style="font-size:12px;margin-bottom:4px;">
            <select class="form-input" id="cptBf_${fnEsc}_target" style="font-size:12px;">
              <option value="_self" ${lObj.target !== '_blank' ? 'selected' : ''}>Même fenêtre</option>
              <option value="_blank" ${lObj.target === '_blank' ? 'selected' : ''}>Nouvel onglet</option>
            </select>
          </div>`;
        }

        if (ftype === 'textarea') {
          return `<div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">${escapeHtml(field.label)}</label>
            <textarea class="form-input cpt-builder-cf" data-cf="${escapeHtml(field.name)}" rows="3" style="font-size:12px;resize:vertical;">${escapeHtml(val)}</textarea>
          </div>`;
        }

        if (ftype === 'truefalse') {
          const isOn = val === true || val === 1 || val === '1' || val === 'true';
          return `<div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">${escapeHtml(field.label)}</label>
            <div style="padding:4px 0;">
              <label class="cpt-toggle" style="display:inline-flex;align-items:center;gap:10px;cursor:pointer;user-select:none;">
                <input type="checkbox" class="cpt-builder-cf-toggle" data-cf="${escapeHtml(field.name)}" ${isOn ? 'checked' : ''} style="display:none;">
                <span class="cpt-toggle-track" style="position:relative;width:44px;height:24px;border-radius:12px;background:${isOn ? 'var(--primary,#224f5a)' : '#ccc'};transition:background .2s;">
                  <span class="cpt-toggle-thumb" style="position:absolute;top:2px;left:${isOn ? '22px' : '2px'};width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .2s;"></span>
                </span>
                <span class="cpt-toggle-label" style="font-size:13px;color:#666;">${isOn ? 'Oui' : 'Non'}</span>
              </label>
            </div>
          </div>`;
        }

        // Address (Mapbox geocoding + mini-map)
        if (ftype === 'address') {
          let addr = { address: '', city: '', post_code: '', street_name: '', street_number: '', lat: '', lng: '' };
          try { if (val) addr = typeof val === 'string' ? JSON.parse(val) : val; } catch {}
          const fnEsc = escapeHtml(field.name);
          const uid = `cptBAddress_${fnEsc}_${Date.now()}`;
          return `<div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">${escapeHtml(field.label)}</label>
            <div id="${uid}" class="cpt-address-field" data-field="${fnEsc}" style="position:relative;">
              <div style="position:relative;margin-bottom:8px;">
                <input type="text" class="form-input googlemap-search" value="${escapeHtml(addr.address || '')}" placeholder="Rechercher une adresse..." autocomplete="off" style="font-size:12px;">
                <div class="googlemap-suggestions" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:100;background:#fff;border:1px solid var(--border);border-top:0;border-radius:0 0 6px 6px;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,.1);"></div>
              </div>
              <div class="googlemap-preview" style="height:${(addr.lat && addr.lng) ? '150px' : '0'};border-radius:8px;overflow:hidden;margin-bottom:8px;"></div>
              <input type="hidden" name="cf_${fnEsc}__street_number" value="${escapeHtml(addr.street_number || '')}">
              <input type="hidden" name="cf_${fnEsc}__street_name" value="${escapeHtml(addr.street_name || '')}">
              <input type="hidden" name="cf_${fnEsc}__post_code" value="${escapeHtml(addr.post_code || '')}">
              <input type="hidden" name="cf_${fnEsc}__city" value="${escapeHtml(addr.city || '')}">
              <input type="hidden" name="cf_${fnEsc}__address" value="${escapeHtml(addr.address || '')}">
              <input type="hidden" name="cf_${fnEsc}__lat" value="${escapeHtml(addr.lat || '')}">
              <input type="hidden" name="cf_${fnEsc}__lng" value="${escapeHtml(addr.lng || '')}">
              <input type="hidden" name="cf_${fnEsc}__place_id" value="">
              <input type="hidden" name="cf_${fnEsc}__name" value="">
              <input type="hidden" name="cf_${fnEsc}__street_name_short" value="">
            </div>
          </div>`;
        }

        // Image / File / Video (media picker)
        if (ftype === 'image' || ftype === 'file' || ftype === 'video') {
          let img = null;
          try { if (val) img = typeof val === 'string' ? JSON.parse(val) : val; } catch { img = null; }
          const url = (img && typeof img === 'object') ? (img.url || '') : (typeof val === 'string' && val.startsWith('/') ? val : '');
          const fnEsc = escapeHtml(field.name);
          const hiddenVal = val ? (typeof val === 'string' ? val : JSON.stringify(val)) : '';
          return `<div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">${escapeHtml(field.label)}</label>
            <div class="cpt-cf-image-field" data-cf="${fnEsc}" data-cf-type="${ftype}">
              <div id="cptCfImagePreview_${fnEsc}" style="margin-bottom:8px;">
                ${url ? `<img src="${escapeHtml(getOptimizedUrl(url, 200, 70))}" style="max-width:100%;max-height:120px;object-fit:cover;border-radius:6px;display:block;">` : ''}
              </div>
              <input type="hidden" class="cpt-builder-cf" data-cf="${fnEsc}" id="cptCfImageInput_${fnEsc}" value="${escapeHtml(hiddenVal)}">
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button type="button" class="btn btn-outline btn-xs" onclick="openCPTCfImagePicker('${fnEsc}', '${ftype}')">Choisir</button>
                ${url ? `<button type="button" class="btn btn-outline btn-xs" onclick="clearCPTCfImage('${fnEsc}')">Retirer</button>` : ''}
              </div>
            </div>
          </div>`;
        }

        // Default: text input
        return `<div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">${escapeHtml(field.label)}</label>
          <input type="text" class="form-input cpt-builder-cf" data-cf="${escapeHtml(field.name)}" value="${escapeHtml(val)}" style="font-size:12px;">
        </div>`;
      }).join('');
    }

    cptSidebarHtml = `
      <div style="padding:12px;border-bottom:1px solid var(--border);">
        <h4 style="margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--gray-400);">Image à la une</h4>
        <div id="cptBuilderFeaturedPreview" style="margin-bottom:8px;">${fiPreview}</div>
        <input type="hidden" id="cptBuilderFeaturedInput" value="${fi ? escapeHtml(JSON.stringify(fi)) : ''}">
        <div style="display:flex;gap:6px;">
          <button type="button" class="btn btn-outline btn-xs" onclick="openCPTBuilderFeaturedPicker()">Choisir</button>
          ${fi ? '<button type="button" class="btn btn-xs btn-danger-outline" onclick="clearCPTBuilderFeatured()">Supprimer</button>' : ''}
        </div>
        ${hasExcerpt ? `
          <div style="margin-top:16px;">
            <label class="form-label" style="font-weight:600;font-size:13px;margin-bottom:6px;display:block;">Extrait</label>
            <textarea class="form-input" id="cptBuilderExcerpt" rows="3" placeholder="Résumé court…" style="font-size:13px;resize:vertical;">${escapeHtml(pageBuilderState.cptExcerpt)}</textarea>
          </div>
        ` : ''}
        ${catsHtml}
      </div>
      `;
  }

  return `
    <div class="page-builder">
      <header class="builder-header">
        <button type="button" class="btn btn-danger" onclick="guardedLoadSection('${backSection}')">← Retour</button>
        <div class="builder-meta">
          <div class="builder-field-group">
            <label class="builder-field-label">Titre</label>
            <input type="text" class="form-input builder-title" placeholder="${titlePlaceholder}" value="${escapeHtml(m.title)}" data-field="title">
          </div>
          <div class="builder-field-group">
            <label class="builder-field-label">Slug URL</label>
            <input type="text" class="form-input builder-slug" placeholder="mon-url" value="${escapeHtml(m.slug)}" data-field="slug">
          </div>
          <div class="builder-field-group">
            <label class="builder-field-label">Statut</label>
            <select class="form-select builder-status" data-field="status" onchange="onBuilderStatusChange(this.value)">
              <option value="draft" ${m.status === 'draft' ? 'selected' : ''}>Brouillon</option>
              <option value="published" ${m.status === 'published' ? 'selected' : ''}>Publié</option>
              <option value="private" ${m.status === 'private' ? 'selected' : ''}>Privé</option>
            </select>
          </div>
          <div class="builder-field-group builder-publish-date-group" style="display:${m.status === 'draft' ? 'none' : ''}">
            <label class="builder-field-label">Date de publication</label>
            <div style="display:flex;gap:6px;align-items:center">
              <select class="form-select builder-publish-mode" style="width:auto;min-width:120px" onchange="onPublishModeChange(this.value)">
                <option value="now" ${!m.published_date || m.published_date === 'now' ? 'selected' : ''}>Maintenant</option>
                <option value="schedule" ${m.published_date && new Date(m.published_date) > new Date() ? 'selected' : ''}>Planifier</option>
                <option value="backdate" ${m.published_date && new Date(m.published_date) <= new Date() && m.published_date !== 'now' ? 'selected' : ''}>Antérieur</option>
              </select>
              <input type="datetime-local" class="form-input builder-publish-date" data-field="published_date" value="${m.published_date && m.published_date !== 'now' ? m.published_date.slice(0,16) : ''}" style="display:${m.published_date && m.published_date !== 'now' && new Date(m.published_date).getTime() !== new Date(m.created_at).getTime() ? '' : 'none'};width:auto">
            </div>
          </div>
        </div>
        <div class="builder-actions">
          ${(() => { const a = aiButtonAttrs(); return `<button type="button" class="btn btn-ai" onclick="openAiModal()" title="${a.title}"${a.disabled ? ' disabled' : ''}>✨ IA</button>`; })()}
          <button type="button" class="btn btn-primary" onclick="${saveFunc}">Enregistrer</button>
          <a href="${viewUrl}" target="_blank" class="btn btn-outline" id="viewPageBtn">Voir ${isCPT ? (cptDef.isFemale ? 'la ' : "l'") + cptDef.label.toLowerCase() : 'la page'}</a>
        </div>
      </header>
      <div class="builder-body">
        <aside class="builder-sidebar">
          ${cptSidebarHtml}
          <!-- Menu settings panel (collapsible) -->
          <div class="builder-menu-settings-panel" id="builderMenuSettingsPanel" style="display:none">
            <div class="builder-menu-settings-header">
              <h3>Paramètres menu</h3>
              <button type="button" class="btn btn-xs" onclick="toggleMenuSettingsPanel(false)">&times;</button>
            </div>
            <div class="builder-menu-settings-body">
              ${renderPageMenuToggles()}
              ${pageBuilderState.pageMenus.length === 0 ? '<p class="text-muted" style="font-size:0.85rem">Aucun menu créé. <a href="#" onclick="loadSection(\'menus\');return false">Créer un menu</a></p>' : ''}
            </div>
          </div>
          <div class="builder-modules-panel" id="builderModulesPanel" style="${selectedBlockId ? 'display:none' : ''}">
            ${isCPT ? '' : `<button type="button" class="btn btn-sm btn-outline builder-menu-settings-btn" onclick="toggleMenuSettingsPanel(true)" style="margin-bottom:12px;${m.status === 'draft' ? 'display:none' : ''}">Menu</button>
            <div class="cpt-builder-tabs" style="display:flex;border-bottom:2px solid var(--border,#e5e7eb);margin-bottom:0;">
              <button type="button" class="cpt-builder-tab active" data-tab="page-modules" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;text-align:center;border-bottom:2px solid var(--primary,#224f5a);margin-bottom:-2px;color:var(--primary,#224f5a);">Modules</button>
              <button type="button" class="cpt-builder-tab" data-tab="page-seo" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;text-align:center;border-bottom:2px solid transparent;margin-bottom:-2px;color:#999;">SEO</button>
              <button type="button" class="cpt-builder-tab" data-tab="page-colors" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;text-align:center;border-bottom:2px solid transparent;margin-bottom:-2px;color:#999;">Couleurs</button>
            </div>
            <div class="cpt-builder-tab-content" data-tab="page-modules" style="padding-top:16px;">`}
            ${isCPT && !customFieldsSidebarHtml && cptDef?.hasModules !== false ? `
            <div class="cpt-builder-tabs" style="display:flex;border-bottom:2px solid var(--border,#e5e7eb);margin-bottom:0;">
              <button type="button" class="cpt-builder-tab active" data-tab="cpt-header" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;border-bottom:2px solid var(--primary,#224f5a);margin-bottom:-2px;color:var(--primary,#224f5a);">Header</button>
              <button type="button" class="cpt-builder-tab" data-tab="cpt-seo" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;border-bottom:2px solid transparent;margin-bottom:-2px;color:#999;">SEO Meta</button>
              <button type="button" class="cpt-builder-tab" data-tab="cpt-modules" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;border-bottom:2px solid transparent;margin-bottom:-2px;color:#999;">Modules</button>
            </div>
            <div class="cpt-builder-tab-content" data-tab="cpt-header" style="padding-top:16px;">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                <label class="toggle-switch"><input type="checkbox" name="h1_in_header" ${pageBuilderState.cptHeaderSettings.h1_in_header !== 'no' ? 'checked' : ''}><span class="toggle-slider"></span></label>
                <span class="toggle-label">Mettre le titre H1 dans le header</span>
              </div>
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;">
                <label class="toggle-switch"><input type="checkbox" name="title_in_header" ${pageBuilderState.cptHeaderSettings.title_in_header !== 'hideTitle' ? 'checked' : ''}><span class="toggle-slider"></span></label>
                <span class="toggle-label">Afficher le titre dans le header</span>
              </div>
            </div>
            <div class="cpt-builder-tab-content" data-tab="cpt-seo" style="display:none;padding-top:16px;">
              <div class="builder-seo-body">
                <div class="seo-toggle">
                  <label>
                    <span class="toggle-switch">
                      <input type="checkbox" id="seoEnabled" ${pageBuilderState.seoMeta.enabled ? 'checked' : ''} onchange="onSeoToggle(this.checked)" />
                      <span class="toggle-slider"></span>
                    </span>
                    <span>Activer les meta SEO</span>
                  </label>
                </div>
                <div id="seoFields" style="${pageBuilderState.seoMeta.enabled ? '' : 'display:none'}">
                  <button type="button" class="btn btn-primary seo-analyze-btn" onclick="analyzeSeoPage()">Analyser la page</button>
                  <div class="seo-image-audit" style="display:none"></div>
                  <div class="seo-field">
                    <label class="form-label">Balise Title <span class="seo-counter" id="seoTitleCount">(${pageBuilderState.seoMeta.meta_title.length}/60)</span></label>
                    <input type="text" class="form-input" id="seo_meta_title" value="${(pageBuilderState.seoMeta.meta_title || '').replace(/"/g, '&quot;')}" oninput="onSeoFieldChange()" maxlength="60" placeholder="Titre SEO de la page (max 60 car.)" />
                    <div class="seo-progress-bar"><div id="seoTitleBar" style="width:${Math.min(100, (pageBuilderState.seoMeta.meta_title.length / 60) * 100)}%;background:${pageBuilderState.seoMeta.meta_title.length <= 60 ? '#22c55e' : '#ef4444'}"></div></div>
                  </div>
                  <div class="seo-field">
                    <label class="form-label">Meta Description <span class="seo-counter" id="seoDescCount">(${pageBuilderState.seoMeta.meta_description.length}/160)</span></label>
                    <textarea class="form-input" id="seo_meta_description" oninput="onSeoFieldChange()" maxlength="160" rows="3" placeholder="Description SEO de la page (max 160 car.)" style="resize:vertical">${(pageBuilderState.seoMeta.meta_description || '').replace(/</g, '&lt;')}</textarea>
                    <div class="seo-progress-bar"><div id="seoDescBar" style="width:${Math.min(100, (pageBuilderState.seoMeta.meta_description.length / 160) * 100)}%;background:${pageBuilderState.seoMeta.meta_description.length <= 160 ? '#22c55e' : '#ef4444'}"></div></div>
                  </div>
                  <div id="seoSchemaPanel" class="seo-schema-panel">
                    <button type="button" class="btn btn-sm btn-outline seo-generate-btn" onclick="generateSchemaOrg()">Generer le schema.org</button>
                    <textarea class="form-input" id="seo_schema_org" oninput="onSchemaOrgChange()" rows="14" placeholder='{"@context":"https://schema.org",...}'>${(pageBuilderState.seoMeta.schema_org || '').replace(/</g, '&lt;')}</textarea>
                  </div>
                  <div id="seoPreview" class="seo-google-preview">
                    <div class="seo-preview-title">${pageBuilderState.seoMeta.meta_title || pageBuilderState.meta.title || 'Titre de la page'}</div>
                    <div class="seo-preview-url">example.com/${cptDef.slug}/${pageBuilderState.meta.slug || 'slug'}</div>
                    <div class="seo-preview-desc">${pageBuilderState.seoMeta.meta_description || 'Description de la page...'}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="cpt-builder-tab-content" data-tab="cpt-modules" style="display:none;padding-top:16px;">
            ` : isCPT && customFieldsSidebarHtml && cptDef?.hasModules !== false ? `
            <div class="cpt-builder-tabs" style="display:flex;border-bottom:2px solid var(--border,#e5e7eb);margin-bottom:0;">
              <button type="button" class="cpt-builder-tab active" data-tab="cpt-header" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;border-bottom:2px solid var(--primary,#224f5a);margin-bottom:-2px;color:var(--primary,#224f5a);">Header</button>
              <button type="button" class="cpt-builder-tab" data-tab="cpt-seo" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;border-bottom:2px solid transparent;margin-bottom:-2px;color:#999;">SEO Meta</button>
              <button type="button" class="cpt-builder-tab" data-tab="cpt-contenu" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;border-bottom:2px solid transparent;margin-bottom:-2px;color:#999;">Contenu</button>
              <button type="button" class="cpt-builder-tab" data-tab="cpt-modules" style="flex:1;padding:10px 0;border:0;background:0;cursor:pointer;font-weight:600;font-size:13px;border-bottom:2px solid transparent;margin-bottom:-2px;color:#999;">Modules</button>
            </div>
            <div class="cpt-builder-tab-content" data-tab="cpt-header" style="padding-top:16px;">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                <label class="toggle-switch"><input type="checkbox" name="h1_in_header" ${pageBuilderState.cptHeaderSettings.h1_in_header !== 'no' ? 'checked' : ''}><span class="toggle-slider"></span></label>
                <span class="toggle-label">Mettre le titre H1 dans le header</span>
              </div>
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;">
                <label class="toggle-switch"><input type="checkbox" name="title_in_header" ${pageBuilderState.cptHeaderSettings.title_in_header !== 'hideTitle' ? 'checked' : ''}><span class="toggle-slider"></span></label>
                <span class="toggle-label">Afficher le titre dans le header</span>
              </div>
            </div>
            <div class="cpt-builder-tab-content" data-tab="cpt-seo" style="display:none;padding-top:16px;">
              <div class="builder-seo-body">
                <div class="seo-toggle">
                  <label>
                    <span class="toggle-switch">
                      <input type="checkbox" id="seoEnabled" ${pageBuilderState.seoMeta.enabled ? 'checked' : ''} onchange="onSeoToggle(this.checked)" />
                      <span class="toggle-slider"></span>
                    </span>
                    <span>Activer les meta SEO</span>
                  </label>
                </div>
                <div id="seoFields" style="${pageBuilderState.seoMeta.enabled ? '' : 'display:none'}">
                  <button type="button" class="btn btn-primary seo-analyze-btn" onclick="analyzeSeoPage()">Analyser la page</button>
                  <div class="seo-image-audit" style="display:none"></div>
                  <div class="seo-field">
                    <label class="form-label">Meta Title <span class="seo-counter" id="seoTitleCount">(${pageBuilderState.seoMeta.meta_title.length}/60)</span></label>
                    <input type="text" class="form-input" id="seo_meta_title" value="${(pageBuilderState.seoMeta.meta_title || '').replace(/"/g, '&quot;')}" oninput="onSeoFieldChange()" maxlength="60" placeholder="Titre SEO de la page (max 60 car.)" />
                    <div class="seo-progress-bar"><div id="seoTitleBar" style="width:${Math.min(100, (pageBuilderState.seoMeta.meta_title.length / 60) * 100)}%;background:${pageBuilderState.seoMeta.meta_title.length <= 60 ? '#22c55e' : '#ef4444'}"></div></div>
                  </div>
                  <div class="seo-field">
                    <label class="form-label">Meta Description <span class="seo-counter" id="seoDescCount">(${pageBuilderState.seoMeta.meta_description.length}/160)</span></label>
                    <textarea class="form-input" id="seo_meta_description" oninput="onSeoFieldChange()" maxlength="160" rows="3" placeholder="Description SEO de la page (max 160 car.)" style="resize:vertical">${(pageBuilderState.seoMeta.meta_description || '').replace(/</g, '&lt;')}</textarea>
                    <div class="seo-progress-bar"><div id="seoDescBar" style="width:${Math.min(100, (pageBuilderState.seoMeta.meta_description.length / 160) * 100)}%;background:${pageBuilderState.seoMeta.meta_description.length <= 160 ? '#22c55e' : '#ef4444'}"></div></div>
                  </div>
                  <div id="seoSchemaPanel" class="seo-schema-panel">
                    <button type="button" class="btn btn-sm btn-outline seo-generate-btn" onclick="generateSchemaOrg()">Generer le schema.org</button>
                    <textarea class="form-input" id="seo_schema_org" oninput="onSchemaOrgChange()" rows="14" placeholder='{"@context":"https://schema.org",...}'>${(pageBuilderState.seoMeta.schema_org || '').replace(/</g, '&lt;')}</textarea>
                  </div>
                  <div id="seoPreview" class="seo-google-preview">
                    <div class="seo-preview-title">${pageBuilderState.seoMeta.meta_title || pageBuilderState.meta.title || 'Titre de la page'}</div>
                    <div class="seo-preview-url">example.com/${cptDef.slug}/${pageBuilderState.meta.slug || 'slug'}</div>
                    <div class="seo-preview-desc">${pageBuilderState.seoMeta.meta_description || 'Description de la page...'}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="cpt-builder-tab-content" data-tab="cpt-contenu" style="display:none;padding-top:16px;">
              ${customFieldsSidebarHtml}
            </div>
            <div class="cpt-builder-tab-content" data-tab="cpt-modules" style="display:none;padding-top:16px;">
            ` : `
            `}
            ${cptDef?.hasModules !== false ? `
            <p class="form-help">Glissez un module dans la zone de droite.</p>
            <input type="text" class="form-input builder-module-search" placeholder="Rechercher un module…" oninput="filterBuilderModules(this.value)" style="margin-bottom:12px;font-size:13px;">
            <div class="builder-modules-list">
              ${MODULE_CATEGORIES.map(category => `
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
            ` : ''}
            ${(customFieldsSidebarHtml && cptDef?.hasModules !== false) || (isCPT && !customFieldsSidebarHtml && cptDef?.hasModules !== false) ? `</div>` : ''}
            ${!isCPT ? `</div>
            <div class="cpt-builder-tab-content" data-tab="page-seo" style="display:none;padding-top:16px;">
              <div class="builder-seo-body">
                <button type="button" class="btn btn-primary seo-analyze-btn" onclick="analyzeSeoPage()">Analyser la page</button>
                <div class="seo-image-audit" style="display:none"></div>
                <div class="seo-field">
                  <label class="form-label">Balise Title <span class="seo-counter" id="seoTitleCount">(${pageBuilderState.seoMeta.meta_title.length}/60)</span></label>
                  <input type="text" class="form-input" id="seo_meta_title" value="${(pageBuilderState.seoMeta.meta_title || '').replace(/"/g, '&quot;')}" oninput="onSeoFieldChange()" maxlength="60" placeholder="Titre SEO de la page (max 60 car.)" />
                  <div class="seo-progress-bar"><div id="seoTitleBar" style="width:${Math.min(100, (pageBuilderState.seoMeta.meta_title.length / 60) * 100)}%;background:${pageBuilderState.seoMeta.meta_title.length <= 60 ? '#22c55e' : '#ef4444'}"></div></div>
                </div>
                <div class="seo-field">
                  <label class="form-label">Meta Description <span class="seo-counter" id="seoDescCount">(${pageBuilderState.seoMeta.meta_description.length}/160)</span></label>
                  <textarea class="form-input" id="seo_meta_description" oninput="onSeoFieldChange()" maxlength="160" rows="3" placeholder="Description SEO de la page (max 160 car.)" style="resize:vertical">${(pageBuilderState.seoMeta.meta_description || '').replace(/</g, '&lt;')}</textarea>
                  <div class="seo-progress-bar"><div id="seoDescBar" style="width:${Math.min(100, (pageBuilderState.seoMeta.meta_description.length / 160) * 100)}%;background:${pageBuilderState.seoMeta.meta_description.length <= 160 ? '#22c55e' : '#ef4444'}"></div></div>
                </div>
                <div id="seoSchemaPanel" class="seo-schema-panel">
                  <button type="button" class="btn btn-sm btn-outline seo-generate-btn" onclick="generateSchemaOrg()">Generer le schema.org</button>
                  <textarea class="form-input" id="seo_schema_org" oninput="onSchemaOrgChange()" rows="14" placeholder='{"@context":"https://schema.org",...}'>${(pageBuilderState.seoMeta.schema_org || '').replace(/</g, '&lt;')}</textarea>
                </div>
                <div id="seoPreview" class="seo-google-preview">
                  <div class="seo-preview-title">${pageBuilderState.seoMeta.meta_title || pageBuilderState.meta.title || 'Titre de la page'}</div>
                  <div class="seo-preview-url">example.com/${pageBuilderState.meta.slug || 'slug'}</div>
                  <div class="seo-preview-desc">${pageBuilderState.seoMeta.meta_description || 'Description de la page...'}</div>
                </div>
              </div>
            </div>
            <div class="cpt-builder-tab-content" data-tab="page-colors" style="display:none;padding-top:16px;">
              <div class="builder-color-overrides-body">
                <div class="form-group" style="margin-bottom:12px">
                  <label class="toggle-switch-label" style="display:flex;align-items:center;cursor:pointer">
                    <span class="toggle-switch">
                      <input type="checkbox" id="colorOverrideEnabled" ${pageBuilderState.colorOverrides.enabled ? 'checked' : ''} onchange="onColorOverrideToggle(this.checked)" />
                      <span class="toggle-slider"></span>
                    </span>
                    <span style="margin-left:8px;font-weight:600;font-size:14px">Activer la surcharge</span>
                  </label>
                </div>
                <div id="colorOverrideFields" style="${pageBuilderState.colorOverrides.enabled ? '' : 'display:none'}">
                  <div class="color-override-grid">
                    <div class="form-group">
                      <label class="form-label">Couleur Primaire</label>
                      <div class="color-picker-wrapper">
                        <input type="color" class="form-color" id="co_primary_color" value="${pageBuilderState.colorOverrides.primary_color || '#006a9b'}" onchange="onColorOverrideChange()" />
                        <input type="text" class="form-input form-input-sm" value="${pageBuilderState.colorOverrides.primary_color || ''}" oninput="syncColorFromText(this, 'co_primary_color')" placeholder="Défaut thème" />
                      </div>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Couleur Secondaire</label>
                      <div class="color-picker-wrapper">
                        <input type="color" class="form-color" id="co_secondary_color" value="${pageBuilderState.colorOverrides.secondary_color || '#ea644e'}" onchange="onColorOverrideChange()" />
                        <input type="text" class="form-input form-input-sm" value="${pageBuilderState.colorOverrides.secondary_color || ''}" oninput="syncColorFromText(this, 'co_secondary_color')" placeholder="Défaut thème" />
                      </div>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Couleur Tertiaire</label>
                      <div class="color-picker-wrapper">
                        <input type="color" class="form-color" id="co_tertiary_color" value="${pageBuilderState.colorOverrides.tertiary_color || '#d0d0d0'}" onchange="onColorOverrideChange()" />
                        <input type="text" class="form-input form-input-sm" value="${pageBuilderState.colorOverrides.tertiary_color || ''}" oninput="syncColorFromText(this, 'co_tertiary_color')" placeholder="Défaut thème" />
                      </div>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Couleur des textes</label>
                      <div class="color-picker-wrapper">
                        <input type="color" class="form-color" id="co_text_color" value="${pageBuilderState.colorOverrides.text_color || '#001527'}" onchange="onColorOverrideChange()" />
                        <input type="text" class="form-input form-input-sm" value="${pageBuilderState.colorOverrides.text_color || ''}" oninput="syncColorFromText(this, 'co_text_color')" placeholder="Défaut thème" />
                      </div>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Couleur de fond</label>
                      <div class="color-picker-wrapper">
                        <input type="color" class="form-color" id="co_background_color" value="${pageBuilderState.colorOverrides.background_color || '#ffffff'}" onchange="onColorOverrideChange()" />
                        <input type="text" class="form-input form-input-sm" value="${pageBuilderState.colorOverrides.background_color || ''}" oninput="syncColorFromText(this, 'co_background_color')" placeholder="Défaut thème" />
                      </div>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Fond champs formulaire</label>
                      <div class="color-picker-wrapper">
                        <input type="color" class="form-color" id="co_bg_form_field" value="${pageBuilderState.colorOverrides.bg_form_field || '#e3f3fc'}" onchange="onColorOverrideChange()" />
                        <input type="text" class="form-input form-input-sm" value="${pageBuilderState.colorOverrides.bg_form_field || ''}" oninput="syncColorFromText(this, 'co_bg_form_field')" placeholder="Défaut thème" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>` : ''}
          </div>
          <div class="builder-settings" id="builderSettings" style="${selectedBlockId ? '' : 'display:none'}">
            ${renderBuilderSettingsPanel()}
          </div>
        </aside>
        ${cptDef?.hasModules === false ? '' : `<main class="builder-canvas" id="builderCanvas" data-drop-zone="true">
          <div class="builder-canvas-toolbar" id="builderToolbar" style="${pageBuilderState.blocks.length ? '' : 'display:none'}">
            <button type="button" class="btn btn-sm btn-danger" onclick="removeAllBlocks()">Tout supprimer</button>
          </div>
          <div class="builder-canvas-inner" id="builderCanvasInner" style="${buildColorOverrideStyle()}">
            <div class="builder-canvas-placeholder" id="builderPlaceholder">Glissez des modules ici ou cliquez sur un module à gauche pour l'ajouter.</div>
            <div class="builder-blocks" id="builderBlocks">
              ${renderBlocksWithInsertButtons(pageBuilderState.blocks)}
            </div>
          </div>
        </main>`}
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderBlockCard(block, visibleNum) {
  if (INACTIVE_PLUGIN_TYPES.has(block.type)) return '';
  const def = BLOCK_TYPES[block.type] || { label: block.type, icon: '▦' };
  const blockNum = typeof visibleNum === 'number'
    ? visibleNum
    : (() => {
        let n = 0;
        for (const b of pageBuilderState.blocks) {
          if (INACTIVE_PLUGIN_TYPES.has(b.type)) continue;
          n++;
          if (b === block) return n;
        }
        return '';
      })();
  const isHidden = block.data?.is_visible === 'no';
  const hiddenIcon = isHidden
    ? '<svg class="builder-block-hidden-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '';
  const richPreview = replaceEmptyImages(renderBlockPreviewHtml(block));
  return `
    <div class="builder-block-card builder-block-card--visual${selectedBlockId === block.id ? ' is-selected' : ''}${isHidden ? ' is-hidden-block' : ''}" data-block-id="${block.id}" draggable="true">
      <div class="builder-block-chrome">
        <span class="builder-block-number">${blockNum}</span>
        <span class="builder-block-handle">⋮⋮</span>
        <div class="builder-block-info">
          <strong>${escapeHtml(def.label)}</strong>
          ${hiddenIcon}
        </div>
        <div class="builder-block-actions">
          <button type="button" class="btn btn-sm btn-outline" onclick="editBlock('${block.id}')">Modifier</button>
          <button type="button" class="btn btn-sm btn-outline" onclick="duplicateBlock('${block.id}')">Dupliquer</button>
          <button type="button" class="btn btn-sm btn-danger" onclick="removeBlock('${block.id}')">Suppr.</button>
        </div>
      </div>
      ${richPreview ? `<div class="builder-block-render">${richPreview}</div>` : ''}
    </div>
  `;
}

function getBlockPreview(block) {
  const d = block.data || {};
  if (LEGACY_BLOCK_TYPES[block.type]) {
    if (block.type === 'heading') return (d.text || '').slice(0, 40);
    if (block.type === 'text') return (d.title || d.body || '').slice(0, 40);
    if (block.type === 'hero') return (d.title || '').slice(0, 40);
    if (block.type === 'cta') return (d.title || '').slice(0, 40);
    if (block.type === 'image') return d.src ? 'Image' : '';
    if (block.type === 'spacer') return 'Espace ' + (d.size || 'medium');
    if (block.type === 'html') return (d.content || '').slice(0, 30) + (d.content && d.content.length > 30 ? '…' : '');
  }
  const preferredKeys = ['title', 'text', 'name', 'label', 'content', 'summary', 'subtitle'];
  for (const key of preferredKeys) {
    if (typeof d[key] === 'string' && d[key].trim()) return d[key].trim().slice(0, 40);
  }
  const keys = Object.keys(d);
  if (keys.length === 0) return '';
  for (const key of keys) {
    const val = d[key];
    if (typeof val === 'string' && val.trim()) return `${key}: ${val.trim().slice(0, 32)}`;
  }
  return '';
}

function renderHeroPreviewHtml(data) {
  const isSlider = data.is_hero_banner_slider !== false
    && data.is_hero_banner_slider !== 0
    && data.is_hero_banner_slider !== '0';

  if (isSlider) {
    const sliders = Array.isArray(data.hero_sliders) ? data.hero_sliders : [];
    if (sliders.length === 0) {
      return '<div class="preview-hero-banner"><div class="preview-hero-desc"><span class="preview-hero-empty-label">Hero banner · slider (vide)</span></div></div>';
    }
    const slide = sliders[0];
    const imgUrl = slide.image?.url || '';
    const title = slide.title || '';
    const catchphrase = slide.catchphrase || '';
    return `<div class="preview-hero-banner">
      ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" class="preview-hero-bg" alt="">` : _noImagePlaceholderHtml}
      <div class="preview-hero-desc">
        ${title ? `<p class="preview-hero-title">${escapeHtml(title)}</p>` : ''}
        ${catchphrase ? `<p class="preview-hero-sub">${escapeHtml(catchphrase)}</p>` : ''}
        ${sliders.length > 1 ? `<p class="preview-hero-count">${sliders.length} slides</p>` : ''}
      </div>
    </div>`;
  }

  // Double-bloc mode
  const blocs = [data.left_bloc, data.right_bloc].filter(Boolean);
  if (blocs.length === 0) {
    return '<div class="preview-hero-banner"><div class="preview-hero-desc"><span class="preview-hero-empty-label">Hero banner · double bloc (vide)</span></div></div>';
  }
  const parts = blocs.map((bloc) => {
    const imgUrl = bloc.image?.url || '';
    return `<div class="preview-hero-bloc">
      ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" class="preview-hero-bloc-img" alt="">` : _noImagePlaceholderHtml}
      ${bloc.title ? `<p class="preview-hero-bloc-title">${escapeHtml(bloc.title)}</p>` : ''}
    </div>`;
  });
  return `<div class="preview-hero-list">${parts.join('')}</div>`;
}

/**
 * Fallback preview for sub-modules inside ColumnsTab when the Blade template
 * engine produces empty output. Extracts key visual data (images, text, titles)
 * and renders a simple but meaningful preview.
 */
function renderSubModuleFallback(layout, data) {
  const def = BLOCK_TYPES[layout] || {};
  const label = def.label || MODULE_LABELS[layout] || layout;
  const parts = [];

  // Try to find and display an image from common field names
  const imgFields = ['image', 'file', 'video', 'bg_img', 'preview'];
  for (const key of imgFields) {
    const val = data[key];
    if (val) {
      const url = typeof val === 'string' ? val : (val.url || val.sizes?.['medium-large'] || val.sizes?.large || '');
      if (url) { parts.push(`<img src="${escapeHtml(url)}" alt="" style="max-width:100%;height:auto;border-radius:4px;">`); break; }
    }
  }
  // Try to find images inside common repeater fields
  if (parts.length === 0) {
    const repeaterFields = ['list', 'list_interlocking', 'sliders', 'logos', 'images', 'slider', 'items'];
    for (const key of repeaterFields) {
      const arr = data[key];
      if (Array.isArray(arr) && arr.length > 0) {
        const item = arr[0];
        for (const imgKey of ['file', 'image', 'logo', 'slide']) {
          const val = item[imgKey];
          if (val) {
            const url = typeof val === 'string' ? val : (val.url || '');
            if (url) { parts.push(`<img src="${escapeHtml(url)}" alt="" style="max-width:100%;height:auto;border-radius:4px;">`); break; }
          }
        }
        if (parts.length > 0) break;
      }
    }
  }

  // Try to extract text content
  const textFields = ['text', 'title', 'title_bloc', 'catchphrase', 'description', 'desc'];
  for (const key of textFields) {
    const val = data[key];
    if (val && typeof val === 'string' && val.trim()) {
      parts.push(`<div style="font-size:0.9em;">${escapeHtml(val.replace(/<[^>]*>/g, '').slice(0, 150))}</div>`);
      break;
    }
  }

  if (parts.length === 0) {
    parts.push(`<span style="opacity:0.5">${escapeHtml(label)}</span>`);
  }

  return `<div class="module" style="padding:1em 0;">${parts.join('')}</div>`;
}

function renderColumnsTabPreviewHtml(data) {
  // Ensure columns-tab CSS is loaded (display:flex, column widths, etc.)
  const colsLayout = moduleFieldSchema?.modules?.ColumnsTab?.layout || 'columns-tab';
  if (!moduleTemplateCache[colsLayout]) {
    queueModuleTemplateLoad(colsLayout);
  }

  const columnsList = Array.isArray(data.columns_list) ? data.columns_list : [];
  if (columnsList.length === 0) {
    return '<div class="module module-columns"><div class="container"><p style="text-align:center;opacity:0.5;">Colonnes (vide)</p></div></div>';
  }
  const columnsCount = columnsList.length;
  const columnsDisplay = data.columns_display || 'columns-2_2-2';
  const columnsBackground = data.columns_background || 'no-background';
  const containerWidth = data.container_width == 1 || data.container_width === true || data.container_width === '1';
  const colsJustifyCenter = data.cols_justify_items == 1 || data.cols_justify_items === true || data.cols_justify_items === '1';
  const containerClass = containerWidth ? 'container-large' : 'container';

  // Bloc title
  let titleHtml = '';
  const titleBloc = data.title_bloc || data.title || '';
  if (titleBloc) {
    const titleStyle = data.title_style || 2;
    const titleAlign = data.title_align || 'center';
    titleHtml = `<h${titleStyle} class="title-module title-section-${titleStyle} align-${escapeHtml(String(titleAlign))}">${escapeHtml(String(titleBloc))}</h${titleStyle}>`;
  }

  // Background image
  let bgHtml = '';
  const bgImg = data.bg_img;
  if (bgImg) {
    const bgUrl = typeof bgImg === 'string' ? bgImg : (bgImg.url || '');
    const bgOpacity = (data.bg_opacity ?? 10) / 100;
    if (bgUrl) {
      bgHtml = `<div class="background" style="background-image: url(${escapeHtml(bgUrl)}); opacity: ${bgOpacity}; background-size: cover; background-position: center; position: absolute; inset: 0;"></div>`;
    }
  }

  // Ensure sub-module CSS is loaded
  const ensureSubModuleTemplates = (layout) => {
    if (!moduleTemplateCache[layout]) {
      queueModuleTemplateLoad(layout);
    }
  };

  // Build columns HTML — render each sub-module via renderBlockPreviewHtml
  const colsHtml = columnsList.map((column) => {
    const subModules = Array.isArray(column.columns_module) ? column.columns_module : [];
    const subHtmlParts = subModules.map((subModule) => {
      const layout = subModule.acf_fc_layout || subModule.type || '';
      if (!layout) return '';
      // Ensure sub-module template & CSS are loaded
      const subDef = BLOCK_TYPES[layout] || {};
      const subModuleName = subDef.moduleName || layout;
      let subLayout = moduleFieldSchema?.modules?.[subModuleName]?.layout || null;
      // Fallback: layout slug may itself be the layout (e.g. 'text' from acf_fc_layout)
      if (!subLayout) {
        const map = getLayoutToModuleNameMap();
        if (map[layout]) subLayout = layout;
      }
      if (subLayout) ensureSubModuleTemplates(subLayout);
      // Create a fake block and recursively render the sub-module preview
      // Mark as inside columns so templates can suppress title/background
      // _isSubModule bypasses the legacy block check (e.g. layout slug 'text'
      // is both a legacy block AND the Nickl TextSimple module slug)
      const subBlock = { id: 'sub-' + Math.random().toString(36).slice(2), type: layout, data: { ...subModule, columns: 1 }, _isSubModule: true };
      let subHtml = '';
      try { subHtml = replaceEmptyImages(renderBlockPreviewHtml(subBlock)); } catch (e) { console.warn('Sub-module render error:', layout, e); }
      // If template rendering produced empty/whitespace-only output (no text
      // AND no images), show a meaningful fallback so the column isn't invisible.
      if (!subHtml || (!subHtml.replace(/<[^>]*>/g, '').trim() && !/<img\s/i.test(subHtml) && !/<video\s/i.test(subHtml))) {
        subHtml = renderSubModuleFallback(layout, subModule);
      }
      return `<div class="module-in-column" style="width:100%">${subHtml}</div>`;
    }).filter(Boolean);
    return `<div class="col">${subHtmlParts.join('')}</div>`;
  }).join('');

  const extraClasses = [];
  if (data.bloc_color && data.bloc_color !== 'no-background-color') extraClasses.push(data.bloc_color);
  if (data.padding_top) extraClasses.push(data.padding_top);
  if (data.padding_bottom) extraClasses.push(data.padding_bottom);
  if (columnsBackground !== 'no-background') extraClasses.push('cols_have_background');
  if (data.bg_img) extraClasses.push('has-background-image');
  if (data.bg_parallax === true || data.bg_parallax === 1 || data.bg_parallax === '1') extraClasses.push('background-parallax');

  // Inline styles pour garantir le rendu visuel (contourne les conflits de cascade CSS)
  const inlineStyles = [];
  const COLOR_VALUES = getResolvedColorMap();
  const bc = data.bloc_color || '';
  if (bc && COLOR_VALUES[bc]) {
    inlineStyles.push(`background-color: ${COLOR_VALUES[bc]} !important`);
  }
  // Padding
  const pt = data.padding_top || '';
  const pb = data.padding_bottom || '';
  if (pt === 'no-padding-top') inlineStyles.push('padding-top: 0 !important');
  else if (pt === 'padding-top-small') inlineStyles.push('padding-top: calc(37.5px + 1.95vw) !important');
  if (pb === 'no-padding-bottom') inlineStyles.push('padding-bottom: 0 !important');
  else if (pb === 'padding-bottom-small') inlineStyles.push('padding-bottom: calc(37.5px + 1.95vw) !important');

  const styleAttr = inlineStyles.length > 0 ? ` style="${inlineStyles.join('; ')}"` : '';

  return `<div class="module module-columns ${extraClasses.join(' ')}"${styleAttr}>
    ${bgHtml}
    <div class="${escapeHtml(containerClass)}">
      ${titleHtml}
      <div class="cols-wrapper ${escapeHtml(columnsBackground)} columns-${columnsCount} ${escapeHtml(columnsDisplay)}${colsJustifyCenter ? ' cols_justify_center' : ''}">
        ${colsHtml}
      </div>
    </div>
  </div>`;
}

function renderBlockPreviewHtml(block) {
  const d = block.data || {};
  // Sub-modules inside ColumnsTab may have layout slugs that collide with
  // legacy block types (e.g. 'text' is both a legacy type AND the Nickl
  // TextSimple layout slug). Skip the legacy path for sub-modules so they
  // are rendered through the Blade template engine instead.
  if (LEGACY_BLOCK_TYPES[block.type] && !block._isSubModule) {
    if (block.type === 'heading') return `<div class="preview-heading">${escapeHtml(d.text || '')}</div>`;
    if (block.type === 'text') return `<div class="preview-title">${escapeHtml(d.title || '')}</div><div class="preview-text">${escapeHtml(d.body || '')}</div>`;
    if (block.type === 'hero') return `<div class="preview-hero"><div class="preview-title">${escapeHtml(d.title || '')}</div><div class="preview-text">${escapeHtml(d.subtitle || '')}</div></div>`;
    if (block.type === 'cta') return `<div class="preview-cta"><div class="preview-title">${escapeHtml(d.title || '')}</div><div class="preview-text">${escapeHtml(d.description || '')}</div></div>`;
    if (block.type === 'image') return d.src ? `<img class="preview-image" src="${escapeHtml(d.src)}" alt="${escapeHtml(d.alt || '')}">` : _noImagePlaceholderHtml;
    if (block.type === 'spacer') return `<div class="preview-spacer">Espace: ${escapeHtml(d.size || 'medium')}</div>`;
    if (block.type === 'html') return d.content ? `<div class="preview-html">${escapeHtml(String(d.content).slice(0, 240))}</div>` : '';
  }
  // Module Hero — custom visual preview (template has PHP helpers that can't render in JS)
  if (block.type === 'Hero' || block.type === 'hero') {
    return renderHeroPreviewHtml(d);
  }
  // IllusVideo — custom preview (video element needs explicit dimensions)
  if (block.type === 'illus-video' || block.type === 'IllusVideo') {
    const vid = d.video || {};
    const url = typeof vid === 'string' ? vid : (vid.url || '');
    if (!url) return '<div class="preview-loading">Aucune vidéo sélectionnée</div>';
    const w = Number(vid.width) || 0;
    const h = Number(vid.height) || 0;
    const ratio = h > 0 ? Math.floor(w / h) : 2;
    const isFs = d.is_fullscreen === true || d.is_fullscreen === 1 || d.is_fullscreen === '1';
    const cls = [isFs ? 'full-width' : '', d.bloc_color || '', d.padding_top || '', d.padding_bottom || ''].filter(Boolean).join(' ');
    return `<div class="module module-illustration-video ${escapeHtml(cls)}"><div class="container-large"><div class="video-wrapper" style="height:calc(100vh / ${ratio});position:relative"><video class="video" autoplay loop muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"><source src="${escapeHtml(url)}" type="video/mp4"></video></div></div></div>`;
  }
  // NewsSlider — custom preview (fetches actualités from CPT API)
  if (block.type === 'news-slider' || block.type === 'NewsSlider') {
    const nsCols = d.display_posts || '1';
    const nsExtraCls = [d.bloc_color || '', d.padding_top || '', d.padding_bottom || ''].filter(Boolean).join(' ');
    let nsBgHtml = '';
    const nsBgImg = d.bg_img;
    if (nsBgImg) {
      const nsBgUrl = typeof nsBgImg === 'string' ? nsBgImg : (nsBgImg.url || '');
      const nsBgOpacity = (d.bg_opacity ?? 10) / 100;
      if (nsBgUrl) nsBgHtml = `<div class="background" style="background-image:url(${escapeHtml(nsBgUrl)});opacity:${nsBgOpacity};background-size:cover;background-position:center;position:absolute;inset:0;"></div>`;
    }
    let nsTitleHtml = '';
    const nsTitleBloc = d.title_bloc || d.title || '';
    if (nsTitleBloc) {
      const nsTitleStyle = d.title_style || 2;
      const nsTitleAlign = d.title_align || 'center';
      nsTitleHtml = `<h${nsTitleStyle} class="title-module title-section-${nsTitleStyle} align-${escapeHtml(String(nsTitleAlign))}">${escapeHtml(String(nsTitleBloc))}</h${nsTitleStyle}>`;
    }
    const nsShowLink = d.display_archive_link === true || d.display_archive_link === 1 || d.display_archive_link === '1';
    const nsLinkLabel = d.archive_link_label || 'Voir toutes les actualités';
    const nsLinkHtml = nsShowLink ? `<div class="btn-more-wrapper"><a href="/actualites" class="btn btn-tertiary">${escapeHtml(nsLinkLabel)}</a></div>` : '';
    const nsId = 'ns_preview_' + Math.random().toString(36).slice(2, 8);

    // Async fetch actualités and inject
    setTimeout(async () => {
      const el = document.getElementById(nsId);
      if (!el) return;
      try {
        const data = await apiFetch('/cpt/actualites?status=published&limit=6');
        const items = data.items || data || [];
        if (items.length === 0) { el.innerHTML = '<p class="no-content">Aucune actualité publiée</p>'; return; }
        el.innerHTML = items.map(item => {
          const fi = item.featured_image;
          const imgUrl = fi ? (fi.sizes?.half || fi.url || '') : '';
          const cat = (item.categories || [])[0]?.name || '';
          const date = item.published_date || item.created_at;
          const dateStr = date ? new Date(date).toLocaleDateString('fr-FR') : '';
          return `<div class="swiper-slide item"><a href="#" class="link" onclick="return false"><div class="illus-wrapper">${imgUrl ? `<img src="${escapeHtml(getOptimizedUrl(imgUrl, 600, 70))}" alt="${escapeHtml(item.title)}" class="illus">` : _noImagePlaceholderHtml}<div class="overlay"><span>Lire l'actualité</span></div></div><div class="desc">${cat ? `<p class="category">${escapeHtml(cat)}</p>` : ''}${dateStr ? `<time class="date">${dateStr}</time>` : ''}<h3 class="title">${escapeHtml(item.title)}</h3>${item.excerpt ? `<p class="txt">${escapeHtml(item.excerpt)}</p>` : ''}</div></a></div>`;
        }).join('');
      } catch (e) {
        el.innerHTML = '<p style="text-align:center;opacity:.5">Erreur de chargement</p>';
      }
    }, 50);

    // Ensure CSS is loaded
    if (!moduleTemplateCache['news-slider']) queueModuleTemplateLoad('news-slider');
    return `<div class="module module-news-slider ${escapeHtml(nsExtraCls)}" style="position:relative">${nsBgHtml}<div class="container-large">${nsTitleHtml}<div class="slider-wrapper"><div class="swiper slider js_news-slider columns-${escapeHtml(nsCols)}"><div class="swiper-wrapper" id="${nsId}"><p style="text-align:center;opacity:.5">Chargement des actualités…</p></div></div></div>${nsLinkHtml}</div></div>`;
  }
  // Accordion — empty state: render add button directly
  if ((block.type === 'accordion' || block.type === 'Accordion') && (!Array.isArray(d.accordions) || d.accordions.length === 0)) {
    return `<div class="module module-accordion"><div class="container"><div class="accordion"><button type="button" class="accordion-add-btn">+ Ajouter un élément</button></div></div></div>`;
  }
  // ColumnsTab — custom preview (renders sub-modules recursively)
  if (block.type === 'columns-tab' || block.type === 'ColumnsTab') {
    return renderColumnsTabPreviewHtml(d);
  }
  // IconLogo — custom preview (@php block stripped by JS Blade engine → $img unresolved)
  if (block.type === 'icon-logo' || block.type === 'IconLogo' || block.type === 'icons') {
    const logos = Array.isArray(d.logos) ? d.logos : [];
    const greyFilter = d.grey_filter === true || d.grey_filter === 1 || d.grey_filter === '1';
    const iconType = d.icon_type !== false && d.icon_type !== 0 && d.icon_type !== '0';
    const extraCls = [];
    if (d.bloc_color) extraCls.push(d.bloc_color);
    if (d.padding_top) extraCls.push(d.padding_top);
    if (d.padding_bottom) extraCls.push(d.padding_bottom);
    // Background image
    let bgHtml = '';
    const bgImg = d.bg_img;
    if (bgImg) {
      const bgUrl = typeof bgImg === 'string' ? bgImg : (bgImg.url || '');
      const bgOpacity = (d.bg_opacity ?? 10) / 100;
      if (bgUrl) {
        bgHtml = `<div class="background" style="background-image: url(${escapeHtml(bgUrl)}); opacity: ${bgOpacity}; background-size: cover; background-position: center; position: absolute; inset: 0;"></div>`;
        extraCls.push('has-background-image');
      }
    }
    // Bloc title
    let titleHtml = '';
    const titleBloc = d.title_bloc || d.title || '';
    if (titleBloc) {
      const titleStyle = d.title_style || 2;
      const titleAlign = d.title_align || 'center';
      titleHtml = `<h${titleStyle} class="title-module title-section-${titleStyle} align-${escapeHtml(String(titleAlign))}">${escapeHtml(String(titleBloc))}</h${titleStyle}>`;
    }
    const listCls = `list${greyFilter ? ' grey_filter' : ''}${!iconType ? ' icon_type_jpg' : ''}`;
    const itemsHtml = logos.map(logo => {
      const logoObj = logo.logo || {};
      const imgUrl = typeof logoObj === 'string' ? logoObj : (logoObj.url || '');
      const link = logo.link || {};
      const linkUrl = typeof link === 'string' ? link : (link.url || '');
      const linkTarget = (typeof link === 'object' && link.target) ? link.target : '_self';
      const titre = logo.titre || '';
      const desc = logo.desc || '';
      const imgCls = `illus${!iconType ? ' icon_type_jpg' : ''}`;
      let inner = `<div class="illus-wrapper">${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="" class="${imgCls}">` : _noImagePlaceholderHtml}</div>`;
      if (titre || desc) {
        inner += `<div class="desc">${titre ? `<p class="title">${escapeHtml(titre)}</p>` : ''}${desc ? `<div class="txt editor"><p>${desc.replace(/\n/g, '<br>')}</p></div>` : ''}</div>`;
      }
      if (linkUrl) {
        inner = `<a href="${escapeHtml(linkUrl)}" class="link" target="${escapeHtml(linkTarget)}">${inner}</a>`;
      }
      return `<li class="item">${inner}</li>`;
    }).join('');
    // Ensure icons CSS is loaded
    const iconsLayout = moduleFieldSchema?.modules?.IconLogo?.layout || 'icons';
    if (!moduleTemplateCache[iconsLayout]) queueModuleTemplateLoad(iconsLayout);
    return `<div class="module module-icons ${extraCls.join(' ')}">${bgHtml}<div class="container">${titleHtml}${logos.length > 0 ? `<ul class="${listCls}">${itemsHtml}</ul>` : ''}</div></div>`;
  }
  // Contact — custom preview (Blade template uses @php blocks that JS engine strips)
  const _socialSvg = {
    instagram: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><path d="M7.64,25.92a9.47,9.47,0,0,1-3.16-.6,6.5,6.5,0,0,1-2.3-1.5,6.41,6.41,0,0,1-1.5-2.3,9.73,9.73,0,0,1-.6-3.16C0,17,0,16.52,0,13S0,9,.08,7.64a9.73,9.73,0,0,1,.6-3.16A6.66,6.66,0,0,1,4.48.68,9.73,9.73,0,0,1,7.64.08C9,0,9.48,0,13,0s4,0,5.36.08a9.78,9.78,0,0,1,3.16.6,6.66,6.66,0,0,1,3.8,3.8,10,10,0,0,1,.6,3.16C26,9,26,9.46,26,13s0,4-.08,5.36a9.52,9.52,0,0,1-.6,3.16,6.65,6.65,0,0,1-3.8,3.8,10,10,0,0,1-3.15.6C17,26,16.54,26,13,26S9,26,7.64,25.92Zm.11-23.5a7.15,7.15,0,0,0-2.42.45,4.09,4.09,0,0,0-1.49,1,4.07,4.07,0,0,0-1,1.5,7.34,7.34,0,0,0-.44,2.41C2.36,9.12,2.34,9.53,2.34,13s0,3.88.08,5.25a7.15,7.15,0,0,0,.45,2.42,4,4,0,0,0,1,1.49,4,4,0,0,0,1.49,1,7.15,7.15,0,0,0,2.42.45c1.36.07,1.77.08,5.25.08s3.89,0,5.25-.08a7.11,7.11,0,0,0,2.42-.45,4.26,4.26,0,0,0,2.46-2.46,7.15,7.15,0,0,0,.45-2.42c.07-1.36.08-1.77.08-5.25s0-3.89-.08-5.25a7.15,7.15,0,0,0-.45-2.42,4,4,0,0,0-1-1.49,4.11,4.11,0,0,0-1.49-1,7.4,7.4,0,0,0-2.42-.44c-1.37-.06-1.79-.08-5.25-.08s-3.88,0-5.25.08ZM6.32,13A6.68,6.68,0,1,1,13,19.67,6.68,6.68,0,0,1,6.32,13Zm2.35,0A4.33,4.33,0,1,0,13,8.67h0A4.33,4.33,0,0,0,8.67,13Zm9.71-6.94a1.56,1.56,0,1,1,1.56,1.56h0A1.56,1.56,0,0,1,18.38,6.06Z"/></svg>',
    facebook: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 25.73 25.74"><path d="M24.31,0H1.42A1.43,1.43,0,0,0,0,1.42H0V24.31a1.42,1.42,0,0,0,1.42,1.42H13.75v-10H10.4v-3.9h3.35V9c0-3.32,2-5.13,5-5.13a24.85,24.85,0,0,1,3,.15V7.51h-2c-1.61,0-1.93.76-1.93,1.89v2.48h3.86l-.5,3.9H17.75v10h6.56a1.42,1.42,0,0,0,1.42-1.42h0V1.42A1.42,1.42,0,0,0,24.31,0Z"/></svg>',
    threads: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><path d="M18.9,11.9c.1,0,.2.1.3.2,1.6.8,2.7,1.9,3.3,3.3.9,2,.9,5.2-1.6,7.8-2,2-4.3,2.8-7.7,2.9h0c-3.8,0-6.7-1.3-8.7-3.8-1.7-2.2-2.6-5.3-2.7-9.2h0c0-3.9.9-7,2.7-9.2C6.5,1.3,9.4,0,13.2,0h0c3.8,0,6.8,1.3,8.8,3.8,1,1.2,1.7,2.7,2.2,4.4l-2.2.6c-.4-1.4-1-2.6-1.7-3.5-1.6-1.9-4-2.9-7.1-3-3.1,0-5.4,1-6.9,2.9-1.4,1.8-2.2,4.4-2.2,7.8,0,3.3.8,6,2.2,7.8,1.5,1.9,3.9,2.9,6.9,2.9,2.8,0,4.6-.7,6.2-2.2,1.7-1.7,1.7-3.9,1.2-5.2-.3-.8-.9-1.4-1.7-1.9-.2,1.5-.6,2.6-1.3,3.5-.9,1.2-2.2,1.8-3.9,1.9-1.3,0-2.5-.2-3.5-.9-1.1-.7-1.8-1.9-1.9-3.2-.1-2.6,1.9-4.5,5.2-4.7,1.1,0,2.2,0,3.2.2-.1-.8-.4-1.4-.8-1.9-.5-.6-1.4-1-2.5-1h0c-.9,0-2.1.2-2.9,1.4l-1.9-1.3c1-1.6,2.7-2.4,4.8-2.4h0c3.4,0,5.4,2.1,5.6,5.8h0s0,0,0,0ZM10.4,15.6c0,1.4,1.5,2,3,1.9,1.4,0,3-.6,3.2-4-.7-.2-1.5-.2-2.4-.2s-.5,0-.8,0c-2.3.1-3.1,1.3-3,2.3h0s0,0,0,0Z"/></svg>',
    tiktok: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="26" viewBox="0 0 25.152 29.022"><path d="M22.02,6.207a6.609,6.609,0,0,1-.571-.333,8.033,8.033,0,0,1-1.467-1.247,6.921,6.921,0,0,1-1.653-3.412h.006A4.2,4.2,0,0,1,18.268,0H13.284V19.273c0,.259,0,.515-.011.767,0,.031,0,.06,0,.094a.206.206,0,0,1,0,.043v.011a4.232,4.232,0,0,1-2.129,3.359,4.159,4.159,0,0,1-2.062.544,4.232,4.232,0,0,1,0-8.464,4.164,4.164,0,0,1,1.294.2l.006-5.075A9.258,9.258,0,0,0,3.24,12.845a9.782,9.782,0,0,0-2.134,2.632,9.121,9.121,0,0,0-1.1,4.186,9.88,9.88,0,0,0,.535,3.309v.012a9.74,9.74,0,0,0,1.353,2.468,10.129,10.129,0,0,0,2.159,2.037v-.012l.012.012a9.326,9.326,0,0,0,5.088,1.532,9.007,9.007,0,0,0,3.776-.835A9.477,9.477,0,0,0,16,25.881,9.58,9.58,0,0,0,17.667,23.1a10.4,10.4,0,0,0,.6-3.176V9.7c.06.036.866.569.866.569A11.527,11.527,0,0,0,22.1,11.5a17.1,17.1,0,0,0,3.048.417V6.969a6.463,6.463,0,0,1-3.132-.762"/></svg>',
    linkedin: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"><path d="M22.224,24H1.77A1.753,1.753,0,0,1,0,22.268V1.731A1.753,1.753,0,0,1,1.77,0H22.224A1.756,1.756,0,0,1,24,1.731V22.268A1.756,1.756,0,0,1,22.224,24ZM9.353,9V20.451h3.555V14.786c0-1.454.254-2.941,2.134-2.941,1.85,0,1.85,1.755,1.85,3.036v5.571h3.559V14.17a7.2,7.2,0,0,0-.784-3.886,3.764,3.764,0,0,0-3.487-1.571,3.763,3.763,0,0,0-3.368,1.849h-.049V9Zm-5.8,0V20.451H7.118V9ZM5.339,3.3A2.065,2.065,0,1,0,7.4,5.368,2.068,2.068,0,0,0,5.339,3.3Z"/></svg>',
    twitter: '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="23" viewBox="0 0 25 22.6"><path d="M19.7,0h3.8l-8.4,9.6L25,22.6h-7.7l-6-7.9-6.9,7.9H0.5l8.9-10.2L0,0h7.9l5.5,7.2L19.7,0z M18.4,20.3h2.1L6.8,2.2H4.4 L18.4,20.3z"/></svg>',
    tripadvisor: '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="22" viewBox="0 0 39.932 25.64"><path d="M36.668,7.468l3.264-3.551H32.695a22.612,22.612,0,0,0-25.439,0H0L3.264,7.468a9.977,9.977,0,1,0,13.5,14.691l3.2,3.481,3.2-3.478A9.98,9.98,0,1,0,36.668,7.468M9.988,21.593a6.751,6.751,0,1,1,6.751-6.751,6.75,6.75,0,0,1-6.751,6.751m9.978-6.948c0-4.443-3.23-8.256-7.494-9.885a19.477,19.477,0,0,1,14.986,0C23.2,6.392,19.966,10.2,19.966,14.645m9.976,6.948a6.751,6.751,0,1,1,6.751-6.751,6.75,6.75,0,0,1-6.751,6.751m0-10.293a3.539,3.539,0,1,0,3.539,3.539A3.538,3.538,0,0,0,29.942,11.3M13.526,14.842A3.539,3.539,0,1,1,9.988,11.3a3.538,3.538,0,0,1,3.539,3.539"/></svg>',
    pinterest: '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 25.75 25.74"><path d="M12.87,0A12.87,12.87,0,0,0,8.18,24.85a12.34,12.34,0,0,1,0-3.69c.24-1,1.51-6.4,1.51-6.4a4.69,4.69,0,0,1-.38-1.91c0-1.79,1-3.13,2.32-3.13a1.61,1.61,0,0,1,1.64,1.6,1.7,1.7,0,0,1,0,.22,25.28,25.28,0,0,1-1.07,4.28,1.87,1.87,0,0,0,1.35,2.27,1.78,1.78,0,0,0,.56.06c2.29,0,4-2.41,4-5.89A5.09,5.09,0,0,0,13.27,7h-.46A5.58,5.58,0,0,0,7,12.34v.27a5,5,0,0,0,1,2.93.41.41,0,0,1,.09.37c-.1.41-.32,1.28-.36,1.46s-.19.28-.43.17c-1.61-.75-2.61-3.1-2.61-5,0-4.06,2.95-7.79,8.5-7.79,4.46,0,7.93,3.18,7.93,7.43,0,4.44-2.8,8-6.68,8a3.43,3.43,0,0,1-3-1.48s-.64,2.46-.8,3.06a14.14,14.14,0,0,1-1.6,3.38A12.87,12.87,0,1,0,16.69.58,12.73,12.73,0,0,0,12.87,0"/></svg>',
    youtube: '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="24" viewBox="0 0 40.402 28.283"><path d="M39.558,4.417A5.059,5.059,0,0,0,35.986.845C32.836,0,20.2,0,20.2,0S7.566,0,4.417.845A5.06,5.06,0,0,0,.845,4.417C0,7.566,0,14.142,0,14.142s0,6.575.845,9.725a5.06,5.06,0,0,0,3.572,3.572c3.15.845,15.784.845,15.784.845s12.635,0,15.784-.845a5.059,5.059,0,0,0,3.572-3.572c.845-3.15.845-9.725.845-9.725s0-6.575-.845-9.725M16.157,20.2V8.083l10.5,6.06Z"/></svg>',
  };
  if (block.type === 'contact' || block.type === 'Contact') {
    const addresses = Array.isArray(d.addresses) ? d.addresses : [];
    const isMapMode = d.is_map === true || d.is_map === 1 || d.is_map === '1';
    const contactExtraCls = [];
    if (d.bloc_color) contactExtraCls.push(d.bloc_color);
    if (d.padding_top) contactExtraCls.push(d.padding_top);
    if (d.padding_bottom) contactExtraCls.push(d.padding_bottom);
    let contactBgHtml = '';
    const contactBgImg = d.bg_img;
    if (contactBgImg) {
      const bgUrl = typeof contactBgImg === 'string' ? contactBgImg : (contactBgImg.url || '');
      const bgOpacity = (d.bg_opacity ?? 10) / 100;
      if (bgUrl) {
        contactBgHtml = `<div class="background" style="background-image: url(${escapeHtml(bgUrl)}); opacity: ${bgOpacity}; background-size: cover; background-position: center; position: absolute; inset: 0;"></div>`;
        contactExtraCls.push('has-background-image');
      }
    }
    let contactTitleHtml = '';
    const contactTitle = d.title_bloc || d.title || '';
    if (contactTitle) {
      const ts = d.title_style || 2;
      const ta = d.title_align || 'center';
      contactTitleHtml = `<h${ts} class="title-module title-section-${ts} align-${escapeHtml(String(ta))}">${escapeHtml(String(contactTitle))}</h${ts}>`;
    }
    const cMarkers = [];
    let cCenterLat = 0, cCenterLng = 0;
    const cItemsHtml = addresses.map(contact => {
      const addr = contact.address || {};
      const lat = parseFloat(addr.lat) || 0;
      const lng = parseFloat(addr.lng) || 0;
      if (lat && lng) { cMarkers.push([lng, lat]); cCenterLat += lat; cCenterLng += lng; }
      const streetNumber = addr.street_number || '';
      const streetName = addr.street_name || '';
      const postCode = addr.post_code || '';
      const city = addr.city || '';
      const addressName = addr.name || addr.address || '';
      const addressStreet = `${streetNumber} ${streetName}`.trim();
      const addressStreetShort = `${streetNumber} ${addr.street_name_short || ''}`.trim();
      const placeId = addr.place_id || '';
      const logoObj = contact.logo || {};
      const logoUrl = typeof logoObj === 'string' ? logoObj : (logoObj.url || '');
      let h = '';
      if (logoUrl) h += `<div class="logo-wrapper"><img src="${escapeHtml(logoUrl)}" alt="" class="logo"></div>`;
      if (contact.name) h += `<p class="title title-section-4">${escapeHtml(contact.name)}</p>`;
      if (lat) {
        h += '<address class="address">';
        if (addressName && addressName !== addressStreet && addressName !== addressStreetShort && !addressName.includes(addressStreet)) h += `${escapeHtml(addressName)}<br>`;
        if (streetName) h += `${escapeHtml(addressStreet)}<br>`;
        h += escapeHtml(`${postCode} ${city}`.trim());
        h += '</address>';
        if (addresses.length > 1 && placeId) h += `<a href="https://www.google.com/maps/place/?q=place_id:${escapeHtml(placeId)}" class="btn btn-tertiary" title="Itin\u00e9raire" target="_blank">Itin\u00e9raire</a>`;
      }
      if (contact.phone) h += `<p class="phone-wrapper">Tel. <a href="tel:${escapeHtml(String(contact.phone).replace(/\s/g, ''))}" class="phone">${escapeHtml(contact.phone)}</a></p>`;
      if (contact.mail) h += `<div class="mail-wrapper"><a href="mailto:${escapeHtml(contact.mail)}">${escapeHtml(contact.mail)}</a></div>`;
      if (contact.schedule) h += `<div class="editor txt"><p><b>Horaires d\u2019ouverture</b></p><p>${escapeHtml(contact.schedule).replace(/\n/g, '<br>')}</p></div>`;
      const socialKeys = ['instagram','facebook','threads','tiktok','linkedin','twitter','tripadvisor','pinterest','youtube'];
      const socials = socialKeys.filter(k => contact[k]);
      if (socials.length > 0) {
        h += '<ul class="social-networks">' + socials.map(k => {
          const ttl = k === 'twitter' ? 'X (Twitter)' : k.charAt(0).toUpperCase() + k.slice(1);
          const svgMarkup = _socialSvg[k] || '';
          return `<li class="item-social"><a href="${escapeHtml(contact[k])}" title="${ttl}" target="_blank" class="link"><span class="icon" aria-hidden="true">${svgMarkup}</span></a></li>`;
        }).join('') + '</ul>';
      }
      return `<li class="item">${h}</li>`;
    }).join('');
    if (cMarkers.length > 0) { cCenterLat /= cMarkers.length; cCenterLng /= cMarkers.length; }
    let col2Html = '';
    if (!isMapMode) {
      const photoObj = d.photo || {};
      const photoUrl = typeof photoObj === 'string' ? photoObj : (photoObj.url || '');
      col2Html = photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="" class="illus">` : _noImagePlaceholderHtml;
    } else if (cMarkers.length > 0) {
      const contactMapId = 'contact-map-preview-' + (block.id || Math.random().toString(36).slice(2));
      let gpsHtml = '';
      if (addresses.length === 1 && addresses[0]?.address?.place_id) {
        gpsHtml = `<a href="https://www.google.com/maps/place/?q=place_id:${escapeHtml(addresses[0].address.place_id)}" class="btn btn-primary" title="Itin\u00e9raire" target="_blank" style="position:absolute;z-index:99;top:97px;right:10px;">\ud83d\udccd</a>`;
      }
      col2Html = `<div class="map-wrapper js_show-content"><div id="${contactMapId}" class="map js_load-map" data-markers='${JSON.stringify(cMarkers)}' data-lng="${cCenterLng}" data-lat="${cCenterLat}">${gpsHtml}</div></div>`;
      setTimeout(async () => {
        const el = document.getElementById(contactMapId);
        if (!el || el.dataset.mapInit) return;
        el.dataset.mapInit = '1';
        await ensureMapboxGL();
        if (!window.mapboxgl) return;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        const map = new mapboxgl.Map({ container: el, style: 'mapbox://styles/mapbox/streets-v12', center: [cCenterLng, cCenterLat], zoom: 16, pitch: 50 });
        map.scrollZoom.disable();
        map.addControl(new mapboxgl.NavigationControl());
        cMarkers.forEach(coord => {
          const markerEl = document.createElement('div');
          const pin = document.createElement('div');
          pin.classList.add('container-pin');
          const img = document.createElement('div');
          img.classList.add('img-pin');
          img.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>';
          pin.append(img);
          markerEl.append(pin);
          markerEl.classList.add('marker');
          new mapboxgl.Marker(markerEl).setLngLat(coord).addTo(map);
        });
        const bounds = new mapboxgl.LngLatBounds();
        cMarkers.forEach(c => bounds.extend(c));
        map.fitBounds(bounds, { padding: 100 });
        if (cMarkers.length === 1) { map.on('load', () => { map.setZoom(17); map.setPitch(65); }); }
        map.on('load', () => map.resize());
        setTimeout(() => map.resize(), 300);
        setTimeout(() => map.resize(), 800);
      }, 100);
    }
    const contactLayout = moduleFieldSchema?.modules?.Contact?.layout || 'contact';
    if (!moduleTemplateCache[contactLayout]) queueModuleTemplateLoad(contactLayout);
    return `<div class="module module-contact ${contactExtraCls.join(' ')}" style="position:relative;">${contactBgHtml}<div class="container">${contactTitleHtml}<div class="cols-wrapper"><div class="col col-1">${addresses.length > 0 ? '<ul class="list">' + cItemsHtml + '</ul>' : ''}</div><div class="col col-2">${col2Html}</div></div></div></div>`;
  }
  // Map — custom preview (Blade template uses PHP assignment in @if which JS engine can't parse)
  if (block.type === 'map' || block.type === 'Map') {
    const address = d.address || null;
    const lat = address ? parseFloat(address.lat) : 0;
    const lng = address ? parseFloat(address.lng) : 0;
    const placeId = address?.place_id || '';
    const addrText = address?.address || '';
    const isFs = d.is_fullscreen === true || d.is_fullscreen === 1 || d.is_fullscreen === '1';
    const mapExtraCls = [];
    if (d.bloc_color) mapExtraCls.push(d.bloc_color);
    if (d.padding_top) mapExtraCls.push(d.padding_top);
    if (d.padding_bottom) mapExtraCls.push(d.padding_bottom);
    if (isFs) mapExtraCls.push('full-width');
    // Background image
    let mapBgHtml = '';
    const mapBgImg = d.bg_img;
    if (mapBgImg) {
      const bgUrl = typeof mapBgImg === 'string' ? mapBgImg : (mapBgImg.url || '');
      const bgOpacity = (d.bg_opacity ?? 10) / 100;
      if (bgUrl) {
        mapBgHtml = `<div class="background" style="background-image: url(${escapeHtml(bgUrl)}); opacity: ${bgOpacity}; background-size: cover; background-position: center; position: absolute; inset: 0;"></div>`;
        mapExtraCls.push('has-background-image');
      }
    }
    // Bloc title
    let mapTitleHtml = '';
    const mapTitle = d.title_bloc || d.title || '';
    if (mapTitle) {
      const ts = d.title_style || 4;
      const ta = d.title_align || 'center';
      mapTitleHtml = `<div class="container"><h${ts} class="title-module title-section-${ts} align-${escapeHtml(String(ta))}">${escapeHtml(String(mapTitle))}</h${ts}></div>`;
    }
    let mapContentHtml = '';
    const mapPreviewId = 'map-live-preview-' + (block.id || Math.random().toString(36).slice(2));
    if (lat && lng) {
      const gpsLink = placeId ? `<a href="https://www.google.com/maps/place/?q=place_id:${escapeHtml(placeId)}" title="Itinéraire" target="_blank" style="position:absolute;z-index:99;bottom:12px;left:12px;padding:6px 12px;background:var(--color-primary,#333);color:#fff;border:none;border-radius:4px;font-size:12px;text-decoration:none;display:flex;align-items:center;gap:4px;">📍 Itinéraire</a>` : '';
      const containerPad = isFs ? 'padding:0;' : '';
      mapContentHtml = `<div class="container-large container-1" style="${containerPad}"><div class="map-wrapper" style="position:relative;height:400px;background:#e5e3df;border-radius:${isFs ? '0' : 'var(--border-radius,8px)'};overflow:hidden;"><div id="${mapPreviewId}" class="map" style="position:absolute;inset:0;">${gpsLink}</div></div></div>`;
      // Initialize live Mapbox map in the preview after DOM insert
      setTimeout(async () => {
        const el = document.getElementById(mapPreviewId);
        if (!el || el.dataset.mapInit) return;
        el.dataset.mapInit = '1';
        await ensureMapboxGL();
        if (!window.mapboxgl) return;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        const map = new mapboxgl.Map({
          container: el,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [lng, lat],
          zoom: 16,
          pitch: 50,
        });
        map.scrollZoom.disable();
        map.addControl(new mapboxgl.NavigationControl());
        new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map);
        map.on('load', () => map.resize());
        setTimeout(() => map.resize(), 300);
        setTimeout(() => map.resize(), 800);
      }, 100);
    } else {
      mapContentHtml = `<div class="container"><p style="color:#999;text-align:center;padding:2em 0;">Aucune adresse configurée.</p></div>`;
    }
    // Ensure map CSS is loaded
    const mapLayout = moduleFieldSchema?.modules?.Map?.layout || 'map';
    if (!moduleTemplateCache[mapLayout]) queueModuleTemplateLoad(mapLayout);
    return `<div class="module module-map ${mapExtraCls.join(' ')}" style="position:relative;">${mapBgHtml}${mapTitleHtml}${mapContentHtml}</div>`;
  }
  // Form — custom preview (Blade uses gravity_form() PHP function which JS can't execute)
  if (block.type === 'form' || block.type === 'Form') {
    const formId = d.form_id;
    const formCls = [d.bloc_color || '', d.padding_top || '', d.padding_bottom || ''].filter(Boolean).join(' ');
    let formBgHtml = '';
    const formBgImg = d.bg_img;
    if (formBgImg) {
      const bgUrl = typeof formBgImg === 'string' ? formBgImg : (formBgImg.url || '');
      const bgOpacity = (d.bg_opacity ?? 10) / 100;
      if (bgUrl) {
        formBgHtml = `<div class="background" style="background-image: url(${escapeHtml(bgUrl)}); opacity: ${bgOpacity}; background-size: cover; background-position: center; position: absolute; inset: 0;"></div>`;
      }
    }
    let formTitleHtml = '';
    const formTitle = d.title_bloc || d.title || '';
    if (formTitle) {
      const ts = d.title_style || 2;
      const ta = d.title_align || 'center';
      formTitleHtml = `<h${ts} class="title-module title-section-${ts} align-${escapeHtml(String(ta))}">${escapeHtml(String(formTitle))}</h${ts}>`;
    }
    if (!formId) {
      return `<div class="module module-form ${escapeHtml(formCls)}" style="position:relative;">${formBgHtml}<div class="container">${formTitleHtml}<p style="text-align:center;opacity:0.5;">Aucun formulaire sélectionné.</p></div></div>`;
    }
    const formPreviewId = 'form-preview-' + (block.id || Math.random().toString(36).slice(2));
    setTimeout(async () => {
      const el = document.getElementById(formPreviewId);
      if (!el || el.dataset.loaded) return;
      el.dataset.loaded = '1';
      try {
        const formData = await apiFetch(`/forms/public/${formId}`);
        if (!formData || !formData.fields || formData.fields.length === 0) {
          el.innerHTML = '<p style="text-align:center;opacity:0.5;">Formulaire vide ou introuvable.</p>';
          return;
        }
        const submitText = formData.settings?.submit_text || 'Envoyer';
        const fieldsHtml = formData.fields.map(field => {
          const width = field.settings?.width || '100';
          const req = field.required;
          const reqStar = req ? '<span style="color:#e53e3e;margin-left:2px;">*</span>' : '';
          if (field.type === 'hidden') return '';
          if (field.type === 'html') {
            return `<div class="nickl-form-field nickl-form-field--html w-${escapeHtml(width)}">${field.settings?.html_content || ''}</div>`;
          }
          if (field.type === 'name') {
            const firstLabel = field.settings?.first_label || 'Prénom';
            const lastLabel = field.settings?.last_label || 'Nom';
            return `<div class="nickl-form-field nickl-form-field--name w-${escapeHtml(width)}"><div class="nickl-form-name-row"><div class="nickl-form-name-col"><div class="nickl-form-floating"><input type="text" class="nickl-form-input" placeholder=" " disabled><label class="nickl-form-label">${escapeHtml(firstLabel)}${reqStar}</label></div></div><div class="nickl-form-name-col"><div class="nickl-form-floating"><input type="text" class="nickl-form-input" placeholder=" " disabled><label class="nickl-form-label">${escapeHtml(lastLabel)}${reqStar}</label></div></div></div></div>`;
          }
          const isFloatable = ['text', 'email', 'phone', 'number', 'url', 'date', 'time', 'textarea'].includes(field.type);
          if (isFloatable) {
            const inputEl = field.type === 'textarea'
              ? `<textarea class="nickl-form-textarea" placeholder=" " rows="${field.settings?.rows || 4}" disabled></textarea>`
              : `<input type="${field.type === 'phone' ? 'tel' : escapeHtml(field.type)}" class="nickl-form-input" placeholder=" " disabled>`;
            return `<div class="nickl-form-field nickl-form-field--${escapeHtml(field.type)} w-${escapeHtml(width)}"><div class="nickl-form-floating">${inputEl}<label class="nickl-form-label">${escapeHtml(field.label)}${reqStar}</label></div></div>`;
          }
          if (field.type === 'select') {
            const opts = (field.options || []).map(opt => {
              const parts = opt.includes('|') ? opt.split('|') : [opt, opt];
              return `<option>${escapeHtml(parts[0])}</option>`;
            }).join('');
            return `<div class="nickl-form-field nickl-form-field--select w-${escapeHtml(width)}"><label class="nickl-form-label nickl-form-label--static">${escapeHtml(field.label)}${reqStar}</label><select class="nickl-form-select" disabled><option>${escapeHtml(field.placeholder || '— Choisir —')}</option>${opts}</select></div>`;
          }
          if (field.type === 'radio') {
            const opts = (field.options || []).map(opt => {
              const parts = opt.includes('|') ? opt.split('|') : [opt, opt];
              return `<label class="nickl-form-radio-label"><input type="radio" disabled><span>${escapeHtml(parts[0])}</span></label>`;
            }).join('');
            return `<div class="nickl-form-field nickl-form-field--radio w-${escapeHtml(width)}"><label class="nickl-form-label nickl-form-label--static">${escapeHtml(field.label)}${reqStar}</label><div class="nickl-form-radio-group">${opts}</div></div>`;
          }
          if (field.type === 'checkbox') {
            const opts = (field.options || []).map(opt => {
              const parts = opt.includes('|') ? opt.split('|') : [opt, opt];
              return `<label class="nickl-form-checkbox-label"><input type="checkbox" disabled><span>${escapeHtml(parts[0])}</span></label>`;
            }).join('');
            return `<div class="nickl-form-field nickl-form-field--checkbox w-${escapeHtml(width)}"><label class="nickl-form-label nickl-form-label--static">${escapeHtml(field.label)}${reqStar}</label><div class="nickl-form-checkbox-group">${opts}</div></div>`;
          }
          if (field.type === 'file') {
            return `<div class="nickl-form-field nickl-form-field--file w-${escapeHtml(width)}"><label class="nickl-form-label nickl-form-label--static">${escapeHtml(field.label)}${reqStar}</label><input type="file" class="nickl-form-input" disabled></div>`;
          }
          return `<div class="nickl-form-field w-${escapeHtml(width)}"><label class="nickl-form-label nickl-form-label--static">${escapeHtml(field.label)}${reqStar}</label><input type="text" class="nickl-form-input" placeholder=" " disabled></div>`;
        }).join('');
        el.innerHTML = `<form class="nickl-form" style="pointer-events:none;"><div class="nickl-form-fields">${fieldsHtml}</div><div class="nickl-form-submit"><button type="button" class="nickl-form-btn" disabled>${escapeHtml(submitText)}</button></div></form>`;
      } catch (e) {
        el.innerHTML = '<p style="text-align:center;color:red;">Erreur: ' + escapeHtml(e.message) + '</p>';
      }
    }, 50);
    return `<div class="module module-form ${escapeHtml(formCls)}" style="position:relative;">${formBgHtml}<div class="container">${formTitleHtml}<div id="${formPreviewId}"><p style="text-align:center;opacity:0.5;">Chargement du formulaire…</p></div></div></div>`;
  }
  // PlanSite — custom preview (Blade calls do_shortcode which JS can't process)
  if (block.type === 'plansite' || block.type === 'plan-site' || block.type === 'PlanSite') {
    const psCls = [d.bloc_color || '', d.padding_top || '', d.padding_bottom || ''].filter(Boolean).join(' ');
    let psTitleHtml = '';
    if (d.title_bloc || d.title) {
      const t = d.title_bloc || d.title;
      const s = d.title_style || '2';
      const a = d.title_align || 'center';
      psTitleHtml = `<h${s} class="title-module title-section-${s} align-${a}">${escapeHtml(t)}</h${s}>`;
    }
    if (!moduleTemplateCache['plansite']) queueModuleTemplateLoad('plansite');
    return `<div class="module module-plansite ${psCls}" style="position:relative;">` +
      `<div class="container">${psTitleHtml}` +
      `<div class="list">` +
      `<div class="item"><h2>Les pages</h2><ul><li style="color:#999;">Toutes les pages publiées…</li></ul></div>` +
      `<div class="item"><h2>Les articles</h2><ul><li style="color:#999;">Tous les articles publiés…</li></ul></div>` +
      `<div class="item"><h2>Références</h2><ul><li style="color:#999;">Toutes les références…</li></ul></div>` +
      `</div></div></div>`;
  }
  // Summary — custom preview (Blade uses wp_nav_menu which JS can't render)
  if (block.type === 'summary' || block.type === 'Summary') {
    const sumCls = [d.bloc_color || '', d.padding_top || '', d.padding_bottom || ''].filter(Boolean).join(' ');
    let sumTitleHtml = '';
    if (d.title_bloc || d.title) {
      const t = d.title_bloc || d.title;
      const s = d.title_style || '2';
      const a = d.title_align || 'center';
      sumTitleHtml = `<h${s} class="title-module title-section-${s} align-${a}">${escapeHtml(t)}</h${s}>`;
    }
    const useMenu = d.links_type === true || d.links_type === 1 || d.links_type === '1';
    let sumContent = '';
    if (useMenu && d.menu_id) {
      const sumMenuId = 'summary-menu-preview-' + (block.id || '');
      setTimeout(async () => {
        const el = document.getElementById(sumMenuId);
        if (!el) return;
        try {
          const items = await apiFetch(`/menus/${d.menu_id}/navigation`);
          if (!items || !items.length) { el.innerHTML = '<p style="color:#999">Menu vide</p>'; return; }
          el.innerHTML = '<ul class="menu">' + items.map(item => {
            const children = item.children || [];
            if (children.length) {
              return `<li class="menu-item sub"><p class="title">${escapeHtml(item.title)}</p><ul class="sub-menu">${children.map(c => `<li class="menu-item"><a href="#">${escapeHtml(c.title)}</a></li>`).join('')}</ul></li>`;
            }
            return `<li class="menu-item"><a href="#">${escapeHtml(item.title)}</a></li>`;
          }).join('') + '</ul>';
        } catch (e) { el.innerHTML = '<p style="color:#999">Erreur de chargement du menu</p>'; }
      }, 0);
      sumContent = `<div id="${sumMenuId}"><p style="color:#999">Chargement du menu…</p></div>`;
    } else if (useMenu) {
      sumContent = '<p style="color:#999">Aucun menu sélectionné</p>';
    } else {
      const customItems = Array.isArray(d.custom_menu) ? d.custom_menu : [];
      if (customItems.length) {
        sumContent = '<ul class="menu">' + customItems.map(item => {
          const links = Array.isArray(item.links) ? item.links : [];
          return `<li class="menu-item sub">${item.title ? `<p class="title">${escapeHtml(item.title)}</p>` : ''}${links.length ? '<ul class="sub-menu">' + links.map(l => {
            const lk = l.link || {};
            return `<li class="menu-item"><a href="#">${escapeHtml(lk.title || lk.url || '')}</a></li>`;
          }).join('') + '</ul>' : ''}</li>`;
        }).join('') + '</ul>';
      } else {
        sumContent = '<p style="color:#999">Aucun lien personnalisé</p>';
      }
    }
    if (!moduleTemplateCache['summary']) queueModuleTemplateLoad('summary');
    return `<div class="module module-summary ${sumCls}" style="position:relative;"><div class="container">${sumTitleHtml}${sumContent}</div></div>`;
  }
  // ReusableBloc — fetch bloc content and render sub-blocks
  if (block.type === 'reusable-bloc' || block.type === 'ReusableBloc') {
    const blocId = d.bloc_id;
    const rbPreviewId = 'rb-preview-' + (block.id || Math.random().toString(36).slice(2));
    if (!blocId) {
      return `<div class="module module-reusable-bloc" style="padding:40px 20px;text-align:center;opacity:0.5;">Aucun bloc réutilisable sélectionné</div>`;
    }
    setTimeout(async () => {
      const el = document.getElementById(rbPreviewId);
      if (!el) return;
      try {
        const bloc = await apiFetch(`/reusable-blocs/${blocId}`);
        if (!bloc || !bloc.content) {
          el.innerHTML = '<p style="text-align:center;opacity:0.5;">Bloc réutilisable vide</p>';
          return;
        }
        let subBlocks;
        try { subBlocks = typeof bloc.content === 'string' ? JSON.parse(bloc.content) : bloc.content; } catch (e) { subBlocks = []; }
        if (!Array.isArray(subBlocks) || subBlocks.length === 0) {
          el.innerHTML = '<p style="text-align:center;opacity:0.5;">Bloc réutilisable vide</p>';
          return;
        }
        let html = '';
        for (const sub of subBlocks) {
          try {
            const subHtml = replaceEmptyImages(renderBlockPreviewHtml(sub));
            if (subHtml) html += subHtml;
          } catch (e) { console.warn('ReusableBloc sub-block render error:', e); }
        }
        el.innerHTML = html || '<p style="text-align:center;opacity:0.5;">Aucun aperçu disponible</p>';
      } catch (e) {
        el.innerHTML = '<p style="text-align:center;color:red;">Erreur: ' + escapeHtml(e.message) + '</p>';
      }
    }, 50);
    return `<div class="module module-reusable-bloc"><div id="${rbPreviewId}"><p style="text-align:center;opacity:0.5;">Chargement du bloc réutilisable…</p></div></div>`;
  }
  // BlocReferences — live preview from server-side render
  if (block.type === 'bloc-references' || block.type === 'BlocReferences') {
    const refCls = [d.bloc_color || '', d.padding_top || '', d.padding_bottom || ''].filter(Boolean).join(' ');
    const refId = 'ref-preview-' + (block.id || Math.random().toString(36).slice(2));
    const refTitle = d.title_bloc || d.title || '';
    const refTitleStyle = d.title_style || '2';
    const refTitleAlign = d.title_align || 'center';
    const refTitleHtml = refTitle ? `<h${refTitleStyle} class="title-module title-section-${refTitleStyle} align-${escapeHtml(String(refTitleAlign))}">${escapeHtml(String(refTitle))}</h${refTitleStyle}>` : '';
    let refBgHtml = '';
    const refBgExtraCls = [];
    const refBgImg = d.bg_img;
    if (refBgImg) {
      const bgUrl = typeof refBgImg === 'string' ? refBgImg : (refBgImg.url || '');
      const bgOpacity = (d.bg_opacity ?? 10) / 100;
      if (bgUrl) {
        refBgHtml = `<div class="background" style="background-image: url(${escapeHtml(bgUrl)}); opacity: ${bgOpacity}; background-size: cover; background-position: center; position: absolute; inset: 0;"></div>`;
        refBgExtraCls.push('has-background-image');
      }
    }
    if (!moduleTemplateCache['references']) queueModuleTemplateLoad('references');
    setTimeout(async () => {
      const el = document.getElementById(refId);
      if (!el || el.dataset.loaded) return;
      el.dataset.loaded = '1';
      try {
        const res = await apiFetch('/render-block', { method: 'POST', body: JSON.stringify({ type: 'bloc-references', data: d }) });
        if (res.html) el.innerHTML = res.html;
        else el.innerHTML = '<p style="text-align:center;opacity:0.6;">Aucune référence à afficher</p>';
      } catch (e) {
        el.innerHTML = '<p style="text-align:center;color:red;">Erreur: ' + escapeHtml(e.message) + '</p>';
      }
    }, 50);
    return `<div class="module module-references ${escapeHtml(refCls)} ${refBgExtraCls.join(' ')}" style="position:relative;">${refBgHtml}<div class="container-large">${refTitleHtml}<div id="${refId}"><p style="text-align:center;opacity:0.5;">Chargement des références…</p></div></div></div>`;
  }
  // GoogleReviews — live preview from plugin API
  if (block.type === 'google-reviews' || block.type === 'GoogleReviews') {
    const grCls = [d.bloc_color || '', d.padding_top || '', d.padding_bottom || ''].filter(Boolean).join(' ');
    const grId = 'gr-preview-' + (block.id || Math.random().toString(36).slice(2));
    const grTitle = d.title_bloc || d.title || '';
    const grTitleStyle = d.title_style || '2';
    const grTitleAlign = d.title_align || 'center';
    const grTitleHtml = grTitle ? `<h${grTitleStyle} class="title-module title-section-${grTitleStyle} align-${escapeHtml(String(grTitleAlign))}">${escapeHtml(String(grTitle))}</h${grTitleStyle}>` : '';
    let grBgHtml = '';
    const grBgExtraCls = [];
    const grBgImg = d.bg_img;
    if (grBgImg) {
      const bgUrl = typeof grBgImg === 'string' ? grBgImg : (grBgImg.url || '');
      const bgOpacity = (d.bg_opacity ?? 10) / 100;
      if (bgUrl) {
        grBgHtml = `<div class="background" style="background-image: url(${escapeHtml(bgUrl)}); opacity: ${bgOpacity}; background-size: cover; background-position: center; position: absolute; inset: 0;"></div>`;
        grBgExtraCls.push('has-background-image');
      }
    }
    setTimeout(async () => {
      const el = document.getElementById(grId);
      if (!el || el.dataset.loaded) return;
      el.dataset.loaded = '1';
      try {
        const res = await apiFetch('/render-block', { method: 'POST', body: JSON.stringify({ type: 'google-reviews', data: d }) });
        if (res.html) el.innerHTML = res.html;
        else el.innerHTML = '<p style="text-align:center;opacity:0.6;">Aucun aperçu disponible</p>';
      } catch (e) {
        el.innerHTML = '<p style="text-align:center;color:red;">Erreur: ' + escapeHtml(e.message) + '</p>';
      }
    }, 50);
    return `<div class="module module-google-reviews ${escapeHtml(grCls)} ${grBgExtraCls.join(' ')}" style="position:relative;">${grBgHtml}<div class="container-large">${grTitleHtml}<div id="${grId}"><p style="text-align:center;opacity:0.5;">Chargement des avis Google…</p></div></div></div>`;
  }
  const layout = getModuleLayout(block);
  if (!layout) return '';
  const cached = moduleTemplateCache[layout];
  if (!cached) {
    queueModuleTemplateLoad(layout);
    return `<div class="preview-loading">Chargement du rendu…</div>`;
  }
  if (cached._error) {
    return `<div class="preview-loading" style="color:#c00;">Erreur : impossible de charger le template « ${escapeHtml(layout)} »</div>`;
  }
  let ctx, html;
  try {
    ctx = buildTemplateContext(block);
    html = renderBladeTemplate(cached.template, ctx);
  } catch (e) {
    console.error(`[PreviewRender] Error rendering block type="${block.type}" layout="${layout}":`, e);
    return `<div class="preview-loading" style="color:#c00;">Erreur de rendu (${escapeHtml(layout)}). Voir la console.</div>`;
  }
  // S'assurer que les classes calculées (bloc_color, padding_top, etc.)
  // sont bien appliquées au wrapper .module, même si l'expression Blade
  // originale n'est pas parfaitement interprétée par notre moteur.
  if (ctx.classes) {
    html = html.replace(/class="module([^"]*)"/, (match, rest) => {
      const existing = rest.trim();
      // éviter les doublons si les classes sont déjà présentes
      const toAdd = ctx.classes;
      return existing
        ? `class="module${rest} ${toAdd}"`
        : `class="module ${toAdd}"`;
    });
  }
  // Remplacer les &nbsp; par des espaces normaux pour permettre le retour
  // à la ligne naturel entre les mots dans la prévisualisation
  html = html.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');
  // Nettoyer les .txt.editor vides (supprimer le whitespace interne)
  // pour que le pseudo-élément CSS :empty::before affiche le placeholder
  html = html.replace(/<div class="txt editor">\s*<\/div>/g, '<div class="txt editor"></div>');
  return html;
}

function pickFirstString(data, keys) {
  for (const key of keys) {
    if (typeof data[key] === 'string' && data[key].trim()) return data[key].trim();
  }
  return '';
}

// Reverse map: layout slug → module class name (e.g. 'text' → 'TextSimple')
// Built lazily from moduleFieldSchema (declared near other module-level vars).

function getLayoutToModuleNameMap() {
  if (_layoutToModuleName) return _layoutToModuleName;
  _layoutToModuleName = {};
  if (moduleFieldSchema?.modules) {
    for (const [className, mod] of Object.entries(moduleFieldSchema.modules)) {
      if (mod.layout) _layoutToModuleName[mod.layout] = className;
    }
  }
  return _layoutToModuleName;
}

function getModuleLayout(block) {
  const def = BLOCK_TYPES[block.type] || {};
  const moduleName = def.moduleName || block.type;
  const mod = moduleFieldSchema?.modules?.[moduleName];
  if (mod?.layout) return mod.layout;
  // Fallback: block.type may be a layout slug (e.g. 'text' from acf_fc_layout
  // inside ColumnsTab). Resolve via reverse lookup.
  const map = getLayoutToModuleNameMap();
  if (map[block.type]) return block.type; // block.type IS the layout slug
  return null;
}

function queueModuleTemplateLoad(layout) {
  if (moduleTemplateCache[layout] || moduleTemplatePromises[layout]) return;
  moduleTemplatePromises[layout] = apiFetch(`/module-template?layout=${encodeURIComponent(layout)}`)
    .then((res) => {
      moduleTemplateCache[layout] = res;
      if (res?.cssUrl) ensureModuleStyles(layout, res.cssUrl);
      if (res?.adminCssUrl) ensureModuleAdminStyles(layout, res.adminCssUrl);
      updateAllPreviewsForLayout(layout);
    })
    .catch((err) => {
      console.error(`[ModuleTemplate] Failed to load layout "${layout}":`, err);
      // Store a minimal entry so the preview can show an error instead of
      // spinning on "Chargement du rendu…" forever.
      moduleTemplateCache[layout] = { template: '', cssUrl: null, adminCssUrl: null, _error: true };
      updateAllPreviewsForLayout(layout);
    })
    .finally(() => {
      delete moduleTemplatePromises[layout];
    });
}

function ensureModuleStyles(layout, cssUrl) {
  if (!cssUrl || moduleStylesLoaded.has(layout)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssUrl;
  link.dataset.moduleLayout = layout;
  document.head.appendChild(link);
  moduleStylesLoaded.add(layout);
}

const moduleAdminStylesLoaded = new Set();

function ensureModuleAdminStyles(layout, adminCssUrl) {
  if (!adminCssUrl || moduleAdminStylesLoaded.has(layout)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = adminCssUrl;
  link.dataset.moduleAdminLayout = layout;
  document.head.appendChild(link);
  moduleAdminStylesLoaded.add(layout);
}

function ensureBaseModuleStyles() {
  // Désormais, le CSS Nickl pour l'admin est chargé via nickl-app-admin.css dans index.html
  baseStylesLoaded = true;
}

function updateAllPreviewsForLayout(layout) {
  pageBuilderState.blocks.forEach((block) => {
    const blockLayout = getModuleLayout(block);
    if (blockLayout === layout) {
      updateBlockCardPreview(block.id);
      return;
    }
    // Also refresh ColumnsTab blocks — they may contain sub-modules of this layout
    if (block.type === 'columns-tab' || block.type === 'ColumnsTab') {
      updateBlockCardPreview(block.id);
    }
  });
}

function buildTemplateContext(block) {
  const raw = block.data && typeof block.data === 'object' ? block.data : {};
  // Certaines structures stockent les données réelles du module dans raw.module.
  // On fusionne les deux pour couvrir tous les cas possibles.
  const moduleData = raw.module && typeof raw.module === 'object' ? { ...raw.module, ...raw } : raw;
  const data = { ...moduleData, ...raw };
  const ctx = { ...data };
  ctx.module = moduleData;
  ctx.id = data.id_bloc || data.id || '';

  const extraClasses = [];
  // Couleur de fond du bloc : prise en charge de plusieurs clés possibles.
  const backgroundClass =
    data.bloc_color ||
    data.background ||
    moduleData.bloc_color ||
    moduleData.background ||
    '';
  if (backgroundClass) {
    extraClasses.push(backgroundClass);
    ctx.module = { ...ctx.module, bloc_color: backgroundClass };
  }
  const paddingTop = data.padding_top || moduleData.padding_top || '';
  const paddingBottom = data.padding_bottom || moduleData.padding_bottom || '';
  if (paddingTop) extraClasses.push(paddingTop);
  if (paddingBottom) extraClasses.push(paddingBottom);

  const baseClasses = data.classes || moduleData.classes || '';
  ctx.classes = [baseClasses, ...extraClasses].filter(Boolean).join(' ');
  const def = BLOCK_TYPES[block.type] || {};
  let moduleName = def.moduleName || block.type;
  // Fallback: block.type may be a layout slug (e.g. 'text' for TextSimple inside ColumnsTab)
  if (!moduleFieldSchema?.modules?.[moduleName]) {
    const map = getLayoutToModuleNameMap();
    if (map[block.type]) moduleName = map[block.type];
  }
  const schemaFields = moduleFieldSchema?.modules?.[moduleName]?.fields || [];
  schemaFields.forEach((field) => {
    if (!['Image', 'File', 'Video'].includes(field.type)) return;
    const current = ctx[field.name];
    if (typeof current === 'string' && current) {
      ctx[field.name] = { url: current, type: field.type === 'Video' ? 'video' : 'image' };
    }
  });
  if (data.title && !ctx.title_bloc) ctx.title_bloc = data.title;
  if (data.bg_img || data.backgroundImage) {
    const url = data.bg_img?.url || data.bg_img || data.backgroundImage?.url || '';
    let opacity = data.backgroundImage && typeof data.backgroundImage.opacity !== 'undefined'
      ? data.backgroundImage.opacity
      : null;
    if (opacity == null || opacity === '') {
      const raw = data.bg_opacity;
      if (raw !== undefined && raw !== null && raw !== '') {
        const num = Number(raw);
        if (Number.isFinite(num)) {
          opacity = num > 1 ? num / 100 : num;
        }
      }
    }
    if (opacity == null || opacity === '') {
      opacity = 0.1;
    }
    ctx.backgroundImage = { url, opacity };
    if (url) {
      // Reproduire la variable $background_image calculée dans le @php (strippé par le moteur JS)
      ctx.background_image = `background-image: url(${url})`;
      extraClasses.push('has-background-image');
      const parallax = data.bg_parallax === true || data.bg_parallax === 1 || data.bg_parallax === '1';
      if (parallax) extraClasses.push('background-parallax');
    }
  }
  if (data.cta && typeof data.cta === 'string') {
    ctx.cta = { url: data.cta, title: data.cta_title || data.cta };
  }
  if (block.type === 'hero' || block.type === 'Hero') {
    const isSlider = data.is_hero_banner_slider !== false
      && data.is_hero_banner_slider !== 0
      && data.is_hero_banner_slider !== '0';
    ctx.isSlider = isSlider;
    ctx.sliders = Array.isArray(data.hero_sliders) ? data.hero_sliders : [];
    ctx.blocks = [data.left_bloc, data.right_bloc].filter(Boolean);
    ctx.heroBgColor = data.bloc_color || '';
    ctx.seamlessMenu = false;
    ctx.number = data.id_bloc || 'section_0';
    // $fields est défini dans @php (strippé), on le reconstitue ici
    ctx.fields = {
      hero_banner_align:   data.hero_banner_align   || 'left',
      h1_in_header:        data.h1_in_header        || 'yes',
      hero_banner_height:  data.hero_banner_height  || false,
      hero_banner_marquise: data.hero_banner_marquise || false,
    };
  }
  if (block.type === 'banner' || block.type === 'Banner') {
    ctx.number = data.id_bloc || 'section_0';
    ctx.heightBanner = data.banner_height || 'small';
    ctx.titleInHeader = data.title_in_header !== 'hideTitle' ? 'showTitle' : 'hideTitle';
    ctx.h1InHeader = data.h1_in_header || 'yes';
    ctx.imgBanner = data.image?.url ? { url: data.image.url } : null;
    ctx.title = data.title || 'Titre de page';
    ctx.title_size = data.title_size || '';
    ctx.isWooCommercePage = false;
    ctx.term = null;
  }
  if (block.type === 'gallery' || block.type === 'Gallery') {
    const typeImg = data?.type_img || data?.options?.type_img || data?.options?.typeImg || 'img-fluid';
    const columns = data?.nbr_column || data?.options?.nbr_column || data?.options?.nbrColumn || 'columns-3';
    const styleChoice = data?.style_choice || 'style-1';
    extraClasses.push(styleChoice);
    ctx.options = {
      width: data['container-width'] === 'large' ? '-large' : '',
      nbr_column: columns,
      type_img: typeImg
    };
    ctx.indexPopin = data.indexPopin || block.id || 'gallery';
    if (typeImg === 'img-fluid') {
      ctx.sizes = 'module-gallery-fluid';
    } else if (typeImg === 'img-fixe' && columns === 'columns-1') {
      ctx.sizes = 'banner';
    } else {
      ctx.sizes = 'module-gallery-fixe';
    }
  }
  // IllusVideo : le View Composer PHP fournit $url et $ratio
  if (block.type === 'illus-video' || block.type === 'IllusVideo') {
    const vid = data.video || {};
    ctx.url = typeof vid === 'string' ? vid : (vid.url || '');
    const w = Number(vid.width) || 0;
    const h = Number(vid.height) || 0;
    ctx.ratio = h > 0 ? Math.floor(w / h) : 2;
  }
  // ClickableTiles : reproduire le View Composer PHP
  if (block.type === 'clickable-tiles' || block.type === 'ClickableTiles') {
    const listItems = Array.isArray(data.list_interlocking) ? data.list_interlocking : [];
    ctx.list_items = listItems;
    ctx.first_item = listItems.slice(0, 1);
    ctx.other_items = listItems.slice(1);
    ctx.interlocking_tiles = data.interlocking_tiles === true || data.interlocking_tiles === 1 || data.interlocking_tiles === '1';
    ctx.orientation = data.orientation === true || data.orientation === 1 || data.orientation === '1';
    ctx.clickable_block = data.clickable_block === true || data.clickable_block === 1 || data.clickable_block === '1';
    const mainRight = data['main-bloc-position'] === true || data['main-bloc-position'] === 1 || data['main-bloc-position'] === '1';
    if (mainRight) extraClasses.push('main-bloc-right');
    else extraClasses.push('main-bloc-left');
    const styleChoice = data.style_choice || 'style-1';
    extraClasses.push(styleChoice);
    ctx.module = { ...ctx.module, clickable_block: ctx.clickable_block };
  }
  // Separator : largeur divisée par 2 si texte présent + classe separator-with-text
  if (block.type === 'separator' || block.type === 'Separator') {
    const rawWidth = parseInt(data.width || moduleData.width || 100, 10);
    const hasText = !!(data.text || moduleData.text);
    ctx.width = hasText ? Math.floor(rawWidth / 2) : rawWidth;
    if (hasText) extraClasses.push('separator-with-text');
    ctx.module = { ...ctx.module, text: data.text || moduleData.text || '', style: data.style || moduleData.style || 'style-0', width: ctx.width };
  }
  // Quote : objet quote assemblé
  if (block.type === 'quote' || block.type === 'Quote') {
    ctx.quote = {
      photo: data.photo || moduleData.photo || null,
      quote: data.quote || moduleData.quote || '',
      name: data.name || moduleData.name || '',
      job: data.job || moduleData.job || ''
    };
  }
  // Ornament : largeur image en % de 1920px
  if (block.type === 'ornament' || block.type === 'Ornament') {
    const imgWidth = parseInt(data.img_width || moduleData.img_width || 0, 10);
    if (imgWidth > 0) {
      ctx.widthImage = Math.round(imgWidth * 100 / 1920 * 100) / 100;
    } else {
      const img = data.image || moduleData.image;
      const bannerWidth = img?.sizes?.['banner-width'] || img?.width || 0;
      ctx.widthImage = bannerWidth > 0 ? Math.round(bannerWidth * 100 / 1920 * 100) / 100 : 10;
    }
    ctx.module = { ...ctx.module, img_width: data.img_width || moduleData.img_width || '' };
  }
  // TextImage : placement, ratioImg, classes parallax + media_ratio, image, media_choice normalization
  if (block.type === 'text-image' || block.type === 'TextImage') {
    const imgToLeft = data.img_to_left === true || data.img_to_left === 1 || data.img_to_left === '1'
      || moduleData.img_to_left === true || moduleData.img_to_left === 1 || moduleData.img_to_left === '1';
    ctx.placement = imgToLeft ? 'img-left' : 'img-right';
    const ratio = data.media_ratio || moduleData.media_ratio || '';
    // full-height is kept as-is; CSS overrides in style.css (.builder-block-render
    // .module-text-image .cols-wrapper.full-height) neutralise 100vh / absolute
    // positioning and apply a tall aspect-ratio instead.
    const ratioMap = { landscape: 'banner', portrait: 'portrait', square: 'square-large' };
    ctx.ratioImg = ratioMap[ratio] || 'background-module';
    ctx.link_align = data.link_align || moduleData.link_align || '';
    ctx.link_style = data.link_style || moduleData.link_style || '';
    if (ratio) extraClasses.push(ratio);
    const imgParallax = data.img_parallax === true || data.img_parallax === 1 || data.img_parallax === '1';
    const mediaChoice = data.media_choice === true || data.media_choice === 1 || data.media_choice === '1';
    if (imgParallax && mediaChoice) extraClasses.push('img-parallax');
    // Normalize media_choice to numeric 1/0 so Blade @if ($module['media_choice'] == 1) works
    // (PHP loose comparison: true == 1 is true, but JS String(true) !== '1')
    ctx.module = { ...ctx.module, media_choice: mediaChoice ? 1 : 0, media_ratio: ratio };
    // Replicate the @php block that creates $img (stripped by the JS Blade engine)
    const imgData = data.image || moduleData.image || ctx.image;
    if (imgData) {
      const imgUrl = typeof imgData === 'string' ? imgData
        : (imgData?.sizes?.[ctx.ratioImg] || imgData?.sizes?.banner || imgData?.url || '');
      const imgAlt = typeof imgData === 'object' ? (imgData?.alt || '') : '';
      ctx.img = { url: imgUrl, alt: imgAlt };
    }
  }
  // TextScrolling : textes, taille, direction, vitesse
  if (block.type === 'text-scrolling' || block.type === 'TextScrolling') {
    ctx.texts = Array.isArray(data.texts || moduleData.texts) ? (data.texts || moduleData.texts) : [];
    ctx.text_size = data.text_size || moduleData.text_size || '';
    ctx.text_direction = data.text_direction || moduleData.text_direction || '';
    ctx.text_speed = data.text_speed || moduleData.text_speed || '';
  }
  // KeyFigures : liste des chiffres clés
  if (block.type === 'key-figures' || block.type === 'KeyFigures') {
    ctx.key_list = Array.isArray(data.key_list || moduleData.key_list) ? (data.key_list || moduleData.key_list) : [];
  }
  // Team : membres, format photos, alignement
  if (block.type === 'team' || block.type === 'Team') {
    ctx.team_members = Array.isArray(data.list || moduleData.list) ? (data.list || moduleData.list) : [];
    ctx.pictures_format = data.pictures_format || moduleData.pictures_format || 'portrait';
    ctx.align = data.align || moduleData.align || 'center';
  }
  // Video : image résolue, classe img-parallax
  if (block.type === 'video' || block.type === 'Video') {
    const imgData = data.image || moduleData.image || data.preview || moduleData.preview;
    const imgUrl = typeof imgData === 'string' ? imgData : (imgData?.url || imgData?.sizes?.['square-large'] || '');
    const imgAlt = typeof imgData === 'object' ? (imgData?.alt || '') : '';
    ctx.image = { src: imgUrl, alt: imgAlt };
    const imgParallax = data.img_parallax === true || data.img_parallax === 1 || data.img_parallax === '1';
    const mediaChoice = data.media_choice === true || data.media_choice === 1 || data.media_choice === '1';
    if (imgParallax && !mediaChoice) extraClasses.push('img-parallax');
  }
  // ColumnsTab : display, background, count
  if (block.type === 'columns-tab' || block.type === 'ColumnsTab') {
    ctx.id = data.id_bloc || data.id || '';
    ctx.display = data.columns_display || moduleData.columns_display || '';
    ctx.columnsBackground = data.columns_background || moduleData.columns_background || 'no-background';
    const colsList = Array.isArray(data.columns_list || moduleData.columns_list) ? (data.columns_list || moduleData.columns_list) : [];
    ctx.columnsCount = colsList.length;
    ctx.colsHaveBackground = ctx.columnsBackground !== 'no-background' ? 'cols_have_background' : '';
    if (ctx.colsHaveBackground) extraClasses.push(ctx.colsHaveBackground);
  }
  // SliderTextVideo : slider, h1_in_header
  if (block.type === 'text-video-slider' || block.type === 'SliderTextVideo') {
    ctx.slider = Array.isArray(data.slider || moduleData.slider) ? (data.slider || moduleData.slider) : [];
    ctx.h1_in_header = data.h1_in_header || moduleData.h1_in_header || '';
  }
  // ImagesSlider : images normalisées, full-width
  if (block.type === 'images-slider' || block.type === 'ImagesSlider') {
    const rawSliders = Array.isArray(data.sliders || moduleData.sliders) ? (data.sliders || moduleData.sliders) : [];
    ctx.images = rawSliders.map(function(slide) {
      const img = slide.image || {};
      const imgUrl = typeof img === 'string' ? img : (img.url || '');
      const imgAlt = typeof img === 'object' ? (img.alt || '') : '';
      const link1 = slide.link || {};
      const link2 = slide.link_2 || null;
      const link1Url = typeof link1 === 'string' ? link1 : (link1.url || '');
      return {
        image_url: imgUrl,
        image_alt: imgAlt,
        legend: slide.legend || '',
        text: slide.text || '',
        has_desc: !!(slide.legend || slide.text || link1Url),
        link_url: link1Url,
        link_title: typeof link1 === 'string' ? link1 : (link1.title || ''),
        link_target: typeof link1 === 'object' ? (link1.target || '_self') : '_self',
        link2: link2
      };
    });
    const isFullscreen = data.is_fullscreen === true || data.is_fullscreen === 1 || data.is_fullscreen === '1';
    if (isFullscreen) extraClasses.push('full-width');
  }
  // HeadText : text, h1_in_header, nbr_column class
  if (block.type === 'head-text' || block.type === 'HeadText') {
    ctx.text = data.text || moduleData.text || '';
    ctx.h1_in_header = data.h1_in_header || moduleData.h1_in_header || '';
    const nbrColumn = data.nbr_column || moduleData.nbr_column || '';
    if (nbrColumn) extraClasses.push(nbrColumn);
    const bgParallax = data.bg_parallax === true || data.bg_parallax === 1 || data.bg_parallax === '1';
    if (bgParallax && !extraClasses.includes('background-parallax')) extraClasses.push('background-parallax');
  }
  // Contact : content (full module), is_map, main-bloc-position
  if (block.type === 'contact' || block.type === 'Contact') {
    ctx.content = { ...moduleData };
    ctx.is_map = data.is_map === true || data.is_map === 1 || data.is_map === '1'
      || moduleData.is_map === true || moduleData.is_map === 1 || moduleData.is_map === '1';
    const mainRight = data['main-bloc-position'] === true || data['main-bloc-position'] === 1 || data['main-bloc-position'] === '1';
    if (mainRight) extraClasses.push('main-bloc-right');
    else extraClasses.push('main-bloc-left');
  }
  // Files : files, files_preview, main-bloc-position
  if (block.type === 'files' || block.type === 'Files') {
    ctx.files = Array.isArray(data.files || moduleData.files) ? (data.files || moduleData.files) : [];
    ctx.files_preview = data.files_preview || moduleData.files_preview || '';
    const mainRight = data['main-bloc-position'] === true || data['main-bloc-position'] === 1 || data['main-bloc-position'] === '1';
    if (mainRight) extraClasses.push('main-bloc-right');
    else extraClasses.push('main-bloc-left');
  }
  // LogosSlider : indexPopin
  if (block.type === 'logos-slider' || block.type === 'LogosSlider' || block.type === 'slider-logo' || block.type === 'SliderLogo') {
    ctx.indexPopin = Math.floor(Math.random() * 1000);
    delete ctx.columns;
  }
  // ImagesVideosParallax : blocs
  if (block.type === 'images-videos-parallax' || block.type === 'ImagesVideosParallax') {
    ctx.blocs = Array.isArray(data.blocs || moduleData.blocs) ? (data.blocs || moduleData.blocs) : [];
  }
  // Reconstruire ctx.classes avec tous les extraClasses ajoutés (y compris par les blocs spécifiques)
  const baseClasses2 = data.classes || moduleData.classes || '';
  ctx.classes = [baseClasses2, ...extraClasses].filter(Boolean).join(' ');
  return ctx;
}

function renderBladeTemplate(template, ctx) {
  let html = String(template || '');
  html = html.replace(/@php[\s\S]*?@endphp/g, '');
  html = html.replace(/<\?php[\s\S]*?\?>/g, '');
  html = html.replace(/<\?(?!xml)[\s\S]*?\?>/g, '');
  html = html.replace(/<\?=[\s\S]*?\?>/g, '');
  html = html.replace(/{{--[\s\S]*?--}}/g, '');
  html = html.replace(/@include\(\s*['"]components\.bloc-title-module['"][\s\S]*?\)/g, () => renderBlocTitle(ctx));
  html = renderForLoops(html, ctx);
  html = renderForeach(html, ctx);
  html = renderIfBlocks(html, ctx);
  html = renderSwitchBlocks(html, ctx);
  html = html.replace(/@include\(\s*['"]components\.clickable-item['"][^)]*\)/g, () => renderClickableItem(ctx));
  html = html.replace(/@includeIf\([\s\S]*?\)/g, '');
  html = html.replace(/@include\([\s\S]*?\)/g, '');
  html = html.replace(/@endphp/g, '');
  html = html.replace(/\{!!\s*([^}]+)\s*!!\}/g, (_, expr) => resolveExpression(expr, ctx, true));
  html = html.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expr) => resolveExpression(expr, ctx, false));
  html = html.replace(/@\w+\b/g, '');
  return html;
}

function renderBlocTitle(ctx) {
  const title = ctx.title_bloc || ctx.title || '';
  if (!title) return '';
  const level = ctx.title_style || 2;
  const align = ctx.title_align || 'center';
  const safeTitle = escapeHtml(String(title));
  return `<h${level} class="title-module title-section-${level} align-${escapeHtml(String(align))}">${safeTitle}</h${level}>`;
}

function renderClickableItem(ctx) {
  const item = ctx.item || {};
  const mod = ctx.module || {};
  const clickableBlock = mod.clickable_block || ctx.clickable_block || false;
  const orientation = ctx.orientation ?? false;
  const file = item.file || {};
  const fileUrl = typeof file === 'string' ? file : (file.url || '');
  const mime = file.mime_type || file.type || '';
  const isVid = mime.startsWith('video/') || /\.(mp4|mov|mpeg|mpg)$/i.test(fileUrl);
  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(fileUrl);
  const title = item.title || '';
  const catchphrase = item.catchphrase || '';
  const primaryLink = item.primary_link || {};
  const secondaryLink = item.secondary_link || {};
  const hasDescription = !!(title || catchphrase || (!clickableBlock && (primaryLink.url || secondaryLink.url)));
  const descClass = hasDescription ? 'has-desc' : 'no-desc';
  const orientClass = !orientation ? ' landscape' : '';

  let mediaHtml = '';
  if (isPdf && fileUrl) {
    mediaHtml = `<div class="illus-wrapper" style="display:flex;align-items:center;justify-content:center;background:#f8f9fa;min-height:120px;"><a href="${escapeHtml(fileUrl)}" target="_blank" style="display:flex;flex-direction:column;align-items:center;gap:8px;text-decoration:none;color:#333;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg><span style="font-size:12px;">Visualiser</span></a></div>`;
  } else if (isVid && fileUrl) {
    mediaHtml = `<div class="video-wrapper"><video class="background-video" autoplay loop muted playsinline><source src="${escapeHtml(fileUrl)}" type="video/mp4"></video></div>`;
  } else if (fileUrl) {
    mediaHtml = `<div class="illus-wrapper"><img src="${escapeHtml(fileUrl)}" alt="" class="illus"></div>`;
  }

  let descHtml = '';
  if (hasDescription) {
    let inner = '';
    if (title) inner += `<h3 class="title">${escapeHtml(title)}</h3>`;
    if (catchphrase) inner += `<div class="editor txt"><p>${escapeHtml(catchphrase)}</p></div>`;
    if (!clickableBlock && (primaryLink.url || secondaryLink.url)) {
      let btns = '';
      if (primaryLink.url) btns += `<a href="${escapeHtml(primaryLink.url)}" class="btn btn-primary" target="${escapeHtml(primaryLink.target || '_self')}">${escapeHtml(primaryLink.title || '')}</a>`;
      if (secondaryLink.url) btns += `<a href="${escapeHtml(secondaryLink.url)}" class="btn btn-secondary" target="${escapeHtml(secondaryLink.target || '_self')}">${escapeHtml(secondaryLink.title || '')}</a>`;
      inner += `<div class="btn-wrapper">${btns}</div>`;
    }
    descHtml = `<div class="desc">${inner}</div>`;
  }

  const contentInner = mediaHtml + descHtml;
  let contentHtml;
  if (clickableBlock && primaryLink.url) {
    contentHtml = `<a href="${escapeHtml(primaryLink.url)}" class="item-content" target="${escapeHtml(primaryLink.target || '_self')}" rel="bookmark">${contentInner}</a>`;
  } else {
    contentHtml = `<div class="item-content">${contentInner}</div>`;
  }

  return `<div class="item ${descClass}${orientClass}" role="article">${contentHtml}</div>`;
}

function findMatchingEndfor(source, startIndex) {
  let depth = 0;
  let i = startIndex;
  while (i < source.length) {
    // Find next @for that is NOT @foreach/@forelse (char after @for must be '(' or whitespace)
    let nextFor = -1;
    let sf = i;
    while (true) {
      const pos = source.indexOf('@for', sf);
      if (pos === -1) break;
      const ch = source[pos + 4] || '';
      if (ch === '(' || ch === ' ') { nextFor = pos; break; }
      sf = pos + 4;
    }
    // Find next @endfor that is NOT @endforeach/@endforelse (char after @endfor must not be a letter)
    let nextEnd = -1;
    sf = i;
    while (true) {
      const pos = source.indexOf('@endfor', sf);
      if (pos === -1) break;
      const ch = source[pos + 7] || '';
      if (!/[a-zA-Z]/.test(ch)) { nextEnd = pos; break; }
      sf = pos + 7;
    }
    if (nextEnd === -1) return -1;
    if (nextFor !== -1 && nextFor < nextEnd) {
      depth++;
      i = nextFor + 4;
      continue;
    }
    if (depth === 0) return nextEnd;
    depth--;
    i = nextEnd + 7;
  }
  return -1;
}

function renderForLoops(input, ctx) {
  // Handles @for($i = 0; $i < N; $i++) ... @endfor
  const headerRegex = /@for\s*\(\s*\$([A-Za-z0-9_]+)\s*=\s*(\d+)\s*;\s*\$\1\s*<\s*(\d+)\s*;\s*\$\1\+\+\s*\)/;
  let html = input;
  let safety = 0;
  while (safety++ < 50) {
    const headerMatch = headerRegex.exec(html);
    if (!headerMatch) break;
    const start = headerMatch.index;
    const bodyStart = start + headerMatch[0].length;
    const endIndex = findMatchingEndfor(html, bodyStart);
    if (endIndex === -1) break;
    const initVal = parseInt(headerMatch[2], 10);
    const limitVal = parseInt(headerMatch[3], 10);
    const body = html.slice(bodyStart, endIndex);
    let rendered = '';
    for (let idx = initVal; idx < limitVal; idx++) {
      rendered += renderBladeTemplate(body, { ...ctx });
    }
    html = html.slice(0, start) + rendered + html.slice(endIndex + 7); // '@endfor'.length = 7
  }
  return html;
}

function findMatchingEndforeach(source, startIndex) {
  let depth = 0;
  let i = startIndex;
  while (i < source.length) {
    const nextForeach = source.indexOf('@foreach', i);
    const nextEnd = source.indexOf('@endforeach', i);
    if (nextEnd === -1) return -1;
    if (nextForeach !== -1 && nextForeach < nextEnd) {
      depth++;
      i = nextForeach + 8; // '@foreach'.length
      continue;
    }
    if (depth === 0) return nextEnd;
    depth--;
    i = nextEnd + 11; // '@endforeach'.length
  }
  return -1;
}

function renderForeach(input, ctx) {
  const headerRegex = /@foreach\s*\(\s*([^)]+?)\s+as\s+\$([A-Za-z0-9_]+)(?:\s*=>\s*\$([A-Za-z0-9_]+))?\s*\)/;
  let html = input;
  let safety = 0;
  while (safety++ < 200) {
    const headerMatch = headerRegex.exec(html);
    if (!headerMatch) break;
    const start = headerMatch.index;
    const bodyStart = start + headerMatch[0].length;
    const endIndex = findMatchingEndforeach(html, bodyStart);
    if (endIndex === -1) break;
    const listExpr = headerMatch[1];
    const firstVar = headerMatch[2];
    const secondVar = headerMatch[3];
    const body = html.slice(bodyStart, endIndex);
    const list = resolveValue(listExpr, ctx);
    if (!Array.isArray(list) || list.length === 0) {
      html = html.slice(0, start) + html.slice(endIndex + 11);
      continue;
    }
    const rendered = list.map((item, index) => {
      const nestedCtx = { ...ctx };
      if (secondVar) {
        nestedCtx[firstVar] = index;
        nestedCtx[secondVar] = item;
      } else {
        nestedCtx[firstVar] = item;
      }
      return renderBladeTemplate(body, nestedCtx);
    }).join('');
    html = html.slice(0, start) + rendered + html.slice(endIndex + 11);
  }
  return html;
}

function renderIfBlocks(input, ctx) {
  let html = input;
  let i = 0;
  while (i < html.length) {
    const start = html.indexOf('@if', i);
    if (start === -1) break;
    html = html.slice(0, start) + processIfBlock(html.slice(start), ctx);
    i = start + 1;
  }
  return html;
}

function renderSwitchBlocks(input, ctx) {
  let html = input;
  let i = 0;
  while (i < html.length) {
    const start = html.indexOf('@switch', i);
    if (start === -1) break;
    const openParen = html.indexOf('(', start);
    if (openParen === -1) break;
    const exprResult = readParenExpr(html, openParen);
    if (!exprResult) break;
    const { expr, end: exprEnd } = exprResult;
    const bodyStart = exprEnd + 1;
    const endIndex = findMatchingEndswitch(html, bodyStart);
    if (endIndex === -1) break;
    const body = html.slice(bodyStart, endIndex);
    const rendered = processSwitchBody(body, expr, ctx);
    html = html.slice(0, start) + rendered + html.slice(endIndex + '@endswitch'.length);
    i = start + rendered.length;
  }
  return html;
}

function findMatchingEndswitch(fragment, startIndex) {
  let depth = 1;
  let i = startIndex;
  while (i < fragment.length) {
    const nextSwitch = fragment.indexOf('@switch', i);
    const nextEnd = fragment.indexOf('@endswitch', i);
    if (nextEnd === -1) return -1;
    if (nextSwitch !== -1 && nextSwitch < nextEnd) {
      depth += 1;
      i = nextSwitch + 7;
      continue;
    }
    depth -= 1;
    if (depth === 0) return nextEnd;
    i = nextEnd + 10;
  }
  return -1;
}

function processSwitchBody(body, expr, ctx) {
  const switchValue = resolveValue(expr, ctx);
  const caseRegex = /@case\s*\(([\s\S]*?)\)|@default/g;
  const matches = [];
  let match;
  while ((match = caseRegex.exec(body)) !== null) {
    matches.push({
      type: match[0].startsWith('@default') ? 'default' : 'case',
      expr: match[1],
      index: match.index,
      end: match.index + match[0].length
    });
  }
  if (matches.length === 0) return body.replace(/@break\b/g, '');
  let defaultContent = '';
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const content = body.slice(current.end, next ? next.index : body.length).replace(/@break\b/g, '');
    if (current.type === 'default') {
      defaultContent = content;
      continue;
    }
    const caseValue = resolveValue(current.expr, ctx);
    if (String(caseValue) === String(switchValue)) {
      return content;
    }
  }
  return defaultContent;
}

function processIfBlock(fragment, ctx) {
  if (!fragment.startsWith('@if')) return fragment;
  const openParen = fragment.indexOf('(');
  if (openParen === -1) return fragment;
  const condResult = readParenExpr(fragment, openParen);
  if (!condResult) return fragment;
  const { expr: cond, end: condEnd } = condResult;
  const bodyStart = condEnd + 1;
  const endifIndex = findMatchingEndif(fragment, bodyStart);
  if (endifIndex === -1) return fragment;
  const body = fragment.slice(bodyStart, endifIndex);
  const { contents, conditions, elseContent } = splitIfBranches(body);
  let chosen = '';
  if (evaluateCondition(cond, ctx)) {
    chosen = contents[0] || '';
  } else {
    let applied = false;
    for (let idx = 0; idx < conditions.length; idx++) {
      if (evaluateCondition(conditions[idx], ctx)) {
        chosen = contents[idx + 1] || '';
        applied = true;
        break;
      }
    }
    if (!applied && elseContent != null) {
      chosen = elseContent;
    }
  }
  return chosen + fragment.slice(endifIndex + '@endif'.length);
}

function readParenExpr(source, openIndex) {
  if (source[openIndex] !== '(') return null;
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(') depth += 1;
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        return { expr: source.slice(openIndex + 1, i), end: i };
      }
    }
  }
  return null;
}

function findMatchingEndif(source, startIndex) {
  let idx = startIndex;
  let depth = 0;
  while (idx < source.length) {
    const nextIf = source.indexOf('@if', idx);
    const nextEndif = source.indexOf('@endif', idx);
    if (nextEndif === -1) return -1;
    if (nextIf !== -1 && nextIf < nextEndif) {
      depth += 1;
      idx = nextIf + 3;
      continue;
    }
    if (depth === 0) return nextEndif;
    depth -= 1;
    idx = nextEndif + 6;
  }
  return -1;
}

function splitIfBranches(body) {
  const contents = [];
  const conditions = [];
  let elseContent = null;
  let current = '';
  let i = 0;
  let nested = 0;
  while (i < body.length) {
    if (body.startsWith('@if', i)) {
      nested += 1;
      current += '@if';
      i += 3;
      continue;
    }
    if (body.startsWith('@endif', i)) {
      nested = Math.max(0, nested - 1);
      current += '@endif';
      i += 6;
      continue;
    }
    if (nested === 0 && body.startsWith('@elseif', i)) {
      contents.push(current);
      current = '';
      const open = body.indexOf('(', i + 7);
      if (open === -1) {
        i += 7;
        continue;
      }
      const exprResult = readParenExpr(body, open);
      if (!exprResult) {
        i += 7;
        continue;
      }
      conditions.push(exprResult.expr);
      i = exprResult.end + 1;
      continue;
    }
    if (nested === 0 && body.startsWith('@else', i)) {
      contents.push(current);
      current = '';
      elseContent = '';
      i += 5;
      continue;
    }
    current += body[i];
    i += 1;
  }
  if (elseContent != null) {
    elseContent = current;
  } else {
    contents.push(current);
  }
  return { contents, conditions, elseContent };
}

function evaluateCondition(cond, ctx) {
  const raw = String(cond || '').trim();
  if (!raw) return false;
  const orParts = raw.split('||').map(p => p.trim()).filter(Boolean);
  if (orParts.length > 1) return orParts.some(p => evaluateCondition(p, ctx));
  const andParts = raw.split('&&').map(p => p.trim()).filter(Boolean);
  if (andParts.length > 1) return andParts.every(p => evaluateCondition(p, ctx));

  const negated = raw.startsWith('!');
  const expr = negated ? raw.slice(1).trim() : raw;

  let result = false;
  const emptyMatch = expr.match(/^empty\(\s*(.+)\s*\)$/);
  const notEmptyMatch = expr.match(/^!empty\(\s*(.+)\s*\)$/);
  const issetMatch = expr.match(/^isset\(\s*(.+)\s*\)$/);
  const notIssetMatch = expr.match(/^!isset\(\s*(.+)\s*\)$/);
  const equalityMatch = expr.match(/(.+?)(===|!==|==|!=|>=|<=|>|<)\s*(['"].*?['"]|\$[\w\[\]'".->]+|\d+|true|false|null)/);

  if (notEmptyMatch) {
    const value = resolveValue(notEmptyMatch[1], ctx);
    result = !isEmpty(value);
  } else if (emptyMatch) {
    const value = resolveValue(emptyMatch[1], ctx);
    result = isEmpty(value);
  } else if (notIssetMatch) {
    const value = resolveValue(notIssetMatch[1], ctx);
    result = value === undefined || value === null;
  } else if (issetMatch) {
    const value = resolveValue(issetMatch[1], ctx);
    result = value !== undefined && value !== null;
  } else if (equalityMatch) {
    const left = resolveValue(equalityMatch[1], ctx);
    const rightRaw = equalityMatch[3].trim();
    const right = rightRaw === 'false' ? false : rightRaw === 'true' ? true : rightRaw === 'null' ? null : resolveValue(rightRaw, ctx);
    const op = equalityMatch[2];
    if (op === '===') result = left === right;
    else if (op === '==') result = left == right;
    else if (op === '!==') result = left !== right;
    else if (op === '!=') result = left != right;
    else if (op === '>') result = Number(left) > Number(right);
    else if (op === '>=') result = Number(left) >= Number(right);
    else if (op === '<') result = Number(left) < Number(right);
    else if (op === '<=') result = Number(left) <= Number(right);
  } else {
    const value = resolveValue(expr, ctx);
    result = !!value;
  }

  return negated ? !result : result;
}

function resolveExpression(expr, ctx, allowHtml) {
  const cleaned = String(expr).trim();
  const bgMatch = cleaned.match(/^GlobalHelper::displayBackground\((.+)\)$/);
  if (bgMatch) {
    const firstArg = bgMatch[1].split(',')[0].trim();
    const url = resolveValue(firstArg, ctx);
    if (!url) return '';
    return `background-image: url(${url})`;
  }
  // str_replace — resolve the last argument and apply string replacements
  const strReplaceMatch = cleaned.match(/^str_replace\(\s*\[([^\]]*)\]\s*,\s*(['"][^'"]*['"])\s*,\s*(.+)\)$/);
  if (strReplaceMatch) {
    const needles = strReplaceMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    const replacement = strReplaceMatch[2].replace(/^['"]|['"]$/g, '');
    let val = resolveValue(strReplaceMatch[3].trim(), ctx);
    if (val == null) return '';
    val = String(val);
    needles.forEach(n => { val = val.replaceAll(n, replacement); });
    return allowHtml ? val : escapeHtml(val);
  }
  // nl2br — resolve inner expression (supports nesting like nl2br(e($var))) and convert newlines to <br>
  const nl2brMatch = cleaned.match(/^nl2br\((.+)\)$/);
  if (nl2brMatch) {
    const val = resolveExpression(nl2brMatch[1].trim(), ctx, true);
    if (!val) return '';
    const out = String(val).replace(/\n/g, '<br>');
    return allowHtml ? out : escapeHtml(out);
  }
  const ternaryMatch = cleaned.match(/(.+)\?(.+):(.+)/);
  if (ternaryMatch) {
    const cond = ternaryMatch[1].trim();
    const truthy = ternaryMatch[2].trim();
    const falsy = ternaryMatch[3].trim();
    const chosen = evaluateCondition(cond, ctx) ? truthy : falsy;
    return resolveExpression(chosen, ctx, allowHtml);
  }
  // PHP string concatenation with '.'
  if (/\s\.\s/.test(cleaned)) {
    const parts = cleaned.split(/\s\.\s/).map(p => resolveExpression(p.trim(), ctx, true));
    const output = parts.join('');
    return allowHtml ? output : escapeHtml(output);
  }
  const funcMatch = cleaned.match(/^(e|esc_url)\((.+)\)$/);
  const value = funcMatch ? resolveValue(funcMatch[2], ctx) : resolveValue(cleaned, ctx);
  const output = value == null ? '' : String(value);
  return allowHtml ? output : escapeHtml(output);
}

function resolveValue(expr, ctx) {
  const value = String(expr).trim();
  if (/Cookie(?:Helper)?::isCookieAccepted\s*\(/.test(value)) return true;
  const pllMatch = value.match(/^bcn_pll\((.+)\)$/);
  if (pllMatch) return resolveValue(pllMatch[1], ctx);
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1);
  }
  if (/^\d+$/.test(value)) return Number(value);
  // null coalescing (??) — PHP $a ?? $b returns $a if not null/undefined, else $b
  if (value.includes('??')) {
    const parts = value.split(/\s*\?\?\s*/);
    if (parts.length > 1) {
      for (const part of parts) {
        const v = resolveValue(part, ctx);
        if (v !== undefined && v !== null) return v;
      }
      return undefined;
    }
  }
  // count($var) → array length
  const countMatch = value.match(/^count\(\s*(.+?)\s*\)$/);
  if (countMatch) {
    const arr = resolveValue(countMatch[1], ctx);
    return Array.isArray(arr) ? arr.length : 0;
  }
  // array_slice($var, start, length)
  const sliceMatch = value.match(/^array_slice\(\s*(.+?)\s*,\s*(\d+)\s*(?:,\s*(\d+))?\s*\)$/);
  if (sliceMatch) {
    const arr = resolveValue(sliceMatch[1], ctx);
    if (!Array.isArray(arr)) return [];
    const start = Number(sliceMatch[2]);
    return sliceMatch[3] ? arr.slice(start, start + Number(sliceMatch[3])) : arr.slice(start);
  }
  if (value.startsWith('$')) return resolveVar(value, ctx);
  return resolveVar(`$${value}`, ctx);
}

function resolveVar(varExpr, ctx) {
  const raw = varExpr.replace(/^\$/, '');
  const parts = [];
  let current = '';
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '[') {
      if (current) {
        parts.push(current);
        current = '';
      }
      const end = raw.indexOf(']', i);
      if (end === -1) break;
      let key = raw.slice(i + 1, end).trim();
      key = key.replace(/^['"]|['"]$/g, '');
      parts.push(key);
      i = end + 1;
      continue;
    }
    if (ch === '-' && raw[i + 1] === '>') {
      if (current) {
        parts.push(current);
        current = '';
      }
      i += 2;
      continue;
    }
    if (ch === '.') {
      if (current) {
        parts.push(current);
        current = '';
      }
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  if (current) parts.push(current);

  let value = ctx;
  let lastImageUrl = null;
  for (const part of parts) {
    if (value == null) return undefined;
    let key = part;
    if (key.startsWith('$')) {
      const resolvedKey = resolveValue(key, ctx);
      key = resolvedKey != null ? String(resolvedKey) : key;
    }
    if (key === 'image' && value[key] && typeof value[key] === 'object' && value[key].url) {
      lastImageUrl = value[key].url;
    }
    if (key === 'sizes') {
      const sizesObj = value[key];
      if (!sizesObj && value.url) return value.url;
      value = sizesObj;
      continue;
    }
    if (value[key] === undefined && lastImageUrl) return lastImageUrl;
    value = value[key];
  }
  return value;
}

function isEmpty(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function getDropInsertIndex(mouseY) {
  const cards = Array.from(document.querySelectorAll('.builder-block-card'));
  if (cards.length === 0) return pageBuilderState.blocks.length;
  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i].getBoundingClientRect();
    if (mouseY < rect.top + rect.height / 2) {
      const id = cards[i].dataset.blockId;
      const idx = pageBuilderState.blocks.findIndex(b => b.id === id);
      return idx >= 0 ? idx : i;
    }
  }
  return pageBuilderState.blocks.length;
}

function handleBuilderDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  clearDropIndicators();
  const canvas = document.getElementById('builderCanvas');
  if (canvas) canvas.classList.remove('builder-drag-over');
  let raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
  try {
    const payload = typeof raw === 'string' ? JSON.parse(raw) : null;
    if (!payload) return;
    if (payload.type === 'new' && payload.blockType && BLOCK_TYPES[payload.blockType]) {
      const def = BLOCK_TYPES[payload.blockType];
      const block = { id: blockId(), type: payload.blockType, data: { ...def.defaultData } };
      const insertAt = getDropInsertIndex(e.clientY);
      pageBuilderState.blocks.splice(insertAt, 0, block);
      markBuilderDirty();
      rebuildBuilderBlocksDOM();
      reattachBlockCardListeners();
      selectBlock(block.id);
      return;
    }
    if (payload.type === 'move' && payload.blockId) {
      const idx = pageBuilderState.blocks.findIndex(b => b.id === payload.blockId);
      if (idx < 0) return;
      const [block] = pageBuilderState.blocks.splice(idx, 1);
      const insertAt = getDropInsertIndex(e.clientY);
      pageBuilderState.blocks.splice(insertAt, 0, block);
      markBuilderDirty();
      rebuildBuilderBlocksDOM();
      reattachBlockCardListeners();
    }
  } catch (err) {}
}

function handleBuilderDragover(e) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'copy';
  const canvas = document.getElementById('builderCanvas');
  if (canvas) canvas.classList.add('builder-drag-over');
}

function handleBuilderDragleave(e) {
  const canvas = document.getElementById('builderCanvas');
  if (!canvas) return;
  const related = e.relatedTarget;
  if (related && canvas.contains(related)) return;
  canvas.classList.remove('builder-drag-over');
}

function attachPageBuilderListeners() {
  const canvas = document.getElementById('builderCanvas');
  const blocksEl = document.getElementById('builderBlocks');
  const placeholder = document.getElementById('builderPlaceholder');

  if (canvas && blocksEl) {
    document.querySelectorAll('.builder-module-item').forEach(el => {
      el.addEventListener('dragstart', e => {
        const payload = { type: 'new', blockType: el.dataset.blockType };
        const str = JSON.stringify(payload);
        e.dataTransfer.setData('application/json', str);
        e.dataTransfer.setData('text/plain', str);
        e.dataTransfer.effectAllowed = 'copy';
      });
    });

    reattachBlockCardListeners();

    canvas.addEventListener('dragover', handleBuilderDragover);
    canvas.addEventListener('dragleave', handleBuilderDragleave);
    canvas.addEventListener('drop', handleBuilderDrop);
    blocksEl.addEventListener('dragover', handleBuilderDragover);
    blocksEl.addEventListener('drop', handleBuilderDrop);
    if (placeholder) {
      placeholder.addEventListener('dragover', handleBuilderDragover);
      placeholder.addEventListener('drop', handleBuilderDrop);
    }
  }

  document.querySelectorAll('.builder-meta input, .builder-meta select, .builder-title, .builder-slug, .builder-status').forEach(el => {
    const field = el.dataset?.field || (el.classList.contains('builder-title') ? 'title' : el.classList.contains('builder-slug') ? 'slug' : null);
    if (!field) return;
    el.addEventListener('input', () => syncBuilderMetaFromDOM());
    el.addEventListener('change', () => syncBuilderMetaFromDOM());
  });

  // Auto-generate slug from title
  const builderTitleInput = document.querySelector('.builder-title');
  const builderSlugInput = document.querySelector('.builder-slug');
  let _slugManuallyEdited = false;
  if (builderTitleInput && builderSlugInput) {
    // Only block auto-slug if the user manually edits the slug field
    builderSlugInput.addEventListener('input', () => { _slugManuallyEdited = true; });
    builderTitleInput.addEventListener('input', () => {
      if (_slugManuallyEdited) return;
      generateBuilderSlug();
    });
  }

  // No more .builder-parent in header — parent_id derived from primary menu

  // CPT builder sidebar: init Address fields (Mapbox geocoding)
  document.querySelectorAll('.builder-sidebar .cpt-address-field').forEach(el => {
    initGoogleMapField(el.id);
  });

  // CPT builder sidebar: toggle switches
  document.querySelectorAll('.builder-sidebar .cpt-toggle').forEach(wrapper => {
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

  // CPT builder sidebar: tab switching (Contenu / Modules)
  document.querySelectorAll('.cpt-builder-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.cpt-builder-tab').forEach(b => {
        const isActive = b.dataset.tab === tab;
        b.classList.toggle('active', isActive);
        b.style.borderBottomColor = isActive ? 'var(--primary,#224f5a)' : 'transparent';
        b.style.color = isActive ? 'var(--primary,#224f5a)' : '#999';
      });
      document.querySelectorAll('.cpt-builder-tab-content').forEach(c => {
        c.style.display = c.dataset.tab === tab ? '' : 'none';
      });
    });
  });

  // CPT builder sidebar: link page selectors
  document.querySelectorAll('.builder-sidebar .cpt-link-page-select').forEach(sel => {
    const targetId = sel.dataset.target;
    if (!targetId) return;
    const urlInput = document.getElementById(targetId);
    if (urlInput) {
      sel.addEventListener('change', () => { if (sel.value) urlInput.value = sel.value; });
    }
  });

  // ── Accordion toggle avec slideUp/slideDown (reproduit le JS Nickl) ──
  const adminSlideProp = 'height 400ms ease, padding 400ms ease';

  function adminSlideDown(el, duration) {
    if (!el || !el.classList.contains('txt')) return;
    if (el._slideTimer) { clearTimeout(el._slideTimer); el._slideTimer = null; }
    el.style.transition = 'none';
    el.style.display = 'block';
    el.style.overflow = 'hidden';
    el.style.paddingTop = '0px';
    el.style.paddingBottom = '0px';
    el.style.height = '0px';
    el.offsetHeight;
    el.style.paddingTop = '';
    el.style.paddingBottom = '';
    el.style.height = '';
    const cs = getComputedStyle(el);
    const targetH = el.scrollHeight;
    const targetPT = cs.paddingTop;
    const targetPB = cs.paddingBottom;
    el.style.height = '0px';
    el.style.paddingTop = '0px';
    el.style.paddingBottom = '0px';
    el.offsetHeight;
    el.style.transition = adminSlideProp;
    el.style.height = targetH + 'px';
    el.style.paddingTop = targetPT;
    el.style.paddingBottom = targetPB;
    el._slideTimer = setTimeout(() => {
      el._slideTimer = null;
      el.style.height = '';
      el.style.overflow = '';
      el.style.transition = '';
      el.style.paddingTop = '';
      el.style.paddingBottom = '';
    }, duration);
  }

  function adminSlideUp(el, duration) {
    if (!el || !el.classList.contains('txt')) return;
    if (el._slideTimer) { clearTimeout(el._slideTimer); el._slideTimer = null; }
    el.style.transition = 'none';
    el.style.overflow = 'hidden';
    el.style.height = el.scrollHeight + 'px';
    el.offsetHeight;
    el.style.transition = adminSlideProp;
    el.style.height = '0px';
    el.style.paddingTop = '0px';
    el.style.paddingBottom = '0px';
    el._slideTimer = setTimeout(() => {
      el._slideTimer = null;
      el.style.display = 'none';
      el.style.height = '';
      el.style.overflow = '';
      el.style.transition = '';
      el.style.paddingTop = '';
      el.style.paddingBottom = '';
    }, duration);
  }

  // ── Accordion : click on title text → inline editing ──
  canvas.addEventListener('click', (e) => {
    const titleText = e.target.closest('.accordion-title-text');
    if (!titleText) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const card = titleText.closest('.builder-block-card');
    if (!card) return;
    const blockId = card.dataset.blockId;
    const block = pageBuilderState.blocks.find(b => b.id === blockId);
    if (!block) return;
    const allTitleTexts = Array.from(card.querySelectorAll('.builder-block-render .accordion .accordion-title-text'));
    const idx = allTitleTexts.indexOf(titleText);
    if (idx === -1 || !Array.isArray(block.data.accordions) || !block.data.accordions[idx]) return;
    if (selectedBlockId !== blockId) selectBlock(blockId);
    enableInlineEditing(blockId, titleText, block.data.accordions[idx], 'title');
  });

  // ── Accordion : add item button ──
  canvas.addEventListener('click', (e) => {
    const addBtn = e.target.closest('.accordion-add-btn');
    if (!addBtn) return;
    e.preventDefault();
    e.stopPropagation();
    const card = addBtn.closest('.builder-block-card');
    if (!card) return;
    const blockId = card.dataset.blockId;
    const block = pageBuilderState.blocks.find(b => b.id === blockId);
    if (!block) return;
    if (!Array.isArray(block.data.accordions)) block.data.accordions = [];
    block.data.accordions.push({ title: 'Nouvel élément', text: '' });
    updateBlockCardPreview(blockId);
    if (selectedBlockId === blockId) renderBlockSettings();
  });

  canvas.addEventListener('click', (e) => {
    const btn = e.target.closest('.js_toggle-accordion');
    if (!btn) return;
    // Skip toggle if title is being edited inline
    if (btn.getAttribute('contenteditable') === 'true') return;
    e.preventDefault();
    e.stopPropagation();
    const accordion = btn.closest('.accordion');
    if (!accordion) return;
    const speed = 400;
    const targetTxt = btn.nextElementSibling;

    if (btn.classList.contains('active')) {
      btn.classList.remove('active');
      btn.blur();
      adminSlideUp(targetTxt, speed);
    } else {
      accordion.querySelectorAll('.title').forEach(t => {
        if (t === btn) return;
        t.classList.remove('active');
        const next = t.nextElementSibling;
        if (next && next.classList.contains('txt')) adminSlideUp(next, speed);
      });
      btn.classList.add('active');
      adminSlideDown(targetTxt, speed);
    }
  });

  // ── Parallax background dans la preview ──
  function initAdminParallax() {
    const mods = canvas.querySelectorAll('.module.has-background-image.background-parallax');
    if (mods.length === 0) return;
    function update() {
      const wh = window.innerHeight;
      mods.forEach(mod => {
        const rect = mod.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > wh) return;
        const bg = mod.querySelector('.background');
        if (!bg) return;
        const progress = (wh - rect.top) / (wh + rect.height);
        bg.style.transform = 'translateY(' + (progress * 25) + '%)';
      });
      requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }
  initAdminParallax();

  updateBuilderPlaceholder();
  renderBlockSettings();
  initPreviewScaling();
}

// ── Preview scaling ─────────────────────────────────────────────────────────
// Renders each .builder-block-render at the real frontend width (--preview-width)
// then scales it down to fit inside the canvas. The wrapper card height is
// adjusted so that no content is clipped.

const PREVIEW_FRONT_WIDTH = 1430; // must match --preview-width in CSS

let _previewResizeObserver = null;

function initPreviewScaling() {
  const canvas = document.getElementById('builderCanvas');
  if (!canvas) return;
  if (_previewResizeObserver) _previewResizeObserver.disconnect();
  _previewResizeObserver = new ResizeObserver(() => applyPreviewScaling());
  _previewResizeObserver.observe(canvas);
  applyPreviewScaling();
}

function applyPreviewScaling() {
  const canvas = document.getElementById('builderCanvas');
  if (!canvas) return;
  const canvasWidth = canvas.clientWidth;
  const scale = Math.min(1, canvasWidth / PREVIEW_FRONT_WIDTH);
  document.querySelectorAll('.builder-block-render').forEach(el => {
    el.style.width = PREVIEW_FRONT_WIDTH + 'px';
    el.style.zoom = scale;
  });
}

function syncBuilderMetaFromDOM() {
  const get = (sel, attr) => { const e = document.querySelector(sel); return e ? (attr ? e[attr] : e.value) : null; };
  const oldTitle = pageBuilderState.meta.title;
  const oldSlug = pageBuilderState.meta.slug;
  const oldStatus = pageBuilderState.meta.status;
  pageBuilderState.meta.title = get('.builder-title') || get('input[data-field="title"]') || '';
  pageBuilderState.meta.slug = get('.builder-slug') || get('input[data-field="slug"]') || '';
  pageBuilderState.meta.status = get('.builder-status') || get('select[data-field="status"]') || 'draft';

  // Resolve published_date from mode + date input
  const mode = get('.builder-publish-mode') || 'now';
  const dateVal = get('.builder-publish-date') || '';
  if (pageBuilderState.meta.status === 'draft') {
    pageBuilderState.meta.published_date = null;
  } else if (mode === 'now') {
    pageBuilderState.meta.published_date = null; // backend auto-sets to now
  } else if (dateVal) {
    pageBuilderState.meta.published_date = dateVal.includes('T') ? dateVal.replace('T', ' ') + ':00' : dateVal;
  } else {
    pageBuilderState.meta.published_date = null;
  }

  if (pageBuilderState.meta.title !== oldTitle || pageBuilderState.meta.slug !== oldSlug || pageBuilderState.meta.status !== oldStatus) {
    markBuilderDirty();
  }

  // show_in_menu derived from menu toggles
  const anyMenuChecked = document.querySelectorAll('.menu-toggle-cb:checked').length > 0;
  pageBuilderState.meta.show_in_menu = anyMenuChecked;

  // parent_id derived from primary menu hierarchy
  pageBuilderState.meta.parent_id = derivePrimaryParentPageId();
  pageBuilderState.meta.menu_order = 0;
}

/**
 * Derive the page's parent_id from the primary menu.
 * If this page has a parent menu-item in the primary menu,
 * and that parent is a page-type item, return its page_id.
 */
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

// ── SEO Meta panel ──

function toggleSeoPanel(show) {
  const panel = document.getElementById('builderSeoPanel');
  const modules = document.getElementById('builderModulesPanel');
  if (!panel) return;
  if (show) {
    panel.style.display = '';
    if (modules) modules.style.display = 'none';
    const settings = document.getElementById('builderSettings');
    if (settings) settings.style.display = 'none';
    const menuPanel = document.getElementById('builderMenuSettingsPanel');
    if (menuPanel) menuPanel.style.display = 'none';
    const colorPanel = document.getElementById('builderColorOverridesPanel');
    if (colorPanel) colorPanel.style.display = 'none';
  } else {
    panel.style.display = 'none';
    if (modules && !selectedBlockId) modules.style.display = '';
    const settings = document.getElementById('builderSettings');
    if (settings && selectedBlockId) settings.style.display = '';
  }
}


function onSeoFieldChange() {
  const titleInput = document.getElementById('seo_meta_title');
  const descInput = document.getElementById('seo_meta_description');
  if (titleInput) pageBuilderState.seoMeta.meta_title = titleInput.value;
  if (descInput) pageBuilderState.seoMeta.meta_description = descInput.value;
  // Update counters
  const titleCount = document.getElementById('seoTitleCount');
  const descCount = document.getElementById('seoDescCount');
  const tLen = (titleInput?.value || '').length;
  const dLen = (descInput?.value || '').length;
  if (titleCount) titleCount.textContent = `(${tLen}/60)`;
  if (descCount) descCount.textContent = `(${dLen}/160)`;
  // Update progress bars
  const titleBar = document.getElementById('seoTitleBar');
  const descBar = document.getElementById('seoDescBar');
  if (titleBar) { titleBar.style.width = Math.min(100, (tLen / 60) * 100) + '%'; titleBar.style.background = tLen <= 60 ? '#22c55e' : '#ef4444'; }
  if (descBar) { descBar.style.width = Math.min(100, (dLen / 160) * 100) + '%'; descBar.style.background = dLen <= 160 ? '#22c55e' : '#ef4444'; }
  // Update preview
  updateSeoPreview();
}

function updateSeoPreview() {
  const preview = document.getElementById('seoPreview');
  if (!preview) return;
  const title = pageBuilderState.seoMeta.meta_title || pageBuilderState.meta.title || 'Titre de la page';
  const slug = pageBuilderState.meta.slug || 'slug';
  const desc = pageBuilderState.seoMeta.meta_description || 'Description de la page...';
  const basePath = pageBuilderState.cptMode ? pageBuilderState.cptMode.slug : 'pages';
  preview.innerHTML = `
    <div class="seo-preview-title">${escapeHtml(title)}</div>
    <div class="seo-preview-url">example.com/${escapeHtml(basePath)}/${escapeHtml(slug)}</div>
    <div class="seo-preview-desc">${escapeHtml(desc)}</div>
  `;
}

function analyzeSeoPage() {
  const title = pageBuilderState.meta.title || '';
  const blocks = pageBuilderState.blocks || [];
  // Extract text content from blocks
  let textParts = [];
  for (const block of blocks) {
    const d = block.data || {};
    // Collect text from common fields
    if (d.text) textParts.push(stripHtml(d.text));
    if (d.title) textParts.push(stripHtml(d.title));
    if (d.subtitle) textParts.push(stripHtml(d.subtitle));
    if (d.description) textParts.push(stripHtml(d.description));
    if (d.body) textParts.push(stripHtml(d.body));
    if (d.content) textParts.push(stripHtml(d.content));
    if (d.bloc_title) textParts.push(stripHtml(d.bloc_title));
    // Repeater items
    if (d.items && Array.isArray(d.items)) {
      for (const item of d.items) {
        if (item.text) textParts.push(stripHtml(item.text));
        if (item.title) textParts.push(stripHtml(item.title));
        if (item.description) textParts.push(stripHtml(item.description));
      }
    }
    // Hero sliders
    if (d.hero_sliders && Array.isArray(d.hero_sliders)) {
      for (const s of d.hero_sliders) {
        if (s.title) textParts.push(stripHtml(s.title));
        if (s.subtitle) textParts.push(stripHtml(s.subtitle));
        if (s.text) textParts.push(stripHtml(s.text));
      }
    }
  }
  // Build meta_title: page title truncated to 60 chars
  const metaTitle = title.substring(0, 60);
  // Build meta_description: first meaningful text, truncated to 160 chars
  const allText = textParts.filter(t => t && t.trim().length > 10).join('. ').replace(/\s+/g, ' ').trim();
  const metaDesc = allText.substring(0, 160);
  // Set values
  pageBuilderState.seoMeta.meta_title = metaTitle;
  pageBuilderState.seoMeta.meta_description = metaDesc;
  const titleInput = document.getElementById('seo_meta_title');
  const descInput = document.getElementById('seo_meta_description');
  if (titleInput) titleInput.value = metaTitle;
  if (descInput) descInput.value = metaDesc;
  onSeoFieldChange();
  auditSeoImages();
  showToast('Analyse SEO terminée — vérifiez et ajustez les textes', 'success');
}

function auditSeoImages() {
  const blocks = pageBuilderState.blocks || [];
  const allImages = [];

  function collectImage(imgObj, blockLabel) {
    if (!imgObj) return;
    if (typeof imgObj === 'string') {
      if (imgObj.match(/\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)/i)) {
        allImages.push({ url: imgObj, alt: '', title: '', block: blockLabel });
      }
      return;
    }
    if (imgObj.url || imgObj.src) {
      allImages.push({
        url: imgObj.url || imgObj.src || '',
        alt: imgObj.alt || imgObj.alt_text || '',
        title: imgObj.title || imgObj.name || '',
        block: blockLabel
      });
    }
  }

  function collectFromObj(obj, blockLabel) {
    if (!obj || typeof obj !== 'object') return;
    // Direct image fields
    const imgFields = ['image', 'photo', 'logo', 'icon', 'icon_image', 'bg_image', 'background', 'background_image', 'featured_image', 'preview', 'media', 'cover', 'thumbnail', 'picture'];
    for (const f of imgFields) {
      if (obj[f]) collectImage(obj[f], blockLabel);
    }
    // Array image fields
    const arrFields = ['images', 'gallery', 'photos', 'logos', 'slides', 'sliders', 'hero_sliders'];
    for (const f of arrFields) {
      if (Array.isArray(obj[f])) {
        for (const item of obj[f]) {
          if (item && typeof item === 'object') {
            // item itself could be image or contain image sub-fields
            if (item.url || item.src) {
              collectImage(item, blockLabel);
            } else {
              collectFromObj(item, blockLabel);
            }
          }
        }
      }
    }
    // Repeater items
    if (Array.isArray(obj.items)) {
      for (const item of obj.items) collectFromObj(item, blockLabel);
    }
    if (Array.isArray(obj.columns)) {
      for (const col of obj.columns) collectFromObj(col, blockLabel);
    }
    if (Array.isArray(obj.members)) {
      for (const m of obj.members) collectFromObj(m, blockLabel);
    }
    if (Array.isArray(obj.references)) {
      for (const r of obj.references) collectFromObj(r, blockLabel);
    }
    if (Array.isArray(obj.tiles)) {
      for (const t of obj.tiles) collectFromObj(t, blockLabel);
    }
    if (Array.isArray(obj.files)) {
      for (const f of obj.files) collectFromObj(f, blockLabel);
    }
  }

  for (const block of blocks) {
    const def = BLOCK_TYPES[block.type] || {};
    const label = def.label || block.type || '?';
    collectFromObj(block.data || {}, label);
  }

  // Dedup by URL — keep first occurrence
  const seen = new Set();
  const uniqueImages = [];
  for (const img of allImages) {
    const key = (img.url || '').replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueImages.push(img);
  }

  const missingAlt = uniqueImages.filter(i => !i.alt || !i.alt.trim());
  const missingTitle = uniqueImages.filter(i => !i.title || !i.title.trim());
  const total = uniqueImages.length;

  // Render audit panel
  const panels = document.querySelectorAll('.seo-image-audit');
  panels.forEach(panel => {
    if (total === 0) {
      panel.innerHTML = `<div class="seo-audit-summary seo-audit-empty">Aucune image détectée dans les blocs</div>`;
      panel.style.display = '';
      return;
    }

    let html = `<div class="seo-audit-summary" style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:${missingAlt.length > 0 ? '10' : '0'}px;">
      <div class="seo-audit-stat"><strong>${total}</strong> image${total > 1 ? 's' : ''}</div>
      <div class="seo-audit-stat ${missingAlt.length > 0 ? 'seo-audit-warn' : 'seo-audit-ok'}"><strong>${missingAlt.length}</strong> sans alt</div>
      <div class="seo-audit-stat ${missingTitle.length > 0 ? 'seo-audit-warn' : 'seo-audit-ok'}"><strong>${missingTitle.length}</strong> sans titre</div>
    </div>`;

    if (missingAlt.length > 0) {
      html += `<details class="seo-audit-details"><summary>Images sans texte alternatif (${missingAlt.length})</summary><ul>`;
      for (const img of missingAlt) {
        const fname = (img.url || '').split('/').pop() || '?';
        html += `<li><span class="seo-audit-block">${escapeHtml(img.block)}</span> — <span class="seo-audit-file">${escapeHtml(fname)}</span></li>`;
      }
      html += `</ul></details>`;
    }
    if (missingTitle.length > 0) {
      html += `<details class="seo-audit-details"><summary>Images sans titre (${missingTitle.length})</summary><ul>`;
      for (const img of missingTitle) {
        const fname = (img.url || '').split('/').pop() || '?';
        html += `<li><span class="seo-audit-block">${escapeHtml(img.block)}</span> — <span class="seo-audit-file">${escapeHtml(fname)}</span></li>`;
      }
      html += `</ul></details>`;
    }

    panel.innerHTML = html;
    panel.style.display = '';
  });
}

function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}

function switchSeoTab(tab) {
  const preview = document.getElementById('seoPreview');
  const btnPreview = document.getElementById('seoTabPreview');
  if (tab === 'preview') {
    if (preview) preview.style.display = preview.style.display === 'none' ? '' : 'none';
    if (btnPreview) btnPreview.classList.toggle('active');
  }
}

function onSchemaOrgChange() {
  const textarea = document.getElementById('seo_schema_org');
  if (textarea) pageBuilderState.seoMeta.schema_org = textarea.value;
}

async function generateSchemaOrg() {
  const title = pageBuilderState.seoMeta.meta_title || pageBuilderState.meta.title || '';
  const description = pageBuilderState.seoMeta.meta_description || '';
  const slug = pageBuilderState.meta.slug || '';
  const blocks = pageBuilderState.blocks || [];

  // Detect block types present
  const types = blocks.map(b => {
    const def = BLOCK_TYPES[b.type] || {};
    return def.moduleName || b.type;
  });

  // Base WebPage schema
  const schema = {
    '@context': 'https://schema.org',
    '@graph': []
  };

  // WebPage — always present
  const webPage = {
    '@type': 'WebPage',
    'name': title,
    'url': `{{site_url}}/${slug}`
  };
  if (description) webPage.description = description;
  schema['@graph'].push(webPage);

  // FAQPage if Accordion blocks exist
  const accordionBlocks = blocks.filter(b => (BLOCK_TYPES[b.type]?.moduleName || b.type) === 'Accordion');
  if (accordionBlocks.length > 0) {
    const faqItems = [];
    for (const block of accordionBlocks) {
      const items = block.data?.items || block.data?.accordions || [];
      for (const item of items) {
        const q = stripHtml(item.title || item.question || '');
        const a = stripHtml(item.text || item.content || item.answer || '');
        if (q && a) faqItems.push({ '@type': 'Question', 'name': q, 'acceptedAnswer': { '@type': 'Answer', 'text': a } });
      }
    }
    if (faqItems.length > 0) {
      schema['@graph'].push({ '@type': 'FAQPage', 'mainEntity': faqItems });
    }
  }

  // LocalBusiness / Organization if Contact block
  const contactBlocks = blocks.filter(b => (BLOCK_TYPES[b.type]?.moduleName || b.type) === 'Contact');
  if (contactBlocks.length > 0) {
    const c = contactBlocks[0].data || {};
    const org = { '@type': 'LocalBusiness', 'name': title };
    if (c.address || c.adresse) org.address = { '@type': 'PostalAddress', 'streetAddress': stripHtml(c.address || c.adresse || '') };
    if (c.phone || c.telephone) org.telephone = stripHtml(c.phone || c.telephone || '');
    if (c.email || c.mail) org.email = stripHtml(c.email || c.mail || '');
    schema['@graph'].push(org);
  }

  // Product if Product block
  const productBlocks = blocks.filter(b => (BLOCK_TYPES[b.type]?.moduleName || b.type) === 'Product');
  if (productBlocks.length > 0) {
    for (const block of productBlocks) {
      const d = block.data || {};
      const product = { '@type': 'Product', 'name': stripHtml(d.title || d.name || title) };
      if (d.description) product.description = stripHtml(d.description);
      if (d.image?.url) product.image = d.image.url;
      if (d.price) product.offers = { '@type': 'Offer', 'price': d.price, 'priceCurrency': 'EUR' };
      schema['@graph'].push(product);
    }
  }

  // ImageGallery if Gallery block
  const galleryBlocks = blocks.filter(b => (BLOCK_TYPES[b.type]?.moduleName || b.type) === 'Gallery');
  if (galleryBlocks.length > 0) {
    for (const block of galleryBlocks) {
      const images = block.data?.images || block.data?.gallery || [];
      if (images.length > 0) {
        schema['@graph'].push({
          '@type': 'ImageGallery',
          'name': stripHtml(block.data?.bloc_title || block.data?.title || 'Galerie'),
          'image': images.slice(0, 10).map(img => img.url || img.image?.url || '').filter(Boolean)
        });
      }
    }
  }

  // VideoObject if Video block
  const videoBlocks = blocks.filter(b => ['Video', 'IllusVideo'].includes(BLOCK_TYPES[b.type]?.moduleName || b.type));
  if (videoBlocks.length > 0) {
    for (const block of videoBlocks) {
      const d = block.data || {};
      const url = d.video_url || d.url || d.video || '';
      if (url) {
        schema['@graph'].push({
          '@type': 'VideoObject',
          'name': stripHtml(d.title || d.bloc_title || title),
          'contentUrl': url
        });
      }
    }
  }

  // Event if EventsSlider block — fetch from CPT API
  const hasEvents = blocks.some(b => (BLOCK_TYPES[b.type]?.moduleName || b.type) === 'EventsSlider');
  if (hasEvents) {
    try {
      const evData = await apiFetch('/cpt/evenements?status=published&limit=10');
      const evItems = evData.items || evData || [];
      for (const ev of evItems) {
        const cf = ev.custom_fields || {};
        const event = { '@type': 'Event', 'name': stripHtml(ev.title || '') };
        if (cf.start_date) {
          // Convert DD/MM/YYYY to ISO date
          const parts = cf.start_date.split('/');
          event.startDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : cf.start_date;
        }
        if (cf.end_date) {
          const parts = cf.end_date.split('/');
          event.endDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : cf.end_date;
        }
        if (cf.start_time) event.startDate = (event.startDate || '') + 'T' + cf.start_time;
        if (cf.location_name) event.location = { '@type': 'Place', 'name': stripHtml(cf.location_name) };
        if (cf.location) {
          const loc = typeof cf.location === 'string' ? (() => { try { return JSON.parse(cf.location); } catch(e) { return {}; } })() : cf.location;
          if (loc.city || loc.address) {
            if (!event.location) event.location = { '@type': 'Place', 'name': stripHtml(cf.location_name || loc.city || '') };
            event.location.address = { '@type': 'PostalAddress', 'addressLocality': loc.city || '', 'streetAddress': loc.address || '' };
          }
        }
        if (cf.contact_name) event.organizer = { '@type': 'Person', 'name': stripHtml(cf.contact_name) };
        if (cf.price) event.offers = { '@type': 'Offer', 'price': stripHtml(cf.price), 'priceCurrency': 'EUR' };
        if (ev.excerpt) event.description = stripHtml(ev.excerpt);
        if (event.name) schema['@graph'].push(event);
      }
    } catch (e) { console.warn('Schema.org: erreur chargement evenements', e); }
  }

  // BlocReferences — CreativeWork items from CPT API
  const hasRefs = blocks.some(b => (BLOCK_TYPES[b.type]?.moduleName || b.type) === 'BlocReferences');
  if (hasRefs) {
    try {
      const refData = await apiFetch('/cpt/references?status=published&limit=10');
      const refItems = refData.items || refData || [];
      for (const ref of refItems) {
        const cf = ref.custom_fields || {};
        const work = { '@type': 'CreativeWork', 'name': stripHtml(ref.title || '') };
        if (cf.customer_name) work.creator = { '@type': 'Organization', 'name': stripHtml(cf.customer_name) };
        if (cf.text) work.description = stripHtml(cf.text);
        if (ref.featured_image) work.image = typeof ref.featured_image === 'string' ? ref.featured_image : (ref.featured_image.url || '');
        const cats = ref.categories || [];
        if (cats.length > 0) work.genre = cats.map(c => c.name).join(', ');
        if (cf.link) {
          const linkUrl = typeof cf.link === 'string' ? cf.link : (cf.link.url || '');
          if (linkUrl) work.url = linkUrl;
        }
        if (work.name) schema['@graph'].push(work);
      }
    } catch (e) { console.warn('Schema.org: erreur chargement references', e); }
  }

  // NewsSlider — NewsArticle items from CPT API
  const hasNews = blocks.some(b => (BLOCK_TYPES[b.type]?.moduleName || b.type) === 'NewsSlider');
  if (hasNews) {
    try {
      const newsData = await apiFetch('/cpt/actualites?status=published&limit=10');
      const newsItems = newsData.items || newsData || [];
      for (const item of newsItems) {
        const article = { '@type': 'NewsArticle', 'headline': stripHtml(item.title || '') };
        if (item.published_date || item.created_at) article.datePublished = item.published_date || item.created_at;
        if (item.excerpt) article.description = stripHtml(item.excerpt);
        if (item.featured_image) article.image = typeof item.featured_image === 'string' ? item.featured_image : (item.featured_image.url || '');
        const cats = item.categories || [];
        if (cats.length > 0) article.articleSection = cats[0].name;
        article.url = `{{site_url}}/actualites/${item.slug || ''}`;
        if (article.headline) schema['@graph'].push(article);
      }
    } catch (e) { console.warn('Schema.org: erreur chargement actualites', e); }
  }

  // Team / Person if Team block
  const teamBlocks = blocks.filter(b => (BLOCK_TYPES[b.type]?.moduleName || b.type) === 'Team');
  if (teamBlocks.length > 0) {
    for (const block of teamBlocks) {
      const members = block.data?.members || block.data?.items || block.data?.team || [];
      for (const m of members) {
        const person = { '@type': 'Person', 'name': stripHtml(m.name || m.title || m.nom || '') };
        if (m.role || m.poste || m.job) person.jobTitle = stripHtml(m.role || m.poste || m.job || '');
        if (m.image?.url) person.image = m.image.url;
        if (person.name) schema['@graph'].push(person);
      }
    }
  }

  // Review if GoogleReviews or Review block
  const reviewBlocks = blocks.filter(b => ['GoogleReviews', 'Review'].includes(BLOCK_TYPES[b.type]?.moduleName || b.type));
  if (reviewBlocks.length > 0) {
    for (const block of reviewBlocks) {
      const reviews = block.data?.reviews || block.data?.items || [];
      for (const r of reviews) {
        const review = { '@type': 'Review', 'author': { '@type': 'Person', 'name': stripHtml(r.author || r.name || r.nom || 'Anonyme') } };
        if (r.text || r.content) review.reviewBody = stripHtml(r.text || r.content || '');
        if (r.rating || r.note) review.reviewRating = { '@type': 'Rating', 'ratingValue': r.rating || r.note };
        schema['@graph'].push(review);
      }
    }
  }

  // BreadcrumbList
  schema['@graph'].push({
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Accueil', 'item': '{{site_url}}/' },
      { '@type': 'ListItem', 'position': 2, 'name': title, 'item': `{{site_url}}/${slug}` }
    ]
  });

  const json = JSON.stringify(schema, null, 2);
  pageBuilderState.seoMeta.schema_org = json;
  const textarea = document.getElementById('seo_schema_org');
  if (textarea) textarea.value = json;
  showToast('Schema.org genere depuis le contenu de la page', 'success');
}

// ========== AI PAGE GENERATION ==========

function openAiModal() {
  if (!aiEnabled) {
    showToast('Génération IA temporairement désactivée par un administrateur', 'error');
    return;
  }
  if (aiCreditsAvailable !== null && aiCreditsAvailable <= 0) {
    showToast('Crédits IA épuisés — rechargez les crédits pour générer', 'error');
    return;
  }
  const existingBlocks = pageBuilderState.blocks.length;
  const warningHtml = existingBlocks > 0
    ? `<div class="ai-modal-warning">Cette page contient déjà ${existingBlocks} bloc(s). La génération IA remplacera tout le contenu existant.</div>`
    : '';

  openUiModal({
    title: '✨ Générer la page avec l\'IA',
    bodyHtml: `
      <div class="ai-modal-content">
        ${warningHtml}
        <div class="ai-modal-field">
          <label class="form-label">Décrivez la page que vous souhaitez créer</label>
          <textarea class="form-input ai-prompt-input" id="aiPromptInput" rows="5" placeholder="Ex: Crée une page de présentation pour une agence web spécialisée en React et Node.js, avec nos services, l'équipe, des chiffres clés et un formulaire de contact..."></textarea>
        </div>
        <div class="ai-modal-options">
          <div class="ai-modal-option">
            <label class="form-label">Titre de la page (optionnel)</label>
            <input type="text" class="form-input" id="aiPageTitle" value="${escapeHtml(pageBuilderState.meta.title || '')}" placeholder="Sera généré automatiquement si vide">
          </div>
        </div>
        <div class="ai-modal-row">
          <div class="ai-modal-checkboxes">
            <label class="ai-checkbox-label"><input type="checkbox" id="aiGenSeo" checked> Générer le SEO (meta title + description)</label>
            <label class="ai-checkbox-label"><input type="checkbox" id="aiGenSchema" checked> Générer le Schema.org</label>
            <label class="ai-checkbox-label"><input type="checkbox" id="aiWebSearch" checked> 🔍 Recherche web (infos réelles)</label>
          </div>
          <div class="ai-modal-model">
            <label class="form-label">Modèle</label>
            <select class="form-select" id="aiModelSelect">
              <option value="haiku" selected>Haiku (rapide, ~10s)</option>
              <option value="sonnet">Sonnet (précis, ~30s)</option>
            </select>
          </div>
        </div>
      </div>
    `,
    actions: [
      { label: 'Annuler', variant: 'btn-outline', onClick: () => closeUiModal() },
      { label: '✨ Générer', variant: 'btn-ai', onClick: () => executeAiGeneration() }
    ]
  });
  setTimeout(() => document.getElementById('aiPromptInput')?.focus(), 50);
}

async function executeAiGeneration() {
  const prompt = document.getElementById('aiPromptInput')?.value?.trim();
  if (!prompt) {
    showToast('Veuillez saisir une description de la page', 'error');
    return;
  }

  const pageTitle = document.getElementById('aiPageTitle')?.value?.trim() || '';
  const genSeo = document.getElementById('aiGenSeo')?.checked ?? true;
  const genSchema = document.getElementById('aiGenSchema')?.checked ?? true;

  closeUiModal();

  // Show loading overlay
  const overlay = document.createElement('div');
  overlay.id = 'aiLoadingOverlay';
  overlay.innerHTML = `
    <div class="ai-loading-card">
      <div class="ai-loading-spinner"></div>
      <h3>Génération en cours...</h3>
      <p id="aiCharCounter">Connexion à l'IA...</p>
    </div>
  `;
  document.body.appendChild(overlay);

  try {
    // Stream response via SSE to avoid FastCGI timeout
    const model = document.getElementById('aiModelSelect')?.value || 'haiku';
    const webSearch = document.getElementById('aiWebSearch')?.checked ?? true;
    const result = await streamAiGeneration(prompt, pageTitle, genSeo, model, webSearch);
    const generated = result.generated;
    if (!generated) throw new Error('Réponse IA vide');

    // Apply generated title & slug
    if (generated.title) {
      pageBuilderState.meta.title = generated.title;
      const titleInput = document.querySelector('.builder-title');
      if (titleInput) titleInput.value = generated.title;
    }
    if (generated.slug) {
      pageBuilderState.meta.slug = generated.slug;
      const slugInput = document.querySelector('.builder-slug');
      if (slugInput) slugInput.value = generated.slug;
    }

    // Apply generated blocks — resolve images + ensure repeater items
    if (generated.blocks && Array.isArray(generated.blocks)) {
      const defaultImg = siteSettingsCache?.replacement_image || '';
      pageBuilderState.blocks = generated.blocks.map(block => ({
        id: block.id || blockId(),
        type: block.type,
        data: processAiBlockData(normalizeAiBlock(block.type, block.data || {}), defaultImg)
      }));
      rebuildBuilderBlocksDOM();
      reattachBlockCardListeners();

      // Async post-processing: geocode addresses + resolve form IDs
      Promise.all([
        geocodeAiBlockAddresses(),
        resolveAiFormIds()
      ]).then(([geoChanged, formChanged]) => {
        if (geoChanged || formChanged) { rebuildBuilderBlocksDOM(); reattachBlockCardListeners(); }
      });
    }

    // Apply SEO
    if (genSeo && generated.seo) {
      pageBuilderState.seoMeta.enabled = true;
      if (generated.seo.meta_title) {
        pageBuilderState.seoMeta.meta_title = generated.seo.meta_title;
      }
      if (generated.seo.meta_description) {
        pageBuilderState.seoMeta.meta_description = generated.seo.meta_description;
      }
      if (genSchema && generated.seo.schema_org) {
        pageBuilderState.seoMeta.schema_org = typeof generated.seo.schema_org === 'string'
          ? generated.seo.schema_org
          : JSON.stringify(generated.seo.schema_org, null, 2);
      }
      // Update SEO fields if visible
      const titleInput = document.getElementById('seo_meta_title');
      const descInput = document.getElementById('seo_meta_description');
      const schemaInput = document.getElementById('seo_schema_org');
      if (titleInput) titleInput.value = pageBuilderState.seoMeta.meta_title;
      if (descInput) descInput.value = pageBuilderState.seoMeta.meta_description;
      if (schemaInput) schemaInput.value = pageBuilderState.seoMeta.schema_org;
      onSeoFieldChange();
    }

    if (result.usage) {
      console.log(`IA tokens — input: ${result.usage.input_tokens}, output: ${result.usage.output_tokens}`);
    }

    showToast(`Page générée avec succès (${pageBuilderState.blocks.length} blocs)`, 'success');

  } catch (error) {
    console.error('AI generation error:', error);
    showToast(`Erreur IA : ${error.message}`, 'error');
  } finally {
    const loadingOverlay = document.getElementById('aiLoadingOverlay');
    if (loadingOverlay) loadingOverlay.remove();
    refreshAiCreditsAvailable();
  }
}

/**
 * Geocode all addresses in contact/map blocks using Mapbox API.
 * Resolves string addresses to full GoogleMap objects with lat/lng.
 * Returns true if any block was updated.
 */
/**
 * Auto-resolve form_id for form blocks. If form_id is "auto" or empty,
 * fetch forms from API and assign the first active "contact" form (or first active form).
 */
async function resolveAiFormIds() {
  const formBlocks = pageBuilderState.blocks.filter(b => b.type === 'form' && (!b.data.form_id || b.data.form_id === 'auto'));
  if (formBlocks.length === 0) return false;
  try {
    const forms = await apiFetch('/forms');
    const active = (forms || []).filter(f => f.status === 'active');
    if (active.length === 0) return false;
    // Prefer a form with "contact" in the title
    const contactForm = active.find(f => /contact/i.test(f.title)) || active[0];
    for (const block of formBlocks) {
      block.data.form_id = String(contactForm.id);
    }
    return true;
  } catch (e) {
    console.warn('Could not resolve form IDs:', e);
    return false;
  }
}

// ========== BULK AI PAGE GENERATION ==========

function openBulkAiModal() {
  if (!aiEnabled) {
    showToast('Génération IA temporairement désactivée par un administrateur', 'error');
    return;
  }
  if (aiCreditsAvailable !== null && aiCreditsAvailable <= 0) {
    showToast('Crédits IA épuisés — rechargez les crédits pour générer', 'error');
    return;
  }
  openUiModal({
    title: '✨ Générer des pages par IA',
    bodyHtml: `
      <div class="ai-modal-content">
        <div class="ai-modal-field">
          <label class="form-label">Décrivez les pages ou collez du HTML / wireframe à convertir</label>
          <textarea class="form-input ai-prompt-input" id="bulkAiPromptInput" rows="8" placeholder="Exemples d'utilisation :&#10;&#10;• Collez du HTML/wireframe : l'IA convertira chaque page en blocs Nickl&#10;• Décrivez vos pages : Crée 2 pages pour un artisan plombier — une page d'accueil avec hero et services, une page contact&#10;&#10;L'IA génère EXACTEMENT le nombre de pages décrites."></textarea>
        </div>
        <div class="ai-modal-field" style="margin-top:12px">
          <label class="form-label">URL à analyser (optionnel)</label>
          <p class="form-hint" style="margin:0 0 8px;color:#64748b;font-size:13px">L'IA récupère le HTML de la page et le convertit en blocs Nickl. Plusieurs URLs séparées par des retours à la ligne.</p>
          <textarea class="form-input" id="bulkAiUrlsInput" rows="2" placeholder="https://exemple.com/page-a-convertir"></textarea>
        </div>
        <div class="ai-modal-field" style="margin-top:12px">
          <label class="form-label">Fichiers de référence (optionnel)</label>
          <p class="form-hint" style="margin:0 0 8px;color:#64748b;font-size:13px">Images (screenshots, maquettes), PDF (wireframes, cahiers des charges) ou HTML (pages à convertir) pour guider l'IA.</p>
          <div class="bulk-ai-images-zone" id="bulkAiImagesZone">
            <input type="file" id="bulkAiImagesInput" multiple accept="image/*,application/pdf,text/html,.html,.htm" style="display:none" onchange="handleBulkAiImages(this.files)">
            <button type="button" class="btn btn-sm btn-outline" onclick="document.getElementById('bulkAiImagesInput').click()">📎 Ajouter des fichiers</button>
            <div id="bulkAiImagesPreviews" class="bulk-ai-images-previews"></div>
          </div>
        </div>
        <div class="ai-modal-row" style="margin-top:12px">
          <div class="ai-modal-checkboxes">
            <label class="ai-checkbox-label"><input type="checkbox" id="bulkAiGenSeo" checked> Générer le SEO</label>
            <label class="ai-checkbox-label"><input type="checkbox" id="bulkAiWebSearch" checked> 🔍 Recherche web</label>
          </div>
          <div class="ai-modal-model">
            <label class="form-label">Modèle</label>
            <select class="form-select" id="bulkAiModelSelect">
              <option value="haiku">Haiku (rapide)</option>
              <option value="sonnet" selected>Sonnet (précis)</option>
            </select>
          </div>
        </div>
      </div>
    `,
    actions: [
      { label: 'Annuler', variant: 'btn-outline', onClick: () => closeUiModal() },
      { label: '✨ Générer les pages', variant: 'btn-ai', onClick: () => executeBulkAiGeneration() }
    ]
  });
  setTimeout(() => document.getElementById('bulkAiPromptInput')?.focus(), 50);
}

// Store base64 files (images + PDFs) for the bulk AI request
let _bulkAiImages = [];
// Store HTML files (read as text) sent separately to the backend
let _bulkAiHtmlFiles = [];

function handleBulkAiImages(files) {
  const container = document.getElementById('bulkAiImagesPreviews');
  if (!container) return;

  for (const file of files) {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const nameLower = (file.name || '').toLowerCase();
    const isHtml = file.type === 'text/html' || nameLower.endsWith('.html') || nameLower.endsWith('.htm');
    if (!isImage && !isPdf && !isHtml) continue;

    if (isHtml) {
      const reader = new FileReader();
      reader.onload = (e) => {
        _bulkAiHtmlFiles.push({ name: file.name, content: e.target.result });
        const idx = _bulkAiHtmlFiles.length - 1;
        const preview = document.createElement('div');
        preview.className = 'bulk-ai-image-preview';
        preview.dataset.kind = 'html';
        preview.dataset.idx = String(idx);
        preview.innerHTML = `<div class="bulk-ai-pdf-icon">HTML</div>
           <button type="button" class="bulk-ai-image-remove" onclick="removeBulkAiHtmlFile(${idx}, this.parentElement)">&times;</button>
           <span class="bulk-ai-image-name">${escapeHtml(file.name)}</span>`;
        container.appendChild(preview);
      };
      reader.readAsText(file);
      continue;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result.split(',')[1];
      _bulkAiImages.push({ data: base64, media_type: file.type, name: file.name, kind: isPdf ? 'document' : 'image' });

      const idx = _bulkAiImages.length - 1;
      const preview = document.createElement('div');
      preview.className = 'bulk-ai-image-preview';
      preview.innerHTML = isPdf
        ? `<div class="bulk-ai-pdf-icon">PDF</div>
           <button type="button" class="bulk-ai-image-remove" onclick="removeBulkAiImage(${idx}, this.parentElement)">&times;</button>
           <span class="bulk-ai-image-name">${escapeHtml(file.name)}</span>`
        : `<img src="${e.target.result}" alt="${escapeHtml(file.name)}">
           <button type="button" class="bulk-ai-image-remove" onclick="removeBulkAiImage(${idx}, this.parentElement)">&times;</button>
           <span class="bulk-ai-image-name">${escapeHtml(file.name)}</span>`;
      container.appendChild(preview);
    };
    reader.readAsDataURL(file);
  }
}

function removeBulkAiImage(index, element) {
  _bulkAiImages[index] = null;
  if (element) element.remove();
}

function removeBulkAiHtmlFile(index, element) {
  _bulkAiHtmlFiles[index] = null;
  if (element) element.remove();
}

async function executeBulkAiGeneration() {
  const prompt = document.getElementById('bulkAiPromptInput')?.value?.trim();
  if (!prompt) {
    showToast('Veuillez décrire les pages à générer', 'error');
    return;
  }

  const model = document.getElementById('bulkAiModelSelect')?.value || 'sonnet';
  const webSearch = document.getElementById('bulkAiWebSearch')?.checked ?? true;
  const genSeo = document.getElementById('bulkAiGenSeo')?.checked ?? true;
  const images = _bulkAiImages.filter(Boolean);
  const htmlFiles = _bulkAiHtmlFiles.filter(Boolean);
  const urlsRaw = document.getElementById('bulkAiUrlsInput')?.value?.trim() || '';
  const urls = urlsRaw.split(/[\n,]+/).map(u => u.trim()).filter(u => u.startsWith('http'));

  closeUiModal();

  // Show loading overlay
  const overlay = document.createElement('div');
  overlay.id = 'aiLoadingOverlay';
  overlay.innerHTML = `
    <div class="ai-loading-card bulk-ai-loading">
      <div class="ai-loading-spinner"></div>
      <h3>Génération des pages en cours...</h3>
      <p id="bulkAiStatus">${urls.length > 0 ? 'Récupération des URLs...' : 'Connexion à l\'IA...'}</p>
      <div id="bulkAiProgress" class="bulk-ai-progress"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  try {
    const body = JSON.stringify({
      prompt: genSeo ? prompt + '\n\nGénère aussi le SEO (meta title + description) et le Schema.org pour chaque page.' : prompt,
      model,
      web_search: webSearch,
      images: images.length > 0 ? images : undefined,
      urls: urls.length > 0 ? urls : undefined,
      html_files: htmlFiles.length > 0 ? htmlFiles : undefined,
    });

    const result = await new Promise((resolve, reject) => {
      fetch(`${API_BASE}/ai/generate-pages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body
      }).then(response => {
        if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
          return response.json().then(err => { throw new Error(err.error || 'Request failed'); });
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let charCount = 0;
        let currentEvent = '';
        let resolved = false;

        function handleLine(line) {
          if (resolved) return;
          if (line.startsWith('event: ')) { currentEvent = line.slice(7).trim(); return; }
          if (!line.startsWith('data: ')) return;
          const data = line.slice(6);

          const statusEl = document.getElementById('bulkAiStatus');
          const progressEl = document.getElementById('bulkAiProgress');

          if (currentEvent === 'status') {
            if (statusEl) statusEl.textContent = data;
          } else if (currentEvent === 'chunk') {
            charCount += data.length;
            if (statusEl) statusEl.textContent = `${charCount} caractères générés...`;
          } else if (currentEvent === 'form_created') {
            try {
              const form = JSON.parse(data);
              if (progressEl) {
                progressEl.innerHTML += `
                  <div class="bulk-ai-page-done">
                    📋 Formulaire créé : <strong>${escapeHtml(form.title)}</strong> — ${form.fields_count} champs
                  </div>`;
              }
              if (statusEl) statusEl.textContent = 'Formulaire créé, génération des pages...';
            } catch (e) {}
          } else if (currentEvent === 'page_saved') {
            try {
              const page = JSON.parse(data);
              if (progressEl) {
                progressEl.innerHTML += `
                  <div class="bulk-ai-page-done">
                    ✅ <strong>${escapeHtml(page.title)}</strong> — ${page.blocks_count} blocs <span class="text-muted">(${page.index}/${page.total})</span>
                  </div>`;
              }
              if (statusEl) statusEl.textContent = `Page ${page.index}/${page.total} sauvegardée...`;
            } catch (e) {}
          } else if (currentEvent === 'done') {
            resolved = true;
            try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('JSON invalide')); }
          } else if (currentEvent === 'error') {
            resolved = true;
            try { reject(new Error(JSON.parse(data).error || 'Erreur IA')); } catch (e) { reject(new Error(data)); }
          }
        }

        function processChunks() {
          reader.read().then(({ done, value }) => {
            if (value) buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = done ? '' : lines.pop();
            for (const line of lines) handleLine(line);
            if (done && buffer) handleLine(buffer);
            if (resolved) return;
            if (done) { reject(new Error('Stream terminé sans résultat')); return; }
            processChunks();
          }).catch(reject);
        }
        processChunks();
      }).catch(reject);
    });

    const pages = result.pages || [];
    const forms = result.forms || [];
    _bulkAiImages = [];
    _bulkAiHtmlFiles = [];

    if (result.usage) {
      console.log(`IA bulk tokens — input: ${result.usage.input_tokens}, output: ${result.usage.output_tokens}`);
    }

    const summary = [
      `${pages.length} page${pages.length > 1 ? 's' : ''}`,
      forms.length > 0 ? `${forms.length} formulaire${forms.length > 1 ? 's' : ''}` : ''
    ].filter(Boolean).join(' + ');
    showToast(`${summary} créé${pages.length + forms.length > 1 ? 's' : ''} avec succès`, 'success');

    // Refresh pages list
    const content = document.getElementById('content');
    if (content) content.innerHTML = await renderPages();

    // Show results modal with action buttons
    if (pages.length > 0) {
      const formsHtml = forms.length > 0 ? `
        <div style="margin-bottom:14px">
          <h4 style="font-size:14px;margin:0 0 8px 0;color:#64748b">📋 Formulaires créés</h4>
          ${forms.map(f => `
            <div class="bulk-ai-result-row" style="padding:8px 0">
              <div class="bulk-ai-result-info">
                <strong>${escapeHtml(f.title)}</strong>
                <span class="text-muted" style="font-size:12px">${f.fields_count} champs</span>
              </div>
            </div>
          `).join('')}
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 14px 0">
      ` : '';

      const pagesList = pages.map(p => `
        <div class="bulk-ai-result-row">
          <div class="bulk-ai-result-info">
            <strong>${escapeHtml(p.title)}</strong>
            <span class="text-muted" style="font-size:12px">/${escapeHtml(p.slug)} · ${p.blocks_count} blocs</span>
          </div>
          <div class="bulk-ai-result-actions">
            <button type="button" class="btn btn-sm btn-primary" onclick="closeUiModal(); openPageBuilder(${p.id})">Modifier</button>
            <button type="button" class="btn btn-sm btn-outline" onclick="bulkAiPublishAndPreview(${p.id}, '${escapeHtml(p.slug)}')">Publier & voir</button>
          </div>
        </div>
      `).join('');

      openUiModal({
        title: `✅ ${pages.length} page${pages.length > 1 ? 's' : ''} créée${pages.length > 1 ? 's' : ''}`,
        bodyHtml: `
          <div class="bulk-ai-results">
            <p style="color:#64748b;font-size:13px;margin:0 0 14px 0">Pages créées en brouillon. Vous pouvez les modifier dans le builder ou les publier pour les prévisualiser sur le site.</p>
            ${formsHtml}
            ${pagesList}
          </div>
        `,
        actions: [
          { label: 'Fermer', variant: 'btn-outline', onClick: () => closeUiModal() }
        ]
      });
    }

  } catch (error) {
    console.error('Bulk AI error:', error);
    showToast(`Erreur IA : ${error.message}`, 'error');
  } finally {
    const loadingOverlay = document.getElementById('aiLoadingOverlay');
    if (loadingOverlay) loadingOverlay.remove();
    refreshAiCreditsAvailable();
  }
}

async function bulkAiPublishAndPreview(pageId, slug) {
  try {
    // Fetch full page data
    const page = await apiFetch(`/pages/${slug}`);
    if (!page) { showToast('Page introuvable', 'error'); return; }

    // Publish it
    await apiFetch(`/pages/${pageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: page.title,
        slug: page.slug,
        content: page.content,
        color_overrides: page.color_overrides,
        seo_meta: page.seo_meta,
        status: 'published',
        show_in_menu: page.show_in_menu ?? false,
        menu_order: page.menu_order ?? 0,
        parent_id: page.parent_id || null,
      })
    });

    // Open frontend in new tab
    const frontendUrl = siteSettingsCache?.frontend_url || window.location.origin;
    window.open(`${frontendUrl}/${slug}`, '_blank');

    showToast('Page publiée', 'success');
    // Refresh pages list
    const content = document.getElementById('content');
    if (content) content.innerHTML = await renderPages();
  } catch (error) {
    console.error('Publish error:', error);
    showToast(`Erreur : ${error.message}`, 'error');
  }
}

async function geocodeAiBlockAddresses() {
  let changed = false;
  for (const block of pageBuilderState.blocks) {
    if (block.type !== 'contact' && block.type !== 'map') continue;
    const items = block.data.addresses || block.data.items || [];
    for (const item of items) {
      const addr = item.address;
      if (!addr) continue;
      // Get the address string — either from object or direct string
      const query = typeof addr === 'object' ? (addr.address || '') : addr;
      if (!query || query.length < 3) continue;
      // Skip if already geocoded (has valid lat/lng)
      if (typeof addr === 'object' && addr.lat && addr.lng && addr.lat !== 0 && addr.lng !== 0) continue;
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=1&language=fr`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const f = data.features[0];
          const [lng, lat] = f.center;
          const ctx = f.context || [];
          const getCtx = (prefix) => { const c = ctx.find(c => c.id?.startsWith(prefix)); return c ? c.text : ''; };
          item.address = {
            address: f.place_name || query,
            lat, lng,
            place_id: f.id || '',
            street_number: f.address || '',
            street_name: f.text || '',
            street_name_short: f.text || '',
            post_code: getCtx('postcode'),
            city: getCtx('place'),
            name: f.place_name || query
          };
          changed = true;
        }
      } catch (e) {
        console.warn('Geocoding failed for:', query, e);
      }
    }
  }
  return changed;
}

/**
 * Normalize AI-generated block data to match the real module field schema.
 * Fixes field name mismatches and injects required defaults.
 */
function normalizeAiBlock(type, data) {
  if (!data || typeof data !== 'object') return data;

  const RULES = {
    'text-image': {
      rename: { content: 'text' },
      defaults: { media_choice: true }
    },
    'accordion': {
      rename: { items: 'accordions' },
      subRename: { accordions: { content: 'text' } }
    },
    'key-figures': {
      rename: { items: 'key_list' },
      subRename: { key_list: { title: 'titre', icon: 'icone' } }
    },
    'gallery': {
      rename: { items: 'list', style: 'style_choice' },
      subRename: { list: { title: 'titre' } }
    },
    'clickable-tiles': {
      rename: { items: 'list_interlocking', is_clickable: 'clickable_block' },
      subRename: { list_interlocking: { text: 'catchphrase', image: 'file', link: 'primary_link' } }
    },
    'team': {
      rename: { items: 'list', members: 'list' }
    },
    'contact': {
      rename: { items: 'addresses' }
    },
    'hero': {
      defaults: { is_hero_banner_slider: true },
      subRename: { hero_sliders: { subtitle: 'catchphrase' } }
    },
    'banner': {
      rename: { bg_img: 'image', background: 'banner_height' }
    }
  };

  const d = { ...data };

  // Global rename: "background" → "bloc_color" (applies to ALL block types)
  if (d.background !== undefined && d.bloc_color === undefined) {
    d.bloc_color = d.background;
    delete d.background;
  }
  // Ensure bloc_color always has a value (schema default)
  if (!d.bloc_color) d.bloc_color = 'no-background-color';

  const rules = RULES[type];
  if (!rules) return d;

  // Inject defaults for missing required fields
  if (rules.defaults) {
    for (const [key, val] of Object.entries(rules.defaults)) {
      if (d[key] === undefined) d[key] = val;
    }
  }

  // Rename top-level fields
  if (rules.rename) {
    for (const [from, to] of Object.entries(rules.rename)) {
      if (d[from] !== undefined && d[to] === undefined) {
        d[to] = d[from];
        delete d[from];
      }
    }
  }

  // Rename sub-fields inside repeater arrays
  if (rules.subRename) {
    for (const [arrayKey, fieldMap] of Object.entries(rules.subRename)) {
      if (Array.isArray(d[arrayKey])) {
        d[arrayKey] = d[arrayKey].map(item => {
          if (!item || typeof item !== 'object') return item;
          const row = { ...item };
          for (const [from, to] of Object.entries(fieldMap)) {
            if (row[from] !== undefined && row[to] === undefined) {
              row[to] = row[from];
              delete row[from];
            }
          }
          return row;
        });
      }
    }
  }

  // Special: Contact addresses — convert string address to GoogleMap object + auto-enable map
  if (type === 'contact' && Array.isArray(d.addresses)) {
    let hasAddress = false;
    d.addresses = d.addresses.map(addr => {
      if (typeof addr.address === 'string' && addr.address.trim()) {
        addr.address = { address: addr.address, lat: 0, lng: 0 };
        hasAddress = true;
      } else if (addr.address && typeof addr.address === 'object' && addr.address.address) {
        hasAddress = true;
      }
      return addr;
    });
    // If addresses have location data, force map view (Carte) instead of photo
    if (hasAddress) d.is_map = true;
  }

  return d;
}

/**
 * Post-process AI-generated block data:
 * - Replace "image-default" strings with the site's replacement_image as a media object
 * - Ensure repeater fields (items, hero_sliders, columns_list) are proper arrays
 * - Normalize sub-modules in columns-tab flexible content
 */
function processAiBlockData(data, defaultImgUrl) {
  if (!data || typeof data !== 'object') return data;

  // Image field names that should be media objects
  const imageFields = ['image', 'bg_img', 'photo', 'picture', 'logo', 'icon', 'preview', 'file', 'icone'];
  const logoUrl = siteSettingsCache?.logo || defaultImgUrl;

  function makeImageObject(url) {
    return { id: null, url: url || '', alt: '', title: '', caption: '', width: null, height: null };
  }

  function resolveValue(val, key) {
    // "image-default" → media object with site default image
    if (val === 'image-default' || val === 'image_default') {
      return makeImageObject(defaultImgUrl);
    }
    // "logo-default" → media object with site logo
    if (val === 'logo-default' || val === 'logo_default') {
      return makeImageObject(logoUrl);
    }
    // If it's a string URL in an image field, wrap it as media object
    if (imageFields.includes(key) && typeof val === 'string' && val !== '' && val !== 'image-default' && val !== 'logo-default') {
      return makeImageObject(val);
    }
    // Recurse into objects
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return processObject(val);
    }
    // Recurse into arrays
    if (Array.isArray(val)) {
      return val.map(item => {
        if (item && typeof item === 'object') return processObject(item);
        return item;
      });
    }
    return val;
  }

  function processObject(obj) {
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = resolveValue(val, key);
    }
    return result;
  }

  return processObject(data);
}

/**
 * Stream AI generation via SSE. Returns a Promise that resolves with the final result.
 * Updates the loading overlay with a live character counter.
 */
function streamAiGeneration(prompt, pageTitle, genSeo, model, webSearch = true) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      prompt,
      page_title: pageTitle,
      context: genSeo ? 'Génère aussi le SEO et le Schema.org' : '',
      model,
      web_search: webSearch
    });

    fetch(`${API_BASE}/ai/generate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body
    }).then(response => {
      if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
        return response.json().then(err => { throw new Error(err.error || 'Request failed'); });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let charCount = 0;
      let currentEvent = '';
      let resolved = false;

      function handleLine(line) {
        if (resolved) return;
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
          return;
        }
        if (!line.startsWith('data: ')) return;
        const data = line.slice(6);

        if (currentEvent === 'status') {
          const counter = document.getElementById('aiCharCounter');
          if (counter) counter.textContent = data;
        } else if (currentEvent === 'chunk') {
          charCount += data.length;
          const counter = document.getElementById('aiCharCounter');
          if (counter) counter.textContent = `${charCount} caractères générés...`;
        } else if (currentEvent === 'done') {
          resolved = true;
          try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Réponse finale JSON invalide')); }
        } else if (currentEvent === 'error') {
          resolved = true;
          try { reject(new Error(JSON.parse(data).error || 'Erreur IA')); } catch (e) { reject(new Error(data)); }
        }
      }

      function processChunks() {
        reader.read().then(({ done, value }) => {
          if (value) buffer += decoder.decode(value, { stream: true });

          // Process all complete lines in buffer
          const lines = buffer.split('\n');
          buffer = done ? '' : lines.pop(); // on stream end, process everything
          for (const line of lines) handleLine(line);
          // If stream ended, also process remaining buffer
          if (done && buffer) handleLine(buffer);

          if (resolved) return;
          if (done) { reject(new Error('Stream terminé sans résultat')); return; }
          processChunks();
        }).catch(reject);
      }

      processChunks();
    }).catch(reject);
  });
}

function onBuilderStatusChange(status) {
  const btn = document.querySelector('.builder-menu-settings-btn');
  if (btn) {
    btn.style.display = status === 'draft' ? 'none' : '';
  }
  // If switching to draft, close the menu settings panel
  if (status === 'draft') {
    toggleMenuSettingsPanel(false);
  }
  // Show/hide publish date group
  const dateGroup = document.querySelector('.builder-publish-date-group');
  if (dateGroup) {
    dateGroup.style.display = status === 'draft' ? 'none' : '';
  }
}

function onPublishModeChange(mode) {
  const dateInput = document.querySelector('.builder-publish-date');
  if (!dateInput) return;
  if (mode === 'now') {
    dateInput.style.display = 'none';
    dateInput.value = '';
  } else {
    dateInput.style.display = '';
    if (!dateInput.value) {
      const now = new Date();
      if (mode === 'schedule') {
        now.setDate(now.getDate() + 1);
      }
      dateInput.value = now.toISOString().slice(0, 16);
    }
  }
}

function updateBuilderPlaceholder() {
  const hasBlocks = pageBuilderState.blocks.length > 0;
  const ph = document.getElementById('builderPlaceholder');
  if (ph) ph.style.display = hasBlocks ? 'none' : 'block';
  const tb = document.getElementById('builderToolbar');
  if (tb) tb.style.display = hasBlocks ? '' : 'none';
}

function updateBuilderParallax() {
  const canvas = document.getElementById('builderCanvas');
  if (!canvas) return;
  const canvasRect = canvas.getBoundingClientRect();
  const viewportH = canvasRect.height;
  document.querySelectorAll('.builder-block-render .module.background-parallax.has-background-image').forEach(module => {
    const bg = module.querySelector('.background');
    if (!bg) return;
    const rect = module.getBoundingClientRect();
    // Position du module relative au canvas visible
    const relTop = rect.top - canvasRect.top;
    // progress: 0 quand le module entre par le bas, 1 quand il sort par le haut
    const progress = Math.max(0, Math.min(1, (viewportH - relTop) / (viewportH + rect.height)));
    bg.style.transform = `translateY(${progress * 25}%)`;
  });
}

let _parallaxListenerAdded = false;
function initBuilderParallax() {
  if (!_parallaxListenerAdded) {
    const canvas = document.getElementById('builderCanvas');
    if (canvas) canvas.addEventListener('scroll', updateBuilderParallax, { passive: true });
    _parallaxListenerAdded = true;
  }
  updateBuilderParallax();
}

function renderInsertButton(index) {
  return `<div class="builder-insert-between" data-insert-index="${index}"><button type="button" class="builder-insert-btn" title="Insérer un bloc ici"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button></div>`;
}

function renderBlocksWithInsertButtons(blocks) {
  let visibleNum = 0;
  const parts = [];
  blocks.forEach((block, i) => {
    if (INACTIVE_PLUGIN_TYPES.has(block.type)) return;
    visibleNum++;
    parts.push(renderBlockCard(block, visibleNum));
    parts.push(renderInsertButton(i));
  });
  return parts.join('');
}

function rebuildBuilderBlocksDOM() {
  const blocksEl = document.getElementById('builderBlocks');
  if (!blocksEl) return;
  blocksEl.innerHTML = renderBlocksWithInsertButtons(pageBuilderState.blocks);
  pageBuilderState.blocks.forEach(block => {
    const card = blocksEl.querySelector(`[data-block-id="${block.id}"]`);
    if (!card) return;
    const richEl = card.querySelector('.builder-block-render');
    if (richEl) syncModulePaddingClasses(richEl, block.data);
  });
  reattachBlockCardListeners();
  updateBuilderPlaceholder();
  updateSelectedBlockCard();
  initBuilderParallax();
  applyPreviewScaling();
}

function clearDropIndicators() {
  document.querySelectorAll('.builder-block-card').forEach(c => c.classList.remove('drop-before', 'drop-after'));
}

function reattachBlockCardListeners() {
  document.querySelectorAll('.builder-block-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea') || e.target.closest('select') || e.target.closest('[contenteditable="true"]')) return;
      e.stopPropagation();
      e.dataTransfer.setData('application/json', JSON.stringify({ type: 'move', blockId: card.dataset.blockId }));
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => card.classList.add('is-dragging'), 0);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      clearDropIndicators();
      document.getElementById('builderCanvas')?.classList.remove('builder-drag-over');
    });

    card.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      clearDropIndicators();
      const rect = card.getBoundingClientRect();
      const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      card.classList.add(position === 'before' ? 'drop-before' : 'drop-after');
    });

    card.addEventListener('dragleave', e => {
      if (e.relatedTarget && card.contains(e.relatedTarget)) return;
      card.classList.remove('drop-before', 'drop-after');
    });

    card.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      clearDropIndicators();
      document.getElementById('builderCanvas')?.classList.remove('builder-drag-over');
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      try {
        const payload = raw ? JSON.parse(raw) : null;
        if (!payload) return;
        const targetId = card.dataset.blockId;
        const rect = card.getBoundingClientRect();
        const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
        if (payload.type === 'new' && payload.blockType && BLOCK_TYPES[payload.blockType]) {
          const def = BLOCK_TYPES[payload.blockType];
          const newBlock = { id: blockId(), type: payload.blockType, data: { ...def.defaultData } };
          const targetIdx = pageBuilderState.blocks.findIndex(b => b.id === targetId);
          pageBuilderState.blocks.splice(position === 'before' ? targetIdx : targetIdx + 1, 0, newBlock);
          markBuilderDirty();
          rebuildBuilderBlocksDOM();
          selectBlock(newBlock.id);
        } else if (payload.type === 'move' && payload.blockId && payload.blockId !== targetId) {
          const fromIdx = pageBuilderState.blocks.findIndex(b => b.id === payload.blockId);
          const toIdx = pageBuilderState.blocks.findIndex(b => b.id === targetId);
          if (fromIdx < 0 || toIdx < 0) return;
          const [moved] = pageBuilderState.blocks.splice(fromIdx, 1);
          const newToIdx = pageBuilderState.blocks.findIndex(b => b.id === targetId);
          pageBuilderState.blocks.splice(position === 'before' ? newToIdx : newToIdx + 1, 0, moved);
          markBuilderDirty();
          rebuildBuilderBlocksDOM();
        }
      } catch (err) {}
    });

    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      if (e.target.closest('[contenteditable="true"]')) return;
      const blockId = card.dataset.blockId;

      // Detect click on .txt.editor area → enable inline editing
      const txtTarget = e.target.closest('.txt.editor');
      if (txtTarget && card.querySelector('.builder-block-render')?.contains(txtTarget)) {
        const block = pageBuilderState.blocks.find(b => b.id === blockId);
        if (block) {
          const def = BLOCK_TYPES[block.type] || {};
          const moduleName = def.moduleName || block.type;

          // Direct TextSimple block
          if (moduleName === 'TextSimple') {
            if (selectedBlockId !== blockId) selectBlock(blockId);
            enableInlineEditing(blockId);
            return;
          }

          // Direct TextImage block
          if (moduleName === 'TextImage') {
            if (selectedBlockId !== blockId) selectBlock(blockId);
            enableInlineEditing(blockId, txtTarget, block.data);
            return;
          }

          // Direct HeadText block
          if (moduleName === 'HeadText') {
            if (selectedBlockId !== blockId) selectBlock(blockId);
            enableInlineEditing(blockId, txtTarget, block.data);
            return;
          }

          // Accordion block — find which accordion item was clicked
          if (moduleName === 'Accordion') {
            const allTxtEditors = Array.from(card.querySelectorAll('.builder-block-render .accordion .txt.editor'));
            const idx = allTxtEditors.indexOf(txtTarget);
            if (idx !== -1 && Array.isArray(block.data.accordions) && block.data.accordions[idx]) {
              if (selectedBlockId !== blockId) selectBlock(blockId);
              enableInlineEditing(blockId, txtTarget, block.data.accordions[idx]);
              return;
            }
          }

          // SliderTextVideo block — find which slide was clicked
          if (moduleName === 'SliderTextVideo') {
            const allTxtEditors = Array.from(card.querySelectorAll('.builder-block-render .swiper-slide .txt.editor'));
            const idx = allTxtEditors.indexOf(txtTarget);
            if (idx !== -1 && Array.isArray(block.data.slider) && block.data.slider[idx]) {
              if (selectedBlockId !== blockId) selectBlock(blockId);
              enableInlineEditing(blockId, txtTarget, block.data.slider[idx], 'desc');
              return;
            }
          }

          // TextSimple sub-module inside ColumnsTab
          if (moduleName === 'ColumnsTab') {
            // Find which .module-text contains this .txt.editor
            const moduleText = txtTarget.closest('.module-text');
            if (moduleText) {
              const dataRef = _findColumnsSubModuleData(block, moduleText, card);
              if (dataRef) {
                if (selectedBlockId !== blockId) selectBlock(blockId);
                enableInlineEditing(blockId, txtTarget, dataRef);
                return;
              }
            }
          }
        }
      }

      selectBlock(blockId);
    });
  });
  // Attach insert-between button listeners
  document.querySelectorAll('.builder-insert-between').forEach(wrapper => {
    const btn = wrapper.querySelector('.builder-insert-btn');
    if (btn) {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const insertIndex = parseInt(wrapper.dataset.insertIndex, 10);
        window._pendingInsertIndex = insertIndex;
        deselectBlock();
      });
    }
    wrapper.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      wrapper.style.opacity = '1';
      wrapper.style.height = '24px';
    });
    wrapper.addEventListener('dragleave', () => {
      wrapper.style.opacity = '';
      wrapper.style.height = '';
    });
    wrapper.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      wrapper.style.opacity = '';
      wrapper.style.height = '';
      clearDropIndicators();
      document.getElementById('builderCanvas')?.classList.remove('builder-drag-over');
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      try {
        const payload = raw ? JSON.parse(raw) : null;
        if (!payload) return;
        const insertIndex = parseInt(wrapper.dataset.insertIndex, 10);
        if (payload.type === 'new' && payload.blockType && BLOCK_TYPES[payload.blockType]) {
          const def = BLOCK_TYPES[payload.blockType];
          const newBlock = { id: blockId(), type: payload.blockType, data: { ...def.defaultData } };
          pageBuilderState.blocks.splice(insertIndex + 1, 0, newBlock);
          markBuilderDirty();
          rebuildBuilderBlocksDOM();
          selectBlock(newBlock.id);
        } else if (payload.type === 'move' && payload.blockId) {
          const fromIdx = pageBuilderState.blocks.findIndex(b => b.id === payload.blockId);
          if (fromIdx < 0) return;
          const [moved] = pageBuilderState.blocks.splice(fromIdx, 1);
          const adjustedIdx = insertIndex >= fromIdx ? insertIndex : insertIndex + 1;
          pageBuilderState.blocks.splice(adjustedIdx, 0, moved);
          markBuilderDirty();
          rebuildBuilderBlocksDOM();
        }
      } catch (err) {}
    });
  });
  updateSelectedBlockCard();
}

function filterBuilderModules(query) {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  document.querySelectorAll('.builder-modules-list .builder-module-category').forEach(cat => {
    const items = cat.querySelectorAll('.builder-module-item');
    let visibleCount = 0;
    items.forEach(item => {
      const label = (item.textContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const match = !q || label.includes(q);
      item.style.display = match ? '' : 'none';
      if (match) visibleCount++;
    });
    cat.style.display = visibleCount > 0 ? '' : 'none';
  });
}

function addBlockByClick(blockType, insertAfterIndex) {
  if (!BLOCK_TYPES[blockType]) return;
  const def = BLOCK_TYPES[blockType];
  const block = { id: blockId(), type: blockType, data: { ...def.defaultData } };
  const pendingIdx = window._pendingInsertIndex;
  if (typeof insertAfterIndex === 'number' && insertAfterIndex >= 0) {
    pageBuilderState.blocks.splice(insertAfterIndex + 1, 0, block);
  } else if (typeof pendingIdx === 'number' && pendingIdx >= 0) {
    pageBuilderState.blocks.splice(pendingIdx + 1, 0, block);
  } else if (selectedBlockId) {
    const idx = pageBuilderState.blocks.findIndex(b => b.id === selectedBlockId);
    if (idx >= 0) {
      pageBuilderState.blocks.splice(idx + 1, 0, block);
    } else {
      pageBuilderState.blocks.push(block);
    }
  } else {
    pageBuilderState.blocks.push(block);
  }
  window._pendingInsertIndex = undefined;
  markBuilderDirty();
  rebuildBuilderBlocksDOM();
  reattachBlockCardListeners();
  editBlock(block.id);
}

function editBlock(id) {
  selectBlock(id);
}

function saveBlockData(blockId, event) {
  event.preventDefault();
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (!block) return;
  const form = event.target;
  const data = {};
  new FormData(form).forEach((value, key) => { data[key] = value; });
  block.data = data;
  const card = document.querySelector(`[data-block-id="${blockId}"]`);
  if (card) {
    const info = card.querySelector('.builder-block-info');
    if (info) {
      const preview = getBlockPreview(block);
      let previewEl = card.querySelector('.builder-block-preview');
      if (previewEl) previewEl.textContent = preview; else if (preview) { previewEl = document.createElement('span'); previewEl.className = 'builder-block-preview'; previewEl.textContent = preview; info.appendChild(previewEl); }
    }
  }
  renderBlockSettings();
  showToast('Bloc enregistré', 'success');
}

function duplicateBlock(id) {
  const idx = pageBuilderState.blocks.findIndex(b => b.id === id);
  if (idx === -1) return;
  const original = pageBuilderState.blocks[idx];
  const copy = { type: original.type, id: blockId(), data: JSON.parse(JSON.stringify(original.data || {})) };
  pageBuilderState.blocks.splice(idx + 1, 0, copy);
  markBuilderDirty();
  rebuildBuilderBlocksDOM();
  selectBlock(copy.id);
  const newCard = document.querySelector(`.builder-block-card[data-block-id="${copy.id}"]`);
  if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function removeBlock(id) {
  pageBuilderState.blocks = pageBuilderState.blocks.filter(b => b.id !== id);
  markBuilderDirty();
  rebuildBuilderBlocksDOM();
  if (selectedBlockId === id) {
    deselectBlock();
  }
}

async function removeAllBlocks() {
  if (!pageBuilderState.blocks.length) return;
  if (!await confirmModal('Supprimer tous les blocs ?')) return;
  pageBuilderState.blocks = [];
  markBuilderDirty();
  rebuildBuilderBlocksDOM();
  deselectBlock();
}

function updateSelectedBlockCard() {
  document.querySelectorAll('.builder-block-card').forEach(card => {
    if (card.dataset.blockId === selectedBlockId) {
      card.classList.add('is-selected');
    } else {
      card.classList.remove('is-selected');
    }
  });
}

function selectBlock(id) {
  selectedBlockId = id;
  renderBlockSettings();
  updateSelectedBlockCard();
  // Show settings, hide modules list and color overrides panel
  const modulesPanel = document.getElementById('builderModulesPanel');
  const settingsPanel = document.getElementById('builderSettings');
  const colorPanel = document.getElementById('builderColorOverridesPanel');
  const seoPanel = document.getElementById('builderSeoPanel');
  if (modulesPanel) modulesPanel.style.display = 'none';
  if (colorPanel) colorPanel.style.display = 'none';
  if (seoPanel) seoPanel.style.display = 'none';
  if (settingsPanel) settingsPanel.style.display = '';
  // Auto-enable inline editing for TextSimple
  const block = pageBuilderState.blocks.find(b => b.id === id);
  if (block) {
    const def = BLOCK_TYPES[block.type] || {};
    const moduleName = def.moduleName || block.type;
    if (moduleName === 'TextSimple') {
      // Small delay to ensure the card preview is rendered
      setTimeout(() => enableInlineEditing(id), 50);
    }
  }
}

function deselectBlock() {
  disableInlineEditing();
  selectedBlockId = null;
  updateSelectedBlockCard();
  // Show modules list, hide settings
  const modulesPanel = document.getElementById('builderModulesPanel');
  const settingsPanel = document.getElementById('builderSettings');
  if (settingsPanel) {
    destroyWysiwygEditors(settingsPanel);
    settingsPanel.innerHTML = '';
    settingsPanel.style.display = 'none';
  }
  if (modulesPanel) modulesPanel.style.display = '';
}

function renderBuilderSettingsPanel() {
  if (!selectedBlockId) {
    return `<div class="builder-settings-empty">Sélectionnez un module pour le paramétrer.</div>`;
  }
  const block = pageBuilderState.blocks.find(b => b.id === selectedBlockId);
  if (!block) {
    return `<div class="builder-settings-empty">Sélectionnez un module pour le paramétrer.</div>`;
  }
  const def = BLOCK_TYPES[block.type] || { label: block.type, icon: '▦' };
  if (!moduleFieldSchema) {
    return `<div class="builder-settings-empty">Chargement des paramètres…</div>`;
  }
  const moduleName = def.moduleName || block.type;
  const schemaFields = moduleFieldSchema?.modules?.[moduleName]?.fields || [];
  return `
    <div class="builder-settings-header">
      <button type="button" class="btn btn-sm btn-outline builder-settings-back" onclick="deselectBlock()">← Retour aux modules</button>
      <div>
        <div class="builder-settings-title">${escapeHtml(def.label)}</div>
        <div class="builder-settings-subtitle">${escapeHtml(block.type)}</div>
      </div>
    </div>
    ${LEGACY_BLOCK_TYPES[block.type]
      ? renderLegacyBlockForm(block)
      : (schemaFields.length > 0 ? renderSchemaForm(block, schemaFields) : renderKeyValueForm(block))}
  `;
}

function legacyForm(fieldsHtml, onsubmit) {
  return `<form class="builder-block-form" onsubmit="${onsubmit}">
    <div class="settings-fields">${fieldsHtml}</div>
  </form>`;
}

function renderLegacyBlockForm(block) {
  const def = BLOCK_TYPES[block.type] || { defaultData: {} };
  const d = { ...def.defaultData, ...(block.data || {}) };
  const sub = `saveBlockData('${block.id}', event)`;
  if (block.type === 'heading') {
    return legacyForm(`
      <div class="form-group"><label class="form-label">Niveau</label><select name="level" class="form-select"><option value="h2" ${d.level === 'h2' ? 'selected' : ''}>H2</option><option value="h3" ${d.level === 'h3' ? 'selected' : ''}>H3</option><option value="h4" ${d.level === 'h4' ? 'selected' : ''}>H4</option></select></div>
      <div class="form-group"><label class="form-label">Texte</label><input type="text" class="form-input" name="text" value="${escapeHtml(d.text)}"></div>`, sub);
  }
  if (block.type === 'text') {
    return legacyForm(`
      <div class="form-group"><label class="form-label">Titre (optionnel)</label><input type="text" class="form-input" name="title" value="${escapeHtml(d.title)}"></div>
      <div class="form-group"><label class="form-label">Contenu</label><textarea class="form-textarea" name="body" rows="4">${escapeHtml(d.body)}</textarea></div>`, sub);
  }
  if (block.type === 'image') {
    return legacyForm(`
      <div class="form-group"><label class="form-label">URL de l'image</label><input type="text" class="form-input" name="src" value="${escapeHtml(d.src)}" placeholder="https://..."></div>
      <div class="form-group"><label class="form-label">Texte alternatif</label><input type="text" class="form-input" name="alt" value="${escapeHtml(d.alt)}"></div>
      <div class="form-group"><label class="form-label">Légende</label><input type="text" class="form-input" name="caption" value="${escapeHtml(d.caption)}"></div>`, sub);
  }
  if (block.type === 'hero') {
    return legacyForm(`
      <div class="form-group"><label class="form-label">Titre</label><input type="text" class="form-input" name="title" value="${escapeHtml(d.title)}"></div>
      <div class="form-group"><label class="form-label">Sous-titre</label><input type="text" class="form-input" name="subtitle" value="${escapeHtml(d.subtitle)}"></div>
      <div class="form-group"><label class="form-label">Image (URL)</label><input type="text" class="form-input" name="image" value="${escapeHtml(d.image)}"></div>
      <div class="form-group"><label class="form-label">Bouton - Texte</label><input type="text" class="form-input" name="buttonText" value="${escapeHtml(d.buttonText)}"></div>
      <div class="form-group"><label class="form-label">Bouton - Lien</label><input type="text" class="form-input" name="buttonUrl" value="${escapeHtml(d.buttonUrl)}"></div>`, sub);
  }
  if (block.type === 'cta') {
    return legacyForm(`
      <div class="form-group"><label class="form-label">Titre</label><input type="text" class="form-input" name="title" value="${escapeHtml(d.title)}"></div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" name="description" rows="2">${escapeHtml(d.description)}</textarea></div>
      <div class="form-group"><label class="form-label">Bouton - Texte</label><input type="text" class="form-input" name="buttonText" value="${escapeHtml(d.buttonText)}"></div>
      <div class="form-group"><label class="form-label">Bouton - Lien</label><input type="text" class="form-input" name="buttonUrl" value="${escapeHtml(d.buttonUrl)}"></div>`, sub);
  }
  if (block.type === 'spacer') {
    return legacyForm(`
      <div class="form-group"><label class="form-label">Taille</label><select name="size" class="form-select"><option value="small" ${d.size === 'small' ? 'selected' : ''}>Petit</option><option value="medium" ${d.size === 'medium' ? 'selected' : ''}>Moyen</option><option value="large" ${d.size === 'large' ? 'selected' : ''}>Grand</option></select></div>`, sub);
  }
  if (block.type === 'html') {
    return legacyForm(`
      <div class="form-group"><label class="form-label">HTML</label><textarea class="form-textarea" name="content" rows="6" style="font-family:monospace">${escapeHtml(d.content)}</textarea></div>`, sub);
  }
  return '';
}

function renderKeyValueForm(block) {
  const data = block.data && typeof block.data === 'object' ? block.data : {};
  const entries = Object.entries(data);
  const rows = entries.length > 0
    ? entries.map(([key, value]) => renderKeyValueRow(key, value)).join('')
    : renderKeyValueRow('', '');
  return `
    <form class="builder-block-form" onsubmit="saveKeyValueData('${block.id}', event)">
      <div class="settings-fields">
        <div class="form-group">
          <label class="form-label">Paramètres du module</label>
          <div class="kv-list">
            ${rows}
          </div>
          <button type="button" class="btn btn-sm btn-outline" onclick="addKeyValueRow()">+ Ajouter un paramètre</button>
        </div>
      </div>
    </form>
  `;
}

// BlockParams field names — fallback set for modules parsed without isBlockParam flag
const BLOCK_PARAMS_FIELDS = new Set([
  'title', 'id_bloc', 'title_align', 'title_style',
  'bloc_color', 'padding_top', 'padding_bottom',
  'is_visible', 'bg_img', 'bg_opacity', 'bg_parallax',
  'is_fullscreen', 'is_small_marged'
]);

function renderSchemaForm(block, schemaFields) {
  const data = block.data && typeof block.data === 'object' ? { ...block.data } : {};
  // Seed missing fields with their schema defaults so conditionals evaluate correctly on new blocks
  for (const sf of schemaFields) {
    if (data[sf.name] === undefined && sf.defaultValue !== undefined) {
      data[sf.name] = sf.defaultValue;
    }
  }
  const def = BLOCK_TYPES[block.type] || {};
  const moduleName = def.moduleName || block.type;
  const isInlineEditable = (moduleName === 'TextSimple' || moduleName === 'TextImage' || moduleName === 'HeadText');

  const renderField = (field) => {
    // Hide the accordions repeater for Accordion — managed from the preview
    if (moduleName === 'Accordion' && field.type === 'Repeater' && field.name === 'accordions') {
      return `<div class="form-group inline-edit-hint">
        <div class="inline-edit-hint-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          <span>Gérez les éléments directement dans la preview</span>
        </div>
      </div>`;
    }
    // Hide the WYSIWYG text field for inline-editable modules — edited inline in the preview
    if (isInlineEditable && field.type === 'WYSIWYGEditor' && field.name === 'text') {
      return `<div class="form-group inline-edit-hint">
        <div class="inline-edit-hint-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          <span>Cliquez sur le texte dans la preview pour le modifier directement</span>
        </div>
      </div>`;
    }
    let val = data[field.name] !== undefined ? data[field.name] : field.defaultValue;
    // Normalize false to '' for padding fields (PHP default(false) = "Normal" = empty string value)
    if ((field.name === 'padding_top' || field.name === 'padding_bottom') && (val === false || val === 'false' || val === undefined)) val = '';
    return renderSchemaField(field, val, block.id, data);
  };

  // Split fields into content vs params tabs
  // Use the isBlockParam flag from the PHP parser when available; fall back to static set
  const hasBlockParamFlag = schemaFields.some(f => f.isBlockParam === true);
  const contentFields = [];
  const paramFields = [];
  schemaFields.forEach(field => {
    const isParam = hasBlockParamFlag ? (field.isBlockParam === true) : BLOCK_PARAMS_FIELDS.has(field.name);
    if (isParam) {
      paramFields.push(field);
    } else {
      contentFields.push(field);
    }
  });

  const contentHtml = contentFields.map(renderField).join('');
  const paramHtml = paramFields.map(renderField).join('');
  const hasParams = paramFields.length > 0;
  const tabId = `block-tabs-${block.id}`;

  if (!hasParams) {
    // No params tab needed — render flat like before
    return `
      <form class="builder-block-form" onsubmit="saveSchemaData('${block.id}', event)">
        <div class="settings-fields">${contentHtml}</div>
      </form>
    `;
  }

  return `
    <form class="builder-block-form" onsubmit="saveSchemaData('${block.id}', event)">
      <div class="settings-tabs" id="${tabId}">
        <button type="button" class="settings-tab is-active" data-target="#${block.id}-tab-params" onclick="switchBlockTab(this)">Paramètres</button>
        <button type="button" class="settings-tab" data-target="#${block.id}-tab-content" onclick="switchBlockTab(this)">Contenu</button>
      </div>
      <div class="settings-section is-active" id="${block.id}-tab-params">
        <div class="settings-fields">${paramHtml}</div>
      </div>
      <div class="settings-section" id="${block.id}-tab-content">
        <div class="settings-fields">${contentHtml}</div>
      </div>
    </form>
  `;
}

function switchBlockTab(tabBtn) {
  const tabsContainer = tabBtn.parentElement;
  const form = tabsContainer.closest('.builder-block-form');
  // Deactivate all tabs and sections
  tabsContainer.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('is-active'));
  form.querySelectorAll(':scope > .settings-section').forEach(s => s.classList.remove('is-active'));
  // Activate clicked tab and its target section
  tabBtn.classList.add('is-active');
  const target = form.querySelector(tabBtn.getAttribute('data-target'));
  if (target) target.classList.add('is-active');
}

function normalizeBoolVal(val) {
  if (val === true || val === 1) return '1';
  if (val === false || val === 0) return '0';
  return String(val ?? '');
}

// rowCtx = { parentName, rowIndex } when rendering inside a Repeater row or Group
function renderSchemaField(field, value, blockId, allData, rowCtx = null) {
  const html = _renderSchemaFieldHTML(field, value, blockId, rowCtx);
  const cond = field.conditional;
  if (!cond) return html;
  // Look up conditional field value: first in current scope (allData), then fallback to block-level data
  let condFieldVal = allData?.[cond.field];
  if (condFieldVal === undefined && rowCtx) {
    const block = pageBuilderState.blocks.find(b => b.id === blockId);
    const blockData = block?.data && typeof block.data === 'object' ? block.data : {};
    condFieldVal = blockData[cond.field];
  }
  condFieldVal = normalizeBoolVal(condFieldVal);
  const isEmpty = cond.operator === '!=empty' || (cond.operator === '!=' && (cond.value === '' || cond.value === null || cond.value === 'null'));
  const show = isEmpty ? condFieldVal !== '' : (cond.operator === '==' ? condFieldVal === String(cond.value ?? '') : condFieldVal !== String(cond.value ?? ''));
  return `<div class="schema-cond-field" data-cond-field="${escapeHtml(cond.field)}" data-cond-op="${escapeHtml(cond.operator)}" data-cond-val="${escapeHtml(cond.value || '')}"${show ? '' : ' style="display:none"'}>${html}</div>`;
}

function _renderSchemaFieldHTML(field, value, blockId, rowCtx = null) {
  const label = field.label || field.name;
  const name = field.name;
  const type = field.type || 'Text';
  // Dynamic select for form module: populate form_id from API
  if (name === 'form_id') {
    const selectId = `form-select-${blockId}`;
    setTimeout(async () => {
      const sel = document.getElementById(selectId);
      if (!sel) return;
      try {
        const forms = await apiFetch('/forms');
        sel.innerHTML = '<option value="">— Sélectionner un formulaire —</option>' +
          (forms || []).filter(f => f.status === 'active').map(f =>
            `<option value="${f.id}" ${String(value ?? '') === String(f.id) ? 'selected' : ''}>${escapeHtml(f.title)}</option>`
          ).join('');
      } catch (e) {}
    }, 0);
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <select class="form-select" name="${escapeHtml(name)}" id="${selectId}">
          <option value="">Chargement…</option>
        </select>
      </div>
    `;
  }
  // Dynamic select for reusable-bloc module: populate bloc_id from API
  if (name === 'bloc_id') {
    const selectId = `rb-select-${blockId}`;
    // Render placeholder then fetch choices async
    setTimeout(async () => {
      const sel = document.getElementById(selectId);
      if (!sel) return;
      try {
        const blocs = await apiFetch('/reusable-blocs');
        sel.innerHTML = '<option value="">— Sélectionner un bloc —</option>' +
          (blocs || []).filter(b => b.status === 'published').map(b =>
            `<option value="${b.id}" ${String(value ?? '') === String(b.id) ? 'selected' : ''}>${escapeHtml(b.title)}</option>`
          ).join('');
      } catch (e) {}
    }, 0);
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <select class="form-select" name="${escapeHtml(name)}" id="${selectId}">
          <option value="">Chargement…</option>
        </select>
      </div>
    `;
  }
  // Dynamic select for summary module: populate menu_id from API
  if (name === 'menu_id') {
    const selectId = `menu-select-${blockId}`;
    setTimeout(async () => {
      const sel = document.getElementById(selectId);
      if (!sel) return;
      try {
        const menus = await apiFetch('/menus');
        sel.innerHTML = '<option value="">— Sélectionner un menu —</option>' +
          (menus || []).map(m =>
            `<option value="${m.id}" ${String(value ?? '') === String(m.id) ? 'selected' : ''}>${escapeHtml(m.name)}</option>`
          ).join('');
      } catch (e) {}
    }, 0);
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <select class="form-select" name="${escapeHtml(name)}" id="${selectId}">
          <option value="">Chargement…</option>
        </select>
      </div>
    `;
  }
  // Compute the compound input name for nested fields
  const inputName = rowCtx
    ? (rowCtx.rowIndex !== null
        ? `${rowCtx.parentName}::${rowCtx.rowIndex}::${name}`
        : `${rowCtx.parentName}::${name}`)
    : name;
  // data-rfield attribute for row-scoped conditional logic lookup
  const rfieldAttr = rowCtx ? ` data-rfield="${escapeHtml(name)}"` : '';
  const safeValue = escapeHtml(value ?? '');
  const choices = Array.isArray(field.choices) ? field.choices : null;
  if (type === 'WYSIWYGEditor') {
    const editorId = `wysiwyg-${blockId}-${inputName}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <div class="wysiwyg-wrapper">
          <div class="wysiwyg-editor" id="${editorId}">${value || ''}</div>
          <textarea class="form-textarea wysiwyg-source" name="${escapeHtml(inputName)}"${rfieldAttr} style="display:none">${safeValue}</textarea>
        </div>
      </div>
    `;
  }
  if (type === 'Textarea') {
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <textarea class="form-textarea" name="${escapeHtml(inputName)}"${rfieldAttr} rows="4">${safeValue}</textarea>
      </div>
    `;
  }
  if (type === 'TrueFalse') {
    const isChecked = value === true || value === '1' || value === 1 || value === 'yes';
    const onLabel = field.onLabel || 'Oui';
    const offLabel = field.offLabel || 'Non';
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <label class="toggle-field">
          <span class="toggle-label toggle-label-off">${escapeHtml(offLabel)}</span>
          <span class="toggle-switch">
            <input type="checkbox" name="${escapeHtml(inputName)}"${rfieldAttr} ${isChecked ? 'checked' : ''}>
            <span class="toggle-slider" aria-hidden="true"></span>
          </span>
          <span class="toggle-label toggle-label-on">${escapeHtml(onLabel)}</span>
        </label>
      </div>
    `;
  }
  if (type === 'Number' || type === 'Range') {
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <input type="number" class="form-input" name="${escapeHtml(inputName)}"${rfieldAttr} value="${safeValue}">
      </div>
    `;
  }
  if (type === 'ColorPicker') {
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <input type="color" class="form-input" name="${escapeHtml(inputName)}"${rfieldAttr} value="${safeValue || '#000000'}">
      </div>
    `;
  }
  // Rendu spécial pour les champs de couleur de fond de bloc
  const COLOR_FIELDS = ['bloc_color', 'footer_color', 'pdv_footer_color', 'bloc_color_alert'];
  if ((type === 'ButtonGroup' || type === 'RadioButton') && choices && choices.length > 0 && COLOR_FIELDS.includes(name)) {
    const resolvedColors = getResolvedColorMap();
    const COLOR_MAP = {
      'has-background-primary':   { label: 'Primaire',   color: resolvedColors['has-background-primary']   },
      'has-background-secondary': { label: 'Secondaire', color: resolvedColors['has-background-secondary'] },
      'has-background-tertiary':  { label: 'Tertiaire',  color: resolvedColors['has-background-tertiary']  },
      'no-background-color':      { label: 'Aucune',     color: null },
    };
    const options = choices.map((choice, idx) => {
      const id = `${inputName}_${idx}`;
      const checked = String(value ?? '') === String(choice.value);
      const def = COLOR_MAP[choice.value] || { label: choice.label, color: null };
      const swatchHtml = def.color
        ? `<span class="color-swatch" style="background:${escapeHtml(def.color)}"></span>`
        : `<span class="color-swatch color-swatch--none"></span>`;
      return `
        <label class="radio-pill radio-pill--color" for="${escapeHtml(id)}">
          <input type="radio" id="${escapeHtml(id)}" name="${escapeHtml(inputName)}"${rfieldAttr} value="${escapeHtml(choice.value)}" ${checked ? 'checked' : ''}>
          ${swatchHtml}
          <span class="color-label">${escapeHtml(def.label)}</span>
        </label>
      `;
    }).join('');
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <div class="radio-pill-group">
          ${options}
        </div>
      </div>
    `;
  }
  if ((type === 'ButtonGroup' || type === 'RadioButton') && choices && choices.length > 0) {
    const site = siteSettingsCache || {};

    let localChoices = choices.slice();
    if (name === 'padding_top' || name === 'padding_bottom') {
      const hasNormal = localChoices.some(
        (c) => c.value === '' || c.value === false || c.value === 'false'
      );
      if (!hasNormal) {
        localChoices.unshift({ value: '', label: 'Normal' });
      }
    }

    const options = localChoices.map((choice, idx) => {
      const id = `${inputName}_${idx}`;
      const checked = String(value ?? '') === String(choice.value);
      let displayLabel = choice.label;
      let colorDot = '';

      if (name === 'bloc_color' || name === 'footer_color' || name === 'pdv_footer_color' || name === 'bloc_color_alert') {
        if (choice.value === 'no-background-color') {
          displayLabel = 'Aucune';
        } else if (choice.value === 'has-background-primary') {
          displayLabel = 'Primaire';
          if (site.primary_color) colorDot = site.primary_color;
        } else if (choice.value === 'has-background-secondary') {
          displayLabel = 'Secondaire';
          if (site.secondary_color) colorDot = site.secondary_color;
        } else if (choice.value === 'has-background-tertiary') {
          displayLabel = 'Tertiaire';
          if (site.tertiary_color) colorDot = site.tertiary_color;
        }
      }
      if (name === 'columns_background') {
        if (choice.value === 'no-background') {
          displayLabel = 'Aucun';
        } else if (choice.value === 'cols-background-light') {
          displayLabel = 'Clair';
          if (site.background_color) colorDot = site.background_color;
        } else if (choice.value === 'cols-background-primary') {
          displayLabel = 'Primaire';
          if (site.primary_color) colorDot = site.primary_color;
        } else if (choice.value === 'cols-background-secondary') {
          displayLabel = 'Secondaire';
          if (site.secondary_color) colorDot = site.secondary_color;
        } else if (choice.value === 'cols-background-tertiary') {
          displayLabel = 'Tertiaire';
          if (site.tertiary_color) colorDot = site.tertiary_color;
        }
      }

      const dotHtml = colorDot
        ? `<span class="color-dot" style="background: ${escapeHtml(colorDot)}"></span>`
        : '';

      return `
        <label class="radio-pill" for="${escapeHtml(id)}">
          <input type="radio" id="${escapeHtml(id)}" name="${escapeHtml(inputName)}"${rfieldAttr} value="${escapeHtml(choice.value)}" ${checked ? 'checked' : ''}>
          <span>${dotHtml}<span class="color-label">${escapeHtml(String(displayLabel).replace(/<[^>]+>/g, ''))}</span></span>
        </label>
      `;
    }).join('');
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <div class="radio-pill-group">
          ${options}
        </div>
      </div>
    `;
  }
  if (type === 'Select' && choices && choices.length > 0) {
    const options = choices.map(choice => `
      <option value="${escapeHtml(choice.value)}" ${String(value ?? '') === String(choice.value) ? 'selected' : ''}>${escapeHtml(choice.label)}</option>
    `).join('');
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <select class="form-select" name="${escapeHtml(inputName)}"${rfieldAttr}>
          ${options}
        </select>
      </div>
    `;
  }
  if (type === 'URL' || type === 'Url' || type === 'Link') {
    const linkObj = (value && typeof value === 'object') ? value : { url: value || '', title: '', target: '_self' };
    return `
      <div class="form-group link-field-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <div class="link-field" data-field="${escapeHtml(inputName)}">
          <input type="url" class="form-input" name="${escapeHtml(inputName)}__url" placeholder="URL"${rfieldAttr} value="${escapeHtml(linkObj.url || '')}">
          <input type="text" class="form-input" name="${escapeHtml(inputName)}__title" placeholder="Titre du lien" value="${escapeHtml(linkObj.title || '')}">
          <select class="form-select" name="${escapeHtml(inputName)}__target" style="max-width:180px">
            <option value="_self"${linkObj.target !== '_blank' ? ' selected' : ''}>Même fenêtre</option>
            <option value="_blank"${linkObj.target === '_blank' ? ' selected' : ''}>Nouvel onglet</option>
          </select>
        </div>
      </div>
    `;
  }
  if (type === 'Image' || type === 'File' || type === 'Video') {
    const media = normalizeMediaValue(value);
    const url = media?.url || '';
    const isVideo = media?.type === 'video' || type === 'Video';
    const isDocument = media?.type === 'document' || (media?.mime_type && media.mime_type === 'application/pdf');
    const isPdf = isDocument || /\.pdf$/i.test(url);
    const pickerType = type === 'File' ? 'all' : (type === 'Video' ? 'video' : 'image');
    const meta = media?.original_name || media?.name || url || 'Aucun média sélectionné';
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <div class="media-field" data-field="${escapeHtml(inputName)}">
          <div class="media-preview">
            ${url ? (isPdf ? `<div class="media-preview-icon" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f8f9fa;border-radius:8px;padding:1rem;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg></div>` : isVideo ? `<div class="media-preview-icon">🎬</div>` : `<img src="${escapeHtml(getOptimizedUrl(url, 400, 70))}" alt="${escapeHtml(meta)}">`) : ''}
          </div>
          <div class="media-preview-meta">${escapeHtml(meta)}</div>
          <input type="hidden" name="${escapeHtml(inputName)}"${rfieldAttr} value="${escapeHtml(media ? JSON.stringify(media) : '')}">
          <div class="media-field-actions">
            <button type="button" class="btn btn-sm btn-outline" onclick="openMediaPicker('${pickerType}', '${blockId}', '${escapeHtml(inputName)}', { trigger: this })">Choisir</button>
            <button type="button" class="btn btn-sm btn-outline" onclick="clearMediaSelection('${blockId}', '${escapeHtml(inputName)}', this)">Retirer</button>
          </div>
        </div>
      </div>
    `;
  }
  if (type === 'Email') {
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <input type="email" class="form-input" name="${escapeHtml(inputName)}"${rfieldAttr} value="${safeValue}">
      </div>
    `;
  }
  if (type === 'Password') {
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <input type="password" class="form-input" name="${escapeHtml(inputName)}"${rfieldAttr} value="${safeValue}">
      </div>
    `;
  }
  if (type === 'GoogleMap') {
    const mapObj = (value && typeof value === 'object') ? value : {};
    const mapLat = mapObj.lat || '';
    const mapLng = mapObj.lng || '';
    const mapPlaceId = mapObj.place_id || '';
    const mapAddress = mapObj.address || mapObj.name || '';
    const mapStreetNumber = mapObj.street_number || '';
    const mapStreetName = mapObj.street_name || '';
    const mapStreetNameShort = mapObj.street_name_short || '';
    const mapPostCode = mapObj.post_code || '';
    const mapCity = mapObj.city || '';
    const mapName = mapObj.name || '';
    const uid = `gmap-${blockId}-${inputName}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    // Defer initialization to next tick so the DOM is ready
    setTimeout(() => initGoogleMapField(uid), 0);
    return `
      <div class="form-group googlemap-field-group" id="${uid}">
        <label class="form-label">${escapeHtml(label)}</label>
        <div class="googlemap-field" data-field="${escapeHtml(inputName)}">
          <div class="googlemap-search-wrapper">
            <input type="text" class="form-input googlemap-search" name="${escapeHtml(inputName)}__search" placeholder="Rechercher une adresse…" value="${escapeHtml(mapAddress)}" autocomplete="off">
            <div class="googlemap-suggestions"></div>
          </div>
          <div class="googlemap-coords">
            <div class="googlemap-coord-field">
              <label class="form-label form-label-sm">Latitude</label>
              <input type="text" class="form-input form-input-sm" name="${escapeHtml(inputName)}__lat" value="${escapeHtml(String(mapLat))}" placeholder="ex: 48.8566">
            </div>
            <div class="googlemap-coord-field">
              <label class="form-label form-label-sm">Longitude</label>
              <input type="text" class="form-input form-input-sm" name="${escapeHtml(inputName)}__lng" value="${escapeHtml(String(mapLng))}" placeholder="ex: 2.3522">
            </div>
            <div class="googlemap-coord-field">
              <label class="form-label form-label-sm">Place ID</label>
              <input type="text" class="form-input form-input-sm" name="${escapeHtml(inputName)}__place_id" value="${escapeHtml(mapPlaceId)}" placeholder="(optionnel)">
            </div>
          </div>
          <input type="hidden" name="${escapeHtml(inputName)}__street_number" value="${escapeHtml(mapStreetNumber)}">
          <input type="hidden" name="${escapeHtml(inputName)}__street_name" value="${escapeHtml(mapStreetName)}">
          <input type="hidden" name="${escapeHtml(inputName)}__street_name_short" value="${escapeHtml(mapStreetNameShort)}">
          <input type="hidden" name="${escapeHtml(inputName)}__post_code" value="${escapeHtml(mapPostCode)}">
          <input type="hidden" name="${escapeHtml(inputName)}__city" value="${escapeHtml(mapCity)}">
          <input type="hidden" name="${escapeHtml(inputName)}__name" value="${escapeHtml(mapName)}">
          <div class="googlemap-preview"></div>
        </div>
      </div>
    `;
  }
  if (type === 'Repeater') {
    return renderRepeaterFieldHTML(field, value, blockId, rowCtx);
  }
  if (type === 'FlexibleContent') {
    return renderFlexibleContentFieldHTML(field, value, blockId, rowCtx);
  }
  if (type === 'Group') {
    return renderGroupFieldHTML(field, value, blockId, rowCtx);
  }
  return `
    <div class="form-group">
      <label class="form-label">${escapeHtml(label)}</label>
      <input type="text" class="form-input" name="${escapeHtml(inputName)}"${rfieldAttr} value="${safeValue}">
    </div>
  `;
}

// ── Repeater UI ──────────────────────────────────────────────────────────────

function renderRepeaterFieldHTML(field, value, blockId, rowCtx) {
  const rows = Array.isArray(value) ? value : [];
  const subFields = field.subFields || [];
  // Build compound name when nested inside a Repeater/FC item, so child input
  // names stay unique across e.g. ColumnsTab columns containing the same module.
  let compoundName = field.name;
  if (rowCtx) {
    compoundName = rowCtx.rowIndex !== null
      ? `${rowCtx.parentName}::${rowCtx.rowIndex}::${field.name}`
      : `${rowCtx.parentName}::${field.name}`;
  }
  const rowsHtml = rows.map((rowData, i) =>
    renderRepeaterRowHTML(subFields, rowData, i, blockId, compoundName)
  ).join('');
  return `
    <div class="form-group">
      <label class="form-label">${escapeHtml(field.label || field.name)}</label>
      <div class="repeater-field" data-field-name="${escapeHtml(field.name)}" data-field-compound="${escapeHtml(compoundName)}" data-block-id="${escapeHtml(blockId)}">
        <div class="repeater-rows">${rowsHtml}</div>
        <button type="button" class="repeater-add-btn"
          onclick="addRepeaterRow(this, '${escapeHtml(blockId)}', '${escapeHtml(field.name)}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ajouter
        </button>
      </div>
    </div>
  `;
}

function renderRepeaterRowHTML(subFields, rowData, rowIndex, blockId, repeaterName) {
  const rowCtx = { parentName: repeaterName, rowIndex };
  const bodyHtml = subFields.map(f => {
    const val = rowData[f.name] !== undefined ? rowData[f.name] : f.defaultValue;
    return renderSchemaField(f, val, blockId, rowData, rowCtx);
  }).join('');
  return `
    <div class="repeater-row" data-row-index="${rowIndex}">
      <div class="repeater-row-header" onclick="toggleRepeaterRow(this)">
        <span class="repeater-row-number">${rowIndex + 1}</span>
        <span class="repeater-row-title">Élément ${rowIndex + 1}</span>
        <div class="repeater-row-actions">
          <button type="button" class="btn-icon-sm" title="Monter"
            onclick="event.stopPropagation(); moveRepeaterRow(this, -1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
          <button type="button" class="btn-icon-sm" title="Descendre"
            onclick="event.stopPropagation(); moveRepeaterRow(this, 1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <button type="button" class="btn-icon-sm" title="Dupliquer"
            onclick="event.stopPropagation(); duplicateRepeaterRow(this)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button type="button" class="btn-icon-sm btn-icon-sm--danger" title="Supprimer"
            onclick="event.stopPropagation(); removeRepeaterRow(this)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
        <svg class="repeater-row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="repeater-row-body" style="display:none">${bodyHtml}</div>
    </div>
  `;
}

function renderGroupFieldHTML(field, value, blockId, parentRowCtx) {
  const subFields = field.subFields || [];
  const groupData = (value && typeof value === 'object') ? value : {};
  let compoundName = field.name;
  if (parentRowCtx) {
    compoundName = parentRowCtx.rowIndex !== null
      ? `${parentRowCtx.parentName}::${parentRowCtx.rowIndex}::${field.name}`
      : `${parentRowCtx.parentName}::${field.name}`;
  }
  const rowCtx = { parentName: compoundName, rowIndex: null };
  const bodyHtml = subFields.map(f => {
    const val = groupData[f.name] !== undefined ? groupData[f.name] : f.defaultValue;
    return renderSchemaField(f, val, blockId, groupData, rowCtx);
  }).join('');
  return `
    <div class="group-field">
      <div class="group-field-header" onclick="toggleGroupField(this)">
        <span class="group-field-title">${escapeHtml(field.label || field.name)}</span>
        <svg class="group-field-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="group-field-body" style="display:none">${bodyHtml}</div>
    </div>
  `;
}

// ── FlexibleContent UI ──────────────────────────────────────────────────────

function renderFlexibleContentFieldHTML(field, value, blockId, rowCtx) {
  const items = Array.isArray(value) ? value : [];
  const fcFieldName = field.name;
  // Build the compound name for this flex field (could be nested inside a repeater)
  let fcCompoundName = fcFieldName;
  if (rowCtx) {
    fcCompoundName = rowCtx.rowIndex !== null
      ? `${rowCtx.parentName}::${rowCtx.rowIndex}::${fcFieldName}`
      : `${rowCtx.parentName}::${fcFieldName}`;
  }

  const itemsHtml = items.map((item, i) =>
    renderFlexibleContentItemHTML(item, i, blockId, fcCompoundName)
  ).join('');

  // Build the module type dropdown — exclude ColumnsTab (infinite nesting) and legacy blocks
  // (legacy types like 'text' collide with Nickl layout slugs and aren't meant for sub-modules)
  const excludeTypes = new Set(['columns-tab', 'ColumnsTab']);
  const dropdownOptions = Object.entries(BLOCK_TYPES)
    .filter(([key, def]) => !def.aliasFor && !def.legacy && !excludeTypes.has(key))
    .map(([key, def]) => `<option value="${escapeHtml(key)}">${escapeHtml(def.label || key)}</option>`)
    .join('');

  return `
    <div class="form-group">
      <label class="form-label">${escapeHtml(field.label || field.name)}</label>
      <div class="flexible-content-field" data-field-name="${escapeHtml(fcCompoundName)}" data-block-id="${escapeHtml(blockId)}">
        <div class="flexible-content-items">${itemsHtml}</div>
        <div class="flexible-content-add">
          <select class="form-select flexible-content-type-select">
            <option value="">— Choisir un module —</option>
            ${dropdownOptions}
          </select>
          <button type="button" class="repeater-add-btn"
            onclick="addFlexibleContentItem(this, '${escapeHtml(blockId)}', '${escapeHtml(fcCompoundName)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ajouter
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderFlexibleContentItemHTML(item, index, blockId, fcCompoundName) {
  const layout = item.acf_fc_layout || '';
  const def = BLOCK_TYPES[layout] || {};
  let moduleName = def.moduleName || layout;
  // Fallback: layout may be a slug (e.g. 'text' for TextSimple) — resolve via reverse map
  if (!moduleFieldSchema?.modules?.[moduleName]) {
    const map = getLayoutToModuleNameMap();
    if (map[layout]) moduleName = map[layout];
  }
  const moduleLabel = def.label || MODULE_LABELS[moduleName] || layout;

  // Get schema fields for this module type
  const schemaFields = moduleFieldSchema?.modules?.[moduleName]?.fields || [];
  // Filter out BlockParams fields that are handled by the parent wrapper
  const skipFields = new Set(['title_bloc', 'title_style', 'title_align', 'bloc_color', 'padding_top', 'padding_bottom', 'is_visible', 'bg_img', 'bg_opacity', 'bg_parallax']);
  const itemFields = schemaFields.filter(f => !skipFields.has(f.name));

  const rowCtx = { parentName: `${fcCompoundName}::${index}`, rowIndex: null };
  const bodyHtml = itemFields.map(f => {
    const val = item[f.name] !== undefined ? item[f.name] : f.defaultValue;
    return renderSchemaField(f, val, blockId, item, rowCtx);
  }).join('');

  return `
    <div class="repeater-row flexible-content-item" data-row-index="${index}" data-layout="${escapeHtml(layout)}">
      <input type="hidden" name="${escapeHtml(fcCompoundName)}::${index}::acf_fc_layout" value="${escapeHtml(layout)}">
      <div class="repeater-row-header" onclick="toggleRepeaterRow(this)">
        <span class="repeater-row-number">${index + 1}</span>
        <span class="repeater-row-title">${escapeHtml(moduleLabel)}</span>
        <div class="repeater-row-actions">
          <button type="button" class="btn-icon-sm" title="Monter"
            onclick="event.stopPropagation(); moveFlexibleContentItem(this, -1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
          <button type="button" class="btn-icon-sm" title="Descendre"
            onclick="event.stopPropagation(); moveFlexibleContentItem(this, 1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <button type="button" class="btn-icon-sm" title="Dupliquer"
            onclick="event.stopPropagation(); duplicateFlexibleContentItem(this)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button type="button" class="btn-icon-sm btn-icon-sm--danger" title="Supprimer"
            onclick="event.stopPropagation(); removeFlexibleContentItem(this)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
        <svg class="repeater-row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="repeater-row-body" style="display:none">${bodyHtml}</div>
    </div>
  `;
}

function collectFlexibleContentData(form, fcCompoundName) {
  const container = form.querySelector(`.flexible-content-field[data-field-name="${CSS.escape(fcCompoundName)}"]`);
  if (!container) return [];
  const items = container.querySelectorAll(':scope > .flexible-content-items > .flexible-content-item');
  return Array.from(items).map((itemEl, idx) => {
    const layout = itemEl.dataset.layout || '';
    const def = BLOCK_TYPES[layout] || {};
    let moduleName = def.moduleName || layout;
    // Fallback: layout may be a slug (e.g. 'text' for TextSimple) — resolve via reverse map
    if (!moduleFieldSchema?.modules?.[moduleName]) {
      const map = getLayoutToModuleNameMap();
      if (map[layout]) moduleName = map[layout];
    }
    const schemaFields = moduleFieldSchema?.modules?.[moduleName]?.fields || [];
    const skipFields = new Set(['title_bloc', 'title_style', 'title_align', 'bloc_color', 'padding_top', 'padding_bottom', 'is_visible', 'bg_img', 'bg_opacity', 'bg_parallax']);
    const itemFields = schemaFields.filter(f => !skipFields.has(f.name));

    const parentName = `${fcCompoundName}::${idx}`;
    const itemData = { acf_fc_layout: layout };
    for (const f of itemFields) {
      const compoundName = `${parentName}::${f.name}`;
      if (f.type === 'Image' || f.type === 'File' || f.type === 'Video') {
        const mediaInput = itemEl.querySelector(`.media-field[data-field="${CSS.escape(compoundName)}"] input[type="hidden"]`);
        if (mediaInput?.value) {
          try { itemData[f.name] = JSON.parse(mediaInput.value); } catch { itemData[f.name] = mediaInput.value; }
        } else {
          itemData[f.name] = '';
        }
      } else if (f.type === 'TrueFalse') {
        const input = itemEl.querySelector(`[name="${CSS.escape(compoundName)}"]`);
        itemData[f.name] = input ? !!input.checked : false;
      } else if (f.type === 'ButtonGroup' || f.type === 'RadioButton') {
        const checked = itemEl.querySelector(`[name="${CSS.escape(compoundName)}"]:checked`);
        itemData[f.name] = checked ? checked.value : '';
      } else if (f.type === 'Number' || f.type === 'Range') {
        const input = itemEl.querySelector(`[name="${CSS.escape(compoundName)}"]`);
        itemData[f.name] = input ? (input.value === '' ? '' : Number(input.value)) : '';
      } else if (f.type === 'URL' || f.type === 'Url' || f.type === 'Link') {
        const urlInput = itemEl.querySelector(`[name="${CSS.escape(compoundName + '__url')}"]`);
        const titleInput = itemEl.querySelector(`[name="${CSS.escape(compoundName + '__title')}"]`);
        const targetInput = itemEl.querySelector(`[name="${CSS.escape(compoundName + '__target')}"]`);
        const url = urlInput ? urlInput.value : '';
        itemData[f.name] = url ? { url, title: titleInput ? titleInput.value : '', target: targetInput ? targetInput.value : '_self' } : '';
      } else if (f.type === 'Repeater') {
        itemData[f.name] = collectRepeaterData(itemEl, f.name, f.subFields || []);
      } else {
        const input = itemEl.querySelector(`[name="${CSS.escape(compoundName)}"]`);
        itemData[f.name] = input ? input.value : '';
      }
    }
    return itemData;
  });
}

function addFlexibleContentItem(button, blockId, fcCompoundName) {
  const container = button.closest('.flexible-content-field');
  if (!container) return;
  const select = container.querySelector('.flexible-content-type-select');
  const selectedType = select ? select.value : '';
  if (!selectedType) {
    alert('Veuillez choisir un type de module.');
    return;
  }

  // Collect existing items data
  const form = container.closest('form');
  const existingData = form ? collectFlexibleContentData(form, fcCompoundName) : [];

  // Add new item
  existingData.push({ acf_fc_layout: selectedType });

  // Re-render all items
  reRenderFlexibleContentItems(container, existingData, blockId, fcCompoundName);

  // Reset dropdown
  if (select) select.value = '';

  // Sync to block data
  syncFlexibleContentToBlock(blockId, fcCompoundName, existingData);

  // Expand the last item
  const items = container.querySelectorAll('.flexible-content-items > .flexible-content-item');
  const lastItem = items[items.length - 1];
  if (lastItem) {
    const body = lastItem.querySelector('.repeater-row-body');
    if (body) body.style.display = '';
    lastItem.classList.add('is-open');
  }
}

function removeFlexibleContentItem(button) {
  const item = button.closest('.flexible-content-item');
  const container = item?.closest('.flexible-content-field');
  if (!container) return;
  const blockId = container.dataset.blockId;
  const fcCompoundName = container.dataset.fieldName;
  const form = container.closest('form');
  const allData = form ? collectFlexibleContentData(form, fcCompoundName) : [];
  const idx = parseInt(item.dataset.rowIndex, 10);
  allData.splice(idx, 1);
  reRenderFlexibleContentItems(container, allData, blockId, fcCompoundName);
  syncFlexibleContentToBlock(blockId, fcCompoundName, allData);
}

function moveFlexibleContentItem(button, direction) {
  const item = button.closest('.flexible-content-item');
  const container = item?.closest('.flexible-content-field');
  if (!container) return;
  const blockId = container.dataset.blockId;
  const fcCompoundName = container.dataset.fieldName;
  const form = container.closest('form');
  const allData = form ? collectFlexibleContentData(form, fcCompoundName) : [];
  const idx = parseInt(item.dataset.rowIndex, 10);
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= allData.length) return;
  [allData[idx], allData[targetIdx]] = [allData[targetIdx], allData[idx]];
  reRenderFlexibleContentItems(container, allData, blockId, fcCompoundName);
  syncFlexibleContentToBlock(blockId, fcCompoundName, allData);
}

function duplicateFlexibleContentItem(button) {
  const item = button.closest('.flexible-content-item');
  const container = item?.closest('.flexible-content-field');
  if (!container) return;
  const blockId = container.dataset.blockId;
  const fcCompoundName = container.dataset.fieldName;
  const form = container.closest('form');
  const allData = form ? collectFlexibleContentData(form, fcCompoundName) : [];
  const idx = parseInt(item.dataset.rowIndex, 10);
  const clone = JSON.parse(JSON.stringify(allData[idx]));
  allData.splice(idx + 1, 0, clone);
  reRenderFlexibleContentItems(container, allData, blockId, fcCompoundName);
  syncFlexibleContentToBlock(blockId, fcCompoundName, allData);
  const items = container.querySelectorAll('.flexible-content-items > .flexible-content-item');
  const dup = items[idx + 1];
  if (dup) {
    const body = dup.querySelector('.repeater-row-body');
    if (body) body.style.display = '';
    dup.classList.add('is-open');
  }
}

function reRenderFlexibleContentItems(container, allData, blockId, fcCompoundName) {
  destroyWysiwygEditors(container);
  const itemsContainer = container.querySelector('.flexible-content-items');
  itemsContainer.innerHTML = allData.map((itemData, i) =>
    renderFlexibleContentItemHTML(itemData, i, blockId, fcCompoundName)
  ).join('');
  const form = container.closest('form');
  if (form) updateSchemaConditionals(form);
  initWysiwygEditors(container);
}

function syncFlexibleContentToBlock(blockId, fcCompoundName, data) {
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (!block) return;
  if (!block.data || typeof block.data !== 'object') block.data = {};

  // Parse compound name to set the correct nested path
  // e.g. "columns_list::0::columns_module" → block.data.columns_list[0].columns_module = data
  const parts = fcCompoundName.split('::');
  let target = block.data;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const isIdx = /^\d+$/.test(nextPart);
    if (/^\d+$/.test(part)) {
      const idx = parseInt(part, 10);
      if (!Array.isArray(target)) break;
      if (!target[idx] || typeof target[idx] !== 'object') target[idx] = {};
      target = target[idx];
    } else {
      if (isIdx) {
        if (!Array.isArray(target[part])) target[part] = [];
      } else {
        if (!target[part] || typeof target[part] !== 'object') target[part] = {};
      }
      target = target[part];
    }
  }
  const lastPart = parts[parts.length - 1];
  target[lastPart] = data;

  updateBlockCardPreview(blockId);
}

// ── Repeater interactions ─────────────────────────────────────────────────────

function toggleRepeaterRow(header) {
  const row = header.closest('.repeater-row');
  if (!row) return;
  const body = row.querySelector('.repeater-row-body');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  row.classList.toggle('is-open', !open);
}

function toggleGroupField(header) {
  const group = header.closest('.group-field');
  if (!group) return;
  const body = group.querySelector('.group-field-body');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  group.classList.toggle('is-open', !open);
}

function _getRepeaterSchema(blockId, fieldName, domContext) {
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (!block) return null;

  let moduleName;
  // When inside a flexible content sub-module, look up the sub-module's schema
  if (domContext) {
    const fcItem = domContext.closest('.flexible-content-item');
    if (fcItem) {
      const layout = fcItem.dataset.layout || '';
      const subDef = BLOCK_TYPES[layout] || {};
      moduleName = subDef.moduleName || layout;
    }
  }
  if (!moduleName) {
    const def = BLOCK_TYPES[block.type] || {};
    moduleName = def.moduleName || block.type;
  }
  const schemaFields = moduleFieldSchema?.modules?.[moduleName]?.fields || [];
  return schemaFields.find(f => f.name === fieldName && f.type === 'Repeater') || null;
}

// Collect repeater data directly from a container element (avoids form-wide search ambiguity)
function _collectRepeaterFromContainer(container, fieldName, subFields) {
  // Use compound name for input name queries when nested (ensures sub-field
  // inputs match unique names like "columns_list::0::columns_module::0::logos::0::logo")
  const compound = container.dataset.fieldCompound || fieldName;
  const rows = container.querySelectorAll(':scope > .repeater-rows > .repeater-row');
  return Array.from(rows).map((row, i) =>
    collectContainerData(row, compound, subFields, i)
  );
}

// Sync repeater data to block.data — handles nested sub-module context
function _syncRepeaterToBlock(container, blockId) {
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (!block) return;
  // If inside a flexible content sub-module, re-collect the entire block data
  const fcItem = container.closest('.flexible-content-item');
  if (fcItem) {
    const form = container.closest('form');
    if (form) liveUpdateFromSettingsForm(form);
  } else {
    // Direct field — collect from container
    const fieldName = container.dataset.fieldName;
    const repeaterField = _getRepeaterSchema(blockId, fieldName, container);
    if (!repeaterField?.subFields) return;
    if (!block.data || typeof block.data !== 'object') block.data = {};
    block.data[fieldName] = _collectRepeaterFromContainer(container, fieldName, repeaterField.subFields);
  }
  updateBlockCardPreview(blockId);
}

function collectContainerData(scope, parentName, subFields, rowIndex) {
  const rowData = {};
  for (const f of subFields) {
    const compoundName = rowIndex !== null
      ? `${parentName}::${rowIndex}::${f.name}`
      : `${parentName}::${f.name}`;
    if (f.type === 'Image' || f.type === 'File' || f.type === 'Video') {
      const mediaInput = scope.querySelector(`.media-field[data-field="${CSS.escape(compoundName)}"] input[type="hidden"]`);
      if (mediaInput?.value) {
        try { rowData[f.name] = JSON.parse(mediaInput.value); } catch { rowData[f.name] = mediaInput.value; }
      } else {
        rowData[f.name] = '';
      }
    } else if (f.type === 'TrueFalse') {
      const input = scope.querySelector(`[name="${CSS.escape(compoundName)}"]`);
      rowData[f.name] = input ? !!input.checked : false;
    } else if (f.type === 'ButtonGroup' || f.type === 'RadioButton') {
      const checked = scope.querySelector(`[name="${CSS.escape(compoundName)}"]:checked`);
      rowData[f.name] = checked ? checked.value : '';
    } else if (f.type === 'Number' || f.type === 'Range') {
      const input = scope.querySelector(`[name="${CSS.escape(compoundName)}"]`);
      rowData[f.name] = input ? (input.value === '' ? '' : Number(input.value)) : '';
    } else if (f.type === 'URL' || f.type === 'Url' || f.type === 'Link') {
      const urlInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__url')}"]`);
      const titleInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__title')}"]`);
      const targetInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__target')}"]`);
      const url = urlInput ? urlInput.value : '';
      rowData[f.name] = url ? { url, title: titleInput ? titleInput.value : '', target: targetInput ? targetInput.value : '_self' } : '';
    } else if (f.type === 'GoogleMap') {
      const latInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__lat')}"]`);
      const lngInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__lng')}"]`);
      const placeIdInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__place_id')}"]`);
      const searchInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__search')}"]`);
      const streetNumberInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__street_number')}"]`);
      const streetNameInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__street_name')}"]`);
      const streetNameShortInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__street_name_short')}"]`);
      const postCodeInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__post_code')}"]`);
      const cityInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__city')}"]`);
      const nameInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__name')}"]`);
      const lat = latInput ? parseFloat(latInput.value) : 0;
      const lng = lngInput ? parseFloat(lngInput.value) : 0;
      rowData[f.name] = (lat || lng) ? {
        lat: lat || 0,
        lng: lng || 0,
        place_id: placeIdInput ? placeIdInput.value : '',
        address: searchInput ? searchInput.value : '',
        name: nameInput ? nameInput.value : (searchInput ? searchInput.value : ''),
        street_number: streetNumberInput ? streetNumberInput.value : '',
        street_name: streetNameInput ? streetNameInput.value : '',
        street_name_short: streetNameShortInput ? streetNameShortInput.value : '',
        post_code: postCodeInput ? postCodeInput.value : '',
        city: cityInput ? cityInput.value : '',
      } : null;
    } else if (f.type === 'FlexibleContent') {
      const form = scope.closest('form') || scope;
      rowData[f.name] = collectFlexibleContentData(form, compoundName);
    } else if (f.type === 'Repeater') {
      rowData[f.name] = collectRepeaterData(scope, f.name, f.subFields || []);
    } else {
      const input = scope.querySelector(`[name="${CSS.escape(compoundName)}"]`);
      rowData[f.name] = input ? input.value : '';
    }
  }
  return rowData;
}

function collectRepeaterData(form, repeaterName, subFields) {
  const container = form.querySelector(`.repeater-field[data-field-name="${CSS.escape(repeaterName)}"]`);
  if (!container) return [];
  // Use compound name for sub-field input lookups when this repeater is nested
  // inside a FlexibleContent item (e.g. ColumnsTab columns).
  const compound = container.dataset.fieldCompound || repeaterName;
  // Use :scope > .repeater-rows > .repeater-row to avoid selecting nested
  // FlexibleContent items that also have the .repeater-row class.
  const rows = container.querySelectorAll(':scope > .repeater-rows > .repeater-row');
  return Array.from(rows).map((row, rowIndex) =>
    collectContainerData(row, compound, subFields, rowIndex)
  );
}

function reRenderRepeaterRows(container, subFields, allData, blockId, repeaterName) {
  destroyWysiwygEditors(container);
  const rowsContainer = container.querySelector('.repeater-rows');
  rowsContainer.innerHTML = allData.map((rowData, i) =>
    renderRepeaterRowHTML(subFields, rowData, i, blockId, repeaterName)
  ).join('');
  const form = container.closest('form');
  if (form) updateSchemaConditionals(form);
  initWysiwygEditors(container);
}

function addRepeaterRow(button, blockId, fieldName) {
  const container = button.closest('.repeater-field');
  if (!container) return;
  const repeaterField = _getRepeaterSchema(blockId, fieldName, container);
  if (!repeaterField?.subFields) return;
  const compound = container.dataset.fieldCompound || fieldName;
  const existingData = _collectRepeaterFromContainer(container, fieldName, repeaterField.subFields);
  // Initialize new row: default TrueFalse sub-fields to true so image/visibility fields start ON
  const newRowDefaults = {};
  for (const f of repeaterField.subFields) {
    if (f.type === 'TrueFalse') newRowDefaults[f.name] = true;
  }
  existingData.push(newRowDefaults);
  reRenderRepeaterRows(container, repeaterField.subFields, existingData, blockId, compound);
  _syncRepeaterToBlock(container, blockId);
  // Expand the last row
  const rows = container.querySelectorAll(':scope > .repeater-rows > .repeater-row');
  const lastRow = rows[rows.length - 1];
  if (lastRow) {
    const body = lastRow.querySelector('.repeater-row-body');
    if (body) body.style.display = '';
    lastRow.classList.add('is-open');
  }
  const form = container.closest('form');
  if (form) updateSchemaConditionals(form);
}

function removeRepeaterRow(button) {
  const row = button.closest('.repeater-row');
  const container = row?.closest('.repeater-field');
  if (!container) return;
  const blockId = container.dataset.blockId;
  const fieldName = container.dataset.fieldName;
  const compound = container.dataset.fieldCompound || fieldName;
  const repeaterField = _getRepeaterSchema(blockId, fieldName, container);
  if (!repeaterField?.subFields) return;
  const allData = _collectRepeaterFromContainer(container, fieldName, repeaterField.subFields);
  const rowIndex = parseInt(row.dataset.rowIndex, 10);
  allData.splice(rowIndex, 1);
  reRenderRepeaterRows(container, repeaterField.subFields, allData, blockId, compound);
  _syncRepeaterToBlock(container, blockId);
}

function moveRepeaterRow(button, direction) {
  const row = button.closest('.repeater-row');
  const container = row?.closest('.repeater-field');
  if (!container) return;
  const blockId = container.dataset.blockId;
  const fieldName = container.dataset.fieldName;
  const compound = container.dataset.fieldCompound || fieldName;
  const repeaterField = _getRepeaterSchema(blockId, fieldName, container);
  if (!repeaterField?.subFields) return;
  const allData = _collectRepeaterFromContainer(container, fieldName, repeaterField.subFields);
  const rowIndex = parseInt(row.dataset.rowIndex, 10);
  const targetIndex = rowIndex + direction;
  if (targetIndex < 0 || targetIndex >= allData.length) return;
  [allData[rowIndex], allData[targetIndex]] = [allData[targetIndex], allData[rowIndex]];
  reRenderRepeaterRows(container, repeaterField.subFields, allData, blockId, compound);
  _syncRepeaterToBlock(container, blockId);
  // Expand the moved row
  const rows = container.querySelectorAll(':scope > .repeater-rows > .repeater-row');
  const movedRow = rows[targetIndex];
  if (movedRow) {
    const body = movedRow.querySelector('.repeater-row-body');
    if (body) body.style.display = '';
  }
}

function duplicateRepeaterRow(button) {
  const row = button.closest('.repeater-row');
  const container = row?.closest('.repeater-field');
  if (!container) return;
  const blockId = container.dataset.blockId;
  const fieldName = container.dataset.fieldName;
  const compound = container.dataset.fieldCompound || fieldName;
  const repeaterField = _getRepeaterSchema(blockId, fieldName, container);
  if (!repeaterField?.subFields) return;
  const allData = _collectRepeaterFromContainer(container, fieldName, repeaterField.subFields);
  const rowIndex = parseInt(row.dataset.rowIndex, 10);
  const clone = JSON.parse(JSON.stringify(allData[rowIndex]));
  allData.splice(rowIndex + 1, 0, clone);
  reRenderRepeaterRows(container, repeaterField.subFields, allData, blockId, compound);
  _syncRepeaterToBlock(container, blockId);
  const rows = container.querySelectorAll(':scope > .repeater-rows > .repeater-row');
  const dup = rows[rowIndex + 1];
  if (dup) {
    const body = dup.querySelector('.repeater-row-body');
    if (body) body.style.display = '';
    dup.classList.add('is-open');
  }
  const form = container.closest('form');
  if (form) updateSchemaConditionals(form);
}

function renderKeyValueRow(key, value) {
  return `
    <div class="kv-row">
      <input type="text" class="form-input kv-key" placeholder="Clé" value="${escapeHtml(key)}">
      <input type="text" class="form-input kv-value" placeholder="Valeur" value="${escapeHtml(value)}">
      <button type="button" class="btn btn-sm btn-outline" onclick="removeKeyValueRow(this)">Retirer</button>
    </div>
  `;
}

function addKeyValueRow() {
  const panel = document.getElementById('builderSettings');
  if (!panel) return;
  const list = panel.querySelector('.kv-list');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'kv-row';
  row.innerHTML = `
    <input type="text" class="form-input kv-key" placeholder="Clé" value="">
    <input type="text" class="form-input kv-value" placeholder="Valeur" value="">
    <button type="button" class="btn btn-sm btn-outline" onclick="removeKeyValueRow(this)">Retirer</button>
  `;
  list.appendChild(row);
}

function removeKeyValueRow(button) {
  const row = button?.closest('.kv-row');
  if (row) row.remove();
}

function saveKeyValueData(blockId, event) {
  event.preventDefault();
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (!block) return;
  const form = event.target;
  const data = {};
  form.querySelectorAll('.kv-row').forEach(row => {
    const key = row.querySelector('.kv-key')?.value?.trim();
    const value = row.querySelector('.kv-value')?.value ?? '';
    if (key) data[key] = value;
  });
  block.data = data;
  updateBlockCardPreview(blockId);
  showToast('Bloc enregistré', 'success');
}

function saveSchemaData(blockId, event) {
  event.preventDefault();
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (!block) return;
  const form = event.target;
  const def = BLOCK_TYPES[block.type] || {};
  const moduleName = def.moduleName || block.type;
  const schemaFields = moduleFieldSchema?.modules?.[moduleName]?.fields || [];
  const data = { ...(block.data && typeof block.data === 'object' ? block.data : {}) };
  schemaFields.forEach(field => {
    const name = field.name;
    const type = field.type || 'Text';
    if (type === 'Repeater') {
      const rc = form.querySelector(`.repeater-field[data-field-name="${CSS.escape(name)}"]`);
      if (!rc && data[name] !== undefined) return; // hidden repeater (e.g. Accordion inline) — keep existing data
      data[name] = collectRepeaterData(form, name, field.subFields || []);
      return;
    }
    if (type === 'FlexibleContent') {
      data[name] = collectFlexibleContentData(form, name);
      return;
    }
    if (type === 'Group') {
      data[name] = collectContainerData(form, name, field.subFields || [], null);
      return;
    }
    // Les champs média (Image / File / Video) sont déjà mis à jour
    // par le sélecteur de médiathèque. On ne les touche pas ici pour
    // éviter d'écraser les données (et donc de perdre l'image de fond)
    // à chaque changement d'un autre paramètre.
    if (type === 'Image' || type === 'File' || type === 'Video') return;
    if (type === 'GoogleMap') {
      const latInput = form.querySelector(`[name="${CSS.escape(name + '__lat')}"]`);
      const lngInput = form.querySelector(`[name="${CSS.escape(name + '__lng')}"]`);
      const placeIdInput = form.querySelector(`[name="${CSS.escape(name + '__place_id')}"]`);
      const searchInput = form.querySelector(`[name="${CSS.escape(name + '__search')}"]`);
      const lat = latInput ? parseFloat(latInput.value) : 0;
      const lng = lngInput ? parseFloat(lngInput.value) : 0;
      const streetNumberInput = form.querySelector(`[name="${CSS.escape(name + '__street_number')}"]`);
      const streetNameInput = form.querySelector(`[name="${CSS.escape(name + '__street_name')}"]`);
      const streetNameShortInput = form.querySelector(`[name="${CSS.escape(name + '__street_name_short')}"]`);
      const postCodeInput = form.querySelector(`[name="${CSS.escape(name + '__post_code')}"]`);
      const cityInput = form.querySelector(`[name="${CSS.escape(name + '__city')}"]`);
      const nameInput = form.querySelector(`[name="${CSS.escape(name + '__name')}"]`);
      data[name] = (lat || lng) ? {
        lat: lat || 0, lng: lng || 0,
        place_id: placeIdInput ? placeIdInput.value : '',
        address: searchInput ? searchInput.value : '',
        name: nameInput ? nameInput.value : (searchInput ? searchInput.value : ''),
        street_number: streetNumberInput ? streetNumberInput.value : '',
        street_name: streetNameInput ? streetNameInput.value : '',
        street_name_short: streetNameShortInput ? streetNameShortInput.value : '',
        post_code: postCodeInput ? postCodeInput.value : '',
        city: cityInput ? cityInput.value : '',
      } : null;
      return;
    }
    if (type === 'URL' || type === 'Url' || type === 'Link') {
      const urlInput = form.querySelector(`[name="${CSS.escape(name + '__url')}"]`);
      const titleInput = form.querySelector(`[name="${CSS.escape(name + '__title')}"]`);
      const targetInput = form.querySelector(`[name="${CSS.escape(name + '__target')}"]`);
      const url = urlInput ? urlInput.value : '';
      data[name] = url ? { url, title: titleInput ? titleInput.value : '', target: targetInput ? targetInput.value : '_self' } : '';
      return;
    }
    const input = form.querySelector(`[name="${CSS.escape(name)}"]`);
    if (!input) return;
    if (type === 'TrueFalse') {
      data[name] = !!input.checked;
    } else if (type === 'Number' || type === 'Range') {
      const raw = input.value;
      data[name] = raw === '' ? '' : Number(raw);
    } else if (type === 'ButtonGroup' || type === 'RadioButton') {
      const checked = form.querySelector(`[name="${CSS.escape(name)}"]:checked`);
      data[name] = checked ? checked.value : '';
    } else {
      data[name] = input.value;
    }
  });
  block.data = data;
  updateBlockCardPreview(blockId);
  showToast('Bloc enregistré', 'success');
}

function updateSchemaConditionals(form) {
  form.querySelectorAll('.schema-cond-field').forEach(wrapper => {
    const condField = wrapper.dataset.condField;
    const condOp = wrapper.dataset.condOp;
    const condVal = wrapper.dataset.condVal;
    // Inside a repeater row or group body, scope the lookup to that container
    const containerBody = wrapper.closest('.repeater-row-body, .group-field-body');
    let input;
    if (containerBody) {
      // Sub-field inputs have data-rfield for row-scoped lookup
      input = containerBody.querySelector(`[data-rfield="${CSS.escape(condField)}"]`);
      // Fallback to form-level if the field is not inside the repeater (cross-scope conditional)
      if (!input) input = form.querySelector(`[name="${CSS.escape(condField)}"]`);
    } else {
      input = form.querySelector(`[name="${CSS.escape(condField)}"]`);
    }
    // For radio buttons, find the checked input, not just the first one
    let currentVal = '';
    if (input) {
      if (input.type === 'checkbox') {
        currentVal = input.checked ? '1' : '0';
      } else if (input.type === 'radio') {
        const checked = form.querySelector(`[name="${CSS.escape(condField)}"]:checked`);
        currentVal = checked ? checked.value : '';
      } else {
        currentVal = input.value ?? '';
      }
    }
    const isEmpty = condOp === '!=empty' || (condOp === '!=' && (condVal === '' || condVal === 'null'));
    const show = isEmpty ? currentVal !== '' : (condOp === '==' ? currentVal === condVal : currentVal !== condVal);
    wrapper.style.display = show ? '' : 'none';
  });
}

function renderBlockSettings() {
  const panel = document.getElementById('builderSettings');
  if (!panel) return;
  destroyWysiwygEditors(panel);
  panel.innerHTML = renderBuilderSettingsPanel();
  attachSettingsLivePreview();
  initWysiwygEditors(panel);
}

// ── WYSIWYG Editor (Quill) ──────────────────────────────────────────────────

const _quillInstances = new Map();

function _quillCleanPasteMatchers() {
  if (typeof Quill === 'undefined') return [];
  const Delta = Quill.import('delta');
  return [
    // Strip all inline styles/classes — keep only text + block structure
    [Node.ELEMENT_NODE, function(node, delta) {
      const tag = node.tagName;
      // Keep heading levels
      if (/^H[1-6]$/.test(tag)) {
        const level = parseInt(tag[1]);
        return new Delta().insert(node.textContent, { header: level }).insert('\n');
      }
      // Strip all inline formatting attributes (color, font, size, background, etc.)
      const ops = delta.ops.map(op => {
        if (op.attributes) {
          const clean = {};
          // Only keep these Quill formats
          if (op.attributes.link) clean.link = op.attributes.link;
          if (op.attributes.header) clean.header = op.attributes.header;
          if (op.attributes.list) clean.list = op.attributes.list;
          if (op.attributes.blockquote) clean.blockquote = op.attributes.blockquote;
          return { ...op, attributes: Object.keys(clean).length ? clean : undefined };
        }
        return op;
      });
      return new Delta(ops);
    }]
  ];
}

function initWysiwygEditors(container) {
  if (typeof Quill === 'undefined') return;
  container.querySelectorAll('.wysiwyg-editor').forEach(el => {
    if (_quillInstances.has(el.id)) return;
    const textarea = el.parentElement.querySelector('.wysiwyg-source');
    const quill = new Quill(el, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, 4, 5, 6, false] }],
          ['bold', 'italic', 'strike'],
          [{ list: 'bullet' }, { list: 'ordered' }],
          ['blockquote'],
          [{ align: [] }],
          ['link'],
          [{ color: [] }],
          [{ indent: '-1' }, { indent: '+1' }],
          ['clean'],
          ['html']
        ],
        clipboard: { matchers: _quillCleanPasteMatchers() }
      },
      placeholder: 'Saisissez votre texte...'
    });
    quill.on('text-change', () => {
      if (quill._syncingFromInline) return;
      const html = quill.getSemanticHTML();
      if (textarea) {
        textarea.value = html;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    attachHtmlSourceToggle(quill, {
      getHtml: () => quill.getSemanticHTML(),
      onSync: (html) => {
        if (textarea) {
          textarea.value = html;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    });
    _quillInstances.set(el.id, quill);
  });
}

function attachHtmlSourceToggle(quill, { getHtml, onSync } = {}) {
  const toolbar = quill.getModule && quill.getModule('toolbar');
  if (!toolbar || typeof toolbar.addHandler !== 'function') return;
  const editorRoot = quill.root;
  const qlContainer = editorRoot.parentNode;
  let textarea = null;
  toolbar.addHandler('html', function() {
    const btn = toolbar.container && toolbar.container.querySelector('button.ql-html');
    if (!textarea) {
      const html = typeof getHtml === 'function' ? getHtml() : editorRoot.innerHTML;
      textarea = document.createElement('textarea');
      textarea.className = 'wysiwyg-html-source';
      textarea.spellcheck = false;
      textarea.value = html;
      qlContainer.style.display = 'none';
      qlContainer.parentNode.insertBefore(textarea, qlContainer.nextSibling);
      textarea.addEventListener('input', () => {
        if (typeof onSync === 'function') onSync(textarea.value);
      });
      if (btn) btn.classList.add('ql-active');
      textarea.focus();
    } else {
      const html = textarea.value;
      quill.root.innerHTML = html;
      if (typeof onSync === 'function') onSync(html);
      textarea.remove();
      textarea = null;
      qlContainer.style.display = '';
      if (btn) btn.classList.remove('ql-active');
      quill.focus();
    }
  });
}

function destroyWysiwygEditors(container) {
  container.querySelectorAll('.wysiwyg-editor').forEach(el => {
    const quill = _quillInstances.get(el.id);
    if (quill) {
      // Sync final content to textarea before destroying
      const textarea = el.parentElement?.querySelector('.wysiwyg-source');
      if (textarea) textarea.value = quill.getSemanticHTML();
    }
    _quillInstances.delete(el.id);
  });
}

function attachSettingsLivePreview() {
  const panel = document.getElementById('builderSettings');
  const form = panel?.querySelector('form');
  if (!form || form.dataset.liveAttached === 'true') return;
  form.dataset.liveAttached = 'true';
  const handler = () => liveUpdateFromSettingsForm(form);
  form.addEventListener('input', handler);
  form.addEventListener('change', handler);
  form.addEventListener('input', () => updateSchemaConditionals(form));
  form.addEventListener('change', () => updateSchemaConditionals(form));
}

function liveUpdateFromSettingsForm(form) {
  if (!selectedBlockId) return;
  const block = pageBuilderState.blocks.find(b => b.id === selectedBlockId);
  if (!block) return;
  markBuilderDirty();
  if (LEGACY_BLOCK_TYPES[block.type]) return;
  const def = BLOCK_TYPES[block.type] || {};
  const moduleName = def.moduleName || block.type;
  const schemaFields = moduleFieldSchema?.modules?.[moduleName]?.fields || [];
  if (schemaFields.length === 0) return;
  const data = { ...(block.data && typeof block.data === 'object' ? block.data : {}) };
  schemaFields.forEach(field => {
    const name = field.name;
    const type = field.type || 'Text';
    try {
    if (type === 'Repeater') {
      const rc = form.querySelector(`.repeater-field[data-field-name="${CSS.escape(name)}"]`);
      if (!rc && data[name] !== undefined) return; // hidden repeater (e.g. Accordion inline) — keep existing data
      data[name] = collectRepeaterData(form, name, field.subFields || []);
      return;
    }
    if (type === 'FlexibleContent') {
      data[name] = collectFlexibleContentData(form, name);
      return;
    }
    if (type === 'Group') {
      data[name] = collectContainerData(form, name, field.subFields || [], null);
      return;
    }
    // Ne jamais toucher aux champs d'image de fond : ils sont gérés
    // uniquement par la médiathèque. Sinon, bg_img est écrasé à chaque
    // clic sur un bouton (couleur, padding, etc.) et la photo disparaît.
    if (name === 'bg_img' || name === 'backgroundImage') return;
    if (type === 'Image' || type === 'File' || type === 'Video') return;
    if (type === 'GoogleMap') {
      const latInput = form.querySelector(`[name="${CSS.escape(name + '__lat')}"]`);
      const lngInput = form.querySelector(`[name="${CSS.escape(name + '__lng')}"]`);
      const placeIdInput = form.querySelector(`[name="${CSS.escape(name + '__place_id')}"]`);
      const searchInput = form.querySelector(`[name="${CSS.escape(name + '__search')}"]`);
      const lat = latInput ? parseFloat(latInput.value) : 0;
      const lng = lngInput ? parseFloat(lngInput.value) : 0;
      const streetNumberInput = form.querySelector(`[name="${CSS.escape(name + '__street_number')}"]`);
      const streetNameInput = form.querySelector(`[name="${CSS.escape(name + '__street_name')}"]`);
      const streetNameShortInput = form.querySelector(`[name="${CSS.escape(name + '__street_name_short')}"]`);
      const postCodeInput = form.querySelector(`[name="${CSS.escape(name + '__post_code')}"]`);
      const cityInput = form.querySelector(`[name="${CSS.escape(name + '__city')}"]`);
      const nameInput = form.querySelector(`[name="${CSS.escape(name + '__name')}"]`);
      data[name] = (lat || lng) ? {
        lat: lat || 0, lng: lng || 0,
        place_id: placeIdInput ? placeIdInput.value : '',
        address: searchInput ? searchInput.value : '',
        name: nameInput ? nameInput.value : (searchInput ? searchInput.value : ''),
        street_number: streetNumberInput ? streetNumberInput.value : '',
        street_name: streetNameInput ? streetNameInput.value : '',
        street_name_short: streetNameShortInput ? streetNameShortInput.value : '',
        post_code: postCodeInput ? postCodeInput.value : '',
        city: cityInput ? cityInput.value : '',
      } : null;
      return;
    }
    if (type === 'URL' || type === 'Url' || type === 'Link') {
      const urlInput = form.querySelector(`[name="${CSS.escape(name + '__url')}"]`);
      const titleInput = form.querySelector(`[name="${CSS.escape(name + '__title')}"]`);
      const targetInput = form.querySelector(`[name="${CSS.escape(name + '__target')}"]`);
      const url = urlInput ? urlInput.value : '';
      data[name] = url ? { url, title: titleInput ? titleInput.value : '', target: targetInput ? targetInput.value : '_self' } : '';
      return;
    }
    const input = form.querySelector(`[name="${CSS.escape(name)}"]`);
    if (!input) return;
    if (type === 'TrueFalse') {
      data[name] = !!input.checked;
    } else if (type === 'Number' || type === 'Range') {
      const raw = input.value;
      data[name] = raw === '' ? '' : Number(raw);
    } else if (type === 'ButtonGroup' || type === 'RadioButton') {
      const checked = form.querySelector(`[name="${CSS.escape(name)}"]:checked`);
      data[name] = checked ? checked.value : '';
    } else {
      data[name] = input.value;
    }
    } catch (err) {
      console.warn(`[liveUpdate] Error collecting field "${name}" (${type}):`, err);
    }
  });
  block.data = data;
  updateBlockCardPreview(block.id);
}

const PADDING_CLASSES = ['padding-top-small', 'no-padding-top', 'padding-bottom-small', 'no-padding-bottom'];
const BG_COLOR_CLASSES = ['has-background-primary', 'has-background-secondary', 'has-background-tertiary', 'no-background-color'];

function syncModulePaddingClasses(richEl, data) {
  const moduleEl = richEl.querySelector('.module');
  if (!moduleEl) return;
  moduleEl.classList.remove(...PADDING_CLASSES);
  const pt = data?.padding_top;
  const pb = data?.padding_bottom;
  if (pt && PADDING_CLASSES.includes(pt)) moduleEl.classList.add(pt);
  if (pb && PADDING_CLASSES.includes(pb)) moduleEl.classList.add(pb);
  // Inline styles to guarantee visual rendering in admin context
  if (pt === 'no-padding-top') moduleEl.style.setProperty('padding-top', '0', 'important');
  else if (pt === 'padding-top-small') moduleEl.style.setProperty('padding-top', 'calc(37.5px + 1.95vw)', 'important');
  else moduleEl.style.removeProperty('padding-top');
  if (pb === 'no-padding-bottom') moduleEl.style.setProperty('padding-bottom', '0', 'important');
  else if (pb === 'padding-bottom-small') moduleEl.style.setProperty('padding-bottom', 'calc(37.5px + 1.95vw)', 'important');
  else moduleEl.style.removeProperty('padding-bottom');
}

function syncModuleBlocColorClasses(richEl, data) {
  const moduleEl = richEl.querySelector('.module');
  if (!moduleEl) return;
  moduleEl.classList.remove(...BG_COLOR_CLASSES);
  const bgClass = data?.bloc_color || '';
  if (bgClass && bgClass !== 'no-background-color' && BG_COLOR_CLASSES.includes(bgClass)) {
    moduleEl.classList.add(bgClass);
  }
  // Inline background-color to override CSS cascade (background: transparent !important)
  const COLOR_MAP = getResolvedColorMap();
  if (bgClass && COLOR_MAP[bgClass]) {
    moduleEl.style.setProperty('background-color', COLOR_MAP[bgClass], 'important');
  } else {
    moduleEl.style.removeProperty('background-color');
  }
}

function updateBlockCardPreview(blockId) {
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (!block) return;
  const card = document.querySelector(`.builder-block-card[data-block-id="${blockId}"]`);
  if (!card) return;
  // Update visibility state
  const isHidden = block.data?.is_visible === 'no';
  card.classList.toggle('is-hidden-block', isHidden);
  const info = card.querySelector('.builder-block-info');
  if (info) {
    const existingIcon = info.querySelector('.builder-block-hidden-icon');
    if (isHidden && !existingIcon) {
      info.insertAdjacentHTML('beforeend', '<svg class="builder-block-hidden-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>');
    } else if (!isHidden && existingIcon) {
      existingIcon.remove();
    }
  }
  // If this block is being inline-edited, skip full innerHTML replacement
  // to preserve cursor position. Only update surrounding styles/classes.
  if (_inlineEditingBlockId === blockId) {
    const richEl = card.querySelector('.builder-block-render');
    if (richEl) {
      syncModulePaddingClasses(richEl, block.data);
      syncModuleBlocColorClasses(richEl, block.data);
    }
    return;
  }

  let rich;
  try { rich = replaceEmptyImages(renderBlockPreviewHtml(block)); } catch (e) {
    console.warn('Preview render error:', e);
    rich = `<div class="preview-loading" style="color:#c00;">Erreur de rendu (${escapeHtml(block.type)}). Voir la console.</div>`;
  }
  let richEl = card.querySelector('.builder-block-render');
  if (rich) {
    if (!richEl) {
      richEl = document.createElement('div');
      richEl.className = 'builder-block-render';
      card.appendChild(richEl);
    }
    richEl.innerHTML = rich;
    // Accordion : post-traitement du DOM pour l'admin
    if (block.type === 'accordion' || block.type === 'Accordion') {
      let accordionDiv = richEl.querySelector('.accordion');
      // If no .accordion div (empty/new block), create a minimal structure
      if (!accordionDiv) {
        const moduleDiv = richEl.querySelector('.module-accordion') || richEl;
        let container = moduleDiv.querySelector('.container');
        if (!container) {
          container = document.createElement('div');
          container.className = 'container';
          moduleDiv.appendChild(container);
        }
        accordionDiv = document.createElement('div');
        accordionDiv.className = 'accordion';
        container.appendChild(accordionDiv);
      }
      if (accordionDiv) {
        const chevronSvg = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
        accordionDiv.querySelectorAll('.js_toggle-accordion').forEach((btn, i) => {
          if (btn.querySelector('.accordion-title-text')) return;
          // Inject chevron SVG into .icon if empty
          const icon = btn.querySelector('.icon');
          if (icon && !icon.innerHTML.trim()) icon.innerHTML = chevronSvg;
          // Wrap title text in a clickable span (exclude the .icon)
          const titleSpan = document.createElement('span');
          titleSpan.className = 'accordion-title-text';
          Array.from(btn.childNodes).forEach(node => {
            if (node === icon) return;
            titleSpan.appendChild(node);
          });
          btn.insertBefore(titleSpan, icon);
          // Open first item by default
          if (i === 0) {
            btn.classList.add('active');
            const txt = btn.nextElementSibling;
            if (txt && txt.classList.contains('txt')) txt.style.display = 'block';
          }
        });
        // Inject add button
        if (!accordionDiv.querySelector('.accordion-add-btn')) {
          const addBtn = document.createElement('button');
          addBtn.type = 'button';
          addBtn.className = 'accordion-add-btn';
          addBtn.textContent = '+ Ajouter un élément';
          accordionDiv.appendChild(addBtn);
        }
      }
    }
    // ImagesSlider: init Swiper carousel in preview
    if (block.type === 'images-slider' || block.type === 'ImagesSlider') {
      initPreviewImagesSlider(richEl);
    }
    // LogosSlider: init Swiper carousel in preview
    if (block.type === 'logos-slider' || block.type === 'LogosSlider' || block.type === 'slider-logo' || block.type === 'SliderLogo') {
      initPreviewLogosSlider(richEl);
    }
    syncModulePaddingClasses(richEl, block.data);
    syncModuleBlocColorClasses(richEl, block.data);
    updateBuilderParallax();
    applyPreviewScaling();
  } else if (richEl) {
    richEl.remove();
  }
}

// ── ImagesSlider: Swiper init in preview ────────────────────────────────────
function initPreviewImagesSlider(richEl) {
  if (typeof window.Swiper === 'undefined') return;
  richEl.querySelectorAll('.js_images-slider').forEach(function(el, i) {
    // Destroy previous instance if re-rendering
    if (el.swiper) el.swiper.destroy(true, true);
    var slideCount = el.querySelectorAll('.swiper-slide').length;
    if (slideCount <= 1) return;
    var wrapper = el.closest('.slider-wrapper');
    var pagEl = wrapper ? wrapper.querySelector('.js_images-slider-pagination') : null;
    if (pagEl) pagEl.classList.add('index-' + i);
    new window.Swiper(el, {
      loop: slideCount > 2,
      speed: 750,
      slidesPerView: 1,
      autoplay: { delay: 4000, disableOnInteraction: true },
      navigation: {
        nextEl: wrapper ? wrapper.querySelector('.next') : null,
        prevEl: wrapper ? wrapper.querySelector('.prev') : null
      },
      pagination: { el: pagEl, type: 'bullets', clickable: true }
    });
  });
}

// ── LogosSlider: Swiper init in preview ──────────────────────────────────────
function initPreviewLogosSlider(richEl) {
  if (typeof window.Swiper === 'undefined') return;
  richEl.querySelectorAll('.js_logos-slider').forEach(function(el) {
    if (el.swiper) el.swiper.destroy(true, true);
    var slideCount = el.querySelectorAll('.swiper-slide').length;
    var ww = window.innerWidth;
    var spv = 2;
    if (ww >= 1025) spv = 6;
    else if (ww >= 961) spv = 4;
    else if (ww >= 601) spv = 3;
    else if (ww >= 481) spv = 2;
    if (slideCount <= spv) return;
    var wrapper = el.closest('.slider-wrapper');
    new window.Swiper(el, {
      loop: true,
      speed: 750,
      slidesPerView: 2,
      spaceBetween: 26,
      preventClicks: false,
      preventClicksPropagation: false,
      breakpoints: {
        481: { slidesPerView: 2 },
        601: { slidesPerView: 3 },
        961: { slidesPerView: 4 },
        1025: { slidesPerView: 6 }
      },
      autoplay: { delay: 3000, disableOnInteraction: true },
      navigation: {
        nextEl: wrapper ? wrapper.querySelector('.js_logos-slider-btn-next') : null,
        prevEl: wrapper ? wrapper.querySelector('.js_logos-slider-btn-prev') : null
      }
    });
  });
}

// ── Inline Editing (TextSimple) ─────────────────────────────────────────────

/**
 * Find the sub-module data object inside a ColumnsTab block by matching
 * the DOM position of the .module-text element.
 */
function _findColumnsSubModuleData(block, moduleTextEl, card) {
  const columnsList = Array.isArray(block.data?.columns_list) ? block.data.columns_list : [];
  // Get all .col elements in the preview
  const colEls = card.querySelectorAll('.builder-block-render .cols-wrapper > .col');
  for (let colIdx = 0; colIdx < colEls.length; colIdx++) {
    const colEl = colEls[colIdx];
    if (!colEl.contains(moduleTextEl)) continue;
    const colData = columnsList[colIdx];
    if (!colData) return null;
    const subModules = Array.isArray(colData.columns_module) ? colData.columns_module : [];
    // Find which .module-in-column contains our .module-text
    const moduleInColEls = colEl.querySelectorAll(':scope > .module-in-column');
    for (let subIdx = 0; subIdx < moduleInColEls.length; subIdx++) {
      if (moduleInColEls[subIdx].contains(moduleTextEl)) {
        const subData = subModules[subIdx];
        if (subData && (subData.acf_fc_layout === 'text' || subData.type === 'text')) {
          return subData;
        }
        return null;
      }
    }
  }
  return null;
}

let _inlineToolbar = null;
let _inlineSourceTextarea = null;

function _prettifyHtmlSource(html) {
  return String(html || '')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\s*(<(p|h[1-6]|ul|ol|li|blockquote|div|figure|table|tr|td|th|thead|tbody|section|article|header|footer|nav|aside)[^>]*>)\s*/gi, '\n$1')
    .replace(/\s*(<\/(p|h[1-6]|ul|ol|li|blockquote|div|figure|table|tr|td|th|thead|tbody|section|article|header|footer|nav|aside)>)\s*/gi, '$1\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/^\s+|\s+$/g, '');
}

function _toggleInlineHtmlSource() {
  if (!_inlineEditingElement) return;
  const editor = _inlineEditingElement;
  const btn = _inlineToolbar && _inlineToolbar.querySelector('button[data-action="html"]');

  if (_inlineSourceTextarea) {
    // Switch back from HTML source → contenteditable
    const html = _inlineSourceTextarea.value;
    editor.innerHTML = html;
    if (_inlineEditingDataRef && _inlineEditingFieldName) {
      _inlineEditingDataRef[_inlineEditingFieldName] = html;
    }
    _inlineSourceTextarea.remove();
    _inlineSourceTextarea = null;
    editor.style.display = '';
    if (btn) btn.classList.remove('active');
    editor.focus();
    return;
  }

  // Switch to HTML source view
  const ta = document.createElement('textarea');
  ta.className = 'inline-html-source';
  ta.spellcheck = false;
  ta.value = _prettifyHtmlSource(editor.innerHTML);
  editor.parentNode.insertBefore(ta, editor.nextSibling);
  editor.style.display = 'none';
  ta.addEventListener('input', () => {
    const v = ta.value;
    editor.innerHTML = v;
    if (_inlineEditingDataRef && _inlineEditingFieldName) {
      _inlineEditingDataRef[_inlineEditingFieldName] = v;
    }
    markBuilderDirty();
  });
  ta.addEventListener('blur', _handleInlineBlur);
  _inlineSourceTextarea = ta;
  if (btn) btn.classList.add('active');
  ta.focus();
}

function _createInlineToolbar() {
  if (_inlineToolbar) return _inlineToolbar;
  const bar = document.createElement('div');
  bar.className = 'inline-toolbar';
  bar.innerHTML = `
    <select class="inline-toolbar-select" data-action="formatBlock" title="Style">
      <option value="p">Paragraphe</option>
      <option value="h1">Titre 1</option>
      <option value="h2">Titre 2</option>
      <option value="h3">Titre 3</option>
      <option value="h4">Titre 4</option>
      <option value="h5">Titre 5</option>
      <option value="h6">Mention</option>
    </select>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="bold" title="Gras (Ctrl+B)"><b>B</b></button>
    <button type="button" data-cmd="italic" title="Italique (Ctrl+I)"><i>I</i></button>
    <button type="button" data-cmd="strikeThrough" title="Barré"><s>S</s></button>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="insertUnorderedList" title="Liste à puces"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="2" fill="currentColor"/><circle cx="4" cy="12" r="2" fill="currentColor"/><circle cx="4" cy="18" r="2" fill="currentColor"/></svg></button>
    <button type="button" data-cmd="insertOrderedList" title="Liste numérotée"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="1" y="7" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">1</text><text x="1" y="13" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">2</text><text x="1" y="19" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">3</text></svg></button>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="formatBlock" data-value="blockquote" title="Citation"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg></button>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="justifyLeft" title="Aligner à gauche"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg></button>
    <button type="button" data-cmd="justifyCenter" title="Centrer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg></button>
    <button type="button" data-cmd="justifyRight" title="Aligner à droite"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg></button>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="createLink" title="Lien"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="indent" data-value="outdent" title="Diminuer le retrait"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="4" x2="21" y2="4"/><line x1="11" y1="9" x2="21" y2="9"/><line x1="11" y1="14" x2="21" y2="14"/><line x1="3" y1="19" x2="21" y2="19"/><polyline points="7 14 3 11.5 7 9"/></svg></button>
    <button type="button" data-cmd="indent" data-value="indent" title="Augmenter le retrait"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="4" x2="21" y2="4"/><line x1="11" y1="9" x2="21" y2="9"/><line x1="11" y1="14" x2="21" y2="14"/><line x1="3" y1="19" x2="21" y2="19"/><polyline points="3 9 7 11.5 3 14"/></svg></button>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="removeFormat" title="Supprimer le formatage"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16"/><path d="M10 4v3"/><path d="M8 21l4-14"/><path d="M3 21h6"/><line x1="18" y1="5" x2="22" y2="9"/><line x1="22" y1="5" x2="18" y2="9"/></svg></button>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-action="html" title="Voir le HTML"><span class="inline-toolbar-html-icon">&lt;/&gt;</span></button>
  `;
  bar.style.display = 'none';
  document.body.appendChild(bar);

  // Handle button clicks
  bar.addEventListener('mousedown', (e) => {
    // Let the <select> dropdown work normally (don't preventDefault)
    if (e.target.closest('select')) return;
    e.preventDefault(); // Prevent blur on the contenteditable
    // HTML source toggle (separate from execCommand buttons)
    const htmlBtn = e.target.closest('button[data-action="html"]');
    if (htmlBtn) {
      _toggleInlineHtmlSource();
      return;
    }
    const btn = e.target.closest('button[data-cmd]');
    if (btn) {
      const cmd = btn.dataset.cmd;
      if (cmd === 'createLink') {
        const url = prompt('URL du lien :', 'https://');
        if (url) document.execCommand('createLink', false, url);
      } else if (cmd === 'formatBlock') {
        document.execCommand('formatBlock', false, btn.dataset.value);
      } else if (cmd === 'indent') {
        document.execCommand(btn.dataset.value === 'outdent' ? 'outdent' : 'indent', false, null);
      } else {
        document.execCommand(cmd, false, null);
      }
      _updateToolbarState();
      if (_inlineEditingElement) _syncInlineContentToBlockData(_inlineEditingElement);
    }
  });

  // Handle heading select
  bar.querySelector('.inline-toolbar-select').addEventListener('change', (e) => {
    const tag = e.target.value;
    document.execCommand('formatBlock', false, tag);
    _updateToolbarState();
    if (_inlineEditingElement) _syncInlineContentToBlockData(_inlineEditingElement);
    if (_inlineEditingElement) _inlineEditingElement.focus();
  });

  _inlineToolbar = bar;
  return bar;
}

function _showInlineToolbar(card, txtEditor) {
  const bar = _createInlineToolbar();
  if (!txtEditor) txtEditor = card.querySelector('.builder-block-render .txt.editor');
  if (!txtEditor) return;
  // Position the toolbar above the text editor
  const rect = txtEditor.getBoundingClientRect();
  bar.style.display = 'flex';
  bar.style.position = 'fixed';
  bar.style.left = rect.left + 'px';
  bar.style.top = (rect.top - bar.offsetHeight - 8) + 'px';
  // Clamp to viewport
  requestAnimationFrame(() => {
    const barRect = bar.getBoundingClientRect();
    if (barRect.top < 4) {
      bar.style.top = (rect.bottom + 8) + 'px';
    }
    if (barRect.right > window.innerWidth - 4) {
      bar.style.left = (window.innerWidth - barRect.width - 4) + 'px';
    }
    if (barRect.left < 4) {
      bar.style.left = '4px';
    }
  });
}

function _hideInlineToolbar() {
  if (_inlineToolbar) _inlineToolbar.style.display = 'none';
}

function _updateToolbarState() {
  if (!_inlineToolbar) return;
  _inlineToolbar.querySelectorAll('button[data-cmd]').forEach(btn => {
    const cmd = btn.dataset.cmd;
    if (['bold', 'italic', 'underline', 'strikeThrough', 'insertOrderedList', 'insertUnorderedList'].includes(cmd)) {
      btn.classList.toggle('active', document.queryCommandState(cmd));
    }
  });
  // Update heading select
  const select = _inlineToolbar.querySelector('.inline-toolbar-select');
  if (select) {
    const blockTag = document.queryCommandValue('formatBlock').toLowerCase().replace(/[<>]/g, '');
    select.value = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(blockTag) ? blockTag : 'p';
  }
}

/**
 * Enable inline editing on a .txt.editor element.
 * @param {string} blockId - the top-level block id (or parent ColumnsTab block id)
 * @param {HTMLElement} [targetTxtEditor] - optional: the specific .txt.editor element (for sub-modules in columns)
 * @param {object} [dataRef] - optional: direct reference to the sub-module data object
 */
function enableInlineEditing(blockId, targetTxtEditor, dataRef, fieldName) {
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (!block) return;

  const card = document.querySelector(`.builder-block-card[data-block-id="${blockId}"]`);
  if (!card) return;

  // If no specific target provided, check that this is a TextSimple block
  if (!targetTxtEditor) {
    const def = BLOCK_TYPES[block.type] || {};
    const moduleName = def.moduleName || block.type;
    if (moduleName !== 'TextSimple') return;
    targetTxtEditor = card.querySelector('.builder-block-render .txt.editor');
    dataRef = block.data;
  }

  if (!targetTxtEditor) return;

  // Already inline-editing this exact element
  if (_inlineEditingElement === targetTxtEditor) return;

  // Disable any previous inline editing
  disableInlineEditing();

  _inlineEditingBlockId = blockId;
  _inlineEditingFieldName = fieldName || 'text';
  _inlineEditingDataRef = dataRef || block.data;
  _inlineEditingElement = targetTxtEditor;

  targetTxtEditor.setAttribute('contenteditable', 'true');
  card.classList.add('is-inline-editing');
  card.setAttribute('draggable', 'false');
  targetTxtEditor.focus();

  // Show the formatting toolbar
  _showInlineToolbar(card, targetTxtEditor);

  targetTxtEditor.addEventListener('input', _handleInlineInput);
  targetTxtEditor.addEventListener('blur', _handleInlineBlur);
  targetTxtEditor.addEventListener('keydown', _handleInlineKeydown);
  targetTxtEditor.addEventListener('paste', _handleInlinePaste);
  document.addEventListener('selectionchange', _updateToolbarState);
}

function disableInlineEditing() {
  if (!_inlineEditingBlockId) return;

  // If in HTML source mode, sync textarea content back into the contenteditable first
  if (_inlineSourceTextarea && _inlineEditingElement) {
    _inlineEditingElement.innerHTML = _inlineSourceTextarea.value;
    _inlineEditingElement.style.display = '';
    _inlineSourceTextarea.remove();
    _inlineSourceTextarea = null;
    const htmlBtn = _inlineToolbar && _inlineToolbar.querySelector('button[data-action="html"]');
    if (htmlBtn) htmlBtn.classList.remove('active');
  }

  if (_inlineEditingElement) {
    _syncInlineContentToBlockData(_inlineEditingElement);
    _inlineEditingElement.removeAttribute('contenteditable');
    _inlineEditingElement.removeEventListener('input', _handleInlineInput);
    _inlineEditingElement.removeEventListener('blur', _handleInlineBlur);
    _inlineEditingElement.removeEventListener('keydown', _handleInlineKeydown);
    _inlineEditingElement.removeEventListener('paste', _handleInlinePaste);
  }

  const card = document.querySelector(`.builder-block-card[data-block-id="${_inlineEditingBlockId}"]`);
  if (card) {
    card.classList.remove('is-inline-editing');
    card.setAttribute('draggable', 'true');
  }

  // Hide toolbar
  _hideInlineToolbar();
  document.removeEventListener('selectionchange', _updateToolbarState);

  // Sync final content to settings panel Quill (if open)
  _syncInlineToSettingsPanelQuill();

  const prevBlockId = _inlineEditingBlockId;
  _inlineEditingBlockId = null;
  _inlineEditingFieldName = null;
  _inlineEditingDataRef = null;
  _inlineEditingElement = null;

  // Now that inline editing is off, do a full preview re-render
  if (prevBlockId) updateBlockCardPreview(prevBlockId);
}

function _handleInlineInput(e) {
  markBuilderDirty();
  _syncInlineContentToBlockData(e.target);
  // Don't sync to Quill on every keystroke — it triggers text-change → liveUpdate
  // which overwrites block.data.text with stale Quill content.
  // Quill is synced only when inline editing ends (disableInlineEditing).
}

function _handleInlineBlur() {
  // Delay to allow clicking inside the toolbar or the same card
  setTimeout(() => {
    if (!_inlineEditingBlockId) return;
    const active = document.activeElement;
    // If focus moved to the toolbar, don't disable — user is formatting
    if (_inlineToolbar && _inlineToolbar.contains(active)) return;
    // If focus is still inside the editing element, don't disable
    if (_inlineEditingElement && (_inlineEditingElement === active || _inlineEditingElement.contains(active))) return;
    // If focus moved to the HTML source textarea, don't disable
    if (_inlineSourceTextarea && _inlineSourceTextarea === active) return;
    // Focus left the editing zone — disable inline editing
    disableInlineEditing();
  }, 150);
}

function _handleInlineKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    disableInlineEditing();
  }
}

function _handleInlinePaste(e) {
  e.preventDefault();
  const html = e.clipboardData.getData('text/html');
  const text = e.clipboardData.getData('text/plain');
  let clean = '';
  if (html) {
    // Parse pasted HTML, keep only structure (headings, paragraphs, lists, line breaks)
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    clean = _cleanPastedHTML(tmp);
  } else {
    // Plain text: convert line breaks to paragraphs
    clean = text.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  }
  document.execCommand('insertHTML', false, clean);
}

function _cleanPastedHTML(el) {
  const allowedBlocks = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BR', 'BLOCKQUOTE'];
  const allowedInline = ['A', 'BR'];
  let result = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent;
      if (txt.trim()) result += txt;
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = node.tagName;
    if (allowedBlocks.includes(tag)) {
      const inner = _cleanPastedInline(node);
      if (tag === 'UL' || tag === 'OL') {
        const items = Array.from(node.querySelectorAll('li')).map(li => `<li>${_cleanPastedInline(li)}</li>`).join('');
        result += `<${tag.toLowerCase()}>${items}</${tag.toLowerCase()}>`;
      } else {
        result += `<${tag.toLowerCase()}>${inner}</${tag.toLowerCase()}>`;
      }
    } else if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'SPAN' || tag === 'FONT' || tag === 'B' || tag === 'I' || tag === 'U' || tag === 'STRONG' || tag === 'EM') {
      // Unwrap container/inline elements, recurse into children
      const inner = _cleanPastedHTML(node);
      if (inner.trim()) {
        // If the result doesn't start with a block tag, wrap in <p>
        if (!/^<(p|h[1-6]|ul|ol|blockquote)/i.test(inner.trim())) {
          result += `<p>${inner}</p>`;
        } else {
          result += inner;
        }
      }
    } else {
      // Unknown tag — extract text content as paragraph
      const txt = node.textContent.trim();
      if (txt) result += `<p>${txt}</p>`;
    }
  }
  return result;
}

function _cleanPastedInline(el) {
  let result = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === 'BR') {
        result += '<br>';
      } else if (node.tagName === 'A' && node.href) {
        result += `<a href="${node.getAttribute('href')}">${_cleanPastedInline(node)}</a>`;
      } else {
        // Strip inline formatting (bold, italic, spans, etc.) — keep text only
        result += _cleanPastedInline(node);
      }
    }
  }
  return result;
}

function _syncInlineContentToBlockData(txtEditorEl) {
  if (!_inlineEditingBlockId || !_inlineEditingFieldName) return;
  const dataObj = _inlineEditingDataRef;
  if (!dataObj || typeof dataObj !== 'object') return;
  dataObj[_inlineEditingFieldName] = txtEditorEl.innerHTML;
}

function _syncInlineToSettingsPanelQuill() {
  if (!_inlineEditingBlockId || !_inlineEditingFieldName) return;
  const block = pageBuilderState.blocks.find(b => b.id === _inlineEditingBlockId);
  if (!block) return;

  const editorId = `wysiwyg-${block.id}-${_inlineEditingFieldName}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  const quill = _quillInstances.get(editorId);
  if (!quill) return;

  // Prevent circular update
  quill._syncingFromInline = true;
  const html = block.data[_inlineEditingFieldName] || '';
  quill.clipboard.dangerouslyPasteHTML(html);

  // Also update the hidden textarea
  const el = document.getElementById(editorId);
  const textarea = el?.parentElement?.querySelector('.wysiwyg-source');
  if (textarea) textarea.value = html;

  quill._syncingFromInline = false;
}

async function savePageBuilder() {
  // Sync inline editing content if active
  if (_inlineEditingBlockId && _inlineEditingElement) {
    _syncInlineContentToBlockData(_inlineEditingElement);
  }
  syncBuilderMetaFromDOM();
  // Force-sync all Quill editors to their hidden textareas before reading form values
  _quillInstances.forEach((quill, id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const textarea = el.parentElement?.querySelector('.wysiwyg-source');
    if (textarea) textarea.value = quill.getSemanticHTML();
  });
  // Sync the currently open block settings form to block.data before saving
  const panel = document.getElementById('builderSettings');
  const form = panel?.querySelector('form.builder-block-form');
  if (form && selectedBlockId) {
    liveUpdateFromSettingsForm(form);
  }
  const { title, slug, status, published_date, parent_id } = pageBuilderState.meta;
  if (!title || !slug) { showToast('Titre et slug requis', 'error'); return; }

  // Derive show_in_menu from menu toggles
  const assignments = getPageMenuAssignments();
  const show_in_menu = assignments.length > 0;

  const content = JSON.stringify(pageBuilderState.blocks);
  const color_overrides = pageBuilderState.colorOverrides.enabled ? JSON.stringify(pageBuilderState.colorOverrides) : null;
  const seo_meta = JSON.stringify(pageBuilderState.seoMeta);
  showLoading();
  try {
    if (pageBuilderState.editingPageId) {
      await apiFetch(`/pages/${pageBuilderState.editingPageId}`, { method: 'PUT', body: JSON.stringify({ title, slug, content, color_overrides, seo_meta, status, published_date, show_in_menu, menu_order: 0, parent_id: parent_id || null }) });
      showToast('Page mise à jour', 'success');
    } else {
      const res = await apiFetch('/pages', { method: 'POST', body: JSON.stringify({ title, slug, content, color_overrides, seo_meta, status, published_date, show_in_menu, menu_order: 0, parent_id: parent_id || null }) });
      showToast('Page créée', 'success');
      if (res && res.id) {
        pageBuilderState.editingPageId = res.id;
        localStorage.setItem('adminLastView', `builder:${res.id}`);
      }
    }

    // Sync menu assignments (title + slug sent so menu_items stay up to date)
    if (pageBuilderState.editingPageId && pageBuilderState.pageMenus.length > 0) {
      await apiFetch(`/pages/${pageBuilderState.editingPageId}/menus`, {
        method: 'PUT',
        body: JSON.stringify({ assignments, title, slug })
      });
    }

    // Reload menus with full item data and re-render toggles panel
    if (pageBuilderState.editingPageId) {
      try {
        const freshMenus = await apiFetch(`/pages/${pageBuilderState.editingPageId}/menus`);
        if (freshMenus?.menus) {
          pageBuilderState.pageMenus = freshMenus.menus;
          const body = document.querySelector('#builderMenuSettingsPanel .builder-menu-settings-body');
          if (body) {
            body.innerHTML = renderPageMenuToggles() ||
              '<p class="text-muted" style="font-size:0.85rem">Aucun menu créé. <a href="#" onclick="loadSection(\'menus\');return false">Créer un menu</a></p>';
          }
        }
      } catch (e) {}
    }

    // Update "Voir la page" link with current slug
    const viewBtn = document.getElementById('viewPageBtn');
    if (viewBtn) viewBtn.href = `${siteSettingsCache?.frontend_url || window.location.origin}/${slug.split('/').map(encodeURIComponent).join('/')}`;
    clearBuilderDirty();
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
    return;
  }
  hideLoading();
}

let _pagesCache = [];
let _pagesSearch = '';
let _pagesCurrentPage = 1;
const PAGES_PER_PAGE = 10;
let _pagesActiveMenu = null; // null = flat view, menuId = show hierarchy for that menu
let _pagesSortField = 'title'; // 'title' | 'updated_at'
let _pagesSortDir = 'asc';     // 'asc' | 'desc'
let _pagesMenusList = []; // [{id, name, location}] all menus with a location
let _pagesMenuItems = {}; // menuId → [{id, title, page_id, parent_id, menu_order}]
let _pagesSelected = new Set(); // selected page IDs for bulk actions

let _pagesMenuInfo = {}; // { pageId: { menus: [{id,name,location}], primaryParent: {title,page_id}|null } }

async function renderPages() {
  showLoading();
  try {
    const [pages, menuInfo, menus] = await Promise.all([
      apiFetch('/pages'),
      apiFetch('/pages/menu-info'),
      apiFetch('/menus'),
    ]);
    _pagesCache = pages;
    _pagesMenuInfo = menuInfo || {};
    _pagesMenusList = (menus || []).filter(m => m.location);
    _pagesSearch = '';
    _pagesCurrentPage = 1;
    _pagesActiveMenu = null;
    _pagesMenuItems = {};
    _pagesSelected = new Set();
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
  _pagesActiveMenu = menuId;
  _pagesSearch = '';
  _pagesCurrentPage = 1;
  if (menuId !== null && !_pagesMenuItems[menuId]) {
    showLoading();
    try {
      const menu = await apiFetch('/menus/' + menuId);
      _pagesMenuItems[menuId] = menu.items || [];
    } catch (e) {
      _pagesMenuItems[menuId] = [];
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
  if (_pagesCurrentPage > totalPages) _pagesCurrentPage = totalPages;
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
  _pagesSearch = value;
  _pagesCurrentPage = 1;
  refreshPagesView();
}

function goToPagesPage(page) {
  _pagesCurrentPage = page;
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

// ========== BLOCS RÉUTILISABLES ==========
let _reusableBlocsCache = [];
let _reusableBlocsSearch = '';
let _reusableBlocsCurrentPage = 1;
const REUSABLE_BLOCS_PER_PAGE = 10;

async function renderReusableBlocs() {
  showLoading();
  try {
    _reusableBlocsCache = await apiFetch('/reusable-blocs');
    _reusableBlocsSearch = '';
    _reusableBlocsCurrentPage = 1;
    hideLoading();
    return renderReusableBlocsView();
  } catch (error) {
    hideLoading();
    showToast('Erreur lors du chargement des blocs réutilisables', 'error');
    return '<div class="card"><p>Erreur de chargement</p></div>';
  }
}

function getFilteredReusableBlocs() {
  if (!_reusableBlocsSearch) return _reusableBlocsCache;
  const q = _reusableBlocsSearch.toLowerCase();
  return _reusableBlocsCache.filter(b => b.title.toLowerCase().includes(q));
}

function renderReusableBlocsView() {
  const filtered = getFilteredReusableBlocs();
  const totalPages = Math.max(1, Math.ceil(filtered.length / REUSABLE_BLOCS_PER_PAGE));
  if (_reusableBlocsCurrentPage > totalPages) _reusableBlocsCurrentPage = totalPages;
  const start = (_reusableBlocsCurrentPage - 1) * REUSABLE_BLOCS_PER_PAGE;
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
          <input type="text" class="form-input pages-search-input" placeholder="Rechercher un bloc…" value="${escapeHtml(_reusableBlocsSearch)}" oninput="handleReusableBlocsSearch(this.value)">
          ${_reusableBlocsSearch ? '<button type="button" class="search-clear" onclick="handleReusableBlocsSearch(\'\')">✕</button>' : ''}
        </div>
        <span class="pages-count">${filtered.length} bloc${filtered.length > 1 ? 's' : ''}${_reusableBlocsSearch ? ` trouvé${filtered.length > 1 ? 's' : ''}` : ''}</span>
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
    btns += `<button type="button" class="pagination-btn ${i === _reusableBlocsCurrentPage ? 'active' : ''}" onclick="goToReusableBlocsPage(${i})">${i}</button>`;
  }
  return `<div class="pages-pagination">${btns}</div>`;
}

function handleReusableBlocsSearch(value) {
  _reusableBlocsSearch = value;
  _reusableBlocsCurrentPage = 1;
  refreshReusableBlocsView();
}

function goToReusableBlocsPage(page) {
  _reusableBlocsCurrentPage = page;
  refreshReusableBlocsView();
}

function refreshReusableBlocsView() {
  const container = document.getElementById('content');
  if (!container) return;
  container.innerHTML = renderReusableBlocsView();
  const input = container.querySelector('.pages-search-input');
  if (input && _reusableBlocsSearch) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

async function openReusableBlocBuilder(blocId) {
  clearBuilderDirty();
  reusableBlocBuilderMode = true;
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
  reusableBlocBuilderMode = false;
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
    if (textarea) textarea.value = quill.getSemanticHTML();
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

// ========== MEDIA LIBRARY ==========
let mediaTotalCount = 0;

async function fetchMediaFolders() {
  try {
    const res = await apiFetch('/media/folders');
    mediaState.folders = res.folders || [];
    mediaTotalCount = res.total || 0;
  } catch (e) {
    mediaState.folders = [];
    mediaTotalCount = 0;
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
    <div class="media-library">
      <aside class="media-sidebar">
        <div class="media-search">
          <input type="text" class="media-search-input" placeholder="Rechercher un média…" value="${escapeHtml(mediaState.search)}" oninput="handleMediaSearch(this.value)" />
          ${mediaState.search ? `<button class="media-search-clear" onclick="clearMediaSearch()" title="Effacer">&times;</button>` : ''}
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

const _noImagePlaceholderHtml = '<div class="no-image-placeholder">Aucune image choisie</div>';

/**
 * Post-process preview HTML: replace empty <img> tags (src="" or src="undefined")
 * and empty .illus-wrapper divs with a "no image" placeholder.
 */
function replaceEmptyImages(html) {
  if (!html) return html;
  // Replace <img> with empty/undefined/null src
  html = html.replace(/<img\b[^>]*\bsrc=["']\s*["'][^>]*>/gi, _noImagePlaceholderHtml);
  html = html.replace(/<img\b[^>]*\bsrc=["'](?:undefined|null)["'][^>]*>/gi, _noImagePlaceholderHtml);
  // Replace empty .illus-wrapper divs (no meaningful content inside)
  html = html.replace(/<div class="illus-wrapper[^"]*">\s*<\/div>/gi, '<div class="illus-wrapper">' + _noImagePlaceholderHtml + '</div>');
  return html;
}

function getOptimizedUrl(url, width = 400, quality = 70) {
  if (!url) return url;
  if (url.startsWith('http') || !url.includes('/uploads/media/')) return url;
  const filename = url.split('/').pop();
  if (!filename) return url;
  const ext = filename.split('.').pop().toLowerCase();
  if (['svg', 'gif', 'webp', 'avif'].includes(ext)) return url;
  return `/uploads/media/_optimized/${encodeURIComponent(filename)}?w=${width}&q=${quality}&f=webp`;
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
    <article class="media-card ${forPicker ? 'is-picker' : ''} ${isSelected ? 'is-selected' : ''}" ${!forPicker ? `draggable="true" ondragstart="onMediaDragStart(event, ${item.id})"` : ''} onclick="${forPicker ? `selectMediaFromPicker(${item.id})` : `openMediaDetail(${item.id})`}">
      ${!forPicker ? `
        <label class="media-select" onclick="event.stopPropagation()">
          <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleMediaSelection(${item.id}, this.checked); event.stopPropagation();" />
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
  _mediaSearchTimer = setTimeout(async () => {
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

// ── Drag & drop media → folder ──
function onMediaDragStart(event, mediaId) {
  event.dataTransfer.setData('text/plain', String(mediaId));
  event.dataTransfer.effectAllowed = 'move';
  event.currentTarget.classList.add('is-dragging');
  // Highlight all folder targets
  document.querySelectorAll('.media-folder-item').forEach(el => el.classList.add('is-drop-target'));
}

document.addEventListener('dragend', () => {
  document.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
  document.querySelectorAll('.is-drop-target, .is-drag-over').forEach(el => el.classList.remove('is-drop-target', 'is-drag-over'));
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
  const mediaId = event.dataTransfer.getData('text/plain');
  if (!mediaId) return;
  await moveMediaItem(parseInt(mediaId), folderId);
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

async function openCropEditor(mediaId, imageUrl) {
  await ensureCropperLib();

  // Remove existing
  const existing = document.getElementById('cropEditorModal');
  if (existing) existing.remove();
  if (_cropperInstance) { _cropperInstance.destroy(); _cropperInstance = null; }

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
    closeMediaDetail();
    await fetchMediaItems(mediaState.currentFolderId);
    document.getElementById('content').innerHTML = await renderMediaLibrary();
  } catch (e) {
    showToast(e.message || 'Erreur lors du recadrage', 'error');
  } finally {
    hideLoading();
  }
}

function closeCropEditor() {
  if (_cropperInstance) { _cropperInstance.destroy(); _cropperInstance = null; }
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
  settingsMediaPickerTarget = settingName;
  mediaPickerState = {
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

function toggleFooterBgOptions() {
  const input = document.querySelector('input[name="footer_bg_img"]');
  const hasImg = input && input.value;
  document.querySelectorAll('.footer-bg-option').forEach(el => {
    el.style.display = hasImg ? '' : 'none';
  });
}

function toggleNewsletterOptions() {
  const checked = document.querySelector('input[name="newsletter_form"]').checked;
  document.querySelectorAll('.newsletter-option').forEach(el => {
    el.style.display = checked ? '' : 'none';
  });
}

function toggleAltSecondaryMenu() {
  const checked = document.querySelector('input[name="alt_secondary_menu"]').checked;
  document.querySelectorAll('.alt-secondary-menu-options').forEach(el => {
    el.style.display = checked ? '' : 'none';
  });
}

function toggleAlertBgOptions() {
  const input = document.querySelector('input[name="bg_img_alert"]');
  const hasImg = input && input.value;
  document.querySelectorAll('.alert-bg-option').forEach(el => {
    el.style.display = hasImg ? '' : 'none';
  });
}

// Hook into selectMediaFromPicker to handle settings media picks
const _origSelectMediaFromPicker = typeof selectMediaFromPicker === 'function' ? selectMediaFromPicker : null;

async function openMediaPicker(type, blockId, fieldName, options = {}) {
  const normalizedOptions = typeof options === 'boolean' ? { multiple: options } : options;
  // trigger is the button element clicked — used to scope DOM writes to the
  // correct .media-field when duplicate field names exist in the form (e.g.
  // two same-type sub-modules in ColumnsTab columns).
  const triggerEl = normalizedOptions.trigger || null;
  const fieldEl = triggerEl ? triggerEl.closest('.media-field') : null;
  mediaPickerState = {
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
  _mediaPickerSearchTimer = setTimeout(async () => {
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

// ── GoogleMap field: Mapbox geocoding + mini-map preview ──────────────────
const MAPBOX_TOKEN = 'pk.eyJ1IjoiYmFyY2Vsb25hLWNvIiwiYSI6ImNsbm9mZmN3bzBpM2Yya29kcWYxbnZpcGkifQ.gsHaJQAk_Ua4vBbt3DxNGQ';
let _mapboxGLLoaded = false;

function ensureMapboxGL() {
  if (_mapboxGLLoaded || window.mapboxgl) { _mapboxGLLoaded = true; return Promise.resolve(); }
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
    script.onload = () => { _mapboxGLLoaded = true; resolve(); };
    document.head.appendChild(script);
  });
}

function initGoogleMapField(uid) {
  const root = document.getElementById(uid);
  if (!root) return;
  const searchInput = root.querySelector('.googlemap-search');
  const suggestionsEl = root.querySelector('.googlemap-suggestions');
  const latInput = root.querySelector('[name$="__lat"]');
  const lngInput = root.querySelector('[name$="__lng"]');
  const addressInput = root.querySelector('[name$="__address"]');
  const placeIdInput = root.querySelector('[name$="__place_id"]');
  const streetNumberInput = root.querySelector('[name$="__street_number"]');
  const streetNameInput = root.querySelector('[name$="__street_name"]');
  const streetNameShortInput = root.querySelector('[name$="__street_name_short"]');
  const postCodeInput = root.querySelector('[name$="__post_code"]');
  const cityInput = root.querySelector('[name$="__city"]');
  const nameInput = root.querySelector('[name$="__name"]');
  const previewEl = root.querySelector('.googlemap-preview');
  let debounceTimer = null;
  let miniMap = null;
  let miniMarker = null;

  // Show existing preview if lat/lng already set
  const existingLat = parseFloat(latInput?.value);
  const existingLng = parseFloat(lngInput?.value);
  if (existingLat && existingLng) {
    showMiniMap(existingLat, existingLng);
  }

  // Geocoding search with debounce
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = searchInput.value.trim();
    if (query.length < 3) { suggestionsEl.innerHTML = ''; suggestionsEl.style.display = 'none'; return; }
    debounceTimer = setTimeout(() => geocodeSearch(query), 300);
  });

  // Close suggestions on click outside
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) { suggestionsEl.innerHTML = ''; suggestionsEl.style.display = 'none'; }
  });

  async function geocodeSearch(query) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5&language=fr`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.features || data.features.length === 0) {
        suggestionsEl.innerHTML = '<div class="googlemap-suggestion-empty">Aucun résultat</div>';
        suggestionsEl.style.display = 'block';
        return;
      }
      suggestionsEl.innerHTML = data.features.map((f, i) =>
        `<div class="googlemap-suggestion" data-idx="${i}">${escapeHtml(f.place_name)}</div>`
      ).join('');
      suggestionsEl.style.display = 'block';

      // Click handlers for suggestions
      suggestionsEl.querySelectorAll('.googlemap-suggestion').forEach((el) => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.idx);
          const feature = data.features[idx];
          if (!feature) return;
          const [lng, lat] = feature.center;
          searchInput.value = feature.place_name;
          latInput.value = lat;
          lngInput.value = lng;
          placeIdInput.value = feature.id || '';
          // Extract structured address components from Mapbox response
          const ctx = feature.context || [];
          const getCtx = (prefix) => { const c = ctx.find(c => c.id && c.id.startsWith(prefix)); return c ? c.text : ''; };
          if (streetNumberInput) streetNumberInput.value = feature.address || '';
          if (streetNameInput) streetNameInput.value = feature.text || '';
          if (streetNameShortInput) streetNameShortInput.value = feature.text || '';
          if (postCodeInput) postCodeInput.value = getCtx('postcode');
          if (cityInput) cityInput.value = getCtx('place');
          if (nameInput) nameInput.value = feature.place_name || '';
          if (addressInput) addressInput.value = feature.place_name || '';
          suggestionsEl.innerHTML = '';
          suggestionsEl.style.display = 'none';
          showMiniMap(lat, lng);
          // Trigger live update
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });
    } catch (err) {
      console.warn('Geocoding error:', err);
    }
  }

  async function showMiniMap(lat, lng) {
    // Destroy previous map instance to avoid WebGL context leaks
    if (miniMap) { try { miniMap.remove(); } catch(e) {} miniMap = null; miniMarker = null; }
    previewEl.innerHTML = '';
    previewEl.style.height = '200px';
    await ensureMapboxGL();
    if (!window.mapboxgl) { previewEl.innerHTML = `<div style="text-align:center;padding:20px;">📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>`; return; }
    mapboxgl.accessToken = MAPBOX_TOKEN;
    miniMap = new mapboxgl.Map({
      container: previewEl,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: 15,
      interactive: true,
    });
    miniMap.addControl(new mapboxgl.NavigationControl(), 'top-right');
    miniMarker = new mapboxgl.Marker({ draggable: true }).setLngLat([lng, lat]).addTo(miniMap);
    // Force resize after layout settles — Mapbox needs correct container dimensions
    miniMap.on('load', () => { miniMap.resize(); });
    setTimeout(() => { if (miniMap) miniMap.resize(); }, 200);
    setTimeout(() => { if (miniMap) miniMap.resize(); }, 600);
    // Update lat/lng when marker is dragged
    miniMarker.on('dragend', () => {
      const lngLat = miniMarker.getLngLat();
      latInput.value = lngLat.lat.toFixed(6);
      lngInput.value = lngLat.lng.toFixed(6);
      latInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  // Update mini-map when lat/lng inputs change manually
  [latInput, lngInput].forEach(inp => {
    if (!inp) return;
    inp.addEventListener('change', () => {
      const lat = parseFloat(latInput.value);
      const lng = parseFloat(lngInput.value);
      if (lat && lng) showMiniMap(lat, lng);
    });
  });
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

function selectAllMedia() {
  const allIds = mediaState.items.map(item => String(item.id));
  const allSelected = allIds.length > 0 && allIds.every(id => mediaState.selectedIds.includes(id));
  if (allSelected) {
    mediaState.selectedIds = [];
  } else {
    mediaState.selectedIds = [...allIds];
  }
  document.querySelectorAll('.media-card .media-select input[type="checkbox"]').forEach(cb => {
    cb.checked = !allSelected;
  });
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
  updateMediaSelectionUI();
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

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let size = Number(bytes);
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[idx]}`;
}

function ensureUiModal() {
  if (document.getElementById('uiModal')) return;
  const modal = document.createElement('div');
  modal.id = 'uiModal';
  modal.className = 'ui-modal';
  modal.innerHTML = `
    <div class="ui-modal-backdrop"></div>
    <div class="ui-modal-panel">
      <div class="ui-modal-title" id="uiModalTitle"></div>
      <div class="ui-modal-body" id="uiModalBody"></div>
      <div class="ui-modal-actions" id="uiModalActions"></div>
    </div>
  `;
  document.body.appendChild(modal);
}

function openUiModal({ title, bodyHtml, actions }) {
  ensureUiModal();
  const modal = document.getElementById('uiModal');
  modal.querySelector('#uiModalTitle').textContent = title || '';
  modal.querySelector('#uiModalBody').innerHTML = bodyHtml || '';
  const actionsEl = modal.querySelector('#uiModalActions');
  actionsEl.innerHTML = '';
  actions.forEach((action) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn btn-sm ${action.variant || 'btn-outline'}`;
    btn.textContent = action.label;
    btn.addEventListener('click', () => action.onClick());
    actionsEl.appendChild(btn);
  });
  modal.classList.add('is-open');
}

function closeUiModal() {
  const modal = document.getElementById('uiModal');
  if (modal) modal.classList.remove('is-open');
}

function confirmModal(message, title = 'Confirmation') {
  return new Promise((resolve) => {
    openUiModal({
      title,
      bodyHtml: `<p>${escapeHtml(message)}</p>`,
      actions: [
        { label: 'Annuler', variant: 'btn-outline', onClick: () => { closeUiModal(); resolve(false); } },
        { label: 'Confirmer', variant: 'btn-danger', onClick: () => { closeUiModal(); resolve(true); } }
      ]
    });
  });
}

function promptModal(message, defaultValue = '', title = 'Saisie') {
  return new Promise((resolve) => {
    const inputId = 'uiModalInput';
    openUiModal({
      title,
      bodyHtml: `
        <p>${escapeHtml(message)}</p>
        <input type="text" class="form-input" id="${inputId}" value="${escapeHtml(defaultValue)}">
      `,
      actions: [
        { label: 'Annuler', variant: 'btn-outline', onClick: () => { closeUiModal(); resolve(''); } },
        { label: 'Valider', variant: 'btn-primary', onClick: () => {
          const value = document.getElementById(inputId)?.value?.trim() || '';
          closeUiModal();
          resolve(value);
        } }
      ]
    });
    setTimeout(() => document.getElementById(inputId)?.focus(), 0);
  });
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
    _pagesSortDir = _pagesSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    _pagesSortField = field;
    _pagesSortDir = field === 'updated_at' ? 'desc' : 'asc';
  }
  _pagesCurrentPage = 1;
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

// ========== PARAMÈTRES DU SITE ==========
async function renderSiteSettings() {
  showLoading();
  try {
    const settings = await apiFetch('/settings');
    // Mettre à jour le cache global dès le chargement pour la prévisualisation
    siteSettingsCache = settings;
    // Appliquer les variables CSS tout de suite pour que les blocs utilisent ces couleurs
    applyCssVariablesFromSettings(siteSettingsCache);
    hideLoading();

    const siteName = settings.site_name || 'Mon site';
    const siteDescription = settings.site_description || '';
    const postsPerPage = settings.posts_per_page || '10';
    const frontPage = settings.front_page || '';

    // Charger les pages publiées pour le sélecteur de page d'accueil
    let pagesForSelect = [];
    try {
      pagesForSelect = await apiFetch('/pages');
      pagesForSelect = pagesForSelect.filter(p => p.status === 'published');
    } catch (e) { console.error('Failed to load pages for front page selector', e); }

    // Charger les blocs réutilisables pour le sélecteur footer
    let reusableBlocsForSelect = [];
    try {
      reusableBlocsForSelect = await apiFetch('/reusable-blocs');
      reusableBlocsForSelect = reusableBlocsForSelect.filter(b => b.status === 'published');
    } catch (e) { console.error('Failed to load reusable blocs', e); }

    const primaryColor = settings.primary_color || '#667eea';
    const secondaryColor = settings.secondary_color || '#f97316';
    const tertiaryColor = settings.tertiary_color || '#0ea5e9';
    const textColor = settings.text_color || '#130234';
    const backgroundColor = settings.background_color || '#ffffff';
    const bgFormField = settings.bg_form_field || '#e0e0e0';

    const fontTitle = settings.font_title || 'jakarta';
    const fontGeneral = settings.font_general || 'jakarta';

    const logo = settings.logo || '';
    const logoWhite = settings.logo_white || '';
    const logoLoader = settings.logo_loader || '';
    const favicon = settings.favicon || '';
    const replacementImage = settings.replacement_image || '';

    const menuSeamless = settings.menu_seamless === '1';
    const rounded = settings.rounded === '1';
    const uppercase = settings.uppercase === '1';
    const homeLoader = settings.home_loader === '1';
    const menuStyle = settings.menu_style || 'default';
    const secretMenu = settings.secret_menu === '1';
    const logoCustomHeight = settings.logo_custom_height === '1';
    const logoHeight = settings.logo_height || '100';
    const accessibility = settings.accessibility !== '0'; // par défaut activé
    const showBreadcrumb = settings.show_breadcrumb === '1';
    const pagesShareBtn = settings.pages_share_btn === '1';
    const shareBtnPosition = settings.share_btn_position === '1';

    const altSecondaryMenu = settings.alt_secondary_menu === '1';
    const topLink1Url = settings.top_link_1_url || '';
    const topLink1Text = settings.top_link_1_text || '';
    const iconLink1 = settings.icon_link_1 || '';
    const topLink2Url = settings.top_link_2_url || '';
    const topLink2Text = settings.top_link_2_text || '';
    const iconLink2 = settings.icon_link_2 || '';
    const showPhone = settings.show_phone === '1';
    const showSearch = settings.show_search === '1';
    const showSocials = settings.show_socials === '1';
    const phone = settings.phone || '';
    const phone2 = settings.phone_2 || '';
    const email = settings.email || '';
    const address = settings.address || '';
    const address2 = settings.address_2 || '';

    // Footer
    const footerColor = settings.footer_color || 'no-background-color';
    const footerText = settings.footer_text || '';
    const schedule = settings.schedule || '';
    const opening = settings.opening || '';
    const link1Url = settings.link_1_url || '';
    const link1Text = settings.link_1_text || '';
    const link2Url = settings.link_2_url || '';
    const link2Text = settings.link_2_text || '';
    const newsletterForm = settings.newsletter_form === '1';
    const newsletterFormTitle = settings.newsletter_form_title || '';
    const newsletterFormDesc = settings.newsletter_form_desc || '';
    const footerBgImg = settings.footer_bg_img || '';
    const footerBgOpacity = settings.footer_bg_opacity || '60';
    const footerBgParallax = settings.footer_bg_parallax === '1';
    const footerCustomBloc = settings.footer_custom_bloc || '';
    const footerCustomBlocLocation = settings.footer_custom_bloc_location || 'none';

    // Réseaux sociaux
    const instagram = settings.instagram || '';
    const facebook = settings.facebook || '';
    const threads = settings.threads || '';
    const tiktok = settings.tiktok || '';
    const linkedin = settings.linkedin || '';
    const twitter = settings.twitter || '';
    const tripadvisor = settings.tripadvisor || '';
    const pinterest = settings.pinterest || '';
    const youtube = settings.youtube || '';
    const idApplicationInstagram = settings.id_application_instagram || '';
    const secretKeyApplicationInstagram = settings.secret_key_application_instagram || '';
    const linkAccountInstagram = settings.link_account_instagram || '';
    const accessTokenInstagram = settings.access_token_instagram || '';

    // Popup
    const showAlert = settings.show_alert === '1';
    const blocColorAlert = settings.bloc_color_alert || 'no-background-color';
    const isSmallMargedAlert = settings.is_small_marged_alert === '1';
    const bgImgAlert = settings.bg_img_alert || '';
    const bgOpacityAlert = settings.bg_opacity_alert || '10';
    const alertText = settings.alert_text || '';
    const alertCtaUrl = settings.alert_cta_url || '';
    const alertCtaText = settings.alert_cta_text || '';
    const alertCta2Url = settings.alert_cta2_url || '';
    const alertCta2Text = settings.alert_cta2_text || '';

    // Bouton flottant
    const showBtn = settings.show_btn === '1';
    const floatingBtnLink = settings.floating_btn_link || '';
    const floatingBtnLinkTitle = settings.floating_btn_link_title || '';
    const floatingBtnImg = settings.floating_btn_img || '';

    // Maintenance
    const isMaintenance = settings.is_maintenance === '1';
    const textMaintenance = settings.text_maintenance || '';
    const showInfos = settings.show_infos === '1';
    const showRs = settings.show_rs === '1';

    // Cookies
    const cookieEnabled = settings.cookie_enabled === '1';
    const cookieTitle = settings.cookie_title || 'Hello ! voici des Cookies';
    const cookieDescription = settings.cookie_description || 'Ce site utilise des cookies essentiels pour assurer son bon fonctionnement et des cookies de suivi pour comprendre comment vous interagissez avec lui.';
    const cookiePrivacyUrl = settings.cookie_privacy_url || '';
    const cookieAcceptText = settings.cookie_accept_text || 'Tout accepter';
    const cookieRejectText = settings.cookie_reject_text || 'Tout rejeter';

    // Tracking
    const gaCode = settings.ga_code || '';
    const awCode = settings.aw_code || '';
    const gtmCode = settings.gtm_code || '';
    const metaPixelCode = settings.meta_pixel_code || '';
    const recaptchaSiteKey = settings.recaptcha_site_key || '';
    const recaptchaSecretKey = settings.recaptcha_secret_key || '';

    // Technique (admin)
    const isOnepage = settings.is_onepage === '1';
    const isActivateSchemas = settings.is_activate_schemas === '1';
    const customBalise = settings.custom_balise || '';
    const googleApiKey = settings.google_api_key || '';

    return `
      <div class="settings-page">
      <div class="page-header">
        <h1>Paramètres du site</h1>
      </div>

      <div class="card">
        <div class="settings-tabs" id="siteSettingsTabs">
          <button type="button" class="settings-tab is-active" data-target="#settings-identity">Identité</button>
          <button type="button" class="settings-tab" data-target="#settings-secondary-menu">Menu secondaire</button>
          <button type="button" class="settings-tab" data-target="#settings-footer">Footer</button>
          <button type="button" class="settings-tab" data-target="#settings-contact">Coordonnées</button>
          <button type="button" class="settings-tab" data-target="#settings-social">Réseaux sociaux</button>
          <button type="button" class="settings-tab" data-target="#settings-popup">Popup</button>
          <button type="button" class="settings-tab" data-target="#settings-floating">Bouton flottant</button>
          <button type="button" class="settings-tab" data-target="#settings-maintenance">Mode maintenance</button>
          <button type="button" class="settings-tab" data-target="#settings-cookies">Cookies</button>
          <button type="button" class="settings-tab" data-target="#settings-tracking">Tracking & Analytics</button>
          <button type="button" class="settings-tab" data-target="#settings-recaptcha">reCAPTCHA</button>
          <button type="button" class="settings-tab" data-target="#settings-technical">Technique</button>
        </div>

        <form id="siteSettingsForm" onsubmit="saveSiteSettings(event)">
          <div class="settings-section is-active" id="settings-identity">
          <div class="settings-subtabs">
            <button type="button" class="settings-subtab is-active" data-subtarget="#identity-general">Général</button>
            <button type="button" class="settings-subtab" data-subtarget="#identity-logos">Logos</button>
            <button type="button" class="settings-subtab" data-subtarget="#identity-colors">Couleurs</button>
            <button type="button" class="settings-subtab" data-subtarget="#identity-fonts">Polices</button>
            <button type="button" class="settings-subtab" data-subtarget="#identity-appearance">Apparence & navigation</button>
          </div>

          <div class="settings-subsection is-active" id="identity-general">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nom du site</label>
              <input type="text" class="form-input" name="site_name" value="${escapeHtml(siteName)}" placeholder="Nom affiché dans le header, le titre, etc.">
            </div>
            <div class="form-group">
              <label class="form-label">Slogan du site</label>
              <input type="text" class="form-input" name="site_description" placeholder="Slogan ou description courte (utilisée pour le SEO, les métadonnées, etc.)" value="${escapeHtml(siteDescription)}">
            </div>
          </div>

          <div class="form-row">
            
            <div class="form-group">
              <label class="form-label">Page d'accueil</label>
              <select class="form-select" name="front_page">
                <option value="">— Aucune (page par défaut) —</option>
                ${pagesForSelect.map(p => `<option value="${escapeHtml(p.slug)}"${p.slug === frontPage ? ' selected' : ''}>${escapeHtml(p.title)}</option>`).join('')}
              </select>
            </div>
          </div>
          </div>

          <div class="settings-subsection" id="identity-logos">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Logo</label>
              <div class="settings-media-field" data-setting="logo">
                <div class="settings-media-preview">${logo ? `<img src="${escapeHtml(logo)}" alt="Logo">` : ''}</div>
                <input type="hidden" name="logo" value="${escapeHtml(logo)}">
                <div class="settings-media-actions">
                  <button type="button" class="btn btn-sm btn-outline" onclick="openSettingsMediaPicker('logo')">Choisir</button>
                  ${logo ? `<button type="button" class="btn btn-sm btn-danger-outline" onclick="clearSettingsMedia('logo')">Supprimer</button>` : ''}
                </div>
                <p class="form-hint">Privilégiez un logo au format SVG.</p>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Logo blanc</label>
              <div class="settings-media-field" data-setting="logo_white">
                <div class="settings-media-preview">${logoWhite ? `<img src="${escapeHtml(logoWhite)}" alt="Logo blanc">` : ''}</div>
                <input type="hidden" name="logo_white" value="${escapeHtml(logoWhite)}">
                <div class="settings-media-actions">
                  <button type="button" class="btn btn-sm btn-outline" onclick="openSettingsMediaPicker('logo_white')">Choisir</button>
                  ${logoWhite ? `<button type="button" class="btn btn-sm btn-danger-outline" onclick="clearSettingsMedia('logo_white')">Supprimer</button>` : ''}
                </div>
                <p class="form-hint">Privilégiez un logo au format SVG.</p>
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Logo du loader</label>
              <div class="settings-media-field" data-setting="logo_loader">
                <div class="settings-media-preview">${logoLoader ? `<img src="${escapeHtml(logoLoader)}" alt="Logo loader">` : ''}</div>
                <input type="hidden" name="logo_loader" value="${escapeHtml(logoLoader)}">
                <div class="settings-media-actions">
                  <button type="button" class="btn btn-sm btn-outline" onclick="openSettingsMediaPicker('logo_loader')">Choisir</button>
                  ${logoLoader ? `<button type="button" class="btn btn-sm btn-danger-outline" onclick="clearSettingsMedia('logo_loader')">Supprimer</button>` : ''}
                </div>
                <p class="form-hint">Privilégiez un logo au format SVG.</p>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Favicon</label>
              <div class="settings-media-field" data-setting="favicon">
                <div class="settings-media-preview">${favicon ? `<img src="${escapeHtml(favicon)}" alt="Favicon">` : ''}</div>
                <input type="hidden" name="favicon" value="${escapeHtml(favicon)}">
                <div class="settings-media-actions">
                  <button type="button" class="btn btn-sm btn-outline" onclick="openSettingsMediaPicker('favicon')">Choisir</button>
                  ${favicon ? `<button type="button" class="btn btn-sm btn-danger-outline" onclick="clearSettingsMedia('favicon')">Supprimer</button>` : ''}
                </div>
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Image de remplacement</label>
              <div class="settings-media-field" data-setting="replacement_image">
                <div class="settings-media-preview">${replacementImage ? `<img src="${escapeHtml(replacementImage)}" alt="Image de remplacement">` : ''}</div>
                <input type="hidden" name="replacement_image" value="${escapeHtml(replacementImage)}">
                <div class="settings-media-actions">
                  <button type="button" class="btn btn-sm btn-outline" onclick="openSettingsMediaPicker('replacement_image')">Choisir</button>
                  ${replacementImage ? `<button type="button" class="btn btn-sm btn-danger-outline" onclick="clearSettingsMedia('replacement_image')">Supprimer</button>` : ''}
                </div>
                <p class="form-hint">Cette image sera utilisée partout où aucune image n'a été renseignée.</p>
              </div>
            </div>
          </div>
          </div>

          <div class="settings-subsection" id="identity-colors">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Couleur primaire</label>
              <input type="color" class="form-input" name="primary_color" value="${escapeHtml(primaryColor)}">
            </div>
            <div class="form-group">
              <label class="form-label">Couleur secondaire</label>
              <input type="color" class="form-input" name="secondary_color" value="${escapeHtml(secondaryColor)}">
            </div>
            <div class="form-group">
              <label class="form-label">Couleur tertiaire</label>
              <input type="color" class="form-input" name="tertiary_color" value="${escapeHtml(tertiaryColor)}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Couleur des textes</label>
              <input type="color" class="form-input" name="text_color" value="${escapeHtml(textColor)}">
            </div>
            <div class="form-group">
              <label class="form-label">Couleur de fond du site</label>
              <input type="color" class="form-input" name="background_color" value="${escapeHtml(backgroundColor)}">
            </div>
            <div class="form-group">
              <label class="form-label">Fond des champs de formulaire</label>
              <input type="color" class="form-input" name="bg_form_field" value="${escapeHtml(bgFormField)}">
            </div>
          </div>
          </div>

          <div class="settings-subsection" id="identity-fonts">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Police des titres</label>
              <select class="form-select" name="font_title">
                ${[
                  ['anek-odia', 'Anek Odia'],
                  ['crimson-pro', 'Crimson Pro'],
                  ['dm-serif', 'DM Serif Display'],
                  ['encode', 'Encode Sans Expanded'],
                  ['inter', 'Inter'],
                  ['jakarta', 'Plus Jakarta Sans'],
                  ['jost', 'Jost'],
                  ['kanit', 'Kanit'],
                  ['lilita-one', 'Lilita One'],
                  ['lora', 'Lora'],
                  ['montserrat', 'Montserrat'],
                  ['onest', 'Onest'],
                  ['open-sans', 'Open Sans'],
                  ['oswald', 'Oswald'],
                  ['playfair-display', 'Playfair Display'],
                  ['poppins', 'Poppins'],
                  ['prompt', 'Prompt'],
                  ['raleway', 'Raleway'],
                  ['rubik', 'Rubik'],
                  ['ubuntu', 'Ubuntu'],
                  ['zilla-slab', 'Zilla Slab']
                ].map(([val, label]) => `
                  <option value="${val}" ${fontTitle === val ? 'selected' : ''}>${label}</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Police du texte</label>
              <select class="form-select" name="font_general">
                ${[
                  ['barlow', 'Barlow'],
                  ['bitter', 'Bitter'],
                  ['cormorant-garamond', 'Cormorant Garamond'],
                  ['encode', 'Encode Sans Expanded'],
                  ['exo', 'Exo'],
                  ['inter', 'Inter'],
                  ['jakarta', 'Plus Jakarta Sans'],
                  ['jost', 'Jost'],
                  ['kanit', 'Kanit'],
                  ['lora', 'Lora'],
                  ['montserrat', 'Montserrat'],
                  ['onest', 'Onest'],
                  ['open-sans', 'Open Sans'],
                  ['roboto', 'Roboto'],
                  ['rubik', 'Rubik']
                ].map(([val, label]) => `
                  <option value="${val}" ${fontGeneral === val ? 'selected' : ''}>${label}</option>
                `).join('')}
              </select>
            </div>
          </div>
          <div id="font-preview-box" style="margin-top:16px;padding:24px 28px;border:1px solid var(--admin-border, #e0e0e0);border-radius:8px;background:#fff;">
            <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;">Apercu</p>
            <h3 id="font-preview-title" style="margin:0 0 10px;font-size:26px;line-height:1.3;transition:font-family .3s;"></h3>
            <p id="font-preview-body" style="margin:0;font-size:15px;line-height:1.7;color:#555;transition:font-family .3s;"></p>
          </div>
          </div>

          <div class="settings-subsection" id="identity-appearance">
          <div class="form-row">
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="menu_seamless" ${menuSeamless ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Fond du menu transparent</span></div>
            </div>
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="rounded" ${rounded ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Bords arrondis</span></div>
            </div>
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="uppercase" ${uppercase ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Éléments en majuscules (menu, titres, boutons)</span></div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="home_loader" ${homeLoader ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Logo de chargement (page d'accueil)</span></div>
            </div>
            <div class="form-group">
              <label class="form-label">Style du menu</label>
              <select class="form-select" name="menu_style">
                <option value="default" ${menuStyle === 'default' ? 'selected' : ''}>Logo à gauche</option>
                <option value="center" ${menuStyle === 'center' ? 'selected' : ''}>Logo au centre</option>
                <option value="burger" ${menuStyle === 'burger' ? 'selected' : ''}>Menu burger</option>
              </select>
            </div>
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="secret_menu" ${secretMenu ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Menu secondaire discret</span></div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="logo_custom_height" ${logoCustomHeight ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Modifier la taille du logo</span></div>
            </div>
            <div class="form-group">
              <label class="form-label">Hauteur du logo (px)</label>
              <input type="number" class="form-input" name="logo_height" value="${escapeHtml(logoHeight)}" min="50" max="400">
            </div>
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="accessibility" ${accessibility ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Accessibilité</span></div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="show_breadcrumb" ${showBreadcrumb ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Fils d'ariane</span></div>
            </div>
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="pages_share_btn" ${pagesShareBtn ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Boutons de partage sur les pages</span></div>
            </div>
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="share_btn_position" ${shareBtnPosition ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Position des boutons de partage (après le contenu)</span></div>
            </div>
          </div>
          </div>

          </div>
          <div class="settings-section" id="settings-secondary-menu">
          <h2 class="builder-settings-title" style="margin-top: 0;">Menu secondaire</h2>
          <div class="form-group">
            <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="alt_secondary_menu" ${altSecondaryMenu ? 'checked' : ''} onchange="toggleAltSecondaryMenu()"><span class="toggle-slider"></span></label><span class="toggle-label">Menu secondaire alternatif</span></div>
          </div>
          <div class="alt-secondary-menu-options" style="${altSecondaryMenu ? '' : 'display:none;'}">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Lien 1 — URL</label>
              <input type="url" class="form-input" name="top_link_1_url" value="${escapeHtml(topLink1Url)}" placeholder="https://...">
            </div>
            <div class="form-group">
              <label class="form-label">Lien 1 — Texte</label>
              <input type="text" class="form-input" name="top_link_1_text" value="${escapeHtml(topLink1Text)}" placeholder="Libellé du lien">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Icône lien 1</label>
              <div class="settings-media-field" data-setting="icon_link_1">
                <div class="settings-media-preview">${iconLink1 ? `<img src="${escapeHtml(iconLink1)}" alt="Icône lien 1">` : ''}</div>
                <input type="hidden" name="icon_link_1" value="${escapeHtml(iconLink1)}">
                <div class="settings-media-actions">
                  <button type="button" class="btn btn-sm btn-outline" onclick="openSettingsMediaPicker('icon_link_1')">Choisir</button>
                  ${iconLink1 ? `<button type="button" class="btn btn-sm btn-danger-outline" onclick="clearSettingsMedia('icon_link_1')">Supprimer</button>` : ''}
                </div>
                <p class="form-hint">SVG ou PNG uniquement.</p>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Icône lien 2</label>
              <div class="settings-media-field" data-setting="icon_link_2">
                <div class="settings-media-preview">${iconLink2 ? `<img src="${escapeHtml(iconLink2)}" alt="Icône lien 2">` : ''}</div>
                <input type="hidden" name="icon_link_2" value="${escapeHtml(iconLink2)}">
                <div class="settings-media-actions">
                  <button type="button" class="btn btn-sm btn-outline" onclick="openSettingsMediaPicker('icon_link_2')">Choisir</button>
                  ${iconLink2 ? `<button type="button" class="btn btn-sm btn-danger-outline" onclick="clearSettingsMedia('icon_link_2')">Supprimer</button>` : ''}
                </div>
                <p class="form-hint">SVG ou PNG uniquement.</p>
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Lien 2 — URL</label>
              <input type="url" class="form-input" name="top_link_2_url" value="${escapeHtml(topLink2Url)}" placeholder="https://...">
            </div>
            <div class="form-group">
              <label class="form-label">Lien 2 — Texte</label>
              <input type="text" class="form-input" name="top_link_2_text" value="${escapeHtml(topLink2Text)}" placeholder="Libellé du lien">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="show_phone" ${showPhone ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Affichage du téléphone</span></div>
            </div>
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="show_search" ${showSearch ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Affichage de la recherche</span></div>
            </div>
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="show_socials" ${showSocials ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Affichage des réseaux sociaux</span></div>
            </div>
          </div>
          </div>

          </div>
          <div class="settings-section" id="settings-footer">
          <h2 class="builder-settings-title" style="margin-top: 0;">Footer</h2>
          <div class="form-group">
            <label class="form-label">Couleur de fond du footer</label>
            <div class="radio-pill-group">
              ${[
                { value: 'no-background-color', label: 'Aucune', color: null },
                { value: 'has-background-primary', label: 'Primaire', color: settings.primary_color || null },
                { value: 'has-background-secondary', label: 'Secondaire', color: settings.secondary_color || null },
                { value: 'has-background-dark', label: 'Sombre', color: settings.default_color || '#224f5a' },
              ].map((opt, i) => {
                const checked = footerColor === opt.value ? 'checked' : '';
                const swatch = opt.color
                  ? '<span class="color-swatch" style="background:' + escapeHtml(opt.color) + '"></span>'
                  : '<span class="color-swatch color-swatch--none"></span>';
                return '<label class="radio-pill radio-pill--color" for="footer_color_' + i + '">'
                  + '<input type="radio" id="footer_color_' + i + '" name="footer_color" value="' + escapeHtml(opt.value) + '" ' + checked + '>'
                  + swatch
                  + '<span class="color-label">' + escapeHtml(opt.label) + '</span>'
                  + '</label>';
              }).join('')}
            </div>
          </div>
          <div class="form-row" style="align-items:end;">
            <div class="form-group">
              <label class="form-label">Image de fond</label>
              <div class="settings-media-field" data-setting="footer_bg_img">
                <div class="settings-media-preview">${footerBgImg ? `<img src="${escapeHtml(footerBgImg)}" alt="Image de fond footer">` : ''}</div>
                <input type="hidden" name="footer_bg_img" value="${escapeHtml(footerBgImg)}" onchange="toggleFooterBgOptions()">
                <div class="settings-media-actions">
                  <button type="button" class="btn btn-sm btn-outline" onclick="openSettingsMediaPicker('footer_bg_img')">Choisir</button>
                  ${footerBgImg ? `<button type="button" class="btn btn-sm btn-danger-outline" onclick="clearSettingsMedia('footer_bg_img')">Supprimer</button>` : ''}
                </div>
              </div>
            </div>
            <div class="form-group footer-bg-option" style="${footerBgImg ? '' : 'display:none;'}">
              <label class="form-label">Opacité</label>
              <input type="range" class="form-range" name="footer_bg_opacity" min="0" max="100" value="${escapeHtml(footerBgOpacity)}" oninput="this.nextElementSibling.value=this.value" style="flex:1;">
              <input type="number" class="form-input" value="${escapeHtml(footerBgOpacity)}" min="0" max="100" style="width:60px;" oninput="this.previousElementSibling.value=this.value;this.previousElementSibling.dispatchEvent(new Event('input'))">
            </div>
            <div class="form-group footer-bg-option" style="${footerBgImg ? '' : 'display:none;'}">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="footer_bg_parallax" ${footerBgParallax ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Mettre un effet de parallax ?</span></div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Lien 1 — URL</label>
              <input type="url" class="form-input" name="link_1_url" value="${escapeHtml(link1Url)}" placeholder="https://...">
            </div>
            <div class="form-group">
              <label class="form-label">Lien 1 — Texte</label>
              <input type="text" class="form-input" name="link_1_text" value="${escapeHtml(link1Text)}" placeholder="Libellé du lien">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Lien 2 — URL</label>
              <input type="url" class="form-input" name="link_2_url" value="${escapeHtml(link2Url)}" placeholder="https://...">
            </div>
            <div class="form-group">
              <label class="form-label">Lien 2 — Texte</label>
              <input type="text" class="form-input" name="link_2_text" value="${escapeHtml(link2Text)}" placeholder="Libellé du lien">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Texte libre</label>
            <textarea class="form-textarea" name="footer_text" rows="3">${escapeHtml(footerText)}</textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Horaires</label>
              <textarea class="form-textarea" name="schedule" rows="2" placeholder="Lundi / vendredi 8h30 / 18h30&#10;Samedi 8h30 / 12h30">${escapeHtml(schedule)}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Horaires courtes</label>
              <textarea class="form-textarea" name="opening" rows="2" placeholder="Mo-Fr 09:00-18:00">${escapeHtml(opening)}</textarea>
            </div>
          </div>
          <div class="form-group">
            <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="newsletter_form" ${newsletterForm ? 'checked' : ''} onchange="toggleNewsletterOptions()"><span class="toggle-slider"></span></label><span class="toggle-label">Inscription newsletter</span></div>
          </div>
          <div class="form-row newsletter-option" style="${newsletterForm ? '' : 'display:none;'}">
            <div class="form-group">
              <label class="form-label">Titre newsletter</label>
              <input type="text" class="form-input" name="newsletter_form_title" value="${escapeHtml(newsletterFormTitle)}">
            </div>
            <div class="form-group">
              <label class="form-label">Description newsletter</label>
              <input type="text" class="form-input" name="newsletter_form_desc" value="${escapeHtml(newsletterFormDesc)}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Emplacement du bloc</label>
              <div class="btn-group-toggle" style="display:flex;gap:0;">
                <label class="btn-toggle ${footerCustomBlocLocation === 'none' ? 'is-active' : ''}">
                  <input type="radio" name="footer_custom_bloc_location" value="none" ${footerCustomBlocLocation === 'none' ? 'checked' : ''} onchange="this.closest('.btn-group-toggle').querySelectorAll('.btn-toggle').forEach(b=>b.classList.remove('is-active'));this.closest('.btn-toggle').classList.add('is-active');toggleFooterBlocSelect()">
                  Ne pas afficher
                </label>
                <label class="btn-toggle ${footerCustomBlocLocation === 'before' ? 'is-active' : ''}">
                  <input type="radio" name="footer_custom_bloc_location" value="before" ${footerCustomBlocLocation === 'before' ? 'checked' : ''} onchange="this.closest('.btn-group-toggle').querySelectorAll('.btn-toggle').forEach(b=>b.classList.remove('is-active'));this.closest('.btn-toggle').classList.add('is-active');toggleFooterBlocSelect()">
                  Avant le Footer
                </label>
                <label class="btn-toggle ${footerCustomBlocLocation === 'after' ? 'is-active' : ''}">
                  <input type="radio" name="footer_custom_bloc_location" value="after" ${footerCustomBlocLocation === 'after' ? 'checked' : ''} onchange="this.closest('.btn-group-toggle').querySelectorAll('.btn-toggle').forEach(b=>b.classList.remove('is-active'));this.closest('.btn-toggle').classList.add('is-active');toggleFooterBlocSelect()">
                  Après le Footer
                </label>
              </div>
            </div>
            <div class="form-group" id="footerBlocSelectGroup" style="${footerCustomBlocLocation === 'none' ? 'display:none' : ''}">
              <label class="form-label">Bloc réutilisable</label>
              <select class="form-select" name="footer_custom_bloc">
                <option value="">— Sélectionner un bloc —</option>
                ${reusableBlocsForSelect.map(b => `<option value="${b.id}" ${String(footerCustomBloc) === String(b.id) ? 'selected' : ''}>${escapeHtml(b.title)}</option>`).join('')}
              </select>
            </div>
          </div>

          </div>
          <div class="settings-section" id="settings-contact">
          <h2 class="builder-settings-title" style="margin-top: 0;">Coordonnées</h2>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">N° de téléphone (principal)</label>
              <input type="text" class="form-input" name="phone" value="${escapeHtml(phone)}" placeholder="ex : 01 23 45 67 89">
            </div>
            <div class="form-group">
              <label class="form-label">N° de téléphone (secondaire)</label>
              <input type="text" class="form-input" name="phone_2" value="${escapeHtml(phone2)}" placeholder="ex : 01 23 45 67 89">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Adresse principale</label>
              <input type="text" class="form-input" name="address" value="${escapeHtml(address)}" placeholder="ex : 1 rue de la Paix, 75001 Paris">
            </div>
            <div class="form-group">
              <label class="form-label">Adresse secondaire</label>
              <input type="text" class="form-input" name="address_2" value="${escapeHtml(address2)}" placeholder="ex : 10 avenue des Champs-Élysées, 75008 Paris">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Adresse e-mail</label>
            <input type="email" class="form-input" name="email" value="${escapeHtml(email)}" placeholder="ex : john.doe@monsite.fr">
          </div>

          </div>
          <div class="settings-section" id="settings-social">
          <h2 class="builder-settings-title" style="margin-top: 0;">Réseaux sociaux</h2>
          <div class="form-help" style="margin-bottom: 1rem;">Si vous ne souhaitez pas afficher un réseau social, laissez le champ vide.</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Instagram</label>
              <input type="url" class="form-input" name="instagram" value="${escapeHtml(instagram)}">
            </div>
            <div class="form-group">
              <label class="form-label">Facebook</label>
              <input type="url" class="form-input" name="facebook" value="${escapeHtml(facebook)}">
            </div>
            <div class="form-group">
              <label class="form-label">Threads</label>
              <input type="url" class="form-input" name="threads" value="${escapeHtml(threads)}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">TikTok</label>
              <input type="url" class="form-input" name="tiktok" value="${escapeHtml(tiktok)}">
            </div>
            <div class="form-group">
              <label class="form-label">LinkedIn</label>
              <input type="url" class="form-input" name="linkedin" value="${escapeHtml(linkedin)}">
            </div>
            <div class="form-group">
              <label class="form-label">X (Twitter)</label>
              <input type="url" class="form-input" name="twitter" value="${escapeHtml(twitter)}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tripadvisor</label>
              <input type="url" class="form-input" name="tripadvisor" value="${escapeHtml(tripadvisor)}">
            </div>
            <div class="form-group">
              <label class="form-label">Pinterest</label>
              <input type="url" class="form-input" name="pinterest" value="${escapeHtml(pinterest)}">
            </div>
            <div class="form-group">
              <label class="form-label">YouTube</label>
              <input type="url" class="form-input" name="youtube" value="${escapeHtml(youtube)}">
            </div>
          </div>
          <h3 class="builder-settings-title" style="margin-top: 1.5rem;">Configuration du Feed Instagram</h3>
          <div class="form-help" style="margin-bottom: 1rem;">Le compte Instagram doit être public et être un business account.</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Id application</label>
              <input type="text" class="form-input" name="id_application_instagram" value="${escapeHtml(idApplicationInstagram)}">
            </div>
            <div class="form-group">
              <label class="form-label">Clé secrète application</label>
              <input type="text" class="form-input" name="secret_key_application_instagram" value="${escapeHtml(secretKeyApplicationInstagram)}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Lien du compte Instagram</label>
              <input type="url" class="form-input" name="link_account_instagram" value="${escapeHtml(linkAccountInstagram)}">
            </div>
            <div class="form-group">
              <label class="form-label">Jeton d'accès temporaire</label>
              <input type="text" class="form-input" name="access_token_instagram" value="${escapeHtml(accessTokenInstagram)}">
            </div>
          </div>

          </div>
          <div class="settings-section" id="settings-popup">
          <h2 class="builder-settings-title" style="margin-top: 0;">Popup</h2>
          <div class="form-group">
            <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="show_alert" ${showAlert ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Affichage de l'alerte</span></div>
          </div>
          <div class="form-row">
          <div class="form-group">
            <label class="form-label">Couleur de fond du bloc</label>
            <select class="form-select" name="bloc_color_alert">
              <option value="no-background-color" ${blocColorAlert === 'no-background-color' ? 'selected' : ''}>Aucune</option>
              <option value="has-background-primary" ${blocColorAlert === 'has-background-primary' ? 'selected' : ''}>Couleur primaire</option>
              <option value="has-background-secondary" ${blocColorAlert === 'has-background-secondary' ? 'selected' : ''}>Couleur secondaire</option>
              <option value="has-background-tertiary" ${blocColorAlert === 'has-background-tertiary' ? 'selected' : ''}>Couleur tertiaire</option>
            </select>
          </div>
          <div class="form-group">
            <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="is_small_marged_alert" ${isSmallMargedAlert ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Marges réduites autour du bloc</span></div>
          </div>
          </div>
          <div class="form-row" style="align-items:end;">
            <div class="form-group">
              <label class="form-label">Image de fond</label>
              <div class="settings-media-field" data-setting="bg_img_alert">
                <div class="settings-media-preview">${bgImgAlert ? `<img src="${escapeHtml(bgImgAlert)}" alt="Image de fond popup">` : ''}</div>
                <input type="hidden" name="bg_img_alert" value="${escapeHtml(bgImgAlert)}" onchange="toggleAlertBgOptions()">
                <div class="settings-media-actions">
                  <button type="button" class="btn btn-sm btn-outline" onclick="openSettingsMediaPicker('bg_img_alert')">Choisir</button>
                  ${bgImgAlert ? `<button type="button" class="btn btn-sm btn-danger-outline" onclick="clearSettingsMedia('bg_img_alert')">Supprimer</button>` : ''}
                </div>
              </div>
            </div>
            <div class="form-group alert-bg-option" style="${bgImgAlert ? '' : 'display:none;'}">
              <label class="form-label">Opacité</label>
              <input type="range" class="form-range" name="bg_opacity_alert" min="0" max="100" value="${escapeHtml(bgOpacityAlert)}" oninput="this.nextElementSibling.value=this.value" style="flex:1;">
              <input type="number" class="form-input" value="${escapeHtml(bgOpacityAlert)}" min="0" max="100" style="width:60px;" oninput="this.previousElementSibling.value=this.value;this.previousElementSibling.dispatchEvent(new Event('input'))">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Texte de la popup</label>
            <textarea class="form-textarea" name="alert_text" rows="4">${escapeHtml(alertText)}</textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Premier lien — URL</label>
              <input type="url" class="form-input" name="alert_cta_url" value="${escapeHtml(alertCtaUrl)}" placeholder="https://...">
            </div>
            <div class="form-group">
              <label class="form-label">Premier lien — Texte</label>
              <input type="text" class="form-input" name="alert_cta_text" value="${escapeHtml(alertCtaText)}" placeholder="Libellé du lien">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Deuxième lien — URL</label>
              <input type="url" class="form-input" name="alert_cta2_url" value="${escapeHtml(alertCta2Url)}" placeholder="https://...">
            </div>
            <div class="form-group">
              <label class="form-label">Deuxième lien — Texte</label>
              <input type="text" class="form-input" name="alert_cta2_text" value="${escapeHtml(alertCta2Text)}" placeholder="Libellé du lien">
            </div>
          </div>

          </div>
          <div class="settings-section" id="settings-floating">
          <h2 class="builder-settings-title" style="margin-top: 0;">Bouton flottant</h2>
          <div class="form-group">
            <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="show_btn" ${showBtn ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Affichage du bouton</span></div>
          </div>
          <div class="form-group" style="width:50%;display:inline-block;vertical-align:top;padding-right:8px;">
            <label class="form-label">Lien du bouton</label>
            <input type="url" class="form-input" name="floating_btn_link" value="${escapeHtml(floatingBtnLink)}">
          </div>
          <div class="form-group" style="width:50%;display:inline-block;vertical-align:top;padding-left:8px;">
            <label class="form-label">Titre du lien</label>
            <input type="text" class="form-input" name="floating_btn_link_title" value="${escapeHtml(floatingBtnLinkTitle)}" placeholder="Ex: Nous contacter">
          </div>
          <div class="form-group">
            <label class="form-label">Icône du bouton</label>
            <div class="settings-media-field" data-setting="floating_btn_img">
              <div class="settings-media-preview">${floatingBtnImg ? `<img src="${escapeHtml(floatingBtnImg)}" alt="Icône bouton flottant">` : ''}</div>
              <input type="hidden" name="floating_btn_img" value="${escapeHtml(floatingBtnImg)}">
              <div class="settings-media-actions">
                <button type="button" class="btn btn-sm btn-outline" onclick="openSettingsMediaPicker('floating_btn_img')">Choisir</button>
                ${floatingBtnImg ? `<button type="button" class="btn btn-sm btn-danger-outline" onclick="clearSettingsMedia('floating_btn_img')">Supprimer</button>` : ''}
              </div>
              <p class="form-hint">SVG ou PNG uniquement.</p>
            </div>
          </div>

          </div>
          <div class="settings-section" id="settings-maintenance">
          <h2 class="builder-settings-title" style="margin-top: 0;">Mode maintenance</h2>
          <div class="form-group">
            <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="is_maintenance" ${isMaintenance ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Activer le mode maintenance</span></div>
          </div>
          <div class="form-group">
            <label class="form-label">Texte de la page maintenance</label>
            <textarea class="form-textarea" name="text_maintenance" rows="3">${escapeHtml(textMaintenance)}</textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="show_infos" ${showInfos ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Afficher coordonnées et horaires</span></div>
            </div>
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="show_rs" ${showRs ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Afficher les réseaux sociaux</span></div>
            </div>
          </div>

          </div>
          <div class="settings-section" id="settings-cookies">
          <h2 class="builder-settings-title" style="margin-top: 0;">Bandeau de cookies</h2>
          <p style="margin-bottom:16px;color:var(--gray-500);font-size:13px">Configure le bandeau de consentement aux cookies (RGPD). Les scripts de tracking (GA, GTM, Meta Pixel) ne seront chargés qu'après consentement.</p>
          <div class="form-row">
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="cookie_enabled" ${cookieEnabled ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Activer le bandeau de cookies</span></div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Titre du bandeau</label>
              <input type="text" class="form-input" name="cookie_title" value="${escapeHtml(cookieTitle)}" placeholder="Hello ! voici des Cookies">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" name="cookie_description" rows="3" placeholder="Ce site utilise des cookies essentiels...">${escapeHtml(cookieDescription)}</textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">URL politique de confidentialité</label>
              <input type="text" class="form-input" name="cookie_privacy_url" value="${escapeHtml(cookiePrivacyUrl)}" placeholder="/politique-de-confidentialite/">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Texte bouton « Accepter »</label>
              <input type="text" class="form-input" name="cookie_accept_text" value="${escapeHtml(cookieAcceptText)}" placeholder="Tout accepter">
            </div>
            <div class="form-group">
              <label class="form-label">Texte bouton « Rejeter »</label>
              <input type="text" class="form-input" name="cookie_reject_text" value="${escapeHtml(cookieRejectText)}" placeholder="Tout rejeter">
            </div>
          </div>
          </div>

          <div class="settings-section" id="settings-tracking">
          <h2 class="builder-settings-title" style="margin-top: 0;">Tracking & Analytics</h2>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Code Google Analytics (GA4)</label>
              <input type="text" class="form-input" name="ga_code" value="${escapeHtml(gaCode)}">
            </div>
            <div class="form-group">
              <label class="form-label">Code Google Ads</label>
              <input type="text" class="form-input" name="aw_code" value="${escapeHtml(awCode)}">
            </div>
            <div class="form-group">
              <label class="form-label">Code GTM</label>
              <input type="text" class="form-input" name="gtm_code" value="${escapeHtml(gtmCode)}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Code Meta Pixel</label>
            <input type="text" class="form-input" name="meta_pixel_code" value="${escapeHtml(metaPixelCode)}">
          </div>

          </div>
          <div class="settings-section" id="settings-recaptcha">
          <h2 class="builder-settings-title" style="margin-top: 0;">reCAPTCHA v3</h2>
          <p style="margin-bottom:16px;color:var(--gray-500);font-size:13px">Ces clés sont utilisées par le système de formulaires. Obtenez-les sur <a href="https://www.google.com/recaptcha/admin" target="_blank" rel="noopener">Google reCAPTCHA</a>.</p>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Clé du site (site key)</label>
              <input type="text" class="form-input" name="recaptcha_site_key" value="${escapeHtml(recaptchaSiteKey)}" placeholder="6Le...">
            </div>
            <div class="form-group">
              <label class="form-label">Clé secrète (secret key)</label>
              <input type="text" class="form-input" name="recaptcha_secret_key" value="${escapeHtml(recaptchaSecretKey)}" placeholder="6Le...">
            </div>
          </div>
          </div>
          <div class="settings-section" id="settings-technical">
          <h2 class="builder-settings-title" style="margin-top: 0;">Technique</h2>
          <div class="form-row">
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="is_onepage" ${isOnepage ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Site en OnePage</span></div>
            </div>
            <div class="form-group">
              <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" name="is_activate_schemas" ${isActivateSchemas ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Schemas.org</span></div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Balise head personnalisée</label>
            <textarea class="form-textarea" name="custom_balise" rows="3" placeholder="Code HTML à injecter dans le <head>">${escapeHtml(customBalise)}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Google API Key</label>
            <input type="text" class="form-input" name="google_api_key" value="${escapeHtml(googleApiKey)}">
          </div>

          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
            <button type="submit" class="btn btn-primary">
              Enregistrer les paramètres
            </button>
          </div>
        </form>
      </div>
      </div>
    `;
  } catch (error) {
    hideLoading();
    showToast('Erreur lors du chargement des paramètres du site', 'error');
    return `<div class="card"><p style="color: var(--danger)">Erreur: ${error.message}</p></div>`;
  }
}

async function saveSiteSettings(event) {
  event.preventDefault();
  const form = document.getElementById('siteSettingsForm');
  if (!form) return;
  const formData = new FormData(form);

  const payload = {
    site_name: formData.get('site_name') || '',
    site_description: formData.get('site_description') || '',
    posts_per_page: formData.get('posts_per_page') || '',
    front_page: formData.get('front_page') || '',
    logo: formData.get('logo') || '',
    logo_white: formData.get('logo_white') || '',
    logo_loader: formData.get('logo_loader') || '',
    favicon: formData.get('favicon') || '',
    replacement_image: formData.get('replacement_image') || '',
    primary_color: formData.get('primary_color') || '',
    secondary_color: formData.get('secondary_color') || '',
    tertiary_color: formData.get('tertiary_color') || '',
    text_color: formData.get('text_color') || '',
    background_color: formData.get('background_color') || '',
    bg_form_field: formData.get('bg_form_field') || '',
    font_title: formData.get('font_title') || '',
    font_general: formData.get('font_general') || '',
    menu_seamless: formData.get('menu_seamless') ? '1' : '0',
    rounded: formData.get('rounded') ? '1' : '0',
    uppercase: formData.get('uppercase') ? '1' : '0',
    home_loader: formData.get('home_loader') ? '1' : '0',
    menu_style: formData.get('menu_style') || 'default',
    secret_menu: formData.get('secret_menu') ? '1' : '0',
    logo_custom_height: formData.get('logo_custom_height') ? '1' : '0',
    logo_height: formData.get('logo_height') || '',
    accessibility: formData.get('accessibility') ? '1' : '0',
    show_breadcrumb: formData.get('show_breadcrumb') ? '1' : '0',
    pages_share_btn: formData.get('pages_share_btn') ? '1' : '0',
    share_btn_position: formData.get('share_btn_position') ? '1' : '0',
    alt_secondary_menu: formData.get('alt_secondary_menu') ? '1' : '0',
    top_link_1_url: formData.get('top_link_1_url') || '',
    top_link_1_text: formData.get('top_link_1_text') || '',
    icon_link_1: formData.get('icon_link_1') || '',
    top_link_2_url: formData.get('top_link_2_url') || '',
    top_link_2_text: formData.get('top_link_2_text') || '',
    icon_link_2: formData.get('icon_link_2') || '',
    show_phone: formData.get('show_phone') ? '1' : '0',
    show_search: formData.get('show_search') ? '1' : '0',
    show_socials: formData.get('show_socials') ? '1' : '0',
    phone: formData.get('phone') || '',
    phone_2: formData.get('phone_2') || '',
    email: formData.get('email') || '',
    address: formData.get('address') || '',
    address_2: formData.get('address_2') || '',
    footer_color: formData.get('footer_color') || 'no-background-color',
    footer_bg_img: formData.get('footer_bg_img') || '',
    footer_bg_opacity: formData.get('footer_bg_opacity') || '60',
    footer_bg_parallax: formData.get('footer_bg_parallax') ? '1' : '0',
    footer_custom_bloc: formData.get('footer_custom_bloc') || '',
    footer_custom_bloc_location: formData.get('footer_custom_bloc_location') || 'none',
    link_1_url: formData.get('link_1_url') || '',
    link_1_text: formData.get('link_1_text') || '',
    link_2_url: formData.get('link_2_url') || '',
    link_2_text: formData.get('link_2_text') || '',
    footer_text: formData.get('footer_text') || '',
    schedule: formData.get('schedule') || '',
    opening: formData.get('opening') || '',
    newsletter_form: formData.get('newsletter_form') ? '1' : '0',
    newsletter_form_title: formData.get('newsletter_form_title') || '',
    newsletter_form_desc: formData.get('newsletter_form_desc') || '',
    instagram: formData.get('instagram') || '',
    facebook: formData.get('facebook') || '',
    threads: formData.get('threads') || '',
    tiktok: formData.get('tiktok') || '',
    linkedin: formData.get('linkedin') || '',
    twitter: formData.get('twitter') || '',
    tripadvisor: formData.get('tripadvisor') || '',
    pinterest: formData.get('pinterest') || '',
    youtube: formData.get('youtube') || '',
    id_application_instagram: formData.get('id_application_instagram') || '',
    secret_key_application_instagram: formData.get('secret_key_application_instagram') || '',
    link_account_instagram: formData.get('link_account_instagram') || '',
    access_token_instagram: formData.get('access_token_instagram') || '',
    show_alert: formData.get('show_alert') ? '1' : '0',
    bloc_color_alert: formData.get('bloc_color_alert') || 'no-background-color',
    is_small_marged_alert: formData.get('is_small_marged_alert') ? '1' : '0',
    bg_img_alert: formData.get('bg_img_alert') || '',
    bg_opacity_alert: formData.get('bg_opacity_alert') || '10',
    alert_text: formData.get('alert_text') || '',
    alert_cta_url: formData.get('alert_cta_url') || '',
    alert_cta_text: formData.get('alert_cta_text') || '',
    alert_cta2_url: formData.get('alert_cta2_url') || '',
    alert_cta2_text: formData.get('alert_cta2_text') || '',
    show_btn: formData.get('show_btn') ? '1' : '0',
    floating_btn_link: formData.get('floating_btn_link') || '',
    floating_btn_link_title: formData.get('floating_btn_link_title') || '',
    floating_btn_img: formData.get('floating_btn_img') || '',
    is_maintenance: formData.get('is_maintenance') ? '1' : '0',
    text_maintenance: formData.get('text_maintenance') || '',
    show_infos: formData.get('show_infos') ? '1' : '0',
    show_rs: formData.get('show_rs') ? '1' : '0',
    cookie_enabled: formData.get('cookie_enabled') ? '1' : '0',
    cookie_title: formData.get('cookie_title') || '',
    cookie_description: formData.get('cookie_description') || '',
    cookie_privacy_url: formData.get('cookie_privacy_url') || '',
    cookie_accept_text: formData.get('cookie_accept_text') || '',
    cookie_reject_text: formData.get('cookie_reject_text') || '',
    ga_code: formData.get('ga_code') || '',
    aw_code: formData.get('aw_code') || '',
    gtm_code: formData.get('gtm_code') || '',
    meta_pixel_code: formData.get('meta_pixel_code') || '',
    recaptcha_site_key: formData.get('recaptcha_site_key') || '',
    recaptcha_secret_key: formData.get('recaptcha_secret_key') || '',
    is_onepage: formData.get('is_onepage') ? '1' : '0',
    is_activate_schemas: formData.get('is_activate_schemas') ? '1' : '0',
    custom_balise: formData.get('custom_balise') || '',
    google_api_key: formData.get('google_api_key') || ''
  };

  // Remember active tab & subtab before reload
  const activeTab = document.querySelector('#siteSettingsTabs .settings-tab.is-active');
  const activeTabTarget = activeTab ? activeTab.getAttribute('data-target') : null;
  const activeSubtab = document.querySelector('.settings-section.is-active .settings-subtab.is-active');
  const activeSubtabTarget = activeSubtab ? activeSubtab.getAttribute('data-subtarget') : null;

  showLoading();
  try {
    await apiFetch('/settings', { method: 'PUT', body: JSON.stringify(payload) });
    // Mettre à jour le cache local et les variables CSS pour que les modules
    // utilisent immédiatement les nouvelles couleurs aussi bien dans l'admin que dans le builder
    siteSettingsCache = { ...(siteSettingsCache || {}), ...payload };
    applyCssVariablesFromSettings(siteSettingsCache);
    hideLoading();
    showToast('Paramètres du site enregistrés', 'success');
    await loadSection('site-settings');

    // Restore active tab
    if (activeTabTarget) {
      const tab = document.querySelector(`#siteSettingsTabs .settings-tab[data-target="${activeTabTarget}"]`);
      if (tab) tab.click();
    }
    // Restore active subtab
    if (activeSubtabTarget) {
      const subtab = document.querySelector(`.settings-section.is-active .settings-subtab[data-subtarget="${activeSubtabTarget}"]`);
      if (subtab) subtab.click();
    }
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
  }
}

function toggleFooterBlocSelect() {
  const group = document.getElementById('footerBlocSelectGroup');
  if (!group) return;
  const checked = document.querySelector('input[name="footer_custom_bloc_location"]:checked');
  group.style.display = (checked && checked.value !== 'none') ? '' : 'none';
}

function attachSiteSettingsTabs() {
  const tabs = document.querySelectorAll('#siteSettingsTabs .settings-tab');
  if (!tabs.length) return;
  tabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const target = tab.getAttribute('data-target');
      if (!target) return;
      // Hide all sections
      document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('is-active'));
      // Show target section
      const section = document.querySelector(target);
      if (section) section.classList.add('is-active');
      // Update active tab
      tabs.forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
    });
  });

  // Sub-tabs (inside sections like Identité)
  document.querySelectorAll('.settings-subtab').forEach(subtab => {
    subtab.addEventListener('click', (e) => {
      e.preventDefault();
      const target = subtab.getAttribute('data-subtarget');
      if (!target) return;
      const parent = subtab.closest('.settings-section');
      if (!parent) return;
      parent.querySelectorAll('.settings-subsection').forEach(s => s.classList.remove('is-active'));
      const section = parent.querySelector(target);
      if (section) section.classList.add('is-active');
      parent.querySelectorAll('.settings-subtab').forEach(t => t.classList.remove('is-active'));
      subtab.classList.add('is-active');
    });
  });
}

function initFontPreview() {
  const titleSelect = document.querySelector('select[name="font_title"]');
  const generalSelect = document.querySelector('select[name="font_general"]');
  const previewTitle = document.getElementById('font-preview-title');
  const previewBody = document.getElementById('font-preview-body');
  if (!titleSelect || !generalSelect || !previewTitle || !previewBody) return;

  const loadedFonts = new Set();
  function loadGoogleFont(fontName) {
    if (loadedFonts.has(fontName)) return;
    loadedFonts.add(fontName);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@400;600;700&display=swap`;
    document.head.appendChild(link);
  }

  function getSelectedLabel(select) {
    return select.options[select.selectedIndex]?.text || '';
  }

  function updatePreview() {
    const titleFont = getSelectedLabel(titleSelect);
    const bodyFont = getSelectedLabel(generalSelect);
    loadGoogleFont(titleFont);
    loadGoogleFont(bodyFont);
    previewTitle.style.fontFamily = `'${titleFont}', sans-serif`;
    previewTitle.textContent = `Titre en ${titleFont}`;
    previewBody.style.fontFamily = `'${bodyFont}', sans-serif`;
    previewBody.textContent = `Ceci est un exemple de texte courant en ${bodyFont}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`;
  }

  titleSelect.addEventListener('change', updatePreview);
  generalSelect.addEventListener('change', updatePreview);
  updatePreview();
}

// ========== THÈME ==========
const THEME_OPTIONS = [
  { id: 'default', name: 'Thème par défaut' },
  { id: 'dark', name: 'Thème sombre' },
  { id: 'minimal', name: 'Thème minimaliste' },
  { id: 'colorful', name: 'Thème coloré' },
  { id: 'nature', name: 'Thème nature' }
];

async function renderTheme() {
  showLoading();
  try {
    const settings = await apiFetch('/settings');
    const useChildTheme = settings.theme_use_child === '1';
    const activeTheme = settings.active_theme || 'default';

    hideLoading();

    return `
      <div class="page-header">
        <h1>Thème</h1>
      </div>

      <div class="card">
        <p class="form-help" style="margin-bottom: 24px;">
          Le <strong>thème de base</strong> s'applique à tout le site. Vous pouvez activer un <strong>thème enfant</strong> pour ajouter une couche de personnalisation (couleurs, style) par-dessus le thème de base.
        </p>

        <form id="themeForm" onsubmit="saveTheme(event)">
          <div class="form-group">
            <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" id="themeUseChild" name="theme_use_child" ${useChildTheme ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Activer un thème enfant</span></div>
            <div class="form-help">Quand activé, le thème enfant sélectionné ci-dessous sera appliqué en plus du thème de base.</div>
          </div>

          <div class="form-group" id="themeChildGroup">
            <label class="form-label">Thème enfant</label>
            <select class="form-select" id="activeTheme" name="active_theme">
              ${THEME_OPTIONS.map(t => `
                <option value="${t.id}" ${activeTheme === t.id ? 'selected' : ''}>${t.name}</option>
              `).join('')}
            </select>
            <div class="form-help">Choisissez le thème qui sera appliqué en surcouche.</div>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
            <button type="submit" class="btn btn-primary">
              Enregistrer le thème
            </button>
          </div>
        </form>
      </div>
    `;
  } catch (error) {
    hideLoading();
    showToast('Erreur lors du chargement des paramètres thème', 'error');
    return `<div class="card"><p style="color: var(--danger)">Erreur: ${error.message}</p></div>`;
  }
}

async function saveTheme(event) {
  event.preventDefault();
  const form = document.getElementById('themeForm');
  const formData = new FormData(form);
  const useChild = document.getElementById('themeUseChild').checked;

  const data = {
    theme_use_child: useChild ? '1' : '0',
    active_theme: formData.get('active_theme') || 'default'
  };

  showLoading();
  try {
    await apiFetch('/settings', { method: 'PUT', body: JSON.stringify(data) });
    hideLoading();
    showToast('Thème enregistré', 'success');
    applyAdminTheme(data.theme_use_child === '1', data.active_theme);
    loadSection('theme');
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
  }
}

// Slug generation functions
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')                   // Normalize accents
    .replace(/[\u0300-\u036f]/g, '')   // Remove accents
    .replace(/[^a-z0-9\s-]/g, '')      // Remove special chars
    .trim()
    .replace(/\s+/g, '-')               // Replace spaces with -
    .replace(/-+/g, '-');               // Replace multiple - with single -
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

// ========== UTILITIES ==========
function closeModal() {
  const pageModal = document.getElementById('pageModal');
  const userModal = document.getElementById('userModal');

  if (pageModal) pageModal.style.display = 'none';
  if (userModal) userModal.style.display = 'none';
}

function renderEmptyState(icon, title, subtitle) {
  return `
    <div class="empty-state">
      <div class="icon">${icon}</div>
      <h3>${title}</h3>
      <p>${subtitle}</p>
    </div>
  `;
}

async function apiFetch(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

async function apiUpload(endpoint, formData) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return response.json();
}

let _loadingTimer = null;
let _loadingDelayTimer = null;

function showLoading(text = '') {
  const overlay = document.getElementById('loadingOverlay');
  const textEl = document.getElementById('loadingText');
  if (textEl) textEl.textContent = text;

  // Delay showing the overlay to avoid flash on fast navigations
  clearTimeout(_loadingDelayTimer);
  _loadingDelayTimer = setTimeout(() => {
    overlay.classList.add('show');
  }, 300);

  // If no explicit text, show "Publication en cours…" after 2s (rebuild is running)
  clearTimeout(_loadingTimer);
  if (!text) {
    _loadingTimer = setTimeout(() => {
      if (textEl && overlay.classList.contains('show')) {
        textEl.textContent = 'Publication en cours…';
      }
    }, 2000);
  }
}

function hideLoading() {
  clearTimeout(_loadingTimer);
  clearTimeout(_loadingDelayTimer);
  _loadingTimer = null;
  _loadingDelayTimer = null;
  const overlay = document.getElementById('loadingOverlay');
  const textEl = document.getElementById('loadingText');
  if (textEl) textEl.textContent = '';
  overlay.classList.remove('show');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}

async function clearAllCaches() {
  // Module templates & field schema
  Object.keys(moduleTemplateCache).forEach(k => delete moduleTemplateCache[k]);
  moduleFieldSchema = null;
  _layoutToModuleName = null;
  siteSettingsCache = null;
  moduleStylesLoaded.clear();
  moduleAdminStylesLoaded.clear();
  // Remove dynamically loaded module CSS <link> elements
  document.querySelectorAll('link[data-module-layout], link[data-module-admin-layout]').forEach(el => el.remove());
  // Reload schema + settings then refresh current view
  await Promise.all([loadModuleFieldSchema(), loadSiteSettings()]);
  const btn = document.getElementById('topBarClearCache');
  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) { icon.className = 'fa-solid fa-check'; setTimeout(() => { icon.className = 'fa-solid fa-broom'; }, 1200); }
  }
  // Re-render current view (stay on same page)
  const currentSection = localStorage.getItem('adminLastView') || 'dashboard';
  if (pageBuilderState.editingPageId) {
    openPageBuilder(pageBuilderState.editingPageId);
  } else {
    loadSection(currentSection);
  }
}

async function logout() {
  const ok = await confirmModal('Voulez-vous vraiment vous déconnecter ?');
  if (!ok) return;
  localStorage.removeItem('token');
  window.location.href = '/login';
}

// ========== PROFILE ==========

async function renderProfile() {
  showLoading();
  try {
    const user = await apiFetch('/auth/me');
    currentUser = user; // refresh
    hideLoading();

    const _roleLabels = { super_admin: 'Super admin', admin_site: 'Admin site', editor: 'Éditeur', reader: 'Lecteur', admin: 'Super admin' };
    const _roleBadges = { super_admin: 'badge-primary', admin_site: 'badge-info', editor: 'badge-warning', reader: 'badge-muted', admin: 'badge-primary' };

    return `
      <div class="page-header">
        <h1>Mon profil</h1>
        <span class="badge ${_roleBadges[user.role] || 'badge-secondary'}" style="font-size:13px">${_roleLabels[user.role] || user.role}</span>
      </div>

      <div class="card" style="max-width:600px">
        <form onsubmit="saveProfile(event)">
          <div class="form-group">
            <label class="form-label">Nom complet *</label>
            <input type="text" class="form-input" id="profileName" value="${escapeHtml(user.name || '')}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Nom d'utilisateur</label>
            <input type="text" class="form-input" id="profileUsername" value="${escapeHtml(user.username || '')}" placeholder="ex : mon-pseudo">
            <small style="color:var(--text-secondary,#666);font-size:12px;margin-top:4px;display:block">Permet de se connecter avec un identifiant au lieu de l'email</small>
          </div>
          <div class="form-group">
            <label class="form-label">Email *</label>
            <input type="email" class="form-input" id="profileEmail" value="${escapeHtml(user.email || '')}" required>
          </div>

          <hr style="margin:24px 0;border:none;border-top:1px solid var(--border-color,#e5e7eb)">
          <h3 style="margin-bottom:16px">Changer le mot de passe</h3>

          <div class="form-group">
            <label class="form-label">Mot de passe actuel</label>
            <input type="password" class="form-input" id="profileCurrentPassword" placeholder="Requis pour changer le mot de passe" autocomplete="current-password">
          </div>
          <div class="form-group">
            <label class="form-label">Nouveau mot de passe</label>
            <input type="password" class="form-input" id="profileNewPassword" placeholder="Min. 6 caractères" autocomplete="new-password">
          </div>
          <div class="form-group">
            <label class="form-label">Confirmer le nouveau mot de passe</label>
            <input type="password" class="form-input" id="profileConfirmPassword" placeholder="Répéter le nouveau mot de passe" autocomplete="new-password">
          </div>

          <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:24px;">
            <button type="submit" class="btn btn-primary">Enregistrer</button>
          </div>
        </form>
      </div>
    `;
  } catch (error) {
    hideLoading();
    showToast('Erreur lors du chargement du profil', 'error');
    return '<div class="card"><p>Erreur de chargement</p></div>';
  }
}

async function saveProfile(e) {
  e.preventDefault();

  const name = document.getElementById('profileName').value.trim();
  const username = document.getElementById('profileUsername').value.trim();
  const email = document.getElementById('profileEmail').value.trim();
  const currentPassword = document.getElementById('profileCurrentPassword').value;
  const newPassword = document.getElementById('profileNewPassword').value;
  const confirmPassword = document.getElementById('profileConfirmPassword').value;

  if (!name || !email) {
    showToast('Nom et email sont requis', 'error');
    return;
  }

  const data = { name, username, email };

  if (newPassword) {
    if (!currentPassword) {
      showToast('Le mot de passe actuel est requis pour changer le mot de passe', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Le nouveau mot de passe doit contenir au moins 6 caractères', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Les mots de passe ne correspondent pas', 'error');
      return;
    }
    data.current_password = currentPassword;
    data.new_password = newPassword;
  }

  showLoading();
  try {
    const result = await apiFetch('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });

    // Update token + currentUser
    if (result.token) {
      localStorage.setItem('token', result.token);
      token = result.token;
    }
    if (result.user) {
      currentUser = result.user;
      document.getElementById('userInfo').textContent = currentUser.name;
      const topBarUser = document.getElementById('topBarUser');
      if (topBarUser) topBarUser.textContent = `Bonjour, ${currentUser.name}`;
    }

    showToast('Profil mis à jour', 'success');
    // Re-render to clear password fields
    document.getElementById('content').innerHTML = await renderProfile();
  } catch (error) {
    showToast('Erreur : ' + error.message, 'error');
  }
  hideLoading();
}

// ========== USERS ==========

async function renderUsers() {
  showLoading();
  try {
    const users = await apiFetch('/users');
    hideLoading();

    return `
      <div class="page-header">
        <h1>Utilisateurs</h1>
        <button class="btn btn-primary" onclick="showUserForm()">
          <span class="icon">➕</span>
          Nouvel utilisateur
        </button>
      </div>

      <div class="card">
        ${users.length > 0 ? renderUsersTable(users) : renderEmptyState('👥', 'Aucun utilisateur', 'Créez votre premier utilisateur')}
      </div>

      <div class="card" style="margin-top:24px">
        <h3 style="margin-bottom:16px">Permissions par rôle</h3>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="border-bottom:2px solid var(--border-color,#e5e7eb);text-align:left">
                <th style="padding:8px 12px">Fonctionnalité</th>
                <th style="padding:8px 12px;text-align:center"><span class="badge badge-primary">Super admin</span></th>
                <th style="padding:8px 12px;text-align:center"><span class="badge badge-info">Admin site</span></th>
                <th style="padding:8px 12px;text-align:center"><span class="badge badge-warning">Éditeur</span></th>
                <th style="padding:8px 12px;text-align:center"><span class="badge badge-muted">Lecteur</span></th>
              </tr>
            </thead>
            <tbody>
              ${[
                ['Tableau de bord', true, true, true, true],
                ['Pages / Articles / CPT', true, true, true, false],
                ['Médiathèque', true, true, true, false],
                ['Blocs réutilisables', true, true, true, false],
                ['Menus', true, true, false, false],
                ['Paramètres du site', true, true, false, false],
                ['Formulaires', true, true, false, false],
                ['Thème', true, true, false, false],
                ['Rebuild', true, true, false, false],
                ['Utilisateurs', true, false, false, false],
                ['Plugins', true, false, false, false],
                ['Crédits IA', true, false, false, false],
              ].map(([label, ...perms]) =>
                '<tr style="border-bottom:1px solid var(--border-color,#e5e7eb)">'
                + '<td style="padding:8px 12px;font-weight:500">' + label + '</td>'
                + perms.map(ok => '<td style="padding:8px 12px;text-align:center">' + (ok ? '<span style="color:var(--success,#22c55e)">✓</span>' : '<span style="color:var(--danger,#ef4444);opacity:.4">✗</span>') + '</td>').join('')
                + '</tr>'
              ).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div id="userModal" style="display: none;"></div>
    `;
  } catch (error) {
    hideLoading();
    showToast('Erreur lors du chargement des utilisateurs', 'error');
    return '<div class="card"><p>Erreur de chargement</p></div>';
  }
}

function renderUsersTable(users) {
  const _roleLabels = { super_admin: 'Super admin', admin_site: 'Admin site', editor: 'Éditeur', reader: 'Lecteur', admin: 'Super admin' };
  const _roleBadges = { super_admin: 'badge-primary', admin_site: 'badge-info', editor: 'badge-warning', reader: 'badge-muted', admin: 'badge-primary' };
  const _roleAvatars = { super_admin: 'user-avatar--admin', admin_site: 'user-avatar--admin', editor: 'user-avatar--editor', reader: 'user-avatar--editor' };
  const roleLabel = r => _roleLabels[r] || r;
  const roleBadge = r => _roleBadges[r] || 'badge-secondary';
  const avatarClass = r => _roleAvatars[r] || 'user-avatar--editor';
  const getInitials = name => name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  return `
    <div class="pages-list">
      <div class="pages-list-header">
        <span style="width:36px;flex-shrink:0"></span>
        <span class="page-item__info">Utilisateur</span>
        <span class="page-item__meta">Créé le</span>
        <span class="page-item__badges">Rôle</span>
        <span class="page-item__actions" style="opacity:1">Actions</span>
      </div>
      ${users.map(user => {
        const safeName = escapeHtml(user.name).replace(/'/g, "\\'");
        const dateStr = new Date(user.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        return '<div class="page-item">'
          + '<div class="user-avatar ' + avatarClass(user.role) + '">' + getInitials(user.name) + '</div>'
          + '<div class="page-item__info" style="cursor:pointer" onclick="showUserForm(' + user.id + ')">'
          +   '<div class="page-item__title">' + escapeHtml(user.name) + (user.id === currentUser.id ? ' <span class="badge badge-info" style="font-size:10px">Vous</span>' : '') + '</div>'
          +   '<div class="page-item__slug">' + escapeHtml(user.email) + (user.username ? ' · @' + escapeHtml(user.username) : '') + '</div>'
          + '</div>'
          + '<div class="page-item__meta"><span class="page-item__date">' + dateStr + '</span></div>'
          + '<div class="page-item__badges"><span class="badge ' + roleBadge(user.role) + '">' + roleLabel(user.role) + '</span></div>'
          + '<div class="page-item__actions">'
          +   '<button class="btn-icon-action" onclick="showUserForm(' + user.id + ')" title="Modifier">' + _svgEdit + '</button>'
          +   (user.id !== currentUser.id ? '<button class="btn-icon-action btn-icon-action--danger" onclick="deleteUser(' + user.id + ', \'' + safeName + '\')" title="Supprimer">' + _svgDelete + '</button>' : '')
          + '</div>'
        + '</div>';
      }).join('')}
    </div>
  `;
}

async function showUserForm(userId = null) {
  showLoading();

  let user = null;
  if (userId) {
    const users = await apiFetch('/users');
    user = users.find(u => u.id === userId);
  }

  hideLoading();

  const modal = document.getElementById('userModal');
  modal.style.display = 'block';
  modal.innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;" onclick="if(event.target===this)closeModal()">
      <div class="card" style="max-width:480px;width:90%;max-height:90vh;overflow-y:auto;" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
          <h2>${userId ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</h2>
          <button class="btn btn-outline btn-sm" onclick="closeModal()">✕</button>
        </div>
        <form onsubmit="saveUser(event, ${userId || 'null'})">
          <div class="form-group">
            <label class="form-label">Nom *</label>
            <input type="text" class="form-input" id="userName" value="${user?.name || ''}" required placeholder="Nom complet">
          </div>
          <div class="form-group">
            <label class="form-label">Nom d'utilisateur</label>
            <input type="text" class="form-input" id="userUsername" value="${user?.username || ''}" placeholder="ex : mon-pseudo">
          </div>
          <div class="form-group">
            <label class="form-label">Email *</label>
            <input type="email" class="form-input" id="userEmail" value="${user?.email || ''}" required placeholder="email@exemple.com">
          </div>
          <div class="form-group">
            <label class="form-label">Role *</label>
            <select class="form-input" id="userRole">
              <option value="reader" ${user?.role === 'reader' ? 'selected' : ''}>Lecteur</option>
              <option value="editor" ${!user || user.role === 'editor' ? 'selected' : ''}>Éditeur</option>
              <option value="admin_site" ${user?.role === 'admin_site' ? 'selected' : ''}>Admin site</option>
              <option value="super_admin" ${user?.role === 'super_admin' ? 'selected' : ''}>Super administrateur</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">${userId ? 'Nouveau mot de passe (vide = inchange)' : 'Mot de passe *'}</label>
            <input type="password" class="form-input" id="userPassword" ${userId ? '' : 'required'} placeholder="${userId ? 'Laisser vide pour ne pas modifier' : 'Mot de passe'}">
          </div>
          <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px;">
            <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary">${userId ? 'Mettre a jour' : 'Creer'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function saveUser(e, userId) {
  e.preventDefault();
  const name = document.getElementById('userName').value.trim();
  const username = document.getElementById('userUsername').value.trim();
  const email = document.getElementById('userEmail').value.trim();
  const role = document.getElementById('userRole').value;
  const password = document.getElementById('userPassword').value;

  const data = { name, username, email, role };
  if (password) data.password = password;

  showLoading();
  try {
    if (userId) {
      await apiFetch(`/users/${userId}`, { method: 'PUT', body: JSON.stringify(data) });
      showToast('Utilisateur mis a jour', 'success');
    } else {
      await apiFetch('/users', { method: 'POST', body: JSON.stringify(data) });
      showToast('Utilisateur cree', 'success');
    }
    closeModal();
    document.getElementById('content').innerHTML = await renderUsers();
  } catch (error) {
    showToast('Erreur : ' + error.message, 'error');
  }
  hideLoading();
}

async function deleteUser(userId, name) {
  const ok = await confirmModal(`Voulez-vous vraiment supprimer l'utilisateur "${name}" ?`);
  if (!ok) return;
  try {
    await apiFetch(`/users/${userId}`, { method: 'DELETE' });
    showToast('Utilisateur supprime', 'success');
    document.getElementById('content').innerHTML = await renderUsers();
  } catch (error) {
    showToast('Erreur : ' + error.message, 'error');
  }
}

// ========== MENUS ==========
let _menusCache = [];
let _menuEditId = null;
let _menuItems = [];
let _menuAvailablePages = [];
let _menuCptSections = [];
let _menuTempIdCounter = 1;

async function renderMenus() {
  showLoading();
  try {
    _menusCache = await apiFetch('/menus');
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
      ${_menusCache.length > 0 ? `
        <div class="pages-list">
          <div class="pages-list-header">
            <span class="page-item__info">Menu</span>
            <span class="page-item__parent">Emplacement</span>
            <span class="page-item__actions" style="opacity:1">Actions</span>
          </div>
          ${_menusCache.map(m => {
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
    _menuEditId = menuId;
    _menuAvailablePages = pages;
    _menuCptSections = cptSections;
    _menuTempIdCounter = 1;

    // Convert flatItems to our working format
    _menuItems = (menu.flatItems || []).map(item => ({
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
  const cptSectionsHtml = _menuCptSections.map(section => {
    return `
      <div class="menu-add-section">
        <h4>${section.icon ? section.icon + ' ' : ''}${escapeHtml(section.label)}</h4>
        <div style="margin-bottom:6px">
          <button class="btn btn-sm btn-outline" onclick="addCptArchiveLink('${escapeHtml(section.slug)}', '${escapeHtml(section.label)}')">+ Archive « ${escapeHtml(section.label)} »</button>
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
            ${_menuAvailablePages.map(p => `
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
        ${_menuItems.length === 0 ? '<p class="text-muted" style="padding:16px;text-align:center">Ajoutez des éléments depuis le panneau de gauche</p>' : ''}
      </div>
    </div>
  `;
}

function _flattenMenuTree() {
  // Build flat ordered list from parent_id tree
  const sorted = [..._menuItems].sort((a, b) => a.menu_order - b.menu_order);
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
    const item = _menuItems.find(i => String(i.id) === String(itemId) || String(i.temp_id) === String(itemId));
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
  const item = _menuItems.find(i => String(i.id) === String(itemId) || String(i.temp_id) === String(itemId));
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
    _menuItems.filter(i => String(i.parent_id) === String(id)).forEach(c => {
      collectChildren(c.id || c.temp_id);
    });
  }
  collectChildren(itemId);
  _menuItems = _menuItems.filter(i => !idsToRemove.has(String(i.id || i.temp_id)));
  refreshMenuItemsList();
}

function addSelectedPages() {
  const checks = document.querySelectorAll('#menuPagesList input[type="checkbox"]:checked');
  if (checks.length === 0) { showToast('Sélectionnez au moins une page', 'error'); return; }

  const maxOrder = _menuItems.length > 0 ? Math.max(..._menuItems.map(i => i.menu_order || 0)) : -1;

  checks.forEach((cb, i) => {
    const pageId = parseInt(cb.value);
    const title = cb.getAttribute('data-title');
    const slug = cb.getAttribute('data-slug');
    const tempId = 'temp_' + (_menuTempIdCounter++);
    _menuItems.push({
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

  const maxOrder = _menuItems.length > 0 ? Math.max(..._menuItems.map(i => i.menu_order || 0)) : -1;
  const tempId = 'temp_' + (_menuTempIdCounter++);
  _menuItems.push({
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

function addCptArchiveLink(cptSlug, label) {
  const maxOrder = _menuItems.length > 0 ? Math.max(..._menuItems.map(i => i.menu_order || 0)) : -1;
  const tempId = 'temp_' + (_menuTempIdCounter++);
  _menuItems.push({
    id: null,
    temp_id: tempId,
    title: label,
    url: `/${cptSlug}`,
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

  const maxOrder = _menuItems.length > 0 ? Math.max(..._menuItems.map(i => i.menu_order || 0)) : -1;

  checks.forEach((cb, i) => {
    const title = cb.getAttribute('data-title');
    const slug = cb.getAttribute('data-slug');
    const tempId = 'temp_' + (_menuTempIdCounter++);
    _menuItems.push({
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
  if (panel && _menuItems.length > 0) panel.remove();
}

async function saveCurrentMenu() {
  if (!_menuEditId) return;

  const name = document.getElementById('menuEditorName').value.trim();
  const location = document.getElementById('menuEditorLocation').value;
  if (!name) { showToast('Le nom du menu est obligatoire', 'error'); return; }

  // Sync parent_ids and menu_order from DOM
  _syncParentsFromDOM();

  // Build flat items array for API
  const itemsPayload = _menuItems.map(item => ({
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
      apiFetch(`/menus/${_menuEditId}`, { method: 'PUT', body: JSON.stringify({ name, location }) }),
      apiFetch(`/menus/${_menuEditId}/items`, { method: 'PUT', body: JSON.stringify({ items: itemsPayload }) }),
    ]);
    showToast('Menu enregistré', 'success');
    // Reload to get fresh IDs
    await openMenuEditor(_menuEditId);
  } catch (error) {
    showToast('Erreur : ' + error.message, 'error');
  }
  hideLoading();
}

async function backToMenusList() {
  _menuEditId = null;
  _menuItems = [];
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

// ========== FORMS SYSTEM ==========

const FORM_FIELD_TYPES = [
  { type: 'text', label: 'Texte', icon: '<i class="fa-solid fa-font"></i>' },
  { type: 'email', label: 'Email', icon: '<i class="fa-solid fa-at"></i>' },
  { type: 'phone', label: 'Téléphone', icon: '<i class="fa-solid fa-phone"></i>' },
  { type: 'number', label: 'Nombre', icon: '<i class="fa-solid fa-hashtag"></i>' },
  { type: 'textarea', label: 'Zone de texte', icon: '<i class="fa-solid fa-align-left"></i>' },
  { type: 'select', label: 'Liste déroulante', icon: '<i class="fa-solid fa-chevron-down"></i>' },
  { type: 'radio', label: 'Boutons radio', icon: '<i class="fa-regular fa-circle-dot"></i>' },
  { type: 'checkbox', label: 'Cases à cocher', icon: '<i class="fa-regular fa-square-check"></i>' },
  { type: 'date', label: 'Date', icon: '<i class="fa-regular fa-calendar"></i>' },
  { type: 'time', label: 'Heure', icon: '<i class="fa-regular fa-clock"></i>' },
  { type: 'url', label: 'URL', icon: '<i class="fa-solid fa-link"></i>' },
  { type: 'file', label: 'Fichier', icon: '<i class="fa-solid fa-paperclip"></i>' },
  { type: 'hidden', label: 'Champ caché', icon: '<i class="fa-regular fa-eye-slash"></i>' },
  { type: 'html', label: 'Contenu HTML', icon: '<i class="fa-solid fa-code"></i>' },
  { type: 'name', label: 'Nom complet', icon: '<i class="fa-regular fa-user"></i>' },
];

let _formsCache = [];
let _formBuilderFields = [];
let _formBuilderSelectedIdx = -1;
let _formBuilderSettings = {};
let _formBuilderData = null;

// ── Forms List ──

async function renderFormsList() {
  showLoading();
  try {
    _formsCache = await apiFetch('/forms');
    hideLoading();
  } catch (e) {
    hideLoading();
    return `<div class="card"><p>Erreur: ${e.message}</p></div>`;
  }

  return `
    <div class="page-header">
      <h1>Formulaires</h1>
      <button class="btn btn-primary" onclick="loadSection('form-edit:new')">+ Nouveau formulaire</button>
    </div>
    <div class="card">
      ${_formsCache.length > 0 ? renderFormsTable() : renderEmptyState('📝', 'Aucun formulaire', 'Créez votre premier formulaire')}
    </div>
  `;
}

function renderFormsTable() {
  const gridCols = '1fr 80px 120px 80px 140px';
  return `
    <div class="pages-list">
      <div class="pages-list-header" style="display:grid; grid-template-columns:${gridCols}; align-items:center;">
        <span>Titre</span>
        <span style="text-align:center">Champs</span>
        <span style="text-align:center">Entrées</span>
        <span style="text-align:center">Statut</span>
        <span style="text-align:right">Actions</span>
      </div>
      ${_formsCache.map(f => {
        const safeName = escapeHtml(f.title).replace(/'/g, "\\'");
        return `
        <div class="page-item" style="display:grid; grid-template-columns:${gridCols}; align-items:center;">
          <div onclick="loadSection('form-edit:${f.id}')" style="cursor:pointer; overflow:hidden;">
            <strong>${escapeHtml(f.title)}</strong>
            <span class="page-item__slug" style="display:block; font-size:12px; color:var(--gray-400)">${escapeHtml(f.slug)}</span>
          </div>
          <div style="text-align:center">${f.field_count || 0}</div>
          <div style="text-align:center">
            <a href="#" onclick="event.preventDefault(); loadSection('form-entries:${f.id}')" style="text-decoration:underline">${f.entry_count || 0} entrée(s)</a>
            ${f.unread_count > 0 ? `<span class="badge badge-warning" style="margin-top:4px;display:inline-block">${f.unread_count} non lue(s)</span>` : ''}
          </div>
          <div style="text-align:center">
            <span class="badge ${f.status === 'active' ? 'badge-success' : 'badge-muted'}">${f.status === 'active' ? 'Actif' : 'Inactif'}</span>
          </div>
          <div style="display:flex; gap:4px; justify-content:flex-end;">
            <button class="btn-icon-action" onclick="loadSection('form-edit:${f.id}')" title="Modifier">${_svgEdit}</button>
            <button class="btn-icon-action" onclick="loadSection('form-entries:${f.id}')" title="Entrées">${_svgInbox}</button>
            <button class="btn-icon-action" onclick="duplicateForm(${f.id})" title="Dupliquer">${_svgCopy}</button>
            <button class="btn-icon-action btn-icon-action--danger" onclick="deleteFormConfirm(${f.id}, '${safeName}')" title="Supprimer">${_svgDelete}</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

async function deleteFormConfirm(id, title) {
  const ok = await confirmModal(`Voulez-vous vraiment supprimer le formulaire "${title}" et toutes ses entrées ?`);
  if (!ok) return;
  showLoading();
  try {
    await apiFetch(`/forms/${id}`, { method: 'DELETE' });
    showToast('Formulaire supprimé', 'success');
    loadSection('forms');
  } catch (e) {
    hideLoading();
    showToast('Erreur: ' + e.message, 'error');
  }
}

async function duplicateForm(id) {
  showLoading();
  try {
    const form = await apiFetch(`/forms/${id}`);
    const newSlug = form.slug + '-copie-' + Date.now().toString(36);
    await apiFetch('/forms', {
      method: 'POST',
      body: JSON.stringify({
        title: form.title + ' (copie)',
        slug: newSlug,
        description: form.description,
        settings: typeof form.settings === 'string' ? JSON.parse(form.settings) : form.settings,
        status: form.status,
        fields: form.fields,
      }),
    });
    showToast('Formulaire dupliqué', 'success');
    loadSection('forms');
  } catch (e) {
    hideLoading();
    showToast('Erreur: ' + e.message, 'error');
  }
}

// ── Form Builder ──

async function renderFormBuilder(formId) {
  showLoading();
  try {
    if (formId && formId !== 'new') {
      _formBuilderData = await apiFetch(`/forms/${formId}`);
      _formBuilderFields = _formBuilderData.fields || [];
      const s = typeof _formBuilderData.settings === 'string' ? JSON.parse(_formBuilderData.settings) : (_formBuilderData.settings || {});
      _formBuilderSettings = s;
    } else {
      _formBuilderData = null;
      _formBuilderFields = [];
      _formBuilderSettings = {};
    }
    _formBuilderSelectedIdx = -1;
    hideLoading();
  } catch (e) {
    hideLoading();
    return `<div class="card"><p>Erreur: ${e.message}</p></div>`;
  }

  const isEdit = _formBuilderData && _formBuilderData.id;
  const title = isEdit ? escapeHtml(_formBuilderData.title) : '';
  const slug = isEdit ? escapeHtml(_formBuilderData.slug) : '';
  const desc = isEdit ? escapeHtml(_formBuilderData.description || '') : '';
  const status = isEdit ? _formBuilderData.status : 'active';

  return `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:16px">
        <button class="btn btn-outline btn-sm" onclick="loadSection('forms')"><i class="fa-solid fa-arrow-left" style="font-size:11px"></i> Retour</button>
        <h1>${isEdit ? 'Modifier le formulaire' : 'Nouveau formulaire'}</h1>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        ${isEdit ? `<button class="btn btn-outline btn-sm" onclick="loadSection('form-entries:${_formBuilderData.id}')"><i class="fa-solid fa-inbox" style="font-size:13px"></i> Entrées</button>` : ''}
        <button class="btn btn-primary btn-sm" onclick="saveFormBuilder()">Enregistrer</button>
      </div>
    </div>

    <div style="display:flex;gap:16px;margin-bottom:16px">
      <div class="form-group" style="flex:1;margin:0"><label class="form-label">Titre *</label><input type="text" class="form-input" id="formTitle" value="${title}" oninput="autoFormSlug()"></div>
      <div class="form-group" style="flex:1;margin:0"><label class="form-label">Slug *</label><input type="text" class="form-input" id="formSlug" value="${slug}"></div>
      <div class="form-group" style="width:140px;margin:0"><label class="form-label">Statut</label><select class="form-select" id="formStatus"><option value="active" ${status === 'active' ? 'selected' : ''}>Actif</option><option value="inactive" ${status !== 'active' ? 'selected' : ''}>Inactif</option></select></div>
    </div>

    <div class="form-group" style="margin-bottom:16px">
      <label class="form-label">Description</label>
      <textarea class="form-textarea" id="formDescription" rows="2">${desc}</textarea>
    </div>

    <!-- Tabs -->
    <div class="form-builder-tabs" style="display:flex;gap:0;margin-bottom:0;border-bottom:2px solid var(--gray-200)">
      <button class="form-builder-tab active" data-tab="fields" onclick="switchFormTab('fields')" style="padding:10px 20px;border:none;background:none;cursor:pointer;font-weight:600;border-bottom:2px solid var(--primary);margin-bottom:-2px">Champs</button>
      <button class="form-builder-tab" data-tab="settings" onclick="switchFormTab('settings')" style="padding:10px 20px;border:none;background:none;cursor:pointer;color:var(--gray-500);border-bottom:2px solid transparent;margin-bottom:-2px">Réglages</button>
    </div>

    <!-- Fields Tab -->
    <div id="formTabFields" style="display:flex;gap:16px;margin-top:16px">
      <!-- Field Types Sidebar -->
      <div class="card form-field-types-panel" style="width:200px;flex-shrink:0;padding:16px">
        <p style="font-weight:600;margin-bottom:12px;font-size:13px;color:var(--gray-700)">Ajouter un champ</p>
        <div style="display:flex;flex-direction:column;gap:2px">
        ${FORM_FIELD_TYPES.map(ft => `
          <button class="form-field-type-btn" onclick="addFormField('${ft.type}')">
            <span class="form-field-type-icon">${ft.icon}</span>
            <span class="form-field-type-label">${ft.label}</span>
          </button>
        `).join('')}
        </div>
      </div>

      <!-- Fields Canvas -->
      <div class="card" style="flex:1;padding:16px;min-height:300px" id="formFieldsCanvas">
        ${renderFormFieldsList()}
      </div>

      <!-- Field Settings Panel -->
      <div class="card" style="width:320px;flex-shrink:0;padding:16px" id="formFieldSettings">
        <p style="color:var(--gray-400);text-align:center;margin-top:40px">Sélectionnez un champ pour modifier ses propriétés</p>
      </div>
    </div>

    <!-- Settings Tab -->
    <div id="formTabSettings" style="display:none;margin-top:16px">
      <div class="card" style="padding:24px">
        ${renderFormSettingsPanel()}
      </div>
    </div>
  `;
}

function switchFormTab(tab) {
  document.querySelectorAll('.form-builder-tab').forEach(t => {
    t.classList.remove('active');
    t.style.borderBottomColor = 'transparent';
    t.style.color = 'var(--gray-500)';
  });
  const activeTab = document.querySelector(`.form-builder-tab[data-tab="${tab}"]`);
  if (activeTab) {
    activeTab.classList.add('active');
    activeTab.style.borderBottomColor = 'var(--primary)';
    activeTab.style.color = '';
  }
  document.getElementById('formTabFields').style.display = tab === 'fields' ? 'flex' : 'none';
  document.getElementById('formTabSettings').style.display = tab === 'settings' ? 'block' : 'none';
}

function renderFormFieldsList() {
  if (_formBuilderFields.length === 0) {
    return '<p style="text-align:center;color:var(--gray-400);margin-top:40px">Ajoutez des champs depuis le panneau de gauche</p>';
  }

  return `<div class="form-fields-list" style="display:flex;flex-wrap:wrap;gap:6px">
    ${_formBuilderFields.map((f, idx) => {
      const isSelected = idx === _formBuilderSelectedIdx;
      const ft = FORM_FIELD_TYPES.find(t => t.type === f.type) || { icon: '?', label: f.type };
      const w = f.settings?.width || '100';
      const widthStyle = w === '50' ? 'calc(50% - 3px)' : w === '33' ? 'calc(33.333% - 4px)' : '100%';
      const widthLabel = w === '50' ? '½' : w === '33' ? '⅓' : '';
      return `
        <div class="form-field-item ${isSelected ? 'is-selected' : ''}" data-idx="${idx}" onclick="selectFormField(${idx})" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid ${isSelected ? 'var(--primary)' : 'var(--gray-200)'};border-radius:8px;cursor:pointer;background:${isSelected ? 'var(--gray-50)' : 'white'};width:${widthStyle};box-sizing:border-box">
          <span style="cursor:grab;color:var(--gray-400)" class="form-field-drag" data-idx="${idx}">☰</span>
          <span style="width:28px;text-align:center;font-size:14px">${ft.icon}</span>
          <div style="flex:1;min-width:0">
            <strong style="font-size:13px">${escapeHtml(f.label)}</strong>
            <span style="font-size:11px;color:var(--gray-400);margin-left:6px">${ft.label}${f.required ? ' *' : ''}</span>
          </div>
          ${widthLabel ? `<span style="font-size:11px;color:var(--gray-400);background:var(--gray-100);padding:1px 6px;border-radius:4px">${widthLabel}</span>` : ''}
          <div style="display:flex;gap:4px">
            <button class="btn-icon-action btn-icon-action--danger" onclick="event.stopPropagation(); removeFormField(${idx})" title="Supprimer" style="font-size:12px">✕</button>
          </div>
        </div>`;
    }).join('')}
  </div>`;
}

function renderFormFieldSettings(idx) {
  const f = _formBuilderFields[idx];
  if (!f) return '<p style="color:var(--gray-400);text-align:center;margin-top:40px">Sélectionnez un champ</p>';

  const ft = FORM_FIELD_TYPES.find(t => t.type === f.type) || { label: f.type };
  const hasOptions = ['select', 'radio', 'checkbox'].includes(f.type);
  const optionsStr = hasOptions && f.options ? (Array.isArray(f.options) ? f.options.join('\n') : f.options) : '';
  const settings = f.settings || {};

  return `
    <h3 style="margin-bottom:16px;font-size:15px">${ft.label}</h3>

    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Label *</label>
      <input type="text" class="form-input" value="${escapeHtml(f.label)}" onchange="updateFormField(${idx}, 'label', this.value)">
    </div>

    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Nom du champ (name) *</label>
      <input type="text" class="form-input" value="${escapeHtml(f.name)}" onchange="updateFormField(${idx}, 'name', this.value)">
    </div>

    ${f.type !== 'html' && f.type !== 'hidden' ? `
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Placeholder</label>
      <input type="text" class="form-input" value="${escapeHtml(f.placeholder || '')}" onchange="updateFormField(${idx}, 'placeholder', this.value)">
    </div>

    <div class="form-group" style="margin-bottom:12px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" ${f.required ? 'checked' : ''} onchange="updateFormField(${idx}, 'required', this.checked)">
        <span style="font-size:13px">Champ requis</span>
      </label>
    </div>
    ` : ''}

    ${hasOptions ? `
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Options (une par ligne)</label>
      <textarea class="form-textarea" rows="5" onchange="updateFormFieldOptions(${idx}, this.value)">${escapeHtml(optionsStr)}</textarea>
      <div class="form-help">Chaque ligne = une option. Format: valeur ou label|valeur</div>
    </div>
    ` : ''}

    ${f.type === 'html' ? `
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Contenu HTML</label>
      <textarea class="form-textarea" rows="5" onchange="updateFormFieldSetting(${idx}, 'html_content', this.value)">${escapeHtml(settings.html_content || '')}</textarea>
    </div>
    ` : ''}

    ${f.type === 'hidden' ? `
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Valeur par défaut</label>
      <input type="text" class="form-input" value="${escapeHtml(settings.default_value || '')}" onchange="updateFormFieldSetting(${idx}, 'default_value', this.value)">
    </div>
    ` : ''}

    ${f.type === 'textarea' ? `
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Nombre de lignes</label>
      <input type="number" class="form-input" value="${settings.rows || 4}" min="2" max="20" onchange="updateFormFieldSetting(${idx}, 'rows', parseInt(this.value))">
    </div>
    ` : ''}

    ${f.type === 'file' ? `
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Types acceptés</label>
      <input type="text" class="form-input" value="${escapeHtml(settings.accept || '')}" placeholder=".pdf,.jpg,.png" onchange="updateFormFieldSetting(${idx}, 'accept', this.value)">
    </div>
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Taille max (Mo)</label>
      <input type="number" class="form-input" value="${settings.max_size || 10}" min="1" max="50" onchange="updateFormFieldSetting(${idx}, 'max_size', parseInt(this.value))">
    </div>
    ` : ''}

    ${f.type === 'number' ? `
    <div style="display:flex;gap:8px">
      <div class="form-group" style="margin-bottom:12px;flex:1">
        <label class="form-label" style="font-size:12px">Min</label>
        <input type="number" class="form-input" value="${settings.min ?? ''}" onchange="updateFormFieldSetting(${idx}, 'min', this.value)">
      </div>
      <div class="form-group" style="margin-bottom:12px;flex:1">
        <label class="form-label" style="font-size:12px">Max</label>
        <input type="number" class="form-input" value="${settings.max ?? ''}" onchange="updateFormFieldSetting(${idx}, 'max', this.value)">
      </div>
    </div>
    ` : ''}

    ${f.type === 'name' ? `
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Label prénom</label>
      <input type="text" class="form-input" value="${escapeHtml(settings.first_label || 'Prénom')}" onchange="updateFormFieldSetting(${idx}, 'first_label', this.value)">
    </div>
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Label nom</label>
      <input type="text" class="form-input" value="${escapeHtml(settings.last_label || 'Nom')}" onchange="updateFormFieldSetting(${idx}, 'last_label', this.value)">
    </div>
    ` : ''}

    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Largeur</label>
      <select class="form-select" onchange="updateFormFieldSetting(${idx}, 'width', this.value)">
        <option value="100" ${(settings.width || '100') === '100' ? 'selected' : ''}>Pleine largeur</option>
        <option value="50" ${settings.width === '50' ? 'selected' : ''}>Demi</option>
        <option value="33" ${settings.width === '33' ? 'selected' : ''}>Tiers</option>
      </select>
    </div>

    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Classes CSS</label>
      <input type="text" class="form-input" value="${escapeHtml(settings.css_class || '')}" onchange="updateFormFieldSetting(${idx}, 'css_class', this.value)">
    </div>
  `;
}

function renderFormSettingsPanel() {
  const s = _formBuilderSettings;
  return `
    <h3 style="margin-bottom:20px">Réglages du formulaire</h3>

    <fieldset style="border:1px solid var(--gray-200);border-radius:8px;padding:16px;margin-bottom:20px">
      <legend style="font-weight:600;padding:0 8px">Confirmation</legend>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Message de confirmation</label>
        <textarea class="form-textarea" id="fsConfirmMsg" rows="3">${escapeHtml(s.confirmation_message || 'Votre message a bien été envoyé. Merci !')}</textarea>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Redirection après envoi (URL optionnelle)</label>
        <input type="text" class="form-input" id="fsRedirectUrl" value="${escapeHtml(s.redirect_url || '')}" placeholder="https://...">
      </div>
    </fieldset>

    <fieldset style="border:1px solid var(--gray-200);border-radius:8px;padding:16px;margin-bottom:20px">
      <legend style="font-weight:600;padding:0 8px">Notifications email</legend>
      <div class="form-group" style="margin-bottom:12px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="fsNotifEnabled" ${s.notification_enabled ? 'checked' : ''}>
          <span>Activer les notifications par email</span>
        </label>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Email(s) destinataire(s)</label>
        <input type="text" class="form-input" id="fsNotifEmail" value="${escapeHtml(s.notification_email || '')}" placeholder="admin@example.com">
        <div class="form-help">Séparer plusieurs emails par des virgules</div>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Objet de l'email</label>
        <input type="text" class="form-input" id="fsNotifSubject" value="${escapeHtml(s.notification_subject || 'Nouveau message depuis le formulaire')}" placeholder="Nouveau message…">
      </div>
    </fieldset>

    <fieldset style="border:1px solid var(--gray-200);border-radius:8px;padding:16px;margin-bottom:20px">
      <legend style="font-weight:600;padding:0 8px">reCAPTCHA</legend>
      <div class="form-group" style="margin-bottom:12px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="fsRecaptcha" ${s.recaptcha_enabled ? 'checked' : ''}>
          <span>Activer reCAPTCHA v3</span>
        </label>
        <div class="form-help">Les clés reCAPTCHA sont configurées dans Paramètres du site → reCAPTCHA</div>
      </div>
    </fieldset>

    <fieldset style="border:1px solid var(--gray-200);border-radius:8px;padding:16px;margin-bottom:20px">
      <legend style="font-weight:600;padding:0 8px">Bouton d'envoi</legend>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Texte du bouton</label>
        <input type="text" class="form-input" id="fsSubmitText" value="${escapeHtml(s.submit_text || 'Envoyer')}">
      </div>
    </fieldset>
  `;
}

// ── Field operations ──

function addFormField(type) {
  const ft = FORM_FIELD_TYPES.find(t => t.type === type);
  const baseName = type + '_' + (_formBuilderFields.length + 1);
  const newField = {
    type,
    label: ft ? ft.label : type,
    name: baseName,
    placeholder: '',
    required: false,
    options: ['select', 'radio', 'checkbox'].includes(type) ? ['Option 1', 'Option 2', 'Option 3'] : null,
    settings: {},
  };

  if (type === 'name') {
    newField.label = 'Nom complet';
    newField.name = 'name';
    newField.settings = { first_label: 'Prénom', last_label: 'Nom' };
  }

  _formBuilderFields.push(newField);
  _formBuilderSelectedIdx = _formBuilderFields.length - 1;
  refreshFormFieldsUI();
}

function removeFormField(idx) {
  _formBuilderFields.splice(idx, 1);
  if (_formBuilderSelectedIdx >= _formBuilderFields.length) {
    _formBuilderSelectedIdx = _formBuilderFields.length - 1;
  }
  refreshFormFieldsUI();
}

function selectFormField(idx) {
  _formBuilderSelectedIdx = idx;
  refreshFormFieldsUI();
}

function updateFormField(idx, key, value) {
  if (_formBuilderFields[idx]) {
    _formBuilderFields[idx][key] = value;
    if (key === 'label') {
      refreshFormFieldsCanvas();
    }
  }
}

function updateFormFieldOptions(idx, raw) {
  if (_formBuilderFields[idx]) {
    _formBuilderFields[idx].options = raw.split('\n').filter(l => l.trim());
  }
}

function updateFormFieldSetting(idx, key, value) {
  if (_formBuilderFields[idx]) {
    if (!_formBuilderFields[idx].settings) _formBuilderFields[idx].settings = {};
    _formBuilderFields[idx].settings[key] = value;
    if (key === 'width') refreshFormFieldsCanvas();
  }
}

function refreshFormFieldsUI() {
  refreshFormFieldsCanvas();
  const panel = document.getElementById('formFieldSettings');
  if (panel) panel.innerHTML = renderFormFieldSettings(_formBuilderSelectedIdx);
}

function refreshFormFieldsCanvas() {
  const canvas = document.getElementById('formFieldsCanvas');
  if (canvas) canvas.innerHTML = renderFormFieldsList();
}

function collectFormSettings() {
  return {
    confirmation_message: document.getElementById('fsConfirmMsg')?.value || '',
    redirect_url: document.getElementById('fsRedirectUrl')?.value || '',
    notification_enabled: document.getElementById('fsNotifEnabled')?.checked || false,
    notification_email: document.getElementById('fsNotifEmail')?.value || '',
    notification_subject: document.getElementById('fsNotifSubject')?.value || '',
    recaptcha_enabled: document.getElementById('fsRecaptcha')?.checked || false,
    submit_text: document.getElementById('fsSubmitText')?.value || 'Envoyer',
  };
}

async function saveFormBuilder() {
  const title = document.getElementById('formTitle')?.value?.trim();
  const slug = document.getElementById('formSlug')?.value?.trim();
  const description = document.getElementById('formDescription')?.value?.trim();
  const status = document.getElementById('formStatus')?.value || 'active';

  if (!title || !slug) {
    showToast('Le titre et le slug sont requis', 'error');
    return;
  }

  const settings = collectFormSettings();

  const payload = {
    title,
    slug,
    description,
    status,
    settings,
    fields: _formBuilderFields,
  };

  showLoading();
  try {
    if (_formBuilderData && _formBuilderData.id) {
      await apiFetch(`/forms/${_formBuilderData.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Formulaire mis à jour', 'success');
    } else {
      const created = await apiFetch('/forms', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Formulaire créé', 'success');
      loadSection('form-edit:' + created.id);
      return;
    }
    hideLoading();
  } catch (e) {
    hideLoading();
    showToast('Erreur: ' + e.message, 'error');
  }
}

function autoFormSlug() {
  const titleInput = document.getElementById('formTitle');
  const slugInput = document.getElementById('formSlug');
  if (!_formBuilderData || !_formBuilderData.id) {
    slugInput.value = slugify(titleInput.value);
  }
}

function attachFormBuilderEvents() {
  const canvas = document.getElementById('formFieldsCanvas');
  if (!canvas) return;

  canvas.addEventListener('mousedown', (e) => {
    const dragHandle = e.target.closest('.form-field-drag');
    if (!dragHandle) return;

    e.preventDefault();
    const idx = parseInt(dragHandle.dataset.idx);
    const items = canvas.querySelectorAll('.form-field-item');
    const dragItem = items[idx];
    if (!dragItem) return;

    dragItem.style.opacity = '0.5';
    let currentIdx = idx;

    const onMove = (ev) => {
      const currentItems = canvas.querySelectorAll('.form-field-item');
      currentItems.forEach((item, i) => {
        if (i === currentIdx) return;
        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (ev.clientY < midY && i < currentIdx) {
          const moved = _formBuilderFields.splice(currentIdx, 1)[0];
          _formBuilderFields.splice(i, 0, moved);
          if (_formBuilderSelectedIdx === currentIdx) _formBuilderSelectedIdx = i;
          currentIdx = i;
          refreshFormFieldsCanvas();
        } else if (ev.clientY > midY && i > currentIdx) {
          const moved = _formBuilderFields.splice(currentIdx, 1)[0];
          _formBuilderFields.splice(i, 0, moved);
          if (_formBuilderSelectedIdx === currentIdx) _formBuilderSelectedIdx = i;
          currentIdx = i;
          refreshFormFieldsCanvas();
        }
      });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ── Form Entries ──

let _formEntriesPage = 1;
let _formEntriesFilter = 'all';

async function renderFormEntries(formId) {
  showLoading();
  try {
    const form = await apiFetch(`/forms/${formId}`);
    const result = await apiFetch(`/forms/${formId}/entries?page=${_formEntriesPage}&status=${_formEntriesFilter}`);
    hideLoading();

    const { entries, total, page, totalPages, counts } = result;

    return `
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-outline btn-sm" onclick="_formEntriesPage=1;_formEntriesFilter='all';loadSection('forms')">← Formulaires</button>
          <h1>Entrées — ${escapeHtml(form.title)}</h1>
          <span class="badge badge-muted">${total} entrée(s)</span>
        </div>
        <div style="display:flex;gap:8px">
          <a href="${API_BASE}/forms/${formId}/entries/export" target="_blank" class="btn btn-outline">${_svgDownload} Exporter CSV</a>
          <button class="btn btn-outline" onclick="loadSection('form-edit:${formId}')">${_svgEdit} Modifier</button>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:16px">
        ${['all', 'unread', 'read', 'starred', 'trash'].map(s => {
          const labels = { all: 'Toutes', unread: 'Non lues', read: 'Lues', starred: 'Favoris', trash: 'Corbeille' };
          const count = s === 'all' ? (counts.total - (counts.trash || 0)) : (counts[s] || 0);
          return `<button class="btn btn-sm ${_formEntriesFilter === s ? 'btn-primary' : 'btn-outline'}" onclick="_formEntriesFilter='${s}';_formEntriesPage=1;loadSection('form-entries:${formId}')">${labels[s]} (${count})</button>`;
        }).join('')}
      </div>

      <div class="card">
        ${entries.length > 0 ? `
          <div class="pages-list">
            <div class="pages-list-header" style="grid-template-columns: 50px 1fr 150px 80px 110px; display:grid; align-items:center;">
              <span>#</span>
              <span>Résumé</span>
              <span>Date</span>
              <span>Statut</span>
              <span style="text-align:right">Actions</span>
            </div>
            ${entries.map(entry => {
              const summary = (entry.values || []).slice(0, 3).map(v => `${v.field_label}: ${(v.field_value || '').substring(0, 30)}`).join(' | ');
              const dateStr = new Date(entry.created_at).toLocaleString('fr-FR');
              const statusBadge = entry.status === 'unread' ? 'badge-warning' : entry.status === 'starred' ? 'badge-success' : 'badge-muted';
              const statusLabel = { unread: 'Non lu', read: 'Lu', starred: 'Favori', trash: 'Corbeille' }[entry.status];
              return `
              <div class="page-item" style="display:grid; grid-template-columns: 50px 1fr 150px 80px 110px; align-items:center;${entry.status === 'unread' ? ' font-weight:600' : ''}">
                <div onclick="loadSection('form-entry-detail:${formId}:${entry.id}')" style="cursor:pointer">
                  <strong>#${entry.id}</strong>
                </div>
                <div onclick="loadSection('form-entry-detail:${formId}:${entry.id}')" style="cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:12px;">
                  <span style="font-size:13px;color:var(--gray-600)">${escapeHtml(summary)}</span>
                </div>
                <div style="font-size:13px;color:var(--gray-500)">${dateStr}</div>
                <div><span class="badge ${statusBadge}">${statusLabel}</span></div>
                <div style="display:flex; gap:4px; justify-content:flex-end;">
                  <button class="btn-icon-action" onclick="loadSection('form-entry-detail:${formId}:${entry.id}')" title="Voir">${_svgEye}</button>
                  ${entry.status !== 'starred' ? `<button class="btn-icon-action" onclick="changeEntryStatus(${formId}, ${entry.id}, 'starred')" title="Favori">${_svgStar}</button>` : `<button class="btn-icon-action" onclick="changeEntryStatus(${formId}, ${entry.id}, 'read')" title="Retirer favori">${_svgStarFill}</button>`}
                  ${entry.status !== 'trash' ? `<button class="btn-icon-action btn-icon-action--danger" onclick="changeEntryStatus(${formId}, ${entry.id}, 'trash')" title="Corbeille">${_svgTrash}</button>` : `<button class="btn-icon-action btn-icon-action--danger" onclick="deleteEntryConfirm(${formId}, ${entry.id})" title="Supprimer définitivement">${_svgX}</button>`}
                </div>
              </div>`;
            }).join('')}
          </div>

          ${totalPages > 1 ? `
          <div style="display:flex;justify-content:center;gap:4px;margin-top:16px">
            ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
              <button class="btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}" onclick="_formEntriesPage=${p};loadSection('form-entries:${formId}')">${p}</button>
            `).join('')}
          </div>` : ''}
        ` : renderEmptyState('📭', 'Aucune entrée', 'Les soumissions du formulaire apparaîtront ici')}
      </div>
    `;
  } catch (e) {
    hideLoading();
    return `<div class="card"><p>Erreur: ${e.message}</p></div>`;
  }
}

async function renderFormEntryDetail(formId, entryId) {
  showLoading();
  try {
    const [form, entry] = await Promise.all([
      apiFetch(`/forms/${formId}`),
      apiFetch(`/forms/entries/${entryId}`),
    ]);
    hideLoading();

    const dateStr = new Date(entry.created_at).toLocaleString('fr-FR');

    return `
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-outline btn-sm" onclick="loadSection('form-entries:${formId}')">← Entrées</button>
          <h1>Entrée #${entry.id}</h1>
          <span class="badge badge-muted">${escapeHtml(form.title)}</span>
        </div>
        <div style="display:flex;gap:8px">
          ${entry.status !== 'starred' ? `<button class="btn btn-outline" onclick="changeEntryStatus(${formId}, ${entry.id}, 'starred')">${_svgStar} Favori</button>` : ''}
          <button class="btn btn-outline" style="color:var(--danger)" onclick="deleteEntryConfirm(${formId}, ${entry.id})">Supprimer</button>
        </div>
      </div>

      <div class="card" style="padding:24px">
        <div style="display:flex;gap:24px;margin-bottom:20px;color:var(--gray-500);font-size:13px">
          <span>Date: ${dateStr}</span>
          <span>IP: ${entry.ip_address || 'N/A'}</span>
          <span>Statut: ${entry.status}</span>
        </div>

        <table style="width:100%;border-collapse:collapse">
          ${(entry.values || []).map(v => `
            <tr style="border-bottom:1px solid var(--gray-100)">
              <td style="padding:12px 16px;font-weight:600;width:200px;vertical-align:top;color:var(--gray-700)">${escapeHtml(v.field_label)}</td>
              <td style="padding:12px 16px;white-space:pre-wrap">${escapeHtml(v.field_value || '—')}</td>
            </tr>
          `).join('')}
        </table>
      </div>

      <div class="card" style="padding:16px;margin-top:16px">
        <p style="font-size:12px;color:var(--gray-400)"><strong>User Agent:</strong> ${escapeHtml(entry.user_agent || 'N/A')}</p>
      </div>
    `;
  } catch (e) {
    hideLoading();
    return `<div class="card"><p>Erreur: ${e.message}</p></div>`;
  }
}

async function changeEntryStatus(formId, entryId, status) {
  try {
    await apiFetch(`/forms/entries/${entryId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    showToast('Statut mis à jour', 'success');
    loadSection('form-entries:' + formId);
  } catch (e) {
    showToast('Erreur: ' + e.message, 'error');
  }
}

async function deleteEntryConfirm(formId, entryId) {
  const ok = await confirmModal('Voulez-vous vraiment supprimer définitivement cette entrée ?');
  if (!ok) return;
  showLoading();
  try {
    await apiFetch(`/forms/entries/${entryId}`, { method: 'DELETE' });
    showToast('Entrée supprimée', 'success');
    loadSection('form-entries:' + formId);
  } catch (e) {
    hideLoading();
    showToast('Erreur: ' + e.message, 'error');
  }
}

// ========== PLUGINS MANAGER ==========

async function renderPluginsManager() {
  let plugins = [];
  try {
    const data = await apiFetch('/plugins');
    plugins = data.plugins || [];
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

// ========== AI CREDITS ==========

async function renderAiCredits() {
  showLoading();
  try {
    const [overview, apiKeyInfo, perUser, perModel, entries, usageLog] = await Promise.all([
      apiFetch('/ai-credits'),
      apiFetch('/ai-credits/api-key'),
      apiFetch('/ai-credits/per-user'),
      apiFetch('/ai-credits/per-model'),
      apiFetch('/ai-credits/entries'),
      apiFetch('/ai-credits/usage'),
    ]);

    hideLoading();

    const availColor = overview.available > 1 ? 'var(--success, #28a745)' : overview.available > 0 ? 'var(--warning, #ffc107)' : 'var(--danger, #dc3545)';

    const perUserRows = perUser.map(u => `
      <tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td style="text-align:center">${u.request_count}</td>
        <td style="text-align:right">${Number(u.total_input_tokens).toLocaleString()}</td>
        <td style="text-align:right">${Number(u.total_output_tokens).toLocaleString()}</td>
        <td style="text-align:right;font-weight:600">${Number(u.total_credits_used).toFixed(4)} €</td>
      </tr>
    `).join('');

    const perModelRows = perModel.map(m => {
      const totalTokens = Number(m.total_input_tokens) + Number(m.total_output_tokens);
      return `
      <tr>
        <td><span class="badge badge-${m.model === 'sonnet' ? 'primary' : 'secondary'}">${m.model}</span></td>
        <td style="text-align:center">${m.request_count}</td>
        <td style="text-align:right">${Number(m.total_input_tokens).toLocaleString()}</td>
        <td style="text-align:right">${Number(m.total_output_tokens).toLocaleString()}</td>
        <td style="text-align:right">${totalTokens.toLocaleString()}</td>
        <td style="text-align:right;font-weight:600">${Number(m.total_credits_used).toFixed(4)} €</td>
      </tr>
    `;
    }).join('');

    const entryRows = entries.map(e => `
      <tr>
        <td>${new Date(e.created_at).toLocaleDateString('fr-FR')}</td>
        <td><span class="badge ${e.source === 'manual' ? 'badge-primary' : 'badge-success'}">${e.source === 'manual' ? 'Manuel' : 'Auto'}</span></td>
        <td style="text-align:right;font-weight:600">${Number(e.credits).toFixed(4)} €</td>
        <td>${e.note || '—'}</td>
        <td>${e.added_by_name || 'Système'}</td>
        <td>
          ${e.source === 'manual' ? `<button class="btn btn-sm btn-danger" onclick="deleteAiCredit(${e.id})">Supprimer</button>` : ''}
        </td>
      </tr>
    `).join('');

    const usageRows = (usageLog.data || []).map(u => `
      <tr>
        <td>${new Date(u.created_at).toLocaleString('fr-FR')}</td>
        <td>${u.user_name}</td>
        <td><span class="badge badge-${u.model === 'sonnet' ? 'primary' : 'secondary'}">${u.model}</span></td>
        <td style="text-align:right">${Number(u.input_tokens).toLocaleString()}</td>
        <td style="text-align:right">${Number(u.output_tokens).toLocaleString()}</td>
        <td style="text-align:right;font-weight:600">${Number(u.credits_used).toFixed(6)} €</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(u.prompt_summary || '')}">${escapeHtml(u.prompt_summary || '—')}</td>
      </tr>
    `).join('');

    return `
      <div class="page-header">
        <h1>Crédits IA</h1>

      </div>

      <div class="stats-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:24px">
        <div class="stat-card">
          <div class="label">Disponible</div>
          <div class="value" style="color:${availColor}">${overview.available.toFixed(4)} €</div>
        </div>
        <div class="stat-card">
          <div class="label">Utilisé ce mois</div>
          <div class="value">${overview.total_used.toFixed(4)} €</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="ai-credits-tabs" style="display:flex;gap:8px;margin-bottom:20px">
        <button class="btn btn-primary ai-tab active" data-tab="config">Configuration</button>
        <button class="btn ai-tab" data-tab="models">Consommation par modèle</button>
        <button class="btn ai-tab" data-tab="users">Consommation par utilisateur</button>
        <button class="btn ai-tab" data-tab="history">Historique</button>
        <button class="btn ai-tab" data-tab="entries">Crédits ajoutés</button>
      </div>

      <!-- Tab: Configuration -->
      <div class="ai-tab-content" id="tab-config">
        <div class="card ai-config-card">
          <div class="ai-config-section">
            <div class="ai-config-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              <h3>Génération IA</h3>
            </div>
            <div class="ai-input-row" style="align-items:center;gap:14px">
              <label class="toggle-switch" style="display:inline-flex;align-items:center;gap:10px;cursor:pointer">
                <input type="checkbox" id="aiEnabledToggle" ${overview.enabled !== false ? 'checked' : ''} onchange="toggleAiEnabled(this.checked)" />
                <span id="aiEnabledLabel" style="font-weight:600">${overview.enabled !== false ? 'IA activée' : 'IA désactivée'}</span>
              </label>
              <span class="ai-hint" style="margin:0;color:var(--gray-500)">Désactive temporairement la génération IA pour tous les utilisateurs.</span>
            </div>
          </div>

          <div class="ai-config-divider"></div>

          <div class="ai-config-section">
            <div class="ai-config-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <h3>Clé API Anthropic</h3>
            </div>
            <div class="ai-input-row">
              <div class="ai-input-group" style="flex:1">
                <input type="password" id="aiApiKeyInput" class="form-input" placeholder="sk-ant-api03-..." />
              </div>
              <button class="btn ai-btn-icon" onclick="toggleApiKeyVisibility()" title="Afficher/masquer la saisie">
                <svg id="aiKeyEyeIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="btn btn-primary" onclick="saveAiApiKey()">Sauvegarder</button>
            </div>
            ${apiKeyInfo.has_key
              ? `<div class="ai-key-status ai-key-status--ok">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span id="aiKeyDisplay">${apiKeyInfo.masked}</span>
                  <button class="ai-reveal-btn" id="aiRevealBtn" onclick="revealAiApiKey()">Révéler</button>
                </div>`
              : '<div class="ai-key-status ai-key-status--warn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Aucune clé configurée</div>'}
          </div>

          <div class="ai-config-divider"></div>

          <div class="ai-config-section">
            <div class="ai-config-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <h3>Crédits mensuels</h3>
            </div>
            <div class="ai-input-row">
              <div class="ai-input-group ai-input-euro">
                <input type="number" id="aiMonthlyCreditsInput" class="form-input" step="0.01" min="0" value="${overview.monthly_credits}" />
              </div>
              <button class="btn btn-primary" onclick="saveAiMonthlyCredits()">Sauvegarder</button>
            </div>
            <p class="ai-hint">Montant rechargé automatiquement le 1er de chaque mois.</p>
          </div>

          <div class="ai-config-divider"></div>

          <div class="ai-config-section">
            <div class="ai-config-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              <h3>Ajouter des crédits</h3>
            </div>
            <div class="ai-input-row ai-add-credits-row">
              <div class="ai-input-group ai-input-euro" style="flex:0 0 160px">
                <label class="form-label">Montant</label>
                <input type="number" id="aiAddCreditsAmount" class="form-input" step="0.01" min="0.01" placeholder="5.00" />
              </div>
              <div class="ai-input-group" style="flex:1">
                <label class="form-label">Note <span style="font-weight:400;color:var(--gray-400)">(optionnel)</span></label>
                <input type="text" id="aiAddCreditsNote" class="form-input" placeholder="Raison de l'ajout..." />
              </div>
              <button class="btn btn-primary ai-add-btn" onclick="addAiCredits()">
                Ajouter
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Per-model usage -->
      <div class="ai-tab-content" id="tab-models" style="display:none">
        <div class="card" style="padding:20px">
          ${perModel.length === 0 ? '<p style="color:var(--gray-500)">Aucune utilisation ce mois-ci</p>' : `
          <table class="ai-table">
            <thead>
              <tr>
                <th>Modèle</th><th style="text-align:center">Requêtes</th>
                <th style="text-align:right">Tokens entrée</th><th style="text-align:right">Tokens sortie</th>
                <th style="text-align:right">Total tokens</th>
                <th style="text-align:right">Coût</th>
              </tr>
            </thead>
            <tbody>${perModelRows}</tbody>
          </table>
          `}
        </div>
      </div>

      <!-- Tab: Per-user usage -->
      <div class="ai-tab-content" id="tab-users" style="display:none">
        <div class="card" style="padding:20px">
          ${perUser.length === 0 ? '<p style="color:var(--gray-500)">Aucune utilisation ce mois-ci</p>' : `
          <table class="ai-table">
            <thead>
              <tr>
                <th>Utilisateur</th><th>Email</th><th style="text-align:center">Requêtes</th>
                <th style="text-align:right">Tokens entrée</th><th style="text-align:right">Tokens sortie</th>
                <th style="text-align:right">Coût</th>
              </tr>
            </thead>
            <tbody>${perUserRows}</tbody>
          </table>
          `}
        </div>
      </div>

      <!-- Tab: History -->
      <div class="ai-tab-content" id="tab-history" style="display:none">
        <div class="card" style="padding:20px">
          ${(usageLog.data || []).length === 0 ? '<p style="color:var(--gray-500)">Aucun historique</p>' : `
          <table class="ai-table">
            <thead>
              <tr>
                <th>Date</th><th>Utilisateur</th><th>Modèle</th>
                <th style="text-align:right">Input</th><th style="text-align:right">Output</th>
                <th style="text-align:right">Coût</th><th>Prompt</th>
              </tr>
            </thead>
            <tbody>${usageRows}</tbody>
          </table>
          ${usageLog.pages > 1 ? `<div style="margin-top:12px;text-align:center">${renderAiPagination(usageLog.page, usageLog.pages)}</div>` : ''}
          `}
        </div>
      </div>

      <!-- Tab: Credit entries -->
      <div class="ai-tab-content" id="tab-entries" style="display:none">
        <div class="card" style="padding:20px">
          ${entries.length === 0 ? '<p style="color:var(--gray-500)">Aucun crédit ajouté ce mois-ci</p>' : `
          <table class="ai-table">
            <thead>
              <tr>
                <th>Date</th><th>Type</th><th style="text-align:right">Montant</th>
                <th>Note</th><th>Ajouté par</th><th></th>
              </tr>
            </thead>
            <tbody>${entryRows}</tbody>
          </table>
          `}
        </div>
      </div>

    `;
  } catch (error) {
    hideLoading();
    return `<div class="card" style="padding:20px"><p style="color:var(--danger)">Erreur : ${error.message}</p></div>`;
  }
}

function renderAiPagination(current, total) {
  let html = '';
  for (let i = 1; i <= total; i++) {
    html += `<button class="btn ${i === current ? 'btn-primary' : ''}" style="margin:0 2px;min-width:36px" onclick="loadAiUsagePage(${i})">${i}</button>`;
  }
  return html;
}

function attachAiCreditsEvents() {
  document.querySelectorAll('.ai-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.ai-tab-content').forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).style.display = 'block';
    });
  });
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('aiApiKeyInput');
  input.type = input.type === 'password' ? 'text' : 'password';
}

let _aiKeyRevealed = false;
async function revealAiApiKey() {
  const display = document.getElementById('aiKeyDisplay');
  const btn = document.getElementById('aiRevealBtn');
  if (_aiKeyRevealed) {
    // Re-mask
    try {
      const data = await apiFetch('/ai-credits/api-key');
      display.textContent = data.masked;
      btn.textContent = 'Révéler';
      _aiKeyRevealed = false;
    } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
    return;
  }
  try {
    btn.textContent = '...';
    const data = await apiFetch('/ai-credits/api-key?reveal=1');
    if (data.plain) {
      display.textContent = data.plain;
      btn.textContent = 'Masquer';
      _aiKeyRevealed = true;
    }
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); btn.textContent = 'Révéler'; }
}

async function toggleAiEnabled(enabled) {
  const label = document.getElementById('aiEnabledLabel');
  try {
    await apiFetch('/ai-credits/enabled', { method: 'PUT', body: JSON.stringify({ enabled }) });
    aiEnabled = !!enabled;
    if (label) label.textContent = enabled ? 'IA activée' : 'IA désactivée';
    showToast(enabled ? 'Génération IA activée' : 'Génération IA désactivée', 'success');
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
    const toggle = document.getElementById('aiEnabledToggle');
    if (toggle) toggle.checked = !enabled;
  }
}

async function saveAiApiKey() {
  const apiKey = document.getElementById('aiApiKeyInput').value.trim();
  if (!apiKey) return showToast('Saisissez une clé API', 'error');
  try {
    await apiFetch('/ai-credits/api-key', { method: 'PUT', body: JSON.stringify({ api_key: apiKey }) });
    showToast('Clé API sauvegardée', 'success');
    document.getElementById('content').innerHTML = await renderAiCredits();
    attachAiCreditsEvents();
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function saveAiCreditLimit() {
  const limit = parseFloat(document.getElementById('aiCreditLimitInput').value) || 0;
  try {
    await apiFetch('/ai-credits/limit', { method: 'PUT', body: JSON.stringify({ limit }) });
    showToast('Limite mise à jour', 'success');
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function saveAiMonthlyCredits() {
  const amount = parseFloat(document.getElementById('aiMonthlyCreditsInput').value) || 0;
  try {
    await apiFetch('/ai-credits/monthly-credits', { method: 'PUT', body: JSON.stringify({ amount }) });
    showToast('Crédits mensuels mis à jour', 'success');
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function addAiCredits() {
  const credits = parseFloat(document.getElementById('aiAddCreditsAmount').value);
  const note = document.getElementById('aiAddCreditsNote').value.trim();
  if (!credits || credits <= 0) return showToast('Montant invalide', 'error');
  try {
    await apiFetch('/ai-credits', { method: 'POST', body: JSON.stringify({ credits, note }) });
    showToast('Crédits ajoutés', 'success');
    document.getElementById('content').innerHTML = await renderAiCredits();
    attachAiCreditsEvents();
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function deleteAiCredit(id) {
  if (!confirm('Supprimer ce crédit ?')) return;
  try {
    await apiFetch(`/ai-credits/${id}`, { method: 'DELETE' });
    showToast('Crédit supprimé', 'success');
    document.getElementById('content').innerHTML = await renderAiCredits();
    attachAiCreditsEvents();
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function loadAiUsagePage(page) {
  // Reload just the history tab with pagination
  try {
    const usageLog = await apiFetch(`/ai-credits/usage?page=${page}`);
    const rows = (usageLog.data || []).map(u => `
      <tr>
        <td>${new Date(u.created_at).toLocaleString('fr-FR')}</td>
        <td>${u.user_name}</td>
        <td><span class="badge badge-${u.model === 'sonnet' ? 'primary' : 'secondary'}">${u.model}</span></td>
        <td style="text-align:right">${Number(u.input_tokens).toLocaleString()}</td>
        <td style="text-align:right">${Number(u.output_tokens).toLocaleString()}</td>
        <td style="text-align:right;font-weight:600">${Number(u.credits_used).toFixed(6)} €</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(u.prompt_summary || '')}">${escapeHtml(u.prompt_summary || '—')}</td>
      </tr>
    `).join('');

    const tabHistory = document.getElementById('tab-history');
    tabHistory.querySelector('.card').innerHTML = `
      <table class="ai-table">
        <thead><tr><th>Date</th><th>Utilisateur</th><th>Modèle</th><th style="text-align:right">Input</th><th style="text-align:right">Output</th><th style="text-align:right">Coût</th><th>Prompt</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${usageLog.pages > 1 ? `<div style="margin-top:12px;text-align:center">${renderAiPagination(usageLog.page, usageLog.pages)}</div>` : ''}
    `;
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
}
