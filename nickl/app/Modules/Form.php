<?php

namespace App\Modules;

use GFAPI;
use Extended\ACF\ConditionalLogic;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Select;

use App\Modules\BlockParams;

class Form
{
    public static function getLayout($is_columns = false)
    {
        if (class_exists('GFAPI')) {

            $forms = GFAPI::get_forms();
            $listForms = [];

            if (!empty($forms)) {
                foreach ($forms as $form) {
                    $listForms[ $form[ 'id' ] ] = $form[ 'title' ];
                }
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
                Select::make('Choix du formulaire', 'form_id')
                                    ->required()
                                    ->choices($listForms)
                                    ->wrapper(['width' => 50]),
            ]);

            return Layout::make('Formulaire', 'form')
                    ->layout('block')
                    ->fields($fields);
        } else {
            return false;
        }
    }
}
