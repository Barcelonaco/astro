<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;
use App\View\Components\ThreadsFeed;

class Threads extends Composer
{
    /**
     * @var mixed|null
     */
    private $module;


    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'modules.threads-feed',
    ];


    /**
     * Données passées à la vue.
     */
    public function with()
    {
        // Récupération des données seulement ici
        $this->module = $this->view->getData()['module'] ?? [];

        return [
            'id' => $this->getId($this->module),
            'title_module' => $this->module['title'] ?? '',
            'classes' => $this->getClasses($this->module),
            'backgroundImage' => $this->getBackgroundImage($this->module),
            'title' => $this->module['title'] ?? '',
            'posts' => ThreadsFeed::getThreadsPosts(),
            'link' => ThreadsFeed::getLinkAccount(),
            'catchphrase' => $this->getCatchphrase(),
        ];
    }

    /**
     * Génère l'ID du bloc.
     */
    protected function getId($module)
    {
        $idBloc = $module['id_bloc'] ?? null;
        return $idBloc ? GlobalHelper::slugify($idBloc) : GlobalHelper::getAutoSectionId();
    }

    /**
     * Génère les classes CSS du module.
     */
    protected function getClasses($module)
    {
        return implode(' ', array_filter([
            'module',
            'module-instafeed',
            !empty($module['bg_img']) && !empty($module['bg_parallax']) ? 'parallax' : '',
            !empty($module['bg_img']) ? 'has-background-image' : '',
            $module['bloc_color'] ?? '',
            $module['padding_top'] ?? '',
            $module['padding_bottom'] ?? '',
        ]));
    }

    /**
     * Récupère l'image d'arrière-plan et son opacité.
     */
    protected function getBackgroundImage($module)
    {
        $bgImage = $module['bg_img'] ?? null;
        if (!$bgImage) {
            return null;
        }

        return [
            'url' => $module['bg_img']['sizes']['banner'] ?? '',
            'opacity' => $module['bg_opacity'] !== '' ? $module['bg_opacity'] / 100 : 1,
        ];
    }



    private function getCatchphrase()
    {
        return $this->module['catchphrase'] ?? '';
    }
}
