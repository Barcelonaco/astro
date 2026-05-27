<?php

class SettingsController {
    private static function getSettingsMap(array $keys = []): array {
        $db = Database::getInstance();
        if (empty($keys)) {
            $rows = $db->query('SELECT setting_key, setting_value FROM settings')->fetchAll();
        } else {
            $placeholders = implode(',', array_fill(0, count($keys), '?'));
            $stmt = $db->prepare("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ($placeholders)");
            $stmt->execute($keys);
            $rows = $stmt->fetchAll();
        }
        $settings = [];
        foreach ($rows as $row) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
        return $settings;
    }

    public static function getAllSettings(): void {
        $settings = self::getSettingsMap();
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $settings['frontend_url'] = $_ENV['FRONTEND_URL'] ?? ($protocol . '://' . $_SERVER['HTTP_HOST']);
        json_response($settings);
    }

    public static function getSiteInfo(): void {
        $s = self::getSettingsMap(['site_name', 'site_description', 'front_page', 'favicon']);
        json_response([
            'siteName' => $s['site_name'] ?? '',
            'siteDescription' => $s['site_description'] ?? '',
            'frontPage' => $s['front_page'] ?? '',
            'favicon' => $s['favicon'] ?? '',
        ]);
    }

    public static function getAvailableThemes(): void {
        $builtins = [
            ['id' => 'default', 'name' => 'Thème par défaut', 'builtin' => true],
            ['id' => 'dark', 'name' => 'Thème sombre', 'builtin' => true],
            ['id' => 'minimal', 'name' => 'Thème minimaliste', 'builtin' => true],
            ['id' => 'colorful', 'name' => 'Thème coloré', 'builtin' => true],
            ['id' => 'nature', 'name' => 'Thème nature', 'builtin' => true],
        ];
        $builtinIds = array_column($builtins, 'id');

        $themesDir = realpath(__DIR__ . '/../../frontend/public/themes');
        $custom = [];
        if ($themesDir && is_dir($themesDir)) {
            foreach (scandir($themesDir) as $dir) {
                if ($dir === '.' || $dir === '..' || in_array($dir, $builtinIds)) continue;
                $jsonPath = $themesDir . '/' . $dir . '/theme.json';
                if (is_file($jsonPath)) {
                    $manifest = json_decode(file_get_contents($jsonPath), true);
                    $custom[] = [
                        'id' => $dir,
                        'name' => $manifest['name'] ?? $dir,
                        'builtin' => false,
                    ];
                }
            }
        }

        json_response(array_merge($builtins, $custom));
    }

    public static function getThemeSettings(): void {
        $s = self::getSettingsMap(['theme_use_child', 'active_theme']);
        json_response([
            'useChildTheme' => ($s['theme_use_child'] ?? '0') === '1',
            'activeTheme' => $s['active_theme'] ?? 'default',
        ]);
    }

    public static function getStyleSettings(): void {
        $keys = [
            'text_color', 'primary_color', 'brand_primary_dark',
            'secondary_color', 'brand_secondary_dark', 'tertiary_color',
            'background_color', 'bg_form_field',
            'font_title', 'font_general', 'custom_font_title_family', 'custom_font_general_family', 'logo_height',
            'theme_use_child', 'active_theme'
        ];
        json_response(self::getSettingsMap($keys));
    }

    public static function getFrontendBootstrap(): void {
        // File-based cache (10s TTL)
        $cacheFile = __DIR__ . '/../uploads/.bootstrap_cache.json';
        if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < 10) {
            header('Content-Type: application/json; charset=utf-8');
            readfile($cacheFile);
            exit;
        }

        $s = self::getSettingsMap();

        // Navigation
        $navigation = MenuModel::getNavigationByLocation('primary');
        if (!$navigation) {
            $navigation = PageModel::findNavigation();
        }
        $secondaryNav = MenuModel::getNavigationByLocation('secondary');
        $creditNav = MenuModel::getNavigationByLocation('credit');

