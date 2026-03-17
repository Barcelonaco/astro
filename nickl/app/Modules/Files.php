<?php

namespace App\Modules;

use App\Modules\BlockParams;

use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\File;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\TrueFalse;

class Files
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
            TrueFalse::make('Aperçu du fichier', 'files_preview')
                ->stylized(on : 'Oui', off : 'Non')
                ->default(True),
            Repeater::make('Liste des fichiers', 'files')
                ->button('Ajouter un document')
                ->layout('block')
                ->minRows(1)
                ->fields([
                    File::make('Fichier (pdf)', 'file')
                        ->required()
                        ->acceptedFileTypes(['pdf', 'application/pdf'])
                        ->wrapper(['width' => 50]),
                    Text::make('Titre du fichier', 'title')
                        ->wrapper(['width' => 50])
                ])
        ]);
        
        return Layout::make('Aperçu (pdf)', 'files')
                ->layout('block')
                ->fields($fields);
    }
}
