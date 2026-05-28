// dashboard.js — Dashboard rendering
// Extracted from app.js (lines 500-549)

async function renderDashboard() {
  showLoading();
  try {
    const fetches = [apiFetch('/pages')];
    if (hasMinRole('super_admin')) {
      fetches.push(apiFetch('/ai-credits').catch(() => null));
    }
    const [pages, aiCredits] = await Promise.all(fetches);

    hideLoading();

    let aiHtml = '';
    if (aiCredits) {
      const pct = aiCredits.total_credits > 0
        ? Math.round((aiCredits.available / aiCredits.total_credits) * 100)
        : 0;
      const barColor = aiCredits.available > 1 ? 'var(--success, #22c55e)' : aiCredits.available > 0.2 ? 'var(--warning, #f59e0b)' : 'var(--danger, #ef4444)';
      aiHtml = `
        <div class="stat-card" style="cursor:pointer" onclick="navigateTo('ai-credits')" title="Gérer les crédits IA">
          <div class="label">Crédits IA disponibles</div>
          <div class="value" style="color:${barColor}">${Math.round(aiCredits.available * 100).toLocaleString('fr-FR')} crédits</div>
          <div style="margin-top:8px;background:var(--border-color,#e5e7eb);border-radius:6px;height:8px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${barColor};border-radius:6px;transition:width .3s"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:12px;color:var(--text-muted,#6b7280)">
            <span>Utilisé ce mois : ${Math.round(aiCredits.total_used * 100).toLocaleString('fr-FR')} crédits</span>
            <span>Alloué : ${Math.round(aiCredits.total_credits * 100).toLocaleString('fr-FR')} crédits</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="page-header">
        <h1>Tableau de bord</h1>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Pages</div>
          <div class="value">${pages.length}</div>
        </div>
        ${aiHtml}
      </div>
    `;
  } catch (error) {
    hideLoading();
    return `<div class="card"><p style="color: var(--danger)">Erreur: ${error.message}</p></div>`;
  }
}

Object.assign(window, {
  renderDashboard,
});
