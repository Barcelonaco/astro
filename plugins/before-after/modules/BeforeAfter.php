<?php

namespace App\Modules;

use App\Modules\BlockParams;
use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Range;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\TrueFalse;

class BeforeAfter
{
    public static function getLayout($is_columns = false)
    {
        $fields = [];

        if ($is_columns === false) {
            $fields = array_merge($fields, [
                ...BlockParams::getBlocTitle(),
                BlockParams::getBgColor(),
                BlockParams::getTopPadding(),
                BlockParams::getBottomPadding(),
                BlockParams::getIsVisible(),
                BlockParams::getBackground(),
                BlockParams::getBackgroundOpacity(),
                BlockParams::getBackgroundParallax(),
            ]);
        }

        $fields = array_merge($fields, [
            Image::make('Image avant', 'image_before')
                ->wrapper(['width' => 50])
                ->required(),
            Image::make('Image après', 'image_after')
                ->wrapper(['width' => 50])
                ->required(),
            ButtonGroup::make('Orientation du curseur', 'orientation')
                ->choices([
                    'horizontal' => 'Horizontal (gauche/droite)',
                    'vertical'   => 'Vertical (haut/bas)',
                ])
                ->default('horizontal')
                ->wrapper(['width' => 50]),
            Range::make('Position initiale du curseur (%)', 'initial_position')
                ->min(0)
                ->max(100)
                ->step(1)
                ->default(50)
                ->wrapper(['width' => 50]),
            TrueFalse::make('Afficher les libellés ?', 'show_labels')
                ->stylized(on: 'Oui', off: 'Non')
                ->default(true)
                ->wrapper(['width' => 33]),
            Text::make('Libellé avant', 'label_before')
                ->default('Avant')
                ->wrapper(['width' => 33]),
            Text::make('Libellé après', 'label_after')
                ->default('Après')
                ->wrapper(['width' => 33]),
        ]);

        return Layout::make('Avant / Après', 'before-after')
            ->layout('block')
            ->fields($fields);
    }
}
