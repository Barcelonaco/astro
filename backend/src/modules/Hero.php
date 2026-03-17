<?php

namespace App\Modules;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\File;
use Extended\ACF\Fields\Group;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\Textarea;
use Extended\ACF\Fields\TrueFalse;

class Hero
{
    public static function getLayout($is_columns = false)
    {
        $fields = [
            TrueFalse::make('Type de Hero Banner', 'is_hero_banner_slider')
                ->stylized(
                    on: 'Slider (photos / vidéos)',
                    off: 'Double bloc (image)'
                )
                ->default(true)
                ->wrapper(['width' => 33]),

            TrueFalse::make('Marquise', 'hero_banner_marquise')
                ->stylized(
                    on: 'Oui',
                    off: 'Non'
                )
                ->default(false)
                ->wrapper(['width' => 33]),

            TrueFalse::make('Hauteur du hero', 'hero_banner_height')
                ->stylized(
                    on: 'Réduit',
                    off: 'Plein écran'
                )
                ->default(false)
                ->wrapper(['width' => 33])
                ->conditionalLogic([
                    ConditionalLogic::where('is_hero_banner_slider', '==', 1)
                ]),

            ButtonGroup::make('Alignement du contenu', 'hero_banner_align')
                ->choices([
                    'left'   => 'Gauche',
                    'center' => 'Centre',
                    'right'  => 'Droite',
                ])
                ->default('left')
                ->layout('horizontal')
                ->wrapper(['width' => 50]),

            ButtonGroup::make('Balise H1', 'h1_in_header')
                ->choices([
                    'yes' => 'Oui',
                    'no'  => 'Non',
                ])
                ->default('yes')
                ->layout('horizontal')
                ->wrapper(['width' => 50]),

            // — Mode Slider —
            Repeater::make('Slides', 'hero_sliders')
                ->conditionalLogic([
                    ConditionalLogic::where('is_hero_banner_slider', '==', 1)
                ])
                ->minRows(1)
                ->layout('block')
                ->button('Ajouter un slide')
                ->collapsed('title')
                ->fields([
                    Image::make('Illustration', 'logo')
                        ->previewSize('thumbnail')
                        ->wrapper(['width' => 50]),
                    ButtonGroup::make('Taille de l\'illustration', 'logo_size')
                        ->choices([
                            'size-s'  => 'Petit',
                            'size-m'  => 'Moyen',
                            'size-l'  => 'Grand',
                            'size-xl' => 'Très grand',
                        ])
                        ->default('size-m')
                        ->wrapper(['width' => 50]),
                    Text::make('Surtitre', 'title'),
                    Textarea::make('Titre / phrase d\'accroche', 'catchphrase'),
                    TrueFalse::make('Image ou vidéo ?', 'is_image')
                        ->default(true)
                        ->stylized(on: 'Image', off: 'Vidéo')
                        ->wrapper(['width' => 20]),
                    Image::make('Image', 'image')
                        ->acceptedFileTypes(['jpg', 'jpeg', 'gif', 'bmp', 'svg', 'png', 'webp'])
                        ->previewSize('thumbnail')
                        ->required()
                        ->wrapper(['width' => 40])
                        ->conditionalLogic([
                            ConditionalLogic::where('is_image', '==', 1)
                        ]),
                    Image::make('Image (mobile)', 'image_mobile')
                        ->helperText('Taille recommandée : 600 x 1000px')
                        ->acceptedFileTypes(['jpg', 'jpeg', 'gif', 'bmp', 'svg', 'png', 'webp'])
                        ->previewSize('thumbnail')
                        ->wrapper(['width' => 40])
                        ->conditionalLogic([
                            ConditionalLogic::where('is_image', '==', 1)
                        ]),
                    File::make('Vidéo', 'video')
                        ->helperText('Vidéo courte en boucle, format MP4.')
                        ->acceptedFileTypes(['mp4'])
                        ->required()
                        ->wrapper(['width' => 40])
                        ->conditionalLogic([
                            ConditionalLogic::where('is_image', '==', 0)
                        ]),
                    Image::make('Image de remplacement', 'video_replacement_image')
                        ->helperText('Affichée à la place de la vidéo sur mobile/tablette.')
                        ->required()
                        ->wrapper(['width' => 40])
                        ->conditionalLogic([
                            ConditionalLogic::where('is_image', '==', 0)
                        ]),
                    Link::make('Lien 1', 'cta')
                        ->wrapper(['width' => 50]),
                    Link::make('Lien 2', 'cta_2')
                        ->wrapper(['width' => 50]),
                ]),

            // — Mode Double bloc —
            Group::make('Bloc de gauche', 'left_bloc')
                ->wrapper(['width' => 50])
                ->conditionalLogic([
                    ConditionalLogic::where('is_hero_banner_slider', '==', 0)
                ])
                ->fields([
                    Text::make('Titre', 'title'),
                    Textarea::make('Phrase d\'accroche', 'catchphrase')
                        ->rows(2),
                    Image::make('Image', 'image')
                        ->acceptedFileTypes(['jpg', 'jpeg', 'gif', 'bmp', 'svg', 'png', 'webp'])
                        ->required(),
                    Link::make('Lien 1', 'cta')
                        ->wrapper(['width' => 50]),
                    Link::make('Lien 2', 'cta_2')
                        ->wrapper(['width' => 50]),
                ]),

            Group::make('Bloc de droite', 'right_bloc')
                ->wrapper(['width' => 50])
                ->conditionalLogic([
                    ConditionalLogic::where('is_hero_banner_slider', '==', 0)
                ])
                ->fields([
                    Text::make('Titre', 'title'),
                    Textarea::make('Phrase d\'accroche', 'catchphrase')
                        ->rows(2),
                    Image::make('Image', 'image')
                        ->acceptedFileTypes(['jpg', 'jpeg', 'gif', 'bmp', 'svg', 'png', 'webp'])
                        ->required(),
                    Link::make('Lien 1', 'cta')
                        ->wrapper(['width' => 50]),
                    Link::make('Lien 2', 'cta_2')
                        ->wrapper(['width' => 50]),
                ]),
        ];

        return Layout::make('Hero Banner', 'hero')
            ->layout('block')
            ->fields($fields);
    }
}
