import db from '../db.js';

export const Menu = {
  /**
   * Get all menus
   */
  async findAll() {
    const [rows] = await db.query('SELECT * FROM menus ORDER BY name ASC');
    return rows;
  },

  /**
   * Get a menu by ID with its items (hierarchical)
   */
  async findById(id) {
    const [menus] = await db.query('SELECT * FROM menus WHERE id = ?', [id]);
    if (!menus[0]) return null;
    const menu = menus[0];
    menu.items = await this.getItemsForMenu(id);
    return menu;
  },

  /**
   * Get a menu by location with its items (hierarchical)
   */
  async findByLocation(location) {
    const [menus] = await db.query('SELECT * FROM menus WHERE location = ?', [location]);
    if (!menus[0]) return null;
    const menu = menus[0];
    menu.items = await this.getItemsForMenu(menu.id);
    return menu;
  },

  /**
   * Get hierarchical items for a menu, resolving page slugs
   */
  async getItemsForMenu(menuId) {
    const [rows] = await db.query(`
      SELECT mi.*, p.title AS page_title, p.slug AS page_slug, p.status AS page_status
      FROM menu_items mi
      LEFT JOIN pages p ON mi.page_id = p.id AND mi.type = 'page'
      WHERE mi.menu_id = ?
      ORDER BY mi.menu_order ASC, mi.id ASC
    `, [menuId]);

    // Resolve title/url from page if type=page
    const items = rows.map(row => ({
      id: row.id,
      menu_id: row.menu_id,
      title: row.type === 'page' && row.page_title ? row.page_title : row.title,
      url: row.type === 'page' && row.page_slug ? `/pages/${row.page_slug}` : row.url,
      type: row.type,
      page_id: row.page_id,
      parent_id: row.parent_id,
      menu_order: row.menu_order,
      open_in_new_tab: !!row.open_in_new_tab,
      // Keep originals for admin
      _raw_title: row.title,
      _raw_url: row.url,
      _page_title: row.page_title,
      _page_slug: row.page_slug,
      _page_status: row.page_status,
    }));

    // Build hierarchy
    const roots = items.filter(i => !i.parent_id);
    const childMap = {};
    items.filter(i => i.parent_id).forEach(i => {
      if (!childMap[i.parent_id]) childMap[i.parent_id] = [];
      childMap[i.parent_id].push(i);
    });

    function attachChildren(item) {
      const children = childMap[item.id] || [];
      if (children.length > 0) {
        item.children = children.map(c => attachChildren(c));
      }
      return item;
    }

    return roots.map(r => attachChildren(r));
  },

  /**
   * Get flat items for a menu (admin editing)
   */
  async getItemsFlat(menuId) {
    const [rows] = await db.query(`
      SELECT mi.*, p.title AS page_title, p.slug AS page_slug
      FROM menu_items mi
      LEFT JOIN pages p ON mi.page_id = p.id AND mi.type = 'page'
      WHERE mi.menu_id = ?
      ORDER BY mi.menu_order ASC, mi.id ASC
    `, [menuId]);
    return rows;
  },

  /**
   * Create a menu
   */
  async create({ name, location }) {
    // If location is set, clear it from any other menu
    if (location) {
      await db.query('UPDATE menus SET location = NULL WHERE location = ?', [location]);
    }
    const [result] = await db.query(
      'INSERT INTO menus (name, location) VALUES (?, ?)',
      [name, location || null]
    );
    return result.insertId;
  },

  /**
   * Update a menu
   */
  async update(id, { name, location }) {
    if (location) {
      await db.query('UPDATE menus SET location = NULL WHERE location = ? AND id != ?', [location, id]);
    }
    await db.query(
      'UPDATE menus SET name = ?, location = ? WHERE id = ?',
      [name, location || null, id]
    );
  },

  /**
   * Delete a menu (cascade deletes items)
   */
  async delete(id) {
    await db.query('DELETE FROM menus WHERE id = ?', [id]);
  },

  /**
   * Replace all items in a menu (bulk save)
   */
  async replaceItems(menuId, items) {
    // Delete existing items
    await db.query('DELETE FROM menu_items WHERE menu_id = ?', [menuId]);

    if (!items || items.length === 0) return;

    // Sort: insert root items (no parent) first, then children
    const roots = items.filter(i => !i.parent_id);
    const children = items.filter(i => i.parent_id);
    const sorted = [...roots, ...children];

    // Map old/temp IDs to new real IDs for parent references
    const idMap = {};

    for (const item of sorted) {
      let parentId = null;
      if (item.parent_id) {
        parentId = idMap[item.parent_id] || null;
        // If parent wasn't mapped yet, skip this item's parent link
      }

      const [result] = await db.query(
        `INSERT INTO menu_items (menu_id, title, url, type, page_id, parent_id, menu_order, open_in_new_tab)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          menuId,
          item.title || '',
          item.url || null,
          item.type || 'custom',
          item.page_id || null,
          parentId,
          item.menu_order || 0,
          item.open_in_new_tab ? 1 : 0,
        ]
      );

      // Map old_id and temp_id to new real id for children references
      if (item.old_id) {
        idMap[item.old_id] = result.insertId;
      }
      if (item.temp_id) {
        idMap[item.temp_id] = result.insertId;
      }
    }
  },

  /**
   * Get navigation for a location (used by frontend)
   * Falls back to page-based navigation if no menu assigned.
   * Excludes draft pages from the navigation tree.
   */
  async getNavigationByLocation(location) {
    const menu = await this.findByLocation(location);
    if (menu && menu.items && menu.items.length > 0) {
      return this.filterDraftPages(menu.items);
    }
    return null;
  },

  /**
   * Recursively remove menu items that link to draft or deleted pages
   */
  filterDraftPages(items) {
    if (!items) return items;
    return items
      .filter(item => {
        // If it's a page-type item, the page must exist and be published
        if (item.type === 'page') {
          return item.page_id && item._page_status === 'published';
        }
        return true;
      })
      .map(item => {
        if (item.children && item.children.length > 0) {
          return { ...item, children: this.filterDraftPages(item.children) };
        }
        return item;
      });
  },

  /**
   * Bulk: for all pages, return menu presence + primary hierarchy
   * Returns: { [pageId]: { menus: [{ id, name, location }], primaryParent: { title, page_id } | null } }
   */
  async getAllPageMenuInfo() {
    // All menus
    const [menus] = await db.query('SELECT id, name, location FROM menus ORDER BY name ASC');
    const menuMap = {};
    menus.forEach(m => { menuMap[m.id] = m; });

    // All menu_items that are page-type
    const [items] = await db.query(`
      SELECT mi.menu_id, mi.page_id, mi.parent_id, mi.title AS item_title,
             p.title AS parent_page_title, p.id AS parent_page_id
      FROM menu_items mi
      LEFT JOIN menu_items pi ON mi.parent_id = pi.id
      LEFT JOIN pages p ON pi.page_id = p.id AND pi.type = 'page'
      WHERE mi.type = 'page' AND mi.page_id IS NOT NULL
    `);

    // Find the primary menu id
    const primaryMenu = menus.find(m => m.location === 'primary');
    const primaryMenuId = primaryMenu ? primaryMenu.id : null;

    const result = {};
    items.forEach(item => {
      const pid = item.page_id;
      if (!result[pid]) result[pid] = { menus: [], primaryParent: null };

      const menu = menuMap[item.menu_id];
      if (menu && !result[pid].menus.find(m => m.id === menu.id)) {
        result[pid].menus.push({ id: menu.id, name: menu.name, location: menu.location });
      }

      // If this is in the primary menu and has a parent that is a page, record it
      if (item.menu_id === primaryMenuId && item.parent_id && item.parent_page_id) {
        result[pid].primaryParent = { title: item.parent_page_title, page_id: item.parent_page_id };
      }
    });

    return result;
  },

  /**
   * Get menu IDs that contain a specific page
   */
  async getMenusForPage(pageId) {
    const [rows] = await db.query(
      'SELECT DISTINCT menu_id FROM menu_items WHERE page_id = ? AND type = ?',
      [pageId, 'page']
    );
    return rows.map(r => r.menu_id);
  },

  /**
   * Get detailed page-in-menu info for each menu that contains this page
   * Returns: { [menuId]: { parent_id, menu_order } }
   */
  async getPageMenuDetails(pageId) {
    const [rows] = await db.query(
      'SELECT menu_id, parent_id, menu_order FROM menu_items WHERE page_id = ? AND type = ?',
      [pageId, 'page']
    );
    const map = {};
    rows.forEach(r => { map[r.menu_id] = { parent_id: r.parent_id, menu_order: r.menu_order }; });
    return map;
  },

  /**
   * Get all items in a menu (flat, for position selectors)
   */
  async getItemsForMenuFlat(menuId) {
    const [rows] = await db.query(
      `SELECT mi.id, mi.title, mi.page_id, mi.parent_id, mi.menu_order, mi.type,
              p.title AS page_title
       FROM menu_items mi
       LEFT JOIN pages p ON mi.page_id = p.id AND mi.type = 'page'
       WHERE mi.menu_id = ?
       ORDER BY mi.menu_order ASC, mi.id ASC`,
      [menuId]
    );
    return rows.map(r => ({
      id: r.id,
      title: r.type === 'page' && r.page_title ? r.page_title : r.title,
      page_id: r.page_id,
      parent_id: r.parent_id,
      menu_order: r.menu_order,
    }));
  },

  /**
   * Sync a page's presence across menus.
   * assignments = [{ menuId, parent_id, menu_order }] for menus where page should be.
   */
  async syncPageMenus(pageId, pageTitle, pageSlug, assignments) {
    const targetMenuIds = assignments.map(a => a.menuId);
    const currentMenuIds = await this.getMenusForPage(pageId);

    const toRemove = currentMenuIds.filter(id => !targetMenuIds.includes(id));

    // Remove page from menus it should no longer be in
    for (const menuId of toRemove) {
      await db.query(
        'DELETE FROM menu_items WHERE menu_id = ? AND page_id = ? AND type = ?',
        [menuId, pageId, 'page']
      );
    }

    // Add or update page in target menus
    for (const { menuId, parent_id, menu_order } of assignments) {
      if (currentMenuIds.includes(menuId)) {
        // Update existing
        await db.query(
          'UPDATE menu_items SET title = ?, url = ?, parent_id = ?, menu_order = ? WHERE menu_id = ? AND page_id = ? AND type = ?',
          [pageTitle, `/pages/${pageSlug}`, parent_id || null, menu_order || 0, menuId, pageId, 'page']
        );
      } else {
        // Insert new
        await db.query(
          `INSERT INTO menu_items (menu_id, title, url, type, page_id, parent_id, menu_order, open_in_new_tab)
           VALUES (?, ?, ?, 'page', ?, ?, ?, 0)`,
          [menuId, pageTitle, `/pages/${pageSlug}`, pageId, parent_id || null, menu_order || 0]
        );
      }
    }
  },
};
