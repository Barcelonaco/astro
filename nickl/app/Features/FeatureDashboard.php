<?php

namespace App\Features;
use App\Helpers\ThemeHelper;
use function App\asset_path;
use function App\sage;
use Bandco\Core\WordplateInit;
use App\Posttype\CptReferences;
use App\Posttype\CptNews;
use App\Helpers\GlobalHelper;

require_once   dirname(__DIR__,2) . '/vendor/mobiledetect/mobiledetectlib/src/MobileDetect.php';

class FeatureDashboard
{
    /**
     * @var bool
     * enable custom dasboard
     */
    private bool $enableCustomDashbord = true;

    /**
     * @var bool
     * enable fullscreen dashboard on desktop
     */
    private bool $forceFullScreenOnDesktop = false;
    /**
     * @var bool
     * enable fullscreen dashboard on tablet
     */
    private bool $forceFullScreenOnTablet = true;
    /**
     * @var bool
     * enable fullscreen dashboard on mobile
     */
    private bool $forceFullScreenOnMobile = true;

    /**
     * @return void
     */
    public function hooks()
    {
      add_action('wp_dashboard_setup', [$this, 'init'], 99999);
      add_action('admin_init', [$this, 'run'], 99999);
      add_action('admin_enqueue_scripts', [$this, 'enqueueAdminStyles']);
      add_action('admin_menu', [$this, 'addCustomMenuUrl']);
      add_action('admin_bar_menu', [$this, 'custom_toolbar_link'], 999);
      add_action('admin_init', [$this, 'nicklDarkAdminColorScheme']);
      add_action('admin_init', [$this, 'nicklWhiteAdminColorScheme']);
      add_filter('get_user_option_admin_color', [$this, 'changeDefaultAdminColor'], 5);
    }

    public function changeDefaultAdminColor($result)
    {
        global $_wp_admin_css_colors;
        foreach ($_wp_admin_css_colors as $k => $colors) {
            if (!in_array($k, ['nickl_white', 'nickl_dark'])) {
                unset($_wp_admin_css_colors[$k]);
            }
        }

        if (!in_array($result, ['nickl_white', 'nickl_dark'])) {
            $result = 'nickl_dark';
        }

        return $result;
    }

    public function nicklWhiteAdminColorScheme()
    {
        //Get the theme directory
        $theme_dir = get_stylesheet_directory_uri();
        //NICKL WHITE
        if (defined('NICKL_PDV') && NICKL_PDV === 'PDV') {
            wp_admin_css_color('nickl_white', 'Nickl White',
                $theme_dir . '/resources/styles/admin/themes/nickl_white.css',
                ['#FFFFFF', '#223647', '#FF0000', '#92c25a']
            );
        } else {
            wp_admin_css_color('nickl_white', 'Nickl White',
                $theme_dir . '/resources/styles/admin/themes/nickl_white.css',
                ['#FFFFFF', '#224F5A', '#FF0000', '#3EE98D']
            );
        }
    }

    public function nicklDarkAdminColorScheme()
    {
        //Get the theme directory
        $theme_dir = get_stylesheet_directory_uri();
        //NICKL DARK
        if (defined('NICKL_PDV') && NICKL_PDV === 'PDV') {
            wp_admin_css_color('nickl_dark', 'Nickl Dark',
                $theme_dir . '/resources/styles/admin/themes/pdv_dark.css',
                ['#223647', '#fff', '#FF0000', '#92c25a']
            );
        } else {
            wp_admin_css_color('nickl_dark', 'Nickl Dark',
                $theme_dir . '/resources/styles/admin/themes/nickl_dark.css',
                ['#224F5A', '#fff', '#FF0000', '#3EE98D']
            );
        }
    }

    public function custom_toolbar_link($wp_admin_bar)
    {
        if(defined('NICKL_PDV') && NICKL_PDV === 'PDV') {
            if(is_multisite()){
                $favicon_url = "https://place-du-village.fr/app/uploads/2021/09/favicon.png";
            }
            else{
                $favicon_url = ThemeHelper::getFavicon() ?? "https://place-du-village.fr/app/uploads/2021/09/favicon.png";
            }
        }
        else{
            if(is_multisite()){
                $favicon_url = "https://nickl.fr/app/uploads/2025/08/cropped-favicon-32x32.png";
            }
            else{
                $favicon_url = ThemeHelper::getFavicon() ?? "https://nickl.fr/app/uploads/2025/08/cropped-favicon-32x32.png";
            }
        }
       if (is_admin()) {
            $wp_admin_bar->add_node([
                'id'    => 'dashboard',
                'title' => '<img src="'. $favicon_url .'">Voir mon site',
                'href'  => home_url(),
            ]);
        }
        else{
            $wp_admin_bar->add_node([
                'id'    => 'dashboard',
                'title' => '<img src="'. $favicon_url .'">Tableau de bord',
                'href'  => admin_url() . 'index.php',
            ]);
        }
    }

