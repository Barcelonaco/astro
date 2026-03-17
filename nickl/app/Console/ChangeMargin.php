<?php

namespace App\Console;

use Bandco\Core\Hookable;
use Illuminate\Database\Capsule\Manager as Capsule;

class ChangeMargin extends Hookable
{

    private static function keepConnect()
    {

        global $wpdb;

        $capsule = new Capsule;

        $capsule->addConnection([
                'driver' => 'mysql',
                'host' => $wpdb->dbhost,
                'database' => $wpdb->dbname,
                'username' => $wpdb->dbuser,
                'password' => $wpdb->dbpassword,
                'charset' => 'utf8',
                'collation' => 'utf8_unicode_ci',
                'prefix' => 'wp_',
        ]);
        $capsule->setAsGlobal();
        $capsule->bootEloquent();
    }

    public function hooks()
    {
        parent::hooks();

        set_time_limit(0);

        if (php_sapi_name() == 'cli') {
            \WP_CLI::add_command('change:margin', [$this, 'import'], ['shortdesc' => 'Change la config des marges']);
        }
    }

    public function import()
    {
        $this->change();
    }

    private function change()
    {
        self::keepConnect();

        // dans chaque site
        foreach (get_sites() as $site) {
            // pour chaque page / post / product
            // Si le postmeta is_small_marged existe
            // ajouter 2 postmeta pour wordplate avec le hash
            // si is_small_marged est à true
            // |__ les nouveaux postmeta doivent être à padding-top-small et padding-bottom-small
            // |__ sinon les mettre à 0 (false)
            // supprimer l'ancien postmeta
            switch_to_blog($site->blog_id);

            $pref = $site->blog_id != 1 ? $site->blog_id . '_' : '';
            $tablePosts = $pref . 'posts';

            // récupère tous les posts publiés
            $allPublishPosts = Capsule::table($tablePosts)
                    ->select(['ID', 'post_type', 'post_title'])
                    ->where([
                            ['post_status', '=', 'publish'],
                    ])->whereIn('post_type', ['actualites', 'page', 'product'])
                    ->get();
            

            foreach ($allPublishPosts->toArray() as $row) {
                // je récupère le contenu
                $modules = get_field('flexible_modules', $row->ID);

                if (is_array($modules) && count($modules) > 0) {
                    foreach ($modules as $k => $module) {
                        if (isset($module[ 'acf_fc_layout' ]) && !empty($module[ 'acf_fc_layout' ]) && isset($module[ 'padding_top' ])) {
                            // je récupère l'ancienne meta

                            $oldValue = Capsule::table($pref . 'postmeta')
                                    ->select(['meta_value'])
                                    ->where([
                                            ['meta_key', '=', 'flexible_modules_' . $k . '_is_small_marged'],
                                            ['post_id', '=', $row->ID],
                                    ])
                                    ->get();

                            if (!empty($oldValue)) {
                                // génération du hack
                                if ($row->post_type == 'product') {
                                    $acfKeyPaddingTop = 'field_' . hash('fnv1a32',
                                                    'contenu_du_produit_flexible_modules_' . $module[ 'acf_fc_layout' ] . '_padding_top');
                                    $acfKeyPaddingBottom = 'field_' . hash('fnv1a32',
                                                    'contenu_du_produit_flexible_modules_' . $module[ 'acf_fc_layout' ] . '_padding_bottom');
                                } else {
                                    $acfKeyPaddingTop = 'field_' . hash('fnv1a32',
                                                    'contenu_flexible_modules_' . $module[ 'acf_fc_layout' ] . '_padding_top');
                                    $acfKeyPaddingBottom = 'field_' . hash('fnv1a32',
                                                    'contenu_flexible_modules_' . $module[ 'acf_fc_layout' ] . '_padding_bottom');
                                }


                                $oldValue = Capsule::table($pref . 'postmeta')
                                        ->select(['meta_value'])
                                        ->where([
                                                ['meta_key', '=', 'flexible_modules_' . $k . '_is_small_marged'],
                                                ['post_id', '=', $row->ID],
                                        ])
                                        ->get();

                                Capsule::table($pref . 'postmeta')->updateOrInsert([
                                        'post_id' => $row->ID,
                                        'meta_key' => '_flexible_modules_' . $k . '_padding_top',
                                        'meta_value' => $acfKeyPaddingTop
                                ]);

                                Capsule::table($pref . 'postmeta')->updateOrInsert([
                                        'post_id' => $row->ID,
                                        'meta_key' => '_flexible_modules_' . $k . '_padding_bottom',
                                        'meta_value' => $acfKeyPaddingBottom
                                ]);


                                if ($oldValue[ 0 ]->meta_value == 1) {

                                    Capsule::table($pref . 'postmeta')->updateOrInsert([
                                            'post_id' => $row->ID,
                                            'meta_key' => 'flexible_modules_' . $k . '_padding_top',
                                            'meta_value' => 'padding-top-small'
                                    ]);

                                    Capsule::table($pref . 'postmeta')->updateOrInsert([
                                            'post_id' => $row->ID,
                                            'meta_key' => 'flexible_modules_' . $k . '_padding_bottom',
                                            'meta_value' => 'padding-bottom-small'
                                    ]);

                                } else {

                                    Capsule::table($pref . 'postmeta')->updateOrInsert([
                                            'post_id' => $row->ID,
                                            'meta_key' => 'flexible_modules_' . $k . '_paddding_top',
                                            'meta_value' => 0
                                    ]);

                                    Capsule::table($pref . 'postmeta')->updateOrInsert([
                                            'post_id' => $row->ID,
                                            'meta_key' => 'flexible_modules_' . $k . '_padding_bottom',
                                            'meta_value' => 0
                                    ]);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
