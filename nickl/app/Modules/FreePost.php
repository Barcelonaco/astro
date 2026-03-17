<?php

namespace App\Modules;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\TrueFalse;

use App\Modules\BlockParams;

class FreePost
{
    public static function getLayout()
    {
        return Layout::make('Article libre', 'free-post')
                ->layout('block')
                ->fields([
                        ...BlockParams::getBlocTitle(),
                        BlockParams::getBgColor(),
                        BlockParams::getTopPadding(),
                        BlockParams::getBottomPadding(),
                        BlockParams::getIsVisible(),
                        BlockParams::getBackground(),
                        BlockParams::getBackgroundOpacity(),
                        BlockParams::getBackgroundParallax(),
                        TrueFalse::make('Ombre sur image', 'image_shadow')
                                ->stylized(on :'Oui', off : 'Non')
                                ->default(true),
                        Repeater::make('Listes', 'list')
                                ->minRows(1)
                                ->maxRows(4)
                                ->button('Ajouter un article')
                                ->layout('block')
                                ->collapsed('title')
                                ->fields([
                                        Image::make('Image', 'image')
                                                ->required()
                                                ->wrapper(['width' => 50]),
                                        Text::make('Titre (h3)', 'title'),
                                        Text::make('Phrase d\'accroche', 'catchphrase'),
                                        Link::make('Lien', 'primary_link')
                                                ->wrapper(['width' => 50]),
                                        Link::make('Lien secondaire', 'secondary_link')
                                                ->wrapper(['width' => 50]),
                                ])
                ]);
    }
}
