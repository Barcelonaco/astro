import { Menu } from '../models/Menu.js';
import { Page } from '../models/Page.js';

/**
 * Get all menus (admin)
 */
export async function getAllMenus(req, res) {
  try {
    const menus = await Menu.findAll();
    return res.json(menus);
  } catch (error) {
    console.error('getAllMenus error:', error);
    return res.status(500).json({ error: 'Failed to fetch menus' });
  }
}

/**
 * Get a menu by ID with items (admin)
 */
export async function getMenuById(req, res) {
  try {
    const menu = await Menu.findById(parseInt(req.params.id, 10));
    if (!menu) return res.status(404).json({ error: 'Menu not found' });
    // Also return flat items for editing
    menu.flatItems = await Menu.getItemsFlat(menu.id);
    return res.json(menu);
  } catch (error) {
    console.error('getMenuById error:', error);
    return res.status(500).json({ error: 'Failed to fetch menu' });
  }
}

/**
 * Create a menu (admin)
 */
export async function createMenu(req, res) {
  try {
    const { name, location } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const id = await Menu.create({ name, location });
    return res.status(201).json({ id, message: 'Menu created' });
  } catch (error) {
    console.error('createMenu error:', error);
    return res.status(500).json({ error: 'Failed to create menu' });
  }
}

/**
 * Update a menu (admin)
 */
export async function updateMenu(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, location } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    await Menu.update(id, { name, location });
    return res.json({ message: 'Menu updated' });
  } catch (error) {
    console.error('updateMenu error:', error);
    return res.status(500).json({ error: 'Failed to update menu' });
  }
}

/**
 * Delete a menu (admin)
 */
export async function deleteMenu(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await Menu.delete(id);
    return res.json({ message: 'Menu deleted' });
  } catch (error) {
    console.error('deleteMenu error:', error);
    return res.status(500).json({ error: 'Failed to delete menu' });
  }
}

/**
 * Save menu items (replace all items in a menu)
 */
export async function saveMenuItems(req, res) {
  try {
    const menuId = parseInt(req.params.id, 10);
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Items must be an array' });
    await Menu.replaceItems(menuId, items);
    return res.json({ message: 'Menu items saved' });
  } catch (error) {
    console.error('saveMenuItems error:', error);
    return res.status(500).json({ error: 'Failed to save menu items' });
  }
}

/**
 * Get navigation by location (public, used by frontend)
 */
export async function getNavigationByLocation(req, res) {
  try {
    const location = req.params.location || 'primary';
    const items = await Menu.getNavigationByLocation(location);
    if (items) {
      return res.json(items);
    }
    // Fallback: page-based navigation
    const navigation = await Page.findNavigation();
    return res.json(navigation);
  } catch (error) {
    console.error('getNavigationByLocation error:', error);
    return res.status(500).json([]);
  }
}

/**
 * Get available pages for menu item picker (admin)
 */
export async function getAvailablePages(req, res) {
  try {
    const pages = await Page.findAll();
    return res.json(pages.map(p => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      parent_id: p.parent_id,
      parent_title: p.parent_title,
    })));
  } catch (error) {
    console.error('getAvailablePages error:', error);
    return res.status(500).json([]);
  }
}

/**
 * Bulk: get menu info for all pages (used by pages list)
 */
export async function getAllPageMenuInfo(req, res) {
  try {
    const info = await Menu.getAllPageMenuInfo();
    return res.json(info);
  } catch (error) {
    console.error('getAllPageMenuInfo error:', error);
    return res.status(500).json({});
  }
}

/**
 * Get page menu details: which menus contain this page + items per menu for position selectors
 */
export async function getPageMenus(req, res) {
  try {
    const pageId = parseInt(req.params.pageId, 10);
    const [allMenus, details] = await Promise.all([
      Menu.findAll(),
      Menu.getPageMenuDetails(pageId),
    ]);

    // For each menu, get its items so the frontend can build position selectors
    const menusWithItems = await Promise.all(allMenus.map(async (menu) => {
      const items = await Menu.getItemsForMenuFlat(menu.id);
      return {
        id: menu.id,
        name: menu.name,
        location: menu.location,
        enabled: !!details[menu.id],
        parent_id: details[menu.id]?.parent_id || null,
        menu_order: details[menu.id]?.menu_order || 0,
        items, // all items in this menu (for position/parent selectors)
      };
    }));

    return res.json({ menus: menusWithItems });
  } catch (error) {
    console.error('getPageMenus error:', error);
    return res.status(500).json({ menus: [] });
  }
}

/**
 * Sync a page's menu assignments (admin)
 * Body: { assignments: [{ menuId, parent_id, menu_order }], title, slug }
 */
export async function syncPageMenus(req, res) {
  try {
    const pageId = parseInt(req.params.pageId, 10);
    const { assignments, title, slug } = req.body;
    if (!Array.isArray(assignments)) return res.status(400).json({ error: 'assignments must be an array' });
    await Menu.syncPageMenus(pageId, title || '', slug || '', assignments.map(a => ({
      menuId: Number(a.menuId),
      parent_id: a.parent_id ? Number(a.parent_id) : null,
      menu_order: Number(a.menu_order) || 0,
    })));
    return res.json({ message: 'Page menus synced' });
  } catch (error) {
    console.error('syncPageMenus error:', error);
    return res.status(500).json({ error: 'Failed to sync page menus' });
  }
}
