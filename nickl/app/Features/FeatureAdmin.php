<?php
namespace App\Features;
use function App\sage;
use Roots\Acorn\Application;
use App\Helpers\DeviceHelper;
use App\Helpers\GlobalHelper;
use App\Helpers\ThemeHelper;

class FeatureAdmin
{
    public function hooks()
    {
        add_action('wp_enqueue_scripts', [$this, 'dequeueUnwantedStyles'], 100);
        add_action('admin_menu', [$this, 'admins_remove_menus'], 999);
        add_filter('tiny_mce_before_init', [$this, 'customToolbarWysiwyg']);
        add_action('add_meta_boxes', [$this, 'removeMetaboxes'], 9999);
        add_action('login_enqueue_scripts', [$this, 'loginLogo']);
        add_filter('login_headerurl', [$this, 'logoLoginUrl']);
        add_filter('gettext', [$this, 'customWording'], 10, 3);
        add_filter('admin_body_class', [$this, 'addAdminBodyClasses']);
        add_filter('post_row_actions', [$this, 'add_duplicate_link'], 10, 2);
        add_filter('page_row_actions', [$this, 'add_duplicate_link'], 10, 2);
        add_action('admin_post_duplicate_post', [$this, 'duplicate_post']);
        add_action('admin_enqueue_scripts', [$this, 'delete_menu_security']);
        add_action('admin_head', [$this, 'custom_admin_bar_color']);
        add_action('wp_head', [$this, 'custom_admin_bar_color']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_script_acf_cols'], 100);
    }

    public function addAdminBodyClasses($classes): string
    {
        if (method_exists('App', 'addDeviceClass')) {
            $classes .= DeviceHelper::addDeviceClass();
        }
        return $classes;
    }

    public function customWording($translated_text, $untranslated_text, $domain)
    {
        if ('default' == $domain) {
            if ($translated_text == 'Mot de passe :') {
                return 'Mot de passe';
            }
        }

        return $translated_text;
    }

    public function loginLogo()
    {
        $fontGeneral = 'Montserrat';
        $fontTitle = 'Montserrat';

        echo view('partials.fonts.montserrat')->render();

        $url_replacement_img = get_field('replacement_image', 'options')['url'] ?? '';
        $url_logo_white = ThemeHelper::getLogoWhite() ?? '';
        $text_color = ThemeHelper::getTextColor() ?? '';
        $primary_color = ThemeHelper::getPrimaryColor() ?? '';
        $primary_bis_color = DeviceHelper::adjustBrightness(ThemeHelper::getPrimaryColor(), -.2) ?? '';
        $secondary_color = ThemeHelper::getsecondaryColor() ?? '';
        $secondary_bis_color = DeviceHelper::adjustBrightness(ThemeHelper::getsecondaryColor(), -.2) ?? '';
        $tertiary_color = ThemeHelper::getTertiaryColor() ?? '';
        $form_color = ThemeHelper::getColorFormField() ?? '';
        echo ThemeHelper::getRounded() ? '<div id="is_rounded"></div>' : null;
        echo '<style>.bg_login { background-image: url("' . $url_replacement_img . '") !important; }</style>';
        echo '<style>#login h1 a, .login h1 a { background-image: url("' . $url_logo_white . '") !important; }</style>';
        echo "<style>:root {
            --color-default: " . $text_color . ";
            --color-primary: " . $primary_color . ";
            --color-primary-bis: " . $primary_bis_color . ";
            --color-secondary: " . $secondary_color . ";
            --color-secondary-bis: " . $secondary_bis_color . ";
            --color-tertiary: " . $tertiary_color . ";
            --color-form: " . $form_color . ";
            --font-general: '" . $fontGeneral . "';
            --font-title: '" . $fontTitle . "';
        }</style>";

        wp_enqueue_style(
            'custom-login',
            WP_HOME . '/app/themes/nickl/resources/css_login/custom-login.css',
            ['login']
        );
        wp_enqueue_script('sage/login.js', get_template_directory_uri() . '/resources/scripts/login.js', false, null);
    }


