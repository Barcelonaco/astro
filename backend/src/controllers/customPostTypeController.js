import pool from '../db.js';
import { getPluginManifests } from './pluginController.js';

/**
 * Ensure the database table for a custom post type exists.
 */
async function ensureCPTTable(slug) {
  const table = `cpt_${slug}`;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`${table}\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      excerpt TEXT,
      content LONGTEXT,
      featured_image JSON,
      custom_fields JSON,
      author_id INT NOT NULL,
      status ENUM('draft', 'published') DEFAULT 'draft',
      published_date DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE INDEX idx_slug (slug),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/**
 * Ensure category tables for a CPT if hasCategories is true.
 */
async function ensureCPTCategoryTables(slug) {
  const catTable = `cpt_${slug}_categories`;
  const mapTable = `cpt_${slug}_category_map`;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`${catTable}\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      UNIQUE INDEX idx_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`${mapTable}\` (
      item_id INT NOT NULL,
      category_id INT NOT NULL,
      PRIMARY KEY (item_id, category_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/**
 * Migrate all plugin post type tables at startup.
 */
export async function migratePluginTables() {
  const manifests = getPluginManifests();
  for (const manifest of manifests) {
    for (const pt of manifest.postTypes || []) {
      if (!pt.slug) continue;
      await ensureCPTTable(pt.slug);
      if (pt.hasCategories) await ensureCPTCategoryTables(pt.slug);
    }
  }
}

/**
 * Validate that a CPT slug is safe (alphanumeric + hyphens only).
 */
function safeCPTSlug(input) {
  return /^[a-z0-9-]+$/.test(input) ? input : null;
}

function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ============ CRUD HANDLERS ============

/**
 * Parse JSON columns on a CPT row.
 */
function parseCPTRow(row) {
  return {
    ...row,
    featured_image: row.featured_image ? (typeof row.featured_image === 'string' ? JSON.parse(row.featured_image) : row.featured_image) : null,
    custom_fields: row.custom_fields ? (typeof row.custom_fields === 'string' ? JSON.parse(row.custom_fields) : row.custom_fields) : {}
  };
}

/**
 * Attach categories to a list of CPT items.
 */
async function attachCategories(items, slug) {
  if (items.length === 0) return items;
  const catTable = `cpt_${slug}_categories`;
  const mapTable = `cpt_${slug}_category_map`;
  const ids = items.map(i => i.id);
  try {
    const [catRows] = await pool.query(
      `SELECT m.item_id, c.id, c.name, c.slug FROM \`${mapTable}\` m JOIN \`${catTable}\` c ON c.id = m.category_id WHERE m.item_id IN (?)`,
      [ids]
    );
    const catMap = {};
    for (const r of catRows) {
      if (!catMap[r.item_id]) catMap[r.item_id] = [];
      catMap[r.item_id].push({ id: r.id, name: r.name, slug: r.slug });
    }
    return items.map(item => ({ ...item, categories: catMap[item.id] || [] }));
  } catch {
    // Category tables may not exist
    return items.map(item => ({ ...item, categories: [] }));
  }
}

export async function getCPTItems(req, res) {
  try {
    const slug = safeCPTSlug(req.params.postType);
    if (!slug) return res.status(400).json({ error: 'Invalid post type' });

    const table = `cpt_${slug}`;
    const conditions = [];
    const joinParams = [];
    const whereParams = [];

    // Status filter
    const status = req.query.status;
    if (status && (status === 'published' || status === 'draft')) {
      conditions.push('t.status = ?');
      whereParams.push(status);
    }

    // Category filter
    const category = req.query.category;
    let joinClause = '';
    if (category) {
      const catTable = `cpt_${slug}_categories`;
      const mapTable = `cpt_${slug}_category_map`;
      joinClause = ` JOIN \`${mapTable}\` cm ON cm.item_id = t.id JOIN \`${catTable}\` cc ON cc.id = cm.category_id AND cc.slug = ?`;
      joinParams.push(category);
    }

    // Order
    const order = req.query.order === 'random' ? 'RAND()' : 't.created_at DESC';

    // Build query — params must match SQL order: JOIN params, then WHERE params, then LIMIT/OFFSET
    const params = [...joinParams, ...whereParams];
    let sql = `SELECT t.* FROM \`${table}\` t${joinClause}`;
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ` ORDER BY ${order}`;

    // Pagination
    const limit = parseInt(req.query.limit);
    const offset = parseInt(req.query.offset);
    if (limit > 0) {
      sql += ' LIMIT ?';
      params.push(limit);
      if (offset > 0) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }

    const [rows] = await pool.query(sql, params);
    let items = rows.map(parseCPTRow);

    // Attach categories
    items = await attachCategories(items, slug);

    // Include total count for pagination
    if (limit > 0) {
      const countParams = [];
      let countQuery = `SELECT COUNT(*) as total FROM \`${table}\` t`;
      if (category) {
        const catTable = `cpt_${slug}_categories`;
        const mapTable = `cpt_${slug}_category_map`;
        countQuery += ` JOIN \`${mapTable}\` cm ON cm.item_id = t.id JOIN \`${catTable}\` cc ON cc.id = cm.category_id AND cc.slug = ?`;
        countParams.push(category);
      }
      if (status) {
        countQuery += ' WHERE t.status = ?';
        countParams.push(status);
      }

      const [countRows] = await pool.query(countQuery, countParams);
      const total = countRows[0]?.total || 0;
      return res.json({ items, total, limit, offset: offset || 0 });
    }

    res.json(items);
  } catch (error) {
    console.error('Get CPT items error:', error);
    res.status(500).json({ error: 'Failed to load items' });
  }
}

