<?php

namespace App\Posttype;

use Bandco\Core\PostTypeRegister;

class CptEvents extends PostTypeRegister
{
    protected bool $isDisabled = false;
    protected bool $activeGutenberg = false;
    protected string $singular = 'Évènement';
    protected string $plural = 'Évènements';
    protected string $slug = 'evenements';
    protected bool $isFemale = false;
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
            'name'               => __('Événements'),
            'singular_name'      => __('Événement'),
            'add_new'            => __('Ajouter un événement'),
            'all_items'          => __('Tous les événements'),
            'view_item'          => __('Voir l\'événement'),
            'view_items'         => __('Voir les événements'),
            'add_new_item'       => __('Ajouter'),
            'edit_item'          => __('Éditer l\'événement'),
            'update_item'        => __('Modifier l\'événement'),
            'search_items'       => __('Rechercher un événement'),
        ];

        $this->extraArgs = [
            'labels'    => $this->labels,
            'menu_icon' => 'dashicons-calendar',
        ];
    }

    public function hooks()
    {
        parent::hooks();
    }

}
