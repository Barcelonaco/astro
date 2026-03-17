<?php

namespace App\Modules;

use App\Modules\BlockParams;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\File;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\TrueFalse;
use Extended\ACF\Fields\Range;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\Textarea;
use Extended\ACF\Fields\Link;

class ImagesVideosParallax
{
    public static function getLayout()
    {
        return Layout::make('Images vidéos parallaxe', 'images-videos-parallax')
                ->layout('block')
                ->fields([
                        ...BlockParams::getBlocTitle(),
                        BlockParams::getBgColor(),
                        BlockParams::getTopPadding(),
                        BlockParams::getBottomPadding(),
                        BlockParams::getIsVisible(),
                        Repeater::make('Listes des blocs', 'blocs')
                                ->button('Ajouter un bloc')
                                ->layout('block')
                                ->minRows(1)
                                ->collapsed('title')
                                ->fields([
                                        TrueFalse::make('Image ou vidéo ?', 'is_image')
                                                ->wrapper(['width' => 50])
                                                ->default(true)
                                                ->stylized(
                                                        on : 'Image',
                                                        off : 'Vidéo'
                                                ),
                                        Range::make('Opacité', 'overlay_opacity')
                                                ->wrapper(['width' => 50])
                                                ->default(50)
                                                ->min(0)
                                                ->max(100),

                                        Image::make('Image', 'image')
                                                ->acceptedFileTypes(['jpg', 'jpeg', 'gif', 'bmp', 'svg', 'png', 'webp'])
                                                ->previewSize('thumbnail')
                                                ->required()
                                                ->conditionalLogic([
                                                        ConditionalLogic::where('is_image', '==', 1)
                                                ]),

                                        File::make('Vidéo', 'video')
                                                ->acceptedFileTypes(['mp4'])
                                                ->required()
                                                ->conditionalLogic([
                                                        ConditionalLogic::where('is_image', '==', 0)
                                                ]),
                                        File::make('Vidéo mobile', 'video-mobile')
                                                ->acceptedFileTypes(['mp4'])
                                                ->required()
                                                ->conditionalLogic([
                                                        ConditionalLogic::where('is_image', '==', 0)
                                                ]),

                                        Text::make('Surtitre', 'sup-title')
                                                ->wrapper(['width' => 100]),
                                        Text::make('Titre', 'title')
                                                ->wrapper(['width' => 100]),
                                        Textarea::make('Description', 'desc')
                                                ->rows(2)
                                                ->wrapper(['width' => 100]),
                                        Link::make('Lien', 'primary_link')
                                                ->wrapper(['width' => 50]),
                                        Link::make('Lien secondaire', 'secondary_link')
                                                ->wrapper(['width' => 50]),
                                ])
                ]);
    }
}
