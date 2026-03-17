<?php

namespace App\View\Composers;

use App\Helpers\NewsHelper;
use Roots\Acorn\View\Composer;
use App\Posttype\CptNews;
use App\Helpers\GlobalHelper;

class ArchiveActualites extends Composer
{
    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'archive-actualites',
    ];

    /**
     * Données passées à la vue.
     */
    public function with()
    {
        $module = $this->view->getData()['data'] ?? [];
        $slug = (new \App\Posttype\CptNews)->getSlug();


        return [
            'imgBanner'         => $this->get_imgBanner($slug),
            'heightBanner'      => $this->get_heightBanner($slug),
            'h1InHeader'        => $this->get_h1InHeader($slug),
            'titleInHeader'     => $this->get_titleInHeader($slug),
            'archiveDesc'       => $this->get_archiveDesc($slug),
            'archiveDisplay'    => $this->get_archiveDisplay($slug),
            'posts'             => $this->get_posts()
        ];
    }

    protected function get_imgBanner($slug){
        return get_field('header_img', 'options_' . $slug);

    }
    protected function get_heightBanner($slug){
        return get_field('img_height', 'options_' . $slug);
    }
    protected function get_h1InHeader($slug){
        return get_field('h1_in_header', 'options_' . $slug);
    }
    protected function get_titleInHeader($slug){
        return get_field('title_in_header', 'options_' . $slug);
    }
    protected function get_archiveDesc($slug){
        return get_field('archive_desc', 'options_' . $slug);
    }
    protected function get_archiveDisplay($slug){

        return get_field('archive_display', 'options_' . $slug);
    }

    private function get_posts()
    {
        return NewsHelper::getNews(null, 0, 7) ?? [];
    }
}
