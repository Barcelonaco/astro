<?php

namespace App\Modules;

use App\Modules\BlockParams;

use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Message;

class Review
{
    public static function getLayout($is_columns = false)
    {
        $fields = [
            Message::make('Information')
                ->body('Ce bloc ne peut être utilisé qu\'à condition d\avoir activé le module d\'avis en amont. Vous pouvez en fair la demande à support@barcelona-co.fr'),

        ];

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
            ButtonGroup::make('Source des avis', 'reviews_src')
                ->choices([
                    'google' => 'Google',
                    'airbnb' => 'airbnb ',
                ])
                ->layout('horizontal')
                ->wrapper(['width' => 25])
                ->default('google'),
        ]);
        return Layout::make('Avis client', 'review')
            ->layout('block')
            ->fields($fields);
    }
}
