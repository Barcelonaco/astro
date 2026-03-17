<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;

class FrontPage extends Composer
{
    /**
     * Définissez les vues concernées par ce Composer.
     * Par exemple : 'front-page' correspond à front-page.blade.php.
     */
    protected static $views = [
        'front-page',
    ];

    /**
     * Injectez les données dans les vues.
     */
    public function with()
    {
        return [
            'isSlider' => $this->isSlider(),
            'sliders' => $this->getSliders(),
            'heroBgColor' => $this->getHeroBgColor(),
            'blocks' => $this->getBlocks(),
            'headerType' => $this->getHeaderType(),
            'modules' => $this->getModules(),
        ];
    }

    // Logique métier

    /**
     * Logique pour déterminer si un slider doit être affiché.
     */
    protected function isSlider()
    {
        return get_field('is_hero_banner_slider');
    }

    /**
     * Récupérer les sliders.
     */
    protected function getSliders()
    {
        return get_field('hero_sliders', get_the_ID());
    }

    /**
     * Récupérer la couleur de fond du hero banner.
     */
    protected function getHeroBgColor()
    {
        return get_field('bloc_color');
    }

    /**
     * Récupérer les blocs (fusionne les blocs gauche et droit).
     */
    protected function getBlocks()
    {
        return array_merge(
            [get_field('left_bloc')],
            [get_field('right_bloc')]
        );
    }
    protected function getHeaderType()
    {
        $headerType = get_field('header_type');
        return is_string($headerType) ? $headerType : 'default'; // Retourne 'default' si ce n'est pas une chaîne
    }
    protected function getModules()
    {
        $modules = get_field('flexible_modules');
        return is_array($modules) ? $modules : []; // Retourne un tableau vide si ce n'est pas un tableau
    }
}
