/**
 * CustomerDetailView — modal detail + edit pro_status/discount.
 */

import { BaseView } from '../_lib/View.js';
import { escape } from '../_lib/dom.js';
import { PRO_LABELS, fmtMoney, fmtDate } from './CustomersTableView.js';

const fmtDateTime = (s) => s ? new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

const ORDER_STATUS_LABELS = {
  awaiting_payment: 'Attente paiement',
  paid: 'Payée',
  processing: 'En traitement',
  fulfilled: 'Preparée',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
};

export class CustomerDetailView extends BaseView {

  buildDetailHtml(customer) {
    let html = '<div class="customer-detail">';

    // Header
    html += `<div style="margin-bottom:16px">
      <span style="font-size:16px;font-weight:700">${escape(customer.first_name || '')} ${escape(customer.last_name || '')}</span>
      <span class="pro-badge ${customer.pro_status}" style="margin-left:8px">${PRO_LABELS[customer.pro_status] || customer.pro_status}</span>
    </div>`;

    // Info grid
    html += '<div class="detail-grid">';
    html += `<div class="detail-section"><h4>Informations</h4>
      <div class="detail-field"><strong>Email</strong> ${escape(customer.email || '')}</div>
      <div class="detail-field"><strong>Telephone</strong> ${escape(customer.phone || '-')}</div>
      <div class="detail-field"><strong>Entreprise</strong> ${escape(customer.company || '-')}</div>
      <div class="detail-field"><strong>SIRET</strong> ${escape(customer.siret || '-')}</div>
      <div class="detail-field"><strong>Activite</strong> ${escape(customer.activity || '-')}</div>
      <div class="detail-field"><strong>N° TVA</strong> ${escape(customer.vat_number || '-')}</div>
    </div>`;
    html += `<div class="detail-section"><h4>Compte</h4>
      <div class="detail-field"><strong>Inscription</strong> ${fmtDateTime(customer.created_at)}</div>
      <div class="detail-field"><strong>Derniere connexion</strong> ${fmtDateTime(customer.last_login_at)}</div>
      <div class="detail-field"><strong>Commandes</strong> ${customer.order_count || 0}</div>
      <div class="detail-field"><strong>CA Payé</strong> ${fmtMoney(customer.total_spent_cents)}</div>
      <div class="detail-field"><strong>Remise actuelle</strong> ${customer.discount_rate != null ? customer.discount_rate + '%' : 'Aucune'}</div>
      <div class="detail-field"><strong>Paiement</strong> ${{ immediate: 'Comptant', net15: 'Net 15j', net30: 'Net 30j', net45: 'Net 45j', net60: 'Net 60j' }[customer.payment_terms] || 'Comptant'}</div>
      <div class="detail-field"><strong>Marketing</strong> ${customer.accepts_marketing ? 'Opt-in' : 'Opt-out'}</div>
    </div>`;
    html += '</div>';

    // Addresses
    if (customer.addresses?.length) {
      html += '<div class="detail-section" style="margin-bottom:16px"><h4>Adresses</h4>';
      for (const a of customer.addresses) {
        html += `<div style="margin-bottom:8px;padding:8px;background:var(--gray-50);border-radius:4px;font-size:12px">
          <strong>${a.label || a.type || 'Adresse'}</strong><br>
          ${escape(a.first_name || '')} ${escape(a.last_name || '')}<br>
          ${a.company ? escape(a.company) + '<br>' : ''}
          ${escape(a.address_line1 || '')}${a.address_line2 ? ', ' + escape(a.address_line2) : ''}<br>
          ${escape(a.postcode || '')} ${escape(a.city || '')} ${escape(a.country_code || '')}
          ${a.phone ? '<br>' + escape(a.phone) : ''}
        </div>`;
      }
      html += '</div>';
    }

    // Recent orders
    if (customer.orders?.length) {
      html += '<div class="detail-section" style="margin-bottom:16px"><h4>Commandes recentes</h4>';
      html += '<table class="customer-orders-table"><thead><tr><th>N°</th><th>Statut</th><th>Paiement</th><th>Total</th><th>Date</th></tr></thead><tbody>';
      for (const o of customer.orders) {
        html += `<tr>
          <td style="font-family:monospace;font-size:11px">${escape(o.order_number)}</td>
          <td><span class="order-badge ${o.status}">${ORDER_STATUS_LABELS[o.status] || o.status}</span></td>
          <td><span class="order-badge ${o.payment_status}">${o.payment_status}</span></td>
          <td>${fmtMoney(o.total_cents, o.currency)}</td>
          <td>${fmtDate(o.placed_at)}</td>
        </tr>`;
      }
      html += '</tbody></table>';
      html += '</div>';
    }

    // Edit form
    const PAYMENT_TERMS = { immediate: 'Comptant', net15: 'Net 15j', net30: 'Net 30j', net45: 'Net 45j', net60: 'Net 60j' };
    html += `<div class="edit-form" id="customer-edit-form">
      <div class="form-group">
        <label>Statut pro</label>
        <select class="form-select" id="detail-pro-status" style="height:36px">
          ${Object.entries(PRO_LABELS).map(([k, v]) =>
            `<option value="${k}" ${k === customer.pro_status ? 'selected' : ''}>${v}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group" style="max-width:120px">
        <label>Remise (%)</label>
        <input type="number" class="form-input" id="detail-discount" step="0.1" min="0" max="100" value="${customer.discount_rate ?? ''}" placeholder="-" style="height:36px">
      </div>
      <div class="form-group">
        <label>Conditions de paiement</label>
        <select class="form-select" id="detail-payment-terms" style="height:36px">
          ${Object.entries(PAYMENT_TERMS).map(([k, v]) =>
            `<option value="${k}" ${k === (customer.payment_terms || 'immediate') ? 'selected' : ''}>${v}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group" style="flex:2">
        <label>Note interne</label>
        <input type="text" class="form-input" id="detail-note" placeholder="Note visible uniquement par l'equipe" style="height:36px">
      </div>
      <button class="btn btn-primary" id="detail-save-btn" style="height:36px">Enregistrer</button>
    </div>`;

    html += '</div>';
    return html;
  }
}
