<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class SearchForm extends Composer
{
    /**
     * Définir les vues concernées par ce Composer.
     */
    protected static $views = [
        'partials.search-form',
    ];

    /**
     * Injecter les données nécessaires aux vues.
     */
    public function with()
    {
        return [
            'displaySvg' => function ($svg) {
                return $this->displaySvg($svg);
            },
        ];
    }

    public static function displaySvg($svg)
    {
        if (file_exists(dirname(get_template_directory()) . '/resources/assets/images/svg/' . $svg)) {
            return file_get_contents(dirname(get_template_directory()) . '/resources/assets/images/svg/' . $svg);
        }

        return false;
    }
}