    /**
     * @return bool
     * determine if dashboard need to display in fullscreen
     */
    public function isFullScreen()
    {
        $currentDevice = new \Mobile_Detect();

        if (!$currentDevice->isTablet() && !$currentDevice->isMobile()) {
            return $this->forceFullScreenOnDesktop;
        } elseif ($currentDevice->isTablet()) {
            return $this->forceFullScreenOnTablet;
        } elseif ($currentDevice->isMobile()) {
            return $this->forceFullScreenOnMobile;
        }

        return false;
    }

    /**
     * @return void
     * Add custom link in adminMenu
     */
    public function addCustomMenuUrl()
    {
        // Ajoute le lien pour vider les caches (si le plugin est activé)
        if (is_plugin_active_for_network('w3-total-cache/w3-total-cache.php')) {
            $page_title = 'Purger les caches';
            $menu_title = 'Vider le cache';
            $capability = 'read';
            $menu_slug = wp_nonce_url(
                network_admin_url('admin.php?page=w3tc_feature_showcase'),
                'w3tc'
            );
            $callback = '';
            $icon_url = 'dashicons-update';
            $position = 60;
            add_menu_page($page_title, $menu_title, $capability, $menu_slug, $callback, $icon_url, $position);
        }
    }

    /**
     * @return void
     */
    public function init()
    {
        $this->removeDashboardWidget();
        $this->addNicklWidget();
    }

    /**
     * @return void
     */
    public function run()
    {
        if (!is_super_admin()) {
            $this->disableDragMetabox();
        }
    }

    /**
     * @return void
     */
    public function variablesCss()
    {
        echo "<style>
                :root {
                    --color-default: " . ThemeHelper::getTextColor() . ";
                    --color-primary: " . ThemeHelper::getPrimaryColor() . ";
                    --color-primary-bis: " . ThemeHelper::adjustBrightness(ThemeHelper::getPrimaryColor(), -.2) . ";
                    --color-secondary: " . ThemeHelper::getsecondaryColor() . ";
                    --color-secondary-bis: " . ThemeHelper::adjustBrightness(ThemeHelper::getsecondaryColor(), -.2) . ";
                    --color-tertiary: " . ThemeHelper::getTertiaryColor() . ";
                    --color-form: " . ThemeHelper::getColorFormField() . ";
                }
            </style>";
    }

    /**
     * @return void
     */
    public function forcedCss()
    {
        echo "<style>
                #screen-meta-links {
                  display: none !important;
                  visibility: hidden !important;
                }

                #wpfooter {
                  display: none !important
                }

                #nickl-widget-dashboard .hndle {
                  cursor: default;
                }

                #nickl-widget-dashboard .handle-actions {
                  display: none;
                  visibility: hidden;
                }
            </style>";

        if ($this->isFullScreen()) {
            echo "<style>
                html {
                  margin-top: 0 !important;
                }

                * html body {
                  margin-top: 0 !important;
                }
                html.wp-toolbar {
                  padding-top: 0 !important;
                }
                #wpadminbar {
                  display: none !important
                }

                #wpfooter {
                  display: none !important
                }

                #wpwrap #wpcontent {
                  margin-left: 0;
                }

                #adminmenumain,
                #adminmenuback,
                #adminmenuwrap {
                  display: none !important;
                  visibility: hidden !important;
                }
            </style>";
        }
    }
    /**
     * @return void
     */
    public function disableDragMetabox()
    {
        // wp_deregister_script('postbox');
    }

    /**
     * @return void
     * Supprime tous les widgets
     */
    public function removeDashBoardWidget()
    {
        global $wp_meta_boxes;
        $wp_meta_boxes['dashboard']['normal']['core'] = [];
        $wp_meta_boxes['dashboard']['side']['core'] = [];
        remove_meta_box('wc_admin_dashboard_setup', 'dashboard', 'normal');
    }

    /**
     * @return void
     * Ajout de notre widget
     */
    public function addNicklWidget()
    {
        wp_add_dashboard_widget(
            'nickl-widget-dashboard',
            'Bienvenue dans votre interface simplifiée',
            [$this, 'customWidgetRender']
        );
    }

    /**
     * @return void
     */
    public function customWidgetRender()
    {
        $reference = new CptReferences();
        $news = new CptNews();

        echo view('widget.dashboard_shortcut', [
            'references' => $reference,
            'news' => $news,
        ]);
    }
    /**
     * @return void
     */
    public function enqueueAdminStyles()
    {
        wp_enqueue_style('sage/admin.scss', asset('css/admin.css'), false, null);
        wp_enqueue_script('sage/admin.js', asset('js/admin.js'), false, true);
    }
}
