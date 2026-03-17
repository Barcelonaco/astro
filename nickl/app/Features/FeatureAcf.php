<?php

namespace App\Features;
class FeatureAcf
{
    public function hooks()
    {
        add_action('acf/init', [$this, 'acfGoogleMapApiKey']);
    }


    public function acfGoogleMapApiKey() {
        acf_update_setting('google_api_key', 'AIzaSyAiO_fgDrWpogv7FRhjXuxd-62NyqObXYM');
    }
}