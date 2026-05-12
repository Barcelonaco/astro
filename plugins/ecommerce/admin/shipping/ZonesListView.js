/**
 * ZonesListView — render des cards zones avec leurs méthodes imbriquées.
 *
 * Pas de surgical update ici (zones rare et liste courte) — innerHTML rebuild OK.
 *
 * Handlers :
 *   onCreateZone() / onEditZone(zone) / onDeleteZone(id)
 *   onAddMethod(zoneId) / onEditMethod(zoneId, methodId) / onDeleteMethod(id)
 */

import { BaseView } from '../_lib/View.js';
import { qs, escape, delegate } from '../_lib/dom.js';

const fmtMoney = (cents) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);

export class ZonesListView extends BaseView {
  mount(root) {
    this.root = root;
    this.list = qs('#zones-list', root);
    this.loading = qs('#zones-loading', root);
    this.empty = qs('#zones-empty', root);

    this.on(qs('#zones-add-btn', root), 'click', () => this.handlers.onCreateZone?.());

    delegate(this.list, 'click', '[data-edit-zone]', (e, btn) =>
      this.handlers.onEditZone?.(+btn.dataset.editZone));
    delegate(this.list, 'click', '[data-delete-zone]', (e, btn) =>
      this.handlers.onDeleteZone?.(+btn.dataset.deleteZone));
    delegate(this.list, 'click', '[data-add-method]', (e, btn) =>
      this.handlers.onAddMethod?.(+btn.dataset.addMethod));
    delegate(this.list, 'click', '[data-edit-method]', (e, btn) =>
      this.handlers.onEditMethod?.(+btn.dataset.zoneId, +btn.dataset.editMethod));
    delegate(this.list, 'click', '[data-delete-method]', (e, btn) =>
      this.handlers.onDeleteMethod?.(+btn.dataset.deleteMethod));

    return this;
  }

  render(state) {
    if (state.loading && !state.zones.length) {
      this.loading.style.display = 'block';
      this.list.style.display = 'none';
      this.empty.style.display = 'none';
      return;
    }
    this.loading.style.display = 'none';

    if (!state.zones.length) {
      this.list.style.display = 'none';
      this.empty.style.display = 'block';
      return;
    }

    this.empty.style.display = 'none';
    this.list.style.display = 'block';
    this.list.innerHTML = state.zones.map(z => this._zoneCard(z)).join('');
  }

  _zoneCard(z) {
    const patterns = (z.postcode_patterns || []).map(p => `<span class="pattern-tag">${escape(p)}</span>`).join('');
    const countries = (z.countries || []).join(', ');
    const methods = (z.methods || []).map(m => this._methodRow(m)).join('');
    return `
      <div class="card zone-card" data-zone-id="${z.id}">
        <div class="zone-head">
          <div>
            <h3 class="zone-title">${escape(z.name)}</h3>
            <div class="zone-meta">
              <strong>Pays :</strong> ${escape(countries) || 'aucun'}
              · <strong>Priorité :</strong> ${z.priority}
              ${patterns ? `<div class="pattern-list">${patterns}</div>` : '<div class="pattern-list"><em style="color:var(--gray-400);font-size:13px">Tous les codes postaux</em></div>'}
            </div>
          </div>
          <div class="zone-actions">
            <button class="btn btn-outline btn-sm" data-edit-zone="${z.id}">Modifier</button>
            <button class="icon-btn danger" data-delete-zone="${z.id}" title="Supprimer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
            </button>
          </div>
        </div>
        <div class="methods-list">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong style="font-size:13px;color:var(--gray-700);text-transform:uppercase;letter-spacing:0.04em">Méthodes</strong>
            <button class="btn btn-outline btn-sm" data-add-method="${z.id}">+ Méthode</button>
          </div>
          ${methods || '<div class="empty" style="padding:16px">Aucune méthode dans cette zone.</div>'}
        </div>
      </div>
    `;
  }

  _methodRow(m) {
    let priceLabel;
    if (m.type === 'free') priceLabel = 'Gratuit';
    else if (m.type === 'flat') priceLabel = fmtMoney(m.price_cents);
    else priceLabel = m.type === 'weight' ? 'Par poids' : 'Par montant';

    const delay = (m.delivery_min_days || m.delivery_max_days)
      ? `<span class="method-desc">${m.delivery_min_days || '?'}-${m.delivery_max_days || '?'} jours</span>` : '';

    return `
      <div class="method-row" ${!m.is_active ? 'data-inactive' : ''}>
        <span class="method-type">${escape(m.type)}</span>
        <div style="flex:1">
          <div class="method-name">${escape(m.name)}${!m.is_active ? ' <span style="color:var(--gray-400);font-size:12px">(désactivée)</span>' : ''}</div>
          ${m.description ? `<div class="method-desc">${escape(m.description)}</div>` : ''}
          ${delay}
        </div>
        <div class="method-price">${escape(priceLabel)}</div>
        <div class="method-actions">
          <button class="icon-btn" data-edit-method="${m.id}" data-zone-id="${m.zone_id}" title="Modifier">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn danger" data-delete-method="${m.id}" title="Supprimer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
          </button>
        </div>
      </div>
    `;
  }
}
