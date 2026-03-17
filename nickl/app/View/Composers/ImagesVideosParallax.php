<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class ImagesVideosParallax extends Composer
{
    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'modules.images-videos-parallax',
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
            'title_bloc' => $module['title'] ?? '',
            'title_style' => $module['title_style'] ?? '',
            'title_align' => $module['title_align'] ?? '',
            'blocs' => $module['blocs'] ?? []
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
        $blocColor = $module['bloc_color'] ?? '';
        $paddingTop = $module['padding_top'] ?? '';
        $paddingBottom = $module['padding_bottom'] ?? '';

        return trim(implode(' ', array_filter([
            $blocColor,
            $paddingTop ? $paddingTop : '',
            $paddingBottom ? $paddingBottom : '',
        ])));
    }

    protected function get_columns($module)
    {
        $columns = $module['columns'];
        if (!$columns) {
            return null;
        }

        return $columns;

    }

}
