/**
 * VariantsTableView — onglet "Variations" (table inline) pour les produits variables.
 *
 * Surgical : ré-utilise les rangées existantes par variant_id, ajoute les nouvelles,
 * supprime les disparues. Permet de modifier inline et collecter à la sauvegarde.
 *
 * Bouton "Générer toutes les variations" → handlers.onGenerateMatrix()
 * Modifs locales → handlers.onChange(variants)
 */

import { BaseView } from '../../_lib/View.js';
import { h, qs } from '../../_lib/dom.js';

export class VariantsTableView extends BaseView {
  mount(root) {
    this.root = root;
    this.controls = h('div', { style: 'display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:8px' },
      h('strong', { style: 'font-size:13px;color:var(--gray-700);text-transform:uppercase;letter-spacing:0.04em' }, 'Variations'),
      h('button', { class: 'btn btn-outline btn-sm', type: 'button',
        onclick: () => this.handlers.onGenerateMatrix?.() }, 'Générer toutes les variations'),
    );
    this.tableWrap = h('div');
    root.replaceChildren(this.controls, this.tableWrap);
    this._renderTable();
    return this;
  }

  render(state) {
    const variants = state.variants || [];
    if (!variants.length) {
      this.tableWrap.replaceChildren(
        h('div', { class: 'empty', style: 'padding:24px;font-size:13px' },
          'Aucune variation. Définissez les attributs (avec "Variations" coché) puis cliquez sur "Générer toutes les variations".')
      );
      return;
    }
    this._renderTable();
    const tbody = qs('tbody', this.tableWrap);
    if (!tbody) return;

    const existing = new Map();
    for (const tr of tbody.children) existing.set(+tr.dataset.id, tr);
    const seen = new Set();

    variants.forEach((v, i) => {
      seen.add(v.id);
      let tr = existing.get(v.id);
      if (!tr) {
        tr = this._buildRow(v);
        tbody.appendChild(tr);
      } else {
        this._fillRow(tr, v);
      }
      if (tbody.children[i] !== tr) tbody.insertBefore(tr, tbody.children[i]);
    });
    for (const [id, tr] of existing) if (!seen.has(id)) tr.remove();
  }

  collect() {
    const tbody = qs('tbody', this.tableWrap);
    if (!tbody) return [];
    return Array.from(tbody.children).map(tr => ({
      id: +tr.dataset.id,
      sku: qs('[data-f=sku]', tr).value,
      price_cents: Math.round((parseFloat(qs('[data-f=price]', tr).value) || 0) * 100),
      compare_at_price_cents: qs('[data-f=compare]', tr).value
        ? Math.round(parseFloat(qs('[data-f=compare]', tr).value) * 100) : null,
      stock_quantity: +qs('[data-f=stock]', tr).value || 0,
      attributes: JSON.parse(tr.dataset.attrs || '{}'),
      position: +tr.dataset.position || 0,
    }));
  }

  _renderTable() {
    if (qs('table', this.tableWrap)) return;
    this.tableWrap.replaceChildren(
      h('table', { class: 'pe-variants-table' },
        h('thead', null,
          h('tr', null,
            h('th', null, 'Attributs'),
            h('th', null, 'SKU'),
            h('th', null, 'Prix (€)'),
            h('th', null, 'Prix promo (€)'),
            h('th', null, 'Stock'),
          ),
        ),
        h('tbody', null),
      ),
    );
  }

  _buildRow(v) {
    const tr = h('tr');
    tr.dataset.id = v.id;
    tr.dataset.position = v.position || 0;
    tr.dataset.attrs = JSON.stringify(v.attributes || {});
    tr.appendChild(h('td', null, this._attrLabel(v.attributes)));
    tr.appendChild(h('td', null, h('input', { 'data-f': 'sku', type: 'text', value: v.sku || '', oninput: () => this._notify() })));
    tr.appendChild(h('td', null, h('input', { 'data-f': 'price', type: 'number', step: '0.01', value: ((v.price_cents || 0) / 100).toFixed(2), oninput: () => this._notify() })));
    tr.appendChild(h('td', null, h('input', { 'data-f': 'compare', type: 'number', step: '0.01', value: v.compare_at_price_cents ? (v.compare_at_price_cents / 100).toFixed(2) : '', oninput: () => this._notify() })));
    tr.appendChild(h('td', null, h('input', { 'data-f': 'stock', type: 'number', value: v.stock_quantity ?? 0, oninput: () => this._notify() })));
    return tr;
  }

  _fillRow(tr, v) {
    tr.dataset.attrs = JSON.stringify(v.attributes || {});
    tr.children[0].textContent = this._attrLabel(v.attributes);
    qs('[data-f=sku]', tr).value = v.sku || '';
    qs('[data-f=price]', tr).value = ((v.price_cents || 0) / 100).toFixed(2);
    qs('[data-f=compare]', tr).value = v.compare_at_price_cents ? (v.compare_at_price_cents / 100).toFixed(2) : '';
    qs('[data-f=stock]', tr).value = v.stock_quantity ?? 0;
  }

  _attrLabel(attrs) {
    if (!attrs) return '—';
    const obj = typeof attrs === 'string' ? JSON.parse(attrs) : attrs;
    return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(' / ') || '—';
  }

  _notify() {
    this.handlers.onChange?.(this.collect());
  }
}
