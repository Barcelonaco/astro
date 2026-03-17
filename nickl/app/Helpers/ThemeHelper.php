<?php

namespace App\Helpers;

use App\Helpers\GlobalHelper as GlobalHelper;

require_once dirname(__DIR__, 2) . '/vendor/mobiledetect/mobiledetectlib/src/MobileDetect.php';
require_once dirname(__DIR__, 2) . '/vendor/autoload.php';


class ThemeHelper
{
    private static $options;

    public function siteName()
    {
        return get_bloginfo('name');
    }


    public static function title($id = null)
    {
        if ($id) {
            return get_the_title($id);
        }
        if (is_home()) {
            if ($home = get_option('page_for_posts', true)) {
                return get_the_title($home);
            }
            return bcn_pll('Les derniers articles');
        }
        if (is_archive()) {
            $title = get_field('title', 'options_' . get_post_type());
            if (empty($title)) {
                $postType = get_post_type_object(get_post_type());
                if(!$postType){
                    return '';
                }
                return $postType->label;
            }
            return $title;
        }
        if (is_search()) {
            return sprintf(bcn_pll('Résultat de recherche pour %s'), get_search_query());
        }
        if (is_404()) {
            return bcn_pll('Page non trouvée');
        }
        return get_the_title();
    }

    public static function getAlertContent(): array
    {
        $options = GlobalHelper::getWebsiteSettings();
        return [
            'bloc_color_alert' => !empty($options[ 'bloc_color_alert' ]) ? $options[ 'bloc_color_alert' ] : null,
            'is_small_marged_alert' => !empty(self::$options[ 'is_small_marged_alert' ]) ? $options[ 'is_small_marged_alert' ] : null,
            'bg_img_alert' => !empty($options[ 'bg_img_alert' ]) ? $options[ 'bg_img_alert' ] : null,
            'bg_opacity_alert' => !empty($options[ 'bg_opacity_alert' ]) ? $options[ 'bg_opacity_alert' ] : null,
            'alert_text' => !empty($options[ 'alert_text' ]) ? $options[ 'alert_text' ] : null,
            'alert_cta' => !empty($options[ 'alert_cta' ]) ? $options[ 'alert_cta' ] : null,
            'alert_cta2' => !empty($options[ 'alert_cta2' ]) ? $options[ 'alert_cta2' ] : null,
        ];
    }



    /**
     * @return mixed|string
     * retourne soit la couleur primaire ou une couleur par défaut
     */
    public static function getColorFormField()
    {
        $primary_color = get_field('bg_form_field','options');

        if (get_field('override_colors') && get_field('bg_form_field')) {

            return get_field('bg_form_field');
        }
        if (!empty($primary_color)) {
            return $primary_color;
        }
        return '#e0e0e0';
    }


    public static function getPrimaryColor()
    {
        $primary_color = get_field('primary_color','options');

        if (get_field('override_colors') && get_field('primary_color')) {

            return get_field('primary_color');
        }
        if (!empty($primary_color)) {
            return $primary_color;
        }

        return '#e4032c';
    }

    /**
     * @return mixed|string
     * retourne soit la couleur secondaire ou une couleur par défaut
     */
    public static function getSecondaryColor()
    {
        $secondary_color = get_field('secondary_color','options');

        if (get_field('override_colors') && get_field('secondary_color')) {

            return get_field('secondary_color');
        }
        if (!empty($secondary_color)) {
            return $secondary_color;
        }
        return '#139fdd';
    }

    /**
     * @return mixed|string
     * retourne soit la couleur tertiare ou une couleur par défaut
     */
    public static function getTertiaryColor()
    {
        $tertiary_color = get_field('tertiary_color','options');

        if (get_field('override_colors') && get_field('secondary_color')) {

            return get_field('tertiary_color');
        }
        if (!empty($tertiary_color)) {
            return $tertiary_color;
        }

        return '#b1cfd8';
    }

    /**
     * @return mixed|string
     * retourne soit la couleur du fond du site ou une couleur par défaut
     */
    public static function getBackgroundColor()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (get_field('override_colors') && get_field('background_color')) {
            return get_field('background_color');
        }
        if (isset($options[ 'background_color' ]) && $options[ 'background_color' ]) {
            return $options[ 'background_color' ];
        }

