/**
 * SweetAlert2 wrapper — confirms, toasts, formulaires modaux.
 *
 * Requiert que sweetalert2 soit chargé via CDN dans la page parent :
 *   <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
 *
 * Si Swal absent → fallback sur prompts/alerts natifs (avec console.error).
 *
 * API :
 *   confirmDanger({ title, text, confirmText? }) → Promise<boolean>
 *   confirmInfo({ title, text }) → Promise<boolean>
 *   toastSuccess(msg) | toastError(msg) | toastInfo(msg)
 *   modalForm({ title, body, confirmText?, preConfirm }) → Promise<SweetAlertResult>
 */

const Swal = window.Swal;

if (!Swal) console.error('[ecommerce admin] SweetAlert2 non chargé. Ajouter <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>');

const COMMON = {
  reverseButtons: true,
  confirmButtonText: 'OK',
  cancelButtonText: 'Annuler',
  customClass: { popup: 'ecommerce-swal' },
};

export async function confirmDanger({ title = 'Confirmer la suppression', text = '', confirmText = 'Supprimer', icon = 'warning' } = {}) {
  if (!Swal) return confirm(text || title);
  const r = await Swal.fire({
    ...COMMON,
    title, text, icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    confirmButtonColor: '#dc3545',
  });
  return r.isConfirmed;
}

export async function confirmInfo({ title = 'Êtes-vous sûr ?', text = '', confirmText = 'OK' } = {}) {
  if (!Swal) return confirm(text || title);
  const r = await Swal.fire({
    ...COMMON,
    title, text, icon: 'question',
    showCancelButton: true,
    confirmButtonText: confirmText,
  });
  return r.isConfirmed;
}

/**
 * Modal de formulaire. Le body peut être un HTMLElement (typiquement
 * View.getElement()). preConfirm est appelé au clic sur Enregistrer ;
 * il doit retourner les données validées (ou false avec showValidationMessage).
 */
export async function modalForm({ title, body, confirmText = 'Enregistrer', size = 'md', preConfirm = null } = {}) {
  if (!Swal) {
    console.error('Swal absent, formulaire non-modal indisponible');
    return { isConfirmed: false };
  }
  const widthMap = { sm: '480px', md: '640px', lg: '880px' };
  return Swal.fire({
    ...COMMON,
    title,
    html: body,
    width: widthMap[size] || size,
    showCancelButton: true,
    confirmButtonText: confirmText,
    focusConfirm: false,
    showLoaderOnConfirm: true,
    allowOutsideClick: () => !Swal.isLoading(),
    preConfirm: preConfirm ? async () => {
      try { return await preConfirm(); }
      catch (err) { Swal.showValidationMessage(err?.message || 'Erreur'); return false; }
    } : undefined,
    didRender: () => {
      // Empêche le focus auto sur le bouton Confirmer pour laisser le 1er input prendre le focus.
      const first = Swal.getHtmlContainer()?.querySelector('input, select, textarea');
      if (first) first.focus();
    },
  });
}

// ── Toasts ─────────────────────────────────────────────────────────────────
const Toast = Swal ? Swal.mixin({
  toast: true, position: 'top-end',
  showConfirmButton: false, timer: 3500, timerProgressBar: true,
  customClass: { popup: 'ecommerce-swal' },
  didOpen: (t) => { t.onmouseenter = Swal.stopTimer; t.onmouseleave = Swal.resumeTimer; },
}) : null;

export const toastSuccess = (msg) => Toast ? Toast.fire({ icon: 'success', title: msg }) : null;
export const toastError   = (msg) => Toast ? Toast.fire({ icon: 'error',   title: msg, timer: 5000 }) : null;
export const toastInfo    = (msg) => Toast ? Toast.fire({ icon: 'info',    title: msg }) : null;

/** Wrap async handler avec toast d'erreur automatique. */
export function withErrorToast(fn, fallbackMsg = 'Erreur inattendue') {
  return async (...args) => {
    try { return await fn(...args); }
    catch (err) { console.error(err); toastError(err?.message || fallbackMsg); }
  };
}
