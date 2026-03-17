<?php

namespace App\Modules;

use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\WYSIWYGEditor;

use App\Modules\BlockParams;

class Accordion
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
            Repeater::make('Accordéons', 'accordions')
                ->minRows(1)
                ->collapsed('title')
                ->layout('block')
                ->button('Ajouter un paragraphe')
                ->fields([
                    Text::make('Titre (pas de balise h)', 'title')
                        ->required(),
                    WYSIWYGEditor::make('Texte', 'text')
                        ->disableMediaUpload()
                        ->required(),
                ])
        ]);

        return Layout::make('Accordéons', 'accordion')
            ->layout('block')
            ->fields($fields);

    }
}
