<?php

class PostController {
    private static function formatPost(array $post, bool $withSlugs = false): array {
        $categories = [];
        if (!empty($post['category_ids'])) {
            $ids = explode(',', $post['category_ids']);
            $names = explode(',', $post['category_names'] ?? '');
            $slugs = $withSlugs && !empty($post['category_slugs']) ? explode(',', $post['category_slugs']) : [];
            foreach ($ids as $i => $id) {
                $cat = ['id' => (int) $id, 'name' => $names[$i] ?? ''];
                if ($withSlugs && isset($slugs[$i])) $cat['slug'] = $slugs[$i];
                $categories[] = $cat;
            }
        }

        $result = [
            'id' => $post['id'],
            'title' => $post['title'],
            'slug' => $post['slug'],
            'excerpt' => $post['excerpt'],
            'content' => enrichMediaInContent($post['content'] ?? ''),
            'featured_image' => $post['featured_image'],
            'author' => [
                'id' => $post['author_id'],
                'name' => $post['author_name'] ?? null,
            ],
            'categories' => $categories,
            'tags' => !empty($post['tags']) ? explode(',', $post['tags']) : [],
            'published_date' => $post['published_date'],
            'status' => $post['status'],
            'created_at' => $post['created_at'],
            'updated_at' => $post['updated_at'],
        ];

        if ($withSlugs && isset($post['author_email'])) {
            $result['author']['email'] = $post['author_email'];
        }

        return $result;
    }

    public static function getAll(): void {
        $filters = [];
        if (!empty($_GET['status'])) $filters['status'] = $_GET['status'];
        if (!empty($_GET['category'])) $filters['category'] = $_GET['category'];

        $posts = PostModel::findAll($filters);
        json_response(array_map(fn($p) => self::formatPost($p), $posts));
    }

    public static function getBySlug(string $slug): void {
        $post = PostModel::findBySlug($slug);
        if (!$post) error_response('Post not found', 404);
        json_response(self::formatPost($post, true));
    }

    public static function create(array $authUser): void {
        $body = get_json_body();
        $body['author_id'] = $authUser['id'];

        $postId = PostModel::create($body);

        if (!empty($body['categories'])) {
            PostModel::setCategories($postId, $body['categories']);
        }
        if (!empty($body['tags'])) {
            PostModel::setTags($postId, $body['tags']);
        }

        $post = PostModel::findBySlug($body['slug']);
        trigger_frontend_rebuild('post created: ' . $body['slug']);
        json_response($post, 201);
    }

    public static function update(int $id, array $authUser): void {
        $body = get_json_body();
        PostModel::update($id, $body);

        if (isset($body['categories'])) {
            PostModel::setCategories($id, $body['categories']);
        }
        if (isset($body['tags'])) {
            PostModel::setTags($id, $body['tags']);
        }

        $post = PostModel::findBySlug($body['slug']);
        trigger_frontend_rebuild('post updated: ' . $body['slug']);
        json_response($post);
    }

    public static function delete(int $id): void {
        PostModel::delete($id);
        trigger_frontend_rebuild('post deleted: ' . $id);
        json_response(['message' => 'Post deleted successfully']);
    }
}
