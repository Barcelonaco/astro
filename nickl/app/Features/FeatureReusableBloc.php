<?php

namespace App\Features;
use App\Posttype\CptReusableBlock;

class FeatureReusableBloc
{
    public function hooks()
    {
        add_action('acf/save_post', [$this, 'createTransientForReusablebloc']);

        add_action('admin_init', [$this, 'updateTransient']);
    }

    public function createTransientForReusablebloc($post_id)
    {
        $cptSlug = new CptReusableBlock();

        if (get_post_type($post_id) == $cptSlug->getSlug()) {
            $values = get_fields($post_id);

            if (!empty($values) && isset($values[ 'flexible_modules' ]) && !empty($values[ 'flexible_modules' ])) {
                $args = [
                        'post_type' => $cptSlug->getSlug(),
                        'posts_per_page' => -1,
                ];

                $posts = new \WP_Query($args);

                if ($posts->have_posts()) {
                    foreach ($posts->posts as $post) {
                        if (!empty(get_field('flexible_modules', $post->ID))) {
                            $listPosts[ $post->ID ] = $post->post_title;
                        }
                    }
                }

                set_transient('_reusable_bloc_list', $listPosts);
            }
        }
    }

    public function updateTransient()
    {
        if (isset($_GET) && isset($_GET['post']) && isset($_GET['action']) && $_GET['action'] == 'trash') {
            $cptSlug = new CptReusableBlock();
            if ($cptSlug->getSlug() !== get_post_type($_GET['post'])) {
                return;
            }

            $args = [
                    'post__not_in' => [$_GET['post']],
                    'post_type' => $cptSlug->getSlug(),
                    'posts_per_page' => -1,
            ];

            $posts = new \WP_Query($args);
            //$listPosts = [];
            if ($posts->have_posts()) {
                foreach ($posts->posts as $post) {
                    if (!empty(get_field('flexible_modules', $post->ID))) {
                        $listPosts[ $post->ID ] = $post->post_title;
                    }
                }
            }

            set_transient('_reusable_bloc_list', $listPosts);
        }
    }
}