        return '#ffffff';
    }

    /**
     * @return mixed|string
     * retourne soit la couleur tertiare ou une couleur par défaut
     */
    public static function getTextColor()
    {
        $options = GlobalHelper::getWebsiteSettings();

        if (get_field('override_colors') && get_field('text_color')) {
            return get_field('text_color');
        }
        if (isset($options[ 'text_color' ])) {
            return $options[ 'text_color' ];
        }

        return '#130234';
    }


    public static function getFontTitle()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (isset($options[ 'font_title' ]) && $options[ 'font_title' ]) {
            return $options[ 'font_title' ];
        }

        return 'jakarta';
    }


    public static function getFontGeneral()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (isset($options[ 'font_general' ]) && $options[ 'font_general' ]) {
            return $options[ 'font_general' ];
        }

        return 'jakarta';
    }


    public static function getShowSocials()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (isset($options[ 'show_socials' ]) && $options[ 'show_socials' ]) {
            return $options[ 'show_socials' ];
        }

        return false;
    }

    public static function getRounded()
    {
        $options = GlobalHelper::getWebsiteSettings();
        // if (!is_search()) {
        if (isset($options[ 'rounded' ]) && $options[ 'rounded' ]) {
            return $options[ 'rounded' ];
        }
        // }

        return false;
    }

    public static function getUppercase()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (isset($options[ 'uppercase' ]) && $options[ 'uppercase' ]) {
            return $options[ 'uppercase' ];
        }

        return false;
    }

    public static function getFooterColor()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (!is_search()) {
            if (isset($options[ 'footer_color' ]) && $options[ 'footer_color' ]) {
                return $options[ 'footer_color' ];
            }
        }

        return false;
    }

    public static function isDarkBackground()
    {
        GlobalHelper::getWebsiteSettings();
        $hex = ltrim(self::getBackgroundColor(), '#');    
        return !(hexdec($hex) > 0xffffff / 2);
    }

    public static function getFavicon()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (isset($options[ 'favicon' ]) && $options[ 'favicon' ]) {
            if ($options[ 'favicon' ][ 'mime_type' ] == 'image/svg+xml') {
                return $options[ 'favicon' ][ 'url' ];
            } else {
                return $options[ 'favicon' ][ 'sizes' ][ 'logo' ];
            }
        }

        return false;
    }
    public static function getLogo()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (isset($options[ 'logo' ]) && $options[ 'logo' ]) {
            if ($options[ 'logo' ][ 'mime_type' ] == 'image/svg+xml') {
                return $options[ 'logo' ][ 'url' ];
            } else {
                return $options[ 'logo' ][ 'sizes' ][ 'logo' ];
            }
        }

        return false;
    }

    public static function getLogoWhite()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if($options !== false){
            if (isset($options[ 'logo_white' ]) && $options[ 'logo_white' ]) {
                if ($options[ 'logo_white' ][ 'mime_type' ] == 'image/svg+xml') {
                    return $options[ 'logo_white' ][ 'url' ];
                } else {
                    return $options[ 'logo_white' ][ 'sizes' ][ 'logo' ];
                }
            }
            return false;
        }
    }

    public static function getLogoLoader()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (isset($options[ 'logo_loader' ]) && $options[ 'logo_loader' ]) {
            if ($options[ 'logo_loader' ][ 'mime_type' ] == 'image/svg+xml') {
                return $options[ 'logo_loader' ][ 'url' ];
            } else {
                return $options[ 'logo_loader' ][ 'sizes' ][ 'logo' ];
            }
        }

        return false;
    }
    public static function getImgBanner($id = null, $size = 'banner')
    {
        

        if ($id) {
            return GlobalHelper::getImageOrReplacement($size, $id);
        }
        if (is_single() || is_page()) {

            return GlobalHelper::getImageOrReplacement($size, get_the_ID());
        }
        if (is_archive()) {
            $img = get_field('header_img', 'options_' . get_post_type());
            if (!empty($img)) {
                return $img[ 'sizes' ][ $size ];
            }
        }

        $img = get_field('replacement_image', 'options');

        if (!empty($img)) {
            return $img[ 'sizes' ][ $size ];
        }

        return false;
    }


    public static function getBannerHeight($id = null)
    {
        if ($id) {
            return get_field('banner_height', $id);
        }
        if (is_single()) {
            return get_field('banner_height');
        }
        if (is_page()) {
            return get_field('banner_height');
        }
        if (is_archive()) {
            return get_field('banner_height', 'options_' . get_post_type());
        }
        if (is_404()) {
            return 'small';
        }

        return 'medium';
    }

    public static function getH1InHeader($id = null)
    {
        if ($id) {
            return get_field('h1_in_header', $id);
        }
        if (is_single()) {
            return get_field('h1_in_header');
        }
        if (is_page()) {
            return get_field('h1_in_header');
        }
        if (is_archive()) {
            return get_field('h1_in_header', 'options_' . get_post_type());
        }
        if (is_404()) {
            return 'true';
        }

        return 'true';
    }

    public static function getTitleInHeader($id = null)
    {
        if ($id) {
            return get_field('title_in_header', $id);
        }
        if (is_single()) {
            return get_field('title_in_header');
        }
        if (is_page()) {
            return get_field('title_in_header');
        }
        if (is_archive()) {
            return get_field('title_in_header', 'options_' . get_post_type());
        }
        if (is_404()) {
            return 'true';
        }

        return 'true';
    }
    public static function getLogoHeight()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (isset($options[ 'logo_height' ]) && isset($options[ 'logo_custom_height' ])) {
            return $options[ 'logo_height' ];
        } else {
            return '100';
        }
    }
}
