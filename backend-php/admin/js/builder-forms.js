// builder-forms.js — Schema form rendering engine for the page builder
// Extracted from app.js lines 8063-10281 (saveBlockData + renderBuilderSettingsPanel + all form functions)
// All global state lives on window (set up by state.js).

// BlockParams field names — fallback set for modules parsed without isBlockParam flag
const BLOCK_PARAMS_FIELDS = new Set([
  'title', 'id_bloc', 'title_align', 'title_style',
  'bloc_color', 'padding_top', 'padding_bottom',
  'is_visible', 'bg_img', 'bg_opacity', 'bg_parallax',
  'is_fullscreen', 'is_small_marged'
]);

// Per-module overrides: extra field names that should appear in the Paramètres tab
// even though they are not declared via BlockParams (and thus not flagged isBlockParam).
const EXTRA_PARAM_FIELDS_BY_MODULE = {
  ColumnsTab: new Set(['container_width', 'cols_justify_items', 'columns_background', 'columns_display']),
};

const PADDING_CLASSES = ['padding-top-small', 'no-padding-top', 'padding-bottom-small', 'no-padding-bottom'];
const BG_COLOR_CLASSES = ['has-background-primary', 'has-background-secondary', 'has-background-tertiary', 'no-background-color'];

// ── WYSIWYG Editor (Quill) ──────────────────────────────────────────────────

const _quillInstances = new Map();

function renderBuilderSettingsPanel() {
  if (!selectedBlockId) {
    return `<div class="builder-settings-empty">Sélectionnez un module pour le paramétrer.</div>`;
  }
  const block = pageBuilderState.blocks.find(b => b.id === selectedBlockId);
  if (!block) {
    return `<div class="builder-settings-empty">Sélectionnez un module pour le paramétrer.</div>`;
  }
  const def = BLOCK_TYPES[block.type] || { label: block.type, icon: '▦' };
  if (!moduleFieldSchema) {
    return `<div class="builder-settings-empty">Chargement des paramètres…</div>`;
  }
  const moduleName = def.moduleName || block.type;
  const schemaFields = moduleFieldSchema?.modules?.[moduleName]?.fields || [];
  return `
    <div class="builder-settings-header">
      <button type="button" class="btn btn-sm btn-outline builder-settings-back" onclick="deselectBlock()">← Retour aux modules</button>
      <div>
        <div class="builder-settings-title">${escapeHtml(def.label)}</div>
        <div class="builder-settings-subtitle">${escapeHtml(block.type)}</div>
        <div class="builder-breadcrumb" id="builderBreadcrumb"></div>
      </div>
    </div>
    ${LEGACY_BLOCK_TYPES[block.type]
      ? renderLegacyBlockForm(block)
      : (schemaFields.length > 0 ? renderSchemaForm(block, schemaFields) : renderKeyValueForm(block))}
  `;
}

function legacyForm(fieldsHtml, onsubmit) {
  return `<form class="builder-block-form" onsubmit="${onsubmit}">
    <div class="settings-fields">${fieldsHtml}</div>
  </form>`;
}

function renderLegacyBlockForm(block) {
  const def = BLOCK_TYPES[block.type] || { defaultData: {} };
  const d = { ...def.defaultData, ...(block.data || {}) };
  const sub = `saveBlockData('${block.id}', event)`;
  if (block.type === 'heading') {
    return legacyForm(`
      <div class="form-group"><label class="form-label">Niveau</label><select name="level" class="form-select"><option value="h2" ${d.level === 'h2' ? 'selected' : ''}>H2</option><option value="h3" ${d.level === 'h3' ? 'selected' : ''}>H3</option><option value="h4" ${d.level === 'h4' ? 'selected' : ''}>H4</option></select></div>
      <div class="form-group"><label class="form-label">Texte</label><input type="text" class="form-input" name="text" value="${escapeHtml(d.text)}"></div>`, sub);
  }
  if (block.type === 'text') {
    return legacyForm(`
      <div class="form-group"><label class="form-label">Titre (optionnel)</label><input type="text" class="form-input" name="title" value="${escapeHtml(d.title)}"></div>
      <div class="form-group"><label class="form-label">Contenu</label><textarea class="form-textarea" name="body" rows="4">${escapeHtml(d.body)}</textarea></div>`, sub);
  }
  if (block.type === 'image') {
    return legacyForm(`
      <div class="form-group"><label class="form-label">URL de l'image</label><input type="text" class="form-input" name="src" value="${escapeHtml(d.src)}" placeholder="https://..."></div>
      <div class="form-group"><label class="form-label">Texte alternatif</label><input type="text" class="form-input" name="alt" value="${escapeHtml(d.alt)}"></div>
      <div class="form-group"><label class="form-label">Légende</label><input type="text" class="form-input" name="caption" value="${escapeHtml(d.caption)}"></div>`, sub);
  }
  if (block.type === 'hero') {
    return legacyForm(`
      <div class="form-group"><label class="form-label">Titre</label><input type="text" class="form-input" name="title" value="${escapeHtml(d.title)}"></div>
      <div class="form-group"><label class="form-label">Sous-titre</label><input type="text" class="form-input" name="subtitle" value="${escapeHtml(d.subtitle)}"></div>
      <div class="form-group"><label class="form-label">Image (URL)</label><input type="text" class="form-input" name="image" value="${escapeHtml(d.image)}"></div>
      <div class="form-group"><label class="form-label">Bouton - Texte</label><input type="text" class="form-input" name="buttonText" value="${escapeHtml(d.buttonText)}"></div>
      <div class="form-group"><label class="form-label">Bouton - Lien</label><input type="text" class="form-input" name="buttonUrl" value="${escapeHtml(d.buttonUrl)}"></div>`, sub);
  }
  if (block.type === 'cta') {
    return legacyForm(`
      <div class="form-group"><label class="form-label">Titre</label><input type="text" class="form-input" name="title" value="${escapeHtml(d.title)}"></div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" name="description" rows="2">${escapeHtml(d.description)}</textarea></div>
      <div class="form-group"><label class="form-label">Bouton - Texte</label><input type="text" class="form-input" name="buttonText" value="${escapeHtml(d.buttonText)}"></div>
      <div class="form-group"><label class="form-label">Bouton - Lien</label><input type="text" class="form-input" name="buttonUrl" value="${escapeHtml(d.buttonUrl)}"></div>`, sub);
  }
  if (block.type === 'spacer') {
    return legacyForm(`
      <div class="form-group"><label class="form-label">Taille</label><select name="size" class="form-select"><option value="small" ${d.size === 'small' ? 'selected' : ''}>Petit</option><option value="medium" ${d.size === 'medium' ? 'selected' : ''}>Moyen</option><option value="large" ${d.size === 'large' ? 'selected' : ''}>Grand</option></select></div>`, sub);
  }
  if (block.type === 'html') {
    return legacyForm(`
      <div class="form-group"><label class="form-label">HTML</label><textarea class="form-textarea" name="content" rows="6" style="font-family:monospace">${escapeHtml(d.content)}</textarea></div>`, sub);
  }
  return '';
}

function renderKeyValueForm(block) {
  const data = block.data && typeof block.data === 'object' ? block.data : {};
  const entries = Object.entries(data);
  const rows = entries.length > 0
    ? entries.map(([key, value]) => renderKeyValueRow(key, value)).join('')
    : renderKeyValueRow('', '');
  return `
    <form class="builder-block-form" onsubmit="saveKeyValueData('${block.id}', event)">
      <div class="settings-fields">
        <div class="form-group">
          <label class="form-label">Paramètres du module</label>
          <div class="kv-list">
            ${rows}
          </div>
          <button type="button" class="btn btn-sm btn-outline" onclick="addKeyValueRow()">+ Ajouter un paramètre</button>
        </div>
      </div>
    </form>
  `;
}

function renderSchemaForm(block, schemaFields) {
  const data = block.data && typeof block.data === 'object' ? { ...block.data } : {};
  // Seed missing fields with their schema defaults so conditionals evaluate correctly on new blocks
  for (const sf of schemaFields) {
    if (data[sf.name] === undefined && sf.defaultValue !== undefined) {
      data[sf.name] = sf.defaultValue;
    }
  }
  const def = BLOCK_TYPES[block.type] || {};
  const moduleName = def.moduleName || block.type;
  const isInlineEditable = (moduleName === 'TextSimple' || moduleName === 'TextImage' || moduleName === 'HeadText');

  const renderField = (field) => {
    // Hide the accordions repeater for Accordion — managed from the preview
    if (moduleName === 'Accordion' && field.type === 'Repeater' && field.name === 'accordions') {
      return `<div class="form-group inline-edit-hint">
        <div class="inline-edit-hint-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          <span>Gérez les éléments directement dans la preview</span>
        </div>
      </div>`;
    }
    // Hide the WYSIWYG text field for inline-editable modules — edited inline in the preview
    if (isInlineEditable && field.type === 'WYSIWYGEditor' && field.name === 'text') {
      return `<div class="form-group inline-edit-hint">
        <div class="inline-edit-hint-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          <span>Cliquez sur le texte dans la preview pour le modifier directement</span>
        </div>
      </div>`;
    }
    let val = data[field.name] !== undefined ? data[field.name] : field.defaultValue;
    // Normalize false to '' for padding fields (PHP default(false) = "Normal" = empty string value)
    if ((field.name === 'padding_top' || field.name === 'padding_bottom') && (val === false || val === 'false' || val === undefined)) val = '';
    return renderSchemaField(field, val, block.id, data);
  };

  // Split fields into content vs params tabs
  // Use the isBlockParam flag from the PHP parser when available; fall back to static set.
  // Per-module overrides (EXTRA_PARAM_FIELDS_BY_MODULE) push extra layout-style fields to Paramètres.
  const hasBlockParamFlag = schemaFields.some(f => f.isBlockParam === true);
  const extraParamSet = EXTRA_PARAM_FIELDS_BY_MODULE[moduleName] || null;
  const contentFields = [];
  const paramFields = [];
  schemaFields.forEach(field => {
    const baseIsParam = hasBlockParamFlag ? (field.isBlockParam === true) : BLOCK_PARAMS_FIELDS.has(field.name);
    const isParam = baseIsParam || (extraParamSet && extraParamSet.has(field.name));
    if (isParam) {
      paramFields.push(field);
    } else {
      contentFields.push(field);
    }
  });

  const contentHtml = contentFields.map(renderField).join('');
  const paramHtml = paramFields.map(renderField).join('');
  const hasParams = paramFields.length > 0;
  const tabId = `block-tabs-${block.id}`;

  if (!hasParams) {
    // No params tab needed — render flat like before
    return `
      <form class="builder-block-form" onsubmit="saveSchemaData('${block.id}', event)">
        <div class="settings-fields">${contentHtml}</div>
      </form>
    `;
  }

  return `
    <form class="builder-block-form" onsubmit="saveSchemaData('${block.id}', event)">
      <div class="settings-tabs" id="${tabId}">
        <button type="button" class="settings-tab is-active" data-target="#${block.id}-tab-params" onclick="switchBlockTab(this)">Paramètres</button>
        <button type="button" class="settings-tab" data-target="#${block.id}-tab-content" onclick="switchBlockTab(this)">Contenu</button>
      </div>
      <div class="settings-section is-active" id="${block.id}-tab-params">
        <div class="settings-fields">${paramHtml}</div>
      </div>
      <div class="settings-section" id="${block.id}-tab-content">
        <div class="settings-fields">${contentHtml}</div>
      </div>
    </form>
  `;
}

function switchBlockTab(tabBtn) {
  const tabsContainer = tabBtn.parentElement;
  const form = tabsContainer.closest('.builder-block-form');
  // Deactivate all tabs and sections
  tabsContainer.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('is-active'));
  form.querySelectorAll(':scope > .settings-section').forEach(s => s.classList.remove('is-active'));
  // Activate clicked tab and its target section
  tabBtn.classList.add('is-active');
  const target = form.querySelector(tabBtn.getAttribute('data-target'));
  if (target) {
    target.classList.add('is-active');
    // Initialize deferred Quill editors now that the section is visible
    initWysiwygEditors(target);
  }
}

function normalizeBoolVal(val) {
  if (val === true || val === 1) return '1';
  if (val === false || val === 0) return '0';
  return String(val ?? '');
}

