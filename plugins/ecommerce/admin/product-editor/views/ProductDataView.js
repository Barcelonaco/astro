/**
 * ProductDataView — Metabox 3 "Données produit" WC-style.
 *
 * Bandeau header (type, virtual, downloadable) + 8 onglets :
 *   General / Inventory / Shipping / Linked / Attributes / Variations / Downloads / Advanced
 *
 * Cette view ne fait pas le rendu de Variations/Attributes elles-mêmes (sous-views
 * dédiées) : elle se contente de leur fournir les containers.
 *
 * Patches émis via this.handlers.onPatchCustomFields(patch) — auto-merge sur custom_fields.
 */

import { BaseView } from '../../_lib/View.js';
import { h, qs } from '../../_lib/dom.js';
import { apiGet } from '../../_lib/api.js';

export class ProductDataView extends BaseView {
  mount({ headerRoot, panels }) {
    this.headerRoot = headerRoot;
    this.panels = panels; // { general, inventory, shipping, linked, attributes, variations, downloads, advanced }
    this.tabsNav = document.querySelector('[data-tabs-nav="data"]');
    this._renderHeaderBar();
    this._renderGeneral();
    this._renderInventory();
    this._renderShipping();
    this._renderLinked();
    this._renderAttributesPlaceholder();
    this._renderVariationsPlaceholder();
    this._renderDownloads();
    this._renderAdvanced();
    return this;
  }

  /** Reçoit le state global. Met à jour TOUS les inputs et la visibilité conditionnelle. */
  render(state) {
    const cf = state.product.custom_fields || {};
    qs('#pe-pt', this.headerRoot).value = cf.product_type || 'simple';
    qs('#pe-virtual', this.headerRoot).checked = !!cf.is_virtual;
    qs('#pe-downloadable', this.headerRoot).checked = !!cf.is_downloadable;

    // General
    qs('#pe-base-price', this.panels.general).value = cf.base_price ?? '';
    qs('#pe-compare-price', this.panels.general).value = cf.compare_at_price ?? '';
    this._fillTaxCodeSelect(state.taxRates, cf.tax_code || 'FR_STANDARD');

    // Inventory
    qs('#pe-sku', this.panels.inventory).value = cf.sku || '';
    qs('#pe-stock-managed', this.panels.inventory).checked = cf.stock_managed !== false;
    qs('#pe-stock-qty', this.panels.inventory).value = cf.stock_quantity ?? 0;
    qs('#pe-stock-low', this.panels.inventory).value = cf.low_stock_threshold ?? 5;
    qs('#pe-sold-individually', this.panels.inventory).checked = !!cf.sold_individually;

    // Shipping
    qs('#pe-weight', this.panels.shipping).value = cf.weight_grams ?? '';
    qs('#pe-dim-l', this.panels.shipping).value = cf.dimensions_length ?? '';
    qs('#pe-dim-w', this.panels.shipping).value = cf.dimensions_width ?? '';
    qs('#pe-dim-h', this.panels.shipping).value = cf.dimensions_height ?? '';
    qs('#pe-shipping-class', this.panels.shipping).value = cf.shipping_class || '';

    // Linked — rendered by product picker, re-render chips
    this._syncLinkedPicker('upsell_ids', cf.upsell_ids || []);
    this._syncLinkedPicker('cross_sell_ids', cf.cross_sell_ids || []);
    this._syncLinkedPicker('grouped_ids', cf.grouped_ids || []);

    // Downloads
    qs('#pe-dl-file', this.panels.downloads).value = cf.download_file || '';
    qs('#pe-dl-limit', this.panels.downloads).value = cf.download_limit ?? '';

    // Advanced
    qs('#pe-purchase-note', this.panels.advanced).value = cf.purchase_note || '';
    qs('#pe-menu-order', this.panels.advanced).value = cf.menu_order ?? 0;
    qs('#pe-reviews-enabled', this.panels.advanced).checked = cf.reviews_enabled !== false;
    qs('#pe-is-featured', this.panels.advanced).checked = !!cf.is_featured;

    // Conditional visibility on tabs
    const isVariable = cf.product_type === 'variable';
    const isVirtual = !!cf.is_virtual;
    const isDownloadable = !!cf.is_downloadable;

    this.tabsNav.querySelector('[data-tab="variations"]').hidden = !isVariable;
    this.tabsNav.querySelector('[data-tab="downloads"]').hidden = !isDownloadable;
    this.tabsNav.querySelector('[data-tab="shipping"]').hidden = isVirtual;

    // Hide inventory stock fields if variants drive stock
    qs('#pe-stock-block', this.panels.inventory).style.display = isVariable ? 'none' : '';

    // Load dynamic stock info (order-aware) — only once per product load
    if (state.product.id && this._stockLoadedForId !== state.product.id) {
      this._stockLoadedForId = state.product.id;
      this._loadStockDetail(state.product.id);
    }
  }

