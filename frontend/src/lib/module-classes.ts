/**
 * Construit les classes CSS du wrapper `.module` à partir des champs bruts
 * stockés dans le bloc (padding_top, padding_bottom, bloc_color, bg_img, etc.).
 *
 * Reproduit la logique du View Composer PHP (nickl) et du buildTemplateContext
 * côté admin.
 */
/**
 * Nettoie le HTML généré par Quill (WYSIWYG).
 * Quill encode tous les espaces en &nbsp; ce qui empêche le retour à la ligne.
 * Reproduit le comportement du template Blade PHP :
 * str_replace(['&nbsp;', "\xC2\xA0"], ' ', $text)
 */
export function cleanHtml(html: string | undefined | null): string {
  if (!html) return '';
  let s = String(html).replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');
  // Strip Quill default-color spans: <span style="background-color: rgb(255, 255, 255); color: rgb(...);">text</span> → text
  // Also handles <strong style="..."> keeping the tag but removing the style
  s = s.replace(/ style="background-color: rgb\(255, 255, 255\);[^"]*"/g, '');
  // Remove empty <span> wrappers left behind (no attributes)
  s = s.replace(/<span>(.*?)<\/span>/g, '$1');
  return s;
}

export function buildModuleClasses(data: Record<string, any>): string {
  const parts: string[] = [];

  // Couleur de fond
  const bgColor = data.bloc_color || data.background || '';
  if (bgColor) parts.push(bgColor);

  // Padding haut / bas
  const paddingTop = data.padding_top || '';
  const paddingBottom = data.padding_bottom || '';
  if (paddingTop) parts.push(paddingTop);
  if (paddingBottom) parts.push(paddingBottom);

  // Image de fond
  const bgImg = data.bg_img || data.backgroundImage;
  if (bgImg && (typeof bgImg === 'string' ? bgImg : bgImg?.url)) {
    parts.push('has-background-image');
    const parallax = data.bg_parallax === true || data.bg_parallax === 1 || data.bg_parallax === '1';
    if (parallax) parts.push('background-parallax');
  }

  // Pleine largeur
  if (isTruthy(data.is_fullscreen)) {
    parts.push('full-width');
  }

  // Style (gallery, etc.)
  if (data.style_choice) {
    parts.push(data.style_choice);
  }

  // Classes supplémentaires déjà présentes dans data.classes
  const existing = data.classes || '';
  if (existing) parts.push(existing);

  return parts.filter(Boolean).join(' ');
}

/** Vérifie si une valeur ACF true/false est truthy (true, 1, '1') */
export function isTruthy(val: unknown): boolean {
  return val === true || val === 1 || val === '1';
}

/**
 * Résout l'URL d'une image de fond + opacité depuis les champs BlockParams.
 * Reproduit la logique du Composer PHP : bg_img + bg_opacity/100.
 */
export function resolveBackgroundImage(
  data: Record<string, any>,
  apiOrigin: string
): { url: string; opacity: number } | null {
  const bgImg = data.bg_img as any;
  if (!bgImg) return null;

  const rawUrl = typeof bgImg === 'string' ? bgImg : bgImg?.url || bgImg?.sizes?.banner || '';
  if (!rawUrl) return null;

  let url = rawUrl.startsWith('http') ? rawUrl : apiOrigin + rawUrl;

  // Optimize background images to WebP
  const match = url.match(/\/uploads\/media\/([^/?#]+)$/);
  if (match && !/\.(mp4|webm|mov|avi)$/i.test(match[1])) {
    url = `/uploads/media/_optimized/${match[1]}?w=1920&q=75&f=webp`;
  }

  const rawOpacity = data.bg_opacity;
  const opacityPercent =
    rawOpacity === undefined || rawOpacity === null || rawOpacity === ''
      ? 10
      : Number(rawOpacity);
  const opacity = Number.isNaN(opacityPercent) ? 10 : opacityPercent;

  return { url, opacity };
}

/**
 * Résout les données de titre de bloc depuis les champs BlockParams.
 * Reproduit @include('components.bloc-title-module').
 */
export function resolveBlocTitle(data: Record<string, any>): {
  title: string;
  style: string | number;
  align: string;
} | null {
  const title = (data.title_bloc as string) || (data.title as string) || '';
  if (!title) return null;
  const rawStyle = data.title_style;
  const style = rawStyle != null && rawStyle !== ''
    ? String(rawStyle).replace(/^h/i, '')
    : '4';
  return {
    title,
    style,
    align: (data.title_align as string) || 'center',
  };
}

/**
 * Normalise un champ Link ACF (string ou objet {url, title, target}).
 */
export function resolveLink(
  raw: unknown
): { url: string; title: string; target: string } | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    return { url: raw, title: raw, target: '_self' };
  }
  const obj = raw as Record<string, any>;
  if (!obj.url) return null;
  return {
    url: obj.url,
    title: obj.title || 'En savoir plus',
    target: obj.target || '_self',
  };
}
