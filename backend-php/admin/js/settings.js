// ── Settings module ──────────────────────────────────────────────
// Extracted from app.js – site settings, CSS variables, fonts, favicon.

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
    window.siteSettingsCache = await apiFetch('/settings');
    applyCssVariablesFromSettings(siteSettingsCache);
    applyAdminFavicon(siteSettingsCache.favicon || '');
  } catch (e) {
    window.siteSettingsCache = {};
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
    window.moduleFieldSchema = await apiFetch('/module-fields');
  } catch (e) {
    window.moduleFieldSchema = { modules: {} };
  }
  _layoutToModuleName = null; // invalidate reverse map cache
  return moduleFieldSchema;
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

async function renderSiteSettings() {
  showLoading();
  try {
    const settings = await apiFetch('/settings');
    // Mettre à jour le cache global dès le chargement pour la prévisualisation
    window.siteSettingsCache = settings;
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
    const customFontTitle = settings.custom_font_title_family || '';
    const customFontGeneral = settings.custom_font_general_family || '';

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
    const titleMaintenance = settings.title_maintenance || '';
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
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Police titre custom (Google Font)</label>
              <input type="text" class="form-input" name="custom_font_title_family" value="${escapeHtml(customFontTitle)}" placeholder="ex: Bricolage Grotesque" autocomplete="off">
              <small style="color:#999;font-size:11px;">Nom exact Google Font. Override la police titre. Vide = police select au-dessus. Rebuild requis.</small>
            </div>
            <div class="form-group">
              <label class="form-label">Police texte custom (Google Font)</label>
              <input type="text" class="form-input" name="custom_font_general_family" value="${escapeHtml(customFontGeneral)}" placeholder="ex: Geist" autocomplete="off">
              <small style="color:#999;font-size:11px;">Nom exact Google Font. Override la police texte. Vide = police select au-dessus. Rebuild requis.</small>
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
            <label class="form-label">Titre de la page maintenance</label>
            <input type="text" class="form-input" name="title_maintenance" value="${escapeHtml(titleMaintenance)}">
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
    custom_font_title_family: (formData.get('custom_font_title_family') || '').trim(),
    custom_font_general_family: (formData.get('custom_font_general_family') || '').trim(),
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
    title_maintenance: formData.get('title_maintenance') || '',
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
    window.siteSettingsCache = { ...(siteSettingsCache || {}), ...payload };
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

Object.assign(window, {
  applyCssVariablesFromSettings,
  loadSiteSettings,
  applyAdminFavicon,
  loadModuleFieldSchema,
  renderSiteSettings,
  saveSiteSettings,
  toggleFooterBlocSelect,
  attachSiteSettingsTabs,
  initFontPreview,
  toggleFooterBgOptions,
  toggleNewsletterOptions,
  toggleAltSecondaryMenu,
  toggleAlertBgOptions,
});
