<?php

namespace App\Console;

use Bandco\Core\Hookable;

class ConvertGutenbergToNickl extends Hookable
{
    public function hooks()
    {
        parent::hooks();

        if (defined('WP_CLI') && WP_CLI) {
            \WP_CLI::add_command('convert:gutenberg:nickl', [$this, 'handle'], ['shortdesc' => 'Convertit les actualités Gutenberg/Classic en modules Nickl']);
        }
    }

    public function handle()
    {
        $args = [
            'post_type' => 'actualites',
            'posts_per_page' => -1,
            'post_status' => 'any',
        ];

        $query = new \WP_Query($args);

        if (!$query->have_posts()) {
            \WP_CLI::error('Aucune actualité trouvée.');
            return;
        }

        \WP_CLI::line('Found ' . $query->found_posts . ' actualites.');

        $count = 0;

        foreach ($query->posts as $post) {
            $content = $post->post_content;

            // Ignorer si le contenu est vide
            if (empty(trim($content))) {
                \WP_CLI::log("Actualité #{$post->ID} ignorée (contenu vide).");
                continue;
            }

            // Vérifier si des modules flexibles existent déjà
            $existing_modules = get_field('flexible_modules', $post->ID);

            if (!empty($existing_modules)) {
                \WP_CLI::log("Actualité #{$post->ID} ignorée (possède déjà des modules flexibles).");
                continue;
            }

            $new_modules = [];

            // Création du module texte
            $new_modules[] = [
                'acf_fc_layout' => 'text',
                'text' => $content,
                // Valeurs par défaut pour les champs communs
                'padding_top' => '',
                'padding_bottom' => '',
                'bloc_color' => '',
            ];

            // Mise à jour du champ
            $result = update_field('flexible_modules', $new_modules, $post->ID);

            if ($result) {
                \WP_CLI::success("Actualité #{$post->ID} convertie.");
                $count++;
            } else {
                \WP_CLI::warning("Actualité #{$post->ID} échouée (ou aucune modification nécessaire).");
            }
        }

        \WP_CLI::success("Terminé ! {$count} actualités converties.");
    }
}
