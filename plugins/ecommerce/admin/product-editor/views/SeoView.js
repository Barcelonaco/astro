/**
 * SeoView — Metabox SEO (Yoast-like) : sous-onglet SEO + Schema.
 */

import { BaseView } from '../../_lib/View.js';
import { h, qs } from '../../_lib/dom.js';

export class SeoView extends BaseView {
  mount({ seoRoot, schemaRoot }) {
    this.seoRoot = seoRoot;
    this.schemaRoot = schemaRoot;
    this._renderSeo();
    this._renderSchema();
    return this;
  }

  render(state) {
    const m = state.product.seo_meta || {};
    qs('#pe-seo-title', this.seoRoot).value = m.meta_title || '';
    qs('#pe-seo-desc', this.seoRoot).value = m.meta_description || '';
    qs('#pe-seo-og', this.seoRoot).value = m.og_image || '';
    qs('#pe-schema-type', this.schemaRoot).value = m.schema_type || 'Product';
    qs('#pe-schema-extra', this.schemaRoot).value = m.schema_extra || '';
    this._updatePreview();
  }

  _patch(patch) {
    this.handlers.onPatch?.({ seo_meta: patch });
  }

  _updatePreview() {
    const title = qs('#pe-seo-title', this.seoRoot)?.value || '— titre par défaut —';
    const desc = qs('#pe-seo-desc', this.seoRoot)?.value || 'Renseignez une méta description.';
    qs('#pe-seo-prev-title', this.seoRoot).textContent = title;
    qs('#pe-seo-prev-desc', this.seoRoot).textContent = desc;
  }

  _renderSeo() {
    const root = this.seoRoot;
    root.replaceChildren(
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Titre SEO'),
        h('input', { id: 'pe-seo-title', class: 'form-input', type: 'text', placeholder: 'Titre affiché dans Google',
          oninput: (e) => { this._patch({ meta_title: e.target.value }); this._updatePreview(); }
        }),
        h('span', { class: 'form-hint' }, '~60 caractères max recommandé'),
      ),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Méta description'),
        h('textarea', { id: 'pe-seo-desc', class: 'form-input', rows: 3, placeholder: 'Description affichée dans les SERP',
          oninput: (e) => { this._patch({ meta_description: e.target.value }); this._updatePreview(); }
        }),
        h('span', { class: 'form-hint' }, '~155 caractères max recommandé'),
      ),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Image Open Graph (URL)'),
        h('input', { id: 'pe-seo-og', class: 'form-input', type: 'text', placeholder: '/uploads/media/...',
          onchange: (e) => this._patch({ og_image: e.target.value })
        }),
      ),
      h('div', { style: 'background:var(--gray-50);border:1px solid var(--gray-200);border-radius:6px;padding:12px;margin-top:12px' },
        h('div', { style: 'font-size:11px;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px' }, 'Aperçu Google'),
        h('div', { id: 'pe-seo-prev-title', style: 'color:#1a0dab;font-size:18px;font-weight:400;line-height:1.3' }, '—'),
        h('div', { style: 'color:#006621;font-size:13px;margin:2px 0 4px' }, location.host || 'votre-site.fr'),
        h('div', { id: 'pe-seo-prev-desc', style: 'color:#545454;font-size:13px;line-height:1.4' }, 'Renseignez une méta description.'),
      ),
    );
  }

  _renderSchema() {
    const root = this.schemaRoot;
    root.replaceChildren(
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Type Schema.org'),
        h('select', { id: 'pe-schema-type', class: 'form-select', onchange: (e) => this._patch({ schema_type: e.target.value }) },
          h('option', { value: 'Product' }, 'Product (par défaut)'),
          h('option', { value: 'Service' }, 'Service'),
          h('option', { value: 'Event' }, 'Event'),
        ),
      ),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'JSON-LD complémentaire'),
        h('textarea', { id: 'pe-schema-extra', class: 'form-input', rows: 6, style: 'font-family:SFMono-Regular,ui-monospace,monospace;font-size:12px',
          placeholder: '{ "brand": { "@type": "Brand", "name": "..." } }',
          onchange: (e) => this._patch({ schema_extra: e.target.value })
        }),
        h('span', { class: 'form-hint' }, 'Champs ajoutés au JSON-LD généré automatiquement.'),
      ),
    );
  }
}
