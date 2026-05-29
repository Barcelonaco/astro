// ── Admin Settings module (super_admin only) ────────────────────────
// SMTP configuration — overrides Resend when enabled and fields filled.

async function renderAdminSettings() {
  showLoading();
  try {
    const smtp = await apiFetch('/admin-settings/smtp');
    hideLoading();

    const enabled = smtp.smtp_enabled === '1';
    const host = smtp.smtp_host || '';
    const port = smtp.smtp_port || '587';
    const username = smtp.smtp_username || '';
    const fromEmail = smtp.smtp_from_email || '';
    const fromName = smtp.smtp_from_name || '';
    const encryption = smtp.smtp_encryption || 'tls';
    const passwordSet = smtp.smtp_password_set || false;
    const passwordMasked = smtp.smtp_password_masked || '';

    return `
      <div class="settings-page">
        <div class="page-header">
          <h1>Parametres admin</h1>
        </div>

        <div class="card">
          <div class="settings-tabs" id="adminSettingsTabs">
            <button type="button" class="settings-tab is-active" data-target="#admin-settings-smtp">Serveur SMTP</button>
          </div>

          <form id="smtpForm" onsubmit="saveSmtpSettings(event)">
            <div class="settings-section is-active" id="admin-settings-smtp">

              <p class="form-hint" style="margin-bottom:20px">
                Configurez un serveur SMTP pour envoyer les emails. Lorsque le SMTP est actif et correctement configure, il remplace Resend pour tous les envois d'emails.
              </p>

              <div class="form-group">
                <div class="toggle-field" style="display:flex;align-items:center;gap:10px">
                  <label class="toggle-switch">
                    <input type="checkbox" name="smtp_enabled" ${enabled ? 'checked' : ''} onchange="toggleSmtpFields()">
                    <span class="toggle-slider"></span>
                  </label>
                  <span class="toggle-label">Activer le serveur SMTP</span>
                </div>
              </div>

              <div id="smtpFields" style="${enabled ? '' : 'opacity:0.4;pointer-events:none;'}transition:opacity 0.2s">
                <div class="form-row" style="grid-template-columns:2fr 1fr">
                  <div class="form-group">
                    <label class="form-label">Serveur SMTP</label>
                    <input type="text" class="form-input" name="smtp_host" value="${escapeHtml(host)}" placeholder="smtp.gmail.com">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Port</label>
                    <input type="number" class="form-input" name="smtp_port" value="${escapeHtml(port)}" placeholder="587">
                  </div>
                </div>

                <div class="form-group" style="max-width:280px">
                  <label class="form-label">Chiffrement</label>
                  <select class="form-select" name="smtp_encryption">
                    <option value="tls" ${encryption === 'tls' ? 'selected' : ''}>TLS (STARTTLS)</option>
                    <option value="ssl" ${encryption === 'ssl' ? 'selected' : ''}>SSL</option>
                    <option value="none" ${encryption === 'none' ? 'selected' : ''}>Aucun</option>
                  </select>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Identifiant (username)</label>
                    <input type="text" class="form-input" name="smtp_username" value="${escapeHtml(username)}" placeholder="user@gmail.com" autocomplete="off">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Mot de passe${passwordSet ? ' <span style="color:var(--success,#22c55e);font-size:12px;font-weight:400">&#10003; configure</span>' : ''}</label>
                    <input type="password" class="form-input" name="smtp_password" value="" placeholder="${passwordSet ? passwordMasked : 'Mot de passe SMTP'}" autocomplete="new-password">
                    <p class="form-hint">Laissez vide pour conserver le mot de passe actuel.</p>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Email expediteur</label>
                    <input type="email" class="form-input" name="smtp_from_email" value="${escapeHtml(fromEmail)}" placeholder="noreply@monsite.fr">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Nom expediteur</label>
                    <input type="text" class="form-input" name="smtp_from_name" value="${escapeHtml(fromName)}" placeholder="Mon Site">
                  </div>
                </div>
              </div>

              <div style="display:flex;gap:12px;align-items:stretch;margin-top:8px;padding-top:20px;border-top:1px solid var(--gray-200)">
                <button type="submit" class="btn btn-primary">Enregistrer</button>
                <button type="button" class="btn btn-outline" onclick="testSmtpConnection()" id="btnTestSmtp" ${enabled ? '' : 'disabled'}>
                  Envoyer un email de test
                </button>
              </div>

            </div>
          </form>
        </div>
      </div>
    `;
  } catch (e) {
    hideLoading();
    console.error('renderAdminSettings error:', e);
    return '<div class="settings-page"><div class="page-header"><h1>Parametres admin</h1></div><div class="card"><p class="form-hint">Erreur de chargement.</p></div></div>';
  }
}

