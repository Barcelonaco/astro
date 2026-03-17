<?php

namespace App\Modules;

use App\Helpers\ThemeHelper;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\RadioButton;
use Extended\ACF\Fields\Range;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\TrueFalse;

class BlockParams
{
    public static function getBlocTitle()
    {
        return [
            Text::make('Titre du bloc', 'title')
                ->wrapper(['width' => 75]),
            Text::make('ID du bloc', 'id_bloc')
                ->wrapper(['width' => 25]),
            ButtonGroup::make('Alignement du titre', 'title_align')
                ->choices([
                'left' => 'Gauche',
                'center' => 'Centre',
                'right' => 'Droit'
                ])
                ->default('center')
                ->layout('horizontal')
                ->wrapper(['width' => 50])
                ->conditionalLogic([
                    ConditionalLogic::where('title', '!=', null)
                ]),
            ButtonGroup::make('Balise du titre', 'title_style')
                ->choices([
                '2' => 'h2',
                '3' => 'h3',
                '4' => 'h4',
                ])
                ->default('4')
                ->wrapper(['width' => 50])
                ->conditionalLogic([
                    ConditionalLogic::where('title', '!=', null)
                ]),
        ];
    }

    public static function getBgColor($active = null, $width = 25, $layout = 'vertical')
    {
        $buttonGroup = ButtonGroup::make('Couleur de fond du bloc', 'bloc_color')
            ->wrapper(['width' => $width])
            ->layout($layout)
            ->choices([
                'no-background-color' => 'Aucune',
                'has-background-primary' => '<div style="height:15px; width:100%;background-color:' . ThemeHelper::getPrimaryColor() . '"></div>',
                'has-background-secondary' => '<div style="height:15px; width:100%;background-color:' . ThemeHelper::getSecondaryColor() . '"></div>',
                'has-background-tertiary' => '<div style="height:15px; width:100%;background-color:' . ThemeHelper::getTertiaryColor() . '"></div>',
            ]);

        if ($active === null) {
            return $buttonGroup;
        }

        if ($active !== 1) {
            return $buttonGroup->conditionalLogic([
                ConditionalLogic::where('header_type', '==', 'hero')->and('is_hero_banner_slider', '==', 0),
            ]);
        }

        return $buttonGroup;
    }

    public static function getTopPadding($width = '25', $default='false')
    {
        $buttonGroup = ButtonGroup::make('Espace en haut du bloc', 'padding_top')
            ->default(false)
            ->layout('vertical')
            ->wrapper(['width' => $width])
            ->default($default)
            ->choices([
                false => 'Normal',
                'padding-top-small' => 'Petit',
                'no-padding-top' => 'Aucun'
            ]);

        return $buttonGroup;
    }

    public static function getBottomPadding($width = '25', $default='false')
    {
        $buttonGroup = ButtonGroup::make('Espace en bas du bloc', 'padding_bottom')
            ->default(false)
            ->layout('vertical')
            ->wrapper(['width' => $width])
            ->default($default)
            ->choices([
                false => 'Normal',
                'padding-bottom-small' => 'Petit',
                'no-padding-bottom' => 'Aucun'
            ]);

        return $buttonGroup;
    }

    public static function getIsVisible($active = null, $width = '25')
    {
        $buttonGroup = ButtonGroup::make('Afficher le bloc', 'is_visible')
            ->layout('vertical')
            ->wrapper(['width' => $width])
            ->default('yes')
            ->choices([
                'yes' => 'Oui',
                'no' => 'Non'
            ]);

        return $buttonGroup;
    }

    public static function getBlocId()
    {
        $textField = Text::make('ID du bloc', 'id_bloc')
            ->wrapper(['width' => 20]);

        return $textField;
    }

    public static function getBackground()
    {
        $imageField = Image::make('Image de fond', 'bg_img')
            ->previewSize('thumbnail')
            ->wrapper(['width' => 33]);

        return $imageField;
    }

    public static function getBackgroundOpacity()
    {
        $imageOpacity =  Range::make('Opacité', 'bg_opacity')
            ->wrapper(['width' => 33])
            ->default(10)
            ->min(0)
            ->max(100)
            ->conditionalLogic([
                ConditionalLogic::where('bg_img', '!=empty')
            ]);

        return $imageOpacity;
    }

    public static function getBackgroundParallax()
    {
        $imageParallax = TrueFalse::make('Mettre un effet de parallax ?', 'bg_parallax')
        ->default(false)
        ->wrapper(['width' => 33])
        ->stylized(on: 'Oui', off: 'Non')
        ->conditionalLogic([
            ConditionalLogic::where('bg_img', '!=empty')
        ]);

        return $imageParallax;
    }

    public static function getFullScreen($width = '50')
    {
        return TrueFalse::make('Mettre en pleine largeur ?', 'is_fullscreen')
            ->default(false)
            ->wrapper(['width' => $width])
            ->stylized(on: 'Oui', off: 'Non');
    }

    public static function getMargin($width = '49.99')
    {
        return TrueFalse::make('Mettre une marge réduite autour du bloc ?', 'is_small_marged')
            ->default(false)
            ->wrapper(['width' => $width])
            ->stylized(on: 'Oui', off: 'Non');
    }

    public static function getBannerHeight($width = '49.99')
    {
        return ButtonGroup::make("Hauteur de l'image du header", 'img_height')
            ->wrapper(['width' => $width])
            ->layout('vertical')
            ->choices([
                'small' => 'Petite',
                'medium' => 'Moyenne',
                'large' => 'Grande',
            ]);
    }
}