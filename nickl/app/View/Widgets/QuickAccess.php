<?php

namespace App\View\Widgets;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class QuickAccess extends Composer
{
    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'widget.quick_access',
    ];

    /**
     * Données passées à la vue.
     */
    public function with()
    {
        
    }

}
