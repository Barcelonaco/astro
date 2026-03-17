<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;


class Contact extends Composer
{
    protected $module;
    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'modules.contact',
    ];

    /**
     * Données passées à la vue.
     */
    public function with()
    {
        $module = $this->view->getData()['module'] ?? [];

        return [
            'content' => $module,
            'title_bloc' => $module['title'] ?? '',
            'title_style' => $module['title_style'] ?? '',
            'title_align' => $module['title_align'] ?? '',
            'id_bloc' => $this->getId($module),
            'classes' => $this->getClasses($module),
            'backgroundImage' => $this->getBackgroundImage($module),
            'is_map' => $this->getIsMap($module),

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
        $bgImage = $module['bg_img'] ?? false;
        $bgParallax = $module['bg_parallax'] ?? false;
        $mainBlocPos = $module['main-bloc-position'] ?? false;
        $blocColor = $module['bloc_color'] ?? '';
        $paddingTop = $module['padding_top'] ?? '';
        $paddingBottom = $module['padding_bottom'] ?? '';

        return implode(' ', array_filter([
            'module',
            $bgImage && $bgParallax ? 'background-parallax' : '',
            $mainBlocPos ? 'main-bloc-right' : 'main-bloc-left',
            $bgImage ? 'has-background-image' : '',
            $blocColor,
            $paddingTop,
            $paddingBottom,
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
    protected function getIsMap($module)
    {
        //
        //dd($module);
        if ($module['is_map'] === true) {
            return true;
        }
        return false;
    }
}
