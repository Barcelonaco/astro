import { defineMiddleware } from 'astro:middleware';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';

const BACKEND_URL = (import.meta.env.BUILD_API_URL || import.meta.env.PUBLIC_API_URL)?.replace('/api', '') || 'http://localhost:3000';

// Resolve filesystem paths relative to the project root
const rootDir = path.resolve(new URL('.', import.meta.url).pathname, '../../..');
const uploadsDir = path.join(rootDir, 'backend/uploads');
const nicklPublicDir = path.join(rootDir, 'nickl/public');

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

const COMPRESSIBLE = new Set(['text/html', 'text/css', 'application/javascript', 'application/json', 'image/svg+xml']);

function serveFile(filePath: string): Response | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    return new Response(buffer, {
      status: 200,
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=86400',
      },
    });
  } catch {
    return null;
  }
}

function shouldCompress(contentType: string | null): boolean {
  if (!contentType) return false;
  const base = contentType.split(';')[0].trim();
  return COMPRESSIBLE.has(base);
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;

  // During prerendering, request.headers is not available
  const isPrerendered = context.isPrerendered;
  const acceptEncoding = isPrerendered ? '' : context.request.headers.get('accept-encoding') || '';
  const supportsGzip = acceptEncoding.includes('gzip');

  // Serve /nickl-assets/ directly from nickl/public/
  if (pathname.startsWith('/nickl-assets/')) {
    const relativePath = pathname.replace('/nickl-assets/', '');
    const filePath = path.join(nicklPublicDir, relativePath);
    const resp = serveFile(filePath);
    if (resp) return resp;
  }

  // Serve /uploads/media/_optimized/ — try disk cache first, process with Sharp if not cached
  if (pathname.startsWith('/uploads/media/_optimized/')) {
    const filename = pathname.replace('/uploads/media/_optimized/', '');
    const params = new URLSearchParams(search);
    const w = Math.min(parseInt(params.get('w') || '1200', 10) || 1200, 2400);
    const q = Math.min(parseInt(params.get('q') || '80', 10) || 80, 100);
    const f = (params.get('f') === 'avif' ? 'avif' : 'webp') as 'webp' | 'avif';
    const baseName = path.parse(filename).name;
    const cacheKey = `${baseName}_${w}_${q}.${f}`;
    const cacheDir = path.join(uploadsDir, 'media/_optimized');
    const cachePath = path.join(cacheDir, cacheKey);

    // Serve from disk cache if available
    const resp = serveFile(cachePath);
    if (resp) return resp;

    // Not cached — process with Sharp (much better quality than GD)
    const originalPath = path.join(uploadsDir, 'media', filename);
    if (fs.existsSync(originalPath)) {
      try {
        const ext = path.extname(filename).toLowerCase();
        // SVGs: serve as-is
        if (ext === '.svg') {
          return serveFile(originalPath) || new Response(null, { status: 404 });
        }
        // Videos: serve as-is
        if (['.mp4', '.webm', '.mov', '.avi'].includes(ext)) {
          return serveFile(originalPath) || new Response(null, { status: 404 });
        }

        let pipeline = sharp(originalPath).resize(w, undefined, {
          withoutEnlargement: true,
          fit: 'inside',
        });

        if (f === 'avif') {
          pipeline = pipeline.avif({ quality: q, effort: 4 });
        } else {
          pipeline = pipeline.webp({ quality: q, effort: 4, smartSubsample: true });
        }

        const buffer = await pipeline.toBuffer();

        // Write cache
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(cachePath, buffer);

        return new Response(buffer, {
          status: 200,
          headers: {
            'content-type': `image/${f}`,
            'cache-control': 'public, max-age=31536000, immutable',
          },
        });
      } catch {
        // Fallback: serve original
        const fallback = serveFile(originalPath);
        if (fallback) return fallback;
      }
    }
  }

  // Serve other /uploads/ directly from filesystem
  if (pathname.startsWith('/uploads/')) {
    const relativePath = pathname.replace('/uploads/', '');
    const filePath = path.join(uploadsDir, relativePath);
    const resp = serveFile(filePath);
    if (resp) return resp;
  }

  // For all other requests (HTML pages), apply gzip compression
  const response = await next();

  if (supportsGzip && response.body && shouldCompress(response.headers.get('content-type'))) {
    const body = await response.arrayBuffer();
    const compressed = gzipSync(Buffer.from(body), { level: 9 });
    const headers = new Headers(response.headers);
    headers.set('content-encoding', 'gzip');
    headers.delete('content-length');
    return new Response(compressed, {
      status: response.status,
      headers,
    });
  }

  return response;
});
