<?php

namespace App\FieldGroup; 

use App\Modules\BlockParams;

use Bandco\Core\WordplateInit;

use App\Posttype\CptNews;
use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\WYSIWYGEditor;
use Extended\ACF\Location;

class ActualitesArchive extends WordplateInit
{
    public function fieldGroup(): array
    {        
        $cptSlug = new CptNews();
        $fields = [
            'key' => 'group_newsArchive',
            'title' => "Page d'archive des actualités",
            'fields' => [
                Text::make('Titre de la page', 'title')
                    ->key('field_title')
                    ->wrapper(['width' => 50]),
                ButtonGroup::make('Afficher le titre ?', 'title_in_header')
                    ->key('field_title_in_header')
                    ->choices([
                        'showTitle' => 'Oui',
                        'hideTitle' => 'Non'
                    ])
                    ->default('showTitle')
                    ->layout('vertical')
                    ->wrapper(['width' => 15]),
                ButtonGroup::make('Balise H1 dans le titre ?', 'h1_in_header')
                    ->key('field_h1_in_header')
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
                    ->key('field_archive_display')
                    ->choices([
                        'column-1' => '1 colonne',
                        'columns-2' => '2 colonnes'
                    ])
                    ->default('column-1')
                    ->layout('vertical')
                    ->wrapper(['width' => 15]),
                WYSIWYGEditor::make('Description', 'archive_desc')
                    ->key('field_archive_desc')
                    ->disableMediaUpload()
                    ->wrapper(['width' => 50]),
                Image::make('Image du header (1 colonne)', 'header_img')
                    ->key('field_header_img')
                    ->wrapper(['width' => 30]),
                BlockParams::getBannerHeight(20)
                    ->key('field_banner_height')
                    ->conditionalLogic([
                        ConditionalLogic::where('header_img', '!=', '')
                    ]),
            ],
            'location' => [
                Location::where('options_page', 'options_' . $cptSlug->getSlug()),
            ],
        ];         

        return $fields;            
    }
}