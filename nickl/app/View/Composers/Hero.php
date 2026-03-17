<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class Hero extends Composer
{
    /**
     * Définir les vues concernées par ce Composer.
     */
    protected static $views = [
        'modules.hero',
    ];

    /**
     * Injecter les données nécessaires aux vues.
     */
    public function with()
    {
        return [
            'isSlider' => $this->isSlider(),
            'sliders' => $this->getSliders(),
            'heroAlign' => $this->getHeroAlign(),
            'h1InHeader' => $this->getH1InHeader(),
            'heroBgColor' => $this->getHeroBgColor(),
            'blocks' => $this->getBlocks(),
            'seamlessMenu' => $this->getSeamlessMenu(),
        ];
    }

    // Logique métier = Controller
    protected function isSlider()
    {
        return get_field('is_hero_banner_slider');
    }

    protected function getSliders()
    {
        
  
        $sliders = get_field('hero_sliders', get_the_ID());
        return is_array($sliders) ? $sliders : [];
        
    }
    

    protected function getHeroAlign()
    {
        return get_field('hero_banner_align');
    }

    protected function getH1InHeader()
    {
        return get_field('h1_in_header');
    }

    protected function getHeroBgColor()
    {
        return get_field('bloc_color');
    }

    protected function getBlocks()
    {
        
        return array_merge(
            [get_field('left_bloc')],
            [get_field('right_bloc')]
        );
    }

    protected function getSeamlessMenu()
    {
        return GlobalHelper::getSeamlessMenu();
    }
}
