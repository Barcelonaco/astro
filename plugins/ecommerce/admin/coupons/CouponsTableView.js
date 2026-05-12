/**
 * CouponsTableView — liste des coupons (surgical updates par id).
 *
 * Handlers :
 *   onCreate() / onEdit(coupon) / onDelete(id)
 */

import { BaseView } from '../_lib/View.js';
import { qs, cloneTpl, delegate } from '../_lib/dom.js';

const fmtMoney = (cents, currency = 'EUR') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format((cents || 0) / 100);

const isExpired = (c) => c.expires_at && new Date(c.expires_at) < new Date();

export class CouponsTableView extends BaseView {
  mount(root) {
    this.root = root;
    this.tbody = qs('#coupons-tbody', root);
    this.loading = qs('#coupons-loading', root);
    this.empty = qs('#coupons-empty', root);
    this.tableCard = qs('#coupons-table-card', root);

    this.on(qs('#coupons-add-btn', root), 'click', () => this.handlers.onCreate?.());
    delegate(this.tbody, 'click', '[data-edit]', (e, btn) => {
      const id = +btn.dataset.edit;
      const c = this._last.find(x => x.id === id);
      if (c) this.handlers.onEdit?.(c);
    });
    delegate(this.tbody, 'click', '[data-delete]', (e, btn) => {
      this.handlers.onDelete?.(+btn.dataset.delete);
    });

    this._last = [];
    return this;
  }

  render(state) {
    if (state.loading && !state.coupons.length) {
      this.loading.style.display = 'block';
      this.tableCard.style.display = 'none';
      this.empty.style.display = 'none';
      return;
    }
    this.loading.style.display = 'none';

    if (!state.coupons.length) {
      this.tableCard.style.display = 'none';
      this.empty.style.display = 'block';
      this._last = [];
      this.tbody.replaceChildren();
      return;
    }

    this.empty.style.display = 'none';
    this.tableCard.style.display = 'block';
    this._renderRows(state.coupons);
    this._last = state.coupons;
  }

  _renderRows(coupons) {
    const existing = new Map();
    for (const tr of this.tbody.children) existing.set(+tr.dataset.id, tr);
    const seen = new Set();

    coupons.forEach((c, i) => {
      seen.add(c.id);
      let tr = existing.get(c.id);
      if (!tr) {
        const frag = cloneTpl('coupons-row-tpl');
        tr = frag.querySelector('tr');
        this.tbody.appendChild(tr);
      }
      this._fillRow(tr, c);
      if (this.tbody.children[i] !== tr) this.tbody.insertBefore(tr, this.tbody.children[i]);
    });
    for (const [id, tr] of existing) if (!seen.has(id)) tr.remove();
  }

  _fillRow(tr, c) {
    tr.dataset.id = c.id;
    tr.toggleAttribute('data-inactive', !c.is_active);
    qs('.cell-code', tr).textContent = c.code;
    const typeEl = qs('.cell-type', tr);
    typeEl.textContent = c.type;
    typeEl.className = `coupon-type cell-type ${c.type}`;
    qs('.cell-value', tr).textContent =
      c.type === 'percent' ? `${c.percent} %` :
      c.type === 'fixed' ? fmtMoney(c.value_cents) : '—';
    qs('.cell-min', tr).textContent = c.min_subtotal_cents != null ? fmtMoney(c.min_subtotal_cents) : '—';
    qs('.cell-usage', tr).textContent = c.used_count + (c.max_uses != null ? ` / ${c.max_uses}` : '');
    qs('.cell-period', tr).textContent = this._periodLabel(c);
    qs('.cell-status', tr).innerHTML =
      isExpired(c) ? '<span class="badge-expired">Expiré</span>' :
      !c.is_active ? '<span class="badge-inactive">Inactif</span>' :
      '<span class="badge-active">Actif</span>';
    qs('[data-edit]', tr).dataset.edit = c.id;
    qs('[data-delete]', tr).dataset.delete = c.id;
  }

  _periodLabel(c) {
    const fmt = (s) => s ? new Date(s).toLocaleDateString('fr-FR') : null;
    const start = fmt(c.starts_at);
    const end = fmt(c.expires_at);
    if (!start && !end) return 'Sans limite';
    if (start && end) return `${start} → ${end}`;
    if (start) return `Dès ${start}`;
    return `Jusqu'au ${end}`;
  }
}