// rowCtx = { parentName, rowIndex } when rendering inside a Repeater row or Group
function renderSchemaField(field, value, blockId, allData, rowCtx = null) {
  const html = _renderSchemaFieldHTML(field, value, blockId, rowCtx);
  const rawCond = field.conditional;
  if (!rawCond) return html;
  // Support single conditional object or array of conditionals (AND logic)
  const conds = Array.isArray(rawCond) ? rawCond : [rawCond];
  let show = true;
  for (const cond of conds) {
    let condFieldVal = allData?.[cond.field];
    if (condFieldVal === undefined && rowCtx) {
      const block = pageBuilderState.blocks.find(b => b.id === blockId);
      const blockData = block?.data && typeof block.data === 'object' ? block.data : {};
      condFieldVal = blockData[cond.field];
    }
    condFieldVal = normalizeBoolVal(condFieldVal);
    const isEmpty = cond.operator === '!=empty' || (cond.operator === '!=' && (cond.value === '' || cond.value === null || cond.value === 'null'));
    const match = isEmpty ? condFieldVal !== '' : (cond.operator === '==' ? condFieldVal === String(cond.value ?? '') : condFieldVal !== String(cond.value ?? ''));
    if (!match) { show = false; break; }
  }
  const condData = conds.map((c, i) => {
    const suffix = i === 0 ? '' : `-${i}`;
    return `data-cond-field${suffix}="${escapeHtml(c.field)}" data-cond-op${suffix}="${escapeHtml(c.operator)}" data-cond-val${suffix}="${escapeHtml(c.value || '')}"`;
  }).join(' ');
  return `<div class="schema-cond-field" data-cond-count="${conds.length}" ${condData}${show ? '' : ' style="display:none"'}>${html}</div>`;
}

function _renderSchemaFieldHTML(field, value, blockId, rowCtx = null) {
  const label = field.label || field.name;
  const name = field.name;
  const type = field.type || 'Text';
  // Compute the compound input name for nested fields
  const inputName = rowCtx
    ? (rowCtx.rowIndex !== null
        ? `${rowCtx.parentName}::${rowCtx.rowIndex}::${name}`
        : `${rowCtx.parentName}::${name}`)
    : name;
  // data-rfield attribute for row-scoped conditional logic lookup
  const rfieldAttr = rowCtx ? ` data-rfield="${escapeHtml(name)}"` : '';
  // Suffix DOM ids with hash of inputName so multiple instances on same page (e.g. inside columns) stay unique
  const idSuffix = rowCtx ? `-${inputName.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
  // Generic dynamic select : field can declare `dynamicSource: { endpoint, valueKey, labelKey, dataPath?, placeholder? }`.
  if (type === 'Select' && field.dynamicSource && field.dynamicSource.endpoint) {
    const ds = field.dynamicSource;
    const selectId = `dyn-select-${blockId}-${name}${idSuffix}`;
    setTimeout(async () => {
      const sel = document.getElementById(selectId);
      if (!sel) return;
      try {
        const data = await apiFetch(ds.endpoint);
        const list = ds.dataPath ? (data?.[ds.dataPath] || []) : (Array.isArray(data) ? data : (data?.data || []));
        const placeholder = ds.placeholder !== undefined ? ds.placeholder : `— Sélectionner —`;
        sel.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` +
          list.map(it => {
            const v = it[ds.valueKey];
            const l = it[ds.labelKey] || v;
            return `<option value="${escapeHtml(String(v))}" ${String(value ?? '') === String(v) ? 'selected' : ''}>${escapeHtml(String(l))}</option>`;
          }).join('');
      } catch (e) {}
    }, 0);
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <select class="form-select" name="${escapeHtml(inputName)}"${rfieldAttr} id="${selectId}">
          <option value="">Chargement…</option>
        </select>
      </div>
    `;
  }
  // Dynamic select for form module: populate form_id from API
  if (name === 'form_id') {
    const selectId = `form-select-${blockId}${idSuffix}`;
    setTimeout(async () => {
      const sel = document.getElementById(selectId);
      if (!sel) return;
      try {
        const forms = await apiFetch('/forms');
        sel.innerHTML = '<option value="">— Sélectionner un formulaire —</option>' +
          (forms || []).filter(f => f.status === 'active').map(f =>
            `<option value="${f.id}" ${String(value ?? '') === String(f.id) ? 'selected' : ''}>${escapeHtml(f.title)}</option>`
          ).join('');
      } catch (e) {}
    }, 0);
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <select class="form-select" name="${escapeHtml(inputName)}"${rfieldAttr} id="${selectId}">
          <option value="">Chargement…</option>
        </select>
      </div>
    `;
  }
  // Dynamic select for reusable-bloc module: populate bloc_id from API
  if (name === 'bloc_id') {
    const selectId = `rb-select-${blockId}${idSuffix}`;
    // Render placeholder then fetch choices async
    setTimeout(async () => {
      const sel = document.getElementById(selectId);
      if (!sel) return;
      try {
        const blocs = await apiFetch('/reusable-blocs');
        sel.innerHTML = '<option value="">— Sélectionner un bloc —</option>' +
          (blocs || []).filter(b => b.status === 'published').map(b =>
            `<option value="${b.id}" ${String(value ?? '') === String(b.id) ? 'selected' : ''}>${escapeHtml(b.title)}</option>`
          ).join('');
      } catch (e) {}
    }, 0);
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <select class="form-select" name="${escapeHtml(inputName)}"${rfieldAttr} id="${selectId}">
          <option value="">Chargement…</option>
        </select>
      </div>
    `;
  }
  // Dynamic select for summary module: populate menu_id from API
  if (name === 'menu_id') {
    const selectId = `menu-select-${blockId}${idSuffix}`;
    setTimeout(async () => {
      const sel = document.getElementById(selectId);
      if (!sel) return;
      try {
        const menus = await apiFetch('/menus');
        sel.innerHTML = '<option value="">— Sélectionner un menu —</option>' +
          (menus || []).map(m =>
            `<option value="${m.id}" ${String(value ?? '') === String(m.id) ? 'selected' : ''}>${escapeHtml(m.name)}</option>`
          ).join('');
      } catch (e) {}
    }, 0);
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <select class="form-select" name="${escapeHtml(inputName)}"${rfieldAttr} id="${selectId}">
          <option value="">Chargement…</option>
        </select>
      </div>
    `;
  }
  const safeValue = escapeHtml(value ?? '');
  const choices = Array.isArray(field.choices) ? field.choices : null;
  if (type === 'WYSIWYGEditor') {
    const editorId = `wysiwyg-${blockId}-${inputName}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <div class="wysiwyg-wrapper">
          <div class="wysiwyg-editor" id="${editorId}">${value || ''}</div>
          <textarea class="form-textarea wysiwyg-source" name="${escapeHtml(inputName)}"${rfieldAttr} style="display:none">${safeValue}</textarea>
        </div>
      </div>
    `;
  }
  if (type === 'Textarea') {
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <textarea class="form-textarea" name="${escapeHtml(inputName)}"${rfieldAttr} rows="4">${safeValue}</textarea>
      </div>
    `;
  }
  if (type === 'TrueFalse') {
    const isChecked = value === true || value === '1' || value === 1 || value === 'yes';
    const onLabel = field.onLabel || 'Oui';
    const offLabel = field.offLabel || 'Non';
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <label class="toggle-field">
          <span class="toggle-label toggle-label-off">${escapeHtml(offLabel)}</span>
          <span class="toggle-switch">
            <input type="checkbox" name="${escapeHtml(inputName)}"${rfieldAttr} ${isChecked ? 'checked' : ''}>
            <span class="toggle-slider" aria-hidden="true"></span>
          </span>
          <span class="toggle-label toggle-label-on">${escapeHtml(onLabel)}</span>
        </label>
      </div>
    `;
  }
  if (type === 'Number' || type === 'Range') {
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <input type="number" class="form-input" name="${escapeHtml(inputName)}"${rfieldAttr} value="${safeValue}">
      </div>
    `;
  }
  if (type === 'ColorPicker') {
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <input type="color" class="form-input" name="${escapeHtml(inputName)}"${rfieldAttr} value="${safeValue || '#000000'}">
      </div>
    `;
  }
  // Rendu spécial pour les champs de couleur de fond de bloc
  const COLOR_FIELDS = ['bloc_color', 'footer_color', 'pdv_footer_color', 'bloc_color_alert'];
  if ((type === 'ButtonGroup' || type === 'RadioButton') && choices && choices.length > 0 && COLOR_FIELDS.includes(name)) {
    const resolvedColors = getResolvedColorMap();
    const COLOR_MAP = {
      'has-background-primary':   { label: 'Primaire',   color: resolvedColors['has-background-primary']   },
      'has-background-secondary': { label: 'Secondaire', color: resolvedColors['has-background-secondary'] },
      'has-background-tertiary':  { label: 'Tertiaire',  color: resolvedColors['has-background-tertiary']  },
      'no-background-color':      { label: 'Aucune',     color: null },
    };
    const options = choices.map((choice, idx) => {
      const id = `${inputName}_${idx}`;
      const checked = String(value ?? '') === String(choice.value);
      const def = COLOR_MAP[choice.value] || { label: choice.label, color: null };
      const swatchHtml = def.color
        ? `<span class="color-swatch" style="background:${escapeHtml(def.color)}"></span>`
        : `<span class="color-swatch color-swatch--none"></span>`;
      return `
        <label class="radio-pill radio-pill--color" for="${escapeHtml(id)}">
          <input type="radio" id="${escapeHtml(id)}" name="${escapeHtml(inputName)}"${rfieldAttr} value="${escapeHtml(choice.value)}" ${checked ? 'checked' : ''}>
          ${swatchHtml}
          <span class="color-label">${escapeHtml(def.label)}</span>
        </label>
      `;
    }).join('');
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <div class="radio-pill-group">
          ${options}
        </div>
      </div>
    `;
  }
  if ((type === 'ButtonGroup' || type === 'RadioButton') && choices && choices.length > 0) {
    const site = siteSettingsCache || {};

    let localChoices = choices.slice();
    if (name === 'padding_top' || name === 'padding_bottom') {
      const hasNormal = localChoices.some(
        (c) => c.value === '' || c.value === false || c.value === 'false'
      );
      if (!hasNormal) {
        localChoices.unshift({ value: '', label: 'Normal' });
      }
    }

    const options = localChoices.map((choice, idx) => {
      const id = `${inputName}_${idx}`;
      const checked = String(value ?? '') === String(choice.value);
      let displayLabel = choice.label;
      let colorDot = '';

      if (name === 'bloc_color' || name === 'footer_color' || name === 'pdv_footer_color' || name === 'bloc_color_alert') {
        if (choice.value === 'no-background-color') {
          displayLabel = 'Aucune';
        } else if (choice.value === 'has-background-primary') {
          displayLabel = 'Primaire';
          if (site.primary_color) colorDot = site.primary_color;
        } else if (choice.value === 'has-background-secondary') {
          displayLabel = 'Secondaire';
          if (site.secondary_color) colorDot = site.secondary_color;
        } else if (choice.value === 'has-background-tertiary') {
          displayLabel = 'Tertiaire';
          if (site.tertiary_color) colorDot = site.tertiary_color;
        }
      }
      if (name === 'columns_background') {
        if (choice.value === 'no-background') {
          displayLabel = 'Aucun';
        } else if (choice.value === 'cols-background-light') {
          displayLabel = 'Clair';
          if (site.background_color) colorDot = site.background_color;
        } else if (choice.value === 'cols-background-primary') {
          displayLabel = 'Primaire';
          if (site.primary_color) colorDot = site.primary_color;
        } else if (choice.value === 'cols-background-secondary') {
          displayLabel = 'Secondaire';
          if (site.secondary_color) colorDot = site.secondary_color;
        } else if (choice.value === 'cols-background-tertiary') {
          displayLabel = 'Tertiaire';
          if (site.tertiary_color) colorDot = site.tertiary_color;
        }
      }

      const dotHtml = colorDot
        ? `<span class="color-dot" style="background: ${escapeHtml(colorDot)}"></span>`
        : '';

      return `
        <label class="radio-pill" for="${escapeHtml(id)}">
          <input type="radio" id="${escapeHtml(id)}" name="${escapeHtml(inputName)}"${rfieldAttr} value="${escapeHtml(choice.value)}" ${checked ? 'checked' : ''}>
          <span>${dotHtml}<span class="color-label">${escapeHtml(String(displayLabel).replace(/<[^>]+>/g, ''))}</span></span>
        </label>
      `;
    }).join('');
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <div class="radio-pill-group">
          ${options}
        </div>
      </div>
    `;
  }
  if (type === 'Select' && choices && choices.length > 0) {
    const options = choices.map(choice => `
      <option value="${escapeHtml(choice.value)}" ${String(value ?? '') === String(choice.value) ? 'selected' : ''}>${escapeHtml(choice.label)}</option>
    `).join('');
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <select class="form-select" name="${escapeHtml(inputName)}"${rfieldAttr}>
          ${options}
        </select>
      </div>
    `;
  }
  if (type === 'URL' || type === 'Url' || type === 'Link') {
    const linkObj = (value && typeof value === 'object') ? value : { url: value || '', title: '', target: '_self' };
    return `
      <div class="form-group link-field-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <div class="link-field" data-field="${escapeHtml(inputName)}">
          <div style="display:flex;gap:6px;align-items:center;">
            <input type="url" class="form-input link-field-url" name="${escapeHtml(inputName)}__url" placeholder="URL"${rfieldAttr} value="${escapeHtml(linkObj.url || '')}" style="flex:1">
            <button type="button" class="btn-link-picker" onclick="openLinkPickerForField(this)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Parcourir</button>
          </div>
          <input type="text" class="form-input link-field-title" name="${escapeHtml(inputName)}__title" placeholder="Titre du lien" value="${escapeHtml(linkObj.title || '')}">
          <select class="form-select" name="${escapeHtml(inputName)}__target" style="max-width:180px">
            <option value="_self"${linkObj.target !== '_blank' ? ' selected' : ''}>Même fenêtre</option>
            <option value="_blank"${linkObj.target === '_blank' ? ' selected' : ''}>Nouvel onglet</option>
          </select>
        </div>
      </div>
    `;
  }
  if (type === 'Image' || type === 'File' || type === 'Video') {
    const media = normalizeMediaValue(value);
    const url = media?.url || '';
    const isVideo = media?.type === 'video' || type === 'Video';
    const isDocument = media?.type === 'document' || (media?.mime_type && media.mime_type === 'application/pdf');
    const isPdf = isDocument || /\.pdf$/i.test(url);
    const pickerType = type === 'File' ? 'all' : (type === 'Video' ? 'video' : 'image');
    const meta = media?.original_name || media?.name || url || 'Aucun média sélectionné';
    const canCrop = type === 'Image' && media?.id && url && !isPdf && !isVideo;
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <div class="media-field" data-field="${escapeHtml(inputName)}">
          <div class="media-preview" style="cursor:pointer" onclick="openMediaPicker('${pickerType}', '${blockId}', '${escapeHtml(inputName)}', { trigger: this })">
            ${url ? (isPdf ? `<div class="media-preview-icon" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f8f9fa;border-radius:8px;padding:1rem;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg></div>` : isVideo ? `<div class="media-preview-icon">🎬</div>` : `<img src="${escapeHtml(getOptimizedUrl(url, 400, 70))}" alt="${escapeHtml(meta)}">`) : ''}
          </div>
          <div class="media-preview-meta">${escapeHtml(meta)}</div>
          <input type="hidden" name="${escapeHtml(inputName)}"${rfieldAttr} value="${escapeHtml(media ? JSON.stringify(media) : '')}">
          <div class="media-field-actions">
            <button type="button" class="btn btn-sm btn-outline" onclick="openMediaPicker('${pickerType}', '${blockId}', '${escapeHtml(inputName)}', { trigger: this })">Choisir</button>
            ${canCrop ? `<button type="button" class="btn btn-sm btn-outline" onclick="openCropEditorForField(${media.id}, '${escapeHtml(url)}', '${blockId}', '${escapeHtml(inputName)}', this)">Recadrer</button>` : ''}
            <button type="button" class="btn btn-sm btn-outline" onclick="clearMediaSelection('${blockId}', '${escapeHtml(inputName)}', this)">Retirer</button>
          </div>
        </div>
      </div>
    `;
  }
  if (type === 'Email') {
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <input type="email" class="form-input" name="${escapeHtml(inputName)}"${rfieldAttr} value="${safeValue}">
      </div>
    `;
  }
  if (type === 'Password') {
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(label)}</label>
        <input type="password" class="form-input" name="${escapeHtml(inputName)}"${rfieldAttr} value="${safeValue}">
      </div>
    `;
  }
  if (type === 'GoogleMap') {
    const mapObj = (value && typeof value === 'object') ? value : {};
    const mapLat = mapObj.lat || '';
    const mapLng = mapObj.lng || '';
    const mapPlaceId = mapObj.place_id || '';
    const mapAddress = mapObj.address || mapObj.name || '';
    const mapStreetNumber = mapObj.street_number || '';
    const mapStreetName = mapObj.street_name || '';
    const mapStreetNameShort = mapObj.street_name_short || '';
    const mapPostCode = mapObj.post_code || '';
    const mapCity = mapObj.city || '';
    const mapName = mapObj.name || '';
    const uid = `gmap-${blockId}-${inputName}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    // Defer initialization to next tick so the DOM is ready
    setTimeout(() => initGoogleMapField(uid), 0);
    return `
      <div class="form-group googlemap-field-group" id="${uid}">
        <label class="form-label">${escapeHtml(label)}</label>
        <div class="googlemap-field" data-field="${escapeHtml(inputName)}">
          <div class="googlemap-search-wrapper">
            <input type="text" class="form-input googlemap-search" name="${escapeHtml(inputName)}__search" placeholder="Rechercher une adresse…" value="${escapeHtml(mapAddress)}" autocomplete="off">
            <div class="googlemap-suggestions"></div>
          </div>
          <div class="googlemap-coords">
            <div class="googlemap-coord-field">
              <label class="form-label form-label-sm">Latitude</label>
              <input type="text" class="form-input form-input-sm" name="${escapeHtml(inputName)}__lat" value="${escapeHtml(String(mapLat))}" placeholder="ex: 48.8566">
            </div>
            <div class="googlemap-coord-field">
              <label class="form-label form-label-sm">Longitude</label>
              <input type="text" class="form-input form-input-sm" name="${escapeHtml(inputName)}__lng" value="${escapeHtml(String(mapLng))}" placeholder="ex: 2.3522">
            </div>
            <div class="googlemap-coord-field">
              <label class="form-label form-label-sm">Place ID</label>
              <input type="text" class="form-input form-input-sm" name="${escapeHtml(inputName)}__place_id" value="${escapeHtml(mapPlaceId)}" placeholder="(optionnel)">
            </div>
          </div>
          <input type="hidden" name="${escapeHtml(inputName)}__street_number" value="${escapeHtml(mapStreetNumber)}">
          <input type="hidden" name="${escapeHtml(inputName)}__street_name" value="${escapeHtml(mapStreetName)}">
          <input type="hidden" name="${escapeHtml(inputName)}__street_name_short" value="${escapeHtml(mapStreetNameShort)}">
          <input type="hidden" name="${escapeHtml(inputName)}__post_code" value="${escapeHtml(mapPostCode)}">
          <input type="hidden" name="${escapeHtml(inputName)}__city" value="${escapeHtml(mapCity)}">
          <input type="hidden" name="${escapeHtml(inputName)}__name" value="${escapeHtml(mapName)}">
          <div class="googlemap-preview"></div>
        </div>
      </div>
    `;
  }
  if (type === 'Repeater') {
    return renderRepeaterFieldHTML(field, value, blockId, rowCtx);
  }
  if (type === 'FlexibleContent') {
    return renderFlexibleContentFieldHTML(field, value, blockId, rowCtx);
  }
  if (type === 'Group') {
    return renderGroupFieldHTML(field, value, blockId, rowCtx);
  }
  return `
    <div class="form-group">
      <label class="form-label">${escapeHtml(label)}</label>
      <input type="text" class="form-input" name="${escapeHtml(inputName)}"${rfieldAttr} value="${safeValue}">
    </div>
  `;
}

// ── Repeater UI ──────────────────────────────────────────────────────────────

function renderRepeaterFieldHTML(field, value, blockId, rowCtx) {
  const rows = Array.isArray(value) ? value : [];
  const subFields = field.subFields || [];
  // Build compound name when nested inside a Repeater/FC item, so child input
  // names stay unique across e.g. ColumnsTab columns containing the same module.
  let compoundName = field.name;
  if (rowCtx) {
    compoundName = rowCtx.rowIndex !== null
      ? `${rowCtx.parentName}::${rowCtx.rowIndex}::${field.name}`
      : `${rowCtx.parentName}::${field.name}`;
  }

  // Columns repeater → vertical tabs rail on the left, active column content on the right
  const isColumnsRepeater = field.name === 'columns_list';
  const rowLabel = isColumnsRepeater ? 'Colonne' : 'Élément';
  const rowsHtml = rows.map((rowData, i) =>
    renderRepeaterRowHTML(subFields, rowData, i, blockId, compoundName, rowLabel)
  ).join('');

  if (isColumnsRepeater) {
    const tabsHtml = rows.map((_, i) => `
      <button type="button" class="cols-vtab ${i === 0 ? 'is-active' : ''}" data-tab-index="${i}" title="Colonne ${i + 1}" onclick="switchColsTab(this)">
        <span class="cols-vtab-num">${i + 1}</span>
      </button>
    `).join('');
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(field.label || field.name)}</label>
        <div class="repeater-field cols-vtabs-wrapper" data-field-name="${escapeHtml(field.name)}" data-field-compound="${escapeHtml(compoundName)}" data-block-id="${escapeHtml(blockId)}" data-cols-mode="vtabs" data-active-tab="0">
          <div class="cols-vtabs-rail">
            ${tabsHtml}
            <button type="button" class="cols-vtab cols-vtab-add" title="Ajouter une colonne"
              onclick="addRepeaterRow(this, '${escapeHtml(blockId)}', '${escapeHtml(field.name)}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
          <div class="cols-vtabs-actions">
            <button type="button" class="btn-icon-sm" title="Monter la colonne" onclick="colsVtabAction(this, 'up')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button type="button" class="btn-icon-sm" title="Descendre la colonne" onclick="colsVtabAction(this, 'down')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
            <button type="button" class="btn-icon-sm" title="Dupliquer la colonne" onclick="colsVtabAction(this, 'dup')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button type="button" class="btn-icon-sm btn-icon-sm--danger" title="Supprimer la colonne" onclick="colsVtabAction(this, 'del')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
          <div class="repeater-rows cols-vtabs-content">${rowsHtml}</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="form-group">
      <label class="form-label">${escapeHtml(field.label || field.name)}</label>
      <div class="repeater-field" data-field-name="${escapeHtml(field.name)}" data-field-compound="${escapeHtml(compoundName)}" data-block-id="${escapeHtml(blockId)}">
        <div class="repeater-rows">${rowsHtml}</div>
        <button type="button" class="repeater-add-btn"
          onclick="addRepeaterRow(this, '${escapeHtml(blockId)}', '${escapeHtml(field.name)}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ajouter
        </button>
      </div>
    </div>
  `;
}


