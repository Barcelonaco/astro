<?php
namespace App\Modules;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Select;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\TrueFalse;

class Summary {
    public static function getLayout($is_columns = false) {
        $menus = wp_get_nav_menus();
        $menu_choices = [];

        foreach ($menus as $menu) {
            $menu_choices[$menu->term_id] = $menu->name;
        }
        $fields = [];

        if ($is_columns === false) {
            $fields = array_merge($fields, [
                ...BlockParams::getBlocTitle(),
                BlockParams::getBgColor(),
                BlockParams::getTopPadding(),
                BlockParams::getBottomPadding(),
                BlockParams::getIsVisible(),
                BlockParams::getBackground(),
                BlockParams::getBackgroundOpacity(),
                BlockParams::getBackgroundParallax(),
            ]);
        }

        $fields = array_merge($fields, [
            TrueFalse::make('Utiliser un menu existant?', 'links_type')
                ->stylized(on : 'Oui', off : 'Non')
                ->default(true)
                ->wrapper(['width' => 50]),
            Select::make(__('Choisissez un menu', THEME_TEXTDOMAIN), 'menu_id')
                ->wrapper(['width' => 50])
                ->choices($menu_choices)
                ->conditionalLogic([
                    ConditionalLogic::where('links_type', '==', 1)
                ]),
            Repeater::make('Liens personnalisé', 'custom_menu')
                ->button('Ajouter un sous-menu')
                ->layout('block')
                ->minRows(1)
                ->collapsed('title')
                ->fields([
                    Text::make('Titre du sous-menu', 'title'),
                    Repeater::make('Liens', 'links')
                        ->button('Ajouter un lien')
                        ->layout('block')
                        ->minRows(1)
                        ->fields([
                            Link::make('Lien', 'link')
                        ])
                ])
                ->conditionalLogic([
                    ConditionalLogic::where('links_type', '!=', 1)
                ]),
        ]);
        
        return Layout::make('Sommaire', 'summary')
            ->layout('block')
            ->fields($fields);
    }
}
