<?php

namespace App\Features;

class FeatureSecondaryMenu
{
    public function hooks()
    {
        add_filter('wp_nav_menu_objects', [$this, 'secondaryMenu'], 10, 2);
    }

    public function secondaryMenu( $items, $args ) {
        if( $args->theme_location == 'header-secondary-navigation' ) {
            foreach( $items as &$item ) {
                $icon = get_field('icon', $item);
                if( $icon ) {
                    $item->title = '<img src="' . $icon['url'] . '">' . $item->title;
                }
            }
            return $items;
        }
        return $items;
    }
}