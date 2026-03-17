<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class App extends Composer
{
    /**
     * List of views served by this composer.
     *
     * @var array
     */
    protected static $views = [
        'layouts.app',
    ];

    /**
     * Data to be passed to view before rendering.
     *
     * @return array
     */
    public function with()
    {

        return [
            'siteName' => $this->siteName(),
            'rounded' => $this->getRounded(),
            'uppercase' => $this->getUppercase(),
            'title' => $this->title()
        ];
    }

    /**
     * Returns the site name.
     *
     * @return string
     */
    public function siteName()
    {
        return get_bloginfo('name', 'display');
    }

    protected function getRounded()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (isset($options[ 'rounded' ]) && $options[ 'rounded' ]) {
            return $options[ 'rounded' ];
        }

        return false;
    }

    protected function getUppercase()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (isset($options[ 'uppercase' ]) && $options[ 'uppercase' ]) {
            return $options[ 'uppercase' ];
        }

        return false;
    }

    protected function getBackgroundColor()
    {
        $options = GlobalHelper::getWebsiteSettings();
        if (get_field('override_colors') && get_field('background_color')) {
            return get_field('background_color');
        }
        if (isset($options[ 'background_color' ]) && $options[ 'background_color' ]) {
            return $options[ 'background_color' ];
        }

        return '#ffffff';
    }

    public function title($id = null)
    {
        if ($id) {
            return get_the_title($id);
        }
        if (is_home()) {
            if ($home = get_option('page_for_posts', true)) {
                return get_the_title($home);
            }
            return bcn_pll('Les derniers articles');
        }
        if (is_archive()) {
            $title = get_field('title', 'options_' . get_post_type());
            if (empty($title)) {
                $postType = get_post_type_object(get_post_type());
                return $postType->label ??  '';
            }
            return $title;
        }
        if (is_search()) {
            return '';
        }
        if (is_404()) {
            return bcn_pll('Page non trouvée');
        }
        return get_the_title();
    }
}
