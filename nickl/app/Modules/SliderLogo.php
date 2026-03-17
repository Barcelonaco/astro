<?php

namespace App\Modules;

use App\Modules\BlockParams;

use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Repeater;

class SliderLogo
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
                Repeater::make('Listes des logos', 'logos')
                        ->button('Ajouter un logo')
                        ->minRows(1)
                        ->collapsed('logo')
                        ->fields([
                                Image::make('Logo', 'logo')
                                        ->required()
                                        ->wrapper(['width' => 50]),
                                Link::make('Lien', 'link')
                                        ->wrapper(['width' => 50]),
                        ])
        ]);

        return Layout::make('Slider de logo', 'logos-slider')
                ->layout('block')
                ->fields($fields);
    }
}
