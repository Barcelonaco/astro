<?php

class MenuModel {
    public static function findAll(): array {
        $db = Database::getInstance();
        return $db->query('SELECT * FROM menus ORDER BY name ASC')->fetchAll();
    }

    public static function findById(int $id): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM menus WHERE id = ?');
        $stmt->execute([$id]);
        $menu = $stmt->fetch();
        if (!$menu) return null;
        $menu['items'] = self::getItemsForMenu($id);
        return $menu;
    }

    public static function findByLocation(string $location): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM menus WHERE location = ?');
        $stmt->execute([$location]);
        $menu = $stmt->fetch();
        if (!$menu) return null;
        $menu['items'] = self::getItemsForMenu($menu['id']);
        return $menu;
    }

    public static function getItemsForMenu(int $menuId): array {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT mi.*, p.title AS page_title, p.slug AS page_slug, p.status AS page_status
            FROM menu_items mi
            LEFT JOIN pages p ON mi.page_id = p.id AND mi.type = 'page'
            WHERE mi.menu_id = ?
            ORDER BY mi.menu_order ASC, mi.id ASC
        ");
        $stmt->execute([$menuId]);
        $rows = $stmt->fetchAll();

        $items = array_map(function ($row) {
            return [
                'id' => $row['id'],
                'menu_id' => $row['menu_id'],
                'title' => ($row['type'] === 'page' && $row['page_title']) ? $row['page_title'] : $row['title'],
                'url' => ($row['type'] === 'page' && $row['page_slug']) ? '/pages/' . $row['page_slug'] : $row['url'],
                'type' => $row['type'],
                'page_id' => $row['page_id'],
                'parent_id' => $row['parent_id'],
                'menu_order' => $row['menu_order'],
                'open_in_new_tab' => (bool) $row['open_in_new_tab'],
                '_raw_title' => $row['title'],
                '_raw_url' => $row['url'],
                '_page_title' => $row['page_title'],
                '_page_slug' => $row['page_slug'],
                '_page_status' => $row['page_status'] ?? null,
            ];
        }, $rows);

        // Build hierarchy
        $roots = array_filter($items, fn($i) => empty($i['parent_id']));
        $childMap = [];
        foreach (array_filter($items, fn($i) => !empty($i['parent_id'])) as $item) {
            $childMap[$item['parent_id']][] = $item;
        }

        $attachChildren = function ($item) use (&$attachChildren, $childMap) {
            $children = $childMap[$item['id']] ?? [];
            if (!empty($children)) {
                $item['children'] = array_map($attachChildren, $children);
            }
            return $item;
        };

        return array_values(array_map($attachChildren, $roots));
    }

    public static function getItemsFlat(int $menuId): array {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT mi.*, p.title AS page_title, p.slug AS page_slug
            FROM menu_items mi
            LEFT JOIN pages p ON mi.page_id = p.id AND mi.type = 'page'
            WHERE mi.menu_id = ?
            ORDER BY mi.menu_order ASC, mi.id ASC
        ");
        $stmt->execute([$menuId]);
        return $stmt->fetchAll();
    }

    public static function create(array $data): int {
        $db = Database::getInstance();
        if (!empty($data['location'])) {
            $db->prepare('UPDATE menus SET location = NULL WHERE location = ?')->execute([$data['location']]);
        }
        $stmt = $db->prepare('INSERT INTO menus (name, location) VALUES (?, ?)');
        $stmt->execute([$data['name'], $data['location'] ?? null]);
        return (int) $db->lastInsertId();
    }

    public static function update(int $id, array $data): void {
        $db = Database::getInstance();
        if (!empty($data['location'])) {
            $db->prepare('UPDATE menus SET location = NULL WHERE location = ? AND id != ?')->execute([$data['location'], $id]);
        }
        $db->prepare('UPDATE menus SET name = ?, location = ? WHERE id = ?')->execute([$data['name'], $data['location'] ?? null, $id]);
    }

    public static function delete(int $id): void {
        $db = Database::getInstance();
        $db->prepare('DELETE FROM menus WHERE id = ?')->execute([$id]);
    }

    public static function replaceItems(int $menuId, array $items): void {
        $db = Database::getInstance();
        $db->prepare('DELETE FROM menu_items WHERE menu_id = ?')->execute([$menuId]);

        if (empty($items)) return;

        $roots = array_filter($items, fn($i) => empty($i['parent_id']));
        $children = array_filter($items, fn($i) => !empty($i['parent_id']));
        $sorted = array_merge(array_values($roots), array_values($children));

        $idMap = [];
        $stmt = $db->prepare("INSERT INTO menu_items (menu_id, title, url, type, page_id, parent_id, menu_order, open_in_new_tab) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

        foreach ($sorted as $item) {
            $parentId = null;
            if (!empty($item['parent_id'])) {
                $parentId = $idMap[$item['parent_id']] ?? null;
            }

            $stmt->execute([
                $menuId,
                $item['title'] ?? '',
                $item['url'] ?? null,
                $item['type'] ?? 'custom',
                $item['page_id'] ?? null,
                $parentId,
                $item['menu_order'] ?? 0,
                !empty($item['open_in_new_tab']) ? 1 : 0,
            ]);

            $newId = (int) $db->lastInsertId();
            if (!empty($item['old_id'])) $idMap[$item['old_id']] = $newId;
            if (!empty($item['temp_id'])) $idMap[$item['temp_id']] = $newId;
        }
    }

    public static function getNavigationById(int $id): ?array {
        $menu = self::findById($id);
        if ($menu && !empty($menu['items'])) {
            return self::filterDraftPages($menu['items']);
        }
        return null;
    }

    public static function getNavigationByLocation(string $location): ?array {
        $menu = self::findByLocation($location);
        if ($menu && !empty($menu['items'])) {
            return self::filterDraftPages($menu['items']);
        }
        return null;
    }

    private static function filterDraftPages(array $items): array {
        return array_values(array_filter(array_map(function ($item) {
            if ($item['type'] === 'page') {
                if (empty($item['page_id']) || ($item['_page_status'] ?? '') !== 'published') {
                    return null;
                }
            }
            if (!empty($item['children'])) {
                $item['children'] = self::filterDraftPages($item['children']);
            }
            return $item;
        }, $items), fn($i) => $i !== null));
    }

    public static function getAllPageMenuInfo(): array {
        $db = Database::getInstance();
        $menus = $db->query('SELECT id, name, location FROM menus ORDER BY name ASC')->fetchAll();
        $menuMap = [];
        foreach ($menus as $m) $menuMap[$m['id']] = $m;

        $items = $db->query("
            SELECT mi.menu_id, mi.page_id, mi.parent_id, mi.title AS item_title,
                   p.title AS parent_page_title, p.id AS parent_page_id
            FROM menu_items mi
            LEFT JOIN menu_items pi ON mi.parent_id = pi.id
            LEFT JOIN pages p ON pi.page_id = p.id AND pi.type = 'page'
            WHERE mi.type = 'page' AND mi.page_id IS NOT NULL
        ")->fetchAll();

        $primaryMenu = null;
        foreach ($menus as $m) {
            if ($m['location'] === 'primary') { $primaryMenu = $m; break; }
        }
        $primaryMenuId = $primaryMenu ? $primaryMenu['id'] : null;

        $result = [];
        foreach ($items as $item) {
            $pid = $item['page_id'];
            if (!isset($result[$pid])) $result[$pid] = ['menus' => [], 'primaryParent' => null];

            $menu = $menuMap[$item['menu_id']] ?? null;
            if ($menu) {
                $exists = false;
                foreach ($result[$pid]['menus'] as $existing) {
                    if ($existing['id'] === $menu['id']) { $exists = true; break; }
                }
                if (!$exists) {
                    $result[$pid]['menus'][] = ['id' => $menu['id'], 'name' => $menu['name'], 'location' => $menu['location']];
                }
            }

            if ($item['menu_id'] == $primaryMenuId && $item['parent_id'] && $item['parent_page_id']) {
                $result[$pid]['primaryParent'] = ['title' => $item['parent_page_title'], 'page_id' => $item['parent_page_id']];
            }
        }

        return $result;
    }

    public static function getPageMenuDetails(int $pageId): array {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT menu_id, parent_id, menu_order FROM menu_items WHERE page_id = ? AND type = 'page'");
        $stmt->execute([$pageId]);
        $map = [];
        foreach ($stmt->fetchAll() as $r) {
            $map[$r['menu_id']] = ['parent_id' => $r['parent_id'], 'menu_order' => $r['menu_order']];
        }
        return $map;
    }

    public static function getItemsForMenuFlat(int $menuId): array {
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT mi.id, mi.title, mi.page_id, mi.parent_id, mi.menu_order, mi.type,
                   p.title AS page_title
            FROM menu_items mi
            LEFT JOIN pages p ON mi.page_id = p.id AND mi.type = 'page'
            WHERE mi.menu_id = ?
            ORDER BY mi.menu_order ASC, mi.id ASC
        ");
        $stmt->execute([$menuId]);
        return array_map(function ($r) {
            return [
                'id' => $r['id'],
                'title' => ($r['type'] === 'page' && $r['page_title']) ? $r['page_title'] : $r['title'],
                'page_id' => $r['page_id'],
                'parent_id' => $r['parent_id'],
                'menu_order' => $r['menu_order'],
            ];
        }, $stmt->fetchAll());
    }

    public static function getMenusForPage(int $pageId): array {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT DISTINCT menu_id FROM menu_items WHERE page_id = ? AND type = 'page'");
        $stmt->execute([$pageId]);
        return array_column($stmt->fetchAll(), 'menu_id');
    }

    public static function syncPageMenus(int $pageId, string $pageTitle, string $pageSlug, array $assignments): void {
        $db = Database::getInstance();
        $targetMenuIds = array_column($assignments, 'menuId');
        $currentMenuIds = self::getMenusForPage($pageId);

        $toRemove = array_diff($currentMenuIds, $targetMenuIds);

        $stmtDelete = $db->prepare("DELETE FROM menu_items WHERE menu_id = ? AND page_id = ? AND type = 'page'");
        foreach ($toRemove as $menuId) {
            $stmtDelete->execute([$menuId, $pageId]);
        }

        $stmtUpdate = $db->prepare("UPDATE menu_items SET title = ?, url = ?, parent_id = ?, menu_order = ? WHERE menu_id = ? AND page_id = ? AND type = 'page'");
        $stmtInsert = $db->prepare("INSERT INTO menu_items (menu_id, title, url, type, page_id, parent_id, menu_order, open_in_new_tab) VALUES (?, ?, ?, 'page', ?, ?, ?, 0)");

        foreach ($assignments as $a) {
            $url = '/pages/' . $pageSlug;
            if (in_array($a['menuId'], $currentMenuIds)) {
                $stmtUpdate->execute([$pageTitle, $url, $a['parent_id'] ?? null, $a['menu_order'] ?? 0, $a['menuId'], $pageId]);
            } else {
                $stmtInsert->execute([$a['menuId'], $pageTitle, $url, $pageId, $a['parent_id'] ?? null, $a['menu_order'] ?? 0]);
            }
        }
    }
}
