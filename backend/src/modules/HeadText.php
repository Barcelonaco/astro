<?php

namespace App\Modules;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\RadioButton;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\TrueFalse;
use Extended\ACF\Fields\WYSIWYGEditor;

use App\Modules\BlockParams;

class HeadText
{
    public static function getLayout()
    {
        return Layout::make('Texte avec titre', 'head-text')
            ->layout('block')
            ->fields([
                BlockParams::getBgColor(null, 20),
                BlockParams::getTopPadding(null, 20),
                BlockParams::getBottomPadding(null, 20),
                BlockParams::getIsVisible(null, 20),
                BlockParams::getBlocId(null,20),
                BlockParams::getBackground(),
                BlockParams::getBackgroundOpacity(),
                BlockParams::getBackgroundParallax(),

                // Ajout d’un identifiant unique pour éviter les conflits
                RadioButton::make('Nombre de colonne ?', 'nbr_column')
                    ->helperText('Sur une colonne le titre sera au dessus du texte.<br>Sur deux colonnes le titre sera à gauche du texte.')
                    ->default('columns-2')
                    ->choices([
                        'columns-1' => '1 colonne',
                        'columns-2' => '2 colonnes',
                    ]),

                TrueFalse::make('Mettre le titre en H1', 'is_h1')
                    ->helperText('Par défaut le titre sera en H2')
                    ->default(false)
                    ->stylized(on: 'Oui', off: 'Non')
                    ->conditionalLogic([
                        ConditionalLogic::where('h1_in_header', '==', 0),
                    ]),

                Text::make('Titre', 'title')
                    ->required(),

                WYSIWYGEditor::make('Texte', 'text')
                    ->required()
                    ->disableMediaUpload(),
            ]);
    }
}
