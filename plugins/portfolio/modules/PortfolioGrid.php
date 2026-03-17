<?php

namespace App\Modules;

use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\Link;

class PortfolioGrid
{
    public static function getLayout($is_columns = false)
    {
        $fields = [
            Text::make('Titre du bloc', 'block_title'),
            Repeater::make('Projets', 'projects')
                ->minRows(1)
                ->layout('block')
                ->button('Ajouter un projet')
                ->fields([
                    Image::make('Image', 'image')->required(),
                    Text::make('Titre', 'title')->required(),
                    Text::make('Client', 'client'),
                    Link::make('Lien', 'link'),
                ]),
        ];

        $fields = array_merge($fields, [
            \App\Modules\BlockParams::getBgColor(null, 20),
            \App\Modules\BlockParams::getTopPadding(20),
            \App\Modules\BlockParams::getBottomPadding(20),
        ]);

        return Layout::make('Grille portfolio', 'portfolio-grid')
            ->layout('block')
            ->fields($fields);
    }
}
