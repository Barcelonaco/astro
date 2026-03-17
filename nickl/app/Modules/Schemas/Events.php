<?php
namespace App\Modules\Schemas;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\GoogleMap;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\Url;
class Events
{
    public static function getLayout()
    {
        return Layout::make('Evenements', 'events')
            ->layout('block')
            ->fields([
                Text::make('Nom', 'schema_name')
                    ->wrapper(['width' => 33]),
                Text::make('Téléphone', 'schema_phone')
                    ->wrapper(['width' => 33]),
                Text::make('Horaires', 'schema_opening')
                    ->wrapper(['width' => 33]),
                Text::make('Tranche de prix', 'schema_priceRange')
                    ->wrapper(['width' => 33]),
                GoogleMap::make('Adresse', 'schema_address')
                    ->wrapper(['width' => 50]),
                Repeater::make('Réseaux sociaux', 'schema_socials')
                    ->button('Ajouter un réseau')
                    ->collapsed('title')
                    ->fields([
                        Url::make('Lien', 'link'),
                    ])
                    ->wrapper(['width' => 50]),
            ]);
    }
}
