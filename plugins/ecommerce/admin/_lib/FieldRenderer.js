/**
 * FieldRenderer — rendu dynamique des champs ACF-like (mêmes types que les modules Nickl).
 *
 * Types supportés :
 *   - Text          → input
 *   - Textarea      → textarea
 *   - Number        → input number
 *   - Range         → input range
 *   - TrueFalse     → toggle (avec onLabel/offLabel)
 *   - ButtonGroup   → row de boutons (radio-like)
 *   - Image / File  → bouton ouvrant la médiathèque
 *   - Link          → input + select (target)
 *   - Repeater      → liste de groupes (UI compacte)
 *   - Group         → bloc avec sous-champs
 *
 * Logique conditionnelle : champ avec `conditional: { field, operator, value }`
 * masqué si la condition n'est pas vérifiée. Re-évaluée à chaque change.
 *
 * Usage :
 *   const renderer = new FieldRenderer(fields, values, onChange);
 *   container.appendChild(renderer.render());
 *   // Plus tard :
 *   const newValues = renderer.collect();
 */

import { h, qs, qsa, escape } from './dom.js';
import { pickMedia } from './MediaPicker.js';

export class FieldRenderer {
  constructor(fields, initialValues = {}, onChange = null) {
    this.fields = fields;
    this.values = { ...initialValues };
    this.onChange = onChange;
    this.fieldRefs = new Map(); // name → { container, getValue, setValue }
  }

  render() {
    this._root = h('div', { class: 'field-renderer' });
    for (const f of this.fields) {
      if (f.isBlockParam) continue; // gérés ailleurs (BlockParams partagés)
      const fieldEl = this._renderField(f);
      if (fieldEl) this._root.appendChild(fieldEl);
    }
    this._evaluateConditionals(this._root);
    return this._root;
  }

  collect() {
    const out = {};
    for (const [name, ref] of this.fieldRefs) {
      out[name] = ref.getValue();
    }
    return out;
  }

  _set(name, val) {
    this.values[name] = val;
    if (this.onChange) this.onChange(this.collect());
  }

  _renderField(f) {
    const value = this.values[f.name] ?? f.defaultValue ?? '';
    let el;
    switch (f.type) {
      case 'Text':       el = this._renderText(f, value); break;
      case 'Textarea':   el = this._renderTextarea(f, value); break;
      case 'Number':     el = this._renderNumber(f, value); break;
      case 'Range':      el = this._renderRange(f, value); break;
      case 'TrueFalse':  el = this._renderTrueFalse(f, value); break;
      case 'ButtonGroup':el = this._renderButtonGroup(f, value); break;
      case 'Image':      el = this._renderMedia(f, value, 'image'); break;
      case 'File':       el = this._renderMedia(f, value, 'video'); break;
      case 'Link':       el = this._renderLink(f, value); break;
      case 'Group':      el = this._renderGroup(f, value); break;
      case 'Repeater':   el = this._renderRepeater(f, value); break;
      default:           el = this._renderUnknown(f, value);
    }
    el.dataset.fieldName = f.name;
    if (f.conditional) el.dataset.conditional = JSON.stringify(f.conditional);
    return el;
  }

  // ── Renderers ──

  _renderText(f, value) {
    const input = h('input', { class: 'form-input', type: 'text', value: value || '' });
    input.addEventListener('input', () => { this._set(f.name, input.value); this._evaluateAll(); });
    this.fieldRefs.set(f.name, { container: input, getValue: () => input.value, setValue: v => input.value = v || '' });
    return this._wrap(f, input);
  }

  _renderTextarea(f, value) {
    const ta = h('textarea', { class: 'form-input', rows: 3 }, value || '');
    ta.addEventListener('input', () => { this._set(f.name, ta.value); this._evaluateAll(); });
    this.fieldRefs.set(f.name, { container: ta, getValue: () => ta.value, setValue: v => ta.value = v || '' });
    return this._wrap(f, ta);
  }

  _renderNumber(f, value) {
    const input = h('input', { class: 'form-input', type: 'number', value: value ?? '' });
    input.addEventListener('input', () => { this._set(f.name, input.value); this._evaluateAll(); });
    this.fieldRefs.set(f.name, { container: input, getValue: () => input.value, setValue: v => input.value = v ?? '' });
    return this._wrap(f, input);
  }

  _renderRange(f, value) {
    const min = f.min ?? 0, max = f.max ?? 100;
    const input = h('input', { type: 'range', min, max, value: value || min, style: 'width:100%' });
    const label = h('span', { style: 'font-size:12px;color:var(--gray-500);margin-left:8px' }, String(value || min));
    input.addEventListener('input', () => {
      label.textContent = input.value;
      this._set(f.name, +input.value);
      this._evaluateAll();
    });
    this.fieldRefs.set(f.name, { container: input, getValue: () => +input.value, setValue: v => { input.value = v; label.textContent = v; } });
    return this._wrap(f, h('div', { style: 'display:flex;align-items:center' }, input, label));
  }

