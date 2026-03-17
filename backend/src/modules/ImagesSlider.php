<?php

namespace App\Modules;

use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\Textarea;
use App\Modules\BlockParams;

class ImagesSlider
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
                BlockParams::getFullScreen(50),
            ]);
        }

        $fields = array_merge($fields, [
                Repeater::make('Sliders', 'sliders')
                        ->minRows(1)
                        ->collapsed('image')
                        ->layout('block')
                        ->button('Ajouter un slide')
                        ->fields([
                                Image::make('Image', 'image')
                                        ->required(),
                                Text::make('Légende (h3)', 'legend')
                                        ->wrapper(['width' => 50]),
                                Textarea::make('Texte', 'text')
                                        ->rows(2),
                                Link::make('Lien 1', 'link')
                                        ->wrapper(['width' => 50]),
                                Link::make('Lien 2', 'link_2')
                                        ->wrapper(['width' => 50]),
                        ])
        ]);
        
        return Layout::make('Carrousel d\'images', 'images-slider')
                ->layout('block')
                ->fields($fields);
    }
}
