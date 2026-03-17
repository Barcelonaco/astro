<?php

namespace App\View\Components;

use Roots\Acorn\View\Component;
use App\Helpers\GlobalHelper;

class LinksSecondary extends Component
{
    public $showPhone;
    public $showSocials;

    public function __construct($showPhone, $showSocials) {
        $this->showPhone = $this->getShowPhone();
        $this->showSocials = $this->getShowSocials();
    }

    protected function getShowPhone()
    {
        GlobalHelper::getWebsiteSettings();
        if (isset(self::$options[ 'show_phone' ]) && self::$options[ 'show_phone' ]) {
            return self::$options[ 'show_phone' ];
        }

        return false;
    }

    protected function getShowSocials()
    {
        GlobalHelper::getWebsiteSettings();
        if (isset(self::$options[ 'show_socials' ]) && self::$options[ 'show_socials' ]) {
            return self::$options[ 'show_socials' ];
        }

        return false;
    }
}