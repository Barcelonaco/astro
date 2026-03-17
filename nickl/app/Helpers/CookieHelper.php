<?php

namespace App\Helpers;

class CookieHelper
{
    public static function isCookieAccepted($cookieName)
    {
        // cas d'une première visite où le cookie n'est pas créé
        if (!isset($_COOKIE[ 'cc_cookie' ])) {
            return false;
        }

        $cookieList = json_decode(stripslashes($_COOKIE[ 'cc_cookie' ]), true)['categories'];
        if (is_array($cookieList) && in_array('ads', $cookieList)) {
            return true;
        }
        return false;
    }
}