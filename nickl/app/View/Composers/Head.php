<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;
use App\Helpers\ThemeHelper;

class Head extends Composer
{
    /**
     * Définir les vues concernées par ce Composer.
     */
    protected static $views = [
        'partials.head',
    ];

    /**
     * Injecter les données nécessaires aux vues.
     */
    public function with()
    {
        $primary = ThemeHelper::getPrimaryColor();
        $secondary = ThemeHelper::getSecondaryColor();

        return [
            'fontGeneral' => ThemeHelper::getFontGeneral(),
            'fontTitle' => ThemeHelper::getFontTitle(),
            'primary' => $primary,
            'secondary' => $secondary,
            'tertiary' => ThemeHelper::getTertiaryColor(),
            'backgroundColor' => ThemeHelper::getBackgroundColor(),
            'textColor' => ThemeHelper::getTextColor(),
            'colorPrimaryBis' => $this->adjustBrightness($primary, -0.2),
            'colorSecondaryBis' => $this->adjustBrightness($secondary, -0.2),
            'colorFormField' => ThemeHelper::getColorFormField()
        ];
    }

    protected function adjustBrightness($hexCode, $adjustPercent)
    {
        $hexCode = ltrim($hexCode, '#');
        if (strlen($hexCode) == 3) {
            $hexCode = $hexCode[ 0 ] . $hexCode[ 0 ] . $hexCode[ 1 ] . $hexCode[ 1 ] . $hexCode[ 2 ] . $hexCode[ 2 ];
        }
        $hexCode = array_map('hexdec', str_split($hexCode, 2));
        foreach ($hexCode as & $color) {
            $adjustableLimit = $adjustPercent < 0 ? $color : 255 - $color;
            $adjustAmount = ceil($adjustableLimit * $adjustPercent);

            $color = str_pad(dechex($color + $adjustAmount), 2, '0', STR_PAD_LEFT);
        }

        return '#' . implode($hexCode);
    }
}
