<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class IllustrationVideo extends Composer
{
    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'modules.illustration-video',
    ];

    /**
     * Données passées à la vue.
     */
    public function with()
    {
        $module = $this->view->getData()['module'] ?? [];
        return [
            'id' => $this->getId($module),
            'classes' => $this->getClasses($module),
            'backgroundImage' => $this->getBackgroundImage($module),
            'ratio' => $this->get_ratio($module),
            'url' => $this->get_url($module),
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
        $isFullscreen = $module['is_fullscreen'] ?? false;
        $bgImage = $module['bg_img'] ?? false;
        $bgParallax = $module['bg_parallax'] ?? false;
        $blocColor = $module['bloc_color'] ?? '';
        $paddingTop = $module['padding_top'] ?? '';
        $paddingBottom = $module['padding_bottom'] ?? '';

        return trim(implode(' ', array_filter([
            $isFullscreen ? 'full-width' : '',
            $bgImage && $bgParallax ? 'background-parallax' : '',
            $bgImage ? 'has-background-image' : '',
            $blocColor,
            $paddingTop ?: '',
            $paddingBottom ?: '',
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
    protected function get_ratio($module)
    {
        $width = $module['video']['width'] ?? null;
        $height = $module['video']['height'] ?? null;

        if (!is_numeric($width) || !is_numeric($height) || (int) $height === 0) {
            return 0; // Valeur par défaut en cas d'erreur ou absence
        }

        $ratio = $width / (int) $height;

        return (int) number_format($ratio, 2, '.', '');
    }
    protected function get_url($module)
    {
        return $module['video']['url'] ?? '';
    }
}
