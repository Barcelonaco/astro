<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class TextImage extends Composer
{
    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'modules.text-image',
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
            'customClasses' => $this->getCustomClasses($module),
            'backgroundImage' => $this->getBackgroundImage($module),
            'ratioImg' => $this->get_ratio($module),
            'placement' => $this->get_placement($module),
            'link_align' => $module['link_align'] ?? '',
            'link_style' => $module['link_style'] ?? '',
        ];
    }

    /**
     * Génère l'ID du bloc.
     */
    protected function getId($module): string
    {
        $idBloc = $module['id_bloc'] ?? '';

        $mots = preg_split('/\s+/', $idBloc);
        $ids = [];

        foreach ($mots as $mot) {
            if (strpos($mot, '.') !== 0) {
                $ids[] = $mot;
            }
        }

        $idConcat = implode('-', $ids);
        return $idConcat ? GlobalHelper::slugify($idConcat) : GlobalHelper::getAutoSectionId();
    }

    /**
     * Génère les classes personnalisées du module CSS si présentes.
     */
    protected function getCustomClasses($module): string
    {
        $idBloc = $module['id_bloc'] ?? '';

        $mots = preg_split('/\s+/', $idBloc);
        $classes = [];

        foreach ($mots as $mot) {
            if (strpos($mot, '.') === 0) {
                $classes[] = ltrim($mot, '.');
            }
        }

        return implode(' ', $classes);
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
        $imgParallax = $module['img_parallax'] ?? false;
        $mediaChoice = $module['media_choice'] ?? false;
        $mediaRatio = $module['media_ratio'] ?? '';

        return trim(implode(' ', array_filter([
            $bgImage && $bgParallax ? 'background-parallax' : '',
            $bgImage ? 'has-background-image' : '',
            $blocColor,
            $paddingTop ? $paddingTop : '',
            $paddingBottom ? $paddingBottom : '',
            $imgParallax && $mediaChoice ? 'img-parallax' : '',
            $mediaRatio,
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
        return match ($module['media_ratio']) {
            'full-height' => 'full-height',
            'landscape' => 'banner',
            'portrait' => 'portrait',
            'square' => 'square-large',
            default => 'background-module',
        };
    }
    protected function get_placement($module)
    {
        return $module['img_to_left'] ? 'img-left' : 'img-right';
    }

}