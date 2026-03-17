<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class TextScrolling extends Composer
{
    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'modules.text-scrolling',
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
            'texts' => $this->get_texts($module),
            'text_size' => $this->get_text_size($module),
            'text_direction' => $this->get_text_direction($module),
            'text_speed' => $this->get_text_speed($module),
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

        return trim(implode(' ', array_filter([
            $bgImage && $bgParallax ? 'background-parallax' : '',
            $bgImage ? 'has-background-image' : '',
            $blocColor,
            $paddingTop ? $paddingTop : '',
            $paddingBottom ? $paddingBottom : '',
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

    protected function get_texts($module)
    {
        $texts = $module['texts'];
        if (!$texts) {
            return [];
        }
        return $texts;
    }
    protected function get_text_size($module)
    {
        return $module['text_size'];
    }
    protected function get_text_direction($module)
    {
        return $module['text_direction'];
    }
    protected function get_text_speed($module)
    {
        return $module['text_speed'];
    }
}
