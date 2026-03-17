<?php

namespace App\FieldGroup;

use App\Modules\Accordion;
use App\Modules\ClickableTiles;
use App\Modules\Contact;
use App\Modules\EventsSlider;
use App\Modules\Form;
use App\Modules\FreePost;
use App\Modules\HeadText;
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
use App\Modules\TextImage;
use App\Modules\TextScrolling;
use App\Modules\TextSimple;
use App\Modules\Video;
use Bandco\Core\WordplateInit;
use Extended\ACF\ConditionalLogic;
use Extended\ACF\Location;
use Extended\ACF\Fields\FlexibleContent;
use Extended\ACF\Fields\Message;
use Extended\ACF\Fields\RadioButton;
use Extended\ACF\Fields\Tab;
use Extended\ACF\Fields\TrueFalse;

class ProductField extends WordplateInit
{
    public function fieldGroup(): array
    {
        $modules = (new \App\Helpers\AcfHelper())->getAllModulesLayouts();
        return [
            'key' => 'group_contentProduct',
            'title' => 'Contenu du produit',
            'hide_on_screen' => [
                'discussion',
                'comments',
                'revisions',
                'slug',
                'author',
                'format',
                'page_attributes',
                'categories',
                'tags',
                'send-trackbacks',
            ],
            'fields' => [
                Tab::make('Header')
                    ->placement('left'),
                Message::make('Informations')
                    ->body(
                        'Vous pouvez afficher une bannière en haut de la page.<br>La bannière affiche l\'image mise en avant.',
                        THEME_TEXTDOMAIN
                    ),
                RadioButton::make('Hauteur de la bannière', 'banner_height')
                    ->choices([
                        'none' => 'Aucune',
                        'small' => 'Petite',
                        'medium' => 'Moyenne',
                        'large' => 'Grande',
                    ])
                    ->default('none')
                    ->wrapper(['width' => 33]),
                TrueFalse::make('Mettre le titre H1 dans le header ?', 'h1_in_header')
                    ->stylized(on : 'Oui', off :'Non')
                    ->default(false)
                    ->wrapper(['width' => 33]),

                TrueFalse::make('Afficher le titre dans le header ?', 'title_in_header')
                    ->stylized(on : 'Oui', off : 'Non')
                    ->default(true)
                    ->conditionalLogic([
                        ConditionalLogic::where('header_type', '==', 'simple')
                    ])
                    ->wrapper(['width' => 33]),
                Tab::make('Contenu')
                    ->placement('left'),
                FlexibleContent::make('Contenu', 'flexible_modules')
                    ->button('Ajouter un bloc')
                    ->layouts($this->getLayout()),
                Tab::make('Paramètre')
                    ->placement('left'),
                TrueFalse::make('Afficher les informations supplémentaires ?', 'infos_sup')
                    ->stylized(on : 'Oui', off : 'Non')
                    ->default(false)
                    ->wrapper(['width' => 33]),

            ],
            'location' => [
                Location::where('post_type', 'product'),
            ],
        ];
    }
    public function getLayout(): array
    {
        return (new \App\Helpers\AcfHelper())->getAllModulesLayouts();
    }
}
