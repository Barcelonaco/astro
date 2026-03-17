<?php
namespace App\View\Composers;

use App\Helpers\GlobalHelper;
use Roots\Acorn\View\Composer;
use App\Helpers\NewsHelper;
use App\Taxonomy\TaxoNewsCategory;
use App\Posttype\CptNews;

class NewsSlider extends Composer
{
    protected static $views = [
        'modules.news-slider',
    ];

    public function with()
    {
        $module = $this->view->getData()['module'] ?? [];
        return [
            'id_bloc' => $this->getId($module),
            'classes' => $this->getClasses($module),
            'posts' => NewsHelper::getNews() ?? [],
            'size' => $this->getSize($module),
            'taxoSlug' => new TaxoNewsCategory(),
            'cptSlug' => new CptNews(),
            'title_bloc' => $module['title'] ?? '',
            'title_style' => $module['title_style'] ?? '',
            'title_align' => $module['title_align'] ?? '',
            'display_posts' => $module['display_posts'] ?? '',
            'backgroundImage' => $this->getBackgroundImage($module),
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
        $bgParallax = $module['bg_parallax'] ?? false;
        $blocColor = $module['bloc_color'] ?? '';
        $paddingTop = $module['padding_top'] ?? '';
        $paddingBottom = $module['padding_bottom'] ?? '';

        return implode(' ', array_filter([
            'module',
            $bgImage && $bgParallax ? 'background-parallax' : '',
            $bgImage ? 'has-background-image' : '',
            $blocColor,
            $paddingTop,
            $paddingBottom,
        ]));
    }
    protected function getSize($module)
    {
        return $module['display_posts'] == 1 ? 'half' : 'module-news-slider';
    }
    protected function getBackgroundImage($module)
    {
        $bgImage = $module['bg_img'] ?? null;
        if (!$bgImage) {
            return null;
        }

        return [
            'url' => $module['bg_img']['sizes']['banner'] ?? '',
            'opacity' => $module['bg_opacity'] !== '' ? $module['bg_opacity'] / 100 : 1,
        ];
    }
}
