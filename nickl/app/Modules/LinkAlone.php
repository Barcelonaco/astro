<?php

namespace App\Modules;

use App\Modules\BlockParams;

use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\RadioButton;

class LinkAlone
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
            RadioButton::make('Aligner le bouton :', 'btn_align')
                ->choices([
                    'btn_align_left' => 'À gauche',
                    'btn_align_center' => 'Au milieu',
                    'btn_align_right' => 'À droite',
                    ])
                ->default('btn_align_center'),
            Link::make('Lien', 'cta')
                ->wrapper(['width' => 50]),
            Link::make('Lien 2', 'cta-2')
                ->wrapper(['width' => 50]),
        ]);
        
        return Layout::make('Liens', 'link')
            ->layout('block')
            ->fields($fields);
    }
}