export async function getCPTOptions(req, res) {
  try {
    const slug = safeCPTSlug(req.params.postType);
    if (!slug) return res.status(400).json({ error: 'Invalid post type' });

    const prefix = `cpt_${slug}_`;
    const [rows] = await pool.query(
      'SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE ?',
      [`${prefix}%`]
    );
    const options = {};
    for (const row of rows) {
      const key = row.setting_key.replace(prefix, '');
      options[key] = row.setting_value;
    }
    res.json(options);
  } catch (error) {
    console.error('Get CPT options error:', error);
    res.status(500).json({ error: 'Failed to load CPT options' });
  }
}

export async function getCPTItemBySlug(req, res) {
  try {
    const postType = safeCPTSlug(req.params.postType);
    if (!postType) return res.status(400).json({ error: 'Invalid post type' });

    const table = `cpt_${postType}`;
    const [rows] = await pool.query(
      `SELECT * FROM \`${table}\` WHERE slug = ?`,
      [req.params.slug]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });

    let item = parseCPTRow(rows[0]);
    const [withCats] = await attachCategories([item], postType).then(r => [r]);
    item = withCats[0];

    res.json(item);
  } catch (error) {
    console.error('Get CPT item by slug error:', error);
    res.status(500).json({ error: 'Failed to load item' });
  }
}

/**
 * Set categories for a CPT item (delete old, insert new).
 */
async function setCPTCategories(postType, itemId, categoryIds) {
  if (!Array.isArray(categoryIds)) return;
  const mapTable = `cpt_${postType}_category_map`;
  try {
    await pool.query(`DELETE FROM \`${mapTable}\` WHERE item_id = ?`, [itemId]);
    if (categoryIds.length > 0) {
      const values = categoryIds.map(catId => [itemId, catId]);
      await pool.query(`INSERT INTO \`${mapTable}\` (item_id, category_id) VALUES ?`, [values]);
    }
  } catch {
    // Category tables may not exist
  }
}

export async function getCPTItemById(req, res) {
  try {
    const postType = safeCPTSlug(req.params.postType);
    if (!postType) return res.status(400).json({ error: 'Invalid post type' });

    const table = `cpt_${postType}`;
    const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });

    let item = parseCPTRow(rows[0]);
    const withCats = await attachCategories([item], postType);
    item = withCats[0];
    res.json(item);
  } catch (error) {
    console.error('Get CPT item by id error:', error);
    res.status(500).json({ error: 'Failed to load item' });
  }
}

