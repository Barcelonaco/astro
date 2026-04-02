/**
 * Utilitaires partagés pour les composants de modules Nickl.
 * Remplace les helpers PHP GlobalHelper::getVideoID, etc.
 */

/** Extrait l'ID YouTube depuis une URL (watch?v=, youtu.be/, embed/) */
export function extractYouTubeId(url: string): string {
  if (!url) return '';
  const m =
    url.match(/[?&]v=([^&#]+)/) ||
    url.match(/youtu\.be\/([^?&#]+)/) ||
    url.match(/embed\/([^?&#]+)/);
  return m ? m[1] : '';
}

/** Extrait l'ID Vimeo depuis une URL (vimeo.com/123456) */
export function extractVimeoId(url: string): string {
  if (!url) return '';
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : '';
}

/** Extrait l'ID Dailymotion depuis une URL (dailymotion.com/video/xxx) */
export function extractDailymotionId(url: string): string {
  if (!url) return '';
  const m = url.match(/dailymotion\.com\/video\/([^_?&#]+)/);
  return m ? m[1] : '';
}

/**
 * Résout l'URL d'une image ACF.
 * Accepte un objet {url, sizes: {banner, ...}} ou une string.
 */
export function resolveImageUrl(
  img: unknown,
  apiOrigin: string,
  preferredSize?: string
): string {
  if (!img) return '';
  let rawUrl = '';
  if (typeof img === 'string') {
    rawUrl = img.startsWith('http') ? img : apiOrigin + img;
  } else {
    const obj = img as Record<string, any>;
    if (preferredSize && obj.sizes?.[preferredSize]) {
      rawUrl = obj.sizes[preferredSize];
    } else {
      rawUrl = obj.url || obj.sizes?.banner || '';
    }
    if (!rawUrl) return '';
    rawUrl = rawUrl.startsWith('http') ? rawUrl : apiOrigin + rawUrl;
  }
  // Auto-optimize local uploads to WebP
  return optimizedImageUrl(rawUrl, 1200, 80);
}

/**
 * Génère une URL d'image optimisée (WebP, redimensionnée).
 * Ex: /uploads/media/photo.jpg → /uploads/media/_optimized/photo.jpg?w=800&q=80&f=webp
 */
export function optimizedImageUrl(
  url: string,
  width: number = 1200,
  quality: number = 80,
  format: 'webp' | 'avif' = 'webp'
): string {
  if (!url) return '';
  // Only optimize local uploads
  const match = url.match(/\/uploads\/media\/([^/?#]+)$/);
  if (!match) return url;
  const filename = match[1];
  // Skip video files and SVGs (SVGs are already resolution-independent)
  if (/\.(mp4|webm|mov|avi|svg)$/i.test(filename)) return url;
  return `/uploads/media/_optimized/${filename}?w=${width}&q=${quality}&f=${format}`;
}

/** Récupère l'alt text d'une image ACF */
export function resolveImageAlt(img: unknown): string {
  if (!img || typeof img === 'string') return '';
  return (img as Record<string, any>).alt || '';
}
