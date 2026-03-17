<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class Loader extends Composer
{
    /**
     * Définir les vues concernées par ce Composer.
     */
    protected static $views = [
        'partials.loader',
    ];

    /**
     * Injecter les données nécessaires aux vues.
     */
    public function with()
    {

        return [
            'logoLoader' => $this->getLogoLoader(),
            'logo' => $this->getLogo()
        ];
    }

    protected function getLogoLoader()
    {
        $options = GlobalHelper::getWebsiteSettings();

        if (isset($options[ 'logo_loader' ]) && $options[ 'logo_loader' ]) {

            if ($options[ 'logo_loader' ][ 'mime_type' ] == 'image/svg+xml') {
                return $options[ 'logo_loader' ][ 'url' ];
            } else {
                return $options[ 'logo_loader' ][ 'sizes' ][ 'logo' ];
            }
        }

        return false;
    }

    protected function getLogo()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (isset($options[ 'logo' ]) && $options[ 'logo' ]) {

            if ($options[ 'logo' ][ 'mime_type' ] == 'image/svg+xml') {
                return $options[ 'logo' ][ 'url' ];
            } else {
                return $options[ 'logo' ][ 'sizes' ][ 'logo' ];
            }
        }

        return false;
    }
}