function renderRepeaterRowHTML(subFields, rowData, rowIndex, blockId, repeaterName, rowLabel = 'Élément') {
  const rowCtx = { parentName: repeaterName, rowIndex };
  const bodyHtml = subFields.map(f => {
    const val = rowData[f.name] !== undefined ? rowData[f.name] : f.defaultValue;
    return renderSchemaField(f, val, blockId, rowData, rowCtx);
  }).join('');
  return `
    <div class="repeater-row" data-row-index="${rowIndex}" data-row-label="${escapeHtml(rowLabel)}">
      <div class="repeater-row-header" onclick="toggleRepeaterRow(this)">
        <span class="repeater-row-number">${rowIndex + 1}</span>
        <span class="repeater-row-title">${escapeHtml(rowLabel)} ${rowIndex + 1}</span>
        <div class="repeater-row-actions">
          <button type="button" class="btn-icon-sm" title="Monter"
            onclick="event.stopPropagation(); moveRepeaterRow(this, -1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
          <button type="button" class="btn-icon-sm" title="Descendre"
            onclick="event.stopPropagation(); moveRepeaterRow(this, 1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <button type="button" class="btn-icon-sm" title="Dupliquer"
            onclick="event.stopPropagation(); duplicateRepeaterRow(this)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button type="button" class="btn-icon-sm btn-icon-sm--danger" title="Supprimer"
            onclick="event.stopPropagation(); removeRepeaterRow(this)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
        <svg class="repeater-row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="repeater-row-body" style="display:none">${bodyHtml}</div>
    </div>
  `;
}

