// ═══════════════════════════════════════════════════════════════════════════
// state.js — All shared global state lives on `window`.
//
// Strategy: every variable is assigned to window so that all modules and
// onclick handlers access them the same way they always did (bare names).
// ES modules run in strict mode but bare names resolve via the scope chain
// to window properties thanks to `with`-less globals — EXCEPT in module
// scope where undeclared writes throw. So each module that needs to WRITE
// a global must use `window.xxx = ...` instead of bare `xxx = ...`.
// READS of window properties work with bare names.
//
// This lets us split files with minimal changes to existing code.
// ═══════════════════════════════════════════════════════════════════════════

// --- Event bus ---
window.bus = {
  _listeners: {},
  on(event, fn) { (this._listeners[event] ||= []).push(fn); },
  off(event, fn) { this._listeners[event] = (this._listeners[event] || []).filter(f => f !== fn); },
  emit(event, ...args) { (this._listeners[event] || []).forEach(fn => fn(...args)); },
};

// --- Auth & app ---
window.API_BASE = window.location.origin + '/api';
window.token = localStorage.getItem('token');
window.currentUser = null;
window.aiCreditsAvailable = null;
window.aiEnabled = true;
window.ROLE_LEVELS = { reader: 0, editor: 1, admin_site: 2, super_admin: 3, admin: 3 };

// --- Navigation ---
window.MENU_LOCATIONS = [
  { value: '', label: '— Aucun —' },
  { value: 'primary', label: 'Menu principal' },
  { value: 'secondary', label: 'Menu secondaire (top)' },
  { value: 'footer', label: 'Menu footer' },
  { value: 'credit', label: 'Menu crédits' },
];

// --- Inactivity ---
window.INACTIVITY_TIMEOUT = 60 * 60 * 1000;
window._inactivityTimer = null;

// --- Admin themes ---
window.ADMIN_THEMES = {
  default: { primary: '#667eea', primaryDark: '#5568d3', dark: false },
  dark: { primary: '#00d4ff', primaryDark: '#0088cc', dark: true },
  minimal: { primary: '#000000', primaryDark: '#333333', dark: false },
  colorful: { primary: '#ff6b6b', primaryDark: '#ee5a5a', dark: false },
  nature: { primary: '#2ecc71', primaryDark: '#27ae60', dark: false }
};

// --- SVG icons ---
window._svgEdit = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
window._svgDelete = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
window._svgEye = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
window._svgStar = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
window._svgStarFill = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
window._svgInbox = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>';
window._svgCopy = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
window._svgDownload = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
window._svgTrash = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
window._svgX = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

// --- Block types ---
window.LEGACY_BLOCK_TYPES = {
  heading: { label: 'Titre', icon: '📌', defaultData: { level: 'h2', text: 'Nouveau titre' }, legacy: true },
  text: { label: 'Texte', icon: '📝', defaultData: { title: '', body: '' }, legacy: true },
  image: { label: 'Image', icon: '🖼️', defaultData: { src: '', alt: '', caption: '' }, legacy: true },
  cta: { label: 'Appel à l\'action', icon: '🔘', defaultData: { title: '', description: '', buttonText: '', buttonUrl: '' }, legacy: true },
  spacer: { label: 'Espaceur', icon: '↕️', defaultData: { size: 'medium' }, legacy: true },
  html: { label: 'HTML libre', icon: '💻', defaultData: { content: '' }, legacy: true }
};

window.MODULE_LABELS = {
  Banner: 'Bannière', Hero: 'Hero banner', TextSimple: 'Texte simple',
  TextImage: 'Texte + image/vidéo', SliderTextVideo: 'Texte + vidéo (slider)',
  Accordion: 'Accordéons', KeyFigures: 'Chiffres clés', Quote: 'Citation',
  TextScrolling: 'Texte défilement', LinkAlone: 'Liens', Gallery: 'Galerie',
  Video: 'Image / Vidéo', ImagesSlider: 'Carrousel d\'images', Files: 'Aperçu (pdf)',
  ImagesVideosParallax: 'Images vidéos parallaxe', IconLogo: 'Icône + texte',
  SliderLogo: 'Slider de logo', Ornament: 'Ornement', IllusVideo: 'Séparateur vidéo',
  ClickableTiles: 'Tuiles cliquables', NewsSlider: 'Actualités à la une',
  EventsSlider: 'Événements à la une', BlocReferences: 'Références à la une',
  Team: 'Trombinoscope', Contact: 'Contact', Map: 'Carte',
  GoogleReviews: 'Avis Google', Summary: 'Sommaire', Form: 'Formulaire',
  ReusableBloc: 'Bloc réutilisable', ColumnsTab: 'Colonnes', Separator: 'Séparateur',
  Review: 'Avis client', Widget: 'Widget', PlanSite: 'Plan du site',
  InstaFeed: 'Feed Instagram', ThreadsFeed: 'Feed Threads',
  Product: 'Produits à la une', LegalNotice: 'Mentions légales',
  PrivacyPolicy: 'Politique de confidentialité'
};

