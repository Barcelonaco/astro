<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class LinksSecondary extends Composer
{
    protected static $views = [
        'components.header.links-secondary',
    ];
    public function with()
    {

        return [
            'showPhone' => $this->getShowPhone(),
            'showSocials' => $this->getShowSocials(),
        ];
    }
    public static function getShowPhone()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (isset($options[ 'show_phone' ]) && $options[ 'show_phone' ]) {
            return $options[ 'show_phone' ];
        }

        return false;
    }

    protected function getShowSocials()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (isset($options[ 'show_socials' ]) && $options[ 'show_socials' ]) {
            return $options[ 'show_socials' ];
        }

        return false;
    }
}
