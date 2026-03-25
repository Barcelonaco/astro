import pool from '../db.js';

/**
 * Get all settings as key-value object (admin)
 */
export async function getAllSettings(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT setting_key, setting_value FROM settings'
    );
    const settings = {};
    rows.forEach((row) => {
      settings[row.setting_key] = row.setting_value;
    });
    settings.frontend_url = process.env.FRONTEND_URL || 'http://localhost:4321';
    return res.json(settings);
  } catch (error) {
    console.error('getAllSettings error:', error);
    return res.status(500).json({ error: 'Erreur lors de la récupération des paramètres' });
  }
}

/**
 * Get site identity settings (public, for frontend)
 */
export async function getSiteInfo(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT setting_key, setting_value FROM settings
       WHERE setting_key IN ('site_name', 'site_description', 'front_page')`
    );
    const settings = { site_name: '', site_description: '', front_page: '' };
    rows.forEach((row) => {
      settings[row.setting_key] = row.setting_value;
    });
    return res.json({
      siteName: settings.site_name || '',
      siteDescription: settings.site_description || '',
      frontPage: settings.front_page || '',
    });
  } catch (error) {
    console.error('getSiteInfo error:', error);
    return res.status(500).json({ siteName: '', siteDescription: '' });
  }
}

/**
 * Get theme-related settings (public, for frontend)
 */
export async function getThemeSettings(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT setting_key, setting_value FROM settings 
       WHERE setting_key IN ('theme_use_child', 'active_theme')`
    );
    const settings = {
      theme_use_child: '0',
      active_theme: 'default'
    };
    rows.forEach((row) => {
      settings[row.setting_key] = row.setting_value;
    });
    return res.json({
      useChildTheme: settings.theme_use_child === '1',
      activeTheme: settings.active_theme || 'default'
    });
  } catch (error) {
    console.error('getThemeSettings error:', error);
    return res.status(500).json({
      useChildTheme: false,
      activeTheme: 'default'
    });
  }
}

/**
 * Get style settings (public, for frontend SSR).
 * Returns colors, fonts, logo height — everything ThemeInjector needs.
 */
export async function getStyleSettings(req, res) {
  try {
    const keys = [
      'text_color', 'primary_color', 'brand_primary_dark',
      'secondary_color', 'brand_secondary_dark', 'tertiary_color',
      'background_color', 'bg_form_field',
      'font_title', 'font_general', 'logo_height',
      'theme_use_child', 'active_theme'
    ];
    const [rows] = await pool.query(
      `SELECT setting_key, setting_value FROM settings WHERE setting_key IN (${keys.map(() => '?').join(',')})`,
      keys
    );
    const settings = {};
    rows.forEach((row) => { settings[row.setting_key] = row.setting_value; });
    return res.json(settings);
  } catch (error) {
    console.error('getStyleSettings error:', error);
    return res.status(500).json({});
  }
}

/**
 * Combined frontend bootstrap data (public).
 * Returns siteInfo + styleSettings + navigation + optional frontPage content in a single request.
 * Reduces multiple HTTP round-trips to 1 for SSR pages.
 * In-memory cache with 10s TTL to avoid redundant DB queries across rapid SSR requests.
 */
let _bootstrapCache = null;
let _bootstrapCacheTime = 0;
const BOOTSTRAP_CACHE_TTL = 10_000; // 10 seconds

