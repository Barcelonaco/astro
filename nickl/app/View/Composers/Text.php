<?php

namespace App\View\Composers;

use App\Helpers\ChatGPTHelper;
use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;
use WP_REST_Request;
use WP_REST_Response;

class Text extends Composer
{
    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'modules.text',
    ];

    /**
     * Données passées à la vue.
     */
    public function with()
    {
        // Récupération du module avec un fallback vide si non défini
        $module = $this->view->getData()['module'] ?? [];


        // Retourner les données avec des valeurs de secours
        return [
            'id' => $this->getId($module),
            'classes' => $this->getClasses($module),
            'customClasses' => $this->getCustomClasses($module),
            'backgroundImage' => $this->getBackgroundImage($module),
            'text' => $module['text'] ?? '',
            'cta' => $this->getCta($module) ?: [],
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
    protected function getClasses(array $module): string
    {
        return implode(' ', array_filter([
            !empty($module['bg_img']) && !empty($module['bg_parallax']) ? 'background-parallax' : '',
            !empty($module['bg_img']) ? 'has-background-image' : '',
            $module['bloc_color'] ?? '',
            $module['padding_top'] ?? '',
            $module['padding_bottom'] ?? '',
        ]));
    }

    /**
     * Récupère l'image d'arrière-plan et son opacité.
     */
    protected function getBackgroundImage(array $module): ?array
    {
        if (empty($module['bg_img'])) {
            return null;
        }

        return [
            'url' => $module['bg_img']['sizes']['banner'] ?? '',
            'opacity' => $module['bg_opacity'] !== '' ? $module['bg_opacity'] / 100 : 1,
        ];
    }

    /**
     * Récupère le CTA.
     */
    protected function getCta(array $module)
    {
        return $module['cta'] ?? [];
    }

}
