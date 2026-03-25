import db from '../db.js';

export const Form = {
  // ── Forms CRUD ──

  async findAll() {
    const [rows] = await db.query(`
      SELECT f.*,
        (SELECT COUNT(*) FROM form_fields WHERE form_id = f.id) AS field_count,
        (SELECT COUNT(*) FROM form_entries WHERE form_id = f.id AND status != 'trash') AS entry_count,
        (SELECT COUNT(*) FROM form_entries WHERE form_id = f.id AND status = 'unread') AS unread_count
      FROM forms f ORDER BY f.created_at DESC
    `);
    return rows;
  },

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM forms WHERE id = ?', [id]);
    return rows[0];
  },

  async findBySlug(slug) {
    const [rows] = await db.query('SELECT * FROM forms WHERE slug = ?', [slug]);
    return rows[0];
  },

  async create(data) {
    const { title, slug, description, settings, status } = data;
    const [result] = await db.query(
      'INSERT INTO forms (title, slug, description, settings, status) VALUES (?, ?, ?, ?, ?)',
      [title, slug, description || null, JSON.stringify(settings || {}), status || 'active']
    );
    return result.insertId;
  },

  async update(id, data) {
    const { title, slug, description, settings, status } = data;
    await db.query(
      'UPDATE forms SET title = ?, slug = ?, description = ?, settings = ?, status = ? WHERE id = ?',
      [title, slug, description || null, JSON.stringify(settings || {}), status || 'active', id]
    );
  },

  async delete(id) {
    await db.query('DELETE FROM forms WHERE id = ?', [id]);
  },

  // ── Fields ──

  async getFields(formId) {
    const [rows] = await db.query(
      'SELECT * FROM form_fields WHERE form_id = ? ORDER BY field_order ASC',
      [formId]
    );
    return rows.map(r => ({
      ...r,
      options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options,
      validation: typeof r.validation === 'string' ? JSON.parse(r.validation) : r.validation,
      settings: typeof r.settings === 'string' ? JSON.parse(r.settings) : r.settings,
    }));
  },

  async saveFields(formId, fields) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM form_fields WHERE form_id = ?', [formId]);

      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        await conn.query(
          `INSERT INTO form_fields (form_id, type, label, name, placeholder, required, options, validation, field_order, settings)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            formId,
            f.type,
            f.label,
            f.name,
            f.placeholder || null,
            f.required ? 1 : 0,
            JSON.stringify(f.options || null),
            JSON.stringify(f.validation || null),
            i,
            JSON.stringify(f.settings || null),
          ]
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  // ── Entries ──

  async getEntries(formId, { status, page = 1, perPage = 20 } = {}) {
    let where = 'WHERE e.form_id = ?';
    const params = [formId];

    if (status && status !== 'all') {
      where += ' AND e.status = ?';
      params.push(status);
    } else {
      where += ' AND e.status != ?';
      params.push('trash');
    }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM form_entries e ${where}`, params
    );

    const offset = (page - 1) * perPage;
    const [rows] = await db.query(
      `SELECT e.* FROM form_entries e ${where} ORDER BY e.created_at DESC LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    // Fetch values for each entry
    if (rows.length > 0) {
      const entryIds = rows.map(r => r.id);
      const [values] = await db.query(
        `SELECT * FROM form_entry_values WHERE entry_id IN (${entryIds.map(() => '?').join(',')})`,
        entryIds
      );

      const valuesMap = {};
      for (const v of values) {
        if (!valuesMap[v.entry_id]) valuesMap[v.entry_id] = [];
        valuesMap[v.entry_id].push(v);
      }
      for (const row of rows) {
        row.values = valuesMap[row.id] || [];
      }
    }

    return { entries: rows, total, page, perPage, totalPages: Math.ceil(total / perPage) };
  },

  async getEntryById(entryId) {
    const [rows] = await db.query('SELECT * FROM form_entries WHERE id = ?', [entryId]);
    if (!rows[0]) return null;

    const entry = rows[0];
    const [values] = await db.query(
      'SELECT * FROM form_entry_values WHERE entry_id = ? ORDER BY id ASC',
      [entryId]
    );
    entry.values = values;
    return entry;
  },

  async createEntry(formId, { ip_address, user_agent, fieldValues }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        'INSERT INTO form_entries (form_id, ip_address, user_agent) VALUES (?, ?, ?)',
        [formId, ip_address || null, user_agent || null]
      );
      const entryId = result.insertId;

      for (const fv of fieldValues) {
        await conn.query(
          'INSERT INTO form_entry_values (entry_id, field_id, field_label, field_value) VALUES (?, ?, ?, ?)',
          [entryId, fv.field_id || null, fv.field_label, fv.field_value || '']
        );
      }

      await conn.commit();
      return entryId;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async updateEntryStatus(entryId, status) {
    await db.query('UPDATE form_entries SET status = ? WHERE id = ?', [status, entryId]);
  },

  async deleteEntry(entryId) {
    await db.query('DELETE FROM form_entries WHERE id = ?', [entryId]);
  },

  async getEntryCounts(formId) {
    const [rows] = await db.query(
      `SELECT status, COUNT(*) as count FROM form_entries WHERE form_id = ? GROUP BY status`,
      [formId]
    );
    const counts = { unread: 0, read: 0, starred: 0, trash: 0, total: 0 };
    for (const r of rows) {
      counts[r.status] = r.count;
      counts.total += r.count;
    }
    return counts;
  },

  // ── Public (for frontend rendering) ──

  async getPublicForm(id) {
    const [rows] = await db.query(
      'SELECT id, title, description, settings FROM forms WHERE id = ? AND status = ?',
      [id, 'active']
    );
    if (!rows[0]) return null;

    const form = rows[0];
    form.settings = typeof form.settings === 'string' ? JSON.parse(form.settings) : form.settings;

    const fields = await this.getFields(id);
    // Strip internal data for public use
    form.fields = fields.map(f => ({
      id: f.id,
      type: f.type,
      label: f.label,
      name: f.name,
      placeholder: f.placeholder,
      required: !!f.required,
      options: f.options,
      settings: f.settings,
    }));

    return form;
  },
};
