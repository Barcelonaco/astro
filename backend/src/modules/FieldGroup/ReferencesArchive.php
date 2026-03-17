<?php

namespace App\FieldGroup;

use App\Modules\BlockParams;
use App\Posttype\CptReferences;
use Bandco\Core\WordplateInit;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\WYSIWYGEditor;
use Extended\ACF\Location;

class ReferencesArchive extends WordplateInit
{
        public function fieldGroup(): array
        {
                $cptSlug = new CptReferences();
                return [
                        'key' => 'group_referencesArchive',
                        'title' => "Page d'archive des références",
                        'fields' => [
                                Text::make('Titre de la page (h1)', 'title')
                                        ->wrapper(['width' => 60]),
                                ButtonGroup::make('Affichage individuel des références', 'ref_display')
                                        ->choices([
                                                'page' => 'Page',
                                                'popup' => 'Pop-up',
                                                'both' => 'Les deux'
                                        ])
                                        ->default('popup')
                                        ->layout('vertical')
                                        ->wrapper(['width' => 40]),
                                ButtonGroup::make('Afficher le titre ?', 'title_in_header')
                                        ->choices([
                                                'showTitle' => 'Oui',
                                                'hideTitle' => 'Non'
                                        ])
                                        ->default('showTitle')
                                        ->layout('vertical')
                                        ->wrapper(['width' => 25]),
                                ButtonGroup::make('Balise H1 dans le titre ?', 'h1_in_header')
                                        ->choices([
                                                'yes' => 'Oui',
                                                'no' => 'Non'
                                        ])
                                        ->default('yes')
                                        ->layout('vertical')
                                        ->wrapper(['width' => 25])
                                        ->conditionalLogic([
                                                ConditionalLogic::where('title_in_header', '==', 'showTitle')
                                        ]),
                                ButtonGroup::make('Disposition du contenu', 'archive_display')
                                        ->choices([
                                                'column-1' => '1 colonne',
                                                'columns-2' => '2 colonnes'
                                        ])
                                        ->default('column-1')
                                        ->layout('vertical')
                                        ->wrapper(['width' => 25]),
                                ButtonGroup::make('Ordre d\'affichage', 'randomise_refs')
                                        ->choices([
                                                'asc' => 'Chronologique',
                                                'random' => 'Aléatoire'
                                        ])
                                        ->default('asc')
                                        ->layout('vertical')
                                        ->wrapper(['width' => 25]),
                                WYSIWYGEditor::make('Description', 'archive_desc')
                                        ->disableMediaUpload()
                                        ->wrapper(['width' => 50]),
                                Image::make('Image de fond (1 colonne)', 'header_img')
                                        ->wrapper(['width' => 30]),
                                BlockParams::getBannerHeight(20)
                                        ->conditionalLogic([
                                                ConditionalLogic::where('header_img', '!=', '')
                                        ]),
                        ],
                        'location' => [
                                Location::where('options_page', 'options_' . $cptSlug->getSlug()),
                        ],
                ];
        }
}
