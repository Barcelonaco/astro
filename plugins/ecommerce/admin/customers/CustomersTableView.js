/**
 * CustomersTableView — table list + pagination + filters.
 */

import { BaseView } from '../_lib/View.js';
import { qs, cloneTpl, delegate, escape } from '../_lib/dom.js';

const fmtMoney = (cents, currency = 'EUR') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format((cents || 0) / 100);

const fmtDate = (s) => s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

const PRO_LABELS = {
  none: 'Particulier',
  pending: 'En attente',
  approved: 'Approuve',
  rejected: 'Refuse',
};

export class CustomersTableView extends BaseView {
  mount(root) {
    this.root = root;
    this.tbody = qs('#customers-tbody', root);
    this.loading = qs('#customers-loading', root);
    this.empty = qs('#customers-empty', root);
    this.tableCard = qs('#customers-table-card', root);
    this.pagination = qs('#customers-pagination', root);
    this.statsEl = qs('#customers-stats', root);

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
    if (state.loading && !state.customers.length) {
      this.loading.style.display = 'block';
      this.tableCard.style.display = 'none';
      this.empty.style.display = 'none';
      return;
    }
    this.loading.style.display = 'none';

    if (!state.customers.length) {
      this.tableCard.style.display = 'none';
      this.empty.style.display = 'block';
      this.tbody.replaceChildren();
      this._last = [];
      this._renderPagination(state);
      return;
    }

    this.empty.style.display = 'none';
    this.tableCard.style.display = 'block';
    this._renderRows(state.customers);
    this._renderPagination(state);
    this._last = state.customers;
  }

  renderStats(stats) {
    if (!stats || !this.statsEl) return;
    const pills = [
      { label: 'Total', value: stats.total },
      { label: 'Pro en attente', value: stats.pending_pro, cls: stats.pending_pro > 0 ? 'highlight' : '' },
      { label: 'Pro actifs', value: stats.approved_pro, cls: 'success' },
    ];
    this.statsEl.innerHTML = pills.map(p =>
      `<span class="stat-pill ${p.cls || ''}">${p.label} : ${p.value}</span>`
    ).join('');
  }

  _renderRows(customers) {
    const existing = new Map();
    for (const tr of this.tbody.children) existing.set(+tr.dataset.id, tr);
    const seen = new Set();

    customers.forEach((c, i) => {
      seen.add(c.id);
      let tr = existing.get(c.id);
      if (!tr) {
        const frag = cloneTpl('customer-row-tpl');
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
    qs('.cell-name', tr).textContent = `${c.first_name || ''} ${c.last_name || ''}`.trim() || '-';
    qs('.cell-email', tr).textContent = c.email || '';
    qs('.cell-company', tr).textContent = c.company || '-';
    qs('.cell-pro-status', tr).innerHTML = `<span class="pro-badge ${c.pro_status}">${PRO_LABELS[c.pro_status] || c.pro_status}</span>`;
    qs('.cell-discount', tr).textContent = c.discount_rate != null ? `${c.discount_rate}%` : '-';
    qs('.cell-orders', tr).textContent = c.order_count || 0;
    qs('.cell-revenue', tr).textContent = fmtMoney(c.total_spent_cents);
    qs('.cell-date', tr).textContent = fmtDate(c.created_at);
    qs('[data-view]', tr).dataset.view = c.id;
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
    html += `<span class="page-info">${state.total} clients</span>`;
    this.pagination.innerHTML = html;
    delegate(this.pagination, 'click', '[data-page]', (e, btn) => {
      this.handlers.onPage?.(+btn.dataset.page);
    });
  }
}

export { PRO_LABELS, fmtMoney, fmtDate };