export async function createCPTItem(req, res) {
  try {
    const postType = safeCPTSlug(req.params.postType);
    if (!postType) return res.status(400).json({ error: 'Invalid post type' });

    const table = `cpt_${postType}`;
    const { title, slug, excerpt, content, featured_image, custom_fields, status, published_date, categories } = req.body;

    if (!title) return res.status(400).json({ error: 'Title is required' });

    const finalSlug = slug || generateSlug(title);

    const [result] = await pool.query(
      `INSERT INTO \`${table}\` (title, slug, excerpt, content, featured_image, custom_fields, author_id, status, published_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        finalSlug,
        excerpt || null,
        content || null,
        featured_image ? JSON.stringify(featured_image) : null,
        custom_fields ? JSON.stringify(custom_fields) : '{}',
        req.user.id,
        status || 'draft',
        published_date || new Date()
      ]
    );

    // Set categories if provided
    if (categories) await setCPTCategories(postType, result.insertId, categories);

    const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [result.insertId]);
    let item = parseCPTRow(rows[0]);
    const withCats = await attachCategories([item], postType);
    res.status(201).json(withCats[0]);
  } catch (error) {
    console.error('Create CPT item error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Un élément avec ce slug existe déjà' });
    }
    res.status(500).json({ error: 'Failed to create item' });
  }
}

export async function updateCPTItem(req, res) {
  try {
    const postType = safeCPTSlug(req.params.postType);
    if (!postType) return res.status(400).json({ error: 'Invalid post type' });

    const table = `cpt_${postType}`;
    const { id } = req.params;
    const { title, slug, excerpt, content, featured_image, custom_fields, status, published_date, categories } = req.body;

    await pool.query(
      `UPDATE \`${table}\` SET title = ?, slug = ?, excerpt = ?, content = ?, featured_image = ?, custom_fields = ?, status = ?, published_date = ? WHERE id = ?`,
      [
        title,
        slug,
        excerpt || null,
        content || null,
        featured_image ? JSON.stringify(featured_image) : null,
        custom_fields ? JSON.stringify(custom_fields) : '{}',
        status || 'draft',
        published_date || null,
        id
      ]
    );

    // Set categories if provided
    if (categories) await setCPTCategories(postType, id, categories);

    const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    let item = parseCPTRow(rows[0]);
    const withCats = await attachCategories([item], postType);
    res.json(withCats[0]);
  } catch (error) {
    console.error('Update CPT item error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Un élément avec ce slug existe déjà' });
    }
    res.status(500).json({ error: 'Failed to update item' });
  }
}

export async function deleteCPTItem(req, res) {
  try {
    const postType = safeCPTSlug(req.params.postType);
    if (!postType) return res.status(400).json({ error: 'Invalid post type' });

    const table = `cpt_${postType}`;
    const { id } = req.params;

    const [rows] = await pool.query(`SELECT id FROM \`${table}\` WHERE id = ?`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });

    await pool.query(`DELETE FROM \`${table}\` WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete CPT item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
}

// ============ CPT CATEGORIES ============

export async function getCPTCategories(req, res) {
  try {
    const postType = safeCPTSlug(req.params.postType);
    if (!postType) return res.status(400).json({ error: 'Invalid post type' });

    const table = `cpt_${postType}_categories`;
    const [rows] = await pool.query(`SELECT * FROM \`${table}\` ORDER BY name ASC`);
    res.json(rows);
  } catch (error) {
    console.error('Get CPT categories error:', error);
    res.status(500).json({ error: 'Failed to load categories' });
  }
}

export async function createCPTCategory(req, res) {
  try {
    const postType = safeCPTSlug(req.params.postType);
    if (!postType) return res.status(400).json({ error: 'Invalid post type' });

    const table = `cpt_${postType}_categories`;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const slug = generateSlug(name);
    const [result] = await pool.query(
      `INSERT INTO \`${table}\` (name, slug) VALUES (?, ?)`,
      [name, slug]
    );
    const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Create CPT category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
}

export async function updateCPTCategory(req, res) {
  try {
    const postType = safeCPTSlug(req.params.postType);
    if (!postType) return res.status(400).json({ error: 'Invalid post type' });

    const table = `cpt_${postType}_categories`;
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const slug = generateSlug(name);
    await pool.query(`UPDATE \`${table}\` SET name = ?, slug = ? WHERE id = ?`, [name, slug, id]);
    const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
    res.json(rows[0]);
  } catch (error) {
    console.error('Update CPT category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
}

export async function deleteCPTCategory(req, res) {
  try {
    const postType = safeCPTSlug(req.params.postType);
    if (!postType) return res.status(400).json({ error: 'Invalid post type' });

    const catTable = `cpt_${postType}_categories`;
    const mapTable = `cpt_${postType}_category_map`;
    const { id } = req.params;

    await pool.query(`DELETE FROM \`${mapTable}\` WHERE category_id = ?`, [id]);
    await pool.query(`DELETE FROM \`${catTable}\` WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete CPT category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
}
