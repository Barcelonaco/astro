/**
 * PublishSidebarView — widget "Publier" (statut, visibilité, date, bouton).
 */

import { BaseView } from '../../_lib/View.js';
import { h, qs } from '../../_lib/dom.js';

export class PublishSidebarView extends BaseView {
  mount(root) {
    this.root = root;
    this._render();
    this.on(qs('#pe-btn-publish', root), 'click', () => this.handlers.onPublish?.());
    this.on(qs('#pe-btn-draft', root), 'click', () => this.handlers.onSaveDraft?.());
    this.on(qs('#pe-status-select', root), 'change', (e) => this.handlers.onStatusChange?.(e.target.value));
    this.on(qs('#pe-visibility-catalog', root), 'change', (e) => this.handlers.onVisibilityChange?.(e.target.value));
    return this;
  }

  render(state) {
    if (this._saving) return; // ne pas écraser le label "Enregistrement…" en cours
    const p = state.product;
    qs('#pe-status-select', this.root).value = p.status || 'draft';
    qs('#pe-visibility-catalog', this.root).value = p.custom_fields?.visibility_catalog || 'visible';
    qs('#pe-publish-meta-status', this.root).textContent = this._statusLabel(p.status);
    qs('#pe-publish-meta-date', this.root).textContent = p.published_date
      ? new Date(p.published_date).toLocaleDateString('fr-FR') : '—';
    this._publishLabel = p.status === 'published' ? 'Mettre à jour' : 'Publier';
    qs('#pe-btn-publish', this.root).innerHTML = this._publishLabel;
    qs('#pe-btn-draft', this.root).style.display = p.status === 'published' ? 'none' : '';
    qs('#pe-publish-dirty', this.root).style.display = state.dirty ? '' : 'none';
  }

  /** Active/désactive l'état "saving" : boutons disabled + spinner. */
  setSaving(on) {
    this._saving = on;
    const btnPublish = qs('#pe-btn-publish', this.root);
    const btnDraft = qs('#pe-btn-draft', this.root);
    if (!btnPublish || !btnDraft) return;
    btnPublish.disabled = on;
    btnDraft.disabled = on;
    if (on) {
      btnPublish.innerHTML = '<span class="pe-spinner"></span> Enregistrement…';
    } else {
      btnPublish.innerHTML = this._publishLabel || 'Publier';
    }
  }

  _statusLabel(s) {
    return ({ draft: 'Brouillon', published: 'Publié', private: 'Privé' })[s] || s || '—';
  }

  _render() {
    this.root.replaceChildren(
      h('div', { class: 'pe-publish-actions' },
        h('button', { id: 'pe-btn-draft', class: 'btn btn-outline', type: 'button' }, 'Brouillon'),
        h('button', { id: 'pe-btn-publish', class: 'btn btn-primary', type: 'button' }, 'Publier'),
      ),
      h('div', { id: 'pe-publish-dirty', style: 'font-size:12px;color:#c80;margin-bottom:10px;display:none' },
        'Modifications non enregistrées'),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Statut'),
        h('select', { id: 'pe-status-select', class: 'form-select' },
          h('option', { value: 'draft' }, 'Brouillon'),
          h('option', { value: 'published' }, 'Publié'),
          h('option', { value: 'private' }, 'Privé'),
        ),
      ),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Visibilité du catalogue'),
        h('select', { id: 'pe-visibility-catalog', class: 'form-select' },
          h('option', { value: 'visible' }, 'Catalogue et recherche'),
          h('option', { value: 'catalog' }, 'Catalogue uniquement'),
          h('option', { value: 'search' }, 'Recherche uniquement'),
          h('option', { value: 'hidden' }, 'Caché'),
        ),
      ),
      h('div', { class: 'pe-publish-meta' },
        h('div', null, 'État : ', h('strong', { id: 'pe-publish-meta-status' }, '—')),
        h('div', null, 'Date de publication : ', h('strong', { id: 'pe-publish-meta-date' }, '—')),
      ),
    );
  }
}
