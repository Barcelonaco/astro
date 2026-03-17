<?php

namespace App\FieldGroup;

use App\Modules\HeadText;
use Bandco\Core\WordplateInit;

use App\Modules\NewsSlider;
use App\Modules\ImagesSlider;
use App\Modules\Accordion;
use App\Modules\TextSimple;
use App\Modules\ClickableTiles;
use App\Modules\ColumnsTab;
use App\Modules\Map;
use App\Modules\NewsletterForm;
use App\Modules\Contact;
use App\Modules\EventsSlider;
use App\Modules\Form;
use App\Modules\FreePost;
use App\Modules\IconLogo;
use App\Modules\IllusVideo;
use App\Modules\ImagesVideosParallax;
use App\Modules\KeyFigures;
use App\Modules\LinkAlone;
use App\Modules\Ornament;
use App\Modules\PlanSite;
use App\Modules\Product;
use App\Modules\Quote;
use App\Modules\BlocReferences;
use App\Modules\ReusableBloc;
use App\Modules\Review;
use App\Modules\Separator;
use App\Modules\SliderLogo;
use App\Modules\SliderTextVideo;
use App\Modules\Summary;
use App\Modules\Team;
use App\Modules\TextImage;
use App\Modules\TextScrolling;
use App\Modules\Video;
use App\Modules\Widget;


use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\Gallery;
use Extended\ACF\Fields\FlexibleContent;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Tab;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\WYSIWYGEditor;
use Extended\ACF\Location;

use App\Posttype\CptReferences;

class References extends WordplateInit
{


    public function fieldGroup(): array
    {

        $cptSlug = new CptReferences();
        return [
            'key' => 'group_references',
            'title' => 'Référence',
            'hide_on_screen' => [
                'permalink',
                'the_content',
                'excerpt',
                'discussion',
                'comments',
                'revisions',
                'slug',
                'author',
                'format',
                'page_attributes',
                'featured_image',
                'categories',
                'tags',
                'send-trackbacks',
            ],
            'fields' => [
                Tab::make('Popup')
                    ->placement('left')
                    ->conditionalLogic([
                        ConditionalLogic::where('ref_display', '!=', 'page')
                    ]),
                Text::make('Sous-titre', 'customer_name')
                    ->wrapper(['width' => 50]),
                WYSIWYGEditor::make('Texte', 'text')
                    ->disableMediaUpload(),
                Gallery::make('Photos', 'photos')
                    ->acceptedFileTypes(['jpg', 'jpeg', 'bmp', 'png', 'webp'])
                    ->minFiles(1),
                Link::make('Lien', 'link'),
                Tab::make('Contenu')
                    ->placement('left')
                    ->conditionalLogic([
                        ConditionalLogic::where('ref_display', '!=', 'popup')
                    ]),
                FlexibleContent::make('Contenu', 'flexible_modules')
                    ->button('Ajouter un bloc')
                    ->layouts($this->getLayout())

            ],
            'location' => [
                Location::where('post_type', $cptSlug->getSlug()),
            ],
        ];
    }
    public function getLayout(): array
    {
        return (new \App\Helpers\AcfHelper())->getAllModulesLayouts();
    }
}
