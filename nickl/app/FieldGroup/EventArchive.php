<?php

namespace App\FieldGroup;

use App\Modules\BlockParams;

use App\Posttype\CptEvents;

use Bandco\Core\WordplateInit;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\WYSIWYGEditor;
use Extended\ACF\Location;

class EventArchive extends WordplateInit
{

    public function fieldGroup(): array
    {
        $cptSlug = new CptEvents();
        return [
                'key' => 'group_eventArchive',
                'title' => "Page d'archive des évènements",
                'fields' => [
                        Text::make('Titre de la page (h1)', 'title')
                                ->wrapper(['width' => 40]),
                        ButtonGroup::make('Afficher le titre ?', 'title_in_header')
                                ->choices([
                                        'showTitle' => 'Oui',
                                        'hideTitle' => 'Non'
                                ])
                                ->default('showTitle')
                                ->layout('vertical')
                                ->wrapper(['width' => 15]),
                        ButtonGroup::make('Balise H1 dans le titre ?', 'h1_in_header')
                                ->choices([
                                        'yes' => 'Oui',
                                        'no' => 'Non'
                                ])
                                ->default('yes')
                                ->layout('vertical')
                                ->wrapper(['width' => 15])
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
                                ->wrapper(['width' => 15]),
                        ButtonGroup::make('Ratio des images', 'images_ratio')
                                ->choices([
                                        'landscape' => 'Paysage',
                                        'a4' => 'A4 Portrait',
                                ])
                                ->default('landscape')
                                ->layout('vertical')
                                ->wrapper(['width' => 15]),
                        ButtonGroup::make('Affichage principal', 'events_display')
                                ->choices([
                                        'list' => 'Liste',
                                        'grid' => 'Photo'
                                ])
                                ->layout('vertical')
                                ->wrapper(['width' => 15]),
                                WYSIWYGEditor::make('Description', 'archive_desc')
                                ->disableMediaUpload()
                                ->wrapper(['width' => 50]),
                        Image::make('Image du header (1 colonne)', 'header_img')
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