  _renderTrueFalse(f, value) {
    const isOn = value === true || value === 1 || value === '1' || value === 'true';
    // Stocke '1'/'0' (string) pour matcher les conditionals du schéma module-fields
    // (les conditional.value sont toujours des strings côté backend).
    this.values[f.name] = isOn ? '1' : '0';

    const checkbox = h('input', { type: 'checkbox', checked: isOn });
    const slider = h('span', { class: 'toggle-slider' });
    const toggle = h('label', { class: 'toggle-switch' }, checkbox, slider);
    const labelText = h('span', { class: 'toggle-label' }, isOn ? (f.onLabel || 'Oui') : (f.offLabel || 'Non'));
    const wrap = h('div', { class: 'toggle-row' }, toggle, labelText);

    checkbox.addEventListener('change', () => {
      labelText.textContent = checkbox.checked ? (f.onLabel || 'Oui') : (f.offLabel || 'Non');
      this._set(f.name, checkbox.checked ? '1' : '0');
      this._evaluateAll();
    });
    this.fieldRefs.set(f.name, {
      container: wrap,
      getValue: () => checkbox.checked ? '1' : '0',
      setValue: v => {
        const on = v === true || v === 1 || v === '1' || v === 'true';
        checkbox.checked = on;
        labelText.textContent = on ? (f.onLabel || 'Oui') : (f.offLabel || 'Non');
      },
    });
    return this._wrap(f, wrap);
  }

  _renderButtonGroup(f, value) {
    const wrap = h('div', { class: 'btn-group', style: 'display:flex;gap:6px;flex-wrap:wrap' });
    let current = value;
    (f.choices || []).forEach(c => {
      const btn = h('button', {
        type: 'button',
        class: 'btn btn-outline btn-sm' + (current === c.value ? ' active' : ''),
        style: current === c.value ? 'background:var(--primary);color:white;border-color:var(--primary)' : '',
      }, h('span', { html: this._sanitizeChoiceLabel(c.label) }));
      btn.addEventListener('click', () => {
        current = c.value;
        wrap.querySelectorAll('button').forEach((b, i) => {
          const isActive = (f.choices[i].value === current);
          b.classList.toggle('active', isActive);
          b.style.cssText = isActive ? 'background:var(--primary);color:white;border-color:var(--primary)' : '';
        });
        this._set(f.name, current);
        this._evaluateAll();
      });
      wrap.appendChild(btn);
    });
    this.fieldRefs.set(f.name, { container: wrap, getValue: () => current, setValue: v => { current = v; wrap.querySelectorAll('button').forEach((b, i) => { const a = f.choices[i].value === current; b.classList.toggle('active', a); b.style.cssText = a ? 'background:var(--primary);color:white;border-color:var(--primary)' : ''; }); } });
    return this._wrap(f, wrap);
  }

  _sanitizeChoiceLabel(label) {
    // Le schéma module-fields contient parfois du HTML brut (color swatches).
    // On le passe tel quel au innerHTML — les valeurs viennent d'une source contrôlée (config CMS).
    return label || '';
  }

  _renderMedia(f, value, kind) {
    const isVideo = kind === 'video';
    const preview = h('div', {
      class: 'field-media-preview',
      style: 'width:80px;height:80px;border:1px solid var(--gray-200);border-radius:6px;background-size:cover;background-position:center;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--gray-400);font-size:12px',
    });
    const urlEl = h('input', { class: 'form-input', type: 'text', readonly: true, placeholder: 'Aucun média',
      style: 'flex:1;font-size:12px;background:var(--gray-50)' });

    const setMedia = (m) => {
      const url = typeof m === 'string' ? m : (m?.url || '');
      urlEl.value = url;
      if (url && !isVideo) {
        preview.style.backgroundImage = `url("${url}")`;
        preview.textContent = '';
      } else if (url && isVideo) {
        preview.style.backgroundImage = '';
        preview.textContent = '▶ Vidéo';
      } else {
        preview.style.backgroundImage = '';
        preview.textContent = '—';
      }
      this._set(f.name, m && typeof m === 'object' ? m : { url });
    };

    if (value) setMedia(typeof value === 'object' ? value : { url: value });
    else setMedia(null);

    const btnPick = h('button', { class: 'btn btn-outline btn-sm', type: 'button' }, 'Choisir…');
    btnPick.addEventListener('click', async () => {
      const m = await pickMedia({ type: kind });
      if (m) setMedia(m);
    });
    const btnClear = h('button', { class: 'btn btn-outline btn-sm', type: 'button', style: 'color:#c00' }, '×');
    btnClear.addEventListener('click', () => setMedia(null));

    const row = h('div', { style: 'display:flex;gap:10px;align-items:center' },
      preview, urlEl, btnPick, btnClear,
    );
    this.fieldRefs.set(f.name, { container: row, getValue: () => this.values[f.name] ?? null, setValue: v => setMedia(v) });
    return this._wrap(f, row);
  }

