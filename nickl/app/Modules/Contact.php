<?php

namespace App\Modules;

use App\Modules\BlockParams;

use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\GoogleMap;
use Extended\ACF\Fields\Group;
use Extended\ACF\Fields\Image;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Link;
use Extended\ACF\Fields\Message;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\Textarea;
use Extended\ACF\Fields\TrueFalse;
use Extended\ACF\Fields\URL;

class Contact
{
    public static function getLayout()
    {
        return Layout::make('Contact', 'contact')
                ->layout('block')
                ->fields([
                        ...BlockParams::getBlocTitle(),
                        BlockParams::getBgColor(),
                        BlockParams::getTopPadding(),
                        BlockParams::getBottomPadding(),
                        BlockParams::getIsVisible(),
                        BlockParams::getBackground(),
                        BlockParams::getBackgroundOpacity(),
                        BlockParams::getBackgroundParallax(),
                        TrueFalse::make('Afficher une carte ou une photo ?', 'is_map')
                                ->stylized(on : 'Carte', off : 'Photo')
                                ->wrapper(['width' => 50]),
                        Image::make('Photo', 'photo')
                                ->wrapper(['width' => 50])
                                ->required()
                                ->conditionalLogic([
                                        ConditionalLogic::where('is_map', '==', 0)
                                ]),
                        Repeater::make('Adresses', 'addresses')
                                ->minRows(1)
                                ->button('Ajouter une adresse')
                                ->layout('block')
                                ->collapsed('name')
                                ->fields([
                                        Image::make('Logo', 'logo')
                                                ->wrapper(['width' => 33]),
                                        Text::make('Nom', 'name')
                                                ->wrapper(['width' => 33]),
                                        Text::make('Téléphone', 'phone')
                                                ->placeholder('0123456789')
                                                ->wrapper(['width' => 33]),
                                        Text::make('Adresse email', 'mail')
                                                ->placeholder('contact@monsite.fr')
                                                ->wrapper(['width' => 50]),
                                        Textarea::make('Horaires', 'schedule')
                                                ->placeholder('Lundi / vendredi 8h30 / 18h30
                        Samedi 8h30 / 12h30')
                                                ->rows(2)
                                                ->wrapper(['width' => 50]),
                                        GoogleMap::make('Adresse', 'address')
                                                ->required(),
                                        URL::make('Instagram', 'instagram')
                                                ->wrapper(['width' => 33]),
                                        URL::make('Facebook', 'facebook')
                                                ->wrapper(['width' => 33]),
                                        URL::make('Threads', 'threads')
                                                ->wrapper(['width' => 33]),
                                        URL::make('TikTok', 'tiktok')
                                                ->wrapper(['width' => 33]),
                                        URL::make('LinkedIn', 'linkedin')
                                                ->wrapper(['width' => 33]),
                                        URL::make('X (Twitter)', 'twitter')
                                                ->wrapper(['width' => 33]),
                                        URL::make('Tripdvisor', 'tripadvisor')
                                                ->wrapper(['width' => 33]),
                                        URL::make('Pinterest', 'pinterest')
                                                ->wrapper(['width' => 33]),
                                        URL::make('YouTube', 'youtube')
                                                ->wrapper(['width' => 33]),
                                ])
                ]);
        }
}
