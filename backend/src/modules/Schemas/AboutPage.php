<?php
namespace App\Modules\Schemas;
use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Text;
use Extended\ACF\Fields\Textarea;

class AboutPage
{
    public static function getLayout()
    {
        global $post;

        $title = '';
        $content = '';

        if ($post) {
            $title = $post->post_title;
            $content = $post->post_content;
        }

        return Layout::make('Page à propos', 'about_page')
            ->layout('block')
            ->fields([
                Text::make('Titre page', 'page_title')
                    ->default($title),
                Textarea::make('Description page', 'page_description')
                    ->default($content)
            ]);
    }
}
