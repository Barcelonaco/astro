<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class ColumnsTab extends Composer
{
    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'modules.columns-tab',
    ];

    /**
     * Données passées à la vue.
     */
    public function with()
    {
        $module = $this->view->getData()['module'] ?? [];
        $colsHaveBackground = $module['columns_background'] === 'no-background' ? '' : 'cols_have_background';
        return [
            'id' => $this->getId($module),
            'classes' => $this->getClasses($module, $colsHaveBackground),
            'backgroundImage' => $this->getBackgroundImage($module),
            'title_bloc' => $module['title'] ?? '',
            'title_style' => $module['title_style'] ?? '',
            'title_align' => $module['title_align'] ?? '',
            'display' => $module['columns_display'] ?? '',
            'columnsBackground' => $module['columns_background'] ?? '',
            'columnsCount' => $this->getColumnsCount($module),
            'colsHaveBackground' => $colsHaveBackground,
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
    protected function getClasses($module, $colsHaveBackground)
    {
        $bgImage = $module['bg_img'] ?? false;
        $bgParallax = $module['bg_parallax'] ?? false;
        $blocColor = $module['bloc_color'] ?? '';
        $paddingTop = $module['padding_top'] ?? '';
        $paddingBottom = $module['padding_bottom'] ?? '';

        return implode(' ', array_filter([
            $bgImage && $bgParallax ? 'background-parallax' : '',
            $bgImage ? 'has-background-image' : '',
            $blocColor,
            $paddingTop,
            $paddingBottom,
            $colsHaveBackground,
        ]));
    }

    protected function getColumnsCount($module)
    {
        // On vérifie si la clé existe et n'est pas vide
        $columns = $module['columns_list'] ?? null;

        if (is_array($columns)) {
            return count($columns);
        }

        return 0; // Retourne 0 si aucune colonne n'est trouvée
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
}
