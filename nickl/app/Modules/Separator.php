<?php

namespace App\Modules;

use App\Modules\BlockParams;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\ButtonGroup;

class Separator
{
    public static function getLayout($is_columns = false)
    {
        $fields = [];

        if ($is_columns === false) {
            $fields = array_merge($fields, [
                BlockParams::getBgColor(null, 20),
                BlockParams::getTopPadding(null, 20),
                BlockParams::getBottomPadding(null, 20),
                BlockParams::getIsVisible(null, 20),
                BlockParams::getBlocId(null, 20),
                BlockParams::getBackground(),
                BlockParams::getBackgroundOpacity(),
                BlockParams::getBackgroundParallax(),
            ]);
        }

        $fields = array_merge($fields, [
            ButtonGroup::make('Type de séparation', 'separator_style')
                ->choices([
                    'style-0' => 'Aucune',
                    'style-1' => 'Trois points',
                    'style-2' => 'Trait court',
                    'style-3' => 'Trait personnalisé'
                ])
                ->default('style-3'),
            Text::make('Hauteur (en pixels)', 'height')
                ->wrapper(['width' => 50])
                ->conditionalLogic([
                    ConditionalLogic::where('separator_style', '==', 'style-3')
                ]),
            Text::make('Taille (en % de la largeur de l\'ecran)', 'width')
                ->wrapper(['width' => 50])
                ->conditionalLogic([
                    ConditionalLogic::where('separator_style', '==', 'style-3')
            ]),
            Text::make('Texte du séparateur', 'text'),   
        ]);

        return Layout::make('Séparateur', 'separator')
                ->layout('block')
                ->fields($fields);
    }
}