function attachAdminSettingsTabs() {
  const tabs = document.querySelectorAll('#adminSettingsTabs .settings-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      const target = tab.dataset.target;
      document.querySelectorAll('#smtpForm .settings-section').forEach(s => {
        s.classList.toggle('is-active', '#' + s.id === target);
      });
    });
  });
}

function toggleSmtpFields() {
  const enabled = document.querySelector('input[name="smtp_enabled"]').checked;
  const fields = document.getElementById('smtpFields');
  const testBtn = document.getElementById('btnTestSmtp');
  if (fields) {
    fields.style.opacity = enabled ? '1' : '0.4';
    fields.style.pointerEvents = enabled ? '' : 'none';
  }
  if (testBtn) testBtn.disabled = !enabled;
}

async function saveSmtpSettings(e) {
  e.preventDefault();
  const form = document.getElementById('smtpForm');
  const data = {};

  data.smtp_enabled = form.querySelector('[name="smtp_enabled"]').checked ? '1' : '0';
  data.smtp_host = form.querySelector('[name="smtp_host"]').value.trim();
  data.smtp_port = form.querySelector('[name="smtp_port"]').value.trim();
  data.smtp_username = form.querySelector('[name="smtp_username"]').value.trim();
  data.smtp_from_email = form.querySelector('[name="smtp_from_email"]').value.trim();
  data.smtp_from_name = form.querySelector('[name="smtp_from_name"]').value.trim();
  data.smtp_encryption = form.querySelector('[name="smtp_encryption"]').value;

  const password = form.querySelector('[name="smtp_password"]').value;
  if (password) data.smtp_password = password;

  try {
    await apiFetch('/admin-settings/smtp', { method: 'PUT', body: JSON.stringify(data) });
    showToast('Parametres SMTP enregistres', 'success');
  } catch (err) {
    showToast('Erreur : ' + (err.message || 'sauvegarde impossible'), 'error');
  }
}

async function testSmtpConnection() {
  const email = prompt('Adresse email pour le test :');
  if (!email) return;

  const btn = document.getElementById('btnTestSmtp');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Envoi en cours...';

  try {
    // Sauvegarder d'abord les settings actuels
    const form = document.getElementById('smtpForm');
    const saveData = {};
    saveData.smtp_enabled = form.querySelector('[name="smtp_enabled"]').checked ? '1' : '0';
    saveData.smtp_host = form.querySelector('[name="smtp_host"]').value.trim();
    saveData.smtp_port = form.querySelector('[name="smtp_port"]').value.trim();
    saveData.smtp_username = form.querySelector('[name="smtp_username"]').value.trim();
    saveData.smtp_from_email = form.querySelector('[name="smtp_from_email"]').value.trim();
    saveData.smtp_from_name = form.querySelector('[name="smtp_from_name"]').value.trim();
    saveData.smtp_encryption = form.querySelector('[name="smtp_encryption"]').value;
    const password = form.querySelector('[name="smtp_password"]').value;
    if (password) saveData.smtp_password = password;

    await apiFetch('/admin-settings/smtp', { method: 'PUT', body: JSON.stringify(saveData) });

    const res = await apiFetch('/admin-settings/smtp/test', {
      method: 'POST',
      body: JSON.stringify({ to: email }),
    });
    showToast(res.message || 'Email de test envoye', 'success');
  } catch (err) {
    showToast('Echec : ' + (err.message || 'erreur inconnue'), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

Object.assign(window, {
  renderAdminSettings,
  attachAdminSettingsTabs,
  toggleSmtpFields,
  saveSmtpSettings,
  testSmtpConnection,
});
