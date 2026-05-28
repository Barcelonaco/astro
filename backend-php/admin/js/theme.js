// ═══════════════════════════════════════════════════════════════════════════
// theme.js — Admin themes, CSS variables, theme settings page
// ═══════════════════════════════════════════════════════════════════════════

async function applyAdminTheme(useChildTheme, activeTheme) {
  const root = document.documentElement;
  if (!useChildTheme) {
    root.style.removeProperty('--primary');
    root.style.removeProperty('--primary-dark');
    root.removeAttribute('data-admin-theme');
    const oldLink = document.getElementById('child-theme-admin-css');
    if (oldLink) oldLink.remove();
    return;
  }
  let theme = ADMIN_THEMES[activeTheme];
  if (!theme) {
    try {
      const res = await fetch(`/themes/${activeTheme}/theme.json`);
      if (res.ok) {
        const manifest = await res.json();
        if (manifest.colors) {
          theme = { primary: manifest.colors.accent, primaryDark: manifest.colors.accentDark, dark: false };
        }
      }
    } catch {}
  }
  const existingLink = document.getElementById('child-theme-admin-css');
  if (existingLink) existingLink.remove();
  const cssUrl = `/themes/${activeTheme}/admin.css`;
  try {
    const cssCheck = await fetch(cssUrl, { method: 'HEAD' });
    if (cssCheck.ok) {
      const link = document.createElement('link');
      link.id = 'child-theme-admin-css';
      link.rel = 'stylesheet';
      link.href = cssUrl;
      document.head.appendChild(link);
    }
  } catch {}

  if (!theme) return;
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--primary-dark', theme.primaryDark);
  if (theme.dark) {
    root.setAttribute('data-admin-theme', 'dark');
  } else {
    root.removeAttribute('data-admin-theme');
  }
}

async function loadAdminTheme() {
  try {
    const res = await fetch(`${API_BASE}/settings/theme`);
    if (!res.ok) return;
    const data = await res.json();
    applyAdminTheme(data.useChildTheme, data.activeTheme || 'default');
  } catch (e) {}
}

// --- Theme settings page ---

async function renderTheme() {
  showLoading();
  try {
    const [settings, themeOptions] = await Promise.all([
      apiFetch('/settings'),
      apiFetch('/themes'),
    ]);
    const useChildTheme = settings.theme_use_child === '1';
    const activeTheme = settings.active_theme || 'default';

    hideLoading();

    return `
      <div class="page-header">
        <h1>Thème</h1>
      </div>

      <div class="card">
        <p class="form-help" style="margin-bottom: 24px;">
          Le <strong>thème de base</strong> s'applique à tout le site. Vous pouvez activer un <strong>thème enfant</strong> pour ajouter une couche de personnalisation (couleurs, style) par-dessus le thème de base.
        </p>

        <form id="themeForm" onsubmit="saveTheme(event)">
          <div class="form-group">
            <div class="toggle-field" style="display:flex;align-items:center;gap:10px;"><label class="toggle-switch"><input type="checkbox" id="themeUseChild" name="theme_use_child" ${useChildTheme ? 'checked' : ''}><span class="toggle-slider"></span></label><span class="toggle-label">Activer un thème enfant</span></div>
            <div class="form-help">Quand activé, le thème enfant sélectionné ci-dessous sera appliqué en plus du thème de base.</div>
          </div>

          <div class="form-group" id="themeChildGroup">
            <label class="form-label">Thème enfant</label>
            <select class="form-select" id="activeTheme" name="active_theme">
              ${themeOptions.map(t => `
                <option value="${t.id}" ${activeTheme === t.id ? 'selected' : ''}>${t.name}</option>
              `).join('')}
            </select>
            <div class="form-help">Choisissez le thème qui sera appliqué en surcouche.</div>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
            <button type="submit" class="btn btn-primary">
              Enregistrer le thème
            </button>
          </div>
        </form>
      </div>
    `;
  } catch (error) {
    hideLoading();
    showToast('Erreur lors du chargement des paramètres thème', 'error');
    return `<div class="card"><p style="color: var(--danger)">Erreur: ${error.message}</p></div>`;
  }
}

async function saveTheme(event) {
  event.preventDefault();
  const form = document.getElementById('themeForm');
  const formData = new FormData(form);
  const useChild = document.getElementById('themeUseChild').checked;

  const data = {
    theme_use_child: useChild ? '1' : '0',
    active_theme: formData.get('active_theme') || 'default'
  };

  showLoading();
  try {
    await apiFetch('/settings', { method: 'PUT', body: JSON.stringify(data) });
    hideLoading();
    showToast('Thème enregistré', 'success');
    applyAdminTheme(data.theme_use_child === '1', data.active_theme);
    loadSection('theme');
  } catch (error) {
    hideLoading();
    showToast('Erreur: ' + error.message, 'error');
  }
}

// --- Expose on window ---
Object.assign(window, {
  applyAdminTheme, loadAdminTheme, renderTheme, saveTheme,
});
