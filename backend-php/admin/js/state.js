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
window._sInstagram = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><path d="M7.64,25.92a9.47,9.47,0,0,1-3.16-.6,6.5,6.5,0,0,1-2.3-1.5,6.41,6.41,0,0,1-1.5-2.3,9.73,9.73,0,0,1-.6-3.16C0,17,0,16.52,0,13S0,9,.08,7.64a9.73,9.73,0,0,1,.6-3.16A6.66,6.66,0,0,1,4.48.68,9.73,9.73,0,0,1,7.64.08C9,0,9.48,0,13,0s4,0,5.36.08a9.78,9.78,0,0,1,3.16.6,6.66,6.66,0,0,1,3.8,3.8,10,10,0,0,1,.6,3.16C26,9,26,9.46,26,13s0,4-.08,5.36a9.52,9.52,0,0,1-.6,3.16,6.65,6.65,0,0,1-3.8,3.8,10,10,0,0,1-3.15.6C17,26,16.54,26,13,26S9,26,7.64,25.92Zm.11-23.5a7.15,7.15,0,0,0-2.42.45,4.09,4.09,0,0,0-1.49,1,4.07,4.07,0,0,0-1,1.5,7.34,7.34,0,0,0-.44,2.41C2.36,9.12,2.34,9.53,2.34,13s0,3.88.08,5.25a7.15,7.15,0,0,0,.45,2.42,4,4,0,0,0,1,1.49,4,4,0,0,0,1.49,1,7.15,7.15,0,0,0,2.42.45c1.36.07,1.77.08,5.25.08s3.89,0,5.25-.08a7.11,7.11,0,0,0,2.42-.45,4.26,4.26,0,0,0,2.46-2.46,7.15,7.15,0,0,0,.45-2.42c.07-1.36.08-1.77.08-5.25s0-3.89-.08-5.25a7.15,7.15,0,0,0-.45-2.42,4,4,0,0,0-1-1.49,4.11,4.11,0,0,0-1.49-1,7.4,7.4,0,0,0-2.42-.44c-1.37-.06-1.79-.08-5.25-.08s-3.88,0-5.25.08ZM6.32,13A6.68,6.68,0,1,1,13,19.67,6.68,6.68,0,0,1,6.32,13Zm2.35,0A4.33,4.33,0,1,0,13,8.67h0A4.33,4.33,0,0,0,8.67,13Zm9.71-6.94a1.56,1.56,0,1,1,1.56,1.56h0A1.56,1.56,0,0,1,18.38,6.06Z"/></svg>';
window._sFacebook = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 25.73 25.74"><path d="M24.31,0H1.42A1.43,1.43,0,0,0,0,1.42H0V24.31a1.42,1.42,0,0,0,1.42,1.42H13.75v-10H10.4v-3.9h3.35V9c0-3.32,2-5.13,5-5.13a24.85,24.85,0,0,1,3,.15V7.51h-2c-1.61,0-1.93.76-1.93,1.89v2.48h3.86l-.5,3.9H17.75v10h6.56a1.42,1.42,0,0,0,1.42-1.42h0V1.42A1.42,1.42,0,0,0,24.31,0Z"/></svg>';
window._sThreads = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><path d="M18.9,11.9c.1,0,.2.1.3.2,1.6.8,2.7,1.9,3.3,3.3.9,2,.9,5.2-1.6,7.8-2,2-4.3,2.8-7.7,2.9h0c-3.8,0-6.7-1.3-8.7-3.8-1.7-2.2-2.6-5.3-2.7-9.2h0c0-3.9.9-7,2.7-9.2C6.5,1.3,9.4,0,13.2,0h0c3.8,0,6.8,1.3,8.8,3.8,1,1.2,1.7,2.7,2.2,4.4l-2.2.6c-.4-1.4-1-2.6-1.7-3.5-1.6-1.9-4-2.9-7.1-3-3.1,0-5.4,1-6.9,2.9-1.4,1.8-2.2,4.4-2.2,7.8,0,3.3.8,6,2.2,7.8,1.5,1.9,3.9,2.9,6.9,2.9,2.8,0,4.6-.7,6.2-2.2,1.7-1.7,1.7-3.9,1.2-5.2-.3-.8-.9-1.4-1.7-1.9-.2,1.5-.6,2.6-1.3,3.5-.9,1.2-2.2,1.8-3.9,1.9-1.3,0-2.5-.2-3.5-.9-1.1-.7-1.8-1.9-1.9-3.2-.1-2.6,1.9-4.5,5.2-4.7,1.1,0,2.2,0,3.2.2-.1-.8-.4-1.4-.8-1.9-.5-.6-1.4-1-2.5-1h0c-.9,0-2.1.2-2.9,1.4l-1.9-1.3c1-1.6,2.7-2.4,4.8-2.4h0c3.4,0,5.4,2.1,5.6,5.8h0s0,0,0,0ZM10.4,15.6c0,1.4,1.5,2,3,1.9,1.4,0,3-.6,3.2-4-.7-.2-1.5-.2-2.4-.2s-.5,0-.8,0c-2.3.1-3.1,1.3-3,2.3h0s0,0,0,0Z"/></svg>';
window._sTiktok = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="26" viewBox="0 0 25.152 29.022"><path d="M22.02,6.207a6.609,6.609,0,0,1-.571-.333,8.033,8.033,0,0,1-1.467-1.247,6.921,6.921,0,0,1-1.653-3.412h.006A4.2,4.2,0,0,1,18.268,0H13.284V19.273c0,.259,0,.515-.011.767,0,.031,0,.06,0,.094a.206.206,0,0,1,0,.043v.011a4.232,4.232,0,0,1-2.129,3.359,4.159,4.159,0,0,1-2.062.544,4.232,4.232,0,0,1,0-8.464,4.164,4.164,0,0,1,1.294.2l.006-5.075A9.258,9.258,0,0,0,3.24,12.845a9.782,9.782,0,0,0-2.134,2.632,9.121,9.121,0,0,0-1.1,4.186,9.88,9.88,0,0,0,.535,3.309v.012a9.74,9.74,0,0,0,1.353,2.468,10.129,10.129,0,0,0,2.159,2.037v-.012l.012.012a9.326,9.326,0,0,0,5.088,1.532,9.007,9.007,0,0,0,3.776-.835A9.477,9.477,0,0,0,16,25.881,9.58,9.58,0,0,0,17.667,23.1a10.4,10.4,0,0,0,.6-3.176V9.7c.06.036.866.569.866.569A11.527,11.527,0,0,0,22.1,11.5a17.1,17.1,0,0,0,3.048.417V6.969a6.463,6.463,0,0,1-3.132-.762"/></svg>';
window._sLinkedin = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"><path d="M22.224,24H1.77A1.753,1.753,0,0,1,0,22.268V1.731A1.753,1.753,0,0,1,1.77,0H22.224A1.756,1.756,0,0,1,24,1.731V22.268A1.756,1.756,0,0,1,22.224,24ZM9.353,9V20.451h3.555V14.786c0-1.454.254-2.941,2.134-2.941,1.85,0,1.85,1.755,1.85,3.036v5.571h3.559V14.17a7.2,7.2,0,0,0-.784-3.886,3.764,3.764,0,0,0-3.487-1.571,3.763,3.763,0,0,0-3.368,1.849h-.049V9Zm-5.8,0V20.451H7.118V9ZM5.339,3.3A2.065,2.065,0,1,0,7.4,5.368,2.068,2.068,0,0,0,5.339,3.3Z"/></svg>';
window._sTwitter = '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="23" viewBox="0 0 25 22.6"><path d="M19.7,0h3.8l-8.4,9.6L25,22.6h-7.7l-6-7.9-6.9,7.9H0.5l8.9-10.2L0,0h7.9l5.5,7.2L19.7,0z M18.4,20.3h2.1L6.8,2.2H4.4 L18.4,20.3z"/></svg>';
window._sTripadvisor = '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="22" viewBox="0 0 39.932 25.64"><path d="M36.668,7.468l3.264-3.551H32.695a22.612,22.612,0,0,0-25.439,0H0L3.264,7.468a9.977,9.977,0,1,0,13.5,14.691l3.2,3.481,3.2-3.478A9.98,9.98,0,1,0,36.668,7.468M9.988,21.593a6.751,6.751,0,1,1,6.751-6.751,6.75,6.75,0,0,1-6.751,6.751m9.978-6.948c0-4.443-3.23-8.256-7.494-9.885a19.477,19.477,0,0,1,14.986,0C23.2,6.392,19.966,10.2,19.966,14.645m9.976,6.948a6.751,6.751,0,1,1,6.751-6.751,6.75,6.75,0,0,1-6.751,6.751m0-10.293a3.539,3.539,0,1,0,3.539,3.539A3.538,3.538,0,0,0,29.942,11.3M13.526,14.842A3.539,3.539,0,1,1,9.988,11.3a3.538,3.538,0,0,1,3.539,3.539"/></svg>';
window._sPinterest = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 25.75 25.74"><path d="M12.87,0A12.87,12.87,0,0,0,8.18,24.85a12.34,12.34,0,0,1,0-3.69c.24-1,1.51-6.4,1.51-6.4a4.69,4.69,0,0,1-.38-1.91c0-1.79,1-3.13,2.32-3.13a1.61,1.61,0,0,1,1.64,1.6,1.7,1.7,0,0,1,0,.22,25.28,25.28,0,0,1-1.07,4.28,1.87,1.87,0,0,0,1.35,2.27,1.78,1.78,0,0,0,.56.06c2.29,0,4-2.41,4-5.89A5.09,5.09,0,0,0,13.27,7h-.46A5.58,5.58,0,0,0,7,12.34v.27a5,5,0,0,0,1,2.93.41.41,0,0,1,.09.37c-.1.41-.32,1.28-.36,1.46s-.19.28-.43.17c-1.61-.75-2.61-3.1-2.61-5,0-4.06,2.95-7.79,8.5-7.79,4.46,0,7.93,3.18,7.93,7.43,0,4.44-2.8,8-6.68,8a3.43,3.43,0,0,1-3-1.48s-.64,2.46-.8,3.06a14.14,14.14,0,0,1-1.6,3.38A12.87,12.87,0,1,0,16.69.58,12.73,12.73,0,0,0,12.87,0"/></svg>';
window._sYoutube = '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="24" viewBox="0 0 40.402 28.283"><path d="M39.558,4.417A5.059,5.059,0,0,0,35.986.845C32.836,0,20.2,0,20.2,0S7.566,0,4.417.845A5.06,5.06,0,0,0,.845,4.417C0,7.566,0,14.142,0,14.142s0,6.575.845,9.725a5.06,5.06,0,0,0,3.572,3.572c3.15.845,15.784.845,15.784.845s12.635,0,15.784-.845a5.059,5.059,0,0,0,3.572-3.572c.845-3.15.845-9.725.845-9.725s0-6.575-.845-9.725M16.157,20.2V8.083l10.5,6.06Z"/></svg>';


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
