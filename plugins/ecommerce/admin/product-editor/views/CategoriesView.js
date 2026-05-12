/**
 * CategoriesView — sidebar widget "Catégories de produits".
 *
 * Liste à cocher + création inline via input + bouton.
 */

import { BaseView } from '../../_lib/View.js';
import { h, qs, qsa } from '../../_lib/dom.js';
import { apiPost } from '../../_lib/api.js';

export class CategoriesView extends BaseView {
  mount(root) {
    this.root = root;
    this._addMode = false;
    root.replaceChildren(
      h('div', { class: 'pe-categories-tabs' },
        h('button', { class: 'active', 'data-cat-tab': 'all', type: 'button', onclick: (e) => this._switchTab(e, 'all') }, 'Toutes'),
        h('button', { 'data-cat-tab': 'used', type: 'button', onclick: (e) => this._switchTab(e, 'used') }, 'Plus utilisées'),
      ),
      h('div', { id: 'pe-cat-list', class: 'pe-categories-list' }),
      h('div', { id: 'pe-cat-add-form', class: 'pe-cat-add-form', style: 'display:none' },
        h('input', { id: 'pe-cat-add-input', class: 'form-input', type: 'text', placeholder: 'Nom de la catégorie' }),
        h('div', { class: 'pe-cat-add-actions' },
          h('button', { class: 'btn btn-primary btn-sm', type: 'button', id: 'pe-cat-add-confirm',
            onclick: () => this._createCategory() }, 'Ajouter'),
          h('button', { class: 'btn btn-outline btn-sm', type: 'button',
            onclick: () => this._toggleAddForm(false) }, 'Annuler'),
        ),
      ),
      h('a', { id: 'pe-cat-add-link', class: 'pe-cat-add-link',
        onclick: () => this._toggleAddForm(true) }, '+ Ajouter une catégorie'),
    );
    // Enter key in input
    qs('#pe-cat-add-input', root).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._createCategory(); }
      if (e.key === 'Escape') this._toggleAddForm(false);
    });
    return this;
  }

  render(state) {
    const list = qs('#pe-cat-list', this.root);
    const cats = state.categories || [];
    const selectedIds = new Set((state.product.categories || []).map(c => c.id || c));
    if (cats.length === 0) {
      list.replaceChildren(h('p', { class: 'pe-cat-empty' }, 'Aucune catégorie'));
      return;
    }
    list.replaceChildren(...cats.map(cat =>
      h('label', { class: 'pe-cat-item' },
        h('input', { type: 'checkbox', value: cat.id, checked: selectedIds.has(cat.id),
          onchange: () => this._emit() }),
        h('span', null, cat.name || cat.title),
      )
    ));
  }

  _switchTab(e, tab) {
    qsa('[data-cat-tab]', this.root).forEach(b => b.classList.toggle('active', b.dataset.catTab === tab));
  }

  _toggleAddForm(show) {
    this._addMode = show;
    qs('#pe-cat-add-form', this.root).style.display = show ? '' : 'none';
    qs('#pe-cat-add-link', this.root).style.display = show ? 'none' : '';
    if (show) {
      const input = qs('#pe-cat-add-input', this.root);
      input.value = '';
      input.focus();
    }
  }

  async _createCategory() {
    const input = qs('#pe-cat-add-input', this.root);
    const name = input.value.trim();
    if (!name) return;
    const btn = qs('#pe-cat-add-confirm', this.root);
    btn.disabled = true;
    btn.textContent = '...';
    try {
      const created = await apiPost('/cpt/products/categories', { name });
      this._toggleAddForm(false);
      // Notify parent to reload categories + auto-check the new one
      this.handlers.onCreated?.(created);
    } catch (err) {
      input.style.borderColor = 'var(--danger, #dc2626)';
      setTimeout(() => input.style.borderColor = '', 2000);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Ajouter';
    }
  }

  _emit() {
    const ids = qsa('input[type=checkbox]:checked', qs('#pe-cat-list', this.root)).map(cb => +cb.value);
    this.handlers.onChange?.(ids.map(id => ({ id })));
  }
}
