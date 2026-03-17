<?php

namespace App\Modules;

use App\Modules\BlockParams;

use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Text;

class Widget
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
            Text::make('Contenu du widget', 'widget')
        ]);
        return Layout::make('Widget', 'widget')
            ->layout('block')
            ->fields($fields);
    }
}
