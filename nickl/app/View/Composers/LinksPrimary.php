<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class LinksPrimary extends Composer
{
    protected static $views = [
        'components.header.links-primary',
    ];
    public function with()
    {

        return [
            'showSearch' => $this->getSearch(),
        ];
    }
    public static function getSearch()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (isset($options[ 'show_search' ]) && $options[ 'show_search' ]) {
            return $options[ 'show_search' ];
        }

        return false;
    }
}
