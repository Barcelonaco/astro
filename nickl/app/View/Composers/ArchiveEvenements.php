<?php

namespace App\View\Composers;

use App\Helpers\EventsHelper;
use Roots\Acorn\View\Composer;

class ArchiveEvenements extends Composer
{
    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'archive-evenements',
    ];

    /**
     * Données passées à la vue.
     */
    public function with()
    {
        $slug = (new \App\Posttype\CptEvents)->getSlug();


        return [
            'imgBanner'         => $this->get_imgBanner($slug),
            'heightBanner'      => $this->get_heightBanner($slug),
            'h1InHeader'        => $this->get_h1InHeader($slug),
            'titleInHeader'     => $this->get_titleInHeader($slug),
            'archiveDesc'       => $this->get_archiveDesc($slug),
            'archiveDisplay'    => $this->get_archiveDisplay($slug),
            'eventDisplay'      => $this->get_eventDisplay($slug),
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
    protected function get_archiveDisplay($slug){
        return get_option('options_' . $slug . '_events_display');
    }
    protected function get_archiveDesc($slug){
        return get_field('archive_desc', 'options_' . $slug);
    }
    private function get_posts()
    {
        return EventsHelper::getEventsFiltered() ?? [];
    }
    private function get_eventDisplay(string $slug)
    {
        return get_option('options_' . $slug . '_events_display');
    }
}
