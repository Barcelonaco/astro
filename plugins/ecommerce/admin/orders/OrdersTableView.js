/**
 * OrdersTableView — table list + pagination + filters.
 */

import { BaseView } from '../_lib/View.js';
import { qs, cloneTpl, delegate, escape } from '../_lib/dom.js';

const fmtMoney = (cents, currency = 'EUR') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format((cents || 0) / 100);

const fmtDate = (s) => s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const fmtDateTime = (s) => s ? new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

const STATUS_LABELS = {
  awaiting_payment: 'Attente paiement',
  paid: 'Payée',
  processing: 'En traitement',
  fulfilled: 'Preparee',
  shipped: 'Expediee',
  delivered: 'Livree',
  cancelled: 'Annulee',
  refunded: 'Remboursee',
};

const PAYMENT_LABELS = {
  unpaid: 'Non Payé',
  pending: 'En attente',
  paid: 'Payé',
  failed: 'Echoue',
  refunded: 'Rembourse',
  partially_refunded: 'Partiel',
};

const METHOD_LABELS = {
  stripe: 'CB Stripe',
  paypal: 'PayPal',
  bank_transfer: 'Virement',
  on_invoice: 'Sur facture',
};

export class OrdersTableView extends BaseView {
  mount(root) {
    this.root = root;
    this.tbody = qs('#orders-tbody', root);
    this.loading = qs('#orders-loading', root);
    this.empty = qs('#orders-empty', root);
    this.tableCard = qs('#orders-table-card', root);
    this.pagination = qs('#orders-pagination', root);
    this.statsEl = qs('#orders-stats', root);

    // Row click → view detail
    delegate(this.tbody, 'click', '[data-view]', (e, btn) => {
      this.handlers.onView?.(+btn.dataset.view);
    });
    delegate(this.tbody, 'click', 'tr', (e) => {
      if (e.target.closest('button')) return;
      const tr = e.target.closest('tr');
      const id = tr?.dataset?.id;
      if (id) this.handlers.onView?.(+id);
    });

    this._last = [];
    return this;
  }

  render(state) {
    if (state.loading && !state.orders.length) {
      this.loading.style.display = 'block';
      this.tableCard.style.display = 'none';
      this.empty.style.display = 'none';
      return;
    }
    this.loading.style.display = 'none';

    if (!state.orders.length) {
      this.tableCard.style.display = 'none';
      this.empty.style.display = 'block';
      this.tbody.replaceChildren();
      this._last = [];
      this._renderPagination(state);
      return;
    }

    this.empty.style.display = 'none';
    this.tableCard.style.display = 'block';
    this._renderRows(state.orders);
    this._renderPagination(state);
    this._last = state.orders;
  }

  renderStats(stats) {
    if (!stats || !this.statsEl) return;
    const pills = [
      { label: 'Total', value: stats.total },
      { label: 'Payées', value: stats.paid, cls: 'highlight' },
      { label: 'En attente', value: stats.awaiting_payment },
      { label: 'Expediees', value: stats.shipped },
    ];
    this.statsEl.innerHTML = pills.map(p =>
      `<span class="stat-pill ${p.cls || ''}">${p.label} : ${p.value}</span>`
    ).join('');
  }

  _renderRows(orders) {
    const existing = new Map();
    for (const tr of this.tbody.children) existing.set(+tr.dataset.id, tr);
    const seen = new Set();

    orders.forEach((o, i) => {
      seen.add(o.id);
      let tr = existing.get(o.id);
      if (!tr) {
        const frag = cloneTpl('order-row-tpl');
        tr = frag.querySelector('tr');
        this.tbody.appendChild(tr);
      }
      this._fillRow(tr, o);
      if (this.tbody.children[i] !== tr) this.tbody.insertBefore(tr, this.tbody.children[i]);
    });
    for (const [id, tr] of existing) if (!seen.has(id)) tr.remove();
  }

  _fillRow(tr, o) {
    tr.dataset.id = o.id;
    qs('.cell-number', tr).textContent = o.order_number;
    const billing = o.billing_address || {};
    qs('.cell-client', tr).innerHTML = `<div style="font-size:12px;font-weight:500">${escape(billing.first_name || '')} ${escape(billing.last_name || '')}</div><div style="font-size:11px;color:var(--gray-500)">${escape(o.email || '')}</div>`;
    qs('.cell-status', tr).innerHTML = `<span class="order-badge ${o.status}">${STATUS_LABELS[o.status] || o.status}</span>`;
    qs('.cell-payment', tr).innerHTML = `<span class="order-badge ${o.payment_status}">${PAYMENT_LABELS[o.payment_status] || o.payment_status}</span>`;
    qs('.cell-method', tr).textContent = METHOD_LABELS[o.payment_method] || o.payment_method || '';
    qs('.cell-total', tr).textContent = fmtMoney(o.total_cents, o.currency);
    qs('.cell-date', tr).textContent = fmtDate(o.placed_at);
    qs('[data-view]', tr).dataset.view = o.id;
  }

  _renderPagination(state) {
    if (state.pages <= 1) { this.pagination.innerHTML = ''; return; }
    let html = '';
    html += `<button ${state.page <= 1 ? 'disabled' : ''} data-page="${state.page - 1}">&laquo;</button>`;
    for (let i = 1; i <= state.pages; i++) {
      if (state.pages > 7 && Math.abs(i - state.page) > 2 && i !== 1 && i !== state.pages) {
        if (i === 2 || i === state.pages - 1) html += '<span class="page-info">...</span>';
        continue;
      }
      html += `<button ${i === state.page ? 'class="active"' : ''} data-page="${i}">${i}</button>`;
    }
    html += `<button ${state.page >= state.pages ? 'disabled' : ''} data-page="${state.page + 1}">&raquo;</button>`;
    html += `<span class="page-info">${state.total} commandes</span>`;
    this.pagination.innerHTML = html;
    delegate(this.pagination, 'click', '[data-page]', (e, btn) => {
      this.handlers.onPage?.(+btn.dataset.page);
    });
  }
}

export { STATUS_LABELS, PAYMENT_LABELS, METHOD_LABELS, fmtMoney, fmtDate, fmtDateTime };
