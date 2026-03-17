<?php

namespace App\Modules;

use App\Modules\BlockParams;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\File;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\Textarea;
use Extended\ACF\Fields\TrueFalse;
use Extended\ACF\Fields\URL;
use Extended\ACF\Fields\WYSIWYGEditor;

class SliderTextVideo
{
    public static function getLayout()
    {
        return Layout::make('Texte + vidéo (slider)', 'text-video-slider')
                ->layout('block')
                ->fields([
                        BlockParams::getBgColor(null, 20),
                        BlockParams::getTopPadding(null, 20),
                        BlockParams::getBottomPadding(null, 20),
                        BlockParams::getIsVisible(null, 20),
                        BlockParams::getBlocId(null, 20),
                        BlockParams::getBackground(),
                        BlockParams::getBackgroundOpacity(),
                        BlockParams::getBackgroundParallax(),
                        TrueFalse::make('Afficher le bouton découvrir', 'discover_btn')
                                ->default(true)
                                ->stylized(on : 'Oui', off : 'Non')
                                ->wrapper(['width' => 33]),
                        Repeater::make('Slider', 'slider')
                                ->minRows(1)
                                ->collapsed('title')
                                ->button('Ajouter une slide')
                                ->layout('block')
                                ->collapsed('title')
                                ->fields([

                                        Text::make('Titre', 'title')
                                                ->required(),
                                        TrueFalse::make('Mettre le titre en H1', 'is_h1')
                                                ->helperText('Par défaut le titre sera en H2')
                                                ->default(false)
                                                ->stylized(on : 'Oui', off : 'Non')
                                                ->conditionalLogic([
                                                        ConditionalLogic::where('h1_in_header', '==', 0),
                                                ]),
                                        WYSIWYGEditor::make('Description', 'desc')
                                                ->disableMediaUpload(),
                                        Link::make('Lien' . '1', 'link_1')
                                                ->wrapper(['width' => 50]),
                                        Link::make('Lien' . '2', 'link_2')
                                                ->wrapper(['width' => 50]),
                                        File::make('Aperçu de la video', 'preview')
                                                ->helperText('Vous pouvez soit mettre une image soit une vidéo courte qui tournera en boucle.'
                                                        ),
                                        URL::make('Vidéo YouTube', 'video')
                                                ->helperText('Format attendu : https://www.youtube.com/watch?v=xxxxxxxx'),
                                ])
                ]);
    }
}
