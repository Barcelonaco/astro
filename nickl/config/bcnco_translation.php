<?php
// Traduction des Breadcrumbs avec Polylang
if (!function_exists('bcn_pll')) {
    function bcn_pll($str)
    {
        return function_exists('pll__') ? pll__($str) : $str;
    }
}
