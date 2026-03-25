import db from '../db.js';

export const Page = {
  async findAll() {
    const query = `
      SELECT
        p.*,
        u.name as author_name,
        parent.title as parent_title
      FROM pages p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN pages parent ON p.parent_id = parent.id
      ORDER BY p.menu_order ASC, p.created_at DESC
    `;
    const [rows] = await db.query(query);
    return rows;
  },

  async findBySlug(slug) {
    const query = `
      SELECT
        p.*,
        u.name as author_name,
        u.email as author_email,
        parent.title as parent_title,
        parent.slug as parent_slug
      FROM pages p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN pages parent ON p.parent_id = parent.id
      WHERE p.slug = ?
    `;
    const [rows] = await db.query(query, [slug]);
    return rows[0];
  },

  async create(pageData) {
    const { title, slug, content, author_id, status, show_in_menu, menu_order, parent_id, color_overrides, seo_meta } = pageData;
    const query = `
      INSERT INTO pages (title, slug, content, color_overrides, seo_meta, author_id, status, show_in_menu, menu_order, parent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [
      title, slug, content, color_overrides || null, seo_meta || null, author_id, status,
      show_in_menu !== undefined ? show_in_menu : true,
      menu_order || 0,
      parent_id || null
    ]);
    return result.insertId;
  },

  async update(id, pageData) {
    const { title, slug, content, status, show_in_menu, menu_order, parent_id, color_overrides, seo_meta } = pageData;
    const query = `
      UPDATE pages
      SET title = ?, slug = ?, content = ?, color_overrides = ?, seo_meta = ?, status = ?, show_in_menu = ?, menu_order = ?, parent_id = ?
      WHERE id = ?
    `;
    await db.query(query, [
      title, slug, content, color_overrides || null, seo_meta || null, status,
      show_in_menu !== undefined ? show_in_menu : true,
      menu_order || 0,
      parent_id || null,
      id
    ]);
  },

  async delete(id) {
    await db.query('DELETE FROM pages WHERE id = ?', [id]);
  },

  async findNavigation() {
    const query = `
      SELECT
        p.id,
        p.title,
        p.slug,
        p.menu_order,
        p.parent_id
      FROM pages p
      WHERE p.status = 'published' AND p.show_in_menu = TRUE
      ORDER BY p.menu_order ASC, p.title ASC
    `;
    const [rows] = await db.query(query);

    // Build hierarchical structure
    const parentPages = rows.filter(p => !p.parent_id);
    const childPages = rows.filter(p => p.parent_id);

    return parentPages.map(parent => ({
      ...parent,
      children: childPages.filter(child => child.parent_id === parent.id)
    }));
  }
};
