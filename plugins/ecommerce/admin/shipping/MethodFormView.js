/**
 * MethodFormView — formulaire modal pour créer/modifier une méthode de livraison.
 *
 * Champs conditionnels selon le type :
 *   - flat → prix + seuil franco
 *   - free → aucun
 *   - weight / price → paliers
 */

import { BaseView } from '../_lib/View.js';
import { h, qs, qsa } from '../_lib/dom.js';

export class MethodFormView extends BaseView {
  mount(root) {
    this.root = root || this._buildForm();
    this.form = this.root instanceof HTMLFormElement ? this.root : qs('form', this.root);
    this.on(this.form, 'submit', (e) => e.preventDefault());
    this.on(this.form.elements.type, 'change', () => this._toggleTypeFields());
    return this;
  }

  setMethod(method, zoneId) {
    const f = this.form;
    f.reset();
    f.elements.id.value = method?.id || '';
    f.elements.zone_id.value = zoneId;
    f.elements.name.value = method?.name || '';
    f.elements.type.value = method?.type || 'flat';
    f.elements.description.value = method?.description || '';
    f.elements.price_cents.value = method?.price_cents ?? 0;
    f.elements.free_threshold_cents.value = method?.free_threshold_cents || '';
    f.elements.weight_tiers_text.value = (method?.weight_tiers || [])
      .map(t => `${t.min}:${t.max ?? ''}:${t.price_cents}`).join('\n');
    f.elements.delivery_min_days.value = method?.delivery_min_days || '';
    f.elements.delivery_max_days.value = method?.delivery_max_days || '';
    f.elements.tax_code.value = method?.tax_code || '';
    f.elements.is_active.checked = method ? !!method.is_active : true;
    f.elements.position.value = method?.position ?? 0;
    this._toggleTypeFields();
  }

  getElement() { return this.form; }

  collect() {
    const f = this.form;
    if (!f.checkValidity()) { f.reportValidity(); throw new Error('Champs invalides'); }
    return {
      id: f.elements.id.value ? +f.elements.id.value : null,
      zone_id: +f.elements.zone_id.value,
      name: f.elements.name.value,
      type: f.elements.type.value,
      description: f.elements.description.value,
      price_cents: f.elements.price_cents.value,
      free_threshold_cents: f.elements.free_threshold_cents.value,
      weight_tiers_text: f.elements.weight_tiers_text.value,
      delivery_min_days: f.elements.delivery_min_days.value,
      delivery_max_days: f.elements.delivery_max_days.value,
      tax_code: f.elements.tax_code.value,
      is_active: f.elements.is_active.checked,
      position: f.elements.position.value,
    };
  }

  _toggleTypeFields() {
    const type = this.form.elements.type.value;
    qsa('[data-show]', this.form).forEach(el => {
      const allowed = el.dataset.show.split(' ');
      el.style.display = allowed.includes(type) ? '' : 'none';
    });
  }

  _buildForm() {
    return h('form', { id: 'method-form' },
      h('input', { type: 'hidden', name: 'id' }),
      h('input', { type: 'hidden', name: 'zone_id' }),
      h('div', { class: 'form-row' },
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Nom'),
          h('input', { class: 'form-input', type: 'text', name: 'name', required: true, placeholder: 'Standard 48h' }),
        ),
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Type'),
          h('select', { class: 'form-select', name: 'type' },
            h('option', { value: 'flat' }, 'Forfait'),
            h('option', { value: 'free' }, 'Gratuit'),
            h('option', { value: 'weight' }, 'Par poids'),
            h('option', { value: 'price' }, 'Par montant'),
          ),
        ),
      ),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Description'),
        h('input', { class: 'form-input', type: 'text', name: 'description', placeholder: 'Livraison Colissimo standard' }),
      ),
      h('div', { class: 'form-group', 'data-show': 'flat' },
        h('label', { class: 'form-label' }, 'Prix (centimes)'),
        h('input', { class: 'form-input', type: 'number', name: 'price_cents', value: '0' }),
        h('span', { class: 'form-hint' }, 'Ex : 990 = 9,90 €'),
      ),
      h('div', { class: 'form-group', 'data-show': 'flat' },
        h('label', { class: 'form-label' }, 'Seuil franco (centimes, optionnel)'),
        h('input', { class: 'form-input', type: 'number', name: 'free_threshold_cents', placeholder: 'Vide = jamais gratuit' }),
        h('span', { class: 'form-hint' }, 'Si le panier dépasse ce montant, livraison offerte'),
      ),
      h('div', { class: 'form-group', 'data-show': 'weight price', style: 'display:none' },
        h('label', { class: 'form-label' }, 'Paliers (un par ligne : min:max:prix_cents)'),
        h('textarea', { class: 'form-input', name: 'weight_tiers_text', rows: 4, placeholder: '0:1000:590\n1001:5000:990\n5001::1990' }),
        h('span', { class: 'form-hint' }, 'Pour "par poids" : poids en grammes. Pour "par montant" : montant en centimes. min::prix = sans plafond.'),
      ),
      h('div', { class: 'form-row' },
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Délai min (jours)'),
          h('input', { class: 'form-input', type: 'number', name: 'delivery_min_days' }),
        ),
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Délai max (jours)'),
          h('input', { class: 'form-input', type: 'number', name: 'delivery_max_days' }),
        ),
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Code TVA'),
          h('input', { class: 'form-input', type: 'text', name: 'tax_code', placeholder: 'FR_STANDARD' }),
        ),
      ),
      h('div', { class: 'form-row' },
        h('div', { class: 'form-group' },
          h('label', { class: 'check-row' },
            h('input', { type: 'checkbox', name: 'is_active' }),
            h('span', null, 'Méthode active'),
          ),
        ),
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Position'),
          h('input', { class: 'form-input', type: 'number', name: 'position', value: '0' }),
        ),
      ),
    );
  }
}
