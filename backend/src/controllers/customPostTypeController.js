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

export async function getCPTItems(req, res) {
  try {
    const slug = safeCPTSlug(req.params.postType);
    if (!slug) return res.status(400).json({ error: 'Invalid post type' });

    const table = `cpt_${slug}`;
    const [rows] = await pool.query(
      `SELECT * FROM \`${table}\` ORDER BY created_at DESC`
    );

    // Parse JSON columns
    const items = rows.map(row => ({
      ...row,
      featured_image: row.featured_image ? (typeof row.featured_image === 'string' ? JSON.parse(row.featured_image) : row.featured_image) : null,
      custom_fields: row.custom_fields ? (typeof row.custom_fields === 'string' ? JSON.parse(row.custom_fields) : row.custom_fields) : {}
    }));

    res.json(items);
  } catch (error) {
    console.error('Get CPT items error:', error);
    res.status(500).json({ error: 'Failed to load items' });
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

    const row = rows[0];
    res.json({
      ...row,
      featured_image: row.featured_image ? (typeof row.featured_image === 'string' ? JSON.parse(row.featured_image) : row.featured_image) : null,
      custom_fields: row.custom_fields ? (typeof row.custom_fields === 'string' ? JSON.parse(row.custom_fields) : row.custom_fields) : {}
    });
  } catch (error) {
    console.error('Get CPT item by slug error:', error);
    res.status(500).json({ error: 'Failed to load item' });
  }
}

export async function createCPTItem(req, res) {
  try {
    const postType = safeCPTSlug(req.params.postType);
    if (!postType) return res.status(400).json({ error: 'Invalid post type' });

    const table = `cpt_${postType}`;
    const { title, slug, excerpt, content, featured_image, custom_fields, status, published_date } = req.body;

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

    const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
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
    const { title, slug, excerpt, content, featured_image, custom_fields, status, published_date } = req.body;

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

    const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
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
