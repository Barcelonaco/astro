<?php

namespace App\View\Composers;

use App\Helpers\ReferencesHelper;
use App\Helpers\ThemeHelper;
use Roots\Acorn\View\Composer;

class ArchiveReferences extends Composer
{
    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'archive-references',
    ];

    /**
     * Données passées à la vue.
     */
    public function with()
    {
        $slug = (new \App\Posttype\CptReferences)->getSlug();
        return [
            'imgBanner'         => $this->get_imgBanner($slug),
            'heightBanner'      => $this->get_heightBanner($slug),
            'h1InHeader'        => $this->get_h1InHeader($slug),
            'titleInHeader'     => $this->get_titleInHeader($slug),
            'title'             => $this->get_title(),
            'archiveDesc'       => $this->get_archiveDesc($slug),
            'archiveDisplay'    => $this->get_archiveDisplay($slug),
            'data'              => $this->get_posts($slug),
            'terms'              => $this->get_terms()
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
    private function get_posts($slug)
    {

        $randomise = $this->get_randomise($slug);
        if ($randomise === 'random') {
            return ReferencesHelper::getRefs(6, null, null, 0, true);
        } else {
            return ReferencesHelper::getRefs(6);
        }
    }
    private function get_randomise($slug)
    {
        return get_field('randomise_refs','options_' . $slug);
    }
    private function get_terms()
    {
        return ReferencesHelper::getTerms();
    }

    private function get_title()
    {
        return ThemeHelper::title();
    }
}
