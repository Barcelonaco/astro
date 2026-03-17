<?php

namespace App\Modules;

use App\Modules\BlockParams;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\Textarea;
use Extended\ACF\Fields\URL;

class Team
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
                ButtonGroup::make('Alignement', 'align')
                        ->choices([
                                'left' => 'À gauche',
                                'center' => 'Au centre',
                                'right' => 'À droite'
                        ])
                        ->default('left')
                        ->layout('vertical')
                        ->wrapper(['width' => 25]),
                ButtonGroup::make('Format des photos', 'pictures_format')
                        ->choices([
                                'square' => 'Carré',
                                'portrait' => 'Portrait',
                                'circle' => 'Rond'
                        ])
                        ->default('square')
                        ->layout('vertical')
                        ->wrapper(['width' => 25]),
                Repeater::make('Membres de l\'équipe', 'list')
                        ->minRows(1)
                        ->collapsed('name')
                        ->button('Ajouter une personne ')
                        ->layout('block')
                        ->collapsed('titre')
                        ->fields([
                                Image::make('Photo', 'picture')
                                        ->acceptedFileTypes(['jpg', 'jpeg', 'bmp', 'webp', 'png'])
                                        ->required()
                                        ->wrapper(['width' => 50]),
                                Text::make('Nom / Prénom', 'name')
                                        ->wrapper(['width' => 50])
                                        ->required(),
                                Text::make('Poste / Statut', 'post')
                                        ->wrapper(['width' => 50]),
                                Textarea::make('Description', 'desc')
                                        ->rows(2)
                                        ->wrapper(['width' => 50]),
                                Link::make('Lien', 'link')
                                        ->wrapper(['width' => 50]),
                                Image::make('Icône lien', 'icon_link')
                                        ->acceptedFileTypes(['svg', 'png'])
                                        ->wrapper(['width' => 50])
                                        ->conditionalLogic([
                                                ConditionalLogic::where('link', '!=', '')
                                        ]),
                                URL::make('Instagram', 'instagram')
                                        ->wrapper(['width' => 33]),
                                URL::make('TikTok', 'tiktok')
                                        ->wrapper(['width' => 33]),
                                URL::make('LinkedIn', 'linkedin')
                                        ->wrapper(['width' => 33]),
                                URL::make('X (Twitter)', 'twitter')
                                        ->wrapper(['width' => 33]),
                                URL::make('YouTube', 'youtube')
                                        ->wrapper(['width' => 33]),
                        ])
        ]);

        return Layout::make('Trombinoscope', 'team')
                ->layout('block')
                ->fields($fields);
        }
}
