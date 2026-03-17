<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class Header extends Composer
{
    /**
     * Définir les vues concernées par ce Composer.
     */
    protected static $views = [
        'partials.header',
    ];

    // Cache interne pour éviter plusieurs appels DB
    protected static $options = null;

    public function with()
    {
        // Charger une seule fois les options
        if (self::$options === null) {
            self::$options = GlobalHelper::getWebsiteSettings();
        }

        return [
            'seamlessMenu' => $this->getSeamlessMenu(),
            'logo' => $this->getLogo(),
            'logoWhite' => $this->getLogoWhite(),
            'showPhone' => get_field('show_phone', 'option'),
            'showSocials' => get_field('show_socials', 'option'),
        ];
    }

    protected function getSeamlessMenu()
    {
        return GlobalHelper::getSeamlessMenu();
    }

    protected function getLogo()
    {
        if (!empty(self::$options['logo'])) {
            return (self::$options['logo']['mime_type'] == 'image/svg+xml')
                ? self::$options['logo']['url']
                : self::$options['logo']['sizes']['logo'];
        }

        return false;
    }

    protected function getLogoWhite()
    {
        if (!empty(self::$options['logo_white'])) {
            return (self::$options['logo_white']['mime_type'] == 'image/svg+xml')
                ? self::$options['logo_white']['url']
                : self::$options['logo_white']['sizes']['logo'];
        }

        return false;
    }
}
