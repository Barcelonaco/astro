<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class Ornament extends Composer
{
    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'modules.ornament',
    ];

    /**
     * Données passées à la vue.
     */
    public function with()
    {
        $module = $this->view->getData()['module'] ?? [];

        return [
            'widthImage' => $this->get_width_image($module),
            'id_bloc' => $this->getId($module),
            'classes' => $this->getClasses($module),
        ];
    }
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
        $blocColor     = $module['bloc_color'] ?? '';
        $paddingTop    = $module['padding_top'] ?? 'no-padding-top';
        $paddingBottom = $module['padding_bottom'] ?? 'no-padding-bottom';

        return trim(implode(' ', array_filter([
            $blocColor,
            $paddingTop ? $paddingTop : '',
            $paddingBottom ? $paddingBottom : '',
        ])));
    }
    /**
     * Récupère la largeur de l'image
     */
    protected function get_width_image($module)
    {
        if($module['img_width']){
            $width = round($module['img_width'] * 100 / 1920, 2);
        }
        else{
            $width = round(intval($module['image']['sizes']['banner-width']) * 100 / 1920, 2);
        }
        return $width;
    }

}
