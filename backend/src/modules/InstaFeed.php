<?php

namespace App\Modules;

use App\Modules\BlockParams as BlockParams;

use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Message;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\URL;

class InstaFeed
{
    public static function getLayout($is_columns = false): Layout
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
            Message::make('Attention', 'access')
                ->body('Le compte Instagram doit être parametre dans les parametres du site'),
            Text::make("Phrase d'accroche", 'catchphrase'),
        ]);
        return Layout::make('Feed Instagram', 'insta-feed')
            ->layout('block')
            ->fields($fields);
    }
}
