<?php

namespace App\Helpers;

use WC_Order;

use App\Helpers\GlobalHelper;
use App\Posttype\CptNews;

class Dashboard
{
    public static function getLatestOrders()
    {
        $cptOrders = 'shop_order';

        $args = [
            'post_type' => $cptOrders,
            'posts_per_page' => -1,
            'post_status' => [
                'wc-pending',
                'wc-processing',
                'wc-on-hold'
            ]
        ];

        $orders = new \WP_Query($args);

        if ($orders->have_posts()) {
            return $orders->posts;
        }

        return false;
    }

    public static function getLatestPostFromMain()
    {
        $return = false;
        $original_blog_id = get_current_blog_id();
        $cptNews = new CptNews();

        switch_to_blog(get_main_site_id());

        $args = [
            'post_type' => $cptNews->getSlug(),
            'posts_per_page' => 3
        ];

        $posts = new \WP_Query($args);

        if ($posts->have_posts()) {
            foreach ($posts->posts as $item) {
                ob_start();
                $post = $item;
                include dirname(__DIR__, 2) . '/resources/views/widget/blocs/sub/preview.blog.php';
                $return .= ob_get_contents();
                ob_clean();
            }
        }

        switch_to_blog($original_blog_id);

        return $return;
    }
}
