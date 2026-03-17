import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import apiRoutes from './routes/api.js';
import { migratePluginTables } from './controllers/customPostTypeController.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(compression());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:4321',
    process.env.ADMIN_URL || 'http://localhost:3000'
  ]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Optimized image route: /uploads/media/_optimized/{filename}?w=800&q=80&f=webp
const optimizedCacheDir = path.join(__dirname, '../uploads/media/_optimized');
if (!fs.existsSync(optimizedCacheDir)) fs.mkdirSync(optimizedCacheDir, { recursive: true });

app.get('/uploads/media/_optimized/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const w = Math.min(parseInt(req.query.w) || 1200, 2400);
    const q = Math.min(parseInt(req.query.q) || 80, 100);
    const format = req.query.f === 'avif' ? 'avif' : 'webp';

    const originalPath = path.join(__dirname, '../uploads/media', filename);
    if (!fs.existsSync(originalPath)) return res.status(404).end();

    const cacheKey = `${path.parse(filename).name}_${w}_${q}.${format}`;
    const cachePath = path.join(optimizedCacheDir, cacheKey);

    // Serve from cache if exists
    if (fs.existsSync(cachePath)) {
      res.set('Content-Type', `image/${format}`);
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      return fs.createReadStream(cachePath).pipe(res);
    }

    // Generate optimized version
    const pipeline = sharp(originalPath).resize({ width: w, withoutEnlargement: true });
    if (format === 'avif') pipeline.avif({ quality: q });
    else pipeline.webp({ quality: q });

    const buffer = await pipeline.toBuffer();
    // Write cache in background
    fs.writeFile(cachePath, buffer, () => {});

    res.set('Content-Type', `image/${format}`);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buffer);
  } catch (err) {
    // Fallback to original
    const originalPath = path.join(__dirname, '../uploads/media', req.params.filename);
    if (fs.existsSync(originalPath)) return res.sendFile(originalPath);
    res.status(500).end();
  }
});

// Static files (for uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '7d',
  immutable: false,
}));

// Nickl public assets (module CSS, images)
app.use('/nickl-assets', express.static(path.join(__dirname, '../../nickl/public'), {
  maxAge: '30d',
}));

// Plugin assets (CSS, images, etc.)
app.use('/plugin-assets', express.static(path.join(__dirname, '../../plugins')));

// Serve admin interface
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

// API routes
app.use('/api', apiRoutes);

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/admin/login.html');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Migrate plugin tables before starting
migratePluginTables().catch(err => console.warn('⚠️  Plugin migration:', err.message));

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║                                          ║
║   🚀 CMS Server Started Successfully    ║
║                                          ║
║   📍 API: http://localhost:${PORT}/api       ║
║   🎨 Admin: http://localhost:${PORT}/admin   ║
║                                          ║
║   📚 API Endpoints:                      ║
║   - GET  /api/posts                      ║
║   - GET  /api/posts/:slug                ║
║   - POST /api/posts (auth)               ║
║   - GET  /api/categories                 ║
║   - POST /api/auth/login                 ║
║                                          ║
╚══════════════════════════════════════════╝
  `);
});

export default app;
