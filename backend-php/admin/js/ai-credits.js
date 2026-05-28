// ========== AI CREDITS ==========

// Mutable state
window._aiKeyRevealed = false;

async function renderAiCredits() {
  showLoading();
  try {
    const [overview, apiKeyInfo, perUser, perModel, entries, usageLog] = await Promise.all([
      apiFetch('/ai-credits'),
      apiFetch('/ai-credits/api-key'),
      apiFetch('/ai-credits/per-user'),
      apiFetch('/ai-credits/per-model'),
      apiFetch('/ai-credits/entries'),
      apiFetch('/ai-credits/usage'),
    ]);

    hideLoading();

    const availColor = overview.available > 1 ? 'var(--success, #28a745)' : overview.available > 0 ? 'var(--warning, #ffc107)' : 'var(--danger, #dc3545)';

    const perUserRows = perUser.map(u => `
      <tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td style="text-align:center">${u.request_count}</td>
        <td style="text-align:right">${Number(u.total_input_tokens).toLocaleString()}</td>
        <td style="text-align:right">${Number(u.total_output_tokens).toLocaleString()}</td>
        <td style="text-align:right;font-weight:600">${Math.round(Number(u.total_credits_used) * 100).toLocaleString('fr-FR')} crédits</td>
      </tr>
    `).join('');

    const perModelRows = perModel.map(m => {
      const totalTokens = Number(m.total_input_tokens) + Number(m.total_output_tokens);
      return `
      <tr>
        <td><span class="badge badge-${m.model === 'sonnet' ? 'primary' : 'secondary'}">${m.model}</span></td>
        <td style="text-align:center">${m.request_count}</td>
        <td style="text-align:right">${Number(m.total_input_tokens).toLocaleString()}</td>
        <td style="text-align:right">${Number(m.total_output_tokens).toLocaleString()}</td>
        <td style="text-align:right">${totalTokens.toLocaleString()}</td>
        <td style="text-align:right;font-weight:600">${Math.round(Number(m.total_credits_used) * 100).toLocaleString('fr-FR')} crédits</td>
      </tr>
    `;
    }).join('');

    const entryRows = entries.map(e => `
      <tr>
        <td>${new Date(e.created_at).toLocaleDateString('fr-FR')}</td>
        <td><span class="badge ${e.source === 'manual' ? 'badge-primary' : 'badge-success'}">${e.source === 'manual' ? 'Manuel' : 'Auto'}</span></td>
        <td style="text-align:right;font-weight:600">${Math.round(Number(e.credits) * 100).toLocaleString('fr-FR')} crédits</td>
        <td>${e.note || '—'}</td>
        <td>${e.added_by_name || 'Système'}</td>
        <td>
          ${e.source === 'manual' ? `<button class="btn btn-sm btn-danger" onclick="deleteAiCredit(${e.id})">Supprimer</button>` : ''}
        </td>
      </tr>
    `).join('');

    const usageRows = (usageLog.data || []).map(u => `
      <tr>
        <td>${new Date(u.created_at).toLocaleString('fr-FR')}</td>
        <td>${u.user_name}</td>
        <td><span class="badge badge-${u.model === 'sonnet' ? 'primary' : 'secondary'}">${u.model}</span></td>
        <td style="text-align:right">${Number(u.input_tokens).toLocaleString()}</td>
        <td style="text-align:right">${Number(u.output_tokens).toLocaleString()}</td>
        <td style="text-align:right;font-weight:600">${(Number(u.credits_used) * 100).toFixed(2)} crédits</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(u.prompt_summary || '')}">${escapeHtml(u.prompt_summary || '—')}</td>
      </tr>
    `).join('');

    return `
      <div class="page-header">
        <h1>Crédits IA</h1>

      </div>

      <div class="stats-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:24px">
        <div class="stat-card">
          <div class="label">Disponible</div>
          <div class="value" style="color:${availColor}">${Math.round(overview.available * 100).toLocaleString('fr-FR')} crédits</div>
        </div>
        <div class="stat-card">
          <div class="label">Utilisé ce mois</div>
          <div class="value">${Math.round(overview.total_used * 100).toLocaleString('fr-FR')} crédits</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="ai-credits-tabs" style="display:flex;gap:8px;margin-bottom:20px">
        <button class="btn btn-primary ai-tab active" data-tab="config">Configuration</button>
        <button class="btn ai-tab" data-tab="models">Consommation par modèle</button>
        <button class="btn ai-tab" data-tab="users">Consommation par utilisateur</button>
        <button class="btn ai-tab" data-tab="history">Historique</button>
        <button class="btn ai-tab" data-tab="entries">Crédits ajoutés</button>
      </div>

      <!-- Tab: Configuration -->
      <div class="ai-tab-content" id="tab-config">
        <div class="card ai-config-card">
          <div class="ai-config-section">
            <div class="ai-config-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              <h3>Génération IA</h3>
            </div>
            <div class="ai-input-row" style="align-items:center;gap:14px">
              <label class="toggle-switch" style="display:inline-flex;align-items:center;gap:10px;cursor:pointer">
                <input type="checkbox" id="aiEnabledToggle" ${overview.enabled !== false ? 'checked' : ''} onchange="toggleAiEnabled(this.checked)" />
                <span id="aiEnabledLabel" style="font-weight:600">${overview.enabled !== false ? 'IA activée' : 'IA désactivée'}</span>
              </label>
              <span class="ai-hint" style="margin:0;color:var(--gray-500)">Désactive temporairement la génération IA pour tous les utilisateurs.</span>
            </div>
          </div>

          <div class="ai-config-divider"></div>

          <div class="ai-config-section">
            <div class="ai-config-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <h3>Clé API Anthropic</h3>
            </div>
            <div class="ai-input-row">
              <div class="ai-input-group" style="flex:1">
                <input type="password" id="aiApiKeyInput" class="form-input" placeholder="sk-ant-api03-..." />
              </div>
              <button class="btn ai-btn-icon" onclick="toggleApiKeyVisibility()" title="Afficher/masquer la saisie">
                <svg id="aiKeyEyeIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="btn btn-primary" onclick="saveAiApiKey()">Sauvegarder</button>
            </div>
            ${apiKeyInfo.has_key
              ? `<div class="ai-key-status ai-key-status--ok">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span id="aiKeyDisplay">${apiKeyInfo.masked}</span>
                  <button class="ai-reveal-btn" id="aiRevealBtn" onclick="revealAiApiKey()">Révéler</button>
                </div>`
              : '<div class="ai-key-status ai-key-status--warn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Aucune clé configurée</div>'}
          </div>

          <div class="ai-config-divider"></div>

          <div class="ai-config-section">
            <div class="ai-config-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <h3>Crédits mensuels</h3>
            </div>
            <div class="ai-input-row">
              <div class="ai-input-group ai-input-euro">
                <input type="number" id="aiMonthlyCreditsInput" class="form-input" step="0.01" min="0" value="${overview.monthly_credits}" />
              </div>
              <button class="btn btn-primary" onclick="saveAiMonthlyCredits()">Sauvegarder</button>
            </div>
            <p class="ai-hint">Montant rechargé automatiquement le 1er de chaque mois. 1 € = 100 crédits.</p>
          </div>

          <div class="ai-config-divider"></div>

          <div class="ai-config-section">
            <div class="ai-config-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              <h3>Ajouter des crédits</h3>
            </div>
            <div class="ai-input-row ai-add-credits-row">
              <div class="ai-input-group ai-input-euro" style="flex:0 0 160px">
                <label class="form-label">Montant</label>
                <input type="number" id="aiAddCreditsAmount" class="form-input" step="0.01" min="0.01" placeholder="5.00" />
              </div>
              <div class="ai-input-group" style="flex:1">
                <label class="form-label">Note <span style="font-weight:400;color:var(--gray-400)">(optionnel)</span></label>
                <input type="text" id="aiAddCreditsNote" class="form-input" placeholder="Raison de l'ajout..." />
              </div>
              <button class="btn btn-primary ai-add-btn" onclick="addAiCredits()">
                Ajouter
              </button>
            </div>
            <p class="ai-hint">1 € = 100 crédits.</p>
          </div>
        </div>
      </div>

      <!-- Tab: Per-model usage -->
      <div class="ai-tab-content" id="tab-models" style="display:none">
        <div class="card" style="padding:20px">
          ${perModel.length === 0 ? '<p style="color:var(--gray-500)">Aucune utilisation ce mois-ci</p>' : `
          <table class="ai-table">
            <thead>
              <tr>
                <th>Modèle</th><th style="text-align:center">Requêtes</th>
                <th style="text-align:right">Tokens entrée</th><th style="text-align:right">Tokens sortie</th>
                <th style="text-align:right">Total tokens</th>
                <th style="text-align:right">Crédits</th>
              </tr>
            </thead>
            <tbody>${perModelRows}</tbody>
          </table>
          `}
        </div>
      </div>

      <!-- Tab: Per-user usage -->
      <div class="ai-tab-content" id="tab-users" style="display:none">
        <div class="card" style="padding:20px">
          ${perUser.length === 0 ? '<p style="color:var(--gray-500)">Aucune utilisation ce mois-ci</p>' : `
          <table class="ai-table">
            <thead>
              <tr>
                <th>Utilisateur</th><th>Email</th><th style="text-align:center">Requêtes</th>
                <th style="text-align:right">Tokens entrée</th><th style="text-align:right">Tokens sortie</th>
                <th style="text-align:right">Crédits</th>
              </tr>
            </thead>
            <tbody>${perUserRows}</tbody>
          </table>
          `}
        </div>
      </div>

      <!-- Tab: History -->
      <div class="ai-tab-content" id="tab-history" style="display:none">
        <div class="card" style="padding:20px">
          ${(usageLog.data || []).length === 0 ? '<p style="color:var(--gray-500)">Aucun historique</p>' : `
          <table class="ai-table">
            <thead>
              <tr>
                <th>Date</th><th>Utilisateur</th><th>Modèle</th>
                <th style="text-align:right">Input</th><th style="text-align:right">Output</th>
                <th style="text-align:right">Crédits</th><th>Prompt</th>
              </tr>
            </thead>
            <tbody>${usageRows}</tbody>
          </table>
          ${usageLog.pages > 1 ? `<div style="margin-top:12px;text-align:center">${renderAiPagination(usageLog.page, usageLog.pages)}</div>` : ''}
          `}
        </div>
      </div>

      <!-- Tab: Credit entries -->
      <div class="ai-tab-content" id="tab-entries" style="display:none">
        <div class="card" style="padding:20px">
          ${entries.length === 0 ? '<p style="color:var(--gray-500)">Aucun crédit ajouté ce mois-ci</p>' : `
          <table class="ai-table">
            <thead>
              <tr>
                <th>Date</th><th>Type</th><th style="text-align:right">Crédits</th>
                <th>Note</th><th>Ajouté par</th><th></th>
              </tr>
            </thead>
            <tbody>${entryRows}</tbody>
          </table>
          `}
        </div>
      </div>

    `;
  } catch (error) {
    hideLoading();
    return `<div class="card" style="padding:20px"><p style="color:var(--danger)">Erreur : ${error.message}</p></div>`;
  }
}

