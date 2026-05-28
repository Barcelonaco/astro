// ═══════════════════════════════════════════════════════════════════════════
// auth.js — Authentication, inactivity, logout, profile
// ═══════════════════════════════════════════════════════════════════════════

function hasMinRole(minRole) {
  return (ROLE_LEVELS[currentUser?.role] ?? 0) >= (ROLE_LEVELS[minRole] ?? 99);
}

async function refreshAiCreditsAvailable() {
  try {
    const data = await apiFetch('/ai-credits/available');
    window.aiCreditsAvailable = typeof data?.available === 'number' ? data.available : null;
    window.aiEnabled = data?.enabled !== false;
  } catch (e) {
    window.aiCreditsAvailable = null;
    window.aiEnabled = true;
  }
}

function aiButtonAttrs() {
  if (!aiEnabled) {
    return { disabled: true, title: 'Génération IA temporairement désactivée par un administrateur' };
  }
  if (aiCreditsAvailable !== null && aiCreditsAvailable <= 0) {
    return { disabled: true, title: 'Crédits IA épuisés — rechargez les crédits pour générer' };
  }
  return { disabled: false, title: 'Générer avec l\'IA' };
}

// --- Inactivity auto-logout (1h) ---

function resetInactivityTimer() {
  clearTimeout(window._inactivityTimer);
  window._inactivityTimer = setTimeout(() => {
    localStorage.removeItem('token');
    window.location.href = '/login?reason=inactivity';
  }, INACTIVITY_TIMEOUT);
}

function startInactivityTracker() {
  ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'].forEach(evt =>
    document.addEventListener(evt, resetInactivityTimer, { passive: true })
  );
  resetInactivityTimer();
}

// --- Logout ---

async function logout() {
  const ok = await confirmModal('Voulez-vous vraiment vous déconnecter ?');
  if (!ok) return;
  localStorage.removeItem('token');
  window.location.href = '/login';
}

// --- Clear all caches ---

async function clearAllCaches() {
  Object.keys(moduleTemplateCache).forEach(k => delete moduleTemplateCache[k]);
  window.moduleFieldSchema = null;
  window._layoutToModuleName = null;
  window.siteSettingsCache = null;
  moduleStylesLoaded.clear();
  moduleAdminStylesLoaded.clear();
  document.querySelectorAll('link[data-module-layout], link[data-module-admin-layout]').forEach(el => el.remove());
  await Promise.all([loadModuleFieldSchema(), loadSiteSettings()]);
  const btn = document.getElementById('topBarClearCache');
  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) { icon.className = 'fa-solid fa-check'; setTimeout(() => { icon.className = 'fa-solid fa-broom'; }, 1200); }
  }
  const currentSection = localStorage.getItem('adminLastView') || 'dashboard';
  if (pageBuilderState.editingPageId) {
    openPageBuilder(pageBuilderState.editingPageId);
  } else {
    loadSection(currentSection);
  }
}

// --- Profile ---

async function renderProfile() {
  showLoading();
  try {
    const user = await apiFetch('/auth/me');
    window.currentUser = user;
    hideLoading();

    const _roleLabels = { super_admin: 'Super admin', admin_site: 'Admin site', editor: 'Éditeur', reader: 'Lecteur', admin: 'Super admin' };
    const _roleBadges = { super_admin: 'badge-primary', admin_site: 'badge-info', editor: 'badge-warning', reader: 'badge-muted', admin: 'badge-primary' };

    return `
      <div class="page-header">
        <h1>Mon profil</h1>
        <span class="badge ${_roleBadges[user.role] || 'badge-secondary'}" style="font-size:13px">${_roleLabels[user.role] || user.role}</span>
      </div>

      <div class="card" style="max-width:600px">
        <form onsubmit="saveProfile(event)">
          <div class="form-group">
            <label class="form-label">Nom complet *</label>
            <input type="text" class="form-input" id="profileName" value="${escapeHtml(user.name || '')}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Nom d'utilisateur</label>
            <input type="text" class="form-input" id="profileUsername" value="${escapeHtml(user.username || '')}" placeholder="ex : mon-pseudo">
            <small style="color:var(--text-secondary,#666);font-size:12px;margin-top:4px;display:block">Permet de se connecter avec un identifiant au lieu de l'email</small>
          </div>
          <div class="form-group">
            <label class="form-label">Email *</label>
            <input type="email" class="form-input" id="profileEmail" value="${escapeHtml(user.email || '')}" required>
          </div>

          <hr style="margin:24px 0;border:none;border-top:1px solid var(--border-color,#e5e7eb)">
          <h3 style="margin-bottom:16px">Changer le mot de passe</h3>

          <div class="form-group">
            <label class="form-label">Mot de passe actuel</label>
            <input type="password" class="form-input" id="profileCurrentPassword" placeholder="Requis pour changer le mot de passe" autocomplete="current-password">
          </div>
          <div class="form-group">
            <label class="form-label">Nouveau mot de passe</label>
            <input type="password" class="form-input" id="profileNewPassword" placeholder="Min. 6 caractères" autocomplete="new-password">
          </div>
          <div class="form-group">
            <label class="form-label">Confirmer le nouveau mot de passe</label>
            <input type="password" class="form-input" id="profileConfirmPassword" placeholder="Répéter le nouveau mot de passe" autocomplete="new-password">
          </div>

          <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:24px;">
            <button type="submit" class="btn btn-primary">Enregistrer</button>
          </div>
        </form>
      </div>
    `;
  } catch (error) {
    hideLoading();
    showToast('Erreur lors du chargement du profil', 'error');
    return '<div class="card"><p>Erreur de chargement</p></div>';
  }
}

async function saveProfile(e) {
  e.preventDefault();

  const name = document.getElementById('profileName').value.trim();
  const username = document.getElementById('profileUsername').value.trim();
  const email = document.getElementById('profileEmail').value.trim();
  const currentPassword = document.getElementById('profileCurrentPassword').value;
  const newPassword = document.getElementById('profileNewPassword').value;
  const confirmPassword = document.getElementById('profileConfirmPassword').value;

  if (!name || !email) {
    showToast('Nom et email sont requis', 'error');
    return;
  }

  const data = { name, username, email };

  if (newPassword) {
    if (!currentPassword) {
      showToast('Le mot de passe actuel est requis pour changer le mot de passe', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Le nouveau mot de passe doit contenir au moins 6 caractères', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Les mots de passe ne correspondent pas', 'error');
      return;
    }
    data.current_password = currentPassword;
    data.new_password = newPassword;
  }

  showLoading();
  try {
    const result = await apiFetch('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });

    if (result.token) {
      localStorage.setItem('token', result.token);
      window.token = result.token;
    }
    if (result.user) {
      window.currentUser = result.user;
      document.getElementById('userInfo').textContent = currentUser.name;
      const topBarUser = document.getElementById('topBarUser');
      if (topBarUser) topBarUser.textContent = `Bonjour, ${currentUser.name}`;
    }

    showToast('Profil mis à jour', 'success');
    document.getElementById('content').innerHTML = await renderProfile();
  } catch (error) {
    showToast('Erreur : ' + error.message, 'error');
  }
  hideLoading();
}

// --- Expose on window ---
Object.assign(window, {
  hasMinRole, refreshAiCreditsAvailable, aiButtonAttrs,
  resetInactivityTimer, startInactivityTracker,
  logout, clearAllCaches,
  renderProfile, saveProfile,
});
