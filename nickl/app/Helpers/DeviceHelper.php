<?php

namespace App\Helpers;

use Detection\MobileDetect;
use App\Helpers\GlobalHelper;

class DeviceHelper
{
    private static $detect;

    protected static $options;

    public static function isMobile()
    {
        if (empty(self::$detect)) {
            self::$detect = new MobileDetect();
        }

        return self::$detect->isMobile();
    }

    public static function isTablet()
    {
        if (empty(self::$detect)) {
            self::$detect = new MobileDetect();
        }

        return self::$detect->isTablet();
    }

    public static function addDeviceClass()
    {
        if (empty(self::$detect)) {
            self::$detect = new MobileDetect();
        }

        $device = 'desktop';

        if (self::$detect->isTablet()) {
            $device = 'tablet';
        } elseif (self::$detect->isMobile()) {
            $device = 'mobile';
        }

        return ' bcnco-device-' . $device . ' ';
    }
    public static function adjustBrightness($hexCode, $adjustPercent)
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
    public static function getShowPhone()
    {
        GlobalHelper::getWebsiteSettings();
        if (isset(self::$options[ 'show_phone' ]) && self::$options[ 'show_phone' ]) {
            return self::$options[ 'show_phone' ];
        }

        return false;
    }

    public static function getShowSearch()
    {
        GlobalHelper::getWebsiteSettings();
        if (isset(self::$options[ 'show_search' ]) && self::$options[ 'show_search' ]) {
            return self::$options[ 'show_search' ];
        }

        return false;
    }
}
