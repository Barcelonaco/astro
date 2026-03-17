<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class PreviewActualites extends Composer
{
    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'components.preview-actualites',
    ];

    /**
     * Données passées à la vue.
     */
    public function with()
    {


        return [
            'content' => 1,

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
}


