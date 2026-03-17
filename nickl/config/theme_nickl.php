<?php

if (!function_exists('update_menu_slug_on_page_update')) {
    function update_menu_slug_on_page_update($post_ID, $post_after, $post_before)
    {

        if ($post_after->post_type !== 'page' || $post_after->post_name === $post_before->post_name) {
            return;
        }

        $menus = wp_get_nav_menus();

        foreach ($menus as $menu) {
            $menu_items = wp_get_nav_menu_items($menu->term_id);

            if (!$menu_items)
                continue;

            foreach ($menu_items as $menu_item) {
                if ($menu_item->object_id == $post_ID) {
                    $args = [
                        'menu-item-title' => $menu_item->title, // Garde le même titre
                        'menu-item-url' => get_permalink($post_ID), // Met à jour l'URL
                        'menu-item-object' => 'page', // Associe toujours à une page
                        'menu-item-object-id' => $post_ID, // Associe à l'ID de la page
                        'menu-item-type' => 'post_type', // Définit que c'est une page
                        'menu-item-parent-id' => $menu_item->menu_item_parent, // Garde la même hiérarchie
                        'menu-item-position' => $menu_item->menu_order, // Garde la même position
                        'menu-item-status' => 'publish', // Assure que l'élément reste visible
                    ];

                    wp_update_nav_menu_item($menu->term_id, $menu_item->ID, $args);
                }
            }
        }
    }
    add_action('post_updated', 'update_menu_slug_on_page_update', 10, 3);
}

if (!function_exists('clean_wp_assets')) {
    function clean_wp_assets()
    {
        wp_dequeue_style('wp-block-library');
        wp_dequeue_script('jquery');
    }

    add_action('wp_enqueue_scripts', 'clean_wp_assets', 99);
}

add_action('admin_head', function () {
    global $post;

    if (!is_admin() || !$post) {
        return;
    }

    $excluded_post_types = array('actualites', 'evenements', 'references');

    if (in_array($post->post_type, $excluded_post_types, true)) {
        echo '<style>
            #submitpost a[href*="w3tc_flush_post"] {
                display: none !important;
            }
        </style>';
    }
});

// Désactiver plugin Classic Editor
add_filter('use_block_editor_for_post', '__return_false', 10);

add_filter('use_widgets_block_editor', '__return_false');

add_action('admin_init', function () {
    remove_post_type_support('post', 'editor');
    add_post_type_support('post', 'editor');
});

// Tri du menu --- custom post puis par ASC
add_action('admin_menu', function () {
    global $menu;

    // Slugs des CPT à placer en haut
    $cpts_en_premier = [
        'index.php',
        'edit.php?post_type=page',
        'edit.php?post_type=actualites',
        'edit.php?post_type=evenements',
        'edit.php?post_type=references'
    ];
    if (defined('NICKL_PDV') && NICKL_PDV === 'PDV') {
        $cpts_en_premier = [
            ...$cpts_en_premier,
            'edit.php?post_type=alertes',
            'edit.php?post_type=conseils_municipaux',
            'edit.php?post_type=actes-administratifs',
            'edit.php?post_type=associations',
            'edit.php?post_type=commerces',
            'edit.php?post_type=santes',
        ];
    }
    $cpts_en_premier = [
        ...$cpts_en_premier,
        'upload.php',
        'admin.php?page=gf_edit_forms',
        'admin.php?page=acymailing_dashboard',
        'edit.php?post_type=reusable_block',
        'admin.php?page=params'
    ];
    $new_menu = [];
    $cpt_items = [];
    $other_items = [];

    // Séparer les CPT et le reste
    foreach ($menu as $item) {
        $slug = $item[2];

        if (in_array($slug, $cpts_en_premier)) {
            $cpt_items[$slug] = $item;
        } else {
            $other_items[$slug] = $item;
        }
    }

    // Ajouter les CPT dans l’ordre voulu
    foreach ($cpts_en_premier as $slug) {
        if (isset($cpt_items[$slug])) {
            $new_menu[] = $cpt_items[$slug];
        }
    }

    // ➖ Ajouter un séparateur
    $new_menu[] = ['', 'read', 'separator-cpt', '', 'wp-menu-separator'];

    // Trier les autres éléments par nom
    uasort($other_items, function ($a, $b) {
        return strcasecmp($a[0], $b[0]);
    });

    // Ajouter les éléments restants
    foreach ($other_items as $item) {
        $new_menu[] = $item;
    }

    // Remplacer le menu global
    $menu = $new_menu;
}, 999);


// On force l'affichage de certaines options dans options de l'écran menus
add_action('default_hidden_meta_boxes', function ($hidden, $screen) {
    if ($screen->id === 'nav-menus') {

        return array_diff($hidden, [
            'add-post-type-page',
            'add-post-type-evenements',
            'add-post-type-actualites',
            'add-post-type-references',
            'add-custom-links',
            'add-event-type',
            'add-news_categorie',
            'add-ref_categorie',
        ]);
    }
    return $hidden;
}, 10, 2);

