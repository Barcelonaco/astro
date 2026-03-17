<?php
namespace App\Modules;

use Extended\ACF\Fields\ButtonGroup;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\WYSIWYGEditor;
class NewsletterForm
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
            ButtonGroup::make('Alignement du contenu', 'content_align')
                ->choices([
                    'left' => 'A gauche',
                    'center' =>  'Au centre',
                    'right' => 'A droite'
                ])
                ->default('left'),
            WYSIWYGEditor::make('Description', 'desc')
                ->disableMediaUpload(),
        ]);
        
        return Layout::make('Newsletter (inscription)', 'newsletter-form')
            ->layout('block')
            ->fields($fields);
    }
}
