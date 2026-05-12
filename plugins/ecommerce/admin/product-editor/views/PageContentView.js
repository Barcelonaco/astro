/**
 * PageContentView — Metabox "Contenu du produit" : 3 panneaux Header/Contenu/Paramètre.
 *
 * Note : pour l'instant le panneau "Contenu" est une textarea WYSIWYG simple.
 * À terme, brancher le block builder du CMS si on veut des modules Nickl
 * complets sous la fiche produit.
 *
 * Patches émis via this.handlers.onPatch({ ...patch }) où patch est un sous-objet
 * de product (et custom_fields est mergé).
 */

import { BaseView } from '../../_lib/View.js';
import { h, qs } from '../../_lib/dom.js';
import { HeaderConfigView } from './HeaderConfigView.js';

export class PageContentView extends BaseView {
  async mount({ headerRoot, contentRoot, settingsRoot }) {
    this.headerRoot = headerRoot;
    this.contentRoot = contentRoot;
    this.settingsRoot = settingsRoot;
    this.headerConfigView = new HeaderConfigView();
    await this.headerConfigView.mount(this.headerRoot);
    this.headerConfigView.bind({
      onChange: (headerConfig) => this.handlers.onPatchCustomFields?.({ header_config: headerConfig }),
    });
    this._renderContent();
    this._renderSettings();
    return this;
  }

  render(state) {
    const cf = state.product.custom_fields || {};
    const lc = cf.layout_config || {};
    if (this.headerConfigView) this.headerConfigView.render(state);

    const contentEl = qs('#pe-content-html', this.contentRoot);
    if (contentEl) contentEl.value = state.product.content || '';
    this._updateContentSummary(state.product.content);

    this._setToggle('pe-l-breadcrumb', lc.show_breadcrumb !== false);
    this._setToggle('pe-l-related', lc.show_related !== false);
    this._setToggle('pe-l-reviews', lc.show_reviews !== false);
    this._setToggle('pe-l-share', lc.show_share !== false);
    qs('#pe-l-class', this.settingsRoot).value = lc.css_class || '';
  }

  _renderContent() {
    const root = this.contentRoot;
    root.replaceChildren(
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Contenu visuel sous la fiche produit'),
        h('div', { id: 'pe-content-summary', style: 'padding:14px;background:var(--gray-50);border:1px solid var(--gray-200);border-radius:6px;font-size:13px;color:var(--gray-600);margin-bottom:10px' },
          'Aucun bloc — clique sur "Éditer le contenu visuel" pour ajouter des modules Nickl.'),
        h('button', { id: 'pe-edit-blocks', class: 'btn btn-primary', type: 'button',
          onclick: () => this.handlers.onOpenBlockBuilder?.() },
          h('span', { html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' }),
          'Éditer le contenu visuel',
        ),
        h('span', { class: 'form-hint', style: 'display:block;margin-top:8px' },
          'Ouvre le block builder Nickl. Modifications sauvegardées automatiquement avant ouverture.'),
      ),
      ...(window.parent?.currentUser?.role === 'super_admin' || window.parent?.currentUser?.role === 'admin'
        ? [h('details', { style: 'margin-top:16px;border-top:1px solid var(--gray-200);padding-top:12px' },
            h('summary', { style: 'cursor:pointer;font-size:12px;color:var(--gray-500)' }, 'Source brute (lecture seule, debug)'),
            h('textarea', {
              id: 'pe-content-html', class: 'form-input', rows: 8, readonly: true,
              style: 'font-family:SFMono-Regular,ui-monospace,monospace;font-size:11px;margin-top:8px',
            }),
          )]
        : []),
    );
  }

  _updateContentSummary(content) {
    const el = qs('#pe-content-summary', this.contentRoot);
    if (!el) return;
    let count = 0;
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      if (Array.isArray(parsed)) count = parsed.length;
    } catch { /* not JSON */ }
    if (count > 0) {
      el.textContent = `${count} bloc${count > 1 ? 's' : ''} configuré${count > 1 ? 's' : ''}.`;
      el.style.color = 'var(--gray-700)';
    } else {
      el.textContent = 'Aucun bloc — clique sur "Éditer le contenu visuel" pour ajouter des modules Nickl.';
      el.style.color = 'var(--gray-600)';
    }
  }

  _renderSettings() {
    const root = this.settingsRoot;
    root.replaceChildren(
      this._makeToggle('pe-l-breadcrumb', 'Afficher le fil d\'Ariane', (v) => this._patchLayout({ show_breadcrumb: v })),
      this._makeToggle('pe-l-related', 'Afficher les produits liés', (v) => this._patchLayout({ show_related: v })),
      this._makeToggle('pe-l-reviews', 'Afficher les avis clients', (v) => this._patchLayout({ show_reviews: v })),
      this._makeToggle('pe-l-share', 'Afficher les boutons de partage', (v) => this._patchLayout({ show_share: v })),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Classes CSS additionnelles'),
        h('input', { id: 'pe-l-class', class: 'form-input', type: 'text', placeholder: 'mon-produit-special', onchange: (e) => this._patchLayout({ css_class: e.target.value }) }),
      ),
    );
  }

  _makeToggle(id, label, onChange) {
    const input = h('input', { id, type: 'checkbox', class: 'pe-toggle-input',
      onchange: (e) => onChange(e.target.checked) });
    return h('label', { class: 'pe-toggle' },
      input,
      h('span', { class: 'pe-toggle-slider' }),
      h('span', { class: 'pe-toggle-label' }, label),
    );
  }

  _setToggle(id, checked) {
    const el = qs(`#${id}`, this.settingsRoot);
    if (el) el.checked = checked;
  }

  _patchLayout(patch) {
    this.handlers.onPatchCustomFields?.({ layout_config: patch });
  }
}