function renderGroupFieldHTML(field, value, blockId, parentRowCtx) {
  const subFields = field.subFields || [];
  const groupData = (value && typeof value === 'object') ? value : {};
  let compoundName = field.name;
  if (parentRowCtx) {
    compoundName = parentRowCtx.rowIndex !== null
      ? `${parentRowCtx.parentName}::${parentRowCtx.rowIndex}::${field.name}`
      : `${parentRowCtx.parentName}::${field.name}`;
  }
  const rowCtx = { parentName: compoundName, rowIndex: null };
  const bodyHtml = subFields.map(f => {
    const val = groupData[f.name] !== undefined ? groupData[f.name] : f.defaultValue;
    return renderSchemaField(f, val, blockId, groupData, rowCtx);
  }).join('');
  return `
    <div class="group-field">
      <div class="group-field-header" onclick="toggleGroupField(this)">
        <span class="group-field-title">${escapeHtml(field.label || field.name)}</span>
        <svg class="group-field-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="group-field-body" style="display:none">${bodyHtml}</div>
    </div>
  `;
}

// ── FlexibleContent UI ──────────────────────────────────────────────────────

function renderFlexibleContentFieldHTML(field, value, blockId, rowCtx) {
  const items = Array.isArray(value) ? value : [];
  const fcFieldName = field.name;
  // Build the compound name for this flex field (could be nested inside a repeater)
  let fcCompoundName = fcFieldName;
  if (rowCtx) {
    fcCompoundName = rowCtx.rowIndex !== null
      ? `${rowCtx.parentName}::${rowCtx.rowIndex}::${fcFieldName}`
      : `${rowCtx.parentName}::${fcFieldName}`;
  }

  const itemsHtml = items.map((item, i) =>
    renderFlexibleContentItemHTML(item, i, blockId, fcCompoundName)
  ).join('');

  // Build the module type dropdown — exclude ColumnsTab (infinite nesting) and legacy blocks
  // (legacy types like 'text' collide with Nickl layout slugs and aren't meant for sub-modules)
  const excludeTypes = new Set(['columns-tab', 'ColumnsTab']);
  const dropdownOptions = Object.entries(BLOCK_TYPES)
    .filter(([key, def]) => !def.aliasFor && !def.legacy && !excludeTypes.has(key))
    .map(([key, def]) => `<option value="${escapeHtml(key)}">${escapeHtml(def.label || key)}</option>`)
    .join('');

  return `
    <div class="form-group">
      <label class="form-label">${escapeHtml(field.label || field.name)}</label>
      <div class="flexible-content-field" data-field-name="${escapeHtml(fcCompoundName)}" data-block-id="${escapeHtml(blockId)}">
        <div class="flexible-content-items">${itemsHtml}</div>
        <div class="flexible-content-add">
          <select class="form-select flexible-content-type-select">
            <option value="">— Choisir un module —</option>
            ${dropdownOptions}
          </select>
          <button type="button" class="repeater-add-btn"
            onclick="addFlexibleContentItem(this, '${escapeHtml(blockId)}', '${escapeHtml(fcCompoundName)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ajouter
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderFlexibleContentItemHTML(item, index, blockId, fcCompoundName) {
  const layout = item.acf_fc_layout || '';
  const def = BLOCK_TYPES[layout] || {};
  let moduleName = def.moduleName || layout;
  // Fallback: layout may be a slug (e.g. 'text' for TextSimple) — resolve via reverse map
  if (!moduleFieldSchema?.modules?.[moduleName]) {
    const map = getLayoutToModuleNameMap();
    if (map[layout]) moduleName = map[layout];
  }
  const moduleLabel = def.label || MODULE_LABELS[moduleName] || layout;

  // Get schema fields for this module type
  const schemaFields = moduleFieldSchema?.modules?.[moduleName]?.fields || [];
  // Filter out BlockParams fields that are handled by the parent wrapper
  const skipFields = new Set(['title_bloc', 'title_style', 'title_align', 'bloc_color', 'padding_top', 'padding_bottom', 'is_visible', 'bg_img', 'bg_opacity', 'bg_parallax']);
  const itemFields = schemaFields.filter(f => !skipFields.has(f.name));

  // Seed missing fields with defaults so conditionals evaluate correctly on new sub-modules
  for (const sf of schemaFields) {
    if (item[sf.name] === undefined && sf.defaultValue !== undefined) {
      item[sf.name] = sf.defaultValue;
    }
  }

  const rowCtx = { parentName: `${fcCompoundName}::${index}`, rowIndex: null };
  const bodyHtml = itemFields.map(f => {
    const val = item[f.name] !== undefined ? item[f.name] : f.defaultValue;
    return renderSchemaField(f, val, blockId, item, rowCtx);
  }).join('');

  return `
    <div class="repeater-row flexible-content-item" data-row-index="${index}" data-layout="${escapeHtml(layout)}">
      <input type="hidden" name="${escapeHtml(fcCompoundName)}::${index}::acf_fc_layout" value="${escapeHtml(layout)}">
      <div class="repeater-row-header" onclick="toggleRepeaterRow(this)">
        <span class="repeater-row-number">${index + 1}</span>
        <span class="repeater-row-title">${escapeHtml(moduleLabel)}</span>
        <div class="repeater-row-actions">
          <button type="button" class="btn-icon-sm" title="Monter"
            onclick="event.stopPropagation(); moveFlexibleContentItem(this, -1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
          <button type="button" class="btn-icon-sm" title="Descendre"
            onclick="event.stopPropagation(); moveFlexibleContentItem(this, 1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <button type="button" class="btn-icon-sm" title="Dupliquer"
            onclick="event.stopPropagation(); duplicateFlexibleContentItem(this)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button type="button" class="btn-icon-sm btn-icon-sm--danger" title="Supprimer"
            onclick="event.stopPropagation(); removeFlexibleContentItem(this)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
        <svg class="repeater-row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="repeater-row-body" style="display:none">${bodyHtml}</div>
    </div>
  `;
}

function collectFlexibleContentData(form, fcCompoundName) {
  const container = form.querySelector(`.flexible-content-field[data-field-name="${CSS.escape(fcCompoundName)}"]`);
  if (!container) return [];
  const items = container.querySelectorAll(':scope > .flexible-content-items > .flexible-content-item');
  return Array.from(items).map((itemEl, idx) => {
    const layout = itemEl.dataset.layout || '';
    const def = BLOCK_TYPES[layout] || {};
    let moduleName = def.moduleName || layout;
    // Fallback: layout may be a slug (e.g. 'text' for TextSimple) — resolve via reverse map
    if (!moduleFieldSchema?.modules?.[moduleName]) {
      const map = getLayoutToModuleNameMap();
      if (map[layout]) moduleName = map[layout];
    }
    const schemaFields = moduleFieldSchema?.modules?.[moduleName]?.fields || [];
    const skipFields = new Set(['title_bloc', 'title_style', 'title_align', 'bloc_color', 'padding_top', 'padding_bottom', 'is_visible', 'bg_img', 'bg_opacity', 'bg_parallax']);
    const itemFields = schemaFields.filter(f => !skipFields.has(f.name));

    const parentName = `${fcCompoundName}::${idx}`;
    const itemData = { acf_fc_layout: layout };
    for (const f of itemFields) {
      const compoundName = `${parentName}::${f.name}`;
      if (f.type === 'Image' || f.type === 'File' || f.type === 'Video') {
        const mediaInput = itemEl.querySelector(`.media-field[data-field="${CSS.escape(compoundName)}"] input[type="hidden"]`);
        if (mediaInput?.value) {
          try { itemData[f.name] = JSON.parse(mediaInput.value); } catch { itemData[f.name] = mediaInput.value; }
        } else {
          itemData[f.name] = '';
        }
      } else if (f.type === 'TrueFalse') {
        const input = itemEl.querySelector(`[name="${CSS.escape(compoundName)}"]`);
        itemData[f.name] = input ? !!input.checked : false;
      } else if (f.type === 'ButtonGroup' || f.type === 'RadioButton') {
        const checked = itemEl.querySelector(`[name="${CSS.escape(compoundName)}"]:checked`);
        itemData[f.name] = checked ? checked.value : '';
      } else if (f.type === 'Number' || f.type === 'Range') {
        const input = itemEl.querySelector(`[name="${CSS.escape(compoundName)}"]`);
        itemData[f.name] = input ? (input.value === '' ? '' : Number(input.value)) : '';
      } else if (f.type === 'URL' || f.type === 'Url' || f.type === 'Link') {
        const urlInput = itemEl.querySelector(`[name="${CSS.escape(compoundName + '__url')}"]`);
        const titleInput = itemEl.querySelector(`[name="${CSS.escape(compoundName + '__title')}"]`);
        const targetInput = itemEl.querySelector(`[name="${CSS.escape(compoundName + '__target')}"]`);
        const url = urlInput ? urlInput.value : '';
        itemData[f.name] = url ? { url, title: titleInput ? titleInput.value : '', target: targetInput ? targetInput.value : '_self' } : '';
      } else if (f.type === 'GoogleMap') {
        const latInput = itemEl.querySelector(`[name="${CSS.escape(compoundName + '__lat')}"]`);
        const lngInput = itemEl.querySelector(`[name="${CSS.escape(compoundName + '__lng')}"]`);
        const placeIdInput = itemEl.querySelector(`[name="${CSS.escape(compoundName + '__place_id')}"]`);
        const searchInput = itemEl.querySelector(`[name="${CSS.escape(compoundName + '__search')}"]`);
        const streetNumberInput = itemEl.querySelector(`[name="${CSS.escape(compoundName + '__street_number')}"]`);
        const streetNameInput = itemEl.querySelector(`[name="${CSS.escape(compoundName + '__street_name')}"]`);
        const streetNameShortInput = itemEl.querySelector(`[name="${CSS.escape(compoundName + '__street_name_short')}"]`);
        const postCodeInput = itemEl.querySelector(`[name="${CSS.escape(compoundName + '__post_code')}"]`);
        const cityInput = itemEl.querySelector(`[name="${CSS.escape(compoundName + '__city')}"]`);
        const nameInput = itemEl.querySelector(`[name="${CSS.escape(compoundName + '__name')}"]`);
        const lat = latInput ? parseFloat(latInput.value) : 0;
        const lng = lngInput ? parseFloat(lngInput.value) : 0;
        itemData[f.name] = (lat || lng) ? {
          lat: lat || 0,
          lng: lng || 0,
          place_id: placeIdInput ? placeIdInput.value : '',
          address: searchInput ? searchInput.value : '',
          name: nameInput ? nameInput.value : (searchInput ? searchInput.value : ''),
          street_number: streetNumberInput ? streetNumberInput.value : '',
          street_name: streetNameInput ? streetNameInput.value : '',
          street_name_short: streetNameShortInput ? streetNameShortInput.value : '',
          post_code: postCodeInput ? postCodeInput.value : '',
          city: cityInput ? cityInput.value : '',
        } : null;
      } else if (f.type === 'FlexibleContent') {
        itemData[f.name] = collectFlexibleContentData(form, compoundName);
      } else if (f.type === 'Repeater') {
        itemData[f.name] = collectRepeaterData(itemEl, f.name, f.subFields || []);
      } else {
        const input = itemEl.querySelector(`[name="${CSS.escape(compoundName)}"]`);
        itemData[f.name] = input ? input.value : '';
      }
    }
    return itemData;
  });
}

function addFlexibleContentItem(button, blockId, fcCompoundName) {
  const container = button.closest('.flexible-content-field');
  if (!container) return;
  const select = container.querySelector('.flexible-content-type-select');
  const selectedType = select ? select.value : '';
  if (!selectedType) {
    alert('Veuillez choisir un type de module.');
    return;
  }

  // Collect existing items data
  const form = container.closest('form');
  const existingData = form ? collectFlexibleContentData(form, fcCompoundName) : [];

  // Add new item
  existingData.push({ acf_fc_layout: selectedType });

  // Re-render all items
  reRenderFlexibleContentItems(container, existingData, blockId, fcCompoundName);

  // Reset dropdown
  if (select) select.value = '';

  // Sync to block data
  syncFlexibleContentToBlock(blockId, fcCompoundName, existingData);

  // Expand the last item
  const items = container.querySelectorAll('.flexible-content-items > .flexible-content-item');
  const lastItem = items[items.length - 1];
  if (lastItem) {
    const body = lastItem.querySelector('.repeater-row-body');
    if (body) body.style.display = '';
    lastItem.classList.add('is-open');
  }
}

function removeFlexibleContentItem(button) {
  const item = button.closest('.flexible-content-item');
  const container = item?.closest('.flexible-content-field');
  if (!container) return;
  const blockId = container.dataset.blockId;
  const fcCompoundName = container.dataset.fieldName;
  const form = container.closest('form');
  const allData = form ? collectFlexibleContentData(form, fcCompoundName) : [];
  const idx = parseInt(item.dataset.rowIndex, 10);
  allData.splice(idx, 1);
  reRenderFlexibleContentItems(container, allData, blockId, fcCompoundName);
  syncFlexibleContentToBlock(blockId, fcCompoundName, allData);
}

function moveFlexibleContentItem(button, direction) {
  const item = button.closest('.flexible-content-item');
  const container = item?.closest('.flexible-content-field');
  if (!container) return;
  const blockId = container.dataset.blockId;
  const fcCompoundName = container.dataset.fieldName;
  const form = container.closest('form');
  const allData = form ? collectFlexibleContentData(form, fcCompoundName) : [];
  const idx = parseInt(item.dataset.rowIndex, 10);
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= allData.length) return;
  [allData[idx], allData[targetIdx]] = [allData[targetIdx], allData[idx]];
  reRenderFlexibleContentItems(container, allData, blockId, fcCompoundName);
  syncFlexibleContentToBlock(blockId, fcCompoundName, allData);
}

function duplicateFlexibleContentItem(button) {
  const item = button.closest('.flexible-content-item');
  const container = item?.closest('.flexible-content-field');
  if (!container) return;
  const blockId = container.dataset.blockId;
  const fcCompoundName = container.dataset.fieldName;
  const form = container.closest('form');
  const allData = form ? collectFlexibleContentData(form, fcCompoundName) : [];
  const idx = parseInt(item.dataset.rowIndex, 10);
  const clone = JSON.parse(JSON.stringify(allData[idx]));
  allData.splice(idx + 1, 0, clone);
  reRenderFlexibleContentItems(container, allData, blockId, fcCompoundName);
  syncFlexibleContentToBlock(blockId, fcCompoundName, allData);
  const items = container.querySelectorAll('.flexible-content-items > .flexible-content-item');
  const dup = items[idx + 1];
  if (dup) {
    const body = dup.querySelector('.repeater-row-body');
    if (body) body.style.display = '';
    dup.classList.add('is-open');
  }
}

function reRenderFlexibleContentItems(container, allData, blockId, fcCompoundName) {
  destroyWysiwygEditors(container);
  const itemsContainer = container.querySelector('.flexible-content-items');
  itemsContainer.innerHTML = allData.map((itemData, i) =>
    renderFlexibleContentItemHTML(itemData, i, blockId, fcCompoundName)
  ).join('');
  const form = container.closest('form');
  if (form) updateSchemaConditionals(form);
  initWysiwygEditors(container);
}

function syncFlexibleContentToBlock(blockId, fcCompoundName, data) {
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (!block) return;
  if (!block.data || typeof block.data !== 'object') block.data = {};

  // Parse compound name to set the correct nested path
  // e.g. "columns_list::0::columns_module" → block.data.columns_list[0].columns_module = data
  const parts = fcCompoundName.split('::');
  let target = block.data;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const isIdx = /^\d+$/.test(nextPart);
    if (/^\d+$/.test(part)) {
      const idx = parseInt(part, 10);
      if (!Array.isArray(target)) break;
      if (!target[idx] || typeof target[idx] !== 'object') target[idx] = {};
      target = target[idx];
    } else {
      if (isIdx) {
        if (!Array.isArray(target[part])) target[part] = [];
      } else {
        if (!target[part] || typeof target[part] !== 'object') target[part] = {};
      }
      target = target[part];
    }
  }
  const lastPart = parts[parts.length - 1];
  target[lastPart] = data;

  updateBlockCardPreview(blockId);
}

// ── Repeater interactions ─────────────────────────────────────────────────────

function toggleRepeaterRow(header) {
  const row = header.closest('.repeater-row');
  if (!row) return;
  const body = row.querySelector('.repeater-row-body');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  row.classList.toggle('is-open', !open);
  // Initialize deferred Quill editors now that the container is visible
  if (!open) initWysiwygEditors(body);
  if (typeof updateBuilderBreadcrumb === 'function') updateBuilderBreadcrumb();
}

function toggleGroupField(header) {
  const group = header.closest('.group-field');
  if (!group) return;
  const body = group.querySelector('.group-field-body');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  group.classList.toggle('is-open', !open);
  if (typeof updateBuilderBreadcrumb === 'function') updateBuilderBreadcrumb();
}

// ── Settings breadcrumb ──────────────────────────────────────────────────────
// Walks from the settings panel root, picking the active path through cols-tabs,
// open repeater rows and open groups. Label = visible row title.
function updateBuilderBreadcrumb() {
  const bc = document.getElementById('builderBreadcrumb');
  if (!bc) return;
  const panel = document.getElementById('builderSettings');
  if (!panel) { bc.innerHTML = ''; return; }
  const segments = [];

  function walk(scope) {
    if (!scope) return;
    // Open repeater row inside this scope (accordion mode)
    const openRow = scope.querySelector(':scope .repeater-row.is-open');
    if (!openRow) return;
    const label = openRow.querySelector(':scope > .repeater-row-header > .repeater-row-title')?.textContent?.trim();
    if (label) segments.push({ label, target: openRow });
    walk(openRow.querySelector(':scope > .repeater-row-body'));
  }

  // Start at the form, skip the panel header
  const form = panel.querySelector('.builder-block-form');
  if (form) walk(form);

  if (!segments.length) { bc.innerHTML = ''; return; }
  bc.innerHTML = segments.map((s, i) => {
    const sep = i > 0 ? '<span class="builder-breadcrumb-sep">›</span>' : '';
    return `${sep}<span class="builder-breadcrumb-item" data-bc-index="${i}">${escapeHtml(s.label)}</span>`;
  }).join('');
  // Wire click handlers — scroll target into view + briefly highlight
  bc.querySelectorAll('.builder-breadcrumb-item').forEach((el, i) => {
    el.addEventListener('click', () => {
      const target = segments[i]?.target;
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function _getRepeaterSchema(blockId, fieldName, domContext) {
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (!block) return null;

  let moduleName;
  // When inside a flexible content sub-module, look up the sub-module's schema
  if (domContext) {
    const fcItem = domContext.closest('.flexible-content-item');
    if (fcItem) {
      const layout = fcItem.dataset.layout || '';
      const subDef = BLOCK_TYPES[layout] || {};
      moduleName = subDef.moduleName || layout;
    }
  }
  if (!moduleName) {
    const def = BLOCK_TYPES[block.type] || {};
    moduleName = def.moduleName || block.type;
  }
  const schemaFields = moduleFieldSchema?.modules?.[moduleName]?.fields || [];
  return schemaFields.find(f => f.name === fieldName && f.type === 'Repeater') || null;
}

// Collect repeater data directly from a container element (avoids form-wide search ambiguity)
function _collectRepeaterFromContainer(container, fieldName, subFields) {
  // Use compound name for input name queries when nested (ensures sub-field
  // inputs match unique names like "columns_list::0::columns_module::0::logos::0::logo")
  const compound = container.dataset.fieldCompound || fieldName;
  const rows = container.querySelectorAll(':scope > .repeater-rows > .repeater-row');
  return Array.from(rows).map((row, i) =>
    collectContainerData(row, compound, subFields, i)
  );
}

// Sync repeater data to block.data — handles nested sub-module context
function _syncRepeaterToBlock(container, blockId) {
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (!block) return;
  // If inside a flexible content sub-module, re-collect the entire block data
  const fcItem = container.closest('.flexible-content-item');
  if (fcItem) {
    const form = container.closest('form');
    if (form) liveUpdateFromSettingsForm(form);
  } else {
    // Direct field — collect from container
    const fieldName = container.dataset.fieldName;
    const repeaterField = _getRepeaterSchema(blockId, fieldName, container);
    if (!repeaterField?.subFields) return;
    if (!block.data || typeof block.data !== 'object') block.data = {};
    block.data[fieldName] = _collectRepeaterFromContainer(container, fieldName, repeaterField.subFields);
  }
  updateBlockCardPreview(blockId);
}

function collectContainerData(scope, parentName, subFields, rowIndex) {
  const rowData = {};
  for (const f of subFields) {
    const compoundName = rowIndex !== null
      ? `${parentName}::${rowIndex}::${f.name}`
      : `${parentName}::${f.name}`;
    if (f.type === 'Image' || f.type === 'File' || f.type === 'Video') {
      const mediaInput = scope.querySelector(`.media-field[data-field="${CSS.escape(compoundName)}"] input[type="hidden"]`);
      if (mediaInput?.value) {
        try { rowData[f.name] = JSON.parse(mediaInput.value); } catch { rowData[f.name] = mediaInput.value; }
      } else {
        rowData[f.name] = '';
      }
    } else if (f.type === 'TrueFalse') {
      const input = scope.querySelector(`[name="${CSS.escape(compoundName)}"]`);
      rowData[f.name] = input ? !!input.checked : false;
    } else if (f.type === 'ButtonGroup' || f.type === 'RadioButton') {
      const checked = scope.querySelector(`[name="${CSS.escape(compoundName)}"]:checked`);
      rowData[f.name] = checked ? checked.value : '';
    } else if (f.type === 'Number' || f.type === 'Range') {
      const input = scope.querySelector(`[name="${CSS.escape(compoundName)}"]`);
      rowData[f.name] = input ? (input.value === '' ? '' : Number(input.value)) : '';
    } else if (f.type === 'URL' || f.type === 'Url' || f.type === 'Link') {
      const urlInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__url')}"]`);
      const titleInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__title')}"]`);
      const targetInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__target')}"]`);
      const url = urlInput ? urlInput.value : '';
      rowData[f.name] = url ? { url, title: titleInput ? titleInput.value : '', target: targetInput ? targetInput.value : '_self' } : '';
    } else if (f.type === 'GoogleMap') {
      const latInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__lat')}"]`);
      const lngInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__lng')}"]`);
      const placeIdInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__place_id')}"]`);
      const searchInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__search')}"]`);
      const streetNumberInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__street_number')}"]`);
      const streetNameInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__street_name')}"]`);
      const streetNameShortInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__street_name_short')}"]`);
      const postCodeInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__post_code')}"]`);
      const cityInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__city')}"]`);
      const nameInput = scope.querySelector(`[name="${CSS.escape(compoundName + '__name')}"]`);
      const lat = latInput ? parseFloat(latInput.value) : 0;
      const lng = lngInput ? parseFloat(lngInput.value) : 0;
      rowData[f.name] = (lat || lng) ? {
        lat: lat || 0,
        lng: lng || 0,
        place_id: placeIdInput ? placeIdInput.value : '',
        address: searchInput ? searchInput.value : '',
        name: nameInput ? nameInput.value : (searchInput ? searchInput.value : ''),
        street_number: streetNumberInput ? streetNumberInput.value : '',
        street_name: streetNameInput ? streetNameInput.value : '',
        street_name_short: streetNameShortInput ? streetNameShortInput.value : '',
        post_code: postCodeInput ? postCodeInput.value : '',
        city: cityInput ? cityInput.value : '',
      } : null;
    } else if (f.type === 'FlexibleContent') {
      const form = scope.closest('form') || scope;
      rowData[f.name] = collectFlexibleContentData(form, compoundName);
    } else if (f.type === 'Repeater') {
      rowData[f.name] = collectRepeaterData(scope, f.name, f.subFields || []);
    } else {
      const input = scope.querySelector(`[name="${CSS.escape(compoundName)}"]`);
      rowData[f.name] = input ? input.value : '';
    }
  }
  return rowData;
}

