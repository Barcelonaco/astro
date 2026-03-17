<?php

namespace App\Modules;

use App\Modules\BlockParams;

use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Relationship;

class Product
{
    public static function getLayout($is_columns = false)
    {
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
               Relationship::make('Choix des produits', 'products_id')
                        ->format('id')
                        ->postTypes(['product'])
                        ->maxPosts(4)
                        ->minPosts(1),
                Link::make('Lien', 'cta'),
        ]);
        return Layout::make('Produits à la une', 'featured_products')
                ->layout('block')
                ->fields($fields);
    }
}
