import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import multer from 'multer';
import imageSize from 'image-size';
import pool from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '../../uploads/media');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

async function ensureMediaTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_folders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      parent_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES media_folders(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      folder_id INT NULL,
      type ENUM('image', 'video') NOT NULL,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(120) NOT NULL,
      size INT NOT NULL,
      width INT NULL,
      height INT NULL,
      url VARCHAR(500) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES media_folders(id) ON DELETE SET NULL,
      INDEX idx_folder (folder_id),
      INDEX idx_type (type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // Add width/height columns if they don't exist (migration for existing tables)
  await pool.query(`ALTER TABLE media_items ADD COLUMN width INT NULL AFTER size`).catch(() => {});
  await pool.query(`ALTER TABLE media_items ADD COLUMN height INT NULL AFTER width`).catch(() => {});
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '';
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    cb(null, `${unique}${safeExt}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype?.startsWith('image/') || file.mimetype?.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non supporté (image/vidéo uniquement).'));
  }
};

export const mediaUpload = multer({ storage, fileFilter, limits: { fileSize: 200 * 1024 * 1024 } }).array('files', 50);

function normalizeFolderId(value) {
  if (value === undefined || value === null || value === '' || value === 'null') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function detectType(mime) {
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('video/')) return 'video';
  return null;
}

/** Extract width/height from an image file using image-size */
function getImageDimensions(filePath) {
  try {
    const result = imageSize(filePath);
    return { width: result.width || null, height: result.height || null };
  } catch {
    return { width: null, height: null };
  }
}

/** Extract width/height from a video file using ffprobe */
function getVideoDimensions(filePath) {
  return new Promise((resolve) => {
    execFile('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'json',
      filePath
    ], { timeout: 10000 }, (err, stdout) => {
      if (err) return resolve({ width: null, height: null });
      try {
        const data = JSON.parse(stdout);
        const stream = data.streams?.[0];
        return resolve({ width: stream?.width || null, height: stream?.height || null });
      } catch {
        return resolve({ width: null, height: null });
      }
    });
  });
}

export async function getMediaFolders(req, res) {
  try {
    await ensureMediaTables();
    const [rows] = await pool.query('SELECT id, name, parent_id, created_at FROM media_folders ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    console.error('Get media folders error:', error);
    res.status(500).json({ error: 'Failed to load media folders' });
  }
}

export async function createMediaFolder(req, res) {
  try {
    await ensureMediaTables();
    const name = String(req.body.name || '').trim();
    const parentId = normalizeFolderId(req.body.parent_id);
    if (!name) return res.status(400).json({ error: 'Nom de dossier requis' });

    const [result] = await pool.query(
      'INSERT INTO media_folders (name, parent_id) VALUES (?, ?)',
      [name, parentId]
    );
    const [rows] = await pool.query('SELECT id, name, parent_id, created_at FROM media_folders WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Create media folder error:', error);
    res.status(500).json({ error: 'Failed to create media folder' });
  }
}

export async function updateMediaFolder(req, res) {
  try {
    await ensureMediaTables();
    const { id } = req.params;
    const name = String(req.body.name || '').trim();
    const parentId = normalizeFolderId(req.body.parent_id);
    if (!name) return res.status(400).json({ error: 'Nom de dossier requis' });

    await pool.query('UPDATE media_folders SET name = ?, parent_id = ? WHERE id = ?', [name, parentId, id]);
    const [rows] = await pool.query('SELECT id, name, parent_id, created_at FROM media_folders WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    console.error('Update media folder error:', error);
    res.status(500).json({ error: 'Failed to update media folder' });
  }
}

export async function deleteMediaFolder(req, res) {
  try {
    await ensureMediaTables();
    const { id } = req.params;
    await pool.query('UPDATE media_items SET folder_id = NULL WHERE folder_id = ?', [id]);
    await pool.query('UPDATE media_folders SET parent_id = NULL WHERE parent_id = ?', [id]);
    await pool.query('DELETE FROM media_folders WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete media folder error:', error);
    res.status(500).json({ error: 'Failed to delete media folder' });
  }
}

export async function getMediaItems(req, res) {
  try {
    await ensureMediaTables();
    const folderId = normalizeFolderId(req.query.folder_id);
    const [rows] = await pool.query(
      'SELECT id, folder_id, type, filename, original_name, mime_type, size, width, height, url, created_at FROM media_items WHERE folder_id <=> ? ORDER BY created_at DESC',
      [folderId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Get media items error:', error);
    res.status(500).json({ error: 'Failed to load media items' });
  }
}

export async function uploadMediaItems(req, res) {
  try {
    await ensureMediaTables();
    const folderId = normalizeFolderId(req.body.folder_id);
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return res.status(400).json({ error: 'Aucun fichier fourni' });

    const created = [];
    for (const file of files) {
      const type = detectType(file.mimetype);
      if (!type) {
        if (file.path) fs.unlink(file.path, () => {});
        continue;
      }
      const url = `/uploads/media/${file.filename}`;

      // Extract width/height
      const dims = type === 'image'
        ? getImageDimensions(file.path)
        : await getVideoDimensions(file.path);
      const { width, height } = dims;

      const [result] = await pool.query(
        'INSERT INTO media_items (folder_id, type, filename, original_name, mime_type, size, width, height, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [folderId, type, file.filename, file.originalname, file.mimetype, file.size, width, height, url]
      );
      created.push({
        id: result.insertId,
        folder_id: folderId,
        type,
        filename: file.filename,
        original_name: file.originalname,
        mime_type: file.mimetype,
        size: file.size,
        width,
        height,
        url
      });
    }
    res.status(201).json(created);
  } catch (error) {
    console.error('Upload media error:', error);
    res.status(500).json({ error: 'Failed to upload media' });
  }
}

export async function updateMediaItem(req, res) {
  try {
    await ensureMediaTables();
    const { id } = req.params;
    const folderId = normalizeFolderId(req.body.folder_id);
    const originalName = req.body.original_name ? String(req.body.original_name).trim() : null;
    if (originalName) {
      await pool.query('UPDATE media_items SET folder_id = ?, original_name = ? WHERE id = ?', [folderId, originalName, id]);
    } else {
      await pool.query('UPDATE media_items SET folder_id = ? WHERE id = ?', [folderId, id]);
    }
    const [rows] = await pool.query('SELECT id, folder_id, type, filename, original_name, mime_type, size, width, height, url, created_at FROM media_items WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    console.error('Update media item error:', error);
    res.status(500).json({ error: 'Failed to update media item' });
  }
}

export async function deleteMediaItem(req, res) {
  try {
    await ensureMediaTables();
    const { id } = req.params;
    const [rows] = await pool.query('SELECT filename FROM media_items WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Media introuvable' });
    const filename = rows[0].filename;
    await pool.query('DELETE FROM media_items WHERE id = ?', [id]);
    if (filename) {
      const filePath = path.join(uploadDir, filename);
      fs.unlink(filePath, () => {});
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete media item error:', error);
    res.status(500).json({ error: 'Failed to delete media item' });
  }
}