window.MODULE_CATEGORIES = [
  { id: 'banners', label: 'Bannières & en-têtes', icon: '🏔️', modules: ['Banner', 'Hero'] },
  { id: 'content', label: 'Texte & contenu', icon: '📝', modules: ['TextSimple', 'TextImage', 'SliderTextVideo', 'Accordion', 'KeyFigures', 'Quote', 'TextScrolling', 'LinkAlone'] },
  { id: 'media', label: 'Médias', icon: '🎞️', modules: ['Gallery', 'Video', 'ImagesSlider', 'Files', 'ImagesVideosParallax', 'IconLogo', 'SliderLogo', 'Ornament', 'IllusVideo', 'ClickableTiles'] },
  { id: 'tools', label: 'Fonctionnels & outils', icon: '🧰', modules: ['Team', 'Contact', 'Map', 'Summary', 'Form', 'ReusableBloc', 'ColumnsTab', 'Separator', 'Widget', 'PlanSite', 'LegalNotice', 'PrivacyPolicy'] },
];

window.humanizeModuleName = function(name) {
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
};

window.toKebabCase = function(name) {
  return name.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase();
};

window.NICKL_MODULE_TYPES = MODULE_CATEGORIES.reduce((acc, category) => {
  category.modules.forEach((name) => {
    const type = toKebabCase(name);
    const label = MODULE_LABELS[name] || humanizeModuleName(name);
    const def = { label, icon: category.icon || '▦', defaultData: {}, moduleName: name, categoryId: category.id };
    acc[type] = def;
    acc[name] = { ...def, aliasFor: type };
  });
  return acc;
}, {});

window.BLOCK_TYPES = { ...NICKL_MODULE_TYPES, ...LEGACY_BLOCK_TYPES };

// --- Plugin state ---
window.loadedPlugins = [];
window.INACTIVE_PLUGIN_TYPES = new Set();

// --- CPT state ---
window._cptListItems = [];
window._cptListPtDef = null;
window._cptListSort = { field: 'date', dir: 'desc' };
window._cptListSearch = '';
window._cptListStockMap = {};
window._cptEditExistingCF = {};
window._cptQuills = {};
window._cptQuill = null;
window._cptOptionsQuill = null;

// --- Page builder state ---
window.pageBuilderState = { editingPageId: null, blocks: [], meta: { title: '', slug: '', status: 'draft', show_in_menu: true, menu_order: 0, parent_id: null }, colorOverrides: { enabled: false, primary_color: '', secondary_color: '', tertiary_color: '', text_color: '', background_color: '', bg_form_field: '' }, seoMeta: { enabled: true, meta_title: '', meta_description: '', schema_org: '' }, cptMode: null, cptExcerpt: '', cptFeaturedImage: null, cptCategories: [], cptItemCategories: [], cptCustomFields: {} };
window.selectedBlockId = null;
window.reusableBlocBuilderMode = false;

// --- Unsaved changes ---
window._builderDirty = false;

// --- Inline editing ---
window._inlineEditingBlockId = null;
window._inlineEditingFieldName = null;
window._inlineEditingDataRef = null;
window._inlineEditingElement = null;
window._inlineToolbar = null;
window._inlineSourceTextarea = null;
window._inlineLinkDialog = null;
window._savedSelection = null;

// --- Module/template ---
window.moduleFieldSchema = null;
window._layoutToModuleName = null;
window.moduleTemplateCache = {};
window.moduleTemplatePromises = {};
window.moduleStylesLoaded = new Set();
window.baseStylesLoaded = false;
window.moduleAdminStylesLoaded = new Set();

// --- Media ---
window.mediaState = { folders: [], items: [], currentFolderId: null, selectedIds: [], search: '', typeFilter: '', sort: 'date_desc' };
window.mediaPickerState = { isOpen: false, blockId: null, fieldName: null, fieldEl: null, type: 'all', folderId: null, folders: [], items: [], search: '' };
window.mediaTotalCount = 0;
window._mediaSearchTimer = null;
window._mediaDropDepth = 0;
window._mediaPickerSearchTimer = null;
window._lastSelectedMediaId = null;
window._noImagePlaceholderHtml = '<div class="no-image-placeholder">Aucune image choisie</div>';
window.settingsMediaPickerTarget = null;

