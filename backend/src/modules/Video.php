<?php

namespace App\Modules;

use App\Modules\BlockParams;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\File;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\TrueFalse;

class Video
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
            ButtonGroup::make('Ratio du média', 'media_ratio')
                ->choices([
                    'default' => 'Par défaut',
                    'landscape' => 'Paysage',
                    'portrait' => 'Portrait',
                    'square' => 'Carré',
                    'full-height' => 'Pleine hauteur'
                ])
                ->layout('vertical')
                ->default('landscape')
                ->wrapper(['width' => 33]),
            TrueFalse::make('Choix du média', 'media_choice')
                ->stylized(on : 'Image', off : 'Vidéo')
                ->default(true)
                ->wrapper(['width' => 33]),
            ButtonGroup::make('Source de la vidéo', 'video_src')
                ->choices([
                    'mp4' => 'Médiathèque',
                    'youtube' => 'Youtube',
                    'vimeo' => 'Vimeo',
                    'dailymotion' => 'Dailymotion'
                ])
                ->layout('vertical')
                ->default('mp4')
                ->wrapper(['width' => 33])
                ->conditionalLogic([
                    ConditionalLogic::where('media_choice', '==', 0)
                ]),
            File::make('Video', 'video')
                ->required()
                ->acceptedFileTypes(['mp4', 'mov', 'mpeg', 'mpg'])
                ->wrapper(['width' => '75'])
                ->conditionalLogic([
                    ConditionalLogic::where('video_src', '==', 'mp4')
                ]),
            File::make('Aperçu de la vidéo', 'preview')
                ->helperText('Vous pouvez choisir une image ou une vidéo courte qui tournera en boucle.')
                ->conditionalLogic([
                    ConditionalLogic::where('media_choice', '==', 0),
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
                    ConditionalLogic::where('video_src', '==', 'daylimotion')
                ]),
            Image::make('Image', 'image')
                ->conditionalLogic([
                    ConditionalLogic::where('media_choice', '==', 1)
                ])
                ->wrapper(['width' => 50]),
            TrueFalse::make('Effet parallaxe sur l\'image', 'img_parallax')
                ->stylized(on : 'Activé', off : 'Désactivé')
                ->default(false)
                ->conditionalLogic([
                    ConditionalLogic::where('media_choice', '==', 1)
                ])
                ->wrapper(['width' => 50]),
        ]);

        return Layout::make('Image / Vidéo', 'video')
            ->layout('block')
            ->fields($fields);
    }
}
