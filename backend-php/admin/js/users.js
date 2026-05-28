// ── Users module ─────────────────────────────────────────────────
// Extracted from app.js – user CRUD and permissions table.

async function renderUsers() {
  showLoading();
  try {
    const users = await apiFetch('/users');
    hideLoading();

    return `
      <div class="page-header">
        <h1>Utilisateurs</h1>
        <button class="btn btn-primary" onclick="showUserForm()">
          <span class="icon">➕</span>
          Nouvel utilisateur
        </button>
      </div>

      <div class="card">
        ${users.length > 0 ? renderUsersTable(users) : renderEmptyState('👥', 'Aucun utilisateur', 'Créez votre premier utilisateur')}
      </div>

      <div class="card" style="margin-top:24px">
        <h3 style="margin-bottom:16px">Permissions par rôle</h3>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="border-bottom:2px solid var(--border-color,#e5e7eb);text-align:left">
                <th style="padding:8px 12px">Fonctionnalité</th>
                <th style="padding:8px 12px;text-align:center"><span class="badge badge-primary">Super admin</span></th>
                <th style="padding:8px 12px;text-align:center"><span class="badge badge-info">Admin site</span></th>
                <th style="padding:8px 12px;text-align:center"><span class="badge badge-warning">Éditeur</span></th>
                <th style="padding:8px 12px;text-align:center"><span class="badge badge-muted">Lecteur</span></th>
              </tr>
            </thead>
            <tbody>
              ${[
                ['Tableau de bord', true, true, true, true],
                ['Pages / Articles / CPT', true, true, true, false],
                ['Médiathèque', true, true, true, false],
                ['Blocs réutilisables', true, true, true, false],
                ['Menus', true, true, false, false],
                ['Paramètres du site', true, true, false, false],
                ['Formulaires', true, true, false, false],
                ['Thème', true, true, false, false],
                ['Rebuild', true, true, false, false],
                ['Utilisateurs', true, false, false, false],
                ['Plugins', true, false, false, false],
                ['Crédits IA', true, false, false, false],
              ].map(([label, ...perms]) =>
                '<tr style="border-bottom:1px solid var(--border-color,#e5e7eb)">'
                + '<td style="padding:8px 12px;font-weight:500">' + label + '</td>'
                + perms.map(ok => '<td style="padding:8px 12px;text-align:center">' + (ok ? '<span style="color:var(--success,#22c55e)">✓</span>' : '<span style="color:var(--danger,#ef4444);opacity:.4">✗</span>') + '</td>').join('')
                + '</tr>'
              ).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div id="userModal" style="display: none;"></div>
    `;
  } catch (error) {
    hideLoading();
    showToast('Erreur lors du chargement des utilisateurs', 'error');
    return '<div class="card"><p>Erreur de chargement</p></div>';
  }
}

function renderUsersTable(users) {
  const _roleLabels = { super_admin: 'Super admin', admin_site: 'Admin site', editor: 'Éditeur', reader: 'Lecteur', admin: 'Super admin' };
  const _roleBadges = { super_admin: 'badge-primary', admin_site: 'badge-info', editor: 'badge-warning', reader: 'badge-muted', admin: 'badge-primary' };
  const _roleAvatars = { super_admin: 'user-avatar--admin', admin_site: 'user-avatar--admin', editor: 'user-avatar--editor', reader: 'user-avatar--editor' };
  const roleLabel = r => _roleLabels[r] || r;
  const roleBadge = r => _roleBadges[r] || 'badge-secondary';
  const avatarClass = r => _roleAvatars[r] || 'user-avatar--editor';
  const getInitials = name => name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  return `
    <div class="pages-list">
      <div class="pages-list-header">
        <span style="width:36px;flex-shrink:0"></span>
        <span class="page-item__info">Utilisateur</span>
        <span class="page-item__meta">Créé le</span>
        <span class="page-item__badges">Rôle</span>
        <span class="page-item__actions" style="opacity:1">Actions</span>
      </div>
      ${users.map(user => {
        const safeName = escapeHtml(user.name).replace(/'/g, "\\'");
        const dateStr = new Date(user.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        return '<div class="page-item">'
          + '<div class="user-avatar ' + avatarClass(user.role) + '">' + getInitials(user.name) + '</div>'
          + '<div class="page-item__info" style="cursor:pointer" onclick="showUserForm(' + user.id + ')">'
          +   '<div class="page-item__title">' + escapeHtml(user.name) + (user.id === currentUser.id ? ' <span class="badge badge-info" style="font-size:10px">Vous</span>' : '') + '</div>'
          +   '<div class="page-item__slug">' + escapeHtml(user.email) + (user.username ? ' · @' + escapeHtml(user.username) : '') + '</div>'
          + '</div>'
          + '<div class="page-item__meta"><span class="page-item__date">' + dateStr + '</span></div>'
          + '<div class="page-item__badges"><span class="badge ' + roleBadge(user.role) + '">' + roleLabel(user.role) + '</span></div>'
          + '<div class="page-item__actions">'
          +   '<button class="btn-icon-action" onclick="showUserForm(' + user.id + ')" title="Modifier">' + _svgEdit + '</button>'
          +   (user.id !== currentUser.id ? '<button class="btn-icon-action btn-icon-action--danger" onclick="deleteUser(' + user.id + ', \'' + safeName + '\')" title="Supprimer">' + _svgDelete + '</button>' : '')
          + '</div>'
        + '</div>';
      }).join('')}
    </div>
  `;
}

