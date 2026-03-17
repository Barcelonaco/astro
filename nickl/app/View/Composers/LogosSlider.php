<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class LogosSlider extends Composer
{
    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'modules.logos-slider',
    ];

    /**
     * Données passées à la vue.
     */
    public function with()
    {
        $module = $this->view->getData()['module'] ?? [];
        return [
            'id_bloc' => $this->getId($module),
            'classes' => $this->getClasses($module),
            'backgroundImage' => $this->getBackgroundImage($module),
            'title_bloc' => $module['title'] ?? '',
            'title_style' => $module['title_style'] ?? '',
            'title_align' => $module['title_align'] ?? '',
            'indexPopin' => rand(0, 1000),
            'columns' => 0,
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
        $blocColor = $module['bloc_color'] ?? '';
        $paddingTop = $module['padding_top'] ?? '';
        $paddingBottom = $module['padding_bottom'] ?? '';
        $columns = $module['columns'] ?? '';

        return trim(implode(' ', array_filter([
            $bgImage && $bgParallax ? 'background-parallax' : '',
            $bgImage ? 'has-background-image' : '',
            $columns,
            $blocColor,
            $paddingTop,
            $paddingBottom,
        ])));
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


}
