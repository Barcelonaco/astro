import db from '../db.js';

export const ReusableBloc = {
  async findAll() {
    const query = `
      SELECT
        rb.*,
        u.name as author_name
      FROM reusable_blocs rb
      LEFT JOIN users u ON rb.author_id = u.id
      ORDER BY rb.title ASC
    `;
    const [rows] = await db.query(query);
    return rows;
  },

  async findById(id) {
    const query = `
      SELECT
        rb.*,
        u.name as author_name
      FROM reusable_blocs rb
      LEFT JOIN users u ON rb.author_id = u.id
      WHERE rb.id = ?
    `;
    const [rows] = await db.query(query, [id]);
    return rows[0];
  },

  async create({ title, content, status, author_id }) {
    const query = `
      INSERT INTO reusable_blocs (title, content, status, author_id)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [title, content, status || 'published', author_id]);
    return result.insertId;
  },

  async update(id, { title, content, status }) {
    const query = `
      UPDATE reusable_blocs
      SET title = ?, content = ?, status = ?
      WHERE id = ?
    `;
    await db.query(query, [title, content, status || 'published', id]);
  },

  async delete(id) {
    await db.query('DELETE FROM reusable_blocs WHERE id = ?', [id]);
  }
};
