<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class Error404 extends Composer
{
    /**
     * Définir les vues concernées par ce Composer.
     */
    protected static $views = [
        '404',
    ];

    /**
     * Injecter les données nécessaires aux vues.
     */
    public function with()
    {
        $id = $this->getId();

        return [
            'imgBanner' => GlobalHelper::getImageOrReplacement('', $id)
        ];
    }

    protected function getId()
    {
        return get_the_ID() ?: null;
    }


}
