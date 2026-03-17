<?php

namespace App\Modules;

use App\Modules\BlockParams as BlockParams;

use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Message;
use Extended\ACF\Fields\Text;

class ThreadsFeed
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
            Message::make(__('Attention', THEME_TEXTDOMAIN), 'access')
                ->body(__('Le compte Threads doit être paramètré dans les paramètres du site', THEME_TEXTDOMAIN)),
            Text::make("Phrase d'accroche", 'catchphrase'),
        ]);

        return Layout::make(__('Feed Threads', THEME_TEXTDOMAIN), 'threads-feed')
            ->layout('block')
            ->fields($fields);
    }
}