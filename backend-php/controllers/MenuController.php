<?php

class MenuController {
    public static function getAll(): void {
        json_response(MenuModel::findAll());
    }

    public static function getById(int $id): void {
        $menu = MenuModel::findById($id);
        if (!$menu) error_response('Menu not found', 404);
        $menu['flatItems'] = MenuModel::getItemsFlat($menu['id']);
        json_response($menu);
    }

    public static function create(): void {
        $body = get_json_body();
        if (empty($body['name'])) error_response('Name is required', 400);
        $id = MenuModel::create(['name' => $body['name'], 'location' => $body['location'] ?? null]);
        json_response(['id' => $id, 'message' => 'Menu created'], 201);
    }

    public static function update(int $id): void {
        $body = get_json_body();
        if (empty($body['name'])) error_response('Name is required', 400);
        MenuModel::update($id, ['name' => $body['name'], 'location' => $body['location'] ?? null]);
        json_response(['message' => 'Menu updated']);
    }

    public static function delete(int $id): void {
        MenuModel::delete($id);
        json_response(['message' => 'Menu deleted']);
    }

    public static function saveItems(int $id): void {
        $body = get_json_body();
        if (!isset($body['items']) || !is_array($body['items'])) {
            error_response('Items must be an array', 400);
        }
        MenuModel::replaceItems($id, $body['items']);
        json_response(['message' => 'Menu items saved']);
    }

    public static function getNavigationByLocation(string $location): void {
        $items = MenuModel::getNavigationByLocation($location);
        if ($items) {
            json_response($items);
            return;
        }
        // Fallback to page-based navigation
        json_response(PageModel::findNavigation());
    }

    public static function getAvailablePages(): void {
        $pages = PageModel::findAll();
        json_response(array_map(fn($p) => [
            'id' => $p['id'],
            'title' => $p['title'],
            'slug' => $p['slug'],
            'parent_id' => $p['parent_id'],
            'parent_title' => $p['parent_title'] ?? null,
        ], $pages));
    }

    public static function getAllPageMenuInfo(): void {
        json_response(MenuModel::getAllPageMenuInfo());
    }

    public static function getPageMenus(int $pageId): void {
        $allMenus = MenuModel::findAll();
        $details = MenuModel::getPageMenuDetails($pageId);

        $menusWithItems = array_map(function ($menu) use ($details) {
            $items = MenuModel::getItemsForMenuFlat($menu['id']);
            return [
                'id' => $menu['id'],
                'name' => $menu['name'],
                'location' => $menu['location'],
                'enabled' => isset($details[$menu['id']]),
                'parent_id' => $details[$menu['id']]['parent_id'] ?? null,
                'menu_order' => $details[$menu['id']]['menu_order'] ?? 0,
                'items' => $items,
            ];
        }, $allMenus);

        json_response(['menus' => $menusWithItems]);
    }

    public static function syncPageMenus(int $pageId): void {
        $body = get_json_body();
        if (!isset($body['assignments']) || !is_array($body['assignments'])) {
            error_response('assignments must be an array', 400);
        }

        $assignments = array_map(fn($a) => [
            'menuId' => (int) $a['menuId'],
            'parent_id' => !empty($a['parent_id']) ? (int) $a['parent_id'] : null,
            'menu_order' => (int) ($a['menu_order'] ?? 0),
        ], $body['assignments']);

        MenuModel::syncPageMenus($pageId, $body['title'] ?? '', $body['slug'] ?? '', $assignments);
        json_response(['message' => 'Page menus synced']);
    }
}
