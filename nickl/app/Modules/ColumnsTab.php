<?php

namespace App\Modules;

use App\Helpers\ThemeHelper;
use App\Modules\BlockParams;
use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\FlexibleContent;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\TrueFalse;

class ColumnsTab
{
    // Stockage statique pour éviter de recalculer les layouts à chaque appel
    private static $cachedLayouts = null;

    public static function getLayout()
    {
        $array_layout = self::getLayouts();

        return Layout::make('Colonnes', 'columns-tab')
            ->layout('block')
            ->fields([
                ...BlockParams::getBlocTitle(),
                BlockParams::getBgColor(),
                BlockParams::getTopPadding(),
                BlockParams::getBottomPadding(),
                BlockParams::getIsVisible(),
                BlockParams::getBackground(),
                BlockParams::getBackgroundOpacity(),
                BlockParams::getBackgroundParallax(),
                TrueFalse::make('Largeur du container', 'container_width')
                    ->stylized(on: 'Large', off: 'Normal')
                    ->wrapper(['width' => 25])
                    ->default(0),
                TrueFalse::make('Alignement vertical du contenu', 'cols_justify_items')
                    ->stylized(on: 'Au centre', off: 'En haut')
                    ->wrapper(['width' => 25])
                    ->default(0),
                ButtonGroup::make('Couleur de fond des colonnes', 'columns_background')
                    ->wrapper(['width' => 25])
                    ->layout('vertical')
                    ->choices([
                        'no-background' => 'Aucun',
                        'cols-background-light' => '<div style="height:15px; width:100%;background-color:' . ThemeHelper::getBackgroundColor() . '"></div>',
                        'cols-background-primary' => '<div style="height:15px; width:100%;background-color:' . ThemeHelper::getPrimaryColor() . '"></div>',
                        'cols-background-secondary' => '<div style="height:15px; width:100%;background-color:' . ThemeHelper::getSecondaryColor() . '"></div>',
                        'cols-background-tertiary' => '<div style="height:15px; width:100%;background-color:' . ThemeHelper::getTertiaryColor() . '"></div>',
                    ]),
                ButtonGroup::make('Disposition des colones', 'columns_display')
                    ->choices([
                        'columns-2_1-3' => '1/3 - 2/3',
                        'columns-2_2-2' => '1/2 - 1/2',
                        'columns-2_3-1' => '2/3 - 1/3',
                    ])
                    ->layout('vertical')
                    ->wrapper(['width' => 25])
                    ->default('columns-2_2-2'),
                Repeater::make('Colonnes', 'columns_list')
                    ->minRows(1)
                    ->maxRows(4)
                    ->button('Ajouter une colonne')
                    ->layout('block')
                    ->collapsed('titre')
                    ->fields([
                        FlexibleContent::make('Colonne', 'columns_module')
                            ->button('Ajouter un bloc')
                            ->layouts($array_layout),
                    ]),
            ]);
    }

    // Optimisation avec un cache statique
    public static function getLayouts()
    {
        return (new \App\Helpers\AcfHelper())->getAllModulesLayouts(true);
    }
}