  /** Force-refresh stock info on next render (call after save). */
  refreshStock() { this._stockLoadedForId = null; }

  _patch(patch) {
    this.handlers.onPatchCustomFields?.(patch);
  }

  _fillTaxCodeSelect(rates, current) {
    const sel = qs('#pe-tax-code', this.panels.general);
    if (!sel) return;
    sel.innerHTML = '';
    rates.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.code; opt.textContent = `${r.label} (${r.rate}%)`;
      sel.appendChild(opt);
    });
    sel.value = current;
  }

  _renderHeaderBar() {
    this.headerRoot.replaceChildren(
      h('strong', null, 'Données produit'),
      h('select', { id: 'pe-pt', onchange: (e) => this._patch({ product_type: e.target.value }) },
        h('option', { value: 'simple' }, 'Produit simple'),
        h('option', { value: 'variable' }, 'Produit variable'),
        h('option', { value: 'external' }, 'Externe / Affilié'),
        h('option', { value: 'grouped' }, 'Groupé'),
      ),
      h('label', null,
        h('input', { id: 'pe-virtual', type: 'checkbox', onchange: (e) => this._patch({ is_virtual: e.target.checked }) }),
        h('span', null, 'Virtuel'),
      ),
      h('label', null,
        h('input', { id: 'pe-downloadable', type: 'checkbox', onchange: (e) => this._patch({ is_downloadable: e.target.checked }) }),
        h('span', null, 'Téléchargeable'),
      ),
    );
  }

  _renderGeneral() {
    this.panels.general.replaceChildren(
      h('div', { class: 'form-row' },
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Prix de base (€)'),
          h('input', { id: 'pe-base-price', class: 'form-input', type: 'number', step: '0.01',
            onchange: (e) => this._patch({ base_price: parseFloat(e.target.value) || 0 }) }),
        ),
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Prix promo (€)'),
          h('input', { id: 'pe-compare-price', class: 'form-input', type: 'number', step: '0.01',
            onchange: (e) => this._patch({ compare_at_price: parseFloat(e.target.value) || null }) }),
        ),
      ),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Taux de TVA'),
        h('select', { id: 'pe-tax-code', class: 'form-select',
          onchange: (e) => this._patch({ tax_code: e.target.value }) }),
      ),
    );
  }

  _renderInventory() {
    this.panels.inventory.replaceChildren(
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'SKU (référence)'),
        h('input', { id: 'pe-sku', class: 'form-input', type: 'text',
          onchange: (e) => this._patch({ sku: e.target.value }) }),
      ),
      h('div', { id: 'pe-stock-block' },
        h('div', { class: 'form-group' },
          h('label', { class: 'check-row' },
            h('input', { id: 'pe-stock-managed', type: 'checkbox',
              onchange: (e) => this._patch({ stock_managed: e.target.checked }) }),
            h('span', null, 'Suivre le stock'),
          ),
        ),
        h('div', { class: 'form-row' },
          h('div', { class: 'form-group' },
            h('label', { class: 'form-label' }, 'Quantité en stock'),
            h('input', { id: 'pe-stock-qty', class: 'form-input', type: 'number',
              onchange: (e) => this._patch({ stock_quantity: +e.target.value || 0 }) }),
          ),
          h('div', { class: 'form-group' },
            h('label', { class: 'form-label' }, 'Seuil alerte stock bas'),
            h('input', { id: 'pe-stock-low', class: 'form-input', type: 'number',
              onchange: (e) => this._patch({ low_stock_threshold: +e.target.value || 0 }) }),
          ),
        ),
        h('div', { id: 'pe-stock-available-box' }),
      ),
      h('div', { class: 'form-group' },
        h('label', { class: 'check-row' },
          h('input', { id: 'pe-sold-individually', type: 'checkbox',
            onchange: (e) => this._patch({ sold_individually: e.target.checked }) }),
          h('span', null, 'Vendu individuellement (1 max par commande)'),
        ),
      ),
    );
  }

  /** Fetch and display dynamic stock info (stock - ordered). */
  async _loadStockDetail(productId) {
    const box = qs('#pe-stock-available-box', this.panels.inventory);
    if (!box || !productId) return;
    try {
      const data = await apiGet(`/admin/products/${productId}/stock`);
      if (!data.stock_managed) { box.replaceChildren(); return; }

      const avail = data.available ?? 0;
      const ordered = data.ordered_qty || 0;
      const total = data.stock_total || 0;
      let color = '#16a34a'; // green
      if (avail <= 0) color = '#dc2626'; // red
      else if (ordered > 0 && avail <= (data.variants?.[0]?.low_stock_threshold ?? 5)) color = '#d97706'; // orange

      const rows = [];
      // Per-variant breakdown if multiple variants
      if (data.variants && data.variants.length > 1) {
        data.variants.forEach(v => {
          if (!v.stock_managed) return;
          const attrs = Object.values(v.attributes || {}).join(' / ') || v.sku || `#${v.variant_id}`;
          const vAvail = v.available ?? 0;
          const vOrd = v.ordered_qty || 0;
          let vColor = '#16a34a';
          if (vAvail <= 0) vColor = '#dc2626';
          else if (vAvail <= (v.low_stock_threshold ?? 5)) vColor = '#d97706';
          rows.push(
            h('tr', null,
              h('td', { style: 'padding:4px 8px;font-size:12px;' }, attrs),
              h('td', { style: 'padding:4px 8px;text-align:center;font-size:12px;' }, String(v.stock_quantity)),
              h('td', { style: 'padding:4px 8px;text-align:center;font-size:12px;' }, String(vOrd)),
              h('td', { style: `padding:4px 8px;text-align:center;font-weight:600;color:${vColor};font-size:12px;` }, String(vAvail)),
            )
          );
        });
      }

      const summary = h('div', { style: `margin-top:12px;padding:12px 16px;border-radius:8px;background:${avail <= 0 ? '#fef2f2' : ordered > 0 ? '#fffbeb' : '#f0fdf4'};border:1px solid ${avail <= 0 ? '#fecaca' : ordered > 0 ? '#fde68a' : '#bbf7d0'};` },
        h('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:4px;' },
          h('span', { html: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>` }),
          h('strong', { style: `font-size:14px;color:${color};` }, `Stock disponible : ${avail}`),
        ),
        h('div', { style: 'font-size:12px;color:#6b7280;' },
          `${total} en stock — ${ordered} en commande${ordered > 0 ? ' (en cours)' : ''}`,
        ),
      );

      if (rows.length > 0) {
        const table = h('table', { style: 'width:100%;margin-top:8px;border-collapse:collapse;' },
          h('thead', null,
            h('tr', { style: 'border-bottom:1px solid #e5e7eb;' },
              h('th', { style: 'padding:4px 8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:500;' }, 'Variante'),
              h('th', { style: 'padding:4px 8px;text-align:center;font-size:11px;color:#9ca3af;font-weight:500;' }, 'Stock'),
              h('th', { style: 'padding:4px 8px;text-align:center;font-size:11px;color:#9ca3af;font-weight:500;' }, 'Commandes'),
              h('th', { style: 'padding:4px 8px;text-align:center;font-size:11px;color:#9ca3af;font-weight:500;' }, 'Disponible'),
            ),
          ),
          h('tbody', null, ...rows),
        );
        box.replaceChildren(summary, table);
      } else {
        box.replaceChildren(summary);
      }
    } catch (err) {
      console.warn('Stock detail fetch failed:', err);
      box.replaceChildren();
    }
  }

  _renderShipping() {
    this.panels.shipping.replaceChildren(
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Poids (g)'),
        h('input', { id: 'pe-weight', class: 'form-input', type: 'number',
          onchange: (e) => this._patch({ weight_grams: +e.target.value || null }) }),
      ),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Dimensions (cm)'),
        h('div', { class: 'form-row' },
          h('input', { id: 'pe-dim-l', class: 'form-input', type: 'number', placeholder: 'Longueur',
            onchange: (e) => this._patch({ dimensions_length: +e.target.value || null }) }),
          h('input', { id: 'pe-dim-w', class: 'form-input', type: 'number', placeholder: 'Largeur',
            onchange: (e) => this._patch({ dimensions_width: +e.target.value || null }) }),
          h('input', { id: 'pe-dim-h', class: 'form-input', type: 'number', placeholder: 'Hauteur',
            onchange: (e) => this._patch({ dimensions_height: +e.target.value || null }) }),
        ),
      ),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Classe d\'expédition'),
        h('input', { id: 'pe-shipping-class', class: 'form-input', type: 'text',
          placeholder: 'fragile, lourd, ...',
          onchange: (e) => this._patch({ shipping_class: e.target.value }) }),
      ),
    );
  }

  _renderLinked() {
    this.panels.linked.replaceChildren(
      this._buildProductPicker('upsell_ids', 'Upsells', 'Produits suggérés sur la fiche produit'),
      this._buildProductPicker('cross_sell_ids', 'Cross-sells (panier)', 'Produits suggérés dans le panier'),
      this._buildProductPicker('grouped_ids', 'Produits groupés (si type = Groupé)'),
    );
    // Cache for product search results
    this._searchCache = {};
  }

  /** Build a product picker widget: search input + dropdown + selected chips. */
  _buildProductPicker(field, label, hint) {
    const wrapper = h('div', { class: 'form-group pe-product-picker', dataset: { pickerField: field } },
      h('label', { class: 'form-label' }, label),
      h('div', { class: 'pe-picker-selected', id: `pe-picker-chips-${field}` }),
      h('div', { class: 'pe-picker-search-wrap' },
        h('input', { class: 'form-input pe-picker-input', type: 'text', placeholder: 'Rechercher un produit...',
          oninput: (e) => {
            clearTimeout(this[`_debounce_${field}`]);
            this[`_debounce_${field}`] = setTimeout(() => this._onPickerSearch(field, e.target.value), 300);
          },
          onfocus: (e) => { if (e.target.value.length >= 2) this._onPickerSearch(field, e.target.value); },
        }),
        h('ul', { class: 'pe-picker-dropdown', id: `pe-picker-dd-${field}` }),
      ),
    );
    if (hint) wrapper.appendChild(h('span', { class: 'form-hint' }, hint));
    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      const dd = qs(`#pe-picker-dd-${field}`, this.panels.linked);
      if (dd && !wrapper.contains(e.target)) dd.hidden = true;
    });
    return wrapper;
  }

  /** Render chips for a linked field (called from render()). */
  _syncLinkedPicker(field, items) {
    const container = qs(`#pe-picker-chips-${field}`, this.panels.linked);
    if (!container) return;
    container.replaceChildren(
      ...items.map(item => {
        const id = item.id || item;
        const title = item.title || `#${id}`;
        return h('span', { class: 'pe-picker-chip' },
          h('span', null, title),
          h('button', { type: 'button', class: 'pe-picker-chip-x',
            onclick: () => this._removeLinked(field, id) }, '\u00d7'),
        );
      })
    );
  }

  /** Search products via API and show dropdown. */
  async _onPickerSearch(field, query) {
    const dd = qs(`#pe-picker-dd-${field}`, this.panels.linked);
    if (!dd) return;
    if (!query || query.length < 2) { dd.hidden = true; return; }
    try {
      const results = await apiGet(`/shop/products?search=${encodeURIComponent(query)}&per_page=10`);
      const items = results.data || results;
      const currentIds = new Set((this._getCurrentLinked(field)).map(i => i.id || i));
      const filtered = (Array.isArray(items) ? items : []).filter(p => !currentIds.has(p.id));
      dd.replaceChildren(
        ...filtered.length > 0
          ? filtered.map(p => h('li', { class: 'pe-picker-option',
              onclick: () => this._addLinked(field, p, dd) },
              h('span', null, p.title),
              h('span', { class: 'pe-picker-option-sku' }, `#${p.id}`),
            ))
          : [h('li', { class: 'pe-picker-option pe-picker-empty' }, 'Aucun produit trouvé')],
      );
      dd.hidden = false;
    } catch { dd.hidden = true; }
  }

  _getCurrentLinked(field) {
    const cf = this.handlers.getCustomFields?.() || {};
    return cf[field] || [];
  }

  _addLinked(field, product, dd) {
    const current = [...this._getCurrentLinked(field)];
    if (current.some(i => (i.id || i) === product.id)) return;
    current.push({ id: product.id, title: product.title });
    this._patch({ [field]: current });
    dd.hidden = true;
    const input = dd.closest('.pe-picker-search-wrap')?.querySelector('.pe-picker-input');
    if (input) input.value = '';
  }

  _removeLinked(field, id) {
    const current = this._getCurrentLinked(field).filter(i => (i.id || i) !== id);
    this._patch({ [field]: current });
  }

  _renderAttributesPlaceholder() {
    // Le rendu réel est délégué à AttributeBuilderView, monté par main.js.
    // Ici juste un fallback si pas encore monté.
    if (!this.panels.attributes.children.length) {
      this.panels.attributes.appendChild(
        h('div', { id: 'pe-attr-builder-mount', style: 'min-height:100px' })
      );
    }
  }

  _renderVariationsPlaceholder() {
    if (!this.panels.variations.children.length) {
      this.panels.variations.appendChild(
        h('div', { id: 'pe-variants-mount', style: 'min-height:100px' })
      );
    }
  }

  _renderDownloads() {
    this.panels.downloads.replaceChildren(
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Fichier à télécharger (URL)'),
        h('input', { id: 'pe-dl-file', class: 'form-input', type: 'text', placeholder: '/uploads/media/...',
          onchange: (e) => this._patch({ download_file: e.target.value }) }),
      ),
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Limite de téléchargements'),
        h('input', { id: 'pe-dl-limit', class: 'form-input', type: 'number',
          placeholder: 'Vide = illimité',
          onchange: (e) => this._patch({ download_limit: +e.target.value || null }) }),
      ),
    );
  }

  _renderAdvanced() {
    this.panels.advanced.replaceChildren(
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Note d\'achat (visible client après paiement)'),
        h('textarea', { id: 'pe-purchase-note', class: 'form-input', rows: 3,
          onchange: (e) => this._patch({ purchase_note: e.target.value }) }),
      ),
      h('div', { class: 'form-row' },
        h('div', { class: 'form-group' },
          h('label', { class: 'form-label' }, 'Ordre d\'affichage'),
          h('input', { id: 'pe-menu-order', class: 'form-input', type: 'number',
            onchange: (e) => this._patch({ menu_order: +e.target.value || 0 }) }),
        ),
        h('div', { class: 'form-group' },
          h('label', { class: 'check-row', style: 'margin-top:24px' },
            h('input', { id: 'pe-reviews-enabled', type: 'checkbox',
              onchange: (e) => this._patch({ reviews_enabled: e.target.checked }) }),
            h('span', null, 'Activer les avis clients'),
          ),
        ),
        h('div', { class: 'form-group' },
          h('label', { class: 'check-row', style: 'margin-top:24px' },
            h('input', { id: 'pe-is-featured', type: 'checkbox',
              onchange: (e) => this._patch({ is_featured: e.target.checked }) }),
            h('span', null, 'Mis en avant (homepage)'),
          ),
        ),
      ),
    );
  }
}
