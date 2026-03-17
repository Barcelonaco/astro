<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class HeadText extends Composer
{
    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'modules.head-text',
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
            'text' => $module['text'] ?? '',
            'h1_in_header' => $this->getH1inHeader($module)
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
    protected function getClasses(array $module): string
    {
        return implode(' ', array_filter([
            !empty($module['bg_img']) && !empty($module['bg_parallax']) ? 'parallax' : '',
            !empty($module['bg_img']) ? 'has-background-image' : '',
            $module['bloc_color'] ?? '',
            $module['padding_top'] ?? '',
            $module['padding_bottom'] ?? '',
            $module['nbr_column'] ?? '',
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

    protected function getH1inHeader($module)
    {
        return $module['h1_in_header'] ?? '';
    }
}
