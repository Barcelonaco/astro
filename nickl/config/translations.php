<?php

add_action('after_setup_theme', function () {
    //dd(dirname(dirname(dirname(__DIR__))) . '/plugins/advanced-access-manager/lang/');
    load_plugin_textdomain('advanced-access-manager', false, dirname(dirname(dirname(__DIR__))) . '/plugins/advanced-access-manager/lang/');
    load_plugin_textdomain('plugins', false, dirname(dirname(dirname(__DIR__))) . '/languages/plugins/');
    load_plugin_textdomain('gravityforms', false, dirname(dirname(dirname(__DIR__))) . '/languages/gravityforms/');
    load_plugin_textdomain('advanced-custom-fields-pro', false, dirname(dirname(dirname(__DIR__))) . '/mu-plugins/advanced-custom-fields-pro/lang/');
    load_plugin_textdomain('duplicate-post', false, dirname(dirname(dirname(__DIR__))) . '/plugins/duplicate-post/languages/');
});
