<?php

namespace App\Modules;

use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Message;
use Extended\ACF\Fields\RadioButton;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\Textarea;
use Extended\ACF\Fields\TrueFalse;

use App\Modules\BlockParams;

class Gallery
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
               RadioButton::make('Choix du style ?', 'style_choice')
                        ->choices([
                                'style-1' => 'Style 1 : place le texte en superposition à l\'image.',
                                'style-2' => 'Style 2 : place le texte sous l\'image.',
                                'style-3' => 'Style 3 : place le titre en superposition à l\'image, le contenu apparait au survol de la souris',
                        ])
                        ->default('style-1'),
                ButtonGroup::make('Largeur du container', 'container-width')
                        ->choices([
                                'large' => 'Étendu',
                                'classic' => 'Normal',
                        ])
                        ->layout('vertical')
                        ->wrapper(['width' => 33])
                        ->default('large'),
                ButtonGroup::make('Nombre de colonne ?', 'nbr_column')
                        ->choices([
                                'columns-1' => '1 colonne',
                                'columns-2' => '2 colonnes',
                                'columns-3' => '3 colonnes',
                                'columns-4' => '4 colonnes',
                                'columns-5' => '5 colonnes',
                        ])
                        ->wrapper(['width' => 33])

                        ->layout('vertical')
                        ->default('columns-3'),
                ButtonGroup::make('Hauteur des images ?', 'type_img')
                        ->choices([
                                'img-fixe' => 'Fixes',
                                'img-fluid' => 'Fluides',
                        ])
                        ->wrapper(['width' => 33])
                        ->layout('vertical')
                        ->default('img-fluid'),
                Repeater::make('Liste de la galerie', 'list')
                        ->minRows(1)
                        ->button('Ajouter une photo')
                        ->layout('block')
                        ->collapsed('titre')
                        ->fields([
                                Image::make('Photo', 'image')
                                        ->acceptedFileTypes(['jpg', 'jpeg', 'bmp', 'webp', 'png'])
                                        ->required(),
                                Text::make('Titre (h3)', 'titre')
                                        ->wrapper(['width' => 50]),
                                Textarea::make('Description', 'desc')
                                        ->rows(2)
                                        ->wrapper(['width' => 50]),
                                Text::make('Tag', 'tag')
                                        ->wrapper(['width' => 50]),
                                Link::make('Lien', 'link')
                                        ->wrapper(['width' => 50]),
                        ])
        ]);
        
        return Layout::make('Galerie', 'gallery')
                ->layout('block')
                ->fields($fields);
    }
}
