<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;

class ImagesSlider extends Composer
{
    protected static $views = [
        'modules.images-slider',
    ];

    public function with()
    {

        $module = $this->view->getData()['module'] ?? [];

        return [
            'id_bloc' => $this->getId($module),
            'classes' => $this->getClasses($module),
            'backgroundImage' => $this->getBackgroundImage($module),
            'title_bloc' => $module['title'] ?? '',
            'title_style' => $module['title_style'] ?? '',
            'title_align' => $module['title_align'] ?? '',
            'images' => $this->getSliders($module),
        ];
    }

    protected function getId($module)
    {
        $idBloc = $module['id_bloc'] ?? null;
        return $idBloc ? GlobalHelper::slugify($idBloc) : GlobalHelper::getAutoSectionId();
    }

    protected function getClasses($module)
    {
        $bgImage = $module['bg_img'] ?? false;
        $fullscreen = $module['is_fullscreen'] ? 'full-width' : '';
        $bgParallax = $module['bg_parallax'] ?? false;
        $blocColor = $module['bloc_color'] ?? '';
        $paddingTop = $module['padding_top'] ?? '';
        $paddingBottom = $module['padding_bottom'] ?? '';

        return implode(' ', array_filter([
            'module',
            $fullscreen,
            $bgImage && $bgParallax ? 'background-parallax' : '',
            $bgImage ? 'has-background-image' : '',
            $blocColor,
            $paddingTop,
            $paddingBottom,
        ]));
    }

    protected function getBackgroundImage($module)
    {
        $bgImage = $module['bg_img'] ?? false;
        if (!$bgImage || empty($bgImage['sizes']['banner'])) {
            return null;
        }

        return [
            'url' => $module['bg_img']['sizes']['banner'] ?? '',
            'opacity' => $module['bg_opacity'] !== '' ? $module['bg_opacity'] / 100 : 1,
        ];
    }

    protected function getSliders($module): array
    {
        $sliders = $module['sliders'] ?? [];


        $slide = array_map(function ($slide) {
            return [
                'image_url' => $slide['image']['url'] ?? '',
                'image_alt' => $slide['image']['alt'] ?? '',
                'legend' => $slide['legend'] ?? '',
                'text' => $slide['text'] ?? '',
                'has_desc' => !empty($slide['legend']) || !empty($slide['text']),
                'link_url' => $slide['link']['url'] ?? '',
                'link_title' => $slide['link']['title'] ?? '',
                'link_target' => $slide['link']['target'] ?? '_self',
                'link2' => $slide['link_2']
            ];
        }, $sliders);

        return $slide;
    }
}
