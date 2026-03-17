<?php

namespace App\Features;
class FeatureImage
{
    public function hooks()
    {
        add_filter('upload_mimes', [$this, 'allowMimeType']);
        add_filter('image_size_names_choose', [$this, 'customImageSizeLabels']);

        // name, width, height, crop
        $sizes = [
            ['banner', 1920, 1080, true],
            ['banner-mobile', 600, 1000, true],
            ['module-hero-list', 890, 945, true],
            ['module-news-slider', 850, 485, true],
            ['module-gallery-fixe', 560, 375, true],
            ['module-gallery-fluid', 1800, false, false],
            ['module-references', 702, 581, true],
            ['half', 890, 650, true],
            ['text-image-default', 1050, 956, false],
            // ['text-image-landscape', 1050, 745, true],
            // ['text-image-full-height', 1050, 1080, true],
            ['portrait', 702, 956, true],
            ['module-logo', 220, 220, false],
            ['logo', 300, 100, false],
            ['square', 150, 150, true],
            ['square-large', 956, 956, true],
        ];
        
        if( get_option('options_evenements_images_ratio') === 'a4') {
            $sizes[] = ['a4', 420, 594, true];
        }

        $this->initImageSize($sizes);
    }

    public function initImageSize($sizes)
    {
        foreach ($sizes as $size) {
            add_image_size($size[0], $size[1], $size[2], $size[3]);
        }
    }

    public function allowMimeType($mimes) {
            $mimes['svg'] = 'image/svg+xml';
            $mimes['csv'] = 'text/csv';
            return $mimes;
    }
    public function customImageSizeLabels($sizes)
    {
        if( get_option('options_evenements_images_ratio') === 'a4') {
            $sizes = array_merge($sizes, [
                'a4' => 'Evenements A4'
            ]);
        }
        return array_merge($sizes, [
            'thumbnail' => 'Vignette | Mur de logo (image)',
            'banner' => 'Bannière principale | Texte + image/vidéo (paysage) | Image / video (paysage) | Galerie (1 colonne)',
            'banner-mobile' => 'Bannière mobile',
            'module-hero-list' => 'Hero banner (Double bloc)',
            'module-news-slider' => 'Actualités slider (1/2 colonnes) | Actualités (1ere actualité)',
            'module-gallery-fixe' => 'Événements grille | Évenement | Galerie (3 colonnes) | Actualités slider (3/4 colonnes) | Actualités',
            'module-gallery-fluid' => 'Galerie (fluide)',
            'module-references' => 'Références slider',
            'half' => 'Galerie (2 colonnes)',
            'portrait' => 'Image / vidéo (portrait) | Texte + image/video (portrait) | Tuiles cliquables (portrait) | Team (portrait)',
            'square-large' => 'Image / vidéo (carré) | Texte image (carré) | Team (carré)',
            'square' => 'Citation | Page boutique',
        ]);
    }
}
