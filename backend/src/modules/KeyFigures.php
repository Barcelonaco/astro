<?php

namespace App\Modules;

use App\Modules\BlockParams;

use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Number;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\Textarea;

class KeyFigures
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
                Repeater::make('Listes des chiffres', 'key_list')
                        ->button('Ajouter un chiffre')
                        ->layout('block')
                        ->minRows(1)
                        ->collapsed('titre')
                        ->fields([
                                Image::make('Icône', 'icone')
                                        ->acceptedFileTypes(['svg', 'png', 'jpeg', 'jpg'])
                                        ->wrapper(['width' => 33]),
                                Number::make('Valeur', 'value')
                                        ->required()
                                        ->wrapper(['width' => 33]),
                                Link::make('Lien', 'link')
                                        ->wrapper(['width' => 33]),
                                Text::make('Titre (pas de balise h)', 'titre')
                                        ->wrapper(['width' => 50]),
                                Textarea::make('Description', 'desc')
                                        ->rows(2)
                                        ->wrapper(['width' => 50]),
                        ])
        ]);

        return Layout::make('Chiffres clés', 'key-figures')
                ->layout('block')
                ->fields($fields);
    }
}
