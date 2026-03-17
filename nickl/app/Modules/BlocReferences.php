<?php

namespace App\Modules;

use App\Modules\BlockParams;

use App\Posttype\CptReferences;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Message;
use Extended\ACF\Fields\Relationship;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\TrueFalse;

class BlocReferences
{
    public static function getLayout($is_columns = false)
    {
        $cptSlug = new CptReferences();
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
                Message::make('Information')
                        ->body(
                                'Ce bloc peut afficher automatiquement les 3 dernières références ou vous pouvez choisir les références à afficher.'
                        ),
                TrueFalse::make('Choix des références', 'is_manual')
                        ->stylized(on : 'Manuel', off : 'Automatique')
                        ->default(false),
                Relationship::make('Choix des références', 'refs_id')
                        ->postTypes([$cptSlug->getSlug()])
                        ->minPosts(1)
                        ->maxPosts(3)
                        ->format('id')
                        ->conditionalLogic([
                                ConditionalLogic::where('is_manual', '==', 1)
                        ]),
                TrueFalse::make(
                        'Afficher le lien pour voir toutes les références ?',
                        'display_archive_link'
                )
                        ->stylized(on : 'Oui', off : 'Non')
                        ->wrapper(['width' => 50]),
                Text::make('Label du lien', 'archive_link_label')
                        ->wrapper(['width' => 50])
                        ->default('Voir toutes les références')
                        ->conditionalLogic([
                                ConditionalLogic::where('display_archive_link', '==', 1)
                        ]),
        ]);

        return Layout::make('Références à la une', 'references')
                ->layout('block')
                ->fields($fields);
    }
}