function collectRepeaterData(form, repeaterName, subFields) {
  const container = form.querySelector(`.repeater-field[data-field-name="${CSS.escape(repeaterName)}"]`);
  if (!container) return [];
  // Use compound name for sub-field input lookups when this repeater is nested
  // inside a FlexibleContent item (e.g. ColumnsTab columns).
  const compound = container.dataset.fieldCompound || repeaterName;
  // Use :scope > .repeater-rows > .repeater-row to avoid selecting nested
  // FlexibleContent items that also have the .repeater-row class.
  const rows = container.querySelectorAll(':scope > .repeater-rows > .repeater-row');
  return Array.from(rows).map((row, rowIndex) =>
    collectContainerData(row, compound, subFields, rowIndex)
  );
}

function reRenderRepeaterRows(container, subFields, allData, blockId, repeaterName) {
  destroyWysiwygEditors(container);
  const rowsContainer = container.querySelector('.repeater-rows');
  const isVtabs = container.dataset.colsMode === 'vtabs';
  const rowLabel = container.dataset.fieldName === 'columns_list' ? 'Colonne' : 'Élément';
  rowsContainer.innerHTML = allData.map((rowData, i) =>
    renderRepeaterRowHTML(subFields, rowData, i, blockId, repeaterName, rowLabel)
  ).join('');
  if (isVtabs) _refreshColsVtabsRail(container);
  const form = container.closest('form');
  if (form) updateSchemaConditionals(form);
  initWysiwygEditors(container);
}