        // Style settings
        $styleKeys = [
            'text_color', 'primary_color', 'brand_primary_dark',
            'secondary_color', 'brand_secondary_dark', 'tertiary_color',
            'background_color', 'bg_form_field',
            'font_title', 'font_general', 'custom_font_title_family', 'custom_font_general_family', 'logo_height',
            'theme_use_child', 'active_theme'
        ];
        $styleSettings = [];
        foreach ($styleKeys as $k) {
            if (isset($s[$k])) $styleSettings[$k] = $s[$k];
        }

        // Frontend-visible settings
        $frontendKeys = [
            'logo', 'logo_white', 'logo_loader', 'favicon', 'replacement_image',
            'menu_seamless', 'rounded', 'uppercase', 'home_loader', 'menu_style',
            'secret_menu', 'logo_custom_height', 'accessibility', 'show_breadcrumb',
            'pages_share_btn', 'share_btn_position',
            'alt_secondary_menu',
            'top_link_1_url', 'top_link_1_text', 'icon_link_1',
            'top_link_2_url', 'top_link_2_text', 'icon_link_2',
            'show_phone', 'show_search', 'show_socials', 'phone', 'phone_2', 'email',
            'address', 'address_2',
            'footer_color', 'footer_bg_img', 'footer_bg_opacity', 'footer_bg_parallax',
            'footer_custom_bloc', 'footer_custom_bloc_location',
            'link_1_url', 'link_1_text', 'link_2_url', 'link_2_text',
            'footer_text', 'schedule', 'opening',
            'newsletter_form', 'newsletter_form_title', 'newsletter_form_desc',
            'instagram', 'facebook', 'threads', 'tiktok', 'linkedin',
            'twitter', 'tripadvisor', 'pinterest', 'youtube',
            'show_alert', 'bloc_color_alert', 'is_small_marged_alert',
            'bg_img_alert', 'bg_opacity_alert', 'alert_text',
            'alert_cta_url', 'alert_cta_text', 'alert_cta2_url', 'alert_cta2_text',
            'show_btn', 'floating_btn_link', 'floating_btn_link_title', 'floating_btn_img',
            'is_maintenance', 'text_maintenance', 'show_infos', 'show_rs',
            'id_application_instagram', 'secret_key_application_instagram',
            'link_account_instagram', 'access_token_instagram',
            'ga_code', 'aw_code', 'gtm_code', 'meta_pixel_code',
            'cookie_enabled', 'cookie_title', 'cookie_description',
            'cookie_privacy_url', 'cookie_accept_text', 'cookie_reject_text',
            'is_onepage', 'is_activate_schemas', 'custom_balise', 'google_api_key',
            // E-commerce (public-safe uniquement, aucun secret)
            'shop_currency', 'shop_country', 'shop_payment_methods',
            'checkout_guest_enabled'
        ];
        $siteSettings = [];
        foreach ($frontendKeys as $k) {
            if (isset($s[$k])) $siteSettings[$k] = $s[$k];
        }
        // ecommerce_enabled est dérivé de l'état du plugin (plus de toggle séparé).
        $siteSettings['ecommerce_enabled'] = PluginController::isPluginActive('ecommerce') ? '1' : '0';
        $siteSettings['poolp_configurator_enabled'] = PluginController::isPluginActive('poolp-configurator') ? '1' : '0';

        // Front page content
        $frontPage = null;
        $frontPageSlug = $s['front_page'] ?? '';
        if ($frontPageSlug) {
            $frontPage = PageModel::findBySlug($frontPageSlug);
            if ($frontPage && ($frontPage['status'] ?? '') !== 'published') $frontPage = null;
        }

        $result = [
            'siteInfo' => [
                'siteName' => $s['site_name'] ?? '',
                'siteDescription' => $s['site_description'] ?? '',
                'frontPage' => $frontPageSlug,
            ],
            'styleSettings' => $styleSettings,
            'siteSettings' => $siteSettings,
            'navigation' => $navigation ?: [],
            'secondaryNavigation' => $secondaryNav ?: [],
            'creditNavigation' => $creditNav ?: [],
            'frontPage' => $frontPage,
        ];

