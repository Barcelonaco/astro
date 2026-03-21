<?php

namespace App\Modules;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\File;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Message;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\TrueFalse;
use Extended\ACF\Fields\RadioButton;

use App\Modules\BlockParams;

class ClickableTiles
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
                    'style-1' => 'Style 1: Le contenu est toujours affiché par dessus l\'image',
                    'style-2' => 'Style 2: Le contenu s\'affiche au survol l\'image'
                ])
                ->wrapper(['width' => 50])
                ->default('style-1'),
            TrueFalse::make('Type de lien', 'clickable_block')
                ->stylized(on: 'Bloc cliquable', off: 'Boutons')
                ->default(true)
                ->wrapper(['width' => 50]),
            TrueFalse::make('Tuiles imbriquées ?', 'interlocking_tiles')
                ->stylized(on: 'Oui', off: 'Non')
                ->default(true)
                ->wrapper(['width' => 50]),
            TrueFalse::make('Orientation', 'orientation')
                ->stylized(on: 'Portrait', off: 'Paysage')
                ->default(True)
                ->wrapper(['width' => 50])
                ->conditionalLogic([
                    ConditionalLogic::where('interlocking_tiles', '==', 0)
                ]),
            TrueFalse::make('Position du bloc principale', 'main-bloc-position')
                ->stylized(on: 'Droite', off: 'Gauche')
                ->default(False)
                ->wrapper(['width' => 50])
                ->conditionalLogic([
                    ConditionalLogic::where('interlocking_tiles', '==', 1)
                ]),
            Message::make('Information')
                ->body('La première tuile sera affichée en fin de liste')
                ->conditionalLogic([
                    ConditionalLogic::where('main-bloc-position', '==', 1)
                ]),
            Repeater::make('Tuiles', 'list_interlocking')
                ->minRows(1)
                ->maxRows(8)
                ->button('Ajouter une tuile')
                ->layout('block')
                ->collapsed('title')
                ->fields([
                    File::make('Image / Vidéo', 'file')
                        ->required()
                        ->acceptedFileTypes(['mp4', 'mov', 'mpeg', 'mpg', 'jpeg', 'jpg', 'png', 'webp', 'svg']),
                    Text::make('Titre (h3)', 'title'),
                    Text::make('Phrase d\'accroche', 'catchphrase'),
                    Link::make('Lien', 'primary_link')
                        ->wrapper(['width' => 50]),
                    Link::make('Lien secondaire', 'secondary_link')
                        ->wrapper(['width' => 50])
                        ->conditionalLogic([
                            ConditionalLogic::where('clickable_block', '==', 0)
                        ])
                ])
        ]);

        return Layout::make('Tuiles cliquables', 'clickable-tiles')
            ->layout('block')
            ->fields($fields);
    }
}
