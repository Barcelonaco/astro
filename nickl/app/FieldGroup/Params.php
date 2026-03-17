<?php

namespace App\FieldGroup;

use App\Helpers\ThemeHelper;
use App\Modules\BlockParams;
use App\View\Composers\InstaFeed;
use Bandco\Core\WordplateInit;
use Extended\ACF\Fields\Layout;
use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\ColorPicker;
use Extended\ACF\Fields\Email;
use Extended\ACF\Fields\GoogleMap;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Message;
use Extended\ACF\Fields\Number;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Password;
use Extended\ACF\Fields\RadioButton;
use Extended\ACF\Fields\Range;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Select;
use Extended\ACF\Fields\Tab;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\Textarea;
use Extended\ACF\Fields\TrueFalse;
use Extended\ACF\Fields\URL;
use Extended\ACF\Fields\WYSIWYGEditor;
use Extended\ACF\Location;

class Params extends WordplateInit
{
    public function fieldGroup(): array
    {
        return [
            'key' => 'group_params',
            'title' => 'Paramètres du site',
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
                'categories',
                'tags',
                'send-trackbacks',
            ],
            'fields' => $this->getParams(),
            'location' => [
                Location::where('options_page', '==', 'params'),
            ],
        ];
    }

    public function getParams(): array
    {
        $finalLayout = $this->globalParams();
        $user = wp_get_current_user();

        // Initialise la variable avec les paramètres globaux
        $newFinalLayout = $finalLayout;

        if (current_user_can('administrator') && !in_array('adminsite', (array) $user->roles)) {
            $newFinalLayout = array_merge($newFinalLayout, $this->adminParams());

            if (class_exists('woocommerce')) {
                $newFinalLayout = array_merge($newFinalLayout, $this->adminParamsCommercial());
            }
        }
        if (defined('NICKL_PDV') && NICKL_PDV === 'PDV') {
            if (is_plugin_active('bcnco-footer/bcnco-footer.php')) {
                $newFinalLayout = array_merge($newFinalLayout, $this->pdvParams());
            }
        }
        return $newFinalLayout;
    }

    public function getBlocks()
    {
        $transient = get_transient('_reusable_bloc_list');
        $listPosts = [];
        $listPosts[''] = 'Sélectionnez un bloc réutilisable';

        if ($transient) {
            foreach ($transient as $pid => $title) {
                $listPosts[$pid] = (string) $title;
            }
        } else {
            $listPosts[''] = 'Vous devez d\'abord créer un bloc en vous rendant sur cette page';
        }

        return $listPosts;
    }

    public function globalParams()
    {
        return [
            Tab::make('Identité')
                ->placement('top'),
            Text::make('Titre du site', 'title_site')
                ->wrapper(['width' => 50]),
            Text::make('Slogan du site', 'baseline_site')
                ->wrapper(['width' => 50]),
            Image::make('Logo', 'logo')
                ->wrapper(['width' => 33])
                ->helperText('Privilégiez un logo au format SVG.'),
            Image::make('Logo blanc', 'logo_white')
                ->wrapper(['width' => 33])
                ->helperText('Privilégiez un logo au format SVG.'),
            Image::make('Logo du loader', 'logo_loader')
                ->wrapper(['width' => 33])
                ->helperText('Privilégiez un logo au format SVG.'),
            Image::make('Favicon', 'favicon')
                ->wrapper(['width' => 33]),
            Image::make('Image de remplacement', 'replacement_image')
                ->helperText('Cette image sera utilisée partout où il y a besoin d\'une image et qu\'aucune image n\'a été renseignée dans le Back-office.')
                ->wrapper(['width' => 67]),
            ColorPicker::make('Couleur Primaire', 'primary_color')
                ->required()
                ->default(ThemeHelper::getPrimaryColor())
                ->wrapper(['width' => 33]),
            ColorPicker::make('Couleur Secondaire', 'secondary_color')
                ->required()
                ->default(ThemeHelper::getSecondaryColor())
                ->wrapper(['width' => 33]),
            ColorPicker::make('Couleur Tertiaire', 'tertiary_color')
                ->default(ThemeHelper::getTertiaryColor())
                ->wrapper(['width' => 34]),
            ColorPicker::make('Couleur des textes', 'text_color')
                ->default('#130234')
                ->wrapper(['width' => 33]),
            ColorPicker::make('Couleur de fond du site', 'background_color')
                ->default('#ffffff')
                ->wrapper(['width' => 33]),
            ColorPicker::make('Couleur de fond des champs de formulaire', 'bg_form_field')
                ->default('#e0e0e0')
                ->wrapper(['width' => 34]),
            Message::make('Choix des polices de votre site'),
            Select::make('Choix de la police des titres', 'font_title')
                ->format('array')
                ->choices([
                    'anek-odia' => 'Anek Odia',
                    'crimson-pro' => 'Crimson Pro',
                    'dm-serif' => 'DM Serif Display',
                    'encode' => 'Encode Sans Expanded',
                    'inter' => 'Inter',
                    'jakarta' => 'Plus Jakarta Sans',
                    'jost' => 'Jost',
                    'kanit' => 'Kanit',
                    'lilita-one' => 'Lilita One',
                    'lora' => 'Lora',
                    'montserrat' => 'Montserrat',
                    'onest' => 'Onest',
                    'open-sans' => 'Open Sans',
                    'oswald' => 'Oswald',
                    'playfair-display' => 'Playfair Display',
                    'poppins' => 'Poppins',
                    'prompt' => 'Prompt',
                    'raleway' => 'Raleway',
                    'rubik' => 'Rubik',
                    'ubuntu' => 'Ubunutu',
                    'zilla-slab' => 'Zilla Slab',
                ])
                ->default('jakarta')
                ->wrapper(['width' => 50]),
            Select::make('Choix de la police du texte', 'font_general')
                ->format('array')
                ->choices([
                    'barlow' => 'Barlow',
                    'bitter' => 'Bitter',
                    'cormorant-garamond' => 'Cormorant Garamond',
                    'encode' => 'Encode Sans Expanded',
                    'exo' => 'Exo',
                    'inter' => 'Inter',
                    'jakarta' => 'Plus Jakarta Sans',
                    'jost' => 'Jost',
                    'kanit' => 'Kanit',
                    'lora' => 'Lora',
                    'montserrat' => 'Montserrat',
                    'onest' => 'Onest',
                    'open-sans' => 'Open sans',
                    'roboto' => 'Roboto',
                    'rubik' => 'Rubik',
                ])
                ->default('jakarta')
                ->wrapper(['width' => 50]),
            TrueFalse::make('Fond du menu transparent', 'menu_seamless')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(true)
                ->wrapper(['width' => 25]),
            TrueFalse::make('Bords arrondis', 'rounded')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(true)
                ->wrapper(['width' => 25]),
            TrueFalse::make('Éléments en majuscules (menu, titres et boutons)', 'uppercase')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(false)
                ->wrapper(['width' => 25]),
            TrueFalse::make('Logo de chargement (Page d\'accueil)', 'home_loader')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(true)
                ->wrapper(['width' => 25]),
            ButtonGroup::make('Style du menu', 'menu_style')
                ->choices([
                    'default' => 'Logo à gauche',
                    'center' => 'Logo au centre',
                    'burger' => 'Menu burger',
                ])
                ->default('default')
                ->wrapper(['width' => 33]),
            TrueFalse::make('Menu secondaire discret', 'secret_menu')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(false)
                ->wrapper(['width' => 25])
                ->conditionalLogic([
                    ConditionalLogic::where('menu_style', '==', 'center')
                ]),
            TrueFalse::make('Modifier taille du logo', 'logo_custom_height')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(false)
                ->wrapper(['width' => 25]),
            Range::make('Hauteur du logo (px)', 'logo_height')
                ->wrapper(['width' => 25])
                ->default(100)
                ->min(100)
                ->max(400)
                ->conditionalLogic([
                    ConditionalLogic::where('logo_custom_height', '==', 1)
                ]),
            TrueFalse::make('Accessibilité', 'accessibility')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(true)
                ->wrapper(['width' => 25]),
            TrueFalse::make('Fils d\'ariane', 'show_breadcrumb')
                ->stylized(on: 'Afficher', off: 'Ne pas afficher')
                ->default(true)
                ->wrapper(['width' => 25]),
            TrueFalse::make('Boutons de partage sur les pages', 'pages_share_btn')
                ->stylized(on: 'Afficher', off: 'Ne pas afficher')
                ->default(false)
                ->wrapper(['width' => 33]),
            TrueFalse::make('Position des boutons de partage', 'share_btn_position')
                ->stylized(on: 'Après le contenu', off: 'Avant le contenu')
                ->default(false)
                ->wrapper(['width' => 33])
                ->conditionalLogic([
                    ConditionalLogic::where('pages_share_btn', '==', '1')
                ]),

            Tab::make('Menu secondaire')
                ->placement('left'),
            Link::make('Lien 1', 'top_link_1')
                ->wrapper(['width' => 50])
                ->conditionalLogic([
                    ConditionalLogic::where('alt_secondary_menu', '==', '1')
                ]),
            Image::make('Icône lien 1', 'icon_link_1')
                ->acceptedFileTypes(['svg', 'png'])
                ->wrapper(['width' => 50])
                ->conditionalLogic([
                    ConditionalLogic::where('alt_secondary_menu', '==', '1')
                ]),
            Link::make('Lien 2', 'top_link_2')
                ->wrapper(['width' => 50])
                ->conditionalLogic([
                    ConditionalLogic::where('alt_secondary_menu', '==', '1')
                ]),
            Image::make('Icône lien 2', 'icon_link_2')
                ->acceptedFileTypes(['svg', 'png'])
                ->wrapper(['width' => 50])
                ->conditionalLogic([
                    ConditionalLogic::where('alt_secondary_menu', '==', '1')
                ]),
            TrueFalse::make('Affichage du téléphone', 'show_phone')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(false)
                ->wrapper(['width' => 33])
                ->conditionalLogic([
                    ConditionalLogic::where('alt_secondary_menu', '==', '1')
                ]),
            TrueFalse::make('Affichage de la recherche', 'show_search')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(true)
                ->wrapper(['width' => 33])
                ->conditionalLogic([
                    ConditionalLogic::where('alt_secondary_menu', '==', '1')
                ]),
            TrueFalse::make('Affichage des réseaux sociaux', 'show_socials')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(false)
                ->wrapper(['width' => 33])
                ->conditionalLogic([
                    ConditionalLogic::where('alt_secondary_menu', '==', '1')
                ]),

            Tab::make('Footer')
                ->placement('left'),
            ButtonGroup::make('Choix de la couleur de fond du footer', 'footer_color')
                ->layout('vertical')
                ->choices([
                    'no-background-color' => 'Aucune',
                    'has-background-primary' => '<div style="display: inline-block !important;height:15px; width:100%;background-color:' . get_field(
                        'primary_color',
                        'options'
                    ) . '"></div>',
                    'has-background-secondary' => '<div style="display: inline-block !important;height:15px; width:100%;background-color:' . get_field(
                        'secondary_color',
                        'options'
                    ) . '"></div>',
                    'has-background-dark' => '<div style="display: inline-block !important;height:15px; width:100%;background-color:' . get_field(
                        'text_color',
                        'options'
                    ) . '"></div>',
                ])
                ->default('no-background-color'),
            BlockParams::getBackground(),
            BlockParams::getBackgroundOpacity(),
            BlockParams::getBackgroundParallax(),
            Message::make('Information')
                ->body('Les liens sont en dessous de l\'adresse'),
            Link::make('Lien 1', 'link_1')
                ->wrapper(['width' => 50]),
            Link::make('Lien 2', 'link_2')
                ->wrapper(['width' => 50]),
            Textarea::make('Texte libre', 'footer_text')
                ->rows(3)
                ->wrapper(['width' => 50]),
            Textarea::make('Horaires', 'schedule')
                ->placeholder('Lundi / vendredi 8h30 / 18h30
                                                        Samedi 8h30 / 12h30')
                ->rows(2)
                ->wrapper(['width' => 50]),
            Textarea::make('Horaires courtes', 'opening')
                ->placeholder('Mo-Fr 09:00-18:00')
                ->wrapper(['width' => 50]),
            TrueFalse::make('Inscription Newsletter', 'newsletter_form')
                ->stylized(on: 'Activer', off: 'Désactiver')
                ->default(false),
            Text::make('Titre newsletter', 'newsletter_form_title')
                ->wrapper(['width' => 50])
                ->conditionalLogic([
                    ConditionalLogic::where('newsletter_form', '==', 1)
                ]),
            Text::make('Description newsletter', 'newsletter_form_desc')
                ->wrapper(['width' => 50])
                ->conditionalLogic([
                    ConditionalLogic::where('newsletter_form', '==', 1)
                ]),
            Select::make('Bloc réutilisable', 'footer_custom_bloc')
                ->wrapper(['width' => 50])
                ->choices($this->getBlocks()),
            ButtonGroup::make('Emplacement du bloc', 'footer_custom_bloc_location')
                ->choices([
                    'none' => 'Ne pas afficher',
                    'before' => 'Avant le Footer',
                    'after' => 'Après le Footer',
                ])
                ->wrapper(['width' => 50]),

            Tab::make('Coordonnées')
                ->placement('left'),
            Text::make('N° de téléphone adresse principale', 'phone')
                ->placeholder('ex : 0123456789')
                ->wrapper(['width' => 50]),
            Text::make(' de téléphone adresse secondaire ', 'phone-2')
                ->placeholder('ex : 0123456789')
                ->wrapper(['width' => 50]),
            GoogleMap::make('Adresse principale', 'address')
                ->wrapper(['width' => 50]),
            GoogleMap::make('Adresse secondaire', 'address-2')
                ->wrapper(['width' => 50]),
            Email::make('Votre adresse mail', 'email')
                ->placeholder('ex : john.doe@monsite.fr')
                ->wrapper(['width' => 50]),

            Tab::make('Réseaux sociaux')
                ->placement('left'),
            Message::make('Afficher vos réseaux sociaux dans le menu et le footer')
                ->body('Si vous ne souhaitez pas afficher un réseau social, laissez le champ vide'),
            URL::make('Instagram', 'instagram')
                ->wrapper(['width' => 33]),
            URL::make('Facebook', 'facebook')
                ->wrapper(['width' => 33]),
            Url::make('Threads', 'threads')
                ->wrapper(['width' => 33]),
            URL::make('TikTok', 'tiktok')
                ->wrapper(['width' => 33]),
            URL::make('LinkedIn', 'linkedin')
                ->wrapper(['width' => 33]),
            URL::make('X (Twitter)', 'twitter')
                ->wrapper(['width' => 33]),
            URL::make('Tripadvisor', 'tripadvisor')
                ->wrapper(['width' => 33]),
            URL::make('Pinterest', 'pinterest')
                ->wrapper(['width' => 33]),
            URL::make('YouTube', 'youtube')
                ->wrapper(['width' => 33]),
            Message::make('Configuration du module Feed Instagram')
                ->body('Le compte Instagram doit être public et être un business account</br><a href="' . get_template_directory_uri() . '/resources/docs/DocInsta.pdf" target="_blank" download>📄 Télécharger la documentation PDF</a>'),
            Text::make("Id application", 'id_application_instagram')
                ->wrapper(['width' => 50]),
            Text::make("Clé secrète application", 'secret_key_application_instagram')
                ->wrapper(['width' => 50]),
            URL::make('Lien du compte Instagram', 'link_account_instagram')
                ->wrapper(['width' => 33]),
            Text::make("Jeton d'accès temporaire", 'access_token_instagram')
                ->wrapper(['width' => 67]),
            Message::make("Date expiration jeton d'accès", 'access_token_date')
                ->body(InstaFeed::getExpirationDate()),

            Tab::make('Popup')
                ->placement('left'),
            TrueFalse::make('Affichage de l\'alerte', 'show_alert')
                ->stylized(on: 'Activé', off: 'Désactivé'),
            RadioButton::make('Couleur de fond du bloc', 'bloc_color_alert')
                ->wrapper(['width' => '50.01'])
                ->choices([
                    'no-background-color' => 'Aucune',
                    'has-background-primary' => '<div style="height:15px; width:10%;background-color:' . ThemeHelper::getPrimaryColor() . '"></div>',
                    'has-background-secondary' => '<div style="height:15px; width:10%;background-color:' . ThemeHelper::getSecondaryColor() . '"></div>',
                    'has-background-tertiary' => '<div style="height:15px; width:10%;background-color:' . ThemeHelper::getTertiaryColor() . '"></div>',
                ]),
            TrueFalse::make(
                'Mettre des marges réduites autour du bloc ?',
                'is_small_marged_alert'
            )
                ->default(false)
                ->wrapper(['width' => '49.99'])
                ->stylized(on: 'Oui', off: 'Non'),
            Image::make('Image de fond', 'bg_img_alert')
                ->wrapper(['width' => 33]),
            Range::make('Opacité', 'bg_opacity_alert')
                ->conditionalLogic([
                    ConditionalLogic::where('bg_img_alert', '!=', 'empty')
                ])
                ->wrapper(['width' => 33])
                ->default(10)
                ->min(0)
                ->max(100),
            WYSIWYGEditor::make('Texte', 'alert_text')
                ->disableMediaUpload(),
            Link::make('Premier lien', 'alert_cta')
                ->wrapper(['width' => 50]),
            Link::make('Deuxième lien', 'alert_cta2')
                ->wrapper(['width' => 50]),

            Tab::make('Bouton Flottant')
                ->placement('left'),
            TrueFalse::make('Affichage du bouton', 'show_btn')
                ->stylized(on: 'Activé', off: 'Désactivé'),
            Link::make('Lien', 'floating-btn-link')
                ->wrapper(['width' => 50]),
            Image::make('Icône', 'floating-btn-img')
                ->acceptedFileTypes(['svg', 'png'])
                ->wrapper(['width' => 50]),

            Tab::make('Mode maintenance')
                ->placement('left'),
            TrueFalse::make('Mode maintenance', 'is_maintenance')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(false),
            Text::make('Texte', 'text_maintenance')
                ->conditionalLogic([
                    ConditionalLogic::where('is_maintenance', '==', '1')
                ]),
            TrueFalse::make('Affichage des coordonnées et les horaires', 'show_infos')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(false)
                ->conditionalLogic([
                    ConditionalLogic::where('is_maintenance', '==', '1')
                ]),
            TrueFalse::make('Affichage des réseaux sociaux', 'show_rs')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(false)
                ->conditionalLogic([
                    ConditionalLogic::where('is_maintenance', '==', '1')
                ]),

            Tab::make('Tracking & Analytics')
                ->placement('left'),
            Message::make('Google Analytics, Google Ads et GTM')
                ->body('Renseignez ici les codes de suivi pour Google Analytics, Google Ads et Google Tag Manager.'),
            Text::make('Code Google Analytics (GA4)', 'ga_code')
                ->wrapper(['width' => 33]),
            Text::make('Code Google Ads', 'aw_code')
                ->wrapper(['width' => 33]),
            Text::make('Code GTM', 'gtm_code')
                ->wrapper(['width' => 33]),
            Message::make('Meta Pixel')
                ->body('Renseignez ici le code de suivi pour Meta Pixel.'),
            Text::make('Code Meta Pixel', 'meta_pixel_code')
                ->wrapper(['width' => 33]),
        ];
    }

    public function adminParams()
    {
        return [
            Tab::make('Technique')
                ->placement('left'),
            TrueFalse::make('Site en OnePage', 'is_onepage')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(false)
                ->wrapper(['width' => 33]),

            TrueFalse::make('Schemas.org', 'is_activate_schemas')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(false)
                ->wrapper(['width' => 33]),
            Textarea::make('Balise head personnalisée', 'custom_balise')
                ->rows(3),
            Text::make('Google API Key', 'google_api_key')
                ->wrapper(['width' => 33]),
        ];
    }

    public function adminParamsCommercial()
    {
        return [
            Tab::make('Site marchand')
                ->placement('left'),
            TrueFalse::make('Ventes depuis le site', 'is_commercial')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(false)
                ->wrapper(['width' => 50]),
            TrueFalse::make('Affichage de la sidebar sur la page boutique', 'shop_sidebar')
                ->stylized(on: 'Activé', off: 'Désactivé')
                ->default(false)
                ->wrapper(['width' => 50]),
        ];
    }
    public function pdvParams()
    {
        $footer_pdv = [
            Tab::make('Sur-footer')
                ->placement('top')
                ->endpoint(),
            ButtonGroup::make('Choix de la couleur de fond du footer', 'pdv_footer_color')
                ->layout('vertical')
                ->choices([
                    'no-background-color' => 'Aucune',
                    'has-background-primary' => '<div style="display: inline-block !important;height:15px; width:100%;background-color:' . get_field('primary_color', 'options') . '"></div>',
                    'has-background-secondary' => '<div style="display: inline-block !important;height:15px; width:100%;background-color:' . get_field('secondary_color', 'options') . '"></div>',
                    'has-background-dark' => '<div style="display: inline-block !important;height:15px; width:100%;background-color:' . get_field('text_color', 'options') . '"></div>',
                ])
                ->default('no-background-color')
                ->wrapper(['width' => 25]),
            Image::make('Image de fond', 'pdv_footer_bg_img')
                ->wrapper(['width' => 25]),
            Range::make('Opacité', 'pdv_footer_bg_opacity')
                ->wrapper(['width' => 25])
                ->default(10)
                ->min(0)
                ->max(100),
            TrueFalse::make('Mettre un effet de parallax ?', 'pdv_footer_bg_parallax')
                ->default(false)
                ->wrapper(['width' => 25])
                ->stylized(on: 'Oui', off: 'Non'),
            Repeater::make('Colonnes du surfooter', 'footer_pdv_columns')
                ->maxRows(4)
                ->layout('block')
                ->button('Ajouter une colonne')
                ->fields([
                    Select::make('Colonne 1', 'footer_pdv_column')
                        ->wrapper(['width' => 50])
                        ->choices([
                            'onclick-services' => 'Services en 1 clic',
                            'info-alert' => 'Inscription aux alertes',
                            'reusable-bloc' => 'Bloc réutilisable',
                        ]),
                    Select::make('Bloc réutilisable 1', 'footer_pdv_custom_bloc')
                        ->wrapper(['width' => 50])
                        ->choices($this->getBlocks())
                        ->conditionalLogic([
                            ConditionalLogic::where('footer_pdv_column', '==', 'reusable-bloc')
                        ])
                ]),

            Tab::make('Vos contacts')
                ->placement('top'),
            Text::make('Titre colonne 1', 'title_contacts_column_1')
                ->wrapper(['width' => 50]),
            Text::make('Titre colonne 2', 'title_contacts_column_2')
                ->wrapper(['width' => 50]),
            Repeater::make('Contacts colonne 1', 'contacts_column_1')
                ->fields([
                    Text::make('Service', 'service')->wrapper(['width' => 50]),
                    Text::make('Téléphone', 'phone_number')->wrapper(['width' => 50]),
                ])
                ->button('Ajouter un contact')
                ->layout('block')
                ->wrapper(['width' => 50]),
            Repeater::make('Contacts colonne 2', 'contacts_column_2')
                ->fields([
                    Text::make('Service', 'service')->wrapper(['width' => 50]),
                    Text::make('Téléphone', 'phone_number')->wrapper(['width' => 50]),
                ])
                ->button('Ajouter un contact')
                ->layout('block')
                ->wrapper(['width' => 50]),
        ];

        if (is_plugin_active('bcnco-info-alertes/bcnco-info-alertes.php')) {
            $footer_pdv[] = Tab::make('SmsMode')->placement('top');
            $footer_pdv[] = TrueFalse::make('Activer', 'sms_mode')
                ->default(true)
                ->wrapper(['width' => 33])
                ->stylized(on: 'Oui', off: 'Non');
        }

        return $footer_pdv;
    }

}