        // Write cache
        @file_put_contents($cacheFile, json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        json_response($result);
    }

    public static function updateSettings(): void {
        $allowedKeys = [
            'theme_use_child', 'active_theme',
            'site_name', 'site_description', 'posts_per_page', 'front_page',
            'logo', 'logo_white', 'logo_loader', 'favicon', 'replacement_image',
            'brand_primary', 'brand_primary_dark', 'brand_secondary', 'brand_secondary_dark',
            'primary_color', 'secondary_color', 'tertiary_color', 'text_color', 'background_color', 'bg_form_field',
            'font_title', 'font_general', 'custom_font_title_family', 'custom_font_general_family',
            'menu_seamless', 'rounded', 'uppercase', 'home_loader', 'menu_style',
            'secret_menu', 'logo_custom_height', 'logo_height', 'accessibility', 'show_breadcrumb',
            'pages_share_btn', 'share_btn_position',
            'alt_secondary_menu',
            'top_link_1_url', 'top_link_1_text', 'icon_link_1',
            'top_link_2_url', 'top_link_2_text', 'icon_link_2',
            'show_phone', 'show_search', 'show_socials', 'phone', 'phone_2', 'email',
            'address', 'address_2',
            'footer_color', 'footer_bg_img', 'footer_bg_opacity', 'footer_bg_parallax',
            'footer_custom_bloc', 'footer_custom_bloc_location',
            'link_1_url', 'link_1_text', 'link_2_url', 'link_2_text',
            'footer_text', 'schedule', 'opening',
            'newsletter_form', 'newsletter_form_title', 'newsletter_form_desc',
            'instagram', 'facebook', 'threads', 'tiktok', 'linkedin',
            'twitter', 'tripadvisor', 'pinterest', 'youtube',
            'id_application_instagram', 'secret_key_application_instagram',
            'link_account_instagram', 'access_token_instagram',
            'show_alert', 'bloc_color_alert', 'is_small_marged_alert',
            'bg_img_alert', 'bg_opacity_alert', 'alert_text',
            'alert_cta_url', 'alert_cta_text', 'alert_cta2_url', 'alert_cta2_text',
            'show_btn', 'floating_btn_link', 'floating_btn_link_title', 'floating_btn_img',
            'is_maintenance', 'text_maintenance', 'show_infos', 'show_rs',
            'ga_code', 'aw_code', 'gtm_code', 'meta_pixel_code',
            'recaptcha_site_key', 'recaptcha_secret_key',
            'cookie_enabled', 'cookie_title', 'cookie_description',
            'cookie_privacy_url', 'cookie_accept_text', 'cookie_reject_text',
            'is_onepage', 'is_activate_schemas', 'custom_balise', 'google_api_key'
        ];

        $raw = get_json_body();
        if (empty($raw)) error_response('Body must be an object of key-value settings', 400);

        $updates = isset($raw['settings']) && is_array($raw['settings']) ? $raw['settings'] : $raw;

        $db = Database::getInstance();
        $stmt = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");

        foreach ($updates as $key => $value) {
            $isEcomPlainKey = preg_match('/^(ecommerce_|shop_|stripe_mode|stripe_pk|stripe_webhook_id|paypal_client_id|paypal_mode|paypal_webhook_id|bank_|invoice_|quote_|checkout_|order_customer_cancel_|gdpr_)/', $key)
                && !preg_match('/^(stripe_sk|stripe_webhook_secret|paypal_secret|paypal_webhook_secret)$/', $key); // secrets bloqués ici, uniquement via EcommerceSettingsController
            if (!in_array($key, $allowedKeys) && !preg_match('/^(cpt|plugin)_[a-z0-9_]+$/', $key) && !$isEcomPlainKey) continue;
            $strValue = ($value === null) ? '' : (string) $value;
            $stmt->execute([$key, $strValue]);
        }

        // Invalidate bootstrap cache
        @unlink(__DIR__ . '/../uploads/.bootstrap_cache.json');

        trigger_frontend_rebuild('settings updated');
        json_response(self::getSettingsMap());
    }
}
