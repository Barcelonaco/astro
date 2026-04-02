<?php

namespace App\Modules;

use App\Modules\BlockParams;
use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\Range;
use Extended\ACF\Fields\Select;
use Extended\ACF\Fields\TrueFalse;

class GoogleReviews
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
            Text::make('Place ID Google', 'place_id')
                ->helperText('Trouvez votre Place ID ici : https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder')
                ->required(),
            Range::make('Nombre d\'avis à afficher', 'limit')
                ->min(1)
                ->max(5)
                ->default(3)
                ->wrapper(['width' => 50]),
            Select::make('Note minimale', 'min_rating')
                ->choices([
                    '1' => '1 étoile',
                    '2' => '2 étoiles',
                    '3' => '3 étoiles',
                    '4' => '4 étoiles',
                    '5' => '5 étoiles',
                ])
                ->default('4')
                ->wrapper(['width' => 50]),
            TrueFalse::make('Afficher le lien vers Google Avis ?', 'display_google_reviews_link')
                ->stylized(on: 'Oui', off: 'Non')
                ->default(true)
                ->wrapper(['width' => 25]),
            Text::make('Texte du bouton', 'button_text')
                ->default('Voir tous les avis')
                ->wrapper(['width' => 25])
                ->conditionalLogic([
                    ConditionalLogic::where('display_google_reviews_link', '==', '1')
                ]),
            Text::make('Lien', 'button_link')
                ->default('https://g.page/r/PLACE_ID/reviews')
                ->wrapper(['width' => 25])
                ->conditionalLogic([
                    ConditionalLogic::where('display_google_reviews_link', '==', '1')
                ]),
        ]);

        return Layout::make('Avis Google', 'google-reviews')
            ->layout('block')
            ->fields($fields);
    }
}
