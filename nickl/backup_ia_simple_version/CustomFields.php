<?php

namespace App\FieldGroup;

use App\Modules\BlockParams;

use App\Modules\Schemas\Actualites as SchemasActualites;
use App\Modules\Schemas\ContactPage;
use App\Modules\Schemas\Events as SchemasEvents;
use App\Modules\Schemas\Faq;
use App\Modules\Schemas\LocalBusiness;
use App\Modules\Schemas\Organisation;
use App\Modules\Schemas\References as SchemasReferences;

use App\Posttype\CptNews;

use Bandco\Core\WordplateInit;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\ColorPicker;
use Extended\ACF\Fields\File;
use Extended\ACF\Fields\FlexibleContent;
use Extended\ACF\Fields\Group;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Message;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Tab;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\Textarea;
use Extended\ACF\Fields\TrueFalse;
use Extended\ACF\Location;

class CustomFields extends WordplateInit
{
    private $cptNews;


    public function fieldGroup(): array
    {
        $this->cptNews = new CptNews();
        if ($this->getCurrentPostType() !== $this->cptNews->getSlug()) {
            return [
                'key' => 'group_customFields',
                'title' => 'Création de votre page',
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
                    Tab::make('⚠️ Attention')
                        ->placement('top')
                        ->conditionalLogic([
                            ConditionalLogic::where('h1_in_header', '==', 'no')
                        ]),
                    Message::make('Référencement')
                        ->body('Penser à mettre un titre H1 dans votre page, le titre H1 sert au référencement naturel de votre site.
                            <br>
                            Vous  pouvez le définir soit dans le <b>Header</b> soit dans les blocs <b>Texte avec titre</b> ou <b>Slider Texte + vidéo</b>'),

                    Tab::make('Header')
                        ->placement('top'),
                    ButtonGroup::make('Choix du type de header', 'header_type')
                        ->choices([
                            'none' => 'Aucun',
                            'hero' => 'Hero banner',
                            'simple' => 'Basique'
                        ])
                        ->default('none')
                        ->layout('vertical')
                        ->wrapper(['width' => 25]),
                    ButtonGroup::make('Afficher le titre ?', 'title_in_header')
                        ->choices([
                            'showTitle' => 'Oui',
                            'hideTitle' => 'Non'
                        ])
                        ->default('showTitle')
                        ->layout('vertical')
                        ->wrapper(['width' => 25])
                        ->conditionalLogic([
                            ConditionalLogic::where('header_type', '!=', 'none')
                        ]),
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
                    ButtonGroup::make('Hauteur de la bannière', 'banner_height')
                        ->choices([
                            'small' => 'Petite',
                            'medium' => 'Moyenne',
                            'large' => 'Grande',
                        ])
                        ->layout('vertical')
                        ->wrapper(['width' => 25])
                        ->conditionalLogic([
                            ConditionalLogic::where('header_type', '==', 'simple')
                        ]),
                    TrueFalse::make('Choix du type de Hero Banner', 'is_hero_banner_slider')
                        ->conditionalLogic([
                            ConditionalLogic::where('header_type', '==', 'hero')
                        ])
                        ->default(true)
                        ->stylized(
                            on: 'Slider (photos / vidéos)',
                            off: 'Double bloc (image)'
                        )
                        ->wrapper(['width' => 33]),
                    TrueFalse::make('Marquise', 'hero_banner_marquise')
                        ->conditionalLogic([
                            ConditionalLogic::where('header_type', '==', 'hero')
                        ])
                        ->stylized(
                            on: 'Oui',
                            off: 'Non'
                        )
                        ->wrapper(['width' => 33]),
                    TrueFalse::make('Hauteur hero banner ?', 'hero_banner_height')
                        ->conditionalLogic([
                            ConditionalLogic::where('header_type', '==', 'hero')
                                ->and('is_hero_banner_slider', '==', 1)
                        ])
                        ->stylized(
                            on: 'Réduit',
                            off: 'Plein écran'
                        )
                        ->wrapper(['width' => 33]),

                    Message::make('Informations')
                        ->body('Le header simple affiche le titre avec l\'image de mise en avant en fond.')
                        ->conditionalLogic([
                            ConditionalLogic::where('header_type', '==', 'simple')
                        ]),
                    Message::make('Règle du H1', 'params_h1_simple')
                        ->body('Le H1 sera le titre de la page')
                        ->conditionalLogic([
                            ConditionalLogic::where('h1_in_header', '==', 1)
                                ->and('header_type', '==', 'simple')
                        ]),
                    ButtonGroup::make('Alignement du contenu', 'hero_banner_align')
                        ->choices([
                            'left' => 'A gauche',
                            'center' => 'Au centre',
                            'right' => 'A droite'
                        ])
                        ->default('left')
                        ->wrapper(['width' => 50])
                        ->conditionalLogic([
                            ConditionalLogic::where('header_type', '==', 'hero')
                        ]),
                    BlockParams::getBgColor(2, 50, 'horizontal'),

                    // Sliders
                    Message::make('Règle du H1', 'params_h1_slider')
                        ->body('Le H1 sera la phrase d\'accroche de la première slide')
                        ->conditionalLogic([
                            ConditionalLogic::where('h1_in_header', '==', 'yes')
                                ->and('is_hero_banner_slider', '==', 1)
                                ->and('header_type', '==', 'hero')
                        ]),
                    Repeater::make('Sliders', 'hero_sliders')
                        ->conditionalLogic([
                            ConditionalLogic::where('is_hero_banner_slider', '==', 1)
                                ->and('header_type', '==', 'hero')
                        ])
                        ->minRows(1)
                        ->layout('block')
                        ->button('Ajouter un slide')
                        ->collapsed('title')
                        ->fields([
                            Image::make('Illustration', 'logo')
                                ->previewSize('thumbnail')
                                ->wrapper(['width' => 50]),
                            ButtonGroup::make('Choix de la taille de l\'illustration', 'logo_size')
                                ->choices([
                                    'size-s' => 'Petit',
                                    'size-m' => 'Moyen',
                                    'size-l' => 'Grand',
                                    'size-xl' => 'Très grand',
                                ])
                                ->default('size-m')
                                ->wrapper(['width' => 50]),
                            Text::make('Surtitre', 'title'),
                            Textarea::make('Titre', 'catchphrase'),
                            TrueFalse::make('Image ou vidéo ?', 'is_image')
                                ->default(true)
                                ->stylized(on: 'Image', off: 'Vidéo')
                                ->wrapper(['width' => 20]),
                            Image::make('Image', 'image')
                                ->acceptedFileTypes(['jpg', 'jpeg', 'gif', 'bmp', 'svg', 'png', 'webp'])
                                ->wrapper(['width' => 40])
                                ->previewSize('thumbnail')
                                ->required()
                                ->conditionalLogic([
                                    ConditionalLogic::where('is_image', '==', 1)
                                ]),
                            Image::make('Image (mobile)', 'image_mobile')
                                ->helperText(
                                    'Taille recommandée: 600 x 1000px'
                                )
                                ->acceptedFileTypes(['jpg', 'jpeg', 'gif', 'bmp', 'svg', 'png', 'webp'])
                                ->wrapper(['width' => 40])
                                ->previewSize('thumbnail')
                                ->conditionalLogic([
                                    ConditionalLogic::where('is_image', '==', 1)
                                ]),
                            File::make('Vidéo', 'video')
                                ->helperText('Si possible une vidéo très courte qui pourra tourner en boucle sans trop voir la coupure.')
                                ->acceptedFileTypes(['mp4'])
                                ->required()
                                ->conditionalLogic([
                                    ConditionalLogic::where('is_image', '==', 0)
                                ])
                                ->wrapper(['width' => 40]),
                            Image::make('Image de remplacement', 'video_replacement_image')
                                ->helperText('L\'image s\'affichera à la place de la vidéo sur tablette et mobile.')
                                ->required()
                                ->conditionalLogic([
                                    ConditionalLogic::where('is_image', '==', 0)
                                ])
                                ->wrapper(['width' => 40]),
                            Link::make('Lien 1', 'cta')
                                ->wrapper(['width' => 50]),
                            Link::make('Lien 2', 'cta_2')
                                ->wrapper(['width' => 50]),
                        ]),
                    Message::make('Règle du H1', 'params_h1_double_bloc')
                        ->body('Le H1 sera la phrase d\'accroche du bloc de gauche')
                        ->conditionalLogic([
                            ConditionalLogic::where('h1_in_header', '==', 'yes')
                                ->and('is_hero_banner_slider', '==', 0)
                                ->and('header_type', '==', 'hero')
                        ]),
                    Group::make('Bloc de gauche', 'left_bloc')
                        ->wrapper(['width' => 50])
                        ->conditionalLogic([
                            ConditionalLogic::where('is_hero_banner_slider', '==', 0)
                                ->and('header_type', '==', 'hero')
                        ])
                        ->fields([
                            Text::make('Titre', 'title'),
                            Textarea::make('Phrase d\'accroche', 'catchphrase')
                                ->rows(2),
                            Image::make('Image', 'image')
                                ->acceptedFileTypes(['jpg', 'jpeg', 'gif', 'bmp', 'svg', 'png', 'webp'])
                                ->required(),
                            Link::make('Lien', 'cta')
                                ->wrapper(['width' => 50]),
                            Link::make('Lien', 'cta_2')
                                ->wrapper(['width' => 50]),
                        ]),
                    Group::make('Bloc de droite', 'right_bloc')
                        ->wrapper(['width' => 50])
                        ->conditionalLogic([
                            ConditionalLogic::where('is_hero_banner_slider', '==', 0)
                                ->and('header_type', '==', 'hero')
                        ])
                        ->fields([
                            Text::make('Titre', 'title'),
                            Textarea::make('Phrase d\'accroche', 'catchphrase')
                                ->rows(2),
                            Image::make('Image', 'image')
                                ->acceptedFileTypes(['jpg', 'jpeg', 'gif', 'bmp', 'svg', 'png', 'webp'])
                                ->required(),
                            Link::make('Lien', 'cta')
                                ->wrapper(['width' => 50]),
                            Link::make('Lien', 'cta_2')
                                ->wrapper(['width' => 50]),
                        ]),

                    Tab::make('Contenu')
                        ->placement('top'),
                    FlexibleContent::make('Contenu', 'flexible_modules')
                        ->button('Ajouter un bloc')
                        ->layouts($this->getLayout()),

                    Tab::make('Couleurs et logos')
                        ->placement('top'),
                    TrueFalse::make('Surcharge des couleurs', 'override_colors')
                        ->stylized(on: 'Activé', off: 'Désactivé')
                        ->default(false),
                    ColorPicker::make('Couleur Primaire', 'primary_color')
                        ->default(get_field('primary_color', 'options'))
                        ->wrapper(['width' => 33])
                        ->conditionalLogic([
                            ConditionalLogic::where('override_colors', '==', 1)
                        ]),
                    ColorPicker::make('Couleur Secondaire', 'secondary_color')
                        ->default(get_field('secondary_color', 'options'))
                        ->wrapper(['width' => 33])
                        ->conditionalLogic([
                            ConditionalLogic::where('override_colors', '==', 1)
                        ]),
                    ColorPicker::make('Couleur Tertiaire', 'tertiary_color')
                        ->default(get_field('tertiary_color', 'options'))
                        ->wrapper(['width' => 33])
                        ->conditionalLogic([
                            ConditionalLogic::where('override_colors', '==', 1)
                        ]),
                    ColorPicker::make('Couleur des textes', 'text_color')
                        ->default(get_field('text_color', 'options'))
                        ->wrapper(['width' => 33])
                        ->conditionalLogic([
                            ConditionalLogic::where('override_colors', '==', 1)
                        ]),
                    ColorPicker::make('Couleur de fond du site', 'background_color')
                        ->default(get_field('background_color', 'options'))
                        ->wrapper(['width' => 33])
                        ->conditionalLogic([
                            ConditionalLogic::where('override_colors', '==', 1)
                        ]),
                    ColorPicker::make('Couleur de fond des champs de formulaire', 'bg_form_field')
                        ->default(get_field('bg_form_field', 'options'))
                        ->wrapper(['width' => 33])
                        ->conditionalLogic([
                            ConditionalLogic::where('override_colors', '==', 1)
                        ]),
                    TrueFalse::make('Modifier le logo du header', 'change_logo_header')
                        ->stylized(on: 'Activé', off: 'Désactivé')
                        ->default(false),
                    Image::make('Logo du header', 'logo_header')
                        ->conditionalLogic([
                            ConditionalLogic::where('change_logo_header', '==', 1)
                        ]),
                    TrueFalse::make('Modifier le logo du footer', 'change_logo_footer')
                        ->stylized(on: 'Activé', off: 'Désactivé')
                        ->default(false),
                    Image::make('Logo du footer', 'logo_footer')
                        ->conditionalLogic([
                            ConditionalLogic::where('change_logo_footer', '==', 1)
                        ]),

                    Tab::make('Schemas')
                        ->placement('top'),
                    FlexibleContent::make('Schema', 'flexible_schemas')
                        ->button('Ajouter un type')
                        ->layouts($this->getSchema()),

                    ...(is_admin() ? [
                        Tab::make('Génération par IA')
                            ->placement('top'),
                        Textarea::make('Contenu HTML', 'content_html')
                            ->rows(20)
                            ->wrapper(['width' => 100]),
                        Message::make('Génération', 'ai_generation_button')
                            ->body('<button type="button" class="button button-primary" id="generateaicontent">Générer le contenu</button>')
                    ] : []),
                ],
                'location' => [
                    Location::where('page_type', 'front_page'),
                    Location::where('post_type', 'page')
                        ->and('post', '!=', get_option('woocommerce_shop_page_id'))
                ],
            ];
        } else {
            return [
                'key' => 'group_customFields',
                'title' => 'Création de votre actualité',
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
                        ->placement('top'),
                    ButtonGroup::make('Mettre le titre H1 dans le header ?', 'h1_in_header')
                        ->choices([
                            'yes' => 'Oui',
                            'no' => 'Non'
                        ])
                        ->default(true)
                        ->layout('vertical')
                        ->wrapper(['width' => 33]),
                    ButtonGroup::make('Afficher le titre dans le header ?', 'title_in_header')
                        ->choices([
                            'showTitle' => 'Oui',
                            'hideTitle' => 'Non'
                        ])
                        ->default(true)
                        ->layout('vertical')
                        ->wrapper(['width' => 33]),
                    Tab::make('Contenu')
                        ->placement('top'),
                    FlexibleContent::make('Contenu', 'flexible_modules')
                        ->button('Ajouter un bloc')
                        ->layouts($this->getLayout()),
                ],
                'location' => [
                    Location::where('post_type', $this->cptNews->getSlug()),
                ],
            ];
        }
    }


    public function getLayout(): array
    {
        return (new \App\Helpers\AcfHelper())->getAllModulesLayouts();
    }
    public function getSchema()
    {
        $schemas = [
            Organisation::getLayout(),
            LocalBusiness::getLayout(),
            ContactPage::getLayout(),
            Faq::getLayout(),
            SchemasReferences::getLayout(),
            SchemasActualites::getLayout(),
            SchemasEvents::getLayout(),
        ];

        return $schemas;
    }

    public function getCurrentPostType()
    {
        global $post, $parent_file, $typenow, $current_screen, $pagenow;
        $post_type = null;
        if ($post && (property_exists($post, 'post_type') || method_exists($post, 'post_type'))) {
            $post_type = $post->post_type;
        }
        if (
            empty($post_type) && !empty($current_screen) && (property_exists(
                $current_screen,
                'post_type'
            ) || method_exists(
                $current_screen,
                'post_type'
            )) && !empty($current_screen->post_type)
        ) {
            $post_type = $current_screen->post_type;
        }
        if (empty($post_type) && !empty($typenow)) {
            $post_type = $typenow;
        }
        if (empty($post_type) && function_exists('get_current_screen')) {
            $post_type = get_current_screen();
        }
        if (empty($post_type) && isset($_REQUEST['post']) && !empty($_REQUEST['post']) && function_exists('get_post_type') && $get_post_type = get_post_type((int) $_REQUEST['post'])) {
            $post_type = $get_post_type;
        }
        if (empty($post_type) && isset($_REQUEST['post_type']) && !empty($_REQUEST['post_type'])) {
            $post_type = sanitize_key($_REQUEST['post_type']);
        }
        if (empty($post_type) && 'edit.php' == $pagenow) {
            $post_type = 'post';
        }
        return $post_type;
    }
}
