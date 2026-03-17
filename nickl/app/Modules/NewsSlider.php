<?php
namespace App\Modules;

use App\Modules\BlockParams;

use App\Posttype\CptNews;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Message;
use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\Relationship;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\TrueFalse;

class NewsSlider
{
    public static function getLayout($is_columns = false)
    {
        $cptSlug = new CptNews();
        $fields = [
            Message::make('Informations', 'informations')
                ->body('Ce bloc remonte automatiquement les 6 dernières actualités'),
        ];

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
            ButtonGroup::make('Affichage des actualités', 'display_posts')
                ->choices([
                    '1' => 'Un par un',
                    '2' => 'Par 2',
                    '3' => 'Par 3',
                    '4' => 'Par 4',
                ])
                ->default('1'),
            TrueFalse::make('Choix des actualités', 'is_manual')
                ->stylized(on: 'Manuel', off: 'Automatique')
                ->default(false),
            Relationship::make('Choix des actualités', 'news_id')
                ->postTypes([$cptSlug->getSlug()])
                ->postStatus(['publish'])
                ->elements(['post_title'])
                ->minPosts(1)
                ->maxPosts(6)
                ->format('id')
                ->conditionalLogic([
                    ConditionalLogic::where('is_manual', '==', 1)
                ]),
            TrueFalse::make('Afficher le lien pour voir toutes les actualités ?', 'display_archive_link')
                ->stylized(on: 'Oui', off: 'Non')
                ->wrapper(['width' => 50]),
            Text::make('Label du lien', 'archive_link_label')
                ->wrapper(['width' => 50])
                ->default('Voir toutes les actualités')
                ->conditionalLogic([
                    ConditionalLogic::where('display_archive_link', '==', 1)
                ]),
        ]);

        return Layout::make('Actualités à la une', 'news-slider')
            ->layout('block')
            ->fields($fields);
    }
}