function renderAiPagination(current, total) {
  let html = '';
  for (let i = 1; i <= total; i++) {
    html += `<button class="btn ${i === current ? 'btn-primary' : ''}" style="margin:0 2px;min-width:36px" onclick="loadAiUsagePage(${i})">${i}</button>`;
  }
  return html;
}

function attachAiCreditsEvents() {
  document.querySelectorAll('.ai-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.ai-tab-content').forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).style.display = 'block';
    });
  });
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('aiApiKeyInput');
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function revealAiApiKey() {
  const display = document.getElementById('aiKeyDisplay');
  const btn = document.getElementById('aiRevealBtn');
  if (window._aiKeyRevealed) {
    // Re-mask
    try {
      const data = await apiFetch('/ai-credits/api-key');
      display.textContent = data.masked;
      btn.textContent = 'Révéler';
      window._aiKeyRevealed = false;
    } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
    return;
  }
  try {
    btn.textContent = '...';
    const data = await apiFetch('/ai-credits/api-key?reveal=1');
    if (data.plain) {
      display.textContent = data.plain;
      btn.textContent = 'Masquer';
      window._aiKeyRevealed = true;
    }
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); btn.textContent = 'Révéler'; }
}

async function toggleAiEnabled(enabled) {
  const label = document.getElementById('aiEnabledLabel');
  try {
    await apiFetch('/ai-credits/enabled', { method: 'PUT', body: JSON.stringify({ enabled }) });
    window.aiEnabled = !!enabled;
    if (label) label.textContent = enabled ? 'IA activée' : 'IA désactivée';
    showToast(enabled ? 'Génération IA activée' : 'Génération IA désactivée', 'success');
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
    const toggle = document.getElementById('aiEnabledToggle');
    if (toggle) toggle.checked = !enabled;
  }
}