// Quand un utilisateur est crée : on force le décochement des options pour les options de l'écran des menus
add_action('user_register', function ($user_id) {

    $meta_boxes_to_hide = array(
        'add-post-type-post',
        'add-post-type-reusable_block',
        'add-category',
        'add-post_tag'
    );

    update_user_meta($user_id, 'metaboxhidden_nav-menus', $meta_boxes_to_hide);
});

// Personnalisation bar des menus admin wordpress
add_action('admin_bar_menu', function ($wp_admin_bar) {
    $user = wp_get_current_user();

    //$wp_admin_bar->remove_node('archive');
    $wp_admin_bar->remove_node('dashboard');
    $wp_admin_bar->remove_node('new-content');
    $wp_admin_bar->remove_node('wpseo-menu');
    $wp_admin_bar->remove_node('my-site');

    $wp_admin_bar->remove_node('w3tc');


    if (is_admin()) {
        $wp_admin_bar->add_node([
            'id' => 'dashboard',
            'title' => 'Voir mon site',
            'href' => home_url(),
        ]);

    } else {
        $wp_admin_bar->add_node([
            'id' => 'dashboard',
            'title' => 'Tableau de bord',
            'href' => admin_url() . 'index.php',
        ]);
    }
    if (is_multisite() && is_super_admin($user->ID)) {
        $wp_admin_bar->add_node([
            'id' => 'my-site',
            'title' => 'Voir mes sites',
            'href' => admin_url() . 'network/sites.php',
        ]);
    }
    $wp_admin_bar->add_node([
        'id' => 'new-content',
        'title' => 'Créer',
        'href' => admin_url() . 'post-new.php',

    ]);

    if (function_exists('is_woocommerce') && is_woocommerce()) {
        $wp_admin_bar->add_node([
            'id' => 'archive',
            'title' => 'Voir les produits',
            'href' => admin_url() . '/boutique',

        ]);
    }


    // Remove définitivement
    $wp_admin_bar->remove_node('wp-logo');
    $wp_admin_bar->remove_node('woocommerce-site-visibility-badge');
    $wp_admin_bar->remove_node('imagify');
    $wp_admin_bar->remove_node('customize');
    $wp_admin_bar->remove_node('site-name');
    $wp_admin_bar->remove_node('my-sites');
    $wp_admin_bar->remove_node('updates');
    $wp_admin_bar->remove_node('root-default');
}, 100);

// Enlever Imagify dans bar des menus admin wordpress
add_filter('pre_get_imagify_option_admin_bar_menu', '__return_false');

// Remplacer url pour les médias dans admin
add_filter('wp_get_attachment_url', function ($url, $post_id) {
    // On récupère le domaine actuel
    $current_domain = parse_url(home_url(), PHP_URL_HOST);

    // On parse l’URL originale
    $original = parse_url($url);

    // Si le host est différent (cas typique du multisite), on le remplace
    if ($original['host'] !== $current_domain) {
        $url = str_replace($original['host'], $current_domain, $url);
    }

    return $url;
}, 10, 2);

// Enregistrer favicon, nom du site et baseline dans bdd depuis params site
add_action('acf/save_post', function ($post_id) {
    if ($post_id !== 'options') {
        return;
    }

    // Récupérer les valeurs ACF
    $site_title = get_field('title_site', 'option');
    $baseline = get_field('baseline_site', 'option');
    $favicon_id = get_field('favicon', 'option'); // ID de l’image

    // Synchroniser avec les options WordPress natives
    if ($site_title) {
        update_option('blogname', $site_title);
    }

    if ($baseline) {
        update_option('blogdescription', $baseline);
    }

    if ($favicon_id) {
        update_option('site_icon', $favicon_id['ID']);
    }
});

// Synchronisation Customizer et params du site
add_action('update_option_blogname', function ($old_value, $value) {
    update_field('title_site', $value, 'option');
}, 10, 2);
add_action('update_option_blogdescription', function ($old_value, $value) {
    update_field('baseline_site', $value, 'option');
}, 10, 2);
add_action('update_option_site_icon', function ($old_value, $value) {
    update_field('favicon', $value, 'option');
}, 10, 2);

if (!function_exists('custom_login_redirect')) {
    function custom_login_redirect($redirect_to, $requested_redirect_to, $user)
    {
        if (is_wp_error($user)) {
            return $redirect_to;
        }
        return admin_url();
    }
    add_filter('login_redirect', 'custom_login_redirect', 10, 3);
}

// add_action('admin_enqueue_scripts', function () {
//     wp_enqueue_script(
//         'acf-flex-collapse',
//         get_stylesheet_directory_uri() . '/resources/scripts/util/acf-js-flex-collapse.js',
//         ['jquery'], // dépendance à jQuery
//         null,
//         true // dans le footer
//     );
// });
