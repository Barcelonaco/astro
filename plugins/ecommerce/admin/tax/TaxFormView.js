/**
 * TaxFormView — formulaire d'édition d'un taux (utilisé dans modalForm Swal).
 *
 * La modale Swal fournit ses propres boutons (Enregistrer / Annuler) et appelle
 * notre `collect()` via preConfirm. Le formulaire ne gère donc pas son submit.
 *
 * Mode création : code éditable. Mode édition : code en readonly.
 */

import { BaseView } from '../_lib/View.js';
import { h, qs } from '../_lib/dom.js';

export class TaxFormView extends BaseView {
  mount(root) {
    this.root = root || this._buildForm();
    this.form = this.root instanceof HTMLFormElement ? this.root : qs('form', this.root);
    // Empêche le submit natif (Swal gère via preConfirm).
    this.on(this.form, 'submit', (e) => e.preventDefault());
    return this;
  }

  setRate(rate) {
    const f = this.form;
    f.reset();
    f.elements.id.value = rate?.id || '';
    f.elements.code.value = rate?.code || '';
    f.elements.code.readOnly = !!rate;
    f.elements.label.value = rate?.label || '';
    f.elements.rate.value = rate?.rate ?? 20;
    f.elements.country_code.value = rate?.country_code || 'FR';
    f.elements.is_default.checked = !!rate?.is_default;
  }

  getElement() { return this.form; }

  /**
   * Lit + valide les valeurs courantes du formulaire. Throw si invalide.
   * Appelé par main.js dans le preConfirm de Swal.
   */
  collect() {
    const f = this.form;
    if (!f.checkValidity()) {
      f.reportValidity();
      throw new Error('Champs invalides');
    }
    return {
      id: f.elements.id.value ? +f.elements.id.value : null,
      code: f.elements.code.value.toUpperCase(),
      label: f.elements.label.value,
      rate: parseFloat(f.elements.rate.value),
      country_code: f.elements.country_code.value.toUpperCase(),
      is_default: f.elements.is_default.checked,
    };
  }

  _buildForm() {
    return h('form', { id: 'tax-form', class: 'tax-form' },
      h('input', { type: 'hidden', name: 'id' }),
      h('div', { class: 'form-row' },
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Code interne'),
          h('input', { class: 'form-input', type: 'text', name: 'code', required: true, placeholder: 'FR_STANDARD', pattern: '[A-Z0-9_]+' }),
          h('span', { class: 'form-hint' }, 'A-Z, chiffres, underscore. Non modifiable après création.'),
        ),
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Pays (ISO)'),
          h('input', { class: 'form-input', type: 'text', name: 'country_code', value: 'FR', maxlength: 2, required: true }),
        ),
      ),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Libellé visible'),
        h('input', { class: 'form-input', type: 'text', name: 'label', required: true, placeholder: 'TVA 20%' }),
      ),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Taux (%)'),
        h('input', { class: 'form-input', type: 'number', step: '0.01', name: 'rate', required: true, value: '20' }),
      ),
      h('div', { class: 'form-group' },
        h('label', { class: 'check-row' },
          h('input', { type: 'checkbox', name: 'is_default' }),
          h('span', null, 'Taux par défaut pour ce pays'),
        ),
      ),
    );
  }
}
