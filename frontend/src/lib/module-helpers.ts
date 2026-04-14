/**
 * Utilitaires partagés pour les composants de modules Nickl.
 * Remplace les helpers PHP GlobalHelper::getVideoID, etc.
 */

// ---------------------------------------------------------------------------
// Image presets — qualité et tailles adaptées par contexte de module
// ---------------------------------------------------------------------------

export interface ImagePreset {
  /** Largeur de l'image principale (px) */
  width: number;
  /** Qualité de compression (0-100) */
  quality: number;
  /** Format de sortie */
  format: 'webp' | 'avif';
  /** Largeurs pour le srcset responsive */
  srcsetWidths: number[];
  /** Qualité pour le srcset (peut être légèrement inférieure) */
  srcsetQuality: number;
}

/**
 * Presets d'images par contexte de module.
 * - hero/banner : qualité maximale, grandes tailles (pleine largeur, impact visuel)
 * - feature : haute qualité pour les images principales de modules (text-image, gallery 1col, video poster)
 * - card : qualité intermédiaire pour les vignettes (news slider, references, clickable tiles)
 * - thumbnail : qualité réduite pour les petits formats (gallery grid, team, contact)
 * - icon : minimum pour les logos, icônes, ornements
 */
export const IMAGE_PRESETS: Record<string, ImagePreset> = {
  hero: {
    width: 1920,
    quality: 88,
    format: 'webp',
    srcsetWidths: [600, 960, 1440, 1920],
    srcsetQuality: 85,
  },
  banner: {
    width: 1440,
    quality: 85,
    format: 'webp',
    srcsetWidths: [600, 900, 1440],
    srcsetQuality: 82,
  },
  feature: {
    width: 1050,
    quality: 82,
    format: 'webp',
    srcsetWidths: [500, 750, 1050],
    srcsetQuality: 80,
  },
  card: {
    width: 700,
    quality: 80,
    format: 'webp',
    srcsetWidths: [350, 500, 700],
    srcsetQuality: 78,
  },
  thumbnail: {
    width: 500,
    quality: 78,
    format: 'webp',
    srcsetWidths: [250, 350, 500],
    srcsetQuality: 75,
  },
  icon: {
    width: 220,
    quality: 80,
    format: 'webp',
    srcsetWidths: [110, 220],
    srcsetQuality: 78,
  },
};

/**
 * Mapping module-type → preset name.
 * Permet à chaque bloc d'obtenir automatiquement le bon preset.
 */
export const MODULE_PRESET_MAP: Record<string, string> = {
  // Hero & Banners — pleine largeur, qualité maximale
  'hero': 'hero',
  'banner': 'banner',
  'images-slider': 'banner',
  'images-videos-parallax': 'banner',
  'slider-text-video': 'banner',
  // Feature — images principales de module
  'text-image': 'feature',
  'illus-video': 'feature',
  'video': 'feature',
  'quote': 'feature',
  'contact': 'feature',
  'ornament': 'feature',
  // Card — vignettes moyennes
  'news-slider': 'card',
  'events-slider': 'card',
  'bloc-references': 'card',
  'clickable-tiles': 'card',
  'free-post': 'card',
  'product': 'card',
  // Thumbnail — petits formats, grilles
  'gallery': 'thumbnail',
  'team': 'thumbnail',
  'key-figures': 'thumbnail',
  // Icon — logos, petits éléments
  'logos-slider': 'icon',
  'icons': 'icon',
};

/** Retourne le preset d'image pour un type de module donné */
export function getImagePreset(moduleType: string): ImagePreset {
  const presetName = MODULE_PRESET_MAP[moduleType] || 'card';
  return IMAGE_PRESETS[presetName] || IMAGE_PRESETS.card;
}

/** Retourne un preset par nom direct */
export function getPreset(name: string): ImagePreset {
  return IMAGE_PRESETS[name] || IMAGE_PRESETS.card;
}

// ---------------------------------------------------------------------------

/** URL de l'image de remplacement du site (settings.replacement_image) */
let _defaultImageUrl = '';

/** Définit l'URL de l'image par défaut du site (à appeler au chargement de chaque page) */
export function setDefaultImageUrl(url: string): void {
  _defaultImageUrl = url || '';
}

/** Retourne l'URL de l'image par défaut du site */
export function getDefaultImageUrl(): string {
  return _defaultImageUrl;
}

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
 * @param preset - Nom du preset ('hero', 'banner', 'feature', 'card', 'thumbnail', 'icon')
 *                 pour adapter automatiquement largeur et qualité au contexte du module.
 */
export function resolveImageUrl(
  img: unknown,
  apiOrigin: string,
  preferredSize?: string,
  preset?: string
): string {
  const p = preset ? getPreset(preset) : null;
  const defaultW = p ? p.width : 900;
  const defaultQ = p ? p.quality : 82;
  if (!img) return _defaultImageUrl ? optimizedImageUrl(_defaultImageUrl, defaultW, defaultQ) : '';
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
    if (!rawUrl) return _defaultImageUrl ? optimizedImageUrl(_defaultImageUrl, defaultW, defaultQ) : '';
    rawUrl = rawUrl.startsWith('http') ? rawUrl : apiOrigin + rawUrl;
  }
  // Use preset dimensions or fallback to size-based heuristic
  const SMALL_SIZES = ['thumbnail', 'icon', 'module-logo'];
  const optWidth = p ? p.width : (preferredSize && SMALL_SIZES.includes(preferredSize) ? 220 : 900);
  const optQuality = p ? p.quality : 82;
  return optimizedImageUrl(rawUrl, optWidth, optQuality);
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

/**
 * Generates a srcset string from an image preset.
 * Convenience wrapper around responsiveSrcset using preset values.
 */
export function presetSrcset(
  url: string,
  preset: string
): string {
  const p = getPreset(preset);
  return responsiveSrcset(url, p.srcsetWidths, p.srcsetQuality, p.format);
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
