<?php

namespace App\Modules;

use App\Modules\BlockParams;
use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\File;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\TrueFalse;
use Extended\ACF\Fields\WysiwygEditor;

class TextImage
{
    public static function getLayout($is_columns = false)
    {
        $fields = [];

        if ($is_columns === false) {
            $fields = array_merge($fields, [
                BlockParams::getBgColor(null, 20),
                BlockParams::getTopPadding(20),
                BlockParams::getBottomPadding(20),
                BlockParams::getIsVisible(20),
                BlockParams::getBlocId(20),
                BlockParams::getBackground(),
                BlockParams::getBackgroundOpacity(),
                BlockParams::getBackgroundParallax(),
            ]);
        }

        $fields = array_merge($fields, [
            WysiwygEditor::make('Texte', 'text')
                ->required()
                ->disableMediaUpload(),
            Link::make('Lien', 'cta')
                ->wrapper(['width' => 50]),
            ButtonGroup::make('Alignement du lien', 'link_align')
                ->choices([
                    'left' => 'Gauche',
                    'center' => 'Centre',
                    'right' => 'Droit'
                ])
                ->default('left')
                ->layout('vertical')
                ->wrapper(['width' => 25]),
            ButtonGroup::make('Style du bouton', 'link_style')
                ->choices([
                    'tertiary' => 'Discret',
                    'primary' => 'Bouton',
                ])
                ->default('tertiary')
                ->layout('vertical')
                ->wrapper(['width' => 25]),
            ButtonGroup::make('Largeur du texte', 'text_width')
                ->choices([
                    'width-25' => '25%',
                    'width-50' => '50%',
                    'width-75' => '75%',
                ])
                ->layout('vertical')
                ->default('width-50')
                ->wrapper(['width' => 25]),
            ButtonGroup::make('Alignement du texte', 'text_align')
                ->choices([
                    'left' => 'Gauche',
                    'center' => 'Centre',
                    'right' => 'Droite',
                ])
                ->layout('vertical')
                ->default('left')
                ->wrapper(['width' => 25]),
            ButtonGroup::make('Ratio du média', 'media_ratio')
                ->choices([
                    'default' => 'Par défaut',
                    'landscape' => 'Paysage',
                    'portrait' => 'Portrait',
                    'square' => 'Carré',
                    'full-height' => 'Pleine hauteur',
                ])
                ->layout('vertical')
                ->default('landscape')
                ->wrapper(['width' => 25]),
            TrueFalse::make('Choix du média', 'media_choice')
                ->stylized(on: 'Image', off: 'Vidéo')
                ->default(true)
                ->wrapper(['width' => 25]),
            TrueFalse::make('Placement du média', 'img_to_left')
                ->stylized(on: 'Gauche', off: 'Droite')
                ->default(true)
                ->wrapper(['width' => 25]),
            TrueFalse::make('Effet parallaxe sur l\'image', 'img_parallax')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(false)
                ->conditionalLogic([
                    ConditionalLogic::where('media_choice', '==', 1)
                ])
                ->wrapper(['width' => 33]),

            Image::make('Image', 'image')
                ->conditionalLogic([
                    ConditionalLogic::where('media_choice', '==', 1)
                ]),
            ButtonGroup::make('Source de la vidéo', 'video_src')
                ->choices([
                    'mp4' => 'Médiathèque',
                    'youtube' => 'Youtube',
                    'vimeo' => 'Vimeo',
                    'dailymotion' => 'Dailymotion',
                ])
                ->layout('vertical')
                ->default('mp4')
                ->wrapper(['width' => 33])
                ->conditionalLogic([
                    ConditionalLogic::where('media_choice', '==', false)
                ]),
            File::make('Vidéo', 'video')
                ->acceptedFileTypes(['mp4', 'mov', 'mpeg', 'mpg'])
                ->conditionalLogic([
                    ConditionalLogic::where('video_src', '==', 'mp4')
                ]),
            File::make('Aperçu de la vidéo', 'preview')
                ->helperText('Vous pouvez choisir une image ou une vidéo courte qui tournera en boucle.')
                ->conditionalLogic([
                    ConditionalLogic::where('media_choice', '==', false),
                    ConditionalLogic::where('video_src', '==', 'mp4')
                ]),
            Text::make('Lien YouTube', 'youtube_link')
                ->conditionalLogic([
                    ConditionalLogic::where('video_src', '==', 'youtube')
                ]),
            Text::make('Lien Vimeo', 'vimeo_link')
                ->helperText('Attention ! Lien de type https://vimeo.com/xxxxxxxx')
                ->conditionalLogic([
                    ConditionalLogic::where('video_src', '==', 'vimeo')
                ]),
            Text::make('Lien Dailymotion', 'dailymotion_link')
                ->helperText('Attention ! Lien de type https://www.dailymotion.com/video/xxxxxxx')
                ->conditionalLogic([
                    ConditionalLogic::where('video_src', '==', 'dailymotion')
                ]), 
        ]);

        return Layout::make('Texte + image/vidéo', 'text-image')
            ->layout('block')
            ->fields($fields);
    }
}
