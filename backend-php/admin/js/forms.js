// ========== FORMS SYSTEM ==========

const FORM_FIELD_TYPES = [
  { type: 'text', label: 'Texte', icon: '<i class="fa-solid fa-font"></i>' },
  { type: 'email', label: 'Email', icon: '<i class="fa-solid fa-at"></i>' },
  { type: 'phone', label: 'Téléphone', icon: '<i class="fa-solid fa-phone"></i>' },
  { type: 'number', label: 'Nombre', icon: '<i class="fa-solid fa-hashtag"></i>' },
  { type: 'textarea', label: 'Zone de texte', icon: '<i class="fa-solid fa-align-left"></i>' },
  { type: 'select', label: 'Liste déroulante', icon: '<i class="fa-solid fa-chevron-down"></i>' },
  { type: 'radio', label: 'Boutons radio', icon: '<i class="fa-regular fa-circle-dot"></i>' },
  { type: 'checkbox', label: 'Cases à cocher', icon: '<i class="fa-regular fa-square-check"></i>' },
  { type: 'date', label: 'Date', icon: '<i class="fa-regular fa-calendar"></i>' },
  { type: 'time', label: 'Heure', icon: '<i class="fa-regular fa-clock"></i>' },
  { type: 'url', label: 'URL', icon: '<i class="fa-solid fa-link"></i>' },
  { type: 'file', label: 'Fichier', icon: '<i class="fa-solid fa-paperclip"></i>' },
  { type: 'hidden', label: 'Champ caché', icon: '<i class="fa-regular fa-eye-slash"></i>' },
  { type: 'html', label: 'Contenu HTML', icon: '<i class="fa-solid fa-code"></i>' },
  { type: 'name', label: 'Nom complet', icon: '<i class="fa-regular fa-user"></i>' },
];

let _formsCache = [];
let _formsSelected = new Set();
let _formBuilderFields = [];
let _formBuilderSelectedIdx = -1;
let _formBuilderSettings = {};
let _formBuilderData = null;

// Mutable state
window._formEntriesPage = 1;
window._formEntriesFilter = 'all';

// ── Forms List ──

async function renderFormsList() {
  showLoading();
  try {
    _formsCache = await apiFetch('/forms');
    hideLoading();
  } catch (e) {
    hideLoading();
    return `<div class="card"><p>Erreur: ${e.message}</p></div>`;
  }
  _formsSelected = new Set();
  return renderFormsView();
}

function renderFormsView() {
  return `
    <div class="page-header">
      <h1>Formulaires</h1>
      <button class="btn btn-primary" onclick="loadSection('form-edit:new')">+ Nouveau formulaire</button>
    </div>
    ${_formsSelected.size > 0 ? renderFormsBulkBar() : ''}
    <div class="card">
      ${_formsCache.length > 0 ? renderFormsTable() : renderEmptyState('📝', 'Aucun formulaire', 'Créez votre premier formulaire')}
    </div>
  `;
}

function refreshFormsView() {
  const el = document.getElementById('content');
  if (el) el.innerHTML = renderFormsView();
}

function toggleFormSelect(id, checked) {
  if (checked) _formsSelected.add(id);
  else _formsSelected.delete(id);
  refreshFormsView();
}

function toggleAllFormsOnPage(checked, ids) {
  ids.forEach(id => checked ? _formsSelected.add(id) : _formsSelected.delete(id));
  refreshFormsView();
}

function clearFormsSelection() {
  _formsSelected.clear();
  refreshFormsView();
}

function renderFormsBulkBar() {
  const count = _formsSelected.size;
  return `
    <div class="pages-bulk-bar">
      <span class="pages-bulk-bar__count">${count} formulaire${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}</span>
      <div class="pages-bulk-bar__actions">
        <button type="button" class="btn btn-sm btn-outline" onclick="bulkFormsStatus('active')">Activer</button>
        <button type="button" class="btn btn-sm btn-outline" onclick="bulkFormsStatus('inactive')">Désactiver</button>
        <button type="button" class="btn btn-sm btn-outline" onclick="bulkFormsDuplicate()">Dupliquer</button>
        <button type="button" class="btn btn-sm btn-danger" onclick="bulkFormsDelete()">Supprimer</button>
      </div>
      <button type="button" class="pages-bulk-bar__close" onclick="clearFormsSelection()" title="Annuler la sélection">✕</button>
    </div>
  `;
}

