<?php

namespace App\Modules;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Text;

class Banner
{
    public static function getLayout($is_columns = false)
    {
        $fields = [
            ButtonGroup::make('Hauteur de la bannière', 'banner_height')
                ->choices([
                    'small'  => 'Petite',
                    'medium' => 'Moyenne',
                    'large'  => 'Grande',
                ])
                ->default('small')
                ->layout('horizontal')
                ->wrapper(['width' => 50]),

            ButtonGroup::make('Afficher le titre ?', 'title_in_header')
                ->choices([
                    'showTitle' => 'Oui',
                    'hideTitle' => 'Non',
                ])
                ->default('showTitle')
                ->layout('horizontal')
                ->wrapper(['width' => 50]),

            ButtonGroup::make('Balise H1', 'h1_in_header')
                ->choices([
                    'yes' => 'Oui',
                    'no'  => 'Non',
                ])
                ->default('yes')
                ->layout('horizontal')
                ->wrapper(['width' => 50])
                ->conditionalLogic([
                    ConditionalLogic::where('title_in_header', '==', 'showTitle')
                ]),

            Text::make('Titre', 'title'),

            Image::make('Image de fond', 'image')
                ->acceptedFileTypes(['jpg', 'jpeg', 'gif', 'bmp', 'svg', 'png', 'webp'])
                ->previewSize('thumbnail'),
        ];

        return Layout::make('Bannière', 'banner')
            ->layout('block')
            ->fields($fields);
    }
}
