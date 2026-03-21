const API_BASE = window.location.origin + '/api';
let token = localStorage.getItem('token');
let currentUser = null;

const MENU_LOCATIONS = [
  { value: '', label: '— Aucun —' },
  { value: 'primary', label: 'Menu principal' },
  { value: 'secondary', label: 'Menu secondaire (top)' },
  { value: 'footer', label: 'Menu footer' },
];

// Check auth on load
if (!token) {
  window.location.href = '/admin/login.html';
} else {
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
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Auth failed');
    }

    currentUser = await response.json();
    document.getElementById('userInfo').textContent = currentUser.name;

    // Afficher le menu Utilisateurs pour les admins uniquement
    if (currentUser.role === 'admin') {
      const navUsers = document.getElementById('navUsers');
      if (navUsers) navUsers.style.display = '';
    }

    // Appliquer le thème choisi au back-office
    await loadAdminTheme();

    // Charger les paramètres globaux du site (couleurs, etc.) pour les formulaires de modules
    await loadSiteSettings();

    // Charger les plugins et injecter modules + CPT
    await loadPlugins();

    // Setup navigation
    setupNavigation();
    setupSidebarToggle();

    // Restaurer la dernière vue si possible
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
  } catch (error) {
    localStorage.removeItem('token');
    window.location.href = '/admin/login.html';
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

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;

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
  const activeNav = document.querySelector(`.nav-item[data-section="${section}"]`);
  if (activeNav) activeNav.classList.add('active');

  switch(section) {
    case 'dashboard':
      content.innerHTML = await renderDashboard();
      break;
    case 'posts':
      content.innerHTML = await renderPosts();
      break;
    case 'categories':
      content.innerHTML = await renderCategories();
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
    default:
      if (section.startsWith('cpt-add:')) {
        const slug = section.split(':')[1];
        const ptDef = findPostTypeDef(slug);
        if (ptDef) { content.innerHTML = await renderCPTEditPage(ptDef, null); attachCPTFormEvents(ptDef); }
      } else if (section.startsWith('cpt-edit:')) {
        const parts = section.split(':');
        const slug = parts[1]; const itemId = parseInt(parts[2]);
        const ptDef = findPostTypeDef(slug);
        if (ptDef) { content.innerHTML = await renderCPTEditPage(ptDef, itemId); attachCPTFormEvents(ptDef); }
      } else if (section.startsWith('cpt-categories:')) {
        const slug = section.split(':')[1];
        const ptDef = findPostTypeDef(slug);
        if (ptDef) { content.innerHTML = await renderCPTCategoriesPage(ptDef); }
      } else if (section.startsWith('cpt-options:')) {
        const slug = section.split(':')[1];
        const ptDef = findPostTypeDef(slug);
        if (ptDef) { content.innerHTML = await renderCPTOptionsPage(ptDef); attachCPTOptionsEvents(); }
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
    const [postsRes, categoriesRes, pagesRes] = await Promise.all([
      apiFetch('/posts'),
      apiFetch('/categories'),
      apiFetch('/pages')
    ]);

    const posts = postsRes;
    const categories = categoriesRes;
    const pages = pagesRes;
    const publishedPosts = posts.filter(p => p.status === 'published').length;
    const draftPosts = posts.filter(p => p.status === 'draft').length;

    hideLoading();

    return `
      <div class="page-header">
        <h1>Tableau de bord</h1>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Total Articles</div>
          <div class="value">${posts.length}</div>
        </div>
        <div class="stat-card">
          <div class="label">Publiés</div>
          <div class="value" style="color: var(--success)">${publishedPosts}</div>
        </div>
        <div class="stat-card">
          <div class="label">Brouillons</div>
          <div class="value" style="color: var(--warning)">${draftPosts}</div>
        </div>
        <div class="stat-card">
          <div class="label">Pages</div>
          <div class="value">${pages.length}</div>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-bottom: 16px">Articles récents</h3>
        ${posts.length > 0 ? renderPostsTable(posts.slice(0, 5)) : '<p class="empty-state">Aucun article</p>'}
      </div>
    `;
  } catch (error) {
    hideLoading();
    return `<div class="card"><p style="color: var(--danger)">Erreur: ${error.message}</p></div>`;
  }
}

// ========== POSTS ==========
async function renderPosts() {
  showLoading();
  try {
    const posts = await apiFetch('/posts');
    const categories = await apiFetch('/categories');
    hideLoading();

    return `
      <div class="page-header">
        <h1>Articles</h1>
        <button class="btn btn-primary" onclick="showPostForm()">
          <span class="icon">➕</span>
          Nouvel article
        </button>
      </div>

      <div class="card">
        ${posts.length > 0 ? renderPostsTable(posts) : renderEmptyState('📄', 'Aucun article', 'Créez votre premier article pour commencer')}
      </div>

      <!-- Modal Form -->
      <div id="postModal" style="display: none;"></div>
    `;
  } catch (error) {
    hideLoading();
    showToast('Erreur lors du chargement des articles', 'error');
    return '<div class="card"><p>Erreur de chargement</p></div>';
  }
}

const _svgEdit = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const _svgDelete = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

function renderPostsTable(posts) {
  return `
    <div class="pages-list">
      <div class="pages-list-header">
        <span class="page-item__info">Article</span>
        <span class="page-item__parent">Catégories</span>
        <span class="page-item__meta">Date</span>
        <span class="page-item__badges">Statut</span>
        <span class="page-item__actions" style="opacity:1">Actions</span>
      </div>
      ${posts.map(post => {
        const safeTitle = escapeHtml(post.title).replace(/'/g, "\\'");
        const cats = post.categories?.map(c => escapeHtml(c.name)).join(', ') || '';
        const dateStr = new Date(post.published_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        return '<div class="page-item">'
          + '<div class="page-item__info" style="cursor:pointer" onclick="editPost(' + post.id + ')">'
          +   '<div class="page-item__title">' + escapeHtml(post.title) + '</div>'
          +   '<div class="page-item__slug">' + escapeHtml(post.author?.name || '') + '</div>'
          + '</div>'
          + '<div class="page-item__parent">' + (cats || '<span style="color:var(--gray-400);">—</span>') + '</div>'
          + '<div class="page-item__meta"><span class="page-item__date">' + dateStr + '</span></div>'
          + '<div class="page-item__badges"><span class="badge ' + (post.status === 'published' ? 'badge-success' : 'badge-warning') + '">' + (post.status === 'published' ? 'Publié' : 'Brouillon') + '</span></div>'
          + '<div class="page-item__actions">'
          +   '<button class="btn-icon-action" onclick="editPost(' + post.id + ')" title="Modifier">' + _svgEdit + '</button>'
          +   '<button class="btn-icon-action btn-icon-action--danger" onclick="deletePost(' + post.id + ', \'' + safeTitle + '\')" title="Supprimer">' + _svgDelete + '</button>'
          + '</div>'
        + '</div>';
      }).join('')}
    </div>
  `;
}

async function showPostForm(postId = null) {
  showLoading();
  const categories = await apiFetch('/categories');

  let post = null;
  if (postId) {
    const posts = await apiFetch('/posts');
    post = posts.find(p => p.id === postId);
  }

  hideLoading();

  const modal = document.getElementById('postModal');
  modal.style.display = 'block';
  modal.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;" onclick="if(event.target === this) closeModal()">
      <div class="card" style="max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h2>${postId ? 'Modifier l\'article' : 'Nouvel article'}</h2>
          <button class="btn btn-outline btn-sm" onclick="closeModal()">✕</button>
        </div>

        <form id="postForm" onsubmit="savePost(event, ${postId})">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Titre *</label>
              <input type="text" class="form-input" id="postTitle" name="title" value="${post?.title || ''}" oninput="generatePostSlug(${postId})" required>
            </div>

            <div class="form-group">
              <label class="form-label">Slug *</label>
              <input type="text" class="form-input" id="postSlug" name="slug" value="${post?.slug || ''}" required>
              <div class="form-help" id="postSlugHelp">URL de l'article (ex: mon-article)</div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Extrait *</label>
            <textarea class="form-textarea" name="excerpt" rows="3" required>${post?.excerpt || ''}</textarea>
            <div class="form-help">Courte description pour l'aperçu</div>
          </div>

          <div class="form-group">
            <label class="form-label">Contenu *</label>
            <textarea class="form-textarea" name="content" rows="10" required>${post?.content || ''}</textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Date de publication *</label>
              <input type="datetime-local" class="form-input" name="published_date"
                value="${post?.published_date ? new Date(post.published_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)}" required>
            </div>

            <div class="form-group">
              <label class="form-label">Statut *</label>
              <select class="form-select" name="status" required>
                <option value="draft" ${post?.status === 'draft' ? 'selected' : ''}>Brouillon</option>
                <option value="published" ${post?.status === 'published' ? 'selected' : ''}>Publié</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Catégories</label>
            <select class="form-select" name="categories" multiple size="5">
              ${categories.map(cat => `
                <option value="${cat.id}" ${post?.categories?.find(c => c.id === cat.id) ? 'selected' : ''}>
                  ${cat.name}
                </option>
              `).join('')}
            </select>
            <div class="form-help">Maintenez Ctrl/Cmd pour sélectionner plusieurs</div>
          </div>

          <div class="form-group">
            <label class="form-label">Tags</label>
            <input type="text" class="form-input" name="tags" value="${post?.tags?.join(', ') || ''}" placeholder="tag1, tag2, tag3">
            <div class="form-help">Séparez les tags par des virgules</div>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 32px;">
            <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary">
              ${postId ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function savePost(event, postId) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  const data = {
    title: formData.get('title'),
    slug: formData.get('slug'),
    excerpt: formData.get('excerpt'),
    content: formData.get('content'),
    published_date: formData.get('published_date'),
    status: formData.get('status'),
    categories: Array.from(form.categories.selectedOptions).map(opt => parseInt(opt.value)),
    tags: formData.get('tags')?.split(',').map(t => t.trim()).filter(t => t) || []
  };

  showLoading();
  try {
    if (postId) {
      await apiFetch(`/posts/${postId}`, { method: 'PUT', body: JSON.stringify(data) });
      showToast('Article mis à jour avec succès', 'success');
    } else {
      await apiFetch('/posts', { method: 'POST', body: JSON.stringify(data) });
      showToast('Article créé avec succès', 'success');
    }
    closeModal();
    loadSection('posts');
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
  }
}

async function editPost(id) {
  await showPostForm(id);
}

async function deletePost(id, title) {
  const ok = await confirmModal(`Voulez-vous vraiment supprimer l'article "${title}" ?`);
  if (!ok) return;

  showLoading();
  try {
    await apiFetch(`/posts/${id}`, { method: 'DELETE' });
    showToast('Article supprimé', 'success');
    loadSection('posts');
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
  }
}

// ========== CATEGORIES ==========
async function renderCategories() {
  showLoading();
  try {
    const categories = await apiFetch('/categories');
    hideLoading();

    return `
      <div class="page-header">
        <h1>Catégories</h1>
        <button class="btn btn-primary" onclick="showCategoryForm()">
          <span class="icon">➕</span>
          Nouvelle catégorie
        </button>
      </div>

      <div class="card">
        ${categories.length > 0 ? renderCategoriesTable(categories) : renderEmptyState('🏷️', 'Aucune catégorie', 'Créez votre première catégorie')}
      </div>

      <div id="categoryModal" style="display: none;"></div>
    `;
  } catch (error) {
    hideLoading();
    return '<div class="card"><p>Erreur de chargement</p></div>';
  }
}

function renderCategoriesTable(categories) {
  return `
    <div class="pages-list">
      <div class="pages-list-header">
        <span class="page-item__info">Nom</span>
        <span class="page-item__parent">Slug</span>
        <span class="page-item__meta">Description</span>
        <span class="page-item__actions" style="opacity:1">Actions</span>
      </div>
      ${categories.map(cat => {
        const safeName = escapeHtml(cat.name).replace(/'/g, "\\'");
        return '<div class="page-item">'
          + '<div class="page-item__info" style="cursor:pointer" onclick="editCategory(' + cat.id + ')">'
          +   '<div class="page-item__title">' + escapeHtml(cat.name) + '</div>'
          + '</div>'
          + '<div class="page-item__parent"><span class="page-item__slug" style="display:inline">' + escapeHtml(cat.slug) + '</span></div>'
          + '<div class="page-item__meta">' + escapeHtml(cat.description || '—') + '</div>'
          + '<div class="page-item__actions">'
          +   '<button class="btn-icon-action" onclick="editCategory(' + cat.id + ')" title="Modifier">' + _svgEdit + '</button>'
          +   '<button class="btn-icon-action btn-icon-action--danger" onclick="deleteCategory(' + cat.id + ', \'' + safeName + '\')" title="Supprimer">' + _svgDelete + '</button>'
          + '</div>'
        + '</div>';
      }).join('')}
    </div>
  `;
}

async function showCategoryForm(catId = null) {
  showLoading();

  let category = null;
  if (catId) {
    const categories = await apiFetch('/categories');
    category = categories.find(c => c.id === catId);
  }

  hideLoading();

  const modal = document.getElementById('categoryModal');
  modal.style.display = 'block';
  modal.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;" onclick="if(event.target === this) closeModal()">
      <div class="card" style="max-width: 600px; width: 90%;" onclick="event.stopPropagation()">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h2>${catId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h2>
          <button class="btn btn-outline btn-sm" onclick="closeModal()">✕</button>
        </div>

        <form id="categoryForm" onsubmit="saveCategory(event, ${catId})">
          <div class="form-group">
            <label class="form-label">Nom *</label>
            <input type="text" class="form-input" id="categoryName" name="name" value="${category?.name || ''}" oninput="generateCategorySlug(${catId})" required>
          </div>

          <div class="form-group">
            <label class="form-label">Slug *</label>
            <input type="text" class="form-input" id="categorySlug" name="slug" value="${category?.slug || ''}" required>
            <div class="form-help" id="categorySlugHelp">URL de la catégorie (ex: technologie)</div>
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" name="description" rows="4">${category?.description || ''}</textarea>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
            <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary">
              ${catId ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function saveCategory(event, catId) {
  event.preventDefault();
  const formData = new FormData(event.target);

  const data = {
    name: formData.get('name'),
    slug: formData.get('slug'),
    description: formData.get('description')
  };

  showLoading();
  try {
    if (catId) {
      await apiFetch(`/categories/${catId}`, { method: 'PUT', body: JSON.stringify(data) });
      showToast('Catégorie mise à jour', 'success');
    } else {
      await apiFetch('/categories', { method: 'POST', body: JSON.stringify(data) });
      showToast('Catégorie créée', 'success');
    }
    closeModal();
    loadSection('categories');
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
  }
}

async function editCategory(id) {
  await showCategoryForm(id);
}

async function deleteCategory(id, name) {
  const ok = await confirmModal(`Voulez-vous vraiment supprimer la catégorie "${name}" ?`);
  if (!ok) return;

  showLoading();
  try {
    await apiFetch(`/categories/${id}`, { method: 'DELETE' });
    showToast('Catégorie supprimée', 'success');
    loadSection('categories');
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
  }
}

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
  TextImage: 'Texte + image',

  SliderTextVideo: 'Slider texte / vidéo',
  Accordion: 'Accordéons',
  KeyFigures: 'Chiffres clés',
  Quote: 'Citation',
  TextScrolling: 'Texte défilant',
  LinkAlone: 'Lien seul',
  Gallery: 'Galerie',
  Video: 'Vidéo',
  ImagesSlider: 'Slider d\'images',
  Files: 'Fichiers',
  ImagesVideosParallax: 'Images/Vidéos parallax',
  IconLogo: 'Logos (icônes)',
  SliderLogo: 'Slider de logos',
  Ornament: 'Ornement',
  IllusVideo: 'Illustration vidéo',
  ClickableTiles: 'Tuiles cliquables',
  FreePost: 'Article libre',
  NewsSlider: 'Slider d\'actualités',
  EventsSlider: 'Slider d\'événements',
  BlocReferences: 'Bloc références',
  Team: 'Équipe',
  Contact: 'Contact',
  Map: 'Carte',
  GoogleReviews: 'Avis Google',
  Summary: 'Sommaire',
  Form: 'Formulaire',
  ReusableBloc: 'Bloc réutilisable',
  ColumnsTab: 'Colonnes / onglets',
  Separator: 'Séparateur',
  NewsletterForm: 'Formulaire newsletter',
  Review: 'Avis',
  Widget: 'Widget',
  PlanSite: 'Plan du site',
  InstaFeed: 'Flux Instagram',
  ThreadsFeed: 'Flux Threads',
  Product: 'Produit'
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
    modules: ['Gallery', 'Video', 'ImagesSlider', 'Files', 'ImagesVideosParallax', 'IconLogo', 'SliderLogo', 'Ornament', 'IllusVideo']
  },
  {
    id: 'news',
    label: 'Actualités & références',
    icon: '📰',
    modules: ['ClickableTiles', 'FreePost', 'NewsSlider', 'EventsSlider', 'BlocReferences', 'Team', 'Contact', 'Map']
  },
  {
    id: 'tools',
    label: 'Fonctionnels & outils',
    icon: '🧰',
    modules: ['GoogleReviews', 'Summary', 'Form', 'ReusableBloc', 'ColumnsTab', 'Separator', 'NewsletterForm', 'Review', 'Widget', 'PlanSite']
  },
  {
    id: 'social',
    label: 'Réseaux sociaux',
    icon: '💬',
    modules: ['InstaFeed', 'ThreadsFeed']
  },
  {
    id: 'commerce',
    label: 'E-commerce',
    icon: '🛒',
    modules: ['Product']
  }
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

async function loadPlugins() {
  try {
    const data = await apiFetch('/plugins');
    loadedPlugins = data.plugins || [];
  } catch {
    loadedPlugins = [];
    return;
  }

  for (const plugin of loadedPlugins) {
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
        a.innerHTML = `${pt.icon || '📁'} ${escapeHtml(pt.labelPlural || pt.label)}`;
        if (settingsLink) nav.insertBefore(a, settingsLink);
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

        if (settingsLink) nav.insertBefore(sub, settingsLink);
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

    return '<div class="page-item">'
      + '<div class="page-item__info" style="cursor:pointer" onclick="loadSection(\'cpt-edit:' + escapeHtml(ptDef.slug) + ':' + item.id + '\')">'
      +   '<div style="display:flex;align-items:center;gap:12px;">'
      +     (thumbUrl
            ? '<img src="' + escapeHtml(thumbUrl) + '" style="width:48px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0;">'
            : '<div style="width:48px;height:48px;background:var(--gray-100);border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--gray-400);flex-shrink:0;font-size:18px;">' + (ptDef.icon || '📷') + '</div>')
      +     '<div>'
      +       '<div class="page-item__title">' + escapeHtml(item.title) + '</div>'
      +       '<div class="page-item__slug">/' + escapeHtml(ptDef.slug) + '/' + escapeHtml(item.slug) + '</div>'
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

  // Parse photos gallery
  let photos = [];
  try { photos = JSON.parse(cf.photos || '[]'); } catch { photos = []; }
  if (!Array.isArray(photos)) photos = [];

  // Parse link
  let linkObj = { url: '', title: '', target: '_self' };
  try { if (cf.link) linkObj = typeof cf.link === 'string' ? JSON.parse(cf.link) : cf.link; } catch { /* keep defaults */ }

  const featuredImgPreview = fi
    ? `<img src="${escapeHtml(fi.sizes?.thumbnail || fi.url || '')}" alt="" style="max-width:200px;max-height:150px;object-fit:cover;border-radius:8px;">`
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

  return `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px;">
        <button class="btn btn-outline btn-sm" onclick="loadSection('cpt:${escapeHtml(ptDef.slug)}')">← Retour</button>
        <h1>${itemId ? 'Modifier' : 'Nouvelle'} ${escapeHtml(ptDef.label)}</h1>
      </div>
    </div>

    <form id="cptEditForm" data-post-type="${escapeHtml(ptDef.slug)}" data-item-id="${itemId || ''}">
      <div style="display:grid;grid-template-columns:1fr 300px;gap:24px;align-items:start;">
        <!-- Main column -->
        <div>
          <div class="card" style="margin-bottom:24px;">
            <div class="form-group">
              <label class="form-label">Titre *</label>
              <input type="text" class="form-input" name="title" value="${escapeHtml(item?.title || '')}" required id="cptTitleInput">
            </div>
            <div class="form-group">
              <label class="form-label">Slug</label>
              <input type="text" class="form-input" name="slug" value="${escapeHtml(item?.slug || '')}" id="cptSlugInput">
            </div>
          </div>

          <!-- Tabs: Popup / Contenu -->
          <div class="card" style="margin-bottom:24px;">
            <div class="cpt-tabs" style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px;">
              <button type="button" class="cpt-tab active" data-tab="popup" style="padding:10px 20px;border:0;background:0;cursor:pointer;font-weight:600;border-bottom:2px solid var(--primary);margin-bottom:-2px;">Popup</button>
              <button type="button" class="cpt-tab" data-tab="contenu" style="padding:10px 20px;border:0;background:0;cursor:pointer;font-weight:600;color:#999;border-bottom:2px solid transparent;margin-bottom:-2px;">Contenu</button>
            </div>

            <!-- Tab: Popup -->
            <div class="cpt-tab-content" data-tab="popup">
              <div class="form-group">
                <label class="form-label">Sous-titre / Nom du client</label>
                <input type="text" class="form-input" name="cf_customer_name" value="${escapeHtml(cf.customer_name || '')}">
              </div>

              <div class="form-group">
                <label class="form-label">Texte / Description</label>
                <div id="cptQuillEditor" style="min-height:200px;"></div>
                <input type="hidden" name="cf_text" value="${escapeHtml(cf.text || '')}">
              </div>

              <div class="form-group">
                <label class="form-label">Photos</label>
                <div id="cptPhotosPreview" style="margin-bottom:8px;">${photosPreview}</div>
                <input type="hidden" name="cf_photos" id="cptPhotosInput" value="${escapeHtml(JSON.stringify(photos))}">
                <button type="button" class="btn btn-outline btn-sm" onclick="openCPTPhotoPicker()">📸 Ajouter des photos</button>
              </div>

              <div class="form-group">
                <label class="form-label">Lien</label>
                <div class="form-row" style="grid-template-columns:1fr 2fr 1fr auto;">
                  <div class="form-group">
                    <select class="form-input" id="cptLinkPageSelect">
                      <option value="">— Page du site —</option>
                      ${allPages.filter(p => p.status === 'published').map(p => `<option value="/pages/${escapeHtml(p.slug)}" ${linkObj.url === '/pages/' + p.slug ? 'selected' : ''}>${escapeHtml(p.title)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-group">
                    <input type="text" class="form-input" name="cf_link_url" id="cptLinkUrlInput" value="${escapeHtml(linkObj.url || '')}" placeholder="URL (ou choisir une page)">
                  </div>
                  <div class="form-group">
                    <input type="text" class="form-input" name="cf_link_title" value="${escapeHtml(linkObj.title || '')}" placeholder="Titre du lien">
                  </div>
                  <div class="form-group">
                    <select class="form-input" name="cf_link_target">
                      <option value="_self" ${linkObj.target !== '_blank' ? 'selected' : ''}>Même fenêtre</option>
                      <option value="_blank" ${linkObj.target === '_blank' ? 'selected' : ''}>Nouvel onglet</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tab: Contenu (flexible modules - stored in content field) -->
            <div class="cpt-tab-content" data-tab="contenu" style="display:none;">
              <p style="color:#999;font-size:13px;">Le contenu flexible (modules) est géré via le champ contenu du CPT. Vous pouvez y ajouter du JSON de blocs.</p>
              <div class="form-group">
                <label class="form-label">Contenu (JSON blocs)</label>
                <textarea class="form-textarea" name="content" rows="12" style="font-family:monospace;font-size:13px;">${escapeHtml(item?.content || '')}</textarea>
              </div>
            </div>
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

          <div class="card" style="margin-bottom:16px;">
            <h3 style="margin-bottom:12px;">Image à la une</h3>
            <div id="cptFeaturedPreview" style="margin-bottom:8px;">${featuredImgPreview}</div>
            <input type="hidden" name="featured_image" id="cptFeaturedInput" value="${fi ? escapeHtml(JSON.stringify(fi)) : ''}">
            <div style="display:flex;gap:8px;">
              <button type="button" class="btn btn-outline btn-sm" onclick="openCPTFeaturedPicker()">📷 Choisir</button>
              ${fi ? '<button type="button" class="btn btn-sm btn-danger-outline" onclick="clearCPTFeatured()">Supprimer</button>' : ''}
            </div>
          </div>

          ${categoriesHtml ? `<div class="card" style="margin-bottom:16px;">${categoriesHtml}</div>` : ''}
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

  // Link page selector → URL sync
  const pageSelect = document.getElementById('cptLinkPageSelect');
  const linkUrlInput = document.getElementById('cptLinkUrlInput');
  if (pageSelect && linkUrlInput) {
    pageSelect.addEventListener('change', () => {
      if (pageSelect.value) linkUrlInput.value = pageSelect.value;
    });
  }

  // Init Quill editor for text field
  initCPTQuillEditor();

  // Form submit
  const form = document.getElementById('cptEditForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveCPTItemFromForm(ptDef);
    });
  }
}

function initCPTQuillEditor() {
  const container = document.getElementById('cptQuillEditor');
  const hiddenInput = document.querySelector('input[name="cf_text"]');
  if (!container || !hiddenInput) return;

  // Load Quill if not already loaded
  if (typeof Quill === 'undefined') {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = 'https://cdn.quilljs.com/1.3.7/quill.snow.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://cdn.quilljs.com/1.3.7/quill.min.js';
    script.onload = () => createCPTQuill(container, hiddenInput);
    document.head.appendChild(script);
  } else {
    createCPTQuill(container, hiddenInput);
  }
}

let _cptQuill = null;
function createCPTQuill(container, hiddenInput) {
  _cptQuill = new Quill(container, {
    theme: 'snow',
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ align: [] }],
        ['link'],
        ['clean']
      ]
    }
  });
  // Set initial content
  if (hiddenInput.value) {
    _cptQuill.root.innerHTML = hiddenInput.value;
  }
  // Sync on change
  _cptQuill.on('text-change', () => {
    hiddenInput.value = _cptQuill.root.innerHTML;
  });
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
    .then(([folders, items]) => {
      mediaPickerState.folders = folders;
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

// Photos gallery picker
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
    .then(([folders, items]) => {
      mediaPickerState.folders = folders;
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

  // Sync Quill content
  if (_cptQuill) {
    form.querySelector('input[name="cf_text"]').value = _cptQuill.root.innerHTML;
  }

  // Build link object
  const linkUrl = formData.get('cf_link_url') || '';
  const linkTitle = formData.get('cf_link_title') || '';
  const linkTarget = formData.get('cf_link_target') || '_self';
  const linkObj = linkUrl ? JSON.stringify({ url: linkUrl, title: linkTitle, target: linkTarget }) : '';

  // Build custom_fields
  const custom_fields = {
    customer_name: formData.get('cf_customer_name') || '',
    text: formData.get('cf_text') || '',
    photos: formData.get('cf_photos') || '[]',
    link: linkObj
  };

  // Featured image
  const fiRaw = document.getElementById('cptFeaturedInput')?.value || '';
  let featured_image = null;
  try { if (fiRaw) featured_image = JSON.parse(fiRaw); } catch { /* ignore */ }

  // Categories
  const categories = [];
  form.querySelectorAll('.cpt-categories-checkboxes input[type="checkbox"]:checked').forEach(cb => {
    categories.push(parseInt(cb.value));
  });

  const payload = {
    title: formData.get('title'),
    slug: formData.get('slug'),
    content: formData.get('content') || '',
    status: formData.get('status') || 'draft',
    featured_image,
    custom_fields,
    categories
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

async function editCPTCategory(postTypeSlug, catId, currentName) {
  const newName = prompt('Nouveau nom :', currentName);
  if (!newName || newName === currentName) return;
  try {
    await apiFetch(`/cpt/${postTypeSlug}/categories/${catId}`, { method: 'PUT', body: JSON.stringify({ name: newName }) });
    showToast('Catégorie mise à jour', 'success');
    loadSection(`cpt-categories:${postTypeSlug}`);
  } catch (error) {
    showToast(error.message || 'Erreur', 'error');
  }
}

async function deleteCPTCategory(postTypeSlug, catId, name) {
  if (!confirm(`Supprimer la catégorie "${name}" ?`)) return;
  try {
    await apiFetch(`/cpt/${postTypeSlug}/categories/${catId}`, { method: 'DELETE' });
    showToast('Catégorie supprimée', 'success');
    loadSection(`cpt-categories:${postTypeSlug}`);
  } catch {
    showToast('Erreur lors de la suppression', 'error');
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
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ align: [] }],
        ['link'],
        ['clean']
      ]
    }
  });
  if (hiddenInput.value) _cptOptionsQuill.root.innerHTML = hiddenInput.value;
  _cptOptionsQuill.on('text-change', () => {
    hiddenInput.value = _cptOptionsQuill.root.innerHTML;
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
    .then(([folders, items]) => {
      mediaPickerState.folders = folders;
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

let pageBuilderState = { editingPageId: null, blocks: [], meta: { title: '', slug: '', status: 'draft', show_in_menu: true, menu_order: 0, parent_id: null } };
let selectedBlockId = null;
let reusableBlocBuilderMode = false;
let _inlineEditingBlockId = null;
let _inlineEditingFieldName = null;
let _inlineEditingDataRef = null;  // direct ref to the data object (block.data or sub-module data)
let _inlineEditingElement = null;  // the .txt.editor DOM element being edited
let moduleFieldSchema = null;
const moduleTemplateCache = {};
const moduleTemplatePromises = {};
const moduleStylesLoaded = new Set();
let baseStylesLoaded = false;
let mediaState = { folders: [], items: [], currentFolderId: null, selectedIds: [], search: '' };
let mediaPickerState = { isOpen: false, blockId: null, fieldName: null, type: 'all', folderId: null, folders: [], items: [], search: '' };
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
  } catch (e) {
    siteSettingsCache = {};
  }
  return siteSettingsCache;
}

async function loadModuleFieldSchema() {
  if (moduleFieldSchema) return moduleFieldSchema;
  try {
    moduleFieldSchema = await apiFetch('/module-fields');
  } catch (e) {
    moduleFieldSchema = { modules: {} };
  }
  return moduleFieldSchema;
}

function blockId() {
  return 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
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
  pageBuilderState.editingPageId = pageId;
  pageBuilderState.blocks = [];
  pageBuilderState.meta = { title: '', slug: '', status: 'draft', show_in_menu: true, menu_order: 0, parent_id: null };
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
  const pages = await apiFetch('/pages').catch(() => []);
  pageBuilderState._allPages = pages || [];

  return `
    <div class="page-builder">
      <header class="builder-header">
        <button type="button" class="btn btn-danger" onclick="loadSection('pages')">← Retour</button>
        <div class="builder-meta">
          <div class="builder-field-group">
            <label class="builder-field-label">Titre</label>
            <input type="text" class="form-input builder-title" placeholder="Titre de la page" value="${escapeHtml(m.title)}" data-field="title">
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
            </select>
          </div>
        </div>
        <div class="builder-actions">
          <button type="button" class="btn btn-primary" onclick="savePageBuilder()">Enregistrer</button>
          <a href="${(siteSettingsCache?.frontend_url || 'http://localhost:4321')}/pages/${encodeURIComponent(m.slug)}" target="_blank" class="btn btn-outline" id="viewPageBtn">Voir la page</a>
        </div>
      </header>
      <div class="builder-body">
        <aside class="builder-sidebar">
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
            <button type="button" class="btn btn-sm btn-outline builder-menu-settings-btn" onclick="toggleMenuSettingsPanel(true)" style="${m.status === 'draft' ? 'display:none' : ''}">⚙ Paramètres menu</button>
            <h3>Modules</h3>
            <p class="form-help">Glissez un module dans la zone de droite.</p>
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
          </div>
          <div class="builder-settings" id="builderSettings" style="${selectedBlockId ? '' : 'display:none'}">
            ${renderBuilderSettingsPanel()}
          </div>
        </aside>
        <main class="builder-canvas" id="builderCanvas" data-drop-zone="true">
          <div class="builder-canvas-inner">
            <div class="builder-canvas-placeholder" id="builderPlaceholder">Glissez des modules ici ou cliquez sur un module à gauche pour l'ajouter.</div>
            <div class="builder-blocks" id="builderBlocks">
              ${pageBuilderState.blocks.map(block => renderBlockCard(block)).join('')}
            </div>
          </div>
        </main>
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

function renderBlockCard(block) {
  const def = BLOCK_TYPES[block.type] || { label: block.type, icon: '▦' };
  const blockIndex = pageBuilderState.blocks.indexOf(block);
  const blockNum = blockIndex >= 0 ? blockIndex + 1 : '';
  const isHidden = block.data?.is_visible === 'no';
  const hiddenIcon = isHidden
    ? '<svg class="builder-block-hidden-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '';
  const richPreview = renderBlockPreviewHtml(block);
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
      ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" class="preview-hero-bg" alt="">` : '<div class="preview-hero-bg-placeholder"></div>'}
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
      ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" class="preview-hero-bloc-img" alt="">` : ''}
      ${bloc.title ? `<p class="preview-hero-bloc-title">${escapeHtml(bloc.title)}</p>` : ''}
    </div>`;
  });
  return `<div class="preview-hero-list">${parts.join('')}</div>`;
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
      const subLayout = moduleFieldSchema?.modules?.[subModuleName]?.layout || null;
      if (subLayout) ensureSubModuleTemplates(subLayout);
      // Create a fake block and recursively render the sub-module preview
      const subBlock = { id: 'sub-' + Math.random().toString(36).slice(2), type: layout, data: subModule };
      return `<div class="module-in-column">${renderBlockPreviewHtml(subBlock)}</div>`;
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
  const site = siteSettingsCache || {};
  const COLOR_VALUES = {
    'has-background-primary': site.primary_color || 'var(--color-primary, #006a9b)',
    'has-background-secondary': site.secondary_color || 'var(--color-secondary, #ea644e)',
    'has-background-tertiary': site.tertiary_color || 'var(--color-tertiary, #d6d6d6)',
  };
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
  if (LEGACY_BLOCK_TYPES[block.type]) {
    if (block.type === 'heading') return `<div class="preview-heading">${escapeHtml(d.text || '')}</div>`;
    if (block.type === 'text') return `<div class="preview-title">${escapeHtml(d.title || '')}</div><div class="preview-text">${escapeHtml(d.body || '')}</div>`;
    if (block.type === 'hero') return `<div class="preview-hero"><div class="preview-title">${escapeHtml(d.title || '')}</div><div class="preview-text">${escapeHtml(d.subtitle || '')}</div></div>`;
    if (block.type === 'cta') return `<div class="preview-cta"><div class="preview-title">${escapeHtml(d.title || '')}</div><div class="preview-text">${escapeHtml(d.description || '')}</div></div>`;
    if (block.type === 'image') return d.src ? `<img class="preview-image" src="${escapeHtml(d.src)}" alt="${escapeHtml(d.alt || '')}">` : '';
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
      let inner = `<div class="illus-wrapper"><img src="${escapeHtml(imgUrl)}" alt="" class="${imgCls}"></div>`;
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
  const layout = getModuleLayout(block);
  if (!layout) return '';
  const cached = moduleTemplateCache[layout];
  if (!cached) {
    queueModuleTemplateLoad(layout);
    return `<div class="preview-loading">Chargement du rendu…</div>`;
  }
  const ctx = buildTemplateContext(block);
  let html = renderBladeTemplate(cached.template, ctx);
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

function getModuleLayout(block) {
  const def = BLOCK_TYPES[block.type] || {};
  const moduleName = def.moduleName || block.type;
  return moduleFieldSchema?.modules?.[moduleName]?.layout || null;
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
    .catch(() => {})
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
  const moduleName = def.moduleName || block.type;
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
    const ratioMap = { 'full-height': 'full-height', landscape: 'banner', portrait: 'portrait', square: 'square-large' };
    ctx.ratioImg = ratioMap[ratio] || 'background-module';
    ctx.link_align = data.link_align || moduleData.link_align || '';
    ctx.link_style = data.link_style || moduleData.link_style || '';
    if (ratio) extraClasses.push(ratio);
    const imgParallax = data.img_parallax === true || data.img_parallax === 1 || data.img_parallax === '1';
    const mediaChoice = data.media_choice === true || data.media_choice === 1 || data.media_choice === '1';
    if (imgParallax && mediaChoice) extraClasses.push('img-parallax');
    // Normalize media_choice to numeric 1/0 so Blade @if ($module['media_choice'] == 1) works
    // (PHP loose comparison: true == 1 is true, but JS String(true) !== '1')
    ctx.module = { ...ctx.module, media_choice: mediaChoice ? 1 : 0 };
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
  const title = item.title || '';
  const catchphrase = item.catchphrase || '';
  const primaryLink = item.primary_link || {};
  const secondaryLink = item.secondary_link || {};
  const hasDescription = !!(title || catchphrase || (!clickableBlock && (primaryLink.url || secondaryLink.url)));
  const descClass = hasDescription ? 'has-desc' : 'no-desc';
  const orientClass = !orientation ? ' landscape' : '';

  let mediaHtml = '';
  if (isVid && fileUrl) {
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
  const equalityMatch = expr.match(/(.+?)(===|!==|==|!=|>=|<=|>|<)\s*(['"].*?['"]|\$[\w\[\]'".->]+|\d+)/);

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
    const right = resolveValue(equalityMatch[3], ctx);
    const op = equalityMatch[2];
    if (op === '==' || op === '===') result = String(left) === String(right);
    else if (op === '!=' || op === '!==') result = String(left) !== String(right);
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
    const url = resolveValue(bgMatch[1], ctx);
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
  if (!canvas || !blocksEl) return;

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
  if (blocksEl) {
    blocksEl.addEventListener('dragover', handleBuilderDragover);
    blocksEl.addEventListener('drop', handleBuilderDrop);
  }
  if (placeholder) {
    placeholder.addEventListener('dragover', handleBuilderDragover);
    placeholder.addEventListener('drop', handleBuilderDrop);
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
  pageBuilderState.meta.title = get('.builder-title') || get('input[data-field="title"]') || '';
  pageBuilderState.meta.slug = get('.builder-slug') || get('input[data-field="slug"]') || '';
  pageBuilderState.meta.status = get('.builder-status') || get('select[data-field="status"]') || 'draft';

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
          ${locLabel ? `<span class="menu-toggle-loc">${locLabel}</span>` : ''}
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

function onBuilderStatusChange(status) {
  const btn = document.querySelector('.builder-menu-settings-btn');
  if (btn) {
    btn.style.display = status === 'draft' ? 'none' : '';
  }
  // If switching to draft, close the menu settings panel
  if (status === 'draft') {
    toggleMenuSettingsPanel(false);
  }
}

function updateBuilderPlaceholder() {
  const ph = document.getElementById('builderPlaceholder');
  if (ph) ph.style.display = pageBuilderState.blocks.length === 0 ? 'block' : 'none';
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

function rebuildBuilderBlocksDOM() {
  const blocksEl = document.getElementById('builderBlocks');
  if (!blocksEl) return;
  blocksEl.innerHTML = pageBuilderState.blocks.map(block => renderBlockCard(block)).join('');
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
          rebuildBuilderBlocksDOM();
          selectBlock(newBlock.id);
        } else if (payload.type === 'move' && payload.blockId && payload.blockId !== targetId) {
          const fromIdx = pageBuilderState.blocks.findIndex(b => b.id === payload.blockId);
          const toIdx = pageBuilderState.blocks.findIndex(b => b.id === targetId);
          if (fromIdx < 0 || toIdx < 0) return;
          const [moved] = pageBuilderState.blocks.splice(fromIdx, 1);
          const newToIdx = pageBuilderState.blocks.findIndex(b => b.id === targetId);
          pageBuilderState.blocks.splice(position === 'before' ? newToIdx : newToIdx + 1, 0, moved);
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
  updateSelectedBlockCard();
}

function addBlockByClick(blockType) {
  if (!BLOCK_TYPES[blockType]) return;
  const def = BLOCK_TYPES[blockType];
  const block = { id: blockId(), type: blockType, data: { ...def.defaultData } };
  pageBuilderState.blocks.push(block);
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
  rebuildBuilderBlocksDOM();
  selectBlock(copy.id);
  const newCard = document.querySelector(`.builder-block-card[data-block-id="${copy.id}"]`);
  if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function removeBlock(id) {
  pageBuilderState.blocks = pageBuilderState.blocks.filter(b => b.id !== id);
  rebuildBuilderBlocksDOM();
  if (selectedBlockId === id) {
    selectedBlockId = null;
    renderBlockSettings();
  }
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
  // Show settings, hide modules list
  const modulesPanel = document.getElementById('builderModulesPanel');
  const settingsPanel = document.getElementById('builderSettings');
  if (modulesPanel) modulesPanel.style.display = 'none';
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

function renderSchemaForm(block, schemaFields) {
  const data = block.data && typeof block.data === 'object' ? block.data : {};
  const def = BLOCK_TYPES[block.type] || {};
  const moduleName = def.moduleName || block.type;
  const isInlineEditable = (moduleName === 'TextSimple' || moduleName === 'TextImage' || moduleName === 'HeadText');
  const fields = schemaFields.map(field => {
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
  }).join('');
  return `
    <form class="builder-block-form" onsubmit="saveSchemaData('${block.id}', event)">
      <div class="settings-fields">${fields}</div>
    </form>
  `;
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
    const site = siteSettingsCache || {};
    const COLOR_MAP = {
      'has-background-primary':   { label: 'Primaire',   color: site.primary_color   || 'var(--color-primary)'   },
      'has-background-secondary': { label: 'Secondaire', color: site.secondary_color || 'var(--color-secondary)' },
      'has-background-tertiary':  { label: 'Tertiaire',  color: site.tertiary_color  || 'var(--color-tertiary)'  },
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
    const pickerType = type === 'File' ? 'all' : (type === 'Video' ? 'video' : 'image');
    const meta = media?.original_name || media?.name || url || 'Aucun média sélectionné';
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <div class="media-field" data-field="${escapeHtml(inputName)}">
          <div class="media-preview">
            ${url ? (isVideo ? `<div class="media-preview-icon">🎬</div>` : `<img src="${escapeHtml(url)}" alt="${escapeHtml(meta)}">`) : ''}
          </div>
          <div class="media-preview-meta">${escapeHtml(meta)}</div>
          <input type="hidden" name="${escapeHtml(inputName)}"${rfieldAttr} value="${escapeHtml(media ? JSON.stringify(media) : '')}">
          <div class="media-field-actions">
            <button type="button" class="btn btn-sm btn-outline" onclick="openMediaPicker('${pickerType}', '${blockId}', '${escapeHtml(inputName)}')">Choisir</button>
            <button type="button" class="btn btn-sm btn-outline" onclick="clearMediaSelection('${blockId}', '${escapeHtml(inputName)}')">Retirer</button>
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
  if (type === 'Repeater') {
    return renderRepeaterFieldHTML(field, value, blockId);
  }
  if (type === 'FlexibleContent') {
    return renderFlexibleContentFieldHTML(field, value, blockId, rowCtx);
  }
  if (type === 'Group') {
    return renderGroupFieldHTML(field, value, blockId);
  }
  return `
    <div class="form-group">
      <label class="form-label">${escapeHtml(label)}</label>
      <input type="text" class="form-input" name="${escapeHtml(inputName)}"${rfieldAttr} value="${safeValue}">
    </div>
  `;
}

// ── Repeater UI ──────────────────────────────────────────────────────────────

function renderRepeaterFieldHTML(field, value, blockId) {
  const rows = Array.isArray(value) ? value : [];
  const subFields = field.subFields || [];
  const rowsHtml = rows.map((rowData, i) =>
    renderRepeaterRowHTML(subFields, rowData, i, blockId, field.name)
  ).join('');
  return `
    <div class="form-group">
      <label class="form-label">${escapeHtml(field.label || field.name)}</label>
      <div class="repeater-field" data-field-name="${escapeHtml(field.name)}" data-block-id="${escapeHtml(blockId)}">
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

function renderGroupFieldHTML(field, value, blockId) {
  const subFields = field.subFields || [];
  const groupData = (value && typeof value === 'object') ? value : {};
  const rowCtx = { parentName: field.name, rowIndex: null };
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

  // Build the module type dropdown — exclude ColumnsTab to prevent infinite nesting
  const excludeTypes = new Set(['columns-tab', 'ColumnsTab']);
  const dropdownOptions = Object.entries(BLOCK_TYPES)
    .filter(([key, def]) => !def.aliasFor && !excludeTypes.has(key))
    .map(([key, def]) => `<option value="${escapeHtml(key)}">${escapeHtml(def.label || key)}</option>`)
    .join('');

  return `
    <div class="form-group">
      <label class="form-label">${escapeHtml(field.label || field.name)}</label>
      <div class="flexible-content-field" data-field-name="${escapeHtml(fcCompoundName)}" data-block-id="${escapeHtml(blockId)}">
        <div class="flexible-content-items">${itemsHtml}</div>
        <div class="flexible-content-add" style="display:flex;gap:8px;margin-top:8px;">
          <select class="form-select flexible-content-type-select" style="flex:1;">
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
  const moduleName = def.moduleName || layout;
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
    const moduleName = def.moduleName || layout;
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

function _getRepeaterSchema(blockId, fieldName) {
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (!block) return null;
  const def = BLOCK_TYPES[block.type] || {};
  const moduleName = def.moduleName || block.type;
  const schemaFields = moduleFieldSchema?.modules?.[moduleName]?.fields || [];
  return schemaFields.find(f => f.name === fieldName && f.type === 'Repeater') || null;
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
    } else if (f.type === 'FlexibleContent') {
      const form = scope.closest('form') || scope;
      rowData[f.name] = collectFlexibleContentData(form, compoundName);
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
  // Use :scope > .repeater-rows > .repeater-row to avoid selecting nested
  // FlexibleContent items that also have the .repeater-row class.
  const rows = container.querySelectorAll(':scope > .repeater-rows > .repeater-row');
  return Array.from(rows).map((row, rowIndex) =>
    collectContainerData(row, repeaterName, subFields, rowIndex)
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
  const repeaterField = _getRepeaterSchema(blockId, fieldName);
  if (!repeaterField?.subFields) return;
  const form = container.closest('form');
  const existingData = form ? collectRepeaterData(form, fieldName, repeaterField.subFields) : [];
  // Initialize new row: default TrueFalse sub-fields to true so image/visibility fields start ON
  const newRowDefaults = {};
  for (const f of repeaterField.subFields) {
    if (f.type === 'TrueFalse') newRowDefaults[f.name] = true;
  }
  existingData.push(newRowDefaults);
  reRenderRepeaterRows(container, repeaterField.subFields, existingData, blockId, fieldName);
  // Sync data to block.data immediately so it's never stale
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (block) {
    if (!block.data || typeof block.data !== 'object') block.data = {};
    block.data[fieldName] = existingData;
    updateBlockCardPreview(blockId);
  }
  // Expand the last row
  const rows = container.querySelectorAll(':scope > .repeater-rows > .repeater-row');
  const lastRow = rows[rows.length - 1];
  if (lastRow) {
    const body = lastRow.querySelector('.repeater-row-body');
    if (body) body.style.display = '';
    lastRow.classList.add('is-open');
  }
  if (form) updateSchemaConditionals(form);
}

function removeRepeaterRow(button) {
  const row = button.closest('.repeater-row');
  const container = row?.closest('.repeater-field');
  if (!container) return;
  const blockId = container.dataset.blockId;
  const fieldName = container.dataset.fieldName;
  const repeaterField = _getRepeaterSchema(blockId, fieldName);
  if (!repeaterField?.subFields) return;
  const form = container.closest('form');
  const allData = form ? collectRepeaterData(form, fieldName, repeaterField.subFields) : [];
  const rowIndex = parseInt(row.dataset.rowIndex, 10);
  allData.splice(rowIndex, 1);
  reRenderRepeaterRows(container, repeaterField.subFields, allData, blockId, fieldName);
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (block) {
    if (!block.data || typeof block.data !== 'object') block.data = {};
    block.data[fieldName] = allData;
    updateBlockCardPreview(blockId);
  }
}

function moveRepeaterRow(button, direction) {
  const row = button.closest('.repeater-row');
  const container = row?.closest('.repeater-field');
  if (!container) return;
  const blockId = container.dataset.blockId;
  const fieldName = container.dataset.fieldName;
  const repeaterField = _getRepeaterSchema(blockId, fieldName);
  if (!repeaterField?.subFields) return;
  const form = container.closest('form');
  const allData = form ? collectRepeaterData(form, fieldName, repeaterField.subFields) : [];
  const rowIndex = parseInt(row.dataset.rowIndex, 10);
  const targetIndex = rowIndex + direction;
  if (targetIndex < 0 || targetIndex >= allData.length) return;
  [allData[rowIndex], allData[targetIndex]] = [allData[targetIndex], allData[rowIndex]];
  reRenderRepeaterRows(container, repeaterField.subFields, allData, blockId, fieldName);
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (block) {
    if (!block.data || typeof block.data !== 'object') block.data = {};
    block.data[fieldName] = allData;
    updateBlockCardPreview(blockId);
  }
  // Expand the moved row
  const rows = container.querySelectorAll(':scope > .repeater-rows > .repeater-row');
  const movedRow = rows[targetIndex];
  if (movedRow) {
    const body = movedRow.querySelector('.repeater-row-body');
    if (body) body.style.display = '';
  }
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

function initWysiwygEditors(container) {
  if (typeof Quill === 'undefined') return;
  container.querySelectorAll('.wysiwyg-editor').forEach(el => {
    if (_quillInstances.has(el.id)) return;
    const textarea = el.parentElement.querySelector('.wysiwyg-source');
    const quill = new Quill(el, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['blockquote'],
          [{ align: [] }],
          ['link'],
          ['clean']
        ]
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
    _quillInstances.set(el.id, quill);
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
  const site = siteSettingsCache || {};
  const COLOR_MAP = {
    'has-background-primary': site.primary_color || 'var(--color-primary, #006a9b)',
    'has-background-secondary': site.secondary_color || 'var(--color-secondary, #ea644e)',
    'has-background-tertiary': site.tertiary_color || 'var(--color-tertiary, #d6d6d6)',
  };
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
  try { rich = renderBlockPreviewHtml(block); } catch (e) { console.warn('Preview render error:', e); }
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

function _createInlineToolbar() {
  if (_inlineToolbar) return _inlineToolbar;
  const bar = document.createElement('div');
  bar.className = 'inline-toolbar';
  bar.innerHTML = `
    <select class="inline-toolbar-select" data-action="formatBlock" title="Style">
      <option value="p">Normal</option>
      <option value="h1">Titre 1</option>
      <option value="h2">Titre 2</option>
      <option value="h3">Titre 3</option>
    </select>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="bold" title="Gras (Ctrl+B)"><b>B</b></button>
    <button type="button" data-cmd="italic" title="Italique (Ctrl+I)"><i>I</i></button>
    <button type="button" data-cmd="underline" title="Souligné (Ctrl+U)"><u>U</u></button>
    <button type="button" data-cmd="strikeThrough" title="Barré"><s>S</s></button>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="insertOrderedList" title="Liste numérotée"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="1" y="7" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">1</text><text x="1" y="13" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">2</text><text x="1" y="19" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">3</text></svg></button>
    <button type="button" data-cmd="insertUnorderedList" title="Liste à puces"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="2" fill="currentColor"/><circle cx="4" cy="12" r="2" fill="currentColor"/><circle cx="4" cy="18" r="2" fill="currentColor"/></svg></button>
    <button type="button" data-cmd="formatBlock" data-value="blockquote" title="Citation"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg></button>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="justifyLeft" title="Aligner à gauche"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg></button>
    <button type="button" data-cmd="justifyCenter" title="Centrer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg></button>
    <button type="button" data-cmd="justifyRight" title="Aligner à droite"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg></button>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="createLink" title="Lien"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>
    <button type="button" data-cmd="removeFormat" title="Supprimer le formatage"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16"/><path d="M10 4v3"/><path d="M8 21l4-14"/><path d="M3 21h6"/><line x1="18" y1="5" x2="22" y2="9" stroke="currentColor" stroke-width="2"/><line x1="22" y1="5" x2="18" y2="9" stroke="currentColor" stroke-width="2"/></svg></button>
  `;
  bar.style.display = 'none';
  document.body.appendChild(bar);

  // Handle button clicks
  bar.addEventListener('mousedown', (e) => {
    // Let the <select> dropdown work normally (don't preventDefault)
    if (e.target.closest('select')) return;
    e.preventDefault(); // Prevent blur on the contenteditable
    const btn = e.target.closest('button[data-cmd]');
    if (btn) {
      const cmd = btn.dataset.cmd;
      if (cmd === 'createLink') {
        const url = prompt('URL du lien :', 'https://');
        if (url) document.execCommand('createLink', false, url);
      } else if (cmd === 'formatBlock') {
        document.execCommand('formatBlock', false, btn.dataset.value);
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
    select.value = ['h1', 'h2', 'h3'].includes(blockTag) ? blockTag : 'p';
  }
}

/**
 * Enable inline editing on a .txt.editor element.
 * @param {string} blockId - the top-level block id (or parent ColumnsTab block id)
 * @param {HTMLElement} [targetTxtEditor] - optional: the specific .txt.editor element (for sub-modules in columns)
 * @param {object} [dataRef] - optional: direct reference to the sub-module data object
 */
function enableInlineEditing(blockId, targetTxtEditor, dataRef) {
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
  _inlineEditingFieldName = 'text';
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
  document.addEventListener('selectionchange', _updateToolbarState);
}

function disableInlineEditing() {
  if (!_inlineEditingBlockId) return;

  if (_inlineEditingElement) {
    _syncInlineContentToBlockData(_inlineEditingElement);
    _inlineEditingElement.removeAttribute('contenteditable');
    _inlineEditingElement.removeEventListener('input', _handleInlineInput);
    _inlineEditingElement.removeEventListener('blur', _handleInlineBlur);
    _inlineEditingElement.removeEventListener('keydown', _handleInlineKeydown);
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
  const { title, slug, status, parent_id } = pageBuilderState.meta;
  if (!title || !slug) { showToast('Titre et slug requis', 'error'); return; }

  // Derive show_in_menu from menu toggles
  const assignments = getPageMenuAssignments();
  const show_in_menu = assignments.length > 0;

  const content = JSON.stringify(pageBuilderState.blocks);
  showLoading();
  try {
    if (pageBuilderState.editingPageId) {
      await apiFetch(`/pages/${pageBuilderState.editingPageId}`, { method: 'PUT', body: JSON.stringify({ title, slug, content, status, show_in_menu, menu_order: 0, parent_id: parent_id || null }) });
      showToast('Page mise à jour', 'success');
    } else {
      const res = await apiFetch('/pages', { method: 'POST', body: JSON.stringify({ title, slug, content, status, show_in_menu, menu_order: 0, parent_id: parent_id || null }) });
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
    if (viewBtn) viewBtn.href = `${siteSettingsCache?.frontend_url || 'http://localhost:4321'}/pages/${encodeURIComponent(slug)}`;
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

let _pagesMenuInfo = {}; // { pageId: { menus: [{id,name,location}], primaryParent: {title,page_id}|null } }

async function renderPages() {
  showLoading();
  try {
    const [pages, menuInfo] = await Promise.all([
      apiFetch('/pages'),
      apiFetch('/pages/menu-info'),
    ]);
    _pagesCache = pages;
    _pagesMenuInfo = menuInfo || {};
    _pagesSearch = '';
    _pagesCurrentPage = 1;
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

function renderPagesView() {
  const filtered = getFilteredPages();
  const sorted = sortPagesHierarchically(filtered);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGES_PER_PAGE));
  if (_pagesCurrentPage > totalPages) _pagesCurrentPage = totalPages;
  const start = (_pagesCurrentPage - 1) * PAGES_PER_PAGE;
  const paginated = sorted.slice(start, start + PAGES_PER_PAGE);

  return `
    <div class="page-header">
      <h1>Pages</h1>
      <button class="btn btn-primary" onclick="openPageBuilder(null)">
        <span class="icon">➕</span>
        Nouvelle page
      </button>
    </div>

    <div class="card">
      <div class="pages-toolbar">
        <div class="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="form-input pages-search-input" placeholder="Rechercher une page…" value="${escapeHtml(_pagesSearch)}" oninput="handlePagesSearch(this.value)">
          ${_pagesSearch ? '<button type="button" class="search-clear" onclick="handlePagesSearch(\'\')">✕</button>' : ''}
        </div>
        <span class="pages-count">${sorted.length} page${sorted.length > 1 ? 's' : ''}${_pagesSearch ? ` trouvée${sorted.length > 1 ? 's' : ''}` : ''}</span>
      </div>
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
          <div class="builder-canvas-inner">
            <div class="builder-canvas-placeholder" id="builderPlaceholder">Glissez des modules ici ou cliquez sur un module à gauche pour l'ajouter.</div>
            <div class="builder-blocks" id="builderBlocks">
              ${pageBuilderState.blocks.map(block => renderBlockCard(block)).join('')}
            </div>
          </div>
        </main>
      </div>
    </div>
  `;
}

function closeReusableBlocBuilder() {
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
async function fetchMediaFolders() {
  try {
    mediaState.folders = await apiFetch('/media/folders');
  } catch (e) {
    mediaState.folders = [];
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
          <input type="file" multiple accept="image/*,video/*" onchange="handleMediaUpload(event)" />
          Importer
        </label>
        <button class="btn btn-outline" onclick="createMediaFolder()">+ Dossier</button>
        ${currentFolder ? `<button class="btn btn-danger" onclick="deleteMediaFolder(${currentFolder})">Supprimer le dossier</button>` : ''}
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
        <button class="media-folder-item media-folder-all ${currentFolder === null ? 'is-active' : ''}" onclick="selectMediaFolder(null)">
          📁 Tous les médias
        </button>
        <h3>Dossiers</h3>
        <div class="media-folder-list">
          ${folders.map(folder => `
            <button class="media-folder-item ${String(folder.id) === String(currentFolder) ? 'is-active' : ''}" onclick="selectMediaFolder(${folder.id ?? 'null'})">
              📁 ${escapeHtml(folder.name)}
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
  const isSelected = forPicker && mediaPickerState.multiple && Array.isArray(mediaPickerState.selectedIds)
    ? mediaPickerState.selectedIds.includes(String(item.id))
    : (!forPicker && Array.isArray(mediaState.selectedIds) && mediaState.selectedIds.includes(String(item.id)));
  const thumb = isImage
    ? `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.original_name)}">`
    : `<video src="${escapeHtml(item.url)}#t=0.5" preload="metadata" muted></video>`;
  const meta = `${isImage ? 'Image' : 'Vidéo'} · ${formatBytes(item.size)}`;
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
    <article class="media-card ${forPicker ? 'is-picker' : ''} ${isSelected ? 'is-selected' : ''}" onclick="${forPicker ? `selectMediaFromPicker(${item.id})` : ''}">
      ${!forPicker ? `
        <label class="media-select" onclick="event.stopPropagation()">
          <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleMediaSelection(${item.id}, this.checked); event.stopPropagation();" />
        </label>
      ` : ''}
      <div class="media-thumb ${isImage ? '' : 'is-video'}">${thumb}</div>
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
  files.forEach(file => formData.append('files', file));
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
          <label class="btn btn-primary btn-sm" style="cursor:pointer;margin:0">
            Importer
            <input type="file" multiple accept="image/*,video/*" onchange="handleMediaPickerUpload(event)" style="display:none">
          </label>
          <button class="btn btn-outline btn-sm" onclick="closeMediaPicker()">Fermer</button>
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
    mediaPickerState.folders = await apiFetch('/media/folders');
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
  mediaPickerState = {
    isOpen: true,
    blockId,
    fieldName,
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
    mediaPickerState.folders = await apiFetch('/media/folders');
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
  files.forEach(file => formData.append('files', file));
  if (mediaPickerState.folderId) formData.append('folder_id', mediaPickerState.folderId);
  showLoading();
  try {
    await apiUpload('/media/upload', formData);
    showToast('Médias importés', 'success');
    mediaPickerState.items = await apiFetch(`/media?${mediaPickerState.folderId === null ? 'all=1' : 'folder_id=' + mediaPickerState.folderId}`);
    updateMediaPickerContent();
  } catch (e) {
    showToast(e.message || "Erreur lors de l'import", 'error');
  } finally {
    hideLoading();
    event.target.value = '';
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
      📁 Tous les médias
    </button>
    <h3 style="margin:8px 0 4px;font-size:13px;font-weight:600;color:var(--gray-600)">Dossiers</h3>
  ` + mediaPickerState.folders.map(folder => `
    <button class="media-folder-item ${String(folder.id) === String(mediaPickerState.folderId) ? 'is-active' : ''}" onclick="selectMediaPickerFolder(${folder.id ?? 'null'})">
      📁 ${escapeHtml(folder.name)}
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
      field.querySelector('.settings-media-preview').innerHTML = `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.original_name || '')}">`;
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
    const payload = { id: item.id, url: item.url, alt: item.original_name || '', sizes: { thumbnail: item.url, half: item.url, banner: item.url } };
    document.getElementById('cptFeaturedInput').value = JSON.stringify(payload);
    document.getElementById('cptFeaturedPreview').innerHTML = `<img src="${escapeHtml(item.url)}" style="max-width:200px;max-height:150px;object-fit:cover;border-radius:8px;">`;
    closeMediaPicker();
    return;
  }

  // CPT Options image picker (header_img)
  if (mediaPickerState.blockId === '__cpt_options_img__') {
    const input = document.getElementById('cptOptionsImgInput');
    const preview = document.getElementById('cptOptionsImgPreview');
    if (input) input.value = item.url;
    if (preview) preview.innerHTML = `<img src="${escapeHtml(item.url)}" style="max-width:100%;max-height:200px;object-fit:cover;border-radius:8px;">`;
    closeMediaPicker();
    return;
  }

  applyMediaSelection(mediaPickerState.blockId, mediaPickerState.fieldName, item);
  closeMediaPicker();
}

/** Update block.data for a (possibly compound) field name, handling repeater/group nesting. */
function setBlockDataField(block, fieldName, value) {
  if (!block || !block.data || typeof block.data !== 'object') return;
  if (fieldName.includes('::')) {
    const parts = fieldName.split('::');
    if (parts.length === 3) {
      // Repeater: repeaterName::rowIndex::subFieldName
      const [repeaterName, rowIndexStr, subFieldName] = parts;
      const rowIndex = parseInt(rowIndexStr, 10);
      if (Array.isArray(block.data[repeaterName]) && !isNaN(rowIndex) && block.data[repeaterName][rowIndex]) {
        const rows = block.data[repeaterName].map((r, i) =>
          i === rowIndex ? { ...r, [subFieldName]: value } : r
        );
        block.data = { ...block.data, [repeaterName]: rows };
      }
    } else if (parts.length === 2) {
      // Group: groupName::subFieldName
      const [groupName, subFieldName] = parts;
      if (block.data[groupName] && typeof block.data[groupName] === 'object') {
        block.data = { ...block.data, [groupName]: { ...block.data[groupName], [subFieldName]: value } };
      }
    }
  } else {
    block.data = { ...block.data, [fieldName]: value };
  }
}

function applyMediaSelection(blockId, fieldName, item) {
  const panel = document.getElementById('builderSettings');
  if (!panel) return;
  const input = panel.querySelector(`input[name="${CSS.escape(fieldName)}"]`);
  if (!input) return;
  const payload = {
    id: item.id,
    url: item.url,
    type: item.type,
    original_name: item.original_name,
    mime_type: item.mime_type,
    size: item.size
  };
  input.value = JSON.stringify(payload);
  const wrapper = input.closest('.media-field');
  if (wrapper) {
    const preview = wrapper.querySelector('.media-preview');
    if (preview) {
      preview.innerHTML = item.type === 'image'
        ? `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.original_name)}">`
        : `<div class="media-preview-icon">🎬</div>`;
    }
    const meta = wrapper.querySelector('.media-preview-meta');
    if (meta) meta.textContent = item.original_name || item.url;
  }
  // Synchroniser avec les données du bloc pour la sauvegarde et la prévisualisation
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  setBlockDataField(block, fieldName, payload);
  updateBlockCardPreview(blockId);
  // Mettre à jour les champs conditionnels (ex: bg_opacity/bg_parallax dépendent de bg_img)
  const form = document.querySelector('#builderSettings form');
  if (form) updateSchemaConditionals(form);
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

  // CPT Photos gallery picker
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

  applyMediaSelectionMultiple(mediaPickerState.blockId, mediaPickerState.fieldName, items);
  closeMediaPicker();
}

function applyMediaSelectionMultiple(blockId, fieldName, items) {
  const panel = document.getElementById('builderSettings');
  if (!panel) return;
  const input = panel.querySelector(`input[name="${CSS.escape(fieldName)}"]`);
  if (!input) return;
  const payloadItems = items.map(item => ({
    id: item.id,
    url: item.url,
    type: item.type,
    original_name: item.original_name,
    mime_type: item.mime_type,
    size: item.size
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
          <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.original_name || item.url)}">
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
  updateBlockCardPreview(blockId);
}

function clearMediaSelection(blockId, fieldName) {
  const panel = document.getElementById('builderSettings');
  if (!panel) return;
  const input = panel.querySelector(`input[name="${CSS.escape(fieldName)}"]`);
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
  updateBlockCardPreview(blockId);
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
  if (!btn) return;
  const count = Array.isArray(mediaState.selectedIds) ? mediaState.selectedIds.length : 0;
  btn.disabled = count === 0;
  btn.textContent = `Supprimer la sélection (${count})`;
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

function renderPagesTable(pages) {
  return `
    <div class="pages-list">
      <div class="pages-list-header">
        <span class="page-item__info">Page</span>
        <span class="page-item__parent">Parent</span>
        <span class="page-item__meta">Modifié</span>
        <span class="page-item__badges">Statut</span>
        <span class="page-item__actions" style="opacity:1">Actions</span>
      </div>
      ${pages.map(page => {
        const primaryParent = getPagePrimaryParent(page.id);
        const isChild = !!primaryParent;
        const parentHtml = primaryParent ? '<div class="page-item__parent"><span class="page-item__parent-tag">' + escapeHtml(primaryParent.title) + '</span></div>' : '<div class="page-item__parent"></div>';
        const safeTitle = page.title.replace(/'/g, "\\'");
        return '<div class="page-item ' + (isChild ? 'page-item--child' : '') + '">'
          + '<div class="page-item__info">'
          +   '<div class="page-item__title">'
          +     (isChild ? '<span class="page-item__child-icon">↳</span>' : '') + escapeHtml(page.title)
          +   '</div>'
          +   '<div class="page-item__slug">/' + escapeHtml(page.slug) + '</div>'
          + '</div>'
          + parentHtml
          + '<div class="page-item__meta">'
          +   (page.author?.name ? '<span class="page-item__author">' + escapeHtml(page.author.name) + '</span>' : '')
          +   '<span class="page-item__date">' + new Date(page.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) + '</span>'
          + '</div>'
          + '<div class="page-item__badges">'
          +   renderPageMenuBadges(page.id)
          +   '<span class="badge ' + (page.status === 'published' ? 'badge-success' : 'badge-warning') + '">'
          +     (page.status === 'published' ? 'Publié' : 'Brouillon')
          +   '</span>'
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
              <select class="form-select" name="status" required>
                <option value="draft" ${page?.status === 'draft' ? 'selected' : ''}>Brouillon</option>
                <option value="published" ${page?.status === 'published' ? 'selected' : ''}>Publié</option>
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

  const data = {
    title: formData.get('title'),
    slug: formData.get('slug'),
    content: formData.get('content'),
    status: formData.get('status'),
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
    const floatingBtnImg = settings.floating_btn_img || '';

    // Maintenance
    const isMaintenance = settings.is_maintenance === '1';
    const textMaintenance = settings.text_maintenance || '';
    const showInfos = settings.show_infos === '1';
    const showRs = settings.show_rs === '1';

    // Tracking
    const gaCode = settings.ga_code || '';
    const awCode = settings.aw_code || '';
    const gtmCode = settings.gtm_code || '';
    const metaPixelCode = settings.meta_pixel_code || '';

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
          <button type="button" class="settings-tab" data-target="#settings-tracking">Tracking & Analytics</button>
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
              <textarea class="form-textarea" name="site_description" rows="2" placeholder="Slogan ou description courte (utilisée pour le SEO, les métadonnées, etc.)">${escapeHtml(siteDescription)}</textarea>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Articles par page (blog)</label>
              <input type="number" min="1" class="form-input" name="posts_per_page" value="${escapeHtml(postsPerPage)}">
            </div>
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
            <select class="form-select" name="footer_color">
              <option value="no-background-color" ${footerColor === 'no-background-color' ? 'selected' : ''}>Aucune</option>
              <option value="has-background-primary" ${footerColor === 'has-background-primary' ? 'selected' : ''}>Couleur primaire</option>
              <option value="has-background-secondary" ${footerColor === 'has-background-secondary' ? 'selected' : ''}>Couleur secondaire</option>
              <option value="has-background-dark" ${footerColor === 'has-background-dark' ? 'selected' : ''}>Couleur textes (sombre)</option>
            </select>
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
          <div class="form-group">
            <label class="form-label">Lien du bouton</label>
            <input type="url" class="form-input" name="floating_btn_link" value="${escapeHtml(floatingBtnLink)}">
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
    floating_btn_img: formData.get('floating_btn_img') || '',
    is_maintenance: formData.get('is_maintenance') ? '1' : '0',
    text_maintenance: formData.get('text_maintenance') || '',
    show_infos: formData.get('show_infos') ? '1' : '0',
    show_rs: formData.get('show_rs') ? '1' : '0',
    ga_code: formData.get('ga_code') || '',
    aw_code: formData.get('aw_code') || '',
    gtm_code: formData.get('gtm_code') || '',
    meta_pixel_code: formData.get('meta_pixel_code') || '',
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

async function generatePostSlug(editingPostId = null) {
  const titleInput = document.getElementById('postTitle');
  const slugInput = document.getElementById('postSlug');
  const slugHelp = document.getElementById('postSlugHelp');

  if (!titleInput || !slugInput) return;

  const title = titleInput.value;
  if (!title) {
    slugInput.value = '';
    return;
  }

  let slug = slugify(title);

  // Check if slug already exists
  try {
    const posts = await apiFetch('/posts');
    const existingSlugs = posts
      .filter(p => p.id !== editingPostId)
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

async function generateCategorySlug(editingCatId = null) {
  const nameInput = document.getElementById('categoryName');
  const slugInput = document.getElementById('categorySlug');
  const slugHelp = document.getElementById('categorySlugHelp');

  if (!nameInput || !slugInput) return;

  const name = nameInput.value;
  if (!name) {
    slugInput.value = '';
    return;
  }

  let slug = slugify(name);

  // Check if slug already exists
  try {
    const categories = await apiFetch('/categories');
    const existingSlugs = categories
      .filter(c => c.id !== editingCatId)
      .map(c => c.slug);

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
  const postModal = document.getElementById('postModal');
  const categoryModal = document.getElementById('categoryModal');
  const pageModal = document.getElementById('pageModal');
  const userModal = document.getElementById('userModal');

  if (postModal) postModal.style.display = 'none';
  if (categoryModal) categoryModal.style.display = 'none';
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

function showLoading() {
  document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('show');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}

async function logout() {
  const ok = await confirmModal('Voulez-vous vraiment vous déconnecter ?');
  if (!ok) return;
  localStorage.removeItem('token');
  window.location.href = '/admin/login.html';
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

      <div id="userModal" style="display: none;"></div>
    `;
  } catch (error) {
    hideLoading();
    showToast('Erreur lors du chargement des utilisateurs', 'error');
    return '<div class="card"><p>Erreur de chargement</p></div>';
  }
}

function renderUsersTable(users) {
  const roleLabel = r => r === 'admin' ? 'Administrateur' : 'Editeur';
  const roleBadge = r => r === 'admin' ? 'badge-danger' : 'badge-warning';

  return `
    <div class="pages-list">
      <div class="pages-list-header">
        <span class="page-item__info">Utilisateur</span>
        <span class="page-item__parent">Email</span>
        <span class="page-item__meta">Créé le</span>
        <span class="page-item__badges">Rôle</span>
        <span class="page-item__actions" style="opacity:1">Actions</span>
      </div>
      ${users.map(user => {
        const safeName = escapeHtml(user.name).replace(/'/g, "\\'");
        const dateStr = new Date(user.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        return '<div class="page-item">'
          + '<div class="page-item__info" style="cursor:pointer" onclick="showUserForm(' + user.id + ')">'
          +   '<div class="page-item__title">' + escapeHtml(user.name) + (user.id === currentUser.id ? ' <span class="badge badge-info" style="font-size:10px">Vous</span>' : '') + '</div>'
          + '</div>'
          + '<div class="page-item__parent">' + escapeHtml(user.email) + '</div>'
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
            <label class="form-label">Email *</label>
            <input type="email" class="form-input" id="userEmail" value="${user?.email || ''}" required placeholder="email@exemple.com">
          </div>
          <div class="form-group">
            <label class="form-label">Role *</label>
            <select class="form-input" id="userRole">
              <option value="editor" ${!user || user.role === 'editor' ? 'selected' : ''}>Editeur</option>
              <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Administrateur</option>
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
  const email = document.getElementById('userEmail').value.trim();
  const role = document.getElementById('userRole').value;
  const password = document.getElementById('userPassword').value;

  const data = { name, email, role };
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
    const [menu, pages] = await Promise.all([
      apiFetch(`/menus/${menuId}`),
      apiFetch('/menus/pages')
    ]);
    _menuEditId = menuId;
    _menuAvailablePages = pages;
    _menuTempIdCounter = 1;

    // Convert flatItems to our working format
    _menuItems = (menu.flatItems || []).map(item => ({
      id: item.id,
      temp_id: null,
      title: item.type === 'page' && item.page_title ? item.page_title : item.title,
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
          <div class="menu-pages-list" id="menuPagesList">
            ${_menuAvailablePages.map(p => `
              <label class="menu-page-checkbox">
                <input type="checkbox" value="${p.id}" data-title="${escapeHtml(p.title)}" data-slug="${escapeHtml(p.slug)}">
                ${escapeHtml(p.title)}${p.parent_title ? ` <small>(${escapeHtml(p.parent_title)})</small>` : ''}
              </label>
            `).join('')}
          </div>
          <button class="btn btn-sm" onclick="addSelectedPages()" style="margin-top:8px">Ajouter au menu</button>
        </div>

        <!-- Add custom link -->
        <div class="menu-add-section" style="margin-top:16px">
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
        <div class="menu-add-section" style="margin-top:16px">
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

function renderMenuItemsList() {
  // Sort by menu_order
  const sorted = [..._menuItems].sort((a, b) => a.menu_order - b.menu_order);
  const roots = sorted.filter(i => !i.parent_id);
  const childrenOf = (parentId) => sorted.filter(i => {
    const pid = i.parent_id;
    return pid === parentId || (typeof pid === 'string' && typeof parentId === 'number' && parseInt(pid) === parentId);
  });

  function renderItem(item, depth = 0) {
    const itemId = item.id || item.temp_id;
    const children = childrenOf(itemId);
    const indent = depth * 24;
    const typeLabel = item.type === 'page' ? 'Page' : item.type === 'category' ? 'Catégorie' : 'Lien';

    return `
      <div class="menu-item-row" data-item-id="${itemId}" data-depth="${depth}" style="margin-left:${indent}px">
        <div class="menu-item-header">
          <span class="menu-item-drag" title="Réordonner">☰</span>
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
            <label class="form-label">Parent</label>
            <select class="form-input" onchange="updateMenuItemField('${itemId}', 'parent_id', this.value || null)">
              <option value="">— Aucun (racine) —</option>
              ${_menuItems.filter(mi => (mi.id || mi.temp_id) !== itemId).map(mi => {
                const miId = mi.id || mi.temp_id;
                const selected = item.parent_id && (item.parent_id == miId) ? 'selected' : '';
                return `<option value="${miId}" ${selected}>${escapeHtml(mi.title || '(sans titre)')}</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="menu-page-checkbox">
              <input type="checkbox" ${item.open_in_new_tab ? 'checked' : ''} onchange="updateMenuItemField('${itemId}', 'open_in_new_tab', this.checked)">
              Ouvrir dans un nouvel onglet
            </label>
          </div>
        </div>
      </div>
      ${children.map(c => renderItem(c, depth + 1)).join('')}
    `;
  }

  return roots.map(r => renderItem(r)).join('');
}

function toggleMenuItemEdit(itemId) {
  const el = document.getElementById('menuItemEdit_' + itemId);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function updateMenuItemField(itemId, field, value) {
  const item = _menuItems.find(i => String(i.id) === String(itemId) || String(i.temp_id) === String(itemId));
  if (!item) return;
  if (field === 'parent_id') {
    item.parent_id = value ? (isNaN(value) ? value : parseInt(value)) : null;
  } else if (field === 'open_in_new_tab') {
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
      url: `/pages/${slug}`,
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

  // Reindex menu_order based on DOM order
  const rows = document.querySelectorAll('.menu-item-row');
  rows.forEach((row, idx) => {
    const itemId = row.getAttribute('data-item-id');
    const item = _menuItems.find(i => String(i.id) === String(itemId) || String(i.temp_id) === String(itemId));
    if (item) item.menu_order = idx;
  });

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
  // Enable drag-and-drop reordering
  const list = document.getElementById('menuItemsList');
  if (!list) return;

  let dragItem = null;

  list.addEventListener('mousedown', function(e) {
    const handle = e.target.closest('.menu-item-drag');
    if (!handle) return;
    dragItem = handle.closest('.menu-item-row');
    if (!dragItem) return;
    dragItem.classList.add('dragging');

    const onMove = (ev) => {
      const rows = [...list.querySelectorAll('.menu-item-row:not(.dragging)')];
      const y = ev.clientY;
      let after = null;
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (y > rect.top + rect.height / 2) after = row;
      }
      if (after) {
        after.insertAdjacentElement('afterend', dragItem);
      } else if (rows.length > 0) {
        list.insertBefore(dragItem, rows[0]);
      }
    };

    const onUp = () => {
      dragItem.classList.remove('dragging');
      dragItem = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // Update menu_order from DOM
      const allRows = list.querySelectorAll('.menu-item-row');
      allRows.forEach((row, idx) => {
        const itemId = row.getAttribute('data-item-id');
        const item = _menuItems.find(i => String(i.id) === String(itemId) || String(i.temp_id) === String(itemId));
        if (item) item.menu_order = idx;
      });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
