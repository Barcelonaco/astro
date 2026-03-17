<?php

namespace App\FieldGroup;

use Bandco\Core\WordplateInit;

use Extended\ACF\Location;
use Extended\ACF\Fields\Image;


class SecondaryMenu extends WordplateInit
{
    
    public function fieldGroup(): array
    {
        $menuLocation = '';
        if (has_nav_menu('header-secondary-navigation')) {
            $menuLocation = get_nav_menu_locations()['header-secondary-navigation'];
        }
        return [
            'key' => 'group_secondaryNav',
            'title' => 'Icône de menu',
            'fields' => [
                Image::make(__('Icône', THEME_TEXTDOMAIN), 'icon')
                    ->acceptedFileTypes(['svg']),
            ],
            'location' => [
                Location::where('nav_menu_item', $menuLocation),
            ],
        ];
    }
}
