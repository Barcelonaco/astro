/**
 * ZoneFormView — formulaire modal pour créer/modifier une zone.
 */

import { BaseView } from '../_lib/View.js';
import { h, qs } from '../_lib/dom.js';

export class ZoneFormView extends BaseView {
  mount(root) {
    this.root = root || this._buildForm();
    this.form = this.root instanceof HTMLFormElement ? this.root : qs('form', this.root);
    this.on(this.form, 'submit', (e) => e.preventDefault());
    return this;
  }

  setZone(zone) {
    const f = this.form;
    f.reset();
    f.elements.id.value = zone?.id || '';
    f.elements.name.value = zone?.name || '';
    f.elements.countries.value = (zone?.countries || ['FR']).join(', ');
    f.elements.postcode_patterns.value = (zone?.postcode_patterns || []).join('\n');
    f.elements.priority.value = zone?.priority ?? 0;
    f.elements.position.value = zone?.position ?? 0;
  }

  getElement() { return this.form; }

  collect() {
    const f = this.form;
    if (!f.checkValidity()) { f.reportValidity(); throw new Error('Champs invalides'); }
    return {
      id: f.elements.id.value ? +f.elements.id.value : null,
      name: f.elements.name.value,
      countries: f.elements.countries.value,
      postcode_patterns: f.elements.postcode_patterns.value,
      priority: f.elements.priority.value,
      position: f.elements.position.value,
    };
  }

  _buildForm() {
    return h('form', { id: 'zone-form' },
      h('input', { type: 'hidden', name: 'id' }),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Nom'),
        h('input', { class: 'form-input', type: 'text', name: 'name', required: true, placeholder: 'France métropolitaine' }),
      ),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Pays (codes ISO, séparés par virgule)'),
        h('input', { class: 'form-input', type: 'text', name: 'countries', value: 'FR', placeholder: 'FR, BE, CH' }),
      ),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Codes postaux (un par ligne)'),
        h('span', { class: 'form-hint' }, 'Vide = tous les CP du pays. Patterns : 30000, 30000-30999, 30*'),
        h('textarea', { class: 'form-input', name: 'postcode_patterns', rows: 4, placeholder: '75*\n92000-92999' }),
      ),
      h('div', { class: 'form-row' },
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Priorité'),
          h('input', { class: 'form-input', type: 'number', name: 'priority', value: '0' }),
          h('span', { class: 'form-hint' }, 'Plus élevé = vérifié en premier'),
        ),
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Position'),
          h('input', { class: 'form-input', type: 'number', name: 'position', value: '0' }),
          h('span', { class: 'form-hint' }, 'Ordre d\'affichage'),
        ),
      ),
    );
  }
}
