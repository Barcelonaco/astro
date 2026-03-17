<?php

namespace App\Modules;

use App\Modules\BlockParams;

use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\Textarea;

class Quote
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
                Textarea::make('Citation', 'quote')
                        ->rows(2)
                        ->required(),
                Image::make('Photo', 'photo'),
                Text::make('Nom', 'name')
                        ->wrapper(['width' => 50]),
                Text::make('Fonction', 'job')
                        ->wrapper(['width' => 50]),  
        ]);

        return Layout::make('Citation', 'quote')
                ->layout('block')
                ->fields($fields);
    }
}