function switchColsTab(tabBtn) {
  const wrapper = tabBtn.closest('.cols-vtabs-wrapper');
  if (!wrapper) return;
  const idx = tabBtn.dataset.tabIndex;
  wrapper.dataset.activeTab = idx;
  wrapper.querySelectorAll(':scope > .cols-vtabs-rail > .cols-vtab').forEach(b => b.classList.toggle('is-active', b.dataset.tabIndex === idx));
  // Initialize deferred Quill editors in the newly visible column
  const activeRow = wrapper.querySelector(`.cols-vtabs-content > .repeater-row[data-row-index="${idx}"]`);
  if (activeRow) initWysiwygEditors(activeRow);
  if (typeof updateBuilderBreadcrumb === 'function') updateBuilderBreadcrumb();
}

// Proxy actions on the active column to the (hidden) row's action buttons
function colsVtabAction(button, action) {
  const wrapper = button.closest('.cols-vtabs-wrapper');
  if (!wrapper) return;
  const active = wrapper.dataset.activeTab || '0';
  const row = wrapper.querySelector(`.cols-vtabs-content > .repeater-row[data-row-index="${active}"]`);
  if (!row) return;
  const titleMap = { up: 'Monter', down: 'Descendre', dup: 'Dupliquer', del: 'Supprimer' };
  const target = row.querySelector(`.repeater-row-actions [title="${titleMap[action]}"]`);
  if (target) target.click();
}

function _refreshColsVtabsRail(wrapper) {
  if (!wrapper || wrapper.dataset.colsMode !== 'vtabs') return;
  const rows = wrapper.querySelectorAll('.cols-vtabs-content > .repeater-row');
  const rail = wrapper.querySelector(':scope > .cols-vtabs-rail');
  if (!rail) return;
  const addBtn = rail.querySelector(':scope > .cols-vtab-add');
  const total = rows.length;
  let active = parseInt(wrapper.dataset.activeTab || '0', 10);
  if (active >= total) active = Math.max(0, total - 1);
  wrapper.dataset.activeTab = String(active);
  const tabsHtml = Array.from(rows).map((_, i) => `
    <button type="button" class="cols-vtab ${i === active ? 'is-active' : ''}" data-tab-index="${i}" title="Colonne ${i + 1}" onclick="switchColsTab(this)">
      <span class="cols-vtab-num">${i + 1}</span>
    </button>
  `).join('');
  const fragment = document.createElement('div');
  fragment.innerHTML = tabsHtml;
  const newBtns = Array.from(fragment.children);
  rail.querySelectorAll(':scope > .cols-vtab:not(.cols-vtab-add)').forEach(b => b.remove());
  newBtns.forEach(b => rail.insertBefore(b, addBtn));
}

function addRepeaterRow(button, blockId, fieldName) {
  const container = button.closest('.repeater-field');
  if (!container) return;
  const repeaterField = _getRepeaterSchema(blockId, fieldName, container);
  if (!repeaterField?.subFields) return;
  const compound = container.dataset.fieldCompound || fieldName;
  const existingData = _collectRepeaterFromContainer(container, fieldName, repeaterField.subFields);
  // Initialize new row: default TrueFalse sub-fields to true so image/visibility fields start ON
  const newRowDefaults = {};
  for (const f of repeaterField.subFields) {
    if (f.type === 'TrueFalse') newRowDefaults[f.name] = true;
  }
  existingData.push(newRowDefaults);
  reRenderRepeaterRows(container, repeaterField.subFields, existingData, blockId, compound);
  _syncRepeaterToBlock(container, blockId);
  // Expand the last row (or activate its tab in vtabs mode)
  const rows = container.querySelectorAll(':scope > .repeater-rows > .repeater-row');
  const lastRow = rows[rows.length - 1];
  if (lastRow) {
    const body = lastRow.querySelector('.repeater-row-body');
    if (body) body.style.display = '';
    lastRow.classList.add('is-open');
  }
  if (container.dataset.colsMode === 'vtabs') {
    const lastIdx = String(rows.length - 1);
    container.dataset.activeTab = lastIdx;
    container.querySelectorAll(':scope > .cols-vtabs-rail > .cols-vtab').forEach(b => b.classList.toggle('is-active', b.dataset.tabIndex === lastIdx));
  }
  const form = container.closest('form');
  if (form) updateSchemaConditionals(form);
}

function removeRepeaterRow(button) {
  const row = button.closest('.repeater-row');
  const container = row?.closest('.repeater-field');
  if (!container) return;
  const blockId = container.dataset.blockId;
  const fieldName = container.dataset.fieldName;
  const compound = container.dataset.fieldCompound || fieldName;
  const repeaterField = _getRepeaterSchema(blockId, fieldName, container);
  if (!repeaterField?.subFields) return;
  const allData = _collectRepeaterFromContainer(container, fieldName, repeaterField.subFields);
  const rowIndex = parseInt(row.dataset.rowIndex, 10);
  allData.splice(rowIndex, 1);
  reRenderRepeaterRows(container, repeaterField.subFields, allData, blockId, compound);
  _syncRepeaterToBlock(container, blockId);
}

function moveRepeaterRow(button, direction) {
  const row = button.closest('.repeater-row');
  const container = row?.closest('.repeater-field');
  if (!container) return;
  const blockId = container.dataset.blockId;
  const fieldName = container.dataset.fieldName;
  const compound = container.dataset.fieldCompound || fieldName;
  const repeaterField = _getRepeaterSchema(blockId, fieldName, container);
  if (!repeaterField?.subFields) return;
  const allData = _collectRepeaterFromContainer(container, fieldName, repeaterField.subFields);
  const rowIndex = parseInt(row.dataset.rowIndex, 10);
  const targetIndex = rowIndex + direction;
  if (targetIndex < 0 || targetIndex >= allData.length) return;
  [allData[rowIndex], allData[targetIndex]] = [allData[targetIndex], allData[rowIndex]];
  reRenderRepeaterRows(container, repeaterField.subFields, allData, blockId, compound);
  _syncRepeaterToBlock(container, blockId);
  // Expand the moved row
  const rows = container.querySelectorAll(':scope > .repeater-rows > .repeater-row');
  const movedRow = rows[targetIndex];
  if (movedRow) {
    const body = movedRow.querySelector('.repeater-row-body');
    if (body) body.style.display = '';
  }
}

function duplicateRepeaterRow(button) {
  const row = button.closest('.repeater-row');
  const container = row?.closest('.repeater-field');
  if (!container) return;
  const blockId = container.dataset.blockId;
  const fieldName = container.dataset.fieldName;
  const compound = container.dataset.fieldCompound || fieldName;
  const repeaterField = _getRepeaterSchema(blockId, fieldName, container);
  if (!repeaterField?.subFields) return;
  const allData = _collectRepeaterFromContainer(container, fieldName, repeaterField.subFields);
  const rowIndex = parseInt(row.dataset.rowIndex, 10);
  const clone = JSON.parse(JSON.stringify(allData[rowIndex]));
  allData.splice(rowIndex + 1, 0, clone);
  reRenderRepeaterRows(container, repeaterField.subFields, allData, blockId, compound);
  _syncRepeaterToBlock(container, blockId);
  const rows = container.querySelectorAll(':scope > .repeater-rows > .repeater-row');
  const dup = rows[rowIndex + 1];
  if (dup) {
    const body = dup.querySelector('.repeater-row-body');
    if (body) body.style.display = '';
    dup.classList.add('is-open');
  }
  const form = container.closest('form');
  if (form) updateSchemaConditionals(form);
}

function renderKeyValueRow(key, value) {
  return `
    <div class="kv-row">
      <input type="text" class="form-input kv-key" placeholder="Clé" value="${escapeHtml(key)}">
      <input type="text" class="form-input kv-value" placeholder="Valeur" value="${escapeHtml(value)}">
      <button type="button" class="btn btn-sm btn-outline" onclick="removeKeyValueRow(this)">Retirer</button>
    </div>
  `;
}

function addKeyValueRow() {
  const panel = document.getElementById('builderSettings');
  if (!panel) return;
  const list = panel.querySelector('.kv-list');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'kv-row';
  row.innerHTML = `
    <input type="text" class="form-input kv-key" placeholder="Clé" value="">
    <input type="text" class="form-input kv-value" placeholder="Valeur" value="">
    <button type="button" class="btn btn-sm btn-outline" onclick="removeKeyValueRow(this)">Retirer</button>
  `;
  list.appendChild(row);
}

function removeKeyValueRow(button) {
  const row = button?.closest('.kv-row');
  if (row) row.remove();
}

function saveKeyValueData(blockId, event) {
  event.preventDefault();
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (!block) return;
  const form = event.target;
  const data = {};
  form.querySelectorAll('.kv-row').forEach(row => {
    const key = row.querySelector('.kv-key')?.value?.trim();
    const value = row.querySelector('.kv-value')?.value ?? '';
    if (key) data[key] = value;
  });
  block.data = data;
  updateBlockCardPreview(blockId);
  showToast('Bloc enregistré', 'success');
}

function saveSchemaData(blockId, event) {
  event.preventDefault();
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (!block) return;
  const form = event.target;
  const def = BLOCK_TYPES[block.type] || {};
  const moduleName = def.moduleName || block.type;
  const schemaFields = moduleFieldSchema?.modules?.[moduleName]?.fields || [];
  const data = { ...(block.data && typeof block.data === 'object' ? block.data : {}) };
  schemaFields.forEach(field => {
    const name = field.name;
    const type = field.type || 'Text';
    if (type === 'Repeater') {
      const rc = form.querySelector(`.repeater-field[data-field-name="${CSS.escape(name)}"]`);
      if (!rc && data[name] !== undefined) return; // hidden repeater (e.g. Accordion inline) — keep existing data
      data[name] = collectRepeaterData(form, name, field.subFields || []);
      return;
    }
    if (type === 'FlexibleContent') {
      data[name] = collectFlexibleContentData(form, name);
      return;
    }
    if (type === 'Group') {
      data[name] = collectContainerData(form, name, field.subFields || [], null);
      return;
    }
    // Les champs média (Image / File / Video) sont déjà mis à jour
    // par le sélecteur de médiathèque. On ne les touche pas ici pour
    // éviter d'écraser les données (et donc de perdre l'image de fond)
    // à chaque changement d'un autre paramètre.
    if (type === 'Image' || type === 'File' || type === 'Video') return;
    if (type === 'GoogleMap') {
      const latInput = form.querySelector(`[name="${CSS.escape(name + '__lat')}"]`);
      const lngInput = form.querySelector(`[name="${CSS.escape(name + '__lng')}"]`);
      const placeIdInput = form.querySelector(`[name="${CSS.escape(name + '__place_id')}"]`);
      const searchInput = form.querySelector(`[name="${CSS.escape(name + '__search')}"]`);
      const lat = latInput ? parseFloat(latInput.value) : 0;
      const lng = lngInput ? parseFloat(lngInput.value) : 0;
      const streetNumberInput = form.querySelector(`[name="${CSS.escape(name + '__street_number')}"]`);
      const streetNameInput = form.querySelector(`[name="${CSS.escape(name + '__street_name')}"]`);
      const streetNameShortInput = form.querySelector(`[name="${CSS.escape(name + '__street_name_short')}"]`);
      const postCodeInput = form.querySelector(`[name="${CSS.escape(name + '__post_code')}"]`);
      const cityInput = form.querySelector(`[name="${CSS.escape(name + '__city')}"]`);
      const nameInput = form.querySelector(`[name="${CSS.escape(name + '__name')}"]`);
      data[name] = (lat || lng) ? {
        lat: lat || 0, lng: lng || 0,
        place_id: placeIdInput ? placeIdInput.value : '',
        address: searchInput ? searchInput.value : '',
        name: nameInput ? nameInput.value : (searchInput ? searchInput.value : ''),
        street_number: streetNumberInput ? streetNumberInput.value : '',
        street_name: streetNameInput ? streetNameInput.value : '',
        street_name_short: streetNameShortInput ? streetNameShortInput.value : '',
        post_code: postCodeInput ? postCodeInput.value : '',
        city: cityInput ? cityInput.value : '',
      } : null;
      return;
    }
    if (type === 'URL' || type === 'Url' || type === 'Link') {
      const urlInput = form.querySelector(`[name="${CSS.escape(name + '__url')}"]`);
      const titleInput = form.querySelector(`[name="${CSS.escape(name + '__title')}"]`);
      const targetInput = form.querySelector(`[name="${CSS.escape(name + '__target')}"]`);
      const url = urlInput ? urlInput.value : '';
      data[name] = url ? { url, title: titleInput ? titleInput.value : '', target: targetInput ? targetInput.value : '_self' } : '';
      return;
    }
    const input = form.querySelector(`[name="${CSS.escape(name)}"]`);
    if (!input) return;
    if (type === 'TrueFalse') {
      data[name] = !!input.checked;
    } else if (type === 'Number' || type === 'Range') {
      const raw = input.value;
      data[name] = raw === '' ? '' : Number(raw);
    } else if (type === 'ButtonGroup' || type === 'RadioButton') {
      const checked = form.querySelector(`[name="${CSS.escape(name)}"]:checked`);
      data[name] = checked ? checked.value : '';
    } else {
      data[name] = input.value;
    }
  });
  block.data = data;
  updateBlockCardPreview(blockId);
  showToast('Bloc enregistré', 'success');
}

