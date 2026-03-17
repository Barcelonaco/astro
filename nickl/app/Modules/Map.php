<?php

namespace App\Modules;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\GoogleMap;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Message;
use Extended\ACF\Fields\Text;

use App\Modules\BlockParams;

class Map
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
                BlockParams::getFullScreen(),
            ]);
        }

        $fields = array_merge($fields, [
            GoogleMap::make('Adresse', 'address')
        ]);
        
        return Layout::make('Carte', 'map')
                ->layout('block')
                ->fields($fields);
    }
}
