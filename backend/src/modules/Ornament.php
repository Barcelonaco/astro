<?php

namespace App\Modules;

use App\Modules\BlockParams;
use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Range;
use Extended\ACF\Fields\Number;

class Ornament
{
        public static function getLayout($is_columns = false)
        {

                $fields = [];

                if ($is_columns === false) {
                        $fields = array_merge($fields, [
                                BlockParams::getTopPadding(null, 33, 'no-padding-top'),
                                BlockParams::getBottomPadding(null, 33, 'no-padding-bottom'),
                                BlockParams::getIsVisible(null, 33),
                        ]);
                }

                $fields = array_merge($fields, [
                        Image::make('Image', 'image')
                                ->required()
                                ->wrapper(['width' => 33]),
                        Range::make('Opacité', 'img_opacity')
                                ->required()
                                ->default(100)
                                ->min(0)
                                ->max(100)
                                ->wrapper(['width' => 34]),
                        ButtonGroup::make('Placement de l\'illustration', 'img_placement')
                                ->choices([
                                        'left' => 'Gauche',
                                        'center' => 'Centré',
                                        'right' => 'Droit'
                                ])
                                ->required()
                                ->default('center')
                                ->layout('vertical')
                                ->wrapper(['width' => 33]),
                        Range::make('Décallage horizontal', 'transformX')
                                ->required()
                                ->default(0)
                                ->min(-100)
                                ->max(100)
                                ->wrapper(['width' => 33]),
                        Range::make('Décallage vertical', 'transformY')
                                ->required()
                                ->default(0)
                                ->min(-100)
                                ->max(100)
                                ->wrapper(['width' => 33]),
                        Number::make('Largeur de l\'image sur grand écran (en pixels)', 'img_width')
                                ->helperText('Si vide l\'image sera affichée dans sa taille d\'origine, pour les icônes svg précisez obligatoirement une valeur'),
                ]);

                return Layout::make('Ornement', 'ornament')
                        ->layout('block')
                        ->fields($fields);
        }
}
