<?php

namespace App\Posttype;
use Bandco\Core\PostTypeRegister;

class CptNews extends PostTypeRegister
{
    protected bool $isDisabled = false;
    protected bool $activeGutenberg = false;
    protected string $singular = 'Actualité';
    protected string $plural = 'Actualités';
    protected string $slug = 'actualites';
    protected bool $isFemale = true;
    protected bool $disableSingle = false;
    protected bool $disableArchivePage = false;
    protected bool $optionPageForArchive = true;

    protected array $labels = [];
    protected array $extraArgs = [];

    public function __construct()
    {
        // Vérifie si la classe parente a un constructeur avant de l'appeler
        if (method_exists(parent::class, '__construct')) {
            parent::__construct();
        }

        $this->labels = [
            'name'               => __('Actualités'),
            'singular_name'      => __('Actualité'),
            'add_new'            => __('Ajouter une actualité'),
            'all_items'          => __('Toutes les actualités'),
            'view_item'          => __('Voir l\'actualité'),
            'view_items'         => __('Voir les actualités'),
            'add_new_item'       => __('Ajouter'),
            'edit_item'          => __('Éditer l\'actualité'),
            'update_item'        => __('Modifier l\'actualité'),
            'search_items'       => __('Rechercher une actualité'),
        ];

        $this->extraArgs = [
            'menu_icon' => 'dashicons-admin-site-alt',
            'labels'    => $this->labels,
        ];
    }

    public function hooks()
    {
        parent::hooks();
    }
}
