<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class Map extends Composer
{
    /**
     * Définir les vues concernées par ce Composer.
     */


    protected static $views = [
        'modules.map',
    ];

    /**
     * Injecter les données nécessaires aux vues.
     */
    public function with()
    {
        $module = $this->view->getData()['module'] ?? [];

        return [
            'id_bloc' => $this->getId($module),
            'dataColor' => $this->getColor($module['bloc_color']),
            'title_bloc' => $module['title'] ?? '',
            'title_style' => $module['title_style'] ?? '',
            'title_align' => $module['title_align'] ?? '',

        ];
    }
    protected function getId($module)
    {
        $idBloc = $module['id_bloc'] ?? null;
        return $idBloc ? GlobalHelper::slugify($idBloc) : GlobalHelper::getAutoSectionId();
    }


    protected function getColor($class)
    {
        switch($class){
            case 'no-background-color';
            case 'has-background-primary';
            default;
                $dataColor = get_field('primary_color', 'options');
                break;
            case 'has-background-secondary';
                $dataColor = get_field('secondary_color', 'options');
                break;
            case 'has-background-tertiary';
                $dataColor = get_field('tertiary_color', 'options');
                break;
        }
        return $dataColor;
    }

}