async function showUserForm(userId = null) {
  showLoading();

  let user = null;
  if (userId) {
    const users = await apiFetch('/users');
    user = users.find(u => u.id === userId);
  }

  hideLoading();

  const modal = document.getElementById('userModal');
  modal.style.display = 'block';
  modal.innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;" onclick="if(event.target===this)closeModal()">
      <div class="card" style="max-width:480px;width:90%;max-height:90vh;overflow-y:auto;" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
          <h2>${userId ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</h2>
          <button class="btn btn-outline btn-sm" onclick="closeModal()">✕</button>
        </div>
        <form onsubmit="saveUser(event, ${userId || 'null'})">
          <div class="form-group">
            <label class="form-label">Nom *</label>
            <input type="text" class="form-input" id="userName" value="${user?.name || ''}" required placeholder="Nom complet">
          </div>
          <div class="form-group">
            <label class="form-label">Nom d'utilisateur</label>
            <input type="text" class="form-input" id="userUsername" value="${user?.username || ''}" placeholder="ex : mon-pseudo">
          </div>
          <div class="form-group">
            <label class="form-label">Email *</label>
            <input type="email" class="form-input" id="userEmail" value="${user?.email || ''}" required placeholder="email@exemple.com">
          </div>
          <div class="form-group">
            <label class="form-label">Role *</label>
            <select class="form-input" id="userRole">
              <option value="reader" ${user?.role === 'reader' ? 'selected' : ''}>Lecteur</option>
              <option value="editor" ${!user || user.role === 'editor' ? 'selected' : ''}>Éditeur</option>
              <option value="admin_site" ${user?.role === 'admin_site' ? 'selected' : ''}>Admin site</option>
              <option value="super_admin" ${user?.role === 'super_admin' ? 'selected' : ''}>Super administrateur</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">${userId ? 'Nouveau mot de passe (vide = inchange)' : 'Mot de passe *'}</label>
            <input type="password" class="form-input" id="userPassword" ${userId ? '' : 'required'} placeholder="${userId ? 'Laisser vide pour ne pas modifier' : 'Mot de passe'}">
          </div>
          <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px;">
            <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary">${userId ? 'Mettre a jour' : 'Creer'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function saveUser(e, userId) {
  e.preventDefault();
  const name = document.getElementById('userName').value.trim();
  const username = document.getElementById('userUsername').value.trim();
  const email = document.getElementById('userEmail').value.trim();
  const role = document.getElementById('userRole').value;
  const password = document.getElementById('userPassword').value;

  const data = { name, username, email, role };
  if (password) data.password = password;

  showLoading();
  try {
    if (userId) {
      await apiFetch(`/users/${userId}`, { method: 'PUT', body: JSON.stringify(data) });
      showToast('Utilisateur mis a jour', 'success');
    } else {
      await apiFetch('/users', { method: 'POST', body: JSON.stringify(data) });
      showToast('Utilisateur cree', 'success');
    }
    closeModal();
    document.getElementById('content').innerHTML = await renderUsers();
  } catch (error) {
    showToast('Erreur : ' + error.message, 'error');
  }
  hideLoading();
}

async function deleteUser(userId, name) {
  const ok = await confirmModal(`Voulez-vous vraiment supprimer l'utilisateur "${name}" ?`);
  if (!ok) return;
  try {
    await apiFetch(`/users/${userId}`, { method: 'DELETE' });
    showToast('Utilisateur supprime', 'success');
    document.getElementById('content').innerHTML = await renderUsers();
  } catch (error) {
    showToast('Erreur : ' + error.message, 'error');
  }
}

Object.assign(window, {
  renderUsers,
  renderUsersTable,
  showUserForm,
  saveUser,
  deleteUser,
});