export async function getFrontendBootstrap(req, res) {
  try {
    const now = Date.now();
    if (_bootstrapCache && (now - _bootstrapCacheTime) < BOOTSTRAP_CACHE_TTL) {
      return res.json(_bootstrapCache);
    }

    const { Page } = await import('../models/Page.js');
    const { Menu } = await import('../models/Menu.js');

    const [settingsRows, menuNav, secondaryNav] = await Promise.all([
      pool.query('SELECT setting_key, setting_value FROM settings').then(([rows]) => rows),
      Menu.getNavigationByLocation('primary'),
      Menu.getNavigationByLocation('secondary'),
    ]);

    // Use menu-based navigation, fallback to page-based
    let navigation = menuNav;
    if (!navigation) {
      navigation = await Page.findNavigation();
    }

    const s = {};
    settingsRows.forEach((row) => { s[row.setting_key] = row.setting_value; });

    const styleKeys = [
      'text_color', 'primary_color', 'brand_primary_dark',
      'secondary_color', 'brand_secondary_dark', 'tertiary_color',
      'background_color', 'bg_form_field',
      'font_title', 'font_general', 'logo_height',
      'theme_use_child', 'active_theme'
    ];
    const styleSettings = {};
    styleKeys.forEach(k => { if (s[k] !== undefined) styleSettings[k] = s[k]; });

    // All frontend-visible settings (header, footer, socials, contact, popup, floating, maintenance, tracking)
    const frontendKeys = [
      // Logos
      'logo', 'logo_white', 'logo_loader', 'favicon', 'replacement_image',
      // Header & menu
      'menu_seamless', 'rounded', 'uppercase', 'home_loader', 'menu_style',
      'secret_menu', 'logo_custom_height', 'accessibility', 'show_breadcrumb',
      'pages_share_btn', 'share_btn_position',
      // Contact / secondary menu
      'alt_secondary_menu',
      'top_link_1_url', 'top_link_1_text', 'icon_link_1',
      'top_link_2_url', 'top_link_2_text', 'icon_link_2',
      'show_phone', 'show_search', 'show_socials', 'phone', 'phone_2', 'email',
      'address', 'address_2',
      // Footer
      'footer_color', 'footer_bg_img', 'footer_bg_opacity', 'footer_bg_parallax',
      'footer_custom_bloc', 'footer_custom_bloc_location',
      'link_1_url', 'link_1_text', 'link_2_url', 'link_2_text',
      'footer_text', 'schedule', 'opening',
      'newsletter_form', 'newsletter_form_title', 'newsletter_form_desc',
      // Social networks
      'instagram', 'facebook', 'threads', 'tiktok', 'linkedin',
      'twitter', 'tripadvisor', 'pinterest', 'youtube',
      // Popup
      'show_alert', 'bloc_color_alert', 'is_small_marged_alert',
      'bg_img_alert', 'bg_opacity_alert', 'alert_text',
      'alert_cta_url', 'alert_cta_text', 'alert_cta2_url', 'alert_cta2_text',
      // Floating button
      'show_btn', 'floating_btn_link', 'floating_btn_img',
      // Maintenance
      'is_maintenance', 'text_maintenance', 'show_infos', 'show_rs',
      // Instagram feed
      'id_application_instagram', 'secret_key_application_instagram',
      'link_account_instagram', 'access_token_instagram',
      // Tracking
      'ga_code', 'aw_code', 'gtm_code', 'meta_pixel_code',
      // Technique
      'is_onepage', 'is_activate_schemas', 'custom_balise', 'google_api_key'
    ];
    const siteSettings = {};
    frontendKeys.forEach(k => { if (s[k] !== undefined) siteSettings[k] = s[k]; });

    // Include front page content so index.astro doesn't need a 2nd API call
    let frontPage = null;
    const frontPageSlug = s.front_page || '';
    if (frontPageSlug) {
      frontPage = await Page.findBySlug(frontPageSlug);
      if (frontPage && frontPage.status !== 'published') frontPage = null;
    }

    const result = {
      siteInfo: {
        siteName: s.site_name || '',
        siteDescription: s.site_description || '',
        frontPage: frontPageSlug,
      },
      styleSettings,
      siteSettings,
      navigation: navigation || [],
      secondaryNavigation: secondaryNav || [],
      frontPage: frontPage || null,
    };

    _bootstrapCache = result;
    _bootstrapCacheTime = now;

    return res.json(result);
  } catch (error) {
    console.error('getFrontendBootstrap error:', error);
    return res.status(500).json({
      siteInfo: { siteName: '', siteDescription: '', frontPage: '' },
      styleSettings: {},
      navigation: [],
      secondaryNavigation: [],
      frontPage: null,
    });
  }
}