// --- Cropper ---
window._cropperInstance = null;
window._cropperOptions = null;

// --- Site settings ---
window.siteSettingsCache = null;

// --- Preview ---
window.PREVIEW_FRONT_WIDTH = 1430;
window._previewResizeObserver = null;

// --- AI bulk ---
window._bulkAiImages = [];
window._bulkAiHtmlFiles = [];

// --- Parallax ---
window._parallaxListenerAdded = false;

// --- Block params ---
window.BLOCK_PARAMS_FIELDS = new Set([
  'title', 'id_bloc', 'title_align', 'title_style',
  'bloc_color', 'padding_top', 'padding_bottom',
  'is_visible', 'bg_img', 'bg_opacity', 'bg_parallax',
  'is_fullscreen', 'is_small_marged'
]);

window.EXTRA_PARAM_FIELDS_BY_MODULE = {
  ColumnsTab: new Set(['container_width', 'cols_justify_items', 'columns_background', 'columns_display']),
};

// --- Quill instances ---
window._quillInstances = new Map();

// --- CSS class constants ---
window.PADDING_CLASSES = ['padding-top-small', 'no-padding-top', 'padding-bottom-small', 'no-padding-bottom'];
window.BG_COLOR_CLASSES = ['has-background-primary', 'has-background-secondary', 'has-background-tertiary', 'no-background-color'];

// --- Pages ---
window._pagesCache = [];
window._pagesSearch = '';
window._pagesCurrentPage = 1;
window.PAGES_PER_PAGE = 10;
window._pagesActiveMenu = null;
window._pagesSortField = 'title';
window._pagesSortDir = 'asc';
window._pagesMenusList = [];
window._pagesMenuItems = {};
window._pagesSelected = new Set();
window._pagesMenuInfo = {};

// --- Reusable blocs ---
window._reusableBlocsCache = [];
window._reusableBlocsSearch = '';
window._reusableBlocsCurrentPage = 1;
window.REUSABLE_BLOCS_PER_PAGE = 10;

// --- Loading ---
window._loadingTimer = null;
window._loadingDelayTimer = null;

// --- Menus ---
window._menusCache = [];
window._menuEditId = null;
window._menuItems = [];
window._menuAvailablePages = [];
window._menuCptSections = [];
window._menuTempIdCounter = 1;

// --- Forms ---
window.FORM_FIELD_TYPES = [
  { type: 'text', label: 'Texte', icon: '<i class="fa-solid fa-font"></i>' },
  { type: 'email', label: 'Email', icon: '<i class="fa-solid fa-at"></i>' },
  { type: 'phone', label: 'Téléphone', icon: '<i class="fa-solid fa-phone"></i>' },
  { type: 'number', label: 'Nombre', icon: '<i class="fa-solid fa-hashtag"></i>' },
  { type: 'textarea', label: 'Zone de texte', icon: '<i class="fa-solid fa-align-left"></i>' },
  { type: 'select', label: 'Liste déroulante', icon: '<i class="fa-solid fa-chevron-down"></i>' },
  { type: 'radio', label: 'Boutons radio', icon: '<i class="fa-solid fa-circle-dot"></i>' },
  { type: 'checkbox', label: 'Cases à cocher', icon: '<i class="fa-solid fa-square-check"></i>' },
  { type: 'date', label: 'Date', icon: '<i class="fa-solid fa-calendar"></i>' },
  { type: 'file', label: 'Fichier', icon: '<i class="fa-solid fa-paperclip"></i>' },
  { type: 'hidden', label: 'Champ caché', icon: '<i class="fa-solid fa-eye-slash"></i>' },
  { type: 'heading', label: 'Titre / séparateur', icon: '<i class="fa-solid fa-heading"></i>' },
];
window._formEntriesPage = 1;
window._formEntriesFilter = 'all';

// --- AI credits ---
window._aiKeyRevealed = false;

// --- Link picker ---
window._linkPickerCallback = null;
window._linkPickerDebounce = null;
window.LINK_PICKER_TYPE_LABELS = {
  page: 'Page', post: 'Article', actualites: 'Actualite',
  evenements: 'Evenement', references: 'Reference',
  portfolio: 'Portfolio', products: 'Produit',
};

// --- Map ---
window.MAPBOX_TOKEN = 'pk.eyJ1Ijoibmlja2wzMCIsImEiOiJjbW91M3p3Z3AwMmhtMnNxemoxNmtmb2xrIn0.N-Mojx4V9-2xXANEdTAuMQ';
window._mapboxGLLoaded = false;
