<?php

namespace App\FieldGroup;

use App\Modules\Accordion;
use App\Modules\BlockParams;
use App\Modules\ClickableTiles;
use App\Modules\Contact;
use App\Modules\EventsSlider;
use App\Modules\Form;
use App\Modules\FreePost;
use App\Modules\Gallery;
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
use App\Modules\Product;
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
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Message;
use Extended\ACF\Fields\RadioButton;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Tab;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\TrueFalse;

class ShopPageFields extends WordplateInit
{
    public function fieldGroup(): array
    {
            return [
                    'key' => 'group_contentCommerce',
                    'title' => 'Contenu de la page boutique',
                    'hide_on_screen' => [
                            'the_content',
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
                                    ->stylized(on : 'Oui', off : 'Non')
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
                                    ->layouts($this->getLayout())
                    ],
                    'location' => [
                            Location::where('post_type', 'page')
                                    ->and('post', '=', get_option('woocommerce_shop_page_id'))
                    ],
            ];
    }

    public function getLayout()
    {
            $layout = [
                    Product::getLayout(),
                    HeadText::getLayout(),
                    TextSimple::getLayout(),
                    TextImage::getLayout(),
                    Accordion::getLayout(),
                    Review::getLayout(),
                    ReusableBloc::getLayout(),
                    ImagesSlider::getLayout(),
                    Map::getLayout(),
                    KeyFigures::getLayout(),
                    Quote::getLayout(),
                    FreePost::getLayout(),
                    Contact::getLayout(),
                    EventsSlider::getLayout(),
                    Form::getLayout(),
                    Gallery::getLayout(),
                    ImagesVideosParallax::getLayout(),
                    LinkAlone::getLayout(),
                    IconLogo::getLayout(),
                    Ornament::getLayout(),
                    PlanSite::getLayout(),
                    BlocReferences::getLayout(),
                    Separator::getLayout(),
                    NewsSlider::getLayout(),
                    SliderLogo::getLayout(),
                    SliderTextVideo::getLayout(),
                    ClickableTiles::getLayout(),
                    TextScrolling::getLayout(),
                    IllusVideo::getLayout(),
                    Video::getLayout(),
            ];

            return $layout;
    }
}
