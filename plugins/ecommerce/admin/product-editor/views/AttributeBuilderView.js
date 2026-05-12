/**
 * AttributeBuilderView — onglet "Attributs" WC-style.
 *
 * Chaque attribut est une carte avec :
 *   - Nom de l'attribut (header de la carte)
 *   - Tags de valeurs (ajout via input + Enter)
 *   - Toggles Visible / Variations
 *
 * Structure stockée dans custom_fields.attributes :
 *   [{ name, values: [...], visible, used_for_variations }]
 */

import { BaseView } from '../../_lib/View.js';
import { h, qs } from '../../_lib/dom.js';

export class AttributeBuilderView extends BaseView {
  mount(root) {
    this.root = root;
    this.list = h('div', { class: 'pe-attr-list' });
    const addBtn = h('button', { class: 'btn btn-outline btn-sm', type: 'button', style: 'margin-top:12px',
      onclick: () => { this._addRow(); this._emit(); } }, '+ Ajouter un attribut');
    root.replaceChildren(this.list, addBtn);
    this._lastJson = null;
    return this;
  }

  render(state) {
    const attrs = state.product.custom_fields?.attributes || [];
    const json = JSON.stringify(attrs);
    if (json === this._lastJson) return;
    this._lastJson = json;
    this.list.replaceChildren();
    if (attrs.length === 0) {
      this._addRow();
      return;
    }
    attrs.forEach(a => this._addRow(a));
  }

  _addRow(attr = { name: '', values: [], visible: true, used_for_variations: false }) {
    const values = [...(attr.values || [])];

    // Tags container
    const tagsWrap = h('div', { class: 'pe-attr-tags' });
    values.forEach(v => tagsWrap.appendChild(this._makeTag(v, tagsWrap)));

    // Input for adding new values
    const tagInput = h('input', {
      class: 'pe-attr-tag-input', type: 'text',
      placeholder: values.length ? '' : 'Ajouter une valeur...',
    });
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = tagInput.value.trim().replace(/,+$/, '');
        if (val && !this._getTagValues(tagsWrap).includes(val)) {
          tagsWrap.insertBefore(this._makeTag(val, tagsWrap), tagInput);
          tagInput.placeholder = '';
          this._emit();
        }
        tagInput.value = '';
      }
      // Backspace on empty → remove last tag
      if (e.key === 'Backspace' && !tagInput.value) {
        const tags = tagsWrap.querySelectorAll('.pe-attr-tag');
        if (tags.length) { tags[tags.length - 1].remove(); this._emit(); }
      }
    });
    // Also handle paste of multiple values (S | M | L)
    tagInput.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      const parts = text.split(/[|,]/).map(s => s.trim()).filter(Boolean);
      const existing = this._getTagValues(tagsWrap);
      parts.forEach(v => {
        if (!existing.includes(v)) {
          tagsWrap.insertBefore(this._makeTag(v, tagsWrap), tagInput);
        }
      });
      if (parts.length) { tagInput.placeholder = ''; this._emit(); }
    });
    tagsWrap.appendChild(tagInput);

    const card = h('div', { class: 'pe-attr-card' },
      // Header
      h('div', { class: 'pe-attr-card-header' },
        h('input', { class: 'pe-attr-name-input', type: 'text', placeholder: 'Nom (ex: Taille, Couleur)',
          value: attr.name || '',
          onchange: () => this._emit() }),
        h('button', { class: 'pe-attr-delete', type: 'button', title: 'Supprimer cet attribut',
          onclick: () => { card.remove(); this._emit(); } },
          h('span', { html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>' }),
        ),
      ),
      // Values
      h('div', { class: 'pe-attr-card-body' },
        h('label', { class: 'pe-attr-field-label' }, 'Valeurs'),
        tagsWrap,
      ),
      // Footer toggles
      h('div', { class: 'pe-attr-card-footer' },
        h('label', { class: 'pe-attr-toggle' },
          h('input', { type: 'checkbox', checked: attr.visible !== false, onchange: () => this._emit() }),
          h('span', null, 'Visible sur la fiche'),
        ),
        h('label', { class: 'pe-attr-toggle' },
          h('input', { type: 'checkbox', checked: !!attr.used_for_variations, onchange: () => this._emit() }),
          h('span', null, 'Utilisé pour les variations'),
        ),
      ),
    );

    this.list.appendChild(card);
  }

  _makeTag(value, container) {
    const tag = h('span', { class: 'pe-attr-tag' },
      h('span', null, value),
      h('button', { type: 'button', class: 'pe-attr-tag-x',
        onclick: () => { tag.remove(); this._emit(); } }, '\u00d7'),
    );
    return tag;
  }

  _getTagValues(container) {
    return Array.from(container.querySelectorAll('.pe-attr-tag'))
      .map(t => t.querySelector('span').textContent.trim());
  }

  _collect() {
    return Array.from(this.list.children).map(card => {
      const name = card.querySelector('.pe-attr-name-input')?.value.trim() || '';
      const values = this._getTagValues(card.querySelector('.pe-attr-tags'));
      const checkboxes = card.querySelectorAll('.pe-attr-card-footer input[type="checkbox"]');
      return {
        name,
        values,
        visible: checkboxes[0]?.checked ?? true,
        used_for_variations: checkboxes[1]?.checked ?? false,
      };
    }).filter(a => a.name);
  }

  _emit() {
    const attrs = this._collect();
    this._lastJson = JSON.stringify(attrs);
    this.handlers.onChange?.(attrs);
  }
}
