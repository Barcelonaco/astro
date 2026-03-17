<?php

namespace App\Modules;

use App\Modules\BlockParams as BlockParams;

use App\Posttype\CptEvents;
use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Message;
use Extended\ACF\Fields\Relationship;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\TrueFalse;

class EventsSlider
{
    public static function getLayout($is_columns = false)
    {
        $cptSlug = new CptEvents();
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
                Message::make('Informations', 'informations')
                        ->body('Ce bloc affiche les 4 prochains évènements à venir.'),
                TrueFalse::make('Choix des évènements', 'is_manual')
                        ->stylized(on : 'Manuel', off : 'Automatique')
                        ->default(false),
                Relationship::make('Choix des événements', 'events_id')
                        ->postTypes([$cptSlug->getSlug()])
                        ->minPosts(1)
                        ->maxPosts(6)
                        ->format('id')
                        ->conditionalLogic([
                                ConditionalLogic::where('is_manual', '==', 1)
                        ]),
                TrueFalse::make(
                        'Afficher le lien pour voir toutes les évènements?',
                        'display_archive_link'
                )
                        ->stylized(on : 'Oui', off : 'Non')
                        ->wrapper(['width' => 50]),
                Text::make('Label du lien', 'archive_link_label')
                        ->wrapper(['width' => 50])
                        ->default('Voir toutes les évènements')
                        ->conditionalLogic([
                                ConditionalLogic::where('display_archive_link', '==', 1)
                        ]),
        ]);

        return Layout::make('Événements à la une', 'events-slider')
                ->layout('block')
                ->fields($fields);
    }
}
