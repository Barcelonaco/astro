<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class Footer extends Composer
{
    /**
     * Définir les vues concernées par ce Composer.
     */
    protected static $views = [
        'partials.footer',
    ];

    /**
     * Injecter les données nécessaires aux vues.
     */
    public function with()
    {
        return [
            'footColor' => $this->getFooterColor(),
            'logo' => $this->getLogo(),
            'logoWhite' => $this->getLogoWhite()
        ];
    }

    public static function getFooterColor()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (!is_search()) {
            if (isset($options[ 'footer_color' ]) && $options[ 'footer_color' ]) {
                return $options[ 'footer_color' ];
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

    protected function getLogoWhite()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (isset($options[ 'logo_white' ]) && $options[ 'logo_white' ]) {

            if ($options[ 'logo_white' ][ 'mime_type' ] == 'image/svg+xml') {
                return $options[ 'logo_white' ][ 'url' ];
            } else {
                return $options[ 'logo_white' ][ 'sizes' ][ 'logo' ];
            }
        }

        return false;
    }
}