function saveBlockData(blockId, event) {
  event.preventDefault();
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (!block) return;
  const form = event.target;
  const data = {};
  new FormData(form).forEach((value, key) => { data[key] = value; });
  block.data = data;
  const card = document.querySelector(`[data-block-id="${blockId}"]`);
  if (card) {
    const info = card.querySelector('.builder-block-info');
    if (info) {
      const preview = getBlockPreview(block);
      let previewEl = card.querySelector('.builder-block-preview');
      if (previewEl) previewEl.textContent = preview; else if (preview) { previewEl = document.createElement('span'); previewEl.className = 'builder-block-preview'; previewEl.textContent = preview; info.appendChild(previewEl); }
    }
  }
  renderBlockSettings();
  showToast('Bloc enregistré', 'success');
}

function updateSchemaConditionals(form) {
  form.querySelectorAll('.schema-cond-field').forEach(wrapper => {
    const count = parseInt(wrapper.dataset.condCount || '1', 10);
    // Inside a repeater row or group body, scope the lookup to that container
    const containerBody = wrapper.closest('.repeater-row-body, .group-field-body');
    let show = true;
    for (let i = 0; i < count; i++) {
      const suffix = i === 0 ? '' : `-${i}`;
      const condField = wrapper.getAttribute(`data-cond-field${suffix}`);
      const condOp = wrapper.getAttribute(`data-cond-op${suffix}`);
      const condVal = wrapper.getAttribute(`data-cond-val${suffix}`);
      if (!condField) continue;
      let input;
      if (containerBody) {
        input = containerBody.querySelector(`[data-rfield="${CSS.escape(condField)}"]`);
        if (!input) input = form.querySelector(`[name="${CSS.escape(condField)}"]`);
      } else {
        input = form.querySelector(`[name="${CSS.escape(condField)}"]`);
      }
      let currentVal = '';
      if (input) {
        if (input.type === 'checkbox') {
          currentVal = input.checked ? '1' : '0';
        } else if (input.type === 'radio') {
          const actualName = input.getAttribute('name') || condField;
          const scope = containerBody || form;
          const checked = scope.querySelector(`[name="${CSS.escape(actualName)}"]:checked`);
          currentVal = checked ? checked.value : '';
        } else {
          currentVal = input.value ?? '';
        }
      }
      const isEmpty = condOp === '!=empty' || (condOp === '!=' && (condVal === '' || condVal === 'null'));
      const match = isEmpty ? currentVal !== '' : (condOp === '==' ? currentVal === condVal : currentVal !== condVal);
      if (!match) { show = false; break; }
    }
    wrapper.style.display = show ? '' : 'none';
  });
}

function renderBlockSettings() {
  const panel = document.getElementById('builderSettings');
  if (!panel) return;
  destroyWysiwygEditors(panel);
  panel.innerHTML = renderBuilderSettingsPanel();
  attachSettingsLivePreview();
  initWysiwygEditors(panel);
  if (typeof updateBuilderBreadcrumb === 'function') updateBuilderBreadcrumb();
}

// ── WYSIWYG Editor (Quill) ──────────────────────────────────────────────────

function _quillCleanPasteMatchers() {
  if (typeof Quill === 'undefined') return [];
  const Delta = Quill.import('delta');
  return [
    // Strip all inline styles/classes — keep only text + block structure.
    // Headings are handled by Quill's default matcher (places header attr on
    // the trailing newline, where block formats belong); custom-handling them
    // here previously put the attr on inline text, which Quill drops, causing
    // h1-h6 to silently downgrade to paragraphs on init/paste.
    [Node.ELEMENT_NODE, function(node, delta) {
      // Strip all inline formatting attributes (color, font, size, background, etc.)
      const ops = delta.ops.map(op => {
        if (op.attributes) {
          const clean = {};
          // Only keep these Quill formats
          if (op.attributes.link) clean.link = op.attributes.link;
          if (op.attributes.header) clean.header = op.attributes.header;
          if (op.attributes.list) clean.list = op.attributes.list;
          if (op.attributes.blockquote) clean.blockquote = op.attributes.blockquote;
          return { ...op, attributes: Object.keys(clean).length ? clean : undefined };
        }
        return op;
      });
      return new Delta(ops);
    }]
  ];
}

