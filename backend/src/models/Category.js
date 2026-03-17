import db from '../db.js';

export const Category = {
  async findAll() {
    const [rows] = await db.query('SELECT * FROM categories ORDER BY name');
    return rows;
  },

  async findBySlug(slug) {
    const [rows] = await db.query('SELECT * FROM categories WHERE slug = ?', [slug]);
    return rows[0];
  },

  async create(categoryData) {
    const { name, slug, description } = categoryData;
    const [result] = await db.query(
      'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)',
      [name, slug, description]
    );
    return result.insertId;
  },

  async update(id, categoryData) {
    const { name, slug, description } = categoryData;
    await db.query(
      'UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?',
      [name, slug, description, id]
    );
  },

  async delete(id) {
    await db.query('DELETE FROM categories WHERE id = ?', [id]);
  }
};
