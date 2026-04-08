import { defineMiddleware } from 'astro:middleware';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

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

  // Serve /uploads/media/_optimized/ — try disk cache first, proxy to backend for Sharp processing if not cached
  if (pathname.startsWith('/uploads/media/_optimized/')) {
    const filename = pathname.replace('/uploads/media/_optimized/', '');
    const params = new URLSearchParams(search);
    const w = params.get('w') || '1200';
    const q = params.get('q') || '80';
    const f = params.get('f') || 'webp';
    const baseName = path.parse(filename).name;
    const cacheKey = `${baseName}_${w}_${q}.${f}`;
    const cachePath = path.join(uploadsDir, 'media/_optimized', cacheKey);

    // Serve from disk cache if available (avoids Sharp processing + HTTP proxy)
    const resp = serveFile(cachePath);
    if (resp) return resp;

    // Not cached — proxy to backend for Sharp processing
    try {
      const backendUrl = `${BACKEND_URL}${pathname}${search}`;
      const backendResp = await fetch(backendUrl);
      if (backendResp.ok) {
        const headers = new Headers();
        const ct = backendResp.headers.get('content-type');
        if (ct) headers.set('content-type', ct);
        headers.set('cache-control', 'public, max-age=31536000, immutable');
        return new Response(backendResp.body, { status: 200, headers });
      }
    } catch {}
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
