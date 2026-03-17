<?php

namespace App\Helpers;

class GlobalHelper
{
    protected static $options;

    protected static $sectionCounter = 1;

    public static function getAutoSectionId(string $prefix = 'section'): string
    {
        return $prefix . '_' . self::$sectionCounter++;
    }


    public static function getWebsiteSettings()
    {

        $fields = get_fields('options');
        return $fields;
    }

    public static function getSeamlessMenu()
    {
        $options = self::getWebsiteSettings();
        if (isset($options['menu_seamless']) && $options['menu_seamless']) {
            if (function_exists('is_woocommerce') && is_woocommerce()) {
                if (!is_search() && !is_404() && !is_archive() && !is_single() && !is_cart() && !is_checkout() && get_field('header_type') != 'none') {
                    return $options['menu_seamless'];
                }
            } else {
                if (!is_search() && !is_404() && !is_archive() && !is_single() && get_field('header_type') != 'none') {
                    return $options['menu_seamless'];
                }
            }
        }

        return false;
    }

    public static function getTitle($id = null)
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
                return $postType->label;
            }
            return $title;
        }
        if (is_search()) {
            //return sprintf(bcn_pll('Résultat de recherche pour %s'), get_search_query());
            return '';
        }
        if (is_404()) {
            return bcn_pll('Page non trouvée');
        }
        return get_the_title();
    }

    public static function getImageOrReplacement($size = 'url', $pid = null, $array = null)
    {
        // Vérifie si une image est fournie sous forme de tableau
        if (is_array($array)) {
            return ["url" => self::getImageSize($array, $size), "alt" => $array["alt"]];
        }

        // Vérifie si un post ID est fourni et a une image mise en avant
        if ($pid && has_post_thumbnail($pid)) {

            return ["url" => self::getImageSize(get_the_post_thumbnail_url($pid, $size), $size), "alt" => get_post_meta(get_post_thumbnail_id($pid), '_wp_attachment_image_alt', true)];

        }

        // Vérifie si $pid est en réalité un tableau contenant une image
        if (is_array($pid)) {
            return self::getImageSize($pid, $size);
        }

        // Récupère l'image de remplacement depuis les options du site
        $replacementImage = get_field('replacement_image', 'options');

        if (is_array($replacementImage)) {
            return ["url" => self::getImageSize($replacementImage, $size), "alt" => $replacementImage["alt"]];
        }

        return false; // Aucune image trouvée
    }

    /**
     * Récupère l'URL de l'image dans la bonne taille.
     */
    private static function getImageSize($image, $size)
    {
        if (is_string($image)) {
            return $image; // Si c'est déjà une URL, la retourner directement
        }

        if (isset($image['sizes'][$size]) && !empty($image['sizes'][$size])) {
            return $image['sizes'][$size];
        }

        return $image['url'] ?? false;
    }
    public static function displaySvg($icon, $path = null)
    {
        $iconWithExt = str_ends_with($icon, '.svg') ? $icon : $icon . '.svg';

        if ($path) {
            $path = rtrim($path, '/') . '/' . $iconWithExt;
        } else {
            $path = resource_path("images/svg/{$iconWithExt}");
        }

        if ($path) {
            return file_get_contents($path);
        }

        return '';
    }
    public static function displaySvgPng($img)
    {
        $svg_url = wp_get_attachment_url($img);
        if ($svg_url && pathinfo($svg_url, PATHINFO_EXTENSION) === 'svg') {
            $svg_path = get_attached_file($img);
            if (file_exists($svg_path)) {
                $svg_content = file_get_contents($svg_path);
                $svg_content = trim($svg_content);
                return $svg_content;
            }
        }
    }
    public static function displayBackground($url)
    {
        $extension = strtolower(pathinfo(parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));

        if (($extension === 'svg') && get_field('override_colors')) {
            $background = "mask-image: url($url)";
        } else {
            $background = "background-image: url($url)";
        }
        return $background;
    }
    public static function isWoocommercePage($pid = null)
    {
        if (empty($pid)) {
            $pid = get_the_ID();
        }

        if (!class_exists('WooCommerce')) {
            return false;
        }

        // Vérifie les pages spécifiques WooCommerce
        $checkoutPayPage = is_checkout_pay_page();
        $product = is_singular('product');
        $endPointWP = is_wc_endpoint_url();
        $isProductCategory = is_product_category();
        $isProductTag = is_product_tag();
        $isShop = is_shop();

        $wcPagesID = [
            wc_get_page_id('shop'),
            wc_get_page_id('cart'),
            wc_get_page_id('checkout'),
            wc_get_page_id('myaccount'),
        ];

        if (
            $checkoutPayPage ||
            $product ||
            $endPointWP ||
            $isProductCategory ||
            $isProductTag ||
            $isShop ||
            in_array($pid, $wcPagesID)
        ) {
            return true;
        }

        return false;
    }
    public static function getFrenchDate($date, $date_format = 'j F Y', $withHours = true)
    {

        if ($withHours) {
            $date_string = bcn_pll('%1$s');
            return sprintf(
                $date_string,
                date_i18n($date_format, strtotime($date))
            );
        } else {
            $date_string = bcn_pll('%1$s at %2$s');
            $time_format = 'H:i';
            return sprintf(
                $date_string,
                date_i18n($date_format, strtotime($date)),
                date_i18n($time_format, strtotime($date))
            );
        }
    }
    public static function getTerms($pid, $taxo, $separator = '-')
    {
        $terms = get_the_terms($pid, $taxo);
        $return = null;

        if (is_array($terms) && !empty($terms)) {
            $i = 1;
            $count = count($terms);

            foreach ($terms as $term) {
                $return .= $term->name;
                if ($count > 1) {
                    if ($i != $count) {
                        $return .= ' ' . $separator . ' ';
                    }
                }

                $i++;
            }
        }

        return $return;
    }
    public static function slugify($string, $delimiter = '-')
    {
        $oldLocale = setlocale(LC_ALL, '0');
        setlocale(LC_ALL, 'fr_FR.UTF-8');
        $clean = iconv('UTF-8', 'ASCII//TRANSLIT', $string);
        $clean = preg_replace("/[^a-zA-Z0-9\/_|+ -]/", '', $clean);
        $clean = strtolower($clean);
        $clean = preg_replace("/[\/_|+ -]+/", $delimiter, $clean);
        $clean = trim($clean, $delimiter);
        setlocale(LC_ALL, $oldLocale);
        return $clean;
    }
    public static function randomSlug()
    {
        $alphabet = 'abcdefghijklmnopqrstuvwxyz';
        $pass = []; //remember to declare $pass as an array
        $alphaLength = strlen($alphabet) - 1; //put the length -1 in cache
        for ($i = 0; $i < 8; $i++) {
            $n = rand(0, $alphaLength);
            $pass[] = $alphabet[$n];
        }
        return implode($pass); //turn the array into a string
    }
    public static function getId($module): string
    {
        $idBloc = $module['id_bloc'] ?? '';
        $mots = preg_split('/\s+/', $idBloc);
        $ids = [];

        foreach ($mots as $mot) {
            if (strpos($mot, '.') !== 0) {
                $ids[] = $mot;
            }
        }

        $idConcat = implode('-', $ids);
        return $idConcat ? self::slugify($idConcat) : self::getAutoSectionId();
    }

    /**
     * Génère les classes personnalisées du module CSS si présentes.
     */
    public static function getCustomClasses($module): string
    {
        $idBloc = $module['id_bloc'] ?? '';
        $mots = preg_split('/\s+/', $idBloc);
        $classes = [];

        foreach ($mots as $mot) {
            if (strpos($mot, '.') === 0) {
                $classes[] = ltrim($mot, '.');
            }
        }

        return implode(' ', $classes);
    }
    public static function getVideoID($url, $src = 0)
    {
        $output = parse_url($url);
        if ($src === 1) {
            $output = parse_url($url);
            $host = $output['host'] ?? '';
            $path = $output['path'] ?? '';
            $query = $output['query'] ?? '';

            if (strpos($host, 'youtube.com') !== false && strpos($path, '/watch') === 0) {
                parse_str($query, $parsedQuery);
                return $parsedQuery['v'] ?? null;
            }
            if (strpos($host, 'youtube.com') !== false && preg_match('#^/shorts/([^/?]+)#', $path, $matches)) {
                return $matches[1];
            }
            if (strpos($host, 'youtu.be') !== false && preg_match('#^/([^/?]+)#', $path, $matches)) {
                return $matches[1];
            }
            return null;
        } elseif ($src === 2) {
            $parsedUrl = $output['path'] ?? '';
            $parts = explode('/', trim($parsedUrl, '/'));
            return $parts[0] ?? null;
        } else {
            $parsedUrl = $output['path'] ?? '';
            $parts = explode('/', trim($parsedUrl, '/'));
            return $parts[1] ?? null;
        }
    }


    public static function getShopSidebar($term = null, $terms = null)
    {

        if (get_field('shop_sidebar', 'options') !== null && get_field('shop_sidebar', 'options')) {
            if ((!empty($terms)) || ($term->name == 'product')) {
                return get_field('shop_sidebar', 'options');
            } elseif (!empty($term) && !empty(get_term_children($term->term_id, 'product_cat'))) {
                return get_field('shop_sidebar', 'options');
            }
        }
        return false;
    }

    public static function extractLayouts(array $modules = []): array
    {
        $layouts = [];
        $visitedReusable = [];

        // Fonction pour la récursion — On envoie un tableau et la fonction parcours le tableau
        $walk = function ($node) use (&$walk, &$layouts, &$visitedReusable) {
            if (is_array($node)) {

                // Si on est sur un module ACF
                if (isset($node['acf_fc_layout']) && is_string($node['acf_fc_layout'])) {
                    $layout = $node['acf_fc_layout'];
                    $layouts[] = $layout;

                    // Règle spécifique déjà présente
                    if ($layout === 'gallery') {
                        $layouts[] = 'images-slider';
                    }

                    // Suivre un bloc réutilisable
                    if ($layout === 'reusable-bloc' && !empty($node['bloc_id'])) {
                        $blocId = $node['bloc_id'];

                        // Protection anti-boucle
                        if (!in_array($blocId, $visitedReusable, true)) {
                            $visitedReusable[] = $blocId;

                            $blocFields = get_fields($blocId);
                            if (!empty($blocFields['flexible_modules']) && is_array($blocFields['flexible_modules'])) {
                                // On parcourt récursivement tous les modules du bloc
                                foreach ($blocFields['flexible_modules'] as $reusableModule) {
                                    $walk($reusableModule);
                                }
                            }
                        }
                    }
                }

                // Parcourir tous les enfants (couvre columns-tab, repeaters, groupes, etc.)
                foreach ($node as $child) {
                    if (is_array($child)) {
                        $walk($child);
                    }
                }
            } elseif (is_iterable($node)) {
                foreach ($node as $child) {
                    $walk($child);
                }
            }
        };

        // Footer bloc
        $options = get_fields('options');
        if (!empty($options['footer_custom_bloc'])) {
            $footerBlocId = $options['footer_custom_bloc'];
            $footerFields = get_fields($footerBlocId);
            if (!empty($footerFields['flexible_modules']) && is_array($footerFields['flexible_modules'])) {
                foreach ($footerFields['flexible_modules'] as $footerModule) {
                    $walk($footerModule);
                }
            }
        }
        if (!empty($options['footer_pdv_columns'])) {
            foreach ($options['footer_pdv_columns'] as $footer_pdv_custom_bloc) {
                if (($footer_pdv_custom_bloc['footer_pdv_column'] === 'reusable-bloc') && !empty($footer_pdv_custom_bloc['footer_pdv_custom_bloc'])) {
                    $footerBlocId = $footer_pdv_custom_bloc['footer_pdv_custom_bloc'];
                    $footerFields = get_fields($footerBlocId);
                    if (!empty($footerFields['flexible_modules']) && is_array($footerFields['flexible_modules'])) {
                        foreach ($footerFields['flexible_modules'] as $footerModule) {
                            $walk($footerModule);
                        }
                    }
                }
            }
        }


        foreach ($modules as $module) {
            $walk($module);
        }

        $plugins_pdv = ['contact_elus', 'contact_elus_maire', 'meteo', 'contribution_citoyenne', 'one-click-services'];
        $layouts = array_diff($layouts, $plugins_pdv);

        $reusableBloc = 'reusable-bloc';
        $hasReusableBloc = array_search($reusableBloc, $layouts);
        if ($hasReusableBloc) {
            unset($layouts[array_search($reusableBloc, $layouts)]);
        }

        return array_values(array_unique($layouts));
    }
    public static function obfuscate_email($email, $label = null)
    {
        $encoded_email = '';
        for ($i = 0; $i < strlen($email); $i++) {
            $encoded_email .= '&#' . ord($email[$i]) . ';';
        }

        if ($label === null) {
            $label = $encoded_email;
        } else {
            // on encode aussi le label si c'est une adresse
            $encoded_label = '';
            for ($i = 0; $i < strlen($label); $i++) {
                $encoded_label .= '&#' . ord($label[$i]) . ';';
            }
            $label = $encoded_label;
        }

        return '<a href="mailto:' . $encoded_email . '" class="btn btn-tertiary mail">' . $label . '</a>';
    }
}
