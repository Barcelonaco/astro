<?php

namespace App\View\Composers;

use App\Helpers\ChatGPTHelper;
use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;
use WP_REST_Request;
use WP_REST_Response;

class NewsletterForm extends Composer
{
    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'modules.newsletter-form',
    ];

    /**
     * Données passées à la vue.
     */
    public function with()
    {
        // Récupération du module avec un fallback vide si non défini
        $module = $this->view->getData()['module'] ?? [];

        // Récupération des champs ACF
        $useChatGPT = get_field('use_chatgpt');
        $text = get_field('text');


        // Retourner les données avec des valeurs de secours
        return [
            'id_bloc' => $this->getId($module),
            'title_bloc' => $module['title'] ?? '',
            'title_style' => $module['title_style'] ?? '',
            'title_align' => $module['title_align'] ?? '',
            'classes' => $this->getClasses($module),
            'backgroundImage' => $this->getBackgroundImage($module),
            'text' => $module['text'] ?? '',
        ];
    }

    /**
     * Génère l'ID du bloc.
     */
    protected function getId($module)
    {
        $idBloc = $module['id_bloc'] ?? null;
        return $idBloc ? GlobalHelper::slugify($idBloc) : GlobalHelper::getAutoSectionId();
    }

    /**
     * Génère les classes CSS du module.
     */
    protected function getClasses(array $module): string
    {
        return implode(' ', array_filter([
            'module',
            !empty($module['bg_img']) && !empty($module['bg_parallax']) ? 'parallax' : '',
            !empty($module['bg_img']) ? 'has-background-image' : '',
            $module['bloc_color'] ?? '',
            $module['padding_top'] ?? '',
            $module['padding_bottom'] ?? '',
        ]));
    }

    /**
     * Récupère l'image d'arrière-plan et son opacité.
     */
    protected function getBackgroundImage(array $module): ?array
    {
        if (empty($module['bg_img'])) {
            return null;
        }

        return [
            'url' => $module['bg_img']['sizes']['banner'] ?? '',
            'opacity' => $module['bg_opacity'] !== '' ? $module['bg_opacity'] / 100 : 1,
        ];
    }
}