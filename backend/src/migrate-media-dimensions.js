/**
 * Migration script: backfill width/height for existing media items.
 * Usage: node src/migrate-media-dimensions.js
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import imageSize from 'image-size';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../uploads/media');

function getImageDimensions(filePath) {
  try {
    const result = imageSize(filePath);
    return { width: result.width || null, height: result.height || null };
  } catch {
    return { width: null, height: null };
  }
}

function getVideoDimensions(filePath) {
  return new Promise((resolve) => {
    execFile('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'json',
      filePath
    ], { timeout: 15000 }, (err, stdout) => {
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

async function migrate() {
  // Ensure columns exist (catch if already present)
  await pool.query(`ALTER TABLE media_items ADD COLUMN width INT NULL AFTER size`).catch(() => {});
  await pool.query(`ALTER TABLE media_items ADD COLUMN height INT NULL AFTER width`).catch(() => {});

  const [rows] = await pool.query('SELECT id, type, filename FROM media_items WHERE width IS NULL OR height IS NULL');
  console.log(`Found ${rows.length} media items to process...`);

  let updated = 0;
  for (const row of rows) {
    const filePath = path.join(uploadDir, row.filename);
    const dims = row.type === 'image'
      ? getImageDimensions(filePath)
      : await getVideoDimensions(filePath);

    if (dims.width && dims.height) {
      await pool.query('UPDATE media_items SET width = ?, height = ? WHERE id = ?', [dims.width, dims.height, row.id]);
      console.log(`  ✅ ${row.filename} → ${dims.width}x${dims.height}`);
      updated++;
    } else {
      console.log(`  ⚠️  ${row.filename} → dimensions not found`);
    }
  }

  console.log(`\nDone: ${updated}/${rows.length} items updated.`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
