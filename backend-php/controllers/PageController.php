<?php

class PageController {
    private static function formatPage(array $page, bool $withDetails = false): array {
        $result = [
            'id' => $page['id'],
            'title' => $page['title'],
            'slug' => $page['slug'],
            'content' => enrichMediaInContent($page['content'] ?? ''),
            'color_overrides' => $page['color_overrides'] ?? null,
            'seo_meta' => $page['seo_meta'] ?? null,
            'status' => $page['status'],
            'published_date' => $page['published_date'] ?? null,
            'show_in_menu' => $page['show_in_menu'],
            'menu_order' => $page['menu_order'],
            'parent_id' => $page['parent_id'],
            'parent_title' => $page['parent_title'] ?? null,
            'created_at' => $page['created_at'],
            'updated_at' => $page['updated_at'],
            'author' => ['name' => $page['author_name'] ?? null],
        ];

        if ($withDetails) {
            $result['parent_slug'] = $page['parent_slug'] ?? null;
            $result['author']['email'] = $page['author_email'] ?? null;
        }

        return $result;
    }

    public static function getAll(): void {
        $pages = PageModel::findAll();
        json_response(array_map(fn($p) => self::formatPage($p), $pages));
    }

    public static function getBySlug(string $slug): void {
        $page = PageModel::findBySlug($slug);
        if (!$page) error_response('Page not found', 404);
        json_response(self::formatPage($page, true));
    }

    public static function create(array $authUser): void {
        $body = get_json_body();
        if (empty($body['title']) || empty($body['slug'])) {
            error_response('Title and slug are required', 400);
        }

        $content = isset($body['content']) ? (string) $body['content'] : '';

        $status = $body['status'] ?? 'draft';
        $publishedDate = $body['published_date'] ?? null;
        // Auto-set published_date to now when publishing without explicit date
        if (in_array($status, ['published', 'private']) && !$publishedDate) {
            $publishedDate = date('Y-m-d H:i:s');
        }

        $pageId = PageModel::create([
            'title' => $body['title'],
            'slug' => $body['slug'],
            'content' => $content,
            'color_overrides' => $body['color_overrides'] ?? null,
            'seo_meta' => $body['seo_meta'] ?? null,
            'author_id' => $authUser['id'],
            'status' => $status,
            'published_date' => $publishedDate,
            'show_in_menu' => $body['show_in_menu'] ?? true,
            'menu_order' => $body['menu_order'] ?? 0,
            'parent_id' => $body['parent_id'] ?? null,
        ]);

        trigger_frontend_rebuild('page created: ' . $body['slug']);
        json_response(['id' => $pageId, 'message' => 'Page created successfully'], 201);
    }

    public static function update(int $id, array $authUser): void {
        $body = get_json_body();
        if (empty($body['title']) || empty($body['slug'])) {
            error_response('Title and slug are required', 400);
        }

        $content = isset($body['content']) ? (string) $body['content'] : '';

        $status = $body['status'] ?? 'draft';
        $publishedDate = $body['published_date'] ?? null;
        // Auto-set published_date to now when publishing without explicit date
        if (in_array($status, ['published', 'private']) && !$publishedDate) {
            $publishedDate = date('Y-m-d H:i:s');
        }

        PageModel::update($id, [
            'title' => $body['title'],
            'slug' => $body['slug'],
            'content' => $content,
            'color_overrides' => $body['color_overrides'] ?? null,
            'seo_meta' => $body['seo_meta'] ?? null,
            'status' => $status,
            'published_date' => $publishedDate,
            'show_in_menu' => $body['show_in_menu'] ?? true,
            'menu_order' => $body['menu_order'] ?? 0,
            'parent_id' => $body['parent_id'] ?? null,
        ]);

        trigger_frontend_rebuild('page updated: ' . $body['slug']);
        json_response(['message' => 'Page updated successfully']);
    }

    public static function delete(int $id): void {
        $db = Database::getInstance();
        // Remove menu items referencing this page
        $db->prepare('DELETE FROM menu_items WHERE page_id = ? AND type = ?')->execute([$id, 'page']);
        PageModel::delete($id);
        trigger_frontend_rebuild('page deleted: ' . $id);
        json_response(['message' => 'Page deleted successfully']);
    }

    public static function getNavigation(): void {
        json_response(PageModel::findNavigation());
    }
}
