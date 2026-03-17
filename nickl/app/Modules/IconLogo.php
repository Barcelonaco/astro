<?php

namespace App\Modules;

use App\Modules\BlockParams;

use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\Textarea;
use Extended\ACF\Fields\TrueFalse;

class IconLogo
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
                TrueFalse::make('Style d\'affichage', 'icon_type')
                        ->stylized(on : 'Icone', off : 'Image')
                        ->wrapper(['width' => 50])
                        ->default(true),
                TrueFalse::make('Couleur des images', 'grey_filter')
                        ->stylized(on : 'Nuances de Gris', off : 'Couleurs')
                        ->wrapper(['width' => 50])
                        ->default(false),
                Repeater::make('Listes des logos', 'logos')
                        ->button('Ajouter un logo')
                        ->layout('block')
                        ->minRows(1)
                        ->fields([
                                Image::make('Logo', 'logo')
                                        ->acceptedFileTypes(['svg', 'png', 'jpeg', 'jpg'])
                                        ->wrapper(['width' => 50]),
                                Link::make('Lien', 'link')
                                        ->wrapper(['width' => 50]),
                                Text::make('Titre (pas de balise h)', 'titre')
                                        ->wrapper(['width' => 50]),
                                Textarea::make('Description', 'desc')
                                        ->rows(2)
                                        ->wrapper(['width' => 50]),
                        ])
        ]);

        return Layout::make('Icône + texte', 'icons')
                ->layout('block')
                ->fields($fields);
    }
}
