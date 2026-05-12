/**
 * OrderDetailView — modal detail + status update + refund.
 */

import { BaseView } from '../_lib/View.js';
import { h, escape } from '../_lib/dom.js';
import { STATUS_LABELS, PAYMENT_LABELS, METHOD_LABELS, fmtMoney, fmtDate, fmtDateTime } from './OrdersTableView.js';

export class OrderDetailView extends BaseView {

  buildDetailHtml(order) {
    const b = order.billing_address || {};
    const s = order.shipping_address || {};
    const c = order.customer;

    let html = '<div class="order-detail">';

    // Header
    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <span style="font-family:monospace;font-size:16px;font-weight:700">${escape(order.order_number)}</span>
        <span class="order-badge ${order.status}" style="margin-left:8px">${STATUS_LABELS[order.status] || order.status}</span>
        <span class="order-badge ${order.payment_status}" style="margin-left:4px">${PAYMENT_LABELS[order.payment_status] || order.payment_status}</span>
      </div>
      <div style="font-size:13px;color:var(--gray-500)">${fmtDateTime(order.placed_at)}</div>
    </div>`;

    // Grid: billing / shipping
    html += '<div class="detail-grid">';
    html += `<div class="detail-section"><h4>Facturation</h4>
      ${this._addressHtml(b)}
    </div>`;
    html += `<div class="detail-section"><h4>Livraison</h4>
      ${this._addressHtml(s)}
    </div>`;
    html += '</div>';

    // Customer link
    if (c) {
      html += `<div class="detail-section" style="margin-bottom:16px"><h4>Client</h4>
        <div class="detail-field"><strong>Nom</strong> ${escape(c.first_name || '')} ${escape(c.last_name || '')}</div>
        <div class="detail-field"><strong>Email</strong> ${escape(c.email || '')}</div>
        <div class="detail-field"><strong>Entreprise</strong> ${escape(c.company || '-')}</div>
        <div class="detail-field"><strong>Statut pro</strong> <span class="pro-badge ${c.pro_status}">${c.pro_status}</span></div>
      </div>`;
    }

    // Items table
    html += '<div class="detail-section" style="margin-bottom:16px"><h4>Articles</h4>';
    html += '<table class="order-items-table"><thead><tr><th>Produit</th><th>SKU</th><th>Qte</th><th>PU HT</th><th>TVA</th><th>Total TTC</th></tr></thead><tbody>';
    for (const it of order.items || []) {
      html += `<tr>
        <td>${escape(it.product_title || '')}</td>
        <td style="font-family:monospace;font-size:11px">${escape(it.sku || '-')}</td>
        <td>${it.quantity}</td>
        <td>${fmtMoney(it.unit_price_cents)}</td>
        <td>${it.tax_rate}%</td>
        <td>${fmtMoney(it.line_total_cents)}</td>
      </tr>`;
    }
    html += '</tbody></table>';

    // Totals
    html += `<div style="text-align:right;margin-top:8px;font-size:13px">
      <div>Sous-total HT : <strong>${fmtMoney(order.subtotal_cents)}</strong></div>
      ${order.discount_cents > 0 ? `<div>Remise : <strong>-${fmtMoney(order.discount_cents)}</strong></div>` : ''}
      <div>Livraison : <strong>${fmtMoney(order.shipping_cents)}</strong> ${order.shipping_method_label ? `(${escape(order.shipping_method_label)})` : ''}</div>
      <div>TVA : <strong>${fmtMoney(order.tax_cents)}</strong></div>
      <div style="font-size:15px;margin-top:4px">Total TTC : <strong>${fmtMoney(order.total_cents, order.currency)}</strong></div>
      ${order.coupon_code ? `<div style="color:var(--gray-500)">Coupon : ${escape(order.coupon_code)}</div>` : ''}
    </div>`;
    html += '</div>';

    // Payment info
    if (order.payments?.length) {
      html += '<div class="detail-section" style="margin-bottom:16px"><h4>Paiements</h4>';
      for (const p of order.payments) {
        html += `<div class="detail-field"><strong>${escape(p.provider)}</strong> ${fmtMoney(p.amount_cents, p.currency)} — ${p.status} ${p.payment_method_type ? `(${p.payment_method_type})` : ''} — ${fmtDateTime(p.created_at)}</div>`;
      }
      html += '</div>';
    }

    // Events timeline
    if (order.events?.length) {
      html += '<div class="detail-section order-events"><h4>Historique</h4>';
      for (const ev of order.events) {
        const payload = ev.payload || {};
        let detail = '';
        if (ev.event_type === 'admin_note') detail = escape(payload.note || '');
        else if (ev.event_type === 'status_changed') detail = `${payload.from} → ${payload.to}`;
        else if (ev.event_type === 'admin_refund') detail = `Remboursement ${fmtMoney(payload.amount_cents)}`;
        else if (payload.note) detail = escape(payload.note);

        html += `<div class="order-event">
          <span class="ev-time">${fmtDateTime(ev.created_at)}</span>
          <span class="ev-type">${escape(ev.event_type)}</span>
          <span class="ev-detail">${detail}</span>
        </div>`;
      }
      html += '</div>';
    }

    // Status update form
    html += `<div class="status-form" id="order-status-form">
      <div class="form-group">
        <label>Changer le statut</label>
        <select class="form-select" id="detail-new-status" style="height:36px">
          ${Object.entries(STATUS_LABELS).map(([k, v]) =>
            `<option value="${k}" ${k === order.status ? 'selected' : ''}>${v}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group" style="flex:2">
        <label>Note interne (optionnelle)</label>
        <input type="text" class="form-input" id="detail-note" placeholder="Note visible uniquement par l'equipe" style="height:36px">
      </div>
      <button class="btn btn-primary" id="detail-update-btn" style="height:36px">Mettre a jour</button>
      ${order.payment_method === 'stripe' && ['paid', 'partially_refunded'].includes(order.payment_status)
        ? '<button class="btn" id="detail-refund-btn" style="height:36px;background:#dc3545;color:white;border-color:#dc3545">Rembourser</button>'
        : ''}
    </div>`;

    html += '</div>';
    return html;
  }

  _addressHtml(addr) {
    if (!addr) return '<span style="color:var(--gray-400)">-</span>';
    return `
      <div class="detail-field">${escape(addr.first_name || '')} ${escape(addr.last_name || '')}</div>
      ${addr.company ? `<div class="detail-field">${escape(addr.company)}</div>` : ''}
      <div class="detail-field">${escape(addr.address_line1 || '')}</div>
      ${addr.address_line2 ? `<div class="detail-field">${escape(addr.address_line2)}</div>` : ''}
      <div class="detail-field">${escape(addr.postcode || '')} ${escape(addr.city || '')}</div>
      <div class="detail-field">${escape(addr.country_code || '')}</div>
      ${addr.phone ? `<div class="detail-field">${escape(addr.phone)}</div>` : ''}
      ${addr.email ? `<div class="detail-field">${escape(addr.email)}</div>` : ''}
    `;
  }
}