async function saveAiApiKey() {
  const apiKey = document.getElementById('aiApiKeyInput').value.trim();
  if (!apiKey) return showToast('Saisissez une clé API', 'error');
  try {
    await apiFetch('/ai-credits/api-key', { method: 'PUT', body: JSON.stringify({ api_key: apiKey }) });
    showToast('Clé API sauvegardée', 'success');
    document.getElementById('content').innerHTML = await renderAiCredits();
    attachAiCreditsEvents();
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function saveAiCreditLimit() {
  const limit = parseFloat(document.getElementById('aiCreditLimitInput').value) || 0;
  try {
    await apiFetch('/ai-credits/limit', { method: 'PUT', body: JSON.stringify({ limit }) });
    showToast('Limite mise à jour', 'success');
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function saveAiMonthlyCredits() {
  const amount = parseFloat(document.getElementById('aiMonthlyCreditsInput').value) || 0;
  try {
    await apiFetch('/ai-credits/monthly-credits', { method: 'PUT', body: JSON.stringify({ amount }) });
    showToast('Crédits mensuels mis à jour', 'success');
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function addAiCredits() {
  const credits = parseFloat(document.getElementById('aiAddCreditsAmount').value);
  const note = document.getElementById('aiAddCreditsNote').value.trim();
  if (!credits || credits <= 0) return showToast('Montant invalide', 'error');
  try {
    await apiFetch('/ai-credits', { method: 'POST', body: JSON.stringify({ credits, note }) });
    showToast('Crédits ajoutés', 'success');
    document.getElementById('content').innerHTML = await renderAiCredits();
    attachAiCreditsEvents();
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function deleteAiCredit(id) {
  if (!confirm('Supprimer ce crédit ?')) return;
  try {
    await apiFetch(`/ai-credits/${id}`, { method: 'DELETE' });
    showToast('Crédit supprimé', 'success');
    document.getElementById('content').innerHTML = await renderAiCredits();
    attachAiCreditsEvents();
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function loadAiUsagePage(page) {
  // Reload just the history tab with pagination
  try {
    const usageLog = await apiFetch(`/ai-credits/usage?page=${page}`);
    const rows = (usageLog.data || []).map(u => `
      <tr>
        <td>${new Date(u.created_at).toLocaleString('fr-FR')}</td>
        <td>${u.user_name}</td>
        <td><span class="badge badge-${u.model === 'sonnet' ? 'primary' : 'secondary'}">${u.model}</span></td>
        <td style="text-align:right">${Number(u.input_tokens).toLocaleString()}</td>
        <td style="text-align:right">${Number(u.output_tokens).toLocaleString()}</td>
        <td style="text-align:right;font-weight:600">${(Number(u.credits_used) * 100).toFixed(2)} crédits</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(u.prompt_summary || '')}">${escapeHtml(u.prompt_summary || '—')}</td>
      </tr>
    `).join('');

    const tabHistory = document.getElementById('tab-history');
    tabHistory.querySelector('.card').innerHTML = `
      <table class="ai-table">
        <thead><tr><th>Date</th><th>Utilisateur</th><th>Modèle</th><th style="text-align:right">Input</th><th style="text-align:right">Output</th><th style="text-align:right">Coût</th><th>Prompt</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${usageLog.pages > 1 ? `<div style="margin-top:12px;text-align:center">${renderAiPagination(usageLog.page, usageLog.pages)}</div>` : ''}
    `;
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
}

// Expose all on window
Object.assign(window, {
  renderAiCredits,
  renderAiPagination,
  attachAiCreditsEvents,
  toggleApiKeyVisibility,
  revealAiApiKey,
  toggleAiEnabled,
  saveAiApiKey,
  saveAiCreditLimit,
  saveAiMonthlyCredits,
  addAiCredits,
  deleteAiCredit,
  loadAiUsagePage,
});