    public function logoLoginUrl()
    {
        return home_url();
    }
    function custom_admin_bar_color()
    {
        if (defined('NICKL_PDV') && NICKL_PDV === 'PDV') {
            $coloradminbar = '#314d65';
        } else {
            $coloradminbar = '#224f5a';
        }

        echo '<style>
            #wpadminbar {
                background-color: ' . $coloradminbar . '!important;
            }
            #wpadminbar .ab-item,
            #wpadminbar .ab-label,
            #wpadminbar .ab-icon {
                color: #fff !important;
            }
        </style>';
    }

    public function removeMetaboxes()
    {
        if (!is_super_admin()) {
            remove_meta_box('aam-access-manager', null, 'advanced');
        }
    }

    public function admins_remove_menus()
    {
        if (!is_super_admin()) {
            remove_submenu_page('tools.php', 'ms-delete-site.php'); // Delete Site
        }
    }

    public function dequeueUnwantedStyles()
    {
        wp_dequeue_style('wp-block-library');
        wp_dequeue_style('wp-block-library-theme');
        wp_dequeue_style('wc-block-style');
    }

    public function acfGoogleMapApiKey()
    {
        acf_update_setting('google_api_key', 'xxxxxxxxx');
    }

    public function customToolbarWysiwyg($init_array)
    {
        $init_array['block_formats'] = "Titre 1=h1; Titre 2=h2; Titre 3=h3; Titre 4=h4; Titre 5=h5; Mention=h6; Paragraph=p;";

        return $init_array;
    }

    public function listButtonMCE($buttons_array)
    {
        $this->mce_buttons = [
            'formatselect',
            'bold',
            'italic',
            'underline',
            'bullist',
            'numlist',
            'blockquote',
            'alignleft',
            'aligncenter',
            'alignright',
            'alignjustify',
            'link',
            'wp_more',
            'wp_adv',
            'dfw'
        ];

        return $this->mce_buttons;
    }

    public function my_mce_buttons_2($buttons)
    {
        array_unshift($buttons, 'styleselect');
        return $buttons;
    }
    public function add_duplicate_link($actions, $post)
    {
        if (current_user_can('edit_posts')) {
            $actions['duplicate'] = '<a href="' . wp_nonce_url(admin_url('admin-post.php?action=duplicate_post&post_id=' . $post->ID), 'duplicate_post_nonce') . '">Dupliquer</a>';
        }
        return $actions;
    }
    public function duplicate_post()
    {
        if (!isset($_GET['post_id'], $_GET['_wpnonce']) || !wp_verify_nonce($_GET['_wpnonce'], 'duplicate_post_nonce')) {
            wp_die('Accès non autorisé');
        }
        $post_id = intval($_GET['post_id']);
        $post = get_post($post_id);
        if (!$post) {
            wp_die('Article introuvable');
        }
        if (!current_user_can('edit_posts', $post_id)) {
            wp_die('Permissions insuffisantes');
        }
        $new_post = [
            'post_title' => $post->post_title . ' (Copie)',
            'post_content' => $post->post_content,
            'post_excerpt' => $post->post_excerpt,
            'post_status' => 'draft',
            'post_author' => get_current_user_id(),
            'post_type' => $post->post_type
        ];
        $new_post_id = wp_insert_post($new_post);
        $post_meta = get_post_meta($post_id);
        foreach ($post_meta as $key => $value) {
            update_post_meta($new_post_id, $key, maybe_unserialize($value[0]));
        }
        wp_redirect(admin_url('edit.php?post_type=' . $post->post_type));
        exit;
    }

    public function delete_menu_security($hook)
    {
        if ($hook !== 'nav-menus.php') {
            return;
        }
        ?>
        <script type="text/javascript">
            document.addEventListener('DOMContentLoaded', function () {
                const deleteButtons = document.querySelectorAll('#delete-action a.submitdelete');

                deleteButtons.forEach(function (button) {
                    button.addEventListener('click', function (event) {
                        if (!confirm('⚠️ Êtes-vous sûr de vouloir supprimer ce menu ? Cette action est irréversible.')) {
                            event.preventDefault();
                        }
                    });
                });
            });
        </script>
        <?php
    }
    public function enqueue_script_acf_cols()
    {
        // On se greffe sur sage/admin.js qui est déjà chargé par FeatureDashboard
        wp_localize_script('sage/admin.js', 'nicklConfig', [
            'NICKL_PDV' => defined('NICKL_PDV') ? NICKL_PDV : null,
            'is_woocommerce' => true,
        ]);
    }
}
