/**
 * MediaPicker — délègue au picker média natif du SPA admin parent.
 *
 * Le SPA admin (backend-php/admin/app.js) expose `window.openExternalMediaPicker`
 * qui ouvre la médiathèque complète (navigation par dossiers, filtres,
 * pagination via /media?all=1). Notre iframe l'appelle via `window.parent`.
 *
 * Fallback si le parent n'expose pas la fonction (ex: page chargée hors SPA) :
 * affiche un message d'erreur — pas de fallback Swal pour rester cohérent
 * avec la médiathèque CMS unique.
 *
 * Usage :
 *   const media = await pickMedia({ type: 'image' });
 *   if (media) input.value = media.url;
 */

export function pickMedia({ type = 'image' } = {}) {
  return new Promise((resolve) => {
    const opener = window.parent && typeof window.parent.openExternalMediaPicker === 'function'
      ? window.parent.openExternalMediaPicker
      : null;

    if (!opener) {
      console.error('[ecommerce] window.parent.openExternalMediaPicker introuvable. Cette page doit être chargée dans le SPA admin.');
      resolve(null);
      return;
    }

    opener((item) => resolve(item || null), type);
  });
}

// API rétro-compat : invalidate inutile (le parent gère son propre cache).
export function invalidateMediaCache() { /* no-op */ }
