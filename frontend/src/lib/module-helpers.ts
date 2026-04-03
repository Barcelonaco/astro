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
  // Use 900px for standard container images; banner/hero sizes use explicit widths
  return optimizedImageUrl(rawUrl, 900, 80);
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

/**
 * Generates a srcset string with multiple widths for responsive images.
 * Returns empty string if the URL is not a local upload.
 */
export function responsiveSrcset(
  url: string,
  widths: number[] = [400, 600, 900],
  quality: number = 75,
  format: 'webp' | 'avif' = 'webp'
): string {
  if (!url) return '';
  const match = url.match(/\/uploads\/media\/([^/?#]+)$/);
  if (!match) return '';
  const filename = match[1];
  if (/\.(mp4|webm|mov|avi|svg)$/i.test(filename)) return '';
  return widths
    .map(w => `/uploads/media/_optimized/${filename}?w=${w}&q=${quality}&f=${format} ${w}w`)
    .join(', ');
}

/** Récupère l'alt text d'une image ACF */
export function resolveImageAlt(img: unknown): string {
  if (!img || typeof img === 'string') return '';
  return (img as Record<string, any>).alt || '';
}

/** Récupère le titre d'une image */
export function resolveImageTitle(img: unknown): string {
  if (!img || typeof img === 'string') return '';
  return (img as Record<string, any>).title || '';
}

/** Récupère la légende d'une image */
export function resolveImageCaption(img: unknown): string {
  if (!img || typeof img === 'string') return '';
  return (img as Record<string, any>).caption || '';
}

/** Récupère les dimensions d'une image */
export function resolveImageDimensions(img: unknown): { width?: number; height?: number } {
  if (!img || typeof img === 'string') return {};
  const obj = img as Record<string, any>;
  return {
    width: obj.width || undefined,
    height: obj.height || undefined
  };
}

/**
 * Génère les attributs HTML d'une image à partir d'un objet image ACF.
 * Retourne un objet avec src, alt, title, width, height, loading, decoding.
 */
export function resolveImageAttrs(
  img: unknown,
  apiOrigin: string,
  preferredSize?: string,
  eager: boolean = false
): Record<string, string | number | undefined> {
  const src = resolveImageUrl(img, apiOrigin, preferredSize);
  const alt = resolveImageAlt(img);
  const title = resolveImageTitle(img);
  const dims = resolveImageDimensions(img);
  return {
    src,
    alt,
    ...(title ? { title } : {}),
    ...(dims.width ? { width: dims.width } : {}),
    ...(dims.height ? { height: dims.height } : {}),
    loading: eager ? 'eager' : 'lazy',
    decoding: 'async'
  };
}
