<?php

namespace App\FieldGroup;

use App\Modules\Accordion;
use App\Modules\BlockParams;
use App\Modules\ClickableTiles;
use App\Modules\ColumnsTab;
use App\Modules\Contact;
use App\Modules\EventsSlider;
use App\Modules\Form;
use App\Modules\FreePost;
use App\Modules\IconLogo;
use App\Modules\IllusVideo;
use App\Modules\ImagesSlider;
use App\Modules\ImagesVideosParallax;
use App\Modules\KeyFigures;
use App\Modules\LinkAlone;
use App\Modules\Map;
use App\Modules\NewsSlider;
use App\Modules\Ornament;
use App\Modules\PlanSite;
use App\Modules\Quote;
use App\Modules\BlocReferences;
use App\Modules\ReusableBloc;
use App\Modules\Review;
use App\Modules\Separator;
use App\Modules\SliderLogo;
use App\Modules\SliderTextVideo;
use App\Modules\Summary;
use App\Modules\TextImage;
use App\Modules\TextScrolling;
use App\Modules\TextSimple;
use App\Modules\Video;
use App\Modules\Widget;

use App\Posttype\CptReusableBlock;

use Bandco\Core\WordplateInit;

use Extended\ACF\Location;
use Extended\ACF\Fields\FlexibleContent;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Message;
use Extended\ACF\Fields\RadioButton;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\TrueFalse;
use Extended\ACF\Fields\WYSIWYGEditor;

class ReusableBlockSingle extends WordplateInit
{

    public function fieldGroup(): array
    {
        $cptSlug = new CptReusableBlock();
        return [
            'key' => 'group_reusableBlock',
            'title' => 'Contenu du bloc réutilisable',
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
                FlexibleContent::make(__('Contenu', THEME_TEXTDOMAIN), 'flexible_modules')
                    ->button(__('Ajouter un bloc', THEME_TEXTDOMAIN))
                    ->layouts($this->getLayout())
            ],
            'location' => [
                Location::where('post_type', $cptSlug->getSlug())
            ],
        ];
    }
    public function getLayout(): array
    {
        return (new \App\Helpers\AcfHelper())->getAllModulesLayouts();
    }
}

