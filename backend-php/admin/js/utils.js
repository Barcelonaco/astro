// ═══════════════════════════════════════════════════════════════════════════
// utils.js — Pure utility functions (no domain logic)
// ═══════════════════════════════════════════════════════════════════════════

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let size = Number(bytes);
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[idx]}`;
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function closeModal() {
  const pageModal = document.getElementById('pageModal');
  const userModal = document.getElementById('userModal');
  if (pageModal) pageModal.style.display = 'none';
  if (userModal) userModal.style.display = 'none';
}

function renderEmptyState(icon, title, subtitle) {
  return `
    <div class="empty-state">
      <div class="icon">${icon}</div>
      <h3>${title}</h3>
      <p>${subtitle}</p>
    </div>
  `;
}

async function apiFetch(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

async function apiUpload(endpoint, formData) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return response.json();
}

function showLoading(text = '') {
  const overlay = document.getElementById('loadingOverlay');
  const textEl = document.getElementById('loadingText');
  if (textEl) textEl.textContent = text;

  clearTimeout(window._loadingDelayTimer);
  window._loadingDelayTimer = setTimeout(() => {
    overlay.classList.add('show');
  }, 300);

  clearTimeout(window._loadingTimer);
  if (!text) {
    window._loadingTimer = setTimeout(() => {
      if (textEl && overlay.classList.contains('show')) {
        textEl.textContent = 'Publication en cours…';
      }
    }, 2000);
  }
}

function hideLoading() {
  clearTimeout(window._loadingTimer);
  clearTimeout(window._loadingDelayTimer);
  window._loadingTimer = null;
  window._loadingDelayTimer = null;
  const overlay = document.getElementById('loadingOverlay');
  const textEl = document.getElementById('loadingText');
  if (textEl) textEl.textContent = '';
  overlay.classList.remove('show');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function replaceEmptyImages(html) {
  if (!html) return html;
  html = html.replace(/<img\b[^>]*\bsrc=["']\s*["'][^>]*>/gi, _noImagePlaceholderHtml);
  html = html.replace(/<img\b[^>]*\bsrc=["'](?:undefined|null)["'][^>]*>/gi, _noImagePlaceholderHtml);
  html = html.replace(/<div class="illus-wrapper[^"]*">\s*<\/div>/gi, '<div class="illus-wrapper">' + _noImagePlaceholderHtml + '</div>');
  return html;
}

function getOptimizedUrl(url, width = 400, quality = 70) {
  if (!url) return url;
  if (url.startsWith('http') || !url.includes('/uploads/media/')) return url;
  const filename = url.split('/').pop();
  if (!filename) return url;
  const ext = filename.split('.').pop().toLowerCase();
  if (['svg', 'gif', 'webp', 'avif'].includes(ext)) return url;
  return `/uploads/media/_optimized/${encodeURIComponent(filename)}?w=${width}&q=${quality}&f=webp`;
}

// --- Modal system ---

function ensureUiModal() {
  if (document.getElementById('uiModal')) return;
  const modal = document.createElement('div');
  modal.id = 'uiModal';
  modal.className = 'ui-modal';
  modal.innerHTML = `
    <div class="ui-modal-backdrop"></div>
    <div class="ui-modal-panel">
      <div class="ui-modal-title" id="uiModalTitle"></div>
      <div class="ui-modal-body" id="uiModalBody"></div>
      <div class="ui-modal-actions" id="uiModalActions"></div>
    </div>
  `;
  document.body.appendChild(modal);
}

function openUiModal({ title, bodyHtml, actions }) {
  ensureUiModal();
  const modal = document.getElementById('uiModal');
  modal.querySelector('#uiModalTitle').textContent = title || '';
  modal.querySelector('#uiModalBody').innerHTML = bodyHtml || '';
  const actionsEl = modal.querySelector('#uiModalActions');
  actionsEl.innerHTML = '';
  actions.forEach((action) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn btn-sm ${action.variant || 'btn-outline'}`;
    btn.textContent = action.label;
    btn.addEventListener('click', () => action.onClick());
    actionsEl.appendChild(btn);
  });
  modal.classList.add('is-open');
}

function closeUiModal() {
  const modal = document.getElementById('uiModal');
  if (modal) modal.classList.remove('is-open');
}

function confirmModal(message, title = 'Confirmation') {
  return new Promise((resolve) => {
    openUiModal({
      title,
      bodyHtml: `<p>${escapeHtml(message)}</p>`,
      actions: [
        { label: 'Annuler', variant: 'btn-outline', onClick: () => { closeUiModal(); resolve(false); } },
        { label: 'Confirmer', variant: 'btn-danger', onClick: () => { closeUiModal(); resolve(true); } }
      ]
    });
  });
}

function promptModal(message, defaultValue = '', title = 'Saisie') {
  return new Promise((resolve) => {
    const inputId = 'uiModalInput';
    openUiModal({
      title,
      bodyHtml: `
        <p>${escapeHtml(message)}</p>
        <input type="text" class="form-input" id="${inputId}" value="${escapeHtml(defaultValue)}">
      `,
      actions: [
        { label: 'Annuler', variant: 'btn-outline', onClick: () => { closeUiModal(); resolve(''); } },
        { label: 'Valider', variant: 'btn-primary', onClick: () => {
          const value = document.getElementById(inputId)?.value?.trim() || '';
          closeUiModal();
          resolve(value);
        } }
      ]
    });
    setTimeout(() => document.getElementById(inputId)?.focus(), 0);
  });
}

// --- Expose on window ---
Object.assign(window, {
  escapeHtml, stripHtml, formatBytes, slugify,
  closeModal, renderEmptyState,
  apiFetch, apiUpload,
  showLoading, hideLoading, showToast,
  replaceEmptyImages, getOptimizedUrl,
  ensureUiModal, openUiModal, closeUiModal, confirmModal, promptModal,
});
