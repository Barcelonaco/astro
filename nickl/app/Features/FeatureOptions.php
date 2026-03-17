<?php

namespace App\Features;

class FeatureOptions
{
    public function hooks()
    {
        add_action('init', [$this, 'addOptionsPage']);
    }

    public function addOptionsPage()
    {
        acf_add_options_page([
                'page_title' => 'Paramètres du site',
                'menu_title' => 'Paramètres du site',
                'menu_slug' => 'params',
                'capability' => 'edit_posts',
                'redirect' => false
        ]);
    }
}
