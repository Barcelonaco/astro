<?php

namespace App\Modules;

use App\Modules\BlockParams;

use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Repeater;
use Extended\ACF\Fields\Text;

class TextScrolling
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
                        ButtonGroup::make('Taille du texte', 'text_size')
                                ->choices([
                                        'size-s' => 'S',
                                        'size-m' => 'M',
                                        'size-l' => 'L',
                                        'size-xl' => 'XL'
                                ])
                                ->required()
                                ->default('size-m'),
                        ButtonGroup::make('Sens de défilement', 'text_direction')
                                ->choices([
                                        'left' => 'Gauche',
                                        'right' => 'Droite',
                                ])
                                ->required()
                                ->default('left')
                                ->wrapper(['width' => 50]),
                        Text::make('Vitesse de défillement (en seconde)', 'text_speed')
                                ->required()
                                ->default('5')
                                ->wrapper(['width' => 50]),
                        Repeater::make('Phrases à faire défiler', 'texts')
                                ->minRows(1)
                                ->fields([
                                        Text::make('Phrases', 'text')
                                        ->required()
                                ])
                                ->button('Ajouter une phrase'),
                ]);
                return Layout::make('Texte défilement', 'text-scrolling')
                        ->layout('block')
                        ->fields($fields);
        }
}