  _renderLink(f, value) {
    value = value || {};
    const url = h('input', { class: 'form-input', type: 'text', value: value.url || '', placeholder: 'URL ou /chemin' });
    const title = h('input', { class: 'form-input', type: 'text', value: value.title || '', placeholder: 'Texte du lien' });
    const target = h('select', { class: 'form-select' },
      h('option', { value: '_self', selected: value.target !== '_blank' }, 'Même onglet'),
      h('option', { value: '_blank', selected: value.target === '_blank' }, 'Nouvel onglet'),
    );
    [url, title, target].forEach(el => el.addEventListener('change', () => {
      this._set(f.name, { url: url.value, title: title.value, target: target.value });
      this._evaluateAll();
    }));
    const wrap = h('div', { style: 'display:grid;grid-template-columns:2fr 2fr 1fr;gap:8px' }, url, title, target);
    this.fieldRefs.set(f.name, { container: wrap, getValue: () => ({ url: url.value, title: title.value, target: target.value }), setValue: v => { url.value = v?.url || ''; title.value = v?.title || ''; target.value = v?.target || '_self'; } });
    return this._wrap(f, wrap);
  }

  _renderGroup(f, value) {
    value = value || {};
    const child = new FieldRenderer(f.subFields || [], value, (subValues) => {
      this._set(f.name, subValues);
      this._evaluateAll();
    });
    const inner = child.render();
    const wrap = h('details', { class: 'field-group', open: true, style: 'border:1px solid var(--gray-200);border-radius:6px;padding:10px;margin:8px 0' },
      h('summary', { style: 'font-weight:600;cursor:pointer;font-size:13px' }, f.label),
      h('div', { style: 'padding-top:10px' }, inner),
    );
    this.fieldRefs.set(f.name, { container: wrap, getValue: () => child.collect(), setValue: () => {} });
    return wrap;
  }

  _renderRepeater(f, value) {
    const list = h('div', { class: 'field-repeater-list' });
    const items = Array.isArray(value) ? value.slice() : [];
    const subRenderers = [];

    const addRow = (rowValue = {}) => {
      const r = new FieldRenderer(f.subFields || [], rowValue, () => this._emitRepeater(f, subRenderers));
      const inner = r.render();
      const removeBtn = h('button', { class: 'btn btn-outline btn-sm', type: 'button', style: 'color:#c00' }, 'Supprimer');
      const item = h('div', { class: 'field-repeater-item', style: 'border:1px solid var(--gray-200);border-radius:6px;padding:10px;margin-bottom:8px' },
        h('div', { style: 'display:flex;justify-content:flex-end;margin-bottom:6px' }, removeBtn),
        inner,
      );
      removeBtn.addEventListener('click', () => {
        const i = subRenderers.indexOf(r);
        if (i >= 0) subRenderers.splice(i, 1);
        item.remove();
        this._emitRepeater(f, subRenderers);
      });
      subRenderers.push(r);
      list.appendChild(item);
    };

    items.forEach(addRow);

    const addBtn = h('button', { class: 'btn btn-outline btn-sm', type: 'button',
      onclick: () => { addRow({}); this._emitRepeater(f, subRenderers); } }, '+ Ajouter');

    const wrap = h('div', { class: 'field-repeater' }, list, addBtn);
    this.fieldRefs.set(f.name, { container: wrap, getValue: () => subRenderers.map(r => r.collect()), setValue: () => {} });
    return this._wrap(f, wrap);
  }

  _emitRepeater(f, renderers) {
    this._set(f.name, renderers.map(r => r.collect()));
    this._evaluateAll();
  }

  _renderUnknown(f, value) {
    const ta = h('textarea', { class: 'form-input', rows: 2, placeholder: `Type ${f.type} non supporté` },
      typeof value === 'string' ? value : JSON.stringify(value));
    return this._wrap(f, ta);
  }

  _wrap(f, child) {
    return h('div', { class: 'form-group field-row', 'data-field': f.name },
      h('label', { class: 'form-label' }, f.label),
      child,
    );
  }

  // ── Conditionals ──

  _evaluateAll() {
    if (this._root) this._evaluateConditionals(this._root);
  }

  _evaluateConditionals(root) {
    // Limite l'évaluation aux conditionals appartenant à CE renderer ; n'entre
    // pas dans les sub-renderers (Repeater rows, Group sub-renderer) qui ont
    // leur propre set de values et leur propre évaluation.
    qsa('[data-conditional]', root).forEach(el => {
      if (el.closest('.field-renderer') !== root) return;
      const cond = JSON.parse(el.dataset.conditional);
      el.style.display = this._checkConditional(cond) ? '' : 'none';
    });
  }

  _checkConditional(cond) {
    const op = cond.operator;
    const target = cond.value;
    let refValue = this.values[cond.field];
    // Normalisation : booléens → '1'/'0' (le schéma module-fields utilise des strings)
    if (refValue === true) refValue = '1';
    else if (refValue === false) refValue = '0';
    if (op === '==') return String(refValue ?? '') === String(target ?? '');
    if (op === '!=') return String(refValue ?? '') !== String(target ?? '');
    if (op === '!=empty') return refValue !== null && refValue !== '' && refValue !== undefined && refValue !== '0' && refValue !== false;
    if (op === '==empty') return refValue === null || refValue === '' || refValue === undefined || refValue === '0' || refValue === false;
    return true;
  }
}
