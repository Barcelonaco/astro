import db from '../db.js';

export const Post = {
  async findAll(filters = {}) {
    let query = `
      SELECT
        p.*,
        u.name as author_name,
        GROUP_CONCAT(DISTINCT c.id) as category_ids,
        GROUP_CONCAT(DISTINCT c.name) as category_names,
        GROUP_CONCAT(DISTINCT t.name) as tags
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN post_categories pc ON p.id = pc.post_id
      LEFT JOIN categories c ON pc.category_id = c.id
      LEFT JOIN post_tags pt ON p.id = pt.post_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      query += ' AND p.status = ?';
      params.push(filters.status);
    }

    if (filters.category) {
      query += ' AND c.slug = ?';
      params.push(filters.category);
    }

    query += ' GROUP BY p.id ORDER BY p.published_date DESC';

    const [rows] = await db.query(query, params);
    return rows;
  },

  async findBySlug(slug) {
    const query = `
      SELECT
        p.*,
        u.name as author_name,
        u.email as author_email,
        GROUP_CONCAT(DISTINCT c.id) as category_ids,
        GROUP_CONCAT(DISTINCT c.name) as category_names,
        GROUP_CONCAT(DISTINCT c.slug) as category_slugs,
        GROUP_CONCAT(DISTINCT t.name) as tags
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN post_categories pc ON p.id = pc.post_id
      LEFT JOIN categories c ON pc.category_id = c.id
      LEFT JOIN post_tags pt ON p.id = pt.post_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE p.slug = ?
      GROUP BY p.id
    `;
    const [rows] = await db.query(query, [slug]);
    return rows[0];
  },

  async create(postData) {
    const { title, slug, excerpt, content, featured_image, author_id, published_date, status } = postData;
    const query = `
      INSERT INTO posts (title, slug, excerpt, content, featured_image, author_id, published_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [
      title, slug, excerpt, content, featured_image, author_id, published_date, status
    ]);
    return result.insertId;
  },

  async update(id, postData) {
    const { title, slug, excerpt, content, featured_image, published_date, status } = postData;
    const query = `
      UPDATE posts
      SET title = ?, slug = ?, excerpt = ?, content = ?, featured_image = ?, published_date = ?, status = ?
      WHERE id = ?
    `;
    await db.query(query, [title, slug, excerpt, content, featured_image, published_date, status, id]);
  },

  async delete(id) {
    await db.query('DELETE FROM posts WHERE id = ?', [id]);
  },

  async setCategories(postId, categoryIds) {
    await db.query('DELETE FROM post_categories WHERE post_id = ?', [postId]);

    if (categoryIds && categoryIds.length > 0) {
      const values = categoryIds.map(catId => [postId, catId]);
      await db.query('INSERT INTO post_categories (post_id, category_id) VALUES ?', [values]);
    }
  },

  async setTags(postId, tagNames) {
    await db.query('DELETE FROM post_tags WHERE post_id = ?', [postId]);

    if (tagNames && tagNames.length > 0) {
      for (const tagName of tagNames) {
        const [existingTag] = await db.query('SELECT id FROM tags WHERE name = ?', [tagName]);
        let tagId;

        if (existingTag.length > 0) {
          tagId = existingTag[0].id;
        } else {
          const [result] = await db.query('INSERT INTO tags (name) VALUES (?)', [tagName]);
          tagId = result.insertId;
        }

        await db.query('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)', [postId, tagId]);
      }
    }
  }
};
