/**
 * CouponFormView — formulaire modal Swal pour créer/éditer un coupon.
 *
 * Champs conditionnels selon le type :
 *   - percent → champ "pourcentage"
 *   - fixed   → champ "montant centimes"
 *   - free_shipping → aucun (juste le min panier optionnel)
 *
 * Code editable en création, readonly en édition.
 */

import { BaseView } from '../_lib/View.js';
import { h, qs, qsa } from '../_lib/dom.js';

export class CouponFormView extends BaseView {
  mount(root) {
    this.root = root || this._buildForm();
    this.form = this.root instanceof HTMLFormElement ? this.root : qs('form', this.root);
    this.on(this.form, 'submit', (e) => e.preventDefault());
    this.on(this.form.elements.type, 'change', () => this._toggleTypeFields());
    return this;
  }

  setCoupon(coupon) {
    const f = this.form;
    f.reset();
    f.elements.id.value = coupon?.id || '';
    f.elements.code.value = coupon?.code || '';
    f.elements.code.readOnly = !!coupon;
    f.elements.type.value = coupon?.type || 'percent';
    f.elements.percent.value = coupon?.percent || '';
    f.elements.value_cents.value = coupon?.value_cents || '';
    f.elements.min_subtotal_cents.value = coupon?.min_subtotal_cents || '';
    f.elements.max_uses.value = coupon?.max_uses || '';
    f.elements.max_uses_per_customer.value = coupon?.max_uses_per_customer || '';
    f.elements.starts_at.value = this._toIsoLocal(coupon?.starts_at);
    f.elements.expires_at.value = this._toIsoLocal(coupon?.expires_at);
    f.elements.applies_to.value = coupon?.applies_to || 'all';
    f.elements.is_active.checked = coupon ? !!coupon.is_active : true;
    this._toggleTypeFields();
  }

  getElement() { return this.form; }

  collect() {
    const f = this.form;
    if (!f.checkValidity()) {
      f.reportValidity();
      throw new Error('Champs invalides');
    }
    return {
      id: f.elements.id.value ? +f.elements.id.value : null,
      code: f.elements.code.value,
      type: f.elements.type.value,
      percent: f.elements.percent.value,
      value_cents: f.elements.value_cents.value,
      min_subtotal_cents: f.elements.min_subtotal_cents.value,
      max_uses: f.elements.max_uses.value,
      max_uses_per_customer: f.elements.max_uses_per_customer.value,
      starts_at: f.elements.starts_at.value,
      expires_at: f.elements.expires_at.value,
      applies_to: f.elements.applies_to.value,
      is_active: f.elements.is_active.checked,
    };
  }

  _toggleTypeFields() {
    const type = this.form.elements.type.value;
    qsa('[data-show]', this.form).forEach(el => {
      el.style.display = el.dataset.show === type ? '' : 'none';
    });
  }

  _toIsoLocal(s) {
    if (!s) return '';
    return s.replace(' ', 'T').slice(0, 16);
  }

  _buildForm() {
    return h('form', { id: 'coupon-form' },
      h('input', { type: 'hidden', name: 'id' }),

      h('div', { class: 'form-row' },
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Code'),
          h('input', { class: 'form-input', type: 'text', name: 'code', required: true, placeholder: 'WELCOME10', pattern: '[A-Z0-9_\\-]+' }),
          h('span', { class: 'form-hint' }, 'A-Z, chiffres, _, -. Saisi par le client au panier.'),
        ),
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Type'),
          h('select', { class: 'form-select', name: 'type' },
            h('option', { value: 'percent' }, 'Pourcentage'),
            h('option', { value: 'fixed' }, 'Montant fixe'),
            h('option', { value: 'free_shipping' }, 'Livraison gratuite'),
          ),
        ),
      ),

      h('div', { class: 'form-row' },
        h('div', { class: 'form-group', 'data-show': 'percent' },
          h('label', { class: 'form-label' }, 'Pourcentage de réduction (%)'),
          h('input', { class: 'form-input', type: 'number', step: '0.01', name: 'percent', placeholder: '10' }),
        ),
        h('div', { class: 'form-group', 'data-show': 'fixed', style: 'display:none' },
          h('label', { class: 'form-label' }, 'Montant de réduction (centimes)'),
          h('input', { class: 'form-input', type: 'number', name: 'value_cents', placeholder: '1000 = 10,00 €' }),
        ),
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Minimum panier (centimes)'),
          h('input', { class: 'form-input', type: 'number', name: 'min_subtotal_cents', placeholder: 'Vide = pas de minimum' }),
        ),
      ),

      h('div', { class: 'form-row' },
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Utilisations max (total)'),
          h('input', { class: 'form-input', type: 'number', name: 'max_uses', placeholder: 'Vide = illimité' }),
        ),
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Max par client'),
          h('input', { class: 'form-input', type: 'number', name: 'max_uses_per_customer', placeholder: 'Vide = illimité' }),
        ),
      ),

      h('div', { class: 'form-row' },
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Date de début'),
          h('input', { class: 'form-input', type: 'datetime-local', name: 'starts_at' }),
        ),
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Date de fin'),
          h('input', { class: 'form-input', type: 'datetime-local', name: 'expires_at' }),
        ),
      ),

      h('div', { class: 'form-row' },
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Champ d\'application'),
          h('select', { class: 'form-select', name: 'applies_to' },
            h('option', { value: 'all' }, 'Tout le catalogue'),
            h('option', { value: 'products' }, 'Produits spécifiques'),
            h('option', { value: 'categories' }, 'Catégories spécifiques'),
          ),
        ),
        h('div', { class: 'form-group' },
          h('label', { class: 'check-row', style: 'margin-top:24px' },
            h('input', { type: 'checkbox', name: 'is_active' }),
            h('span', null, 'Coupon actif'),
          ),
        ),
      ),
    );
  }
}
