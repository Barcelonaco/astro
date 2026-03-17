<?php

namespace App\Modules;

use App\Modules\BlockParams;
use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Message;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\WYSIWYGEditor;


class TextSimple
{
    public static function getLayout($is_columns = false)
    {
        $fields = [];

        if ($is_columns === false) {
            $fields = array_merge($fields, [
                BlockParams::getBlocId(20),
                BlockParams::getBgColor(null, 20),
                BlockParams::getTopPadding(20),
                BlockParams::getBottomPadding(20),
                BlockParams::getBackground(),
                BlockParams::getBackgroundOpacity(),
                BlockParams::getBackgroundParallax(),
                BlockParams::getIsVisible(20),
            ]);
        }

        $fields = array_merge($fields, [
            WYSIWYGEditor::make('Texte', 'text')->disableMediaUpload(),
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
                        ->wrapper(['width' => 25])
                        ->conditionalLogic([
                            ConditionalLogic::where('cta', '!=', '')
                        ]),
            ButtonGroup::make('Style du bouton', 'link_style')
                        ->choices([
                            'tertiary' => 'Discret',
                            'primary' => 'Bouton',
                        ])
                        ->default('tertiary')
                        ->layout('vertical')
                        ->wrapper(['width' => 25])
                        ->conditionalLogic([
                            ConditionalLogic::where('cta', '!=', '')
                        ]),
        ]);

        return Layout::make('Texte', 'text')
            ->layout('block')
            ->fields($fields);
    }
}
