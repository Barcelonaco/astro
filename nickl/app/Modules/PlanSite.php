<?php

namespace App\Modules;

use App\Modules\BlockParams;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Message;
use Extended\ACF\Fields\Text;

class PlanSite
{
    public static function getLayout()
    {
        return Layout::make('Plan du site', 'plansite')
                ->layout('block')
                ->fields([
                        Message::make('Information')
                                ->body('Ce module listera toutes les pages de votre site. Il est conseillé de l\'utiliser dans une page dédiée'
                                        ),
                        ...BlockParams::getBlocTitle(),
                        BlockParams::getBgColor(null, 20),
                        BlockParams::getTopPadding(null, 20),
                        BlockParams::getBottomPadding(null, 20),
                        BlockParams::getIsVisible(null, 0),
                        BlockParams::getBackground(),
                        BlockParams::getBackgroundOpacity(),
                        BlockParams::getBackgroundParallax(),
                ]);
    }
}