/**
 * Update settings (admin only). Body: { theme_use_child?: '0'|'1', active_theme?: string }
 */
export async function updateSettings(req, res) {
  try {
    const allowedKeys = [
      // Thème / admin
      'theme_use_child',
      'active_theme',
      // Paramètres généraux
      'site_name',
      'site_description',
      'posts_per_page',
      'front_page',
      // Logos
      'logo',
      'logo_white',
      'logo_loader',
      'favicon',
      'replacement_image',
      // Couleurs marque (admin / front)
      'brand_primary',
      'brand_primary_dark',
      'brand_secondary',
      'brand_secondary_dark',
      'primary_color',
      'secondary_color',
      'tertiary_color',
      'text_color',
      'background_color',
      'bg_form_field',
      // Polices
      'font_title',
      'font_general',
      // Identité / header
      'menu_seamless',
      'rounded',
      'uppercase',
      'home_loader',
      'menu_style',
      'secret_menu',
      'logo_custom_height',
      'logo_height',
      'accessibility',
      'show_breadcrumb',
      'pages_share_btn',
      'share_btn_position',
      // Menu secondaire / coordonnées
      'alt_secondary_menu',
      'top_link_1_url',
      'top_link_1_text',
      'icon_link_1',
      'top_link_2_url',
      'top_link_2_text',
      'icon_link_2',
      'show_phone',
      'show_search',
      'show_socials',
      'phone',
      'phone_2',
      'email',
      'address',
      'address_2',
      // Footer
      'footer_color',
      'footer_bg_img',
      'footer_bg_opacity',
      'footer_bg_parallax',
      'footer_custom_bloc',
      'footer_custom_bloc_location',
      'link_1_url',
      'link_1_text',
      'link_2_url',
      'link_2_text',
      'footer_text',
      'schedule',
      'opening',
      'newsletter_form',
      'newsletter_form_title',
      'newsletter_form_desc',
      // Réseaux sociaux
      'instagram',
      'facebook',
      'threads',
      'tiktok',
      'linkedin',
      'twitter',
      'tripadvisor',
      'pinterest',
      'youtube',
      'id_application_instagram',
      'secret_key_application_instagram',
      'link_account_instagram',
      'access_token_instagram',
      // Popup
      'show_alert',
      'bloc_color_alert',
      'is_small_marged_alert',
      'bg_img_alert',
      'bg_opacity_alert',
      'alert_text',
      'alert_cta_url',
      'alert_cta_text',
      'alert_cta2_url',
      'alert_cta2_text',
      // Bouton flottant
      'show_btn',
      'floating_btn_link',
      'floating_btn_img',
      // Maintenance
      'is_maintenance',
      'text_maintenance',
      'show_infos',
      'show_rs',
      // Tracking
      'ga_code',
      'aw_code',
      'gtm_code',
      'meta_pixel_code',
      // reCAPTCHA
      'recaptcha_site_key',
      'recaptcha_secret_key',
      // Technique (admin)
      'is_onepage',
      'is_activate_schemas',
      'custom_balise',
      'google_api_key'
    ];
    const raw = req.body;

    if (!raw || typeof raw !== 'object') {
      return res.status(400).json({ error: 'Body must be an object of key-value settings' });
    }

    // Support both { key: value } and { settings: { key: value } } formats
    const updates = (raw.settings && typeof raw.settings === 'object') ? raw.settings : raw;

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedKeys.includes(key) && !/^cpt_[a-z0-9_]+$/.test(key)) continue;
      const strValue = value === undefined || value === null ? '' : String(value);
      await pool.query(
        `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, strValue]
      );
    }

    const [rows] = await pool.query('SELECT setting_key, setting_value FROM settings');
    const settings = {};
    rows.forEach((row) => {
      settings[row.setting_key] = row.setting_value;
    });
    return res.json(settings);
  } catch (error) {
    console.error('updateSettings error:', error);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour des paramètres' });
  }
}
