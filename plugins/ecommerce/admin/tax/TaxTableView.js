/**
 * TaxTableView — liste des taux de TVA (rangées via <template>).
 *
 * Mise à jour surgicale : on diff l'état précédent vs nouveau et on ne
 * touche que les rangées qui ont changé. Pas de innerHTML destructif.
 *
 * Handlers attendus :
 *   onEdit(rate)   — clic sur "modifier"
 *   onDelete(id)   — clic sur "supprimer"
 *   onCreate()     — clic sur "Nouveau taux"
 */

import { BaseView } from '../_lib/View.js';
import { qs, cloneTpl, delegate, escape } from '../_lib/dom.js';

export class TaxTableView extends BaseView {
  mount(root) {
    this.root = root;
    this.tbody = qs('#tax-tbody', root);
    this.loading = qs('#tax-loading', root);
    this.empty = qs('#tax-empty', root);
    this.tableCard = qs('#tax-table-card', root);

    this.on(qs('#tax-add-btn', root), 'click', () => this.handlers.onCreate?.());
    delegate(this.tbody, 'click', '[data-edit]', (e, btn) => {
      const id = +btn.dataset.edit;
      const rate = this._lastRates.find(r => r.id === id);
      if (rate) this.handlers.onEdit?.(rate);
    });
    delegate(this.tbody, 'click', '[data-delete]', (e, btn) => {
      const id = +btn.dataset.delete;
      this.handlers.onDelete?.(id);
    });

    this._lastRates = [];
    return this;
  }

  render(state) {
    if (state.loading && !state.rates.length) {
      this.loading.style.display = 'block';
      this.tableCard.style.display = 'none';
      this.empty.style.display = 'none';
      return;
    }
    this.loading.style.display = 'none';

    if (!state.rates.length) {
      this.tableCard.style.display = 'none';
      this.empty.style.display = 'block';
      this._lastRates = [];
      this.tbody.replaceChildren();
      return;
    }

    this.empty.style.display = 'none';
    this.tableCard.style.display = 'block';
    this._renderRows(state.rates);
    this._lastRates = state.rates;
  }

  _renderRows(rates) {
    // Surgical : on diff par id ; ré-utilise les rangées existantes, ajoute
    // les nouvelles, supprime les disparues. Évite d'écraser un focus / selection
    // sur une rangée en cours d'édition (pas de risque ici, mais bonne hygiène).
    const existing = new Map();
    for (const tr of this.tbody.children) {
      existing.set(+tr.dataset.id, tr);
    }
    const seen = new Set();
    rates.forEach((rate, i) => {
      seen.add(rate.id);
      let tr = existing.get(rate.id);
      if (!tr) {
        const frag = cloneTpl('tax-row-tpl');
        tr = frag.querySelector('tr');
        this.tbody.appendChild(tr);
      }
      this._fillRow(tr, rate);
      if (this.tbody.children[i] !== tr) this.tbody.insertBefore(tr, this.tbody.children[i]);
    });
    for (const [id, tr] of existing) {
      if (!seen.has(id)) tr.remove();
    }
  }

  _fillRow(tr, rate) {
    tr.dataset.id = rate.id;
    qs('.cell-code', tr).textContent = rate.code;
    qs('.cell-label', tr).textContent = rate.label;
    qs('.cell-country', tr).textContent = rate.country_code;
    qs('.cell-rate', tr).textContent = rate.rate.toFixed(2).replace('.', ',') + ' %';
    qs('.cell-default', tr).innerHTML = rate.is_default ? '<span class="badge-default">Par défaut</span>' : '';
    qs('[data-edit]', tr).dataset.edit = rate.id;
    qs('[data-delete]', tr).dataset.delete = rate.id;
  }
}