function initWysiwygEditors(container) {
  if (typeof Quill === 'undefined') return;
  container.querySelectorAll('.wysiwyg-editor').forEach(el => {
    if (_quillInstances.has(el.id)) return;
    // Defer init for editors inside hidden containers (display:none ancestors).
    // Quill toolbar/alignment/code-view break when initialized while hidden.
    // These editors will be initialized when their container becomes visible
    // (toggleRepeaterRow, switchBlockTab, switchColsTab).
    if (!el.offsetParent) return;
    const textarea = el.parentElement.querySelector('.wysiwyg-source');
    const quill = new Quill(el, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, 4, 5, 6, false] }],
          ['bold', 'italic', 'strike'],
          [{ list: 'bullet' }, { list: 'ordered' }],
          ['blockquote'],
          [{ align: [] }],
          ['link'],
          [{ color: [] }],
          [{ indent: '-1' }, { indent: '+1' }],
          ['clean'],
          ['html']
        ],
        clipboard: { matchers: _quillCleanPasteMatchers() }
      },
      placeholder: 'Saisissez votre texte...'
    });
    quill.on('text-change', () => {
      if (quill._syncingFromInline) return;
      const html = quill.getSemanticHTML();
      if (textarea) {
        textarea.value = html;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    attachHtmlSourceToggle(quill, {
      getHtml: () => quill.getSemanticHTML(),
      onSync: (html) => {
        if (textarea) {
          textarea.value = html;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    });
    _quillInstances.set(el.id, quill);
  });
}

function attachHtmlSourceToggle(quill, { getHtml, onSync } = {}) {
  const toolbar = quill.getModule && quill.getModule('toolbar');
  if (!toolbar || typeof toolbar.addHandler !== 'function') return;
  const editorRoot = quill.root;
  const qlContainer = editorRoot.parentNode;
  let textarea = null;
  toolbar.addHandler('html', function() {
    const btn = toolbar.container && toolbar.container.querySelector('button.ql-html');
    if (!textarea) {
      const html = typeof getHtml === 'function' ? getHtml() : editorRoot.innerHTML;
      textarea = document.createElement('textarea');
      textarea.className = 'wysiwyg-html-source';
      textarea.spellcheck = false;
      textarea.value = html;
      qlContainer.style.display = 'none';
      qlContainer.parentNode.insertBefore(textarea, qlContainer.nextSibling);
      textarea.addEventListener('input', () => {
        if (typeof onSync === 'function') onSync(textarea.value);
      });
      if (btn) btn.classList.add('ql-active');
      textarea.focus();
    } else {
      const html = textarea.value;
      quill.root.innerHTML = html;
      if (typeof onSync === 'function') onSync(html);
      textarea.remove();
      textarea = null;
      qlContainer.style.display = '';
      if (btn) btn.classList.remove('ql-active');
      quill.focus();
    }
  });
}

function destroyWysiwygEditors(container) {
  container.querySelectorAll('.wysiwyg-editor').forEach(el => {
    const quill = _quillInstances.get(el.id);
    if (quill) {
      // Sync final content to textarea before destroying
      const textarea = el.parentElement?.querySelector('.wysiwyg-source');
      if (textarea) textarea.value = quill.getSemanticHTML();
    }
    _quillInstances.delete(el.id);
  });
}

function attachSettingsLivePreview() {
  const panel = document.getElementById('builderSettings');
  const form = panel?.querySelector('form');
  if (!form || form.dataset.liveAttached === 'true') return;
  form.dataset.liveAttached = 'true';
  const handler = () => liveUpdateFromSettingsForm(form);
  form.addEventListener('input', handler);
  form.addEventListener('change', handler);
  form.addEventListener('input', () => updateSchemaConditionals(form));
  form.addEventListener('change', () => updateSchemaConditionals(form));
}

function liveUpdateFromSettingsForm(form) {
  if (!selectedBlockId) return;
  const block = pageBuilderState.blocks.find(b => b.id === selectedBlockId);
  if (!block) return;
  markBuilderDirty();
  if (LEGACY_BLOCK_TYPES[block.type]) return;
  const def = BLOCK_TYPES[block.type] || {};
  const moduleName = def.moduleName || block.type;
  const schemaFields = moduleFieldSchema?.modules?.[moduleName]?.fields || [];
  if (schemaFields.length === 0) return;
  const data = { ...(block.data && typeof block.data === 'object' ? block.data : {}) };
  schemaFields.forEach(field => {
    const name = field.name;
    const type = field.type || 'Text';
    try {
    if (type === 'Repeater') {
      const rc = form.querySelector(`.repeater-field[data-field-name="${CSS.escape(name)}"]`);
      if (!rc && data[name] !== undefined) return; // hidden repeater (e.g. Accordion inline) — keep existing data
      data[name] = collectRepeaterData(form, name, field.subFields || []);
      return;
    }
    if (type === 'FlexibleContent') {
      data[name] = collectFlexibleContentData(form, name);
      return;
    }
    if (type === 'Group') {
      data[name] = collectContainerData(form, name, field.subFields || [], null);
      return;
    }
    // Ne jamais toucher aux champs d'image de fond : ils sont gérés
    // uniquement par la médiathèque. Sinon, bg_img est écrasé à chaque
    // clic sur un bouton (couleur, padding, etc.) et la photo disparaît.
    if (name === 'bg_img' || name === 'backgroundImage') return;
    if (type === 'Image' || type === 'File' || type === 'Video') return;
    if (type === 'GoogleMap') {
      const latInput = form.querySelector(`[name="${CSS.escape(name + '__lat')}"]`);
      const lngInput = form.querySelector(`[name="${CSS.escape(name + '__lng')}"]`);
      const placeIdInput = form.querySelector(`[name="${CSS.escape(name + '__place_id')}"]`);
      const searchInput = form.querySelector(`[name="${CSS.escape(name + '__search')}"]`);
      const lat = latInput ? parseFloat(latInput.value) : 0;
      const lng = lngInput ? parseFloat(lngInput.value) : 0;
      const streetNumberInput = form.querySelector(`[name="${CSS.escape(name + '__street_number')}"]`);
      const streetNameInput = form.querySelector(`[name="${CSS.escape(name + '__street_name')}"]`);
      const streetNameShortInput = form.querySelector(`[name="${CSS.escape(name + '__street_name_short')}"]`);
      const postCodeInput = form.querySelector(`[name="${CSS.escape(name + '__post_code')}"]`);
      const cityInput = form.querySelector(`[name="${CSS.escape(name + '__city')}"]`);
      const nameInput = form.querySelector(`[name="${CSS.escape(name + '__name')}"]`);
      data[name] = (lat || lng) ? {
        lat: lat || 0, lng: lng || 0,
        place_id: placeIdInput ? placeIdInput.value : '',
        address: searchInput ? searchInput.value : '',
        name: nameInput ? nameInput.value : (searchInput ? searchInput.value : ''),
        street_number: streetNumberInput ? streetNumberInput.value : '',
        street_name: streetNameInput ? streetNameInput.value : '',
        street_name_short: streetNameShortInput ? streetNameShortInput.value : '',
        post_code: postCodeInput ? postCodeInput.value : '',
        city: cityInput ? cityInput.value : '',
      } : null;
      return;
    }
    if (type === 'URL' || type === 'Url' || type === 'Link') {
      const urlInput = form.querySelector(`[name="${CSS.escape(name + '__url')}"]`);
      const titleInput = form.querySelector(`[name="${CSS.escape(name + '__title')}"]`);
      const targetInput = form.querySelector(`[name="${CSS.escape(name + '__target')}"]`);
      const url = urlInput ? urlInput.value : '';
      data[name] = url ? { url, title: titleInput ? titleInput.value : '', target: targetInput ? targetInput.value : '_self' } : '';
      return;
    }
    const input = form.querySelector(`[name="${CSS.escape(name)}"]`);
    if (!input) return;
    if (type === 'TrueFalse') {
      data[name] = !!input.checked;
    } else if (type === 'Number' || type === 'Range') {
      const raw = input.value;
      data[name] = raw === '' ? '' : Number(raw);
    } else if (type === 'ButtonGroup' || type === 'RadioButton') {
      const checked = form.querySelector(`[name="${CSS.escape(name)}"]:checked`);
      data[name] = checked ? checked.value : '';
    } else {
      data[name] = input.value;
    }
    } catch (err) {
      console.warn(`[liveUpdate] Error collecting field "${name}" (${type}):`, err);
    }
  });
  block.data = data;
  updateBlockCardPreview(block.id);
}

function syncModulePaddingClasses(richEl, data) {
  const moduleEl = richEl.querySelector('.module');
  if (!moduleEl) return;
  moduleEl.classList.remove(...PADDING_CLASSES);
  const pt = data?.padding_top;
  const pb = data?.padding_bottom;
  if (pt && PADDING_CLASSES.includes(pt)) moduleEl.classList.add(pt);
  if (pb && PADDING_CLASSES.includes(pb)) moduleEl.classList.add(pb);
  // Inline styles to guarantee visual rendering in admin context
  if (pt === 'no-padding-top') moduleEl.style.setProperty('padding-top', '0', 'important');
  else if (pt === 'padding-top-small') moduleEl.style.setProperty('padding-top', 'calc(37.5px + 1.95vw)', 'important');
  else moduleEl.style.removeProperty('padding-top');
  if (pb === 'no-padding-bottom') moduleEl.style.setProperty('padding-bottom', '0', 'important');
  else if (pb === 'padding-bottom-small') moduleEl.style.setProperty('padding-bottom', 'calc(37.5px + 1.95vw)', 'important');
  else moduleEl.style.removeProperty('padding-bottom');
}

function syncModuleBlocColorClasses(richEl, data) {
  const moduleEl = richEl.querySelector('.module');
  if (!moduleEl) return;
  moduleEl.classList.remove(...BG_COLOR_CLASSES);
  const bgClass = data?.bloc_color || '';
  if (bgClass && bgClass !== 'no-background-color' && BG_COLOR_CLASSES.includes(bgClass)) {
    moduleEl.classList.add(bgClass);
  }
  // Inline background-color to override CSS cascade (background: transparent !important)
  const COLOR_MAP = getResolvedColorMap();
  if (bgClass && COLOR_MAP[bgClass]) {
    moduleEl.style.setProperty('background-color', COLOR_MAP[bgClass], 'important');
  } else {
    moduleEl.style.removeProperty('background-color');
  }
}

function updateBlockCardPreview(blockId) {
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (!block) return;
  const card = document.querySelector(`.builder-block-card[data-block-id="${blockId}"]`);
  if (!card) return;
  // Update visibility state
  const isHidden = block.data?.is_visible === 'no';
  card.classList.toggle('is-hidden-block', isHidden);
  const info = card.querySelector('.builder-block-info');
  if (info) {
    const existingIcon = info.querySelector('.builder-block-hidden-icon');
    if (isHidden && !existingIcon) {
      info.insertAdjacentHTML('beforeend', '<svg class="builder-block-hidden-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>');
    } else if (!isHidden && existingIcon) {
      existingIcon.remove();
    }
  }
  // If this block is being inline-edited, skip full innerHTML replacement
  // to preserve cursor position. Only update surrounding styles/classes.
  if (_inlineEditingBlockId === blockId) {
    const richEl = card.querySelector('.builder-block-render');
    if (richEl) {
      syncModulePaddingClasses(richEl, block.data);
      syncModuleBlocColorClasses(richEl, block.data);
    }
    return;
  }

  let rich;
  try { rich = replaceEmptyImages(renderBlockPreviewHtml(block)); } catch (e) {
    console.warn('Preview render error:', e);
    rich = `<div class="preview-loading" style="color:#c00;">Erreur de rendu (${escapeHtml(block.type)}). Voir la console.</div>`;
  }
  let richEl = card.querySelector('.builder-block-render');
  if (rich) {
    if (!richEl) {
      richEl = document.createElement('div');
      richEl.className = 'builder-block-render';
      card.appendChild(richEl);
    }
    richEl.innerHTML = rich;
    // Accordion : post-traitement du DOM pour l'admin
    if (block.type === 'accordion' || block.type === 'Accordion') {
      let accordionDiv = richEl.querySelector('.accordion');
      // If no .accordion div (empty/new block), create a minimal structure
      if (!accordionDiv) {
        const moduleDiv = richEl.querySelector('.module-accordion') || richEl;
        let container = moduleDiv.querySelector('.container');
        if (!container) {
          container = document.createElement('div');
          container.className = 'container';
          moduleDiv.appendChild(container);
        }
        accordionDiv = document.createElement('div');
        accordionDiv.className = 'accordion';
        container.appendChild(accordionDiv);
      }
      if (accordionDiv) {
        const chevronSvg = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
        accordionDiv.querySelectorAll('.js_toggle-accordion').forEach((btn, i) => {
          if (btn.querySelector('.accordion-title-text')) return;
          // Inject chevron SVG into .icon if empty
          const icon = btn.querySelector('.icon');
          if (icon && !icon.innerHTML.trim()) icon.innerHTML = chevronSvg;
          // Wrap title text in a clickable span (exclude the .icon)
          const titleSpan = document.createElement('span');
          titleSpan.className = 'accordion-title-text';
          Array.from(btn.childNodes).forEach(node => {
            if (node === icon) return;
            titleSpan.appendChild(node);
          });
          btn.insertBefore(titleSpan, icon);
          // Open first item by default
          if (i === 0) {
            btn.classList.add('active');
            const txt = btn.nextElementSibling;
            if (txt && txt.classList.contains('txt')) txt.style.display = 'block';
          }
        });
        // Inject add button
        if (!accordionDiv.querySelector('.accordion-add-btn')) {
          const addBtn = document.createElement('button');
          addBtn.type = 'button';
          addBtn.className = 'accordion-add-btn';
          addBtn.textContent = '+ Ajouter un élément';
          accordionDiv.appendChild(addBtn);
        }
      }
    }
    // ImagesSlider: init Swiper carousel in preview
    if (block.type === 'images-slider' || block.type === 'ImagesSlider') {
      initPreviewImagesSlider(richEl);
    }
    // LogosSlider: init Swiper carousel in preview
    if (block.type === 'logos-slider' || block.type === 'LogosSlider' || block.type === 'slider-logo' || block.type === 'SliderLogo') {
      initPreviewLogosSlider(richEl);
    }
    syncModulePaddingClasses(richEl, block.data);
    syncModuleBlocColorClasses(richEl, block.data);
    updateBuilderParallax();
    applyPreviewScaling();
  } else if (richEl) {
    richEl.remove();
  }
}

// ── ImagesSlider: Swiper init in preview ────────────────────────────────────
function initPreviewImagesSlider(richEl) {
  if (typeof window.Swiper === 'undefined') return;
  richEl.querySelectorAll('.js_images-slider').forEach(function(el, i) {
    // Destroy previous instance if re-rendering
    if (el.swiper) el.swiper.destroy(true, true);
    var slideCount = el.querySelectorAll('.swiper-slide').length;
    if (slideCount <= 1) return;
    var wrapper = el.closest('.slider-wrapper');
    var pagEl = wrapper ? wrapper.querySelector('.js_images-slider-pagination') : null;
    if (pagEl) pagEl.classList.add('index-' + i);
    new window.Swiper(el, {
      loop: slideCount > 2,
      speed: 750,
      slidesPerView: 1,
      autoplay: { delay: 4000, disableOnInteraction: true },
      navigation: {
        nextEl: wrapper ? wrapper.querySelector('.next') : null,
        prevEl: wrapper ? wrapper.querySelector('.prev') : null
      },
      pagination: { el: pagEl, type: 'bullets', clickable: true }
    });
  });
}

// ── LogosSlider: Swiper init in preview ──────────────────────────────────────
function initPreviewLogosSlider(richEl) {
  if (typeof window.Swiper === 'undefined') return;
  richEl.querySelectorAll('.js_logos-slider').forEach(function(el) {
    if (el.swiper) el.swiper.destroy(true, true);
    var slideCount = el.querySelectorAll('.swiper-slide').length;
    var ww = window.innerWidth;
    var spv = 2;
    if (ww >= 1025) spv = 6;
    else if (ww >= 961) spv = 4;
    else if (ww >= 601) spv = 3;
    else if (ww >= 481) spv = 2;
    if (slideCount <= spv) return;
    var wrapper = el.closest('.slider-wrapper');
    new window.Swiper(el, {
      loop: true,
      speed: 750,
      slidesPerView: 2,
      spaceBetween: 26,
      preventClicks: false,
      preventClicksPropagation: false,
      breakpoints: {
        481: { slidesPerView: 2 },
        601: { slidesPerView: 3 },
        961: { slidesPerView: 4 },
        1025: { slidesPerView: 6 }
      },
      autoplay: { delay: 3000, disableOnInteraction: true },
      navigation: {
        nextEl: wrapper ? wrapper.querySelector('.js_logos-slider-btn-next') : null,
        prevEl: wrapper ? wrapper.querySelector('.js_logos-slider-btn-prev') : null
      }
    });
  });
}

/**
 * Find the sub-module data object inside a ColumnsTab block by matching
 * the DOM position of the .module-text element.
 */
function _findColumnsSubModuleData(block, moduleTextEl, card) {
  const columnsList = Array.isArray(block.data?.columns_list) ? block.data.columns_list : [];
  // Get all .col elements in the preview
  const colEls = card.querySelectorAll('.builder-block-render .cols-wrapper > .col');
  for (let colIdx = 0; colIdx < colEls.length; colIdx++) {
    const colEl = colEls[colIdx];
    if (!colEl.contains(moduleTextEl)) continue;
    const colData = columnsList[colIdx];
    if (!colData) return null;
    const subModules = Array.isArray(colData.columns_module) ? colData.columns_module : [];
    // Find which .module-in-column contains our .module-text
    const moduleInColEls = colEl.querySelectorAll(':scope > .module-in-column');
    for (let subIdx = 0; subIdx < moduleInColEls.length; subIdx++) {
      if (moduleInColEls[subIdx].contains(moduleTextEl)) {
        const subData = subModules[subIdx];
        if (subData && (subData.acf_fc_layout === 'text' || subData.type === 'text')) {
          return subData;
        }
        return null;
      }
    }
  }
  return null;
}

// Expose all functions on window
Object.assign(window, {
  renderBuilderSettingsPanel,
  legacyForm,
  renderLegacyBlockForm,
  renderKeyValueForm,
  renderSchemaForm,
  renderSchemaField,
  _renderSchemaFieldHTML,
  normalizeBoolVal,
  switchBlockTab,
  renderRepeaterFieldHTML,
  renderRepeaterRowHTML,
  renderGroupFieldHTML,
  renderFlexibleContentFieldHTML,
  renderFlexibleContentItemHTML,
  collectFlexibleContentData,
  addFlexibleContentItem,
  removeFlexibleContentItem,
  moveFlexibleContentItem,
  duplicateFlexibleContentItem,
  reRenderFlexibleContentItems,
  syncFlexibleContentToBlock,
  toggleRepeaterRow,
  toggleGroupField,
  updateBuilderBreadcrumb,
  _getRepeaterSchema,
  _collectRepeaterFromContainer,
  _syncRepeaterToBlock,
  collectContainerData,
  collectRepeaterData,
  reRenderRepeaterRows,
  switchColsTab,
  colsVtabAction,
  _refreshColsVtabsRail,
  addRepeaterRow,
  removeRepeaterRow,
  moveRepeaterRow,
  duplicateRepeaterRow,
  renderKeyValueRow,
  addKeyValueRow,
  removeKeyValueRow,
  saveKeyValueData,
  saveSchemaData,
  saveBlockData,
  updateSchemaConditionals,
  renderBlockSettings,
  _quillCleanPasteMatchers,
  initWysiwygEditors,
  attachHtmlSourceToggle,
  destroyWysiwygEditors,
  attachSettingsLivePreview,
  liveUpdateFromSettingsForm,
  syncModulePaddingClasses,
  syncModuleBlocColorClasses,
  updateBlockCardPreview,
  initPreviewImagesSlider,
  initPreviewLogosSlider,
  _findColumnsSubModuleData,
});
