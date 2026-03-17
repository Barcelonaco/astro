<?php

namespace App\Modules;

use Extended\ACF\Fields\File;
use Extended\ACF\Fields\Layout;

use App\Modules\BlockParams;

class IllusVideo
{
    public static function getLayout()
    {
        return Layout::make('Séparateur vidéo', 'illustration-video')
                ->layout('block')
                ->fields([
                    BlockParams::getBgColor(null, 20),
                    BlockParams::getTopPadding(null, 20),
                    BlockParams::getBottomPadding(null, 20),
                    BlockParams::getIsVisible(null, 20),
                    BlockParams::getBlocId(null, 20),
                    BlockParams::getBackground(),
                    BlockParams::getBackgroundOpacity(),
                    BlockParams::getBackgroundParallax(),
                    File::make('Video', 'video')
                    ->required()
                    ->acceptedFileTypes(['mp4', 'mov', 'mpeg', 'mpg'])
                    ->wrapper(['width' => '75']),
                    BlockParams::getFullScreen(25),
                ]);
    }
}