async function bulkFormsStatus(status) {
  const ids = [..._formsSelected];
  const label = status === 'active' ? 'activé' : 'désactivé';
  showLoading();
  try {
    await Promise.all(ids.map(id => {
      const source = _formsCache.find(f => f.id === id);
      if (!source) return null;
      return apiFetch(`/forms/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: source.title,
          slug: source.slug,
          description: source.description,
          settings: typeof source.settings === 'string' ? JSON.parse(source.settings) : (source.settings || {}),
          status,
          fields: source.fields,
        }),
      });
    }));
    showToast(`${ids.length} formulaire${ids.length > 1 ? 's' : ''} ${label}${ids.length > 1 ? 's' : ''}`, 'success');
    _formsSelected.clear();
    loadSection('forms');
  } catch (e) {
    hideLoading();
    showToast('Erreur: ' + e.message, 'error');
  }
}

async function bulkFormsDuplicate() {
  const ids = [..._formsSelected];
  showLoading();
  try {
    for (const id of ids) {
      const form = await apiFetch(`/forms/${id}`);
      const newSlug = form.slug + '-copie-' + Date.now().toString(36) + '-' + id;
      await apiFetch('/forms', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title + ' (copie)',
          slug: newSlug,
          description: form.description,
          settings: typeof form.settings === 'string' ? JSON.parse(form.settings) : form.settings,
          status: form.status,
          fields: form.fields,
        }),
      });
    }
    showToast(`${ids.length} formulaire${ids.length > 1 ? 's' : ''} dupliqué${ids.length > 1 ? 's' : ''}`, 'success');
    _formsSelected.clear();
    loadSection('forms');
  } catch (e) {
    hideLoading();
    showToast('Erreur: ' + e.message, 'error');
  }
}

async function bulkFormsDelete() {
  const ids = [..._formsSelected];
  const ok = await confirmModal(`Supprimer ${ids.length} formulaire${ids.length > 1 ? 's' : ''} et toutes leurs entrées ? Cette action est irréversible.`);
  if (!ok) return;
  showLoading();
  try {
    await Promise.all(ids.map(id => apiFetch(`/forms/${id}`, { method: 'DELETE' })));
    showToast(`${ids.length} formulaire${ids.length > 1 ? 's' : ''} supprimé${ids.length > 1 ? 's' : ''}`, 'success');
    _formsSelected.clear();
    loadSection('forms');
  } catch (e) {
    hideLoading();
    showToast('Erreur: ' + e.message, 'error');
  }
}

function renderFormsTable() {
  const gridCols = '40px 1fr 80px 120px 80px 140px';
  const allIds = _formsCache.map(f => f.id);
  const allChecked = allIds.length > 0 && allIds.every(id => _formsSelected.has(id));
  return `
    <div class="pages-list">
      <div class="pages-list-header" style="display:grid; grid-template-columns:${gridCols}; align-items:center;">
        <label class="page-item__checkbox"><input type="checkbox" ${allChecked ? 'checked' : ''} onchange="toggleAllFormsOnPage(this.checked, [${allIds.join(',')}])"></label>
        <span>Titre</span>
        <span style="text-align:center">Champs</span>
        <span style="text-align:center">Entrées</span>
        <span style="text-align:center">Statut</span>
        <span style="text-align:right">Actions</span>
      </div>
      ${_formsCache.map(f => {
        const safeName = escapeHtml(f.title).replace(/'/g, "\\'");
        const checked = _formsSelected.has(f.id);
        return `
        <div class="page-item${checked ? ' page-item--selected' : ''}" style="display:grid; grid-template-columns:${gridCols}; align-items:center;">
          <label class="page-item__checkbox"><input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleFormSelect(${f.id}, this.checked)"></label>
          <div onclick="loadSection('form-edit:${f.id}')" style="cursor:pointer; overflow:hidden;">
            <strong>${escapeHtml(f.title)}</strong>
            <span class="page-item__slug" style="display:block; font-size:12px; color:var(--gray-400)">${escapeHtml(f.slug)}</span>
          </div>
          <div style="text-align:center">${f.field_count || 0}</div>
          <div style="text-align:center">
            <a href="#" onclick="event.preventDefault(); loadSection('form-entries:${f.id}')" style="text-decoration:underline">${f.entry_count || 0} entrée(s)</a>
            ${f.unread_count > 0 ? `<span class="badge badge-warning" style="margin-top:4px;display:inline-block">${f.unread_count} non lue(s)</span>` : ''}
          </div>
          <div style="text-align:center">
            <span class="badge ${f.status === 'active' ? 'badge-success' : 'badge-muted'}">${f.status === 'active' ? 'Actif' : 'Inactif'}</span>
          </div>
          <div style="display:flex; gap:4px; justify-content:flex-end;">
            <button class="btn-icon-action" onclick="loadSection('form-edit:${f.id}')" title="Modifier">${_svgEdit}</button>
            <button class="btn-icon-action" onclick="loadSection('form-entries:${f.id}')" title="Entrées">${_svgInbox}</button>
            <button class="btn-icon-action" onclick="duplicateForm(${f.id})" title="Dupliquer">${_svgCopy}</button>
            <button class="btn-icon-action btn-icon-action--danger" onclick="deleteFormConfirm(${f.id}, '${safeName}')" title="Supprimer">${_svgDelete}</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

async function deleteFormConfirm(id, title) {
  const ok = await confirmModal(`Voulez-vous vraiment supprimer le formulaire "${title}" et toutes ses entrées ?`);
  if (!ok) return;
  showLoading();
  try {
    await apiFetch(`/forms/${id}`, { method: 'DELETE' });
    showToast('Formulaire supprimé', 'success');
    loadSection('forms');
  } catch (e) {
    hideLoading();
    showToast('Erreur: ' + e.message, 'error');
  }
}

async function duplicateForm(id) {
  showLoading();
  try {
    const form = await apiFetch(`/forms/${id}`);
    const newSlug = form.slug + '-copie-' + Date.now().toString(36);
    await apiFetch('/forms', {
      method: 'POST',
      body: JSON.stringify({
        title: form.title + ' (copie)',
        slug: newSlug,
        description: form.description,
        settings: typeof form.settings === 'string' ? JSON.parse(form.settings) : form.settings,
        status: form.status,
        fields: form.fields,
      }),
    });
    showToast('Formulaire dupliqué', 'success');
    loadSection('forms');
  } catch (e) {
    hideLoading();
    showToast('Erreur: ' + e.message, 'error');
  }
}

// ── Form Builder ──

async function renderFormBuilder(formId) {
  showLoading();
  try {
    if (formId && formId !== 'new') {
      _formBuilderData = await apiFetch(`/forms/${formId}`);
      _formBuilderFields = _formBuilderData.fields || [];
      const s = typeof _formBuilderData.settings === 'string' ? JSON.parse(_formBuilderData.settings) : (_formBuilderData.settings || {});
      _formBuilderSettings = s;
    } else {
      _formBuilderData = null;
      _formBuilderFields = [];
      _formBuilderSettings = {};
    }
    _formBuilderSelectedIdx = -1;
    hideLoading();
  } catch (e) {
    hideLoading();
    return `<div class="card"><p>Erreur: ${e.message}</p></div>`;
  }

  const isEdit = _formBuilderData && _formBuilderData.id;
  const title = isEdit ? escapeHtml(_formBuilderData.title) : '';
  const slug = isEdit ? escapeHtml(_formBuilderData.slug) : '';
  const desc = isEdit ? escapeHtml(_formBuilderData.description || '') : '';
  const status = isEdit ? _formBuilderData.status : 'active';

  return `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:16px">
        <button class="btn btn-outline btn-sm" onclick="loadSection('forms')"><i class="fa-solid fa-arrow-left" style="font-size:11px"></i> Retour</button>
        <h1>${isEdit ? 'Modifier le formulaire' : 'Nouveau formulaire'}</h1>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        ${isEdit ? `<button class="btn btn-outline btn-sm" onclick="loadSection('form-entries:${_formBuilderData.id}')"><i class="fa-solid fa-inbox" style="font-size:13px"></i> Entrées</button>` : ''}
        <button class="btn btn-primary btn-sm" onclick="saveFormBuilder()">Enregistrer</button>
      </div>
    </div>

    <div style="display:flex;gap:16px;margin-bottom:16px">
      <div class="form-group" style="flex:1;margin:0"><label class="form-label">Titre *</label><input type="text" class="form-input" id="formTitle" value="${title}" oninput="autoFormSlug()"></div>
      <div class="form-group" style="flex:1;margin:0"><label class="form-label">Slug *</label><input type="text" class="form-input" id="formSlug" value="${slug}"></div>
      <div class="form-group" style="width:140px;margin:0"><label class="form-label">Statut</label><select class="form-select" id="formStatus"><option value="active" ${status === 'active' ? 'selected' : ''}>Actif</option><option value="inactive" ${status !== 'active' ? 'selected' : ''}>Inactif</option></select></div>
    </div>

    <div class="form-group" style="margin-bottom:16px">
      <label class="form-label">Description</label>
      <textarea class="form-textarea" id="formDescription" rows="2">${desc}</textarea>
    </div>

    <!-- Tabs -->
    <div class="form-builder-tabs" style="display:flex;gap:0;margin-bottom:0;border-bottom:2px solid var(--gray-200)">
      <button class="form-builder-tab active" data-tab="fields" onclick="switchFormTab('fields')" style="padding:10px 20px;border:none;background:none;cursor:pointer;font-weight:600;border-bottom:2px solid var(--primary);margin-bottom:-2px">Champs</button>
      <button class="form-builder-tab" data-tab="settings" onclick="switchFormTab('settings')" style="padding:10px 20px;border:none;background:none;cursor:pointer;color:var(--gray-500);border-bottom:2px solid transparent;margin-bottom:-2px">Réglages</button>
    </div>

    <!-- Fields Tab -->
    <div id="formTabFields" style="display:flex;gap:16px;margin-top:16px">
      <!-- Field Types Sidebar -->
      <div class="card form-field-types-panel" style="width:200px;flex-shrink:0;padding:16px">
        <p style="font-weight:600;margin-bottom:12px;font-size:13px;color:var(--gray-700)">Ajouter un champ</p>
        <div style="display:flex;flex-direction:column;gap:2px">
        ${FORM_FIELD_TYPES.map(ft => `
          <button class="form-field-type-btn" onclick="addFormField('${ft.type}')">
            <span class="form-field-type-icon">${ft.icon}</span>
            <span class="form-field-type-label">${ft.label}</span>
          </button>
        `).join('')}
        </div>
      </div>

      <!-- Fields Canvas -->
      <div class="card" style="flex:1;padding:16px;min-height:300px" id="formFieldsCanvas">
        ${renderFormFieldsList()}
      </div>

      <!-- Field Settings Panel -->
      <div class="card" style="width:320px;flex-shrink:0;padding:16px" id="formFieldSettings">
        <p style="color:var(--gray-400);text-align:center;margin-top:40px">Sélectionnez un champ pour modifier ses propriétés</p>
      </div>
    </div>

    <!-- Settings Tab -->
    <div id="formTabSettings" style="display:none;margin-top:16px">
      <div class="card" style="padding:24px">
        ${renderFormSettingsPanel()}
      </div>
    </div>
  `;
}

function switchFormTab(tab) {
  document.querySelectorAll('.form-builder-tab').forEach(t => {
    t.classList.remove('active');
    t.style.borderBottomColor = 'transparent';
    t.style.color = 'var(--gray-500)';
  });
  const activeTab = document.querySelector(`.form-builder-tab[data-tab="${tab}"]`);
  if (activeTab) {
    activeTab.classList.add('active');
    activeTab.style.borderBottomColor = 'var(--primary)';
    activeTab.style.color = '';
  }
  document.getElementById('formTabFields').style.display = tab === 'fields' ? 'flex' : 'none';
  document.getElementById('formTabSettings').style.display = tab === 'settings' ? 'block' : 'none';
}

function renderFormFieldsList() {
  if (_formBuilderFields.length === 0) {
    return '<p style="text-align:center;color:var(--gray-400);margin-top:40px">Ajoutez des champs depuis le panneau de gauche</p>';
  }

  return `<div class="form-fields-list" style="display:flex;flex-wrap:wrap;gap:6px">
    ${_formBuilderFields.map((f, idx) => {
      const isSelected = idx === _formBuilderSelectedIdx;
      const ft = FORM_FIELD_TYPES.find(t => t.type === f.type) || { icon: '?', label: f.type };
      const w = f.settings?.width || '100';
      const widthStyle = w === '50' ? 'calc(50% - 3px)' : w === '33' ? 'calc(33.333% - 4px)' : '100%';
      const widthLabel = w === '50' ? '½' : w === '33' ? '⅓' : '';
      return `
        <div class="form-field-item ${isSelected ? 'is-selected' : ''}" data-idx="${idx}" onclick="selectFormField(${idx})" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid ${isSelected ? 'var(--primary)' : 'var(--gray-200)'};border-radius:8px;cursor:pointer;background:${isSelected ? 'var(--gray-50)' : 'white'};width:${widthStyle};box-sizing:border-box">
          <span style="cursor:grab;color:var(--gray-400)" class="form-field-drag" data-idx="${idx}">☰</span>
          <span style="width:28px;text-align:center;font-size:14px">${ft.icon}</span>
          <div style="flex:1;min-width:0">
            <strong style="font-size:13px">${escapeHtml(f.label)}</strong>
            <span style="font-size:11px;color:var(--gray-400);margin-left:6px">${ft.label}${f.required ? ' *' : ''}</span>
          </div>
          ${widthLabel ? `<span style="font-size:11px;color:var(--gray-400);background:var(--gray-100);padding:1px 6px;border-radius:4px">${widthLabel}</span>` : ''}
          <div style="display:flex;gap:4px">
            <button class="btn-icon-action btn-icon-action--danger" onclick="event.stopPropagation(); removeFormField(${idx})" title="Supprimer" style="font-size:12px">✕</button>
          </div>
        </div>`;
    }).join('')}
  </div>`;
}

function renderFormFieldSettings(idx) {
  const f = _formBuilderFields[idx];
  if (!f) return '<p style="color:var(--gray-400);text-align:center;margin-top:40px">Sélectionnez un champ</p>';

  const ft = FORM_FIELD_TYPES.find(t => t.type === f.type) || { label: f.type };
  const hasOptions = ['select', 'radio', 'checkbox'].includes(f.type);
  const optionsStr = hasOptions && f.options ? (Array.isArray(f.options) ? f.options.join('\n') : f.options) : '';
  const settings = f.settings || {};

  return `
    <h3 style="margin-bottom:16px;font-size:15px">${ft.label}</h3>

    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Label *</label>
      <input type="text" class="form-input" value="${escapeHtml(f.label)}" onchange="updateFormField(${idx}, 'label', this.value)">
    </div>

    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Nom du champ (name) *</label>
      <input type="text" class="form-input" value="${escapeHtml(f.name)}" onchange="updateFormField(${idx}, 'name', this.value)">
    </div>

    ${f.type !== 'html' && f.type !== 'hidden' ? `
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Placeholder</label>
      <input type="text" class="form-input" value="${escapeHtml(f.placeholder || '')}" onchange="updateFormField(${idx}, 'placeholder', this.value)">
    </div>

    <div class="form-group" style="margin-bottom:12px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" ${f.required ? 'checked' : ''} onchange="updateFormField(${idx}, 'required', this.checked)">
        <span style="font-size:13px">Champ requis</span>
      </label>
    </div>
    ` : ''}

    ${hasOptions ? `
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Options (une par ligne)</label>
      <textarea class="form-textarea" rows="5" onchange="updateFormFieldOptions(${idx}, this.value)">${escapeHtml(optionsStr)}</textarea>
      <div class="form-help">Chaque ligne = une option. Format: valeur ou label|valeur</div>
    </div>
    ` : ''}

    ${f.type === 'html' ? `
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Contenu HTML</label>
      <textarea class="form-textarea" rows="5" onchange="updateFormFieldSetting(${idx}, 'html_content', this.value)">${escapeHtml(settings.html_content || '')}</textarea>
    </div>
    ` : ''}

    ${f.type === 'hidden' ? `
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Valeur par défaut</label>
      <input type="text" class="form-input" value="${escapeHtml(settings.default_value || '')}" onchange="updateFormFieldSetting(${idx}, 'default_value', this.value)">
    </div>
    ` : ''}

    ${f.type === 'textarea' ? `
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Nombre de lignes</label>
      <input type="number" class="form-input" value="${settings.rows || 4}" min="2" max="20" onchange="updateFormFieldSetting(${idx}, 'rows', parseInt(this.value))">
    </div>
    ` : ''}

    ${f.type === 'file' ? `
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Types acceptés</label>
      <input type="text" class="form-input" value="${escapeHtml(settings.accept || '')}" placeholder=".pdf,.jpg,.png" onchange="updateFormFieldSetting(${idx}, 'accept', this.value)">
    </div>
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Taille max (Mo)</label>
      <input type="number" class="form-input" value="${settings.max_size || 10}" min="1" max="50" onchange="updateFormFieldSetting(${idx}, 'max_size', parseInt(this.value))">
    </div>
    ` : ''}

    ${f.type === 'number' ? `
    <div style="display:flex;gap:8px">
      <div class="form-group" style="margin-bottom:12px;flex:1">
        <label class="form-label" style="font-size:12px">Min</label>
        <input type="number" class="form-input" value="${settings.min ?? ''}" onchange="updateFormFieldSetting(${idx}, 'min', this.value)">
      </div>
      <div class="form-group" style="margin-bottom:12px;flex:1">
        <label class="form-label" style="font-size:12px">Max</label>
        <input type="number" class="form-input" value="${settings.max ?? ''}" onchange="updateFormFieldSetting(${idx}, 'max', this.value)">
      </div>
    </div>
    ` : ''}

    ${f.type === 'name' ? `
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Label prénom</label>
      <input type="text" class="form-input" value="${escapeHtml(settings.first_label || 'Prénom')}" onchange="updateFormFieldSetting(${idx}, 'first_label', this.value)">
    </div>
    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Label nom</label>
      <input type="text" class="form-input" value="${escapeHtml(settings.last_label || 'Nom')}" onchange="updateFormFieldSetting(${idx}, 'last_label', this.value)">
    </div>
    ` : ''}

    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Largeur</label>
      <select class="form-select" onchange="updateFormFieldSetting(${idx}, 'width', this.value)">
        <option value="100" ${(settings.width || '100') === '100' ? 'selected' : ''}>Pleine largeur</option>
        <option value="50" ${settings.width === '50' ? 'selected' : ''}>Demi</option>
        <option value="33" ${settings.width === '33' ? 'selected' : ''}>Tiers</option>
      </select>
    </div>

    <div class="form-group" style="margin-bottom:12px">
      <label class="form-label" style="font-size:12px">Classes CSS</label>
      <input type="text" class="form-input" value="${escapeHtml(settings.css_class || '')}" onchange="updateFormFieldSetting(${idx}, 'css_class', this.value)">
    </div>
  `;
}

function renderFormSettingsPanel() {
  const s = _formBuilderSettings;
  return `
    <h3 style="margin-bottom:20px">Réglages du formulaire</h3>

    <fieldset style="border:1px solid var(--gray-200);border-radius:8px;padding:16px;margin-bottom:20px">
      <legend style="font-weight:600;padding:0 8px">Confirmation</legend>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Message de confirmation</label>
        <textarea class="form-textarea" id="fsConfirmMsg" rows="3">${escapeHtml(s.confirmation_message || 'Votre message a bien été envoyé. Merci !')}</textarea>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Redirection après envoi (URL optionnelle)</label>
        <input type="text" class="form-input" id="fsRedirectUrl" value="${escapeHtml(s.redirect_url || '')}" placeholder="https://...">
      </div>
    </fieldset>

    <fieldset style="border:1px solid var(--gray-200);border-radius:8px;padding:16px;margin-bottom:20px">
      <legend style="font-weight:600;padding:0 8px">Notifications email</legend>
      <div class="form-group" style="margin-bottom:12px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="fsNotifEnabled" ${s.notification_enabled ? 'checked' : ''}>
          <span>Activer les notifications par email</span>
        </label>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Email(s) destinataire(s)</label>
        <input type="text" class="form-input" id="fsNotifEmail" value="${escapeHtml(s.notification_email || '')}" placeholder="admin@example.com">
        <div class="form-help">Séparer plusieurs emails par des virgules</div>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Objet de l'email</label>
        <input type="text" class="form-input" id="fsNotifSubject" value="${escapeHtml(s.notification_subject || 'Nouveau message depuis le formulaire')}" placeholder="Nouveau message…">
      </div>
    </fieldset>

    <fieldset style="border:1px solid var(--gray-200);border-radius:8px;padding:16px;margin-bottom:20px">
      <legend style="font-weight:600;padding:0 8px">reCAPTCHA</legend>
      <div class="form-group" style="margin-bottom:12px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="fsRecaptcha" ${s.recaptcha_enabled ? 'checked' : ''}>
          <span>Activer reCAPTCHA v3</span>
        </label>
        <div class="form-help">Les clés reCAPTCHA sont configurées dans Paramètres du site → reCAPTCHA</div>
      </div>
    </fieldset>

    <fieldset style="border:1px solid var(--gray-200);border-radius:8px;padding:16px;margin-bottom:20px">
      <legend style="font-weight:600;padding:0 8px">Bouton d'envoi</legend>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Texte du bouton</label>
        <input type="text" class="form-input" id="fsSubmitText" value="${escapeHtml(s.submit_text || 'Envoyer')}">
      </div>
    </fieldset>
  `;
}

// ── Field operations ──

function addFormField(type) {
  const ft = FORM_FIELD_TYPES.find(t => t.type === type);
  const baseName = type + '_' + (_formBuilderFields.length + 1);
  const newField = {
    type,
    label: ft ? ft.label : type,
    name: baseName,
    placeholder: '',
    required: false,
    options: ['select', 'radio', 'checkbox'].includes(type) ? ['Option 1', 'Option 2', 'Option 3'] : null,
    settings: {},
  };

  if (type === 'name') {
    newField.label = 'Nom complet';
    newField.name = 'name';
    newField.settings = { first_label: 'Prénom', last_label: 'Nom' };
  }

  _formBuilderFields.push(newField);
  _formBuilderSelectedIdx = _formBuilderFields.length - 1;
  refreshFormFieldsUI();
}

function removeFormField(idx) {
  _formBuilderFields.splice(idx, 1);
  if (_formBuilderSelectedIdx >= _formBuilderFields.length) {
    _formBuilderSelectedIdx = _formBuilderFields.length - 1;
  }
  refreshFormFieldsUI();
}

function selectFormField(idx) {
  _formBuilderSelectedIdx = idx;
  refreshFormFieldsUI();
}

function updateFormField(idx, key, value) {
  if (_formBuilderFields[idx]) {
    _formBuilderFields[idx][key] = value;
    if (key === 'label') {
      refreshFormFieldsCanvas();
    }
  }
}

function updateFormFieldOptions(idx, raw) {
  if (_formBuilderFields[idx]) {
    _formBuilderFields[idx].options = raw.split('\n').filter(l => l.trim());
  }
}

function updateFormFieldSetting(idx, key, value) {
  if (_formBuilderFields[idx]) {
    if (!_formBuilderFields[idx].settings) _formBuilderFields[idx].settings = {};
    _formBuilderFields[idx].settings[key] = value;
    if (key === 'width') refreshFormFieldsCanvas();
  }
}

function refreshFormFieldsUI() {
  refreshFormFieldsCanvas();
  const panel = document.getElementById('formFieldSettings');
  if (panel) panel.innerHTML = renderFormFieldSettings(_formBuilderSelectedIdx);
}

function refreshFormFieldsCanvas() {
  const canvas = document.getElementById('formFieldsCanvas');
  if (canvas) canvas.innerHTML = renderFormFieldsList();
}

function collectFormSettings() {
  return {
    confirmation_message: document.getElementById('fsConfirmMsg')?.value || '',
    redirect_url: document.getElementById('fsRedirectUrl')?.value || '',
    notification_enabled: document.getElementById('fsNotifEnabled')?.checked || false,
    notification_email: document.getElementById('fsNotifEmail')?.value || '',
    notification_subject: document.getElementById('fsNotifSubject')?.value || '',
    recaptcha_enabled: document.getElementById('fsRecaptcha')?.checked || false,
    submit_text: document.getElementById('fsSubmitText')?.value || 'Envoyer',
  };
}

async function saveFormBuilder() {
  const title = document.getElementById('formTitle')?.value?.trim();
  const slug = document.getElementById('formSlug')?.value?.trim();
  const description = document.getElementById('formDescription')?.value?.trim();
  const status = document.getElementById('formStatus')?.value || 'active';

  if (!title || !slug) {
    showToast('Le titre et le slug sont requis', 'error');
    return;
  }

  const settings = collectFormSettings();

  const payload = {
    title,
    slug,
    description,
    status,
    settings,
    fields: _formBuilderFields,
  };

  showLoading();
  try {
    if (_formBuilderData && _formBuilderData.id) {
      await apiFetch(`/forms/${_formBuilderData.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Formulaire mis à jour', 'success');
    } else {
      const created = await apiFetch('/forms', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Formulaire créé', 'success');
      loadSection('form-edit:' + created.id);
      return;
    }
    hideLoading();
  } catch (e) {
    hideLoading();
    showToast('Erreur: ' + e.message, 'error');
  }
}

function autoFormSlug() {
  const titleInput = document.getElementById('formTitle');
  const slugInput = document.getElementById('formSlug');
  if (!_formBuilderData || !_formBuilderData.id) {
    slugInput.value = slugify(titleInput.value);
  }
}

function attachFormBuilderEvents() {
  const canvas = document.getElementById('formFieldsCanvas');
  if (!canvas) return;

  canvas.addEventListener('mousedown', (e) => {
    const dragHandle = e.target.closest('.form-field-drag');
    if (!dragHandle) return;

    e.preventDefault();
    const idx = parseInt(dragHandle.dataset.idx);
    const items = canvas.querySelectorAll('.form-field-item');
    const dragItem = items[idx];
    if (!dragItem) return;

    dragItem.classList.add('is-dragging');
    document.body.classList.add('form-field-dragging');
    let currentIdx = idx;
    let changed = false;

    // Find the column partner of a 50% field (adjacent 50% field on same visual row)
    const findColumnPartner = (fieldIdx) => {
      const f = _formBuilderFields[fieldIdx];
      const w = f?.settings?.width || '100';
      if (w !== '50') return -1;
      // Check previous neighbor
      if (fieldIdx > 0 && (_formBuilderFields[fieldIdx - 1]?.settings?.width || '100') === '50') return fieldIdx - 1;
      // Check next neighbor
      if (fieldIdx < _formBuilderFields.length - 1 && (_formBuilderFields[fieldIdx + 1]?.settings?.width || '100') === '50') return fieldIdx + 1;
      return -1;
    };

    const clearDropIndicators = () => {
      canvas.querySelectorAll('.form-field-item').forEach(item => {
        item.classList.remove('drop-before', 'drop-after', 'drop-left', 'drop-right');
      });
    };

    const onMove = (ev) => {
      clearDropIndicators();
      const currentItems = canvas.querySelectorAll('.form-field-item');
      let acted = false;
      currentItems.forEach((item, i) => {
        if (i === currentIdx || acted) return;
        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const midX = rect.left + rect.width / 2;
        const inVerticalBand = ev.clientY >= rect.top && ev.clientY <= rect.bottom;

        // Side drop: cursor inside a field → show column indicator
        if (inVerticalBand && ev.clientX >= rect.left && ev.clientX <= rect.right) {
          const targetW = _formBuilderFields[i]?.settings?.width || '100';
          // Allow side-drop on 100% fields OR on 50% fields (to swap within row)
          if (targetW === '100') {
            item.classList.add(ev.clientX < midX ? 'drop-left' : 'drop-right');
            acted = true;
            return;
          }
        }

        // Vertical reorder
        if (ev.clientY < midY && i < currentIdx) {
          const moved = _formBuilderFields.splice(currentIdx, 1)[0];
          _formBuilderFields.splice(i, 0, moved);
          if (_formBuilderSelectedIdx === currentIdx) _formBuilderSelectedIdx = i;
          currentIdx = i;
          changed = true;
          refreshFormFieldsCanvas();
          const newItems = canvas.querySelectorAll('.form-field-item');
          if (newItems[currentIdx]) newItems[currentIdx].classList.add('is-dragging');
          acted = true;
        } else if (ev.clientY > midY && i > currentIdx) {
          const moved = _formBuilderFields.splice(currentIdx, 1)[0];
          _formBuilderFields.splice(i, 0, moved);
          if (_formBuilderSelectedIdx === currentIdx) _formBuilderSelectedIdx = i;
          currentIdx = i;
          changed = true;
          refreshFormFieldsCanvas();
          const newItems = canvas.querySelectorAll('.form-field-item');
          if (newItems[currentIdx]) newItems[currentIdx].classList.add('is-dragging');
          acted = true;
        } else if (ev.clientY < midY && i > currentIdx) {
          item.classList.add('drop-before');
        } else if (ev.clientY >= midY && i < currentIdx) {
          item.classList.add('drop-after');
        }
      });
    };

    const onUp = () => {
      const dropLeft = canvas.querySelector('.form-field-item.drop-left');
      const dropRight = canvas.querySelector('.form-field-item.drop-right');
      const dropTarget = dropLeft || dropRight;

      if (dropTarget) {
        // Side-drop → pair as columns
        const targetIdx = parseInt(dropTarget.dataset.idx);
        const draggedField = _formBuilderFields[currentIdx];
        const targetField = _formBuilderFields[targetIdx];
        if (draggedField && targetField) {
          // Orphan the old partner → 100%
          const partnerIdx = findColumnPartner(currentIdx);
          if (partnerIdx !== -1 && partnerIdx !== targetIdx) {
            const partner = _formBuilderFields[partnerIdx];
            if (partner?.settings) partner.settings.width = '100';
          }
          // Remove dragged from current position
          _formBuilderFields.splice(currentIdx, 1);
          let newTargetIdx = targetIdx > currentIdx ? targetIdx - 1 : targetIdx;
          if (dropLeft) {
            _formBuilderFields.splice(newTargetIdx, 0, draggedField);
          } else {
            _formBuilderFields.splice(newTargetIdx + 1, 0, draggedField);
          }
          if (!draggedField.settings) draggedField.settings = {};
          if (!targetField.settings) targetField.settings = {};
          draggedField.settings.width = '50';
          targetField.settings.width = '50';
          changed = true;
          const newDragIdx = _formBuilderFields.indexOf(draggedField);
          if (_formBuilderSelectedIdx === currentIdx) _formBuilderSelectedIdx = newDragIdx;
        }
      } else if (changed) {
        // Vertical reorder happened — check if dragged field left a column pair
        const draggedField = _formBuilderFields[currentIdx];
        const draggedW = draggedField?.settings?.width || '100';
        if (draggedW === '50') {
          // Find if it still has an adjacent 50% partner at new position
          const newPartner = findColumnPartner(currentIdx);
          if (newPartner === -1) {
            // No partner at new position → reset to 100%
            if (draggedField.settings) draggedField.settings.width = '100';
          }
        }
        // Reset any orphaned 50% fields (no adjacent 50% neighbor)
        _formBuilderFields.forEach((f, i) => {
          if ((f.settings?.width || '100') === '50' && findColumnPartner(i) === -1) {
            f.settings.width = '100';
          }
        });
      }

      clearDropIndicators();
      document.body.classList.remove('form-field-dragging');
      const finalItems = canvas.querySelectorAll('.form-field-item');
      finalItems.forEach(item => item.classList.remove('is-dragging'));
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (changed || dropTarget) {
        refreshFormFieldsCanvas();
        if (_formBuilderData?.id) {
          apiFetch(`/forms/${_formBuilderData.id}/reorder-fields`, {
            method: 'PUT',
            body: JSON.stringify({ fields: _formBuilderFields }),
          }).catch(() => {});
        }
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ── Form Entries ──

async function renderFormEntries(formId) {
  showLoading();
  try {
    const form = await apiFetch(`/forms/${formId}`);
    const result = await apiFetch(`/forms/${formId}/entries?page=${window._formEntriesPage}&status=${window._formEntriesFilter}`);
    hideLoading();

    const { entries, total, page, totalPages, counts } = result;

    return `
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-outline btn-sm" onclick="_formEntriesPage=1;_formEntriesFilter='all';loadSection('forms')">← Formulaires</button>
          <h1>Entrées — ${escapeHtml(form.title)}</h1>
          <span class="badge badge-muted">${total} entrée(s)</span>
        </div>
        <div style="display:flex;gap:8px">
          <a href="${API_BASE}/forms/${formId}/entries/export" target="_blank" class="btn btn-outline">${_svgDownload} Exporter CSV</a>
          <button class="btn btn-outline" onclick="loadSection('form-edit:${formId}')">${_svgEdit} Modifier</button>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:16px">
        ${['all', 'unread', 'read', 'starred', 'trash'].map(s => {
          const labels = { all: 'Toutes', unread: 'Non lues', read: 'Lues', starred: 'Favoris', trash: 'Corbeille' };
          const count = s === 'all' ? (counts.total - (counts.trash || 0)) : (counts[s] || 0);
          return `<button class="btn btn-sm ${window._formEntriesFilter === s ? 'btn-primary' : 'btn-outline'}" onclick="window._formEntriesFilter='${s}';window._formEntriesPage=1;loadSection('form-entries:${formId}')">${labels[s]} (${count})</button>`;
        }).join('')}
      </div>

      <div class="card">
        ${entries.length > 0 ? `
          <div class="pages-list">
            <div class="pages-list-header" style="grid-template-columns: 50px 1fr 150px 80px 110px; display:grid; align-items:center;">
              <span>#</span>
              <span>Résumé</span>
              <span>Date</span>
              <span>Statut</span>
              <span style="text-align:right">Actions</span>
            </div>
            ${entries.map(entry => {
              const summary = (entry.values || []).slice(0, 3).map(v => `${v.field_label}: ${(v.field_value || '').substring(0, 30)}`).join(' | ');
              const dateStr = new Date(entry.created_at).toLocaleString('fr-FR');
              const statusBadge = entry.status === 'unread' ? 'badge-warning' : entry.status === 'starred' ? 'badge-success' : 'badge-muted';
              const statusLabel = { unread: 'Non lu', read: 'Lu', starred: 'Favori', trash: 'Corbeille' }[entry.status];
              return `
              <div class="page-item" style="display:grid; grid-template-columns: 50px 1fr 150px 80px 110px; align-items:center;${entry.status === 'unread' ? ' font-weight:600' : ''}">
                <div onclick="loadSection('form-entry-detail:${formId}:${entry.id}')" style="cursor:pointer">
                  <strong>#${entry.id}</strong>
                </div>
                <div onclick="loadSection('form-entry-detail:${formId}:${entry.id}')" style="cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:12px;">
                  <span style="font-size:13px;color:var(--gray-600)">${escapeHtml(summary)}</span>
                </div>
                <div style="font-size:13px;color:var(--gray-500)">${dateStr}</div>
                <div><span class="badge ${statusBadge}">${statusLabel}</span></div>
                <div style="display:flex; gap:4px; justify-content:flex-end;">
                  <button class="btn-icon-action" onclick="loadSection('form-entry-detail:${formId}:${entry.id}')" title="Voir">${_svgEye}</button>
                  ${entry.status !== 'starred' ? `<button class="btn-icon-action" onclick="changeEntryStatus(${formId}, ${entry.id}, 'starred')" title="Favori">${_svgStar}</button>` : `<button class="btn-icon-action" onclick="changeEntryStatus(${formId}, ${entry.id}, 'read')" title="Retirer favori">${_svgStarFill}</button>`}
                  ${entry.status !== 'trash' ? `<button class="btn-icon-action btn-icon-action--danger" onclick="changeEntryStatus(${formId}, ${entry.id}, 'trash')" title="Corbeille">${_svgTrash}</button>` : `<button class="btn-icon-action btn-icon-action--danger" onclick="deleteEntryConfirm(${formId}, ${entry.id})" title="Supprimer définitivement">${_svgX}</button>`}
                </div>
              </div>`;
            }).join('')}
          </div>

          ${totalPages > 1 ? `
          <div style="display:flex;justify-content:center;gap:4px;margin-top:16px">
            ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
              <button class="btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}" onclick="window._formEntriesPage=${p};loadSection('form-entries:${formId}')">${p}</button>
            `).join('')}
          </div>` : ''}
        ` : renderEmptyState('📭', 'Aucune entrée', 'Les soumissions du formulaire apparaîtront ici')}
      </div>
    `;
  } catch (e) {
    hideLoading();
    return `<div class="card"><p>Erreur: ${e.message}</p></div>`;
  }
}

async function renderFormEntryDetail(formId, entryId) {
  showLoading();
  try {
    const [form, entry] = await Promise.all([
      apiFetch(`/forms/${formId}`),
      apiFetch(`/forms/entries/${entryId}`),
    ]);
    hideLoading();

    const dateStr = new Date(entry.created_at).toLocaleString('fr-FR');

    return `
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-outline btn-sm" onclick="loadSection('form-entries:${formId}')">← Entrées</button>
          <h1>Entrée #${entry.id}</h1>
          <span class="badge badge-muted">${escapeHtml(form.title)}</span>
        </div>
        <div style="display:flex;gap:8px">
          ${entry.status !== 'starred' ? `<button class="btn btn-outline" onclick="changeEntryStatus(${formId}, ${entry.id}, 'starred')">${_svgStar} Favori</button>` : ''}
          <button class="btn btn-outline" style="color:var(--danger)" onclick="deleteEntryConfirm(${formId}, ${entry.id})">Supprimer</button>
        </div>
      </div>

      <div class="card" style="padding:24px">
        <div style="display:flex;gap:24px;margin-bottom:20px;color:var(--gray-500);font-size:13px">
          <span>Date: ${dateStr}</span>
          <span>IP: ${entry.ip_address || 'N/A'}</span>
          <span>Statut: ${entry.status}</span>
        </div>

        <table style="width:100%;border-collapse:collapse">
          ${(entry.values || []).map(v => `
            <tr style="border-bottom:1px solid var(--gray-100)">
              <td style="padding:12px 16px;font-weight:600;width:200px;vertical-align:top;color:var(--gray-700)">${escapeHtml(v.field_label)}</td>
              <td style="padding:12px 16px;white-space:pre-wrap">${escapeHtml(v.field_value || '—')}</td>
            </tr>
          `).join('')}
        </table>
      </div>

      <div class="card" style="padding:16px;margin-top:16px">
        <p style="font-size:12px;color:var(--gray-400)"><strong>User Agent:</strong> ${escapeHtml(entry.user_agent || 'N/A')}</p>
      </div>
    `;
  } catch (e) {
    hideLoading();
    return `<div class="card"><p>Erreur: ${e.message}</p></div>`;
  }
}

async function changeEntryStatus(formId, entryId, status) {
  try {
    await apiFetch(`/forms/entries/${entryId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    showToast('Statut mis à jour', 'success');
    loadSection('form-entries:' + formId);
  } catch (e) {
    showToast('Erreur: ' + e.message, 'error');
  }
}

async function deleteEntryConfirm(formId, entryId) {
  const ok = await confirmModal('Voulez-vous vraiment supprimer définitivement cette entrée ?');
  if (!ok) return;
  showLoading();
  try {
    await apiFetch(`/forms/entries/${entryId}`, { method: 'DELETE' });
    showToast('Entrée supprimée', 'success');
    loadSection('form-entries:' + formId);
  } catch (e) {
    hideLoading();
    showToast('Erreur: ' + e.message, 'error');
  }
}

// Expose all on window
Object.assign(window, {
  FORM_FIELD_TYPES,
  renderFormsList,
  renderFormsView,
  refreshFormsView,
  toggleFormSelect,
  toggleAllFormsOnPage,
  clearFormsSelection,
  renderFormsBulkBar,
  bulkFormsStatus,
  bulkFormsDuplicate,
  bulkFormsDelete,
  renderFormsTable,
  deleteFormConfirm,
  duplicateForm,
  renderFormBuilder,
  switchFormTab,
  renderFormFieldsList,
  renderFormFieldSettings,
  renderFormSettingsPanel,
  addFormField,
  removeFormField,
  selectFormField,
  updateFormField,
  updateFormFieldOptions,
  updateFormFieldSetting,
  refreshFormFieldsUI,
  refreshFormFieldsCanvas,
  collectFormSettings,
  saveFormBuilder,
  autoFormSlug,
  attachFormBuilderEvents,
  renderFormEntries,
  renderFormEntryDetail,
  changeEntryStatus,
  deleteEntryConfirm,
});
