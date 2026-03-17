<?php

namespace App\FieldGroup;

use App\Modules\BlockParams;

use App\Modules\Schemas\Actualites as SchemasActualites;
use App\Modules\Schemas\ContactPage;
use App\Modules\Schemas\Events as SchemasEvents;
use App\Modules\Schemas\Faq;
use App\Modules\Schemas\LocalBusiness;
use App\Modules\Schemas\Organisation;
use App\Modules\Schemas\AboutPage;
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
        $creditIa = false;
        if (get_field('is_activate_ia', 'options')) {
            $creditManager = \App\Helpers\IaCreditManager::getInstance();
            $stats = $creditManager->getGlobalStats();
            $creditIa = ($stats['remaining_credit'] > 0);
        }

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


                    Tab::make('Génération par IA')
                        ->placement('top'),

                    Message::make('Instructions', 'instructions')
                        ->body($this->getIAInstructions()),
                    ...($creditIa ? [
                        Textarea::make('Prompt utilisateur', 'content_html')
                            ->rows(20)
                            ->wrapper(['width' => 100, 'class' => 'ia-prompt-input']),
                        Message::make('Génération', 'ai_generation_button')
                            ->body('<button type="button" class="button button-primary" id="generateaicontent">Générer le contenu</button>'),
                    ] : []),
                    Tab::make('Génération 2 par IA')
                        ->placement('top'),
                    Message::make('Instructions V2', 'instructions_v2')
                        ->body('Collez ici directement le JSON généré pour construire les modules sans passer par l\'IA.'),
                    Textarea::make('Contenu JSON', 'content_html_simple')
                        ->rows(20)
                        ->wrapper(['width' => 100]),
                    Message::make('Génération V2', 'ai_generation_button_simple')
                        ->body('<button type="button" class="button button-primary" id="generateaicontent_simple">Générer les modules</button>'),
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
            AboutPage::getLayout(),
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
    public function getIAInstructions(): string
    {
        $creditManager = \App\Helpers\IaCreditManager::getInstance();
        $stats = $creditManager->getGlobalStats();
        $remaining = $stats['remaining_credit'];

        if ($remaining <= 0) {
            return '
                <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                    <div style="background-color: #fae9e9ff; border-left: 4px solid #e67272ff; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                        <h3 style="margin-top: 0; color: #1d2327;">Attention !</h3>
                        <p style="margin-bottom: 0;">Vous n\'avez plus de crédit. Il se réinitialisera le 1er du mois prochain. Si vous souhaitez plus de crédit, contactez le support informatique.</p>
                    </div>
                </div>
            ';
        } else {
            return '
        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <div style="background-color: #f0f6fc; border-left: 4px solid #72aee6; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                <h3 style="margin-top: 0; color: #1d2327;">👋 Bonjour ! Je suis votre assistant IA.</h3>
                <p style="margin-bottom: 5px;">Je peux vous aider à générer du contenu pour votre page. Cliquez sur la commande que vous voulez, puis complétez le prompt ci-dessous pour me dire ce que vous voulez, enfin, cliquez sur <strong>"Générer le contenu"</strong>.</p>

            </div>
            <div style="background-color: #fae9e9ff; border-left: 4px solid #e67272ff; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                <h3 style="margin-top: 0; color: #1d2327;">Attention !</h3>
                <p style="margin-bottom: 0;">Il est important de ne pas sortir du cadre des commandes. <br><br>À chaque génération, les modules seront ajoutés à la page les uns à la suite des autres. Si vous générez une page de zéro et que cela ne vous convient pas, il est important de supprimer d\'abord les modules existants.</p>
            </div>

            <h4 style="margin-bottom: 15px; text-transform: uppercase; color: #646970; font-size: 0.9em;">Commandes disponibles :</h4>

            <!-- BUILD -->
            <div class="ia-command-trigger" data-command="#BUILD&#10;url banner : https://example.com/banner.jpg&#10;Je veux une page sur les bienfaits du sport..." style="background: #fff; border: 1px solid #c3c4c7; padding: 15px; border-radius: 5px; margin-bottom: 15px; box-shadow: 0 1px 1px rgba(0,0,0,0.04); cursor: pointer; transition: all 0.2s ease;">
                <strong style="display:inline-block; background: #2271b1; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 0.9em;">#BUILD</strong> (Défaut)
                <p style="margin-top: 5px;">Construire une page complète à partir de vos instructions.</p>
                <div style="background: #f6f7f7; padding: 10px; border-radius: 3px; border: 1px solid #dcdcde;">
                    <code>#BUILD</code><br>
                    <code style="color: #666;">(optionnel) url banner : https://example.com/banner.jpg</code><br>
                    <code style="color: #666;">Je veux une page sur les bienfaits du sport...</code>
                </div>
            </div>

            <!-- GEN -->
            <div class="ia-command-trigger" data-command="#GEN type:module-text&#10;Fais moi un texte sur la nutrition." style="background: #fff; border: 1px solid #c3c4c7; padding: 15px; border-radius: 5px; margin-bottom: 15px; box-shadow: 0 1px 1px rgba(0,0,0,0.04); cursor: pointer; transition: all 0.2s ease;">
                <strong style="display:inline-block; background: #2271b1; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 0.9em;">#GEN</strong>
                <p style="margin-top: 5px;">Générer un seul module spécifique.</p>
                <div style="background: #f6f7f7; padding: 10px; border-radius: 3px; border: 1px solid #dcdcde;">
                    <code>#GEN type:module-text</code><br>
                    <code style="color: #666;">Fais moi un texte sur la nutrition.</code>
                </div>
            </div>
        </div>
        ';
        }

        /*
        <!-- CLONE -->
            <div style="background: #fff; border: 1px solid #c3c4c7; padding: 15px; border-radius: 5px; margin-bottom: 15px; box-shadow: 0 1px 1px rgba(0,0,0,0.04);">
                <strong style="display:inline-block; background: #2271b1; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 0.9em;">#CLONE</strong>
                <p style="margin-top: 5px;">Cloner une page existante fidèlement (structure et texte).</p>
                <div style="background: #f6f7f7; padding: 10px; border-radius: 3px; border: 1px solid #dcdcde;">
                    <code>#CLONE https://site-source.fr</code><br>
                    <code style="color: #666;">url banner : https://site-source.fr/image.jpg</code><br>
                    <code style="color: #666;">Domaine cible : mon-nouveau-site.fr</code>
                </div>
            </div>

            <!-- CONVERT -->
            <div style="background: #fff; border: 1px solid #c3c4c7; padding: 15px; border-radius: 5px; margin-bottom: 15px; box-shadow: 0 1px 1px rgba(0,0,0,0.04);">
                <strong style="display:inline-block; background: #2271b1; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 0.9em;">#CONVERT</strong>
                <p style="margin-top: 5px;">Convertir un bout de code HTML en modules Nickl.</p>
                <div style="background: #f6f7f7; padding: 10px; border-radius: 3px; border: 1px solid #dcdcde;">
                    <code>#CONVERT</code><br>
                    <code style="color: #666;">url banner : https://site.fr/image.jpg</code><br>
                    <code style="color: #666;">[Coller le Code HTML ici]</code>
                </div>
            </div>
        */

    }
}
