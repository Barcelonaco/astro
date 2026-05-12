/**
 * ProductModel — état + API du produit en cours d'édition.
 *
 * State : { product, variants, taxRates, shippingClasses, categories, dirty, loading }
 *
 * - product : tous les champs CPT (title, slug, content, featured_image, custom_fields…)
 * - variants : liste des variants (chargée séparément pour les CPT type=variable)
 * - dirty : true si modif non sauvegardée
 *
 * Events :
 *   'change' (state) — émis sur set()
 *   'saved' (product)
 *
 * Convention custom_fields : tous les champs non-natifs (price, sku, stock,
 * header_config, layout_config, seo_meta, attributes, upsell_ids…) sont
 * stockés dans cpt_products.custom_fields (JSON) côté DB.
 */

import { BaseModel } from '../_lib/Model.js';
import { apiGet, apiPost, apiPut } from '../_lib/api.js';

const EMPTY_PRODUCT = Object.freeze({
  id: null,
  title: '',
  slug: '',
  content: '',
  featured_image: null,
  status: 'draft',
  published_date: null,
  custom_fields: {},
  seo_meta: {},
  categories: [],
});

export class ProductModel extends BaseModel {
  constructor() {
    super({
      product: { ...EMPTY_PRODUCT },
      variants: [],
      taxRates: [],
      shippingClasses: [],
      categories: [],
      loading: false,
      dirty: false,
      isNew: true,
    });
  }

  async load(id) {
    this.set({ loading: true });
    if (id) {
      const product = await apiGet(`/cpt/products/by-id/${id}`);
      this._hydrate(product);
      const variants = await this._loadVariants(id);
      this.set({
        product,
        variants,
        loading: false,
        dirty: false,
        isNew: false,
      });
    } else {
      this.set({
        product: { ...EMPTY_PRODUCT },
        variants: [],
        loading: false,
        dirty: false,
        isNew: true,
      });
    }
    await this._loadTaxonomies();
  }

  /** Met à jour partiellement le product en cours (titre, custom_fields…). */
  patch(patch) {
    const product = { ...this.state.product, ...patch };
    if (patch.custom_fields) {
      product.custom_fields = { ...(this.state.product.custom_fields || {}), ...patch.custom_fields };
    }
    if (patch.seo_meta) {
      product.seo_meta = { ...(this.state.product.seo_meta || {}), ...patch.seo_meta };
    }
    this.set({ product, dirty: true });
  }

  setVariants(variants) { this.set({ variants, dirty: true }); }

  async save() {
    const p = this.state.product;
    const status = p.status || 'draft';
    const body = {
      title: p.title,
      slug: p.slug || null,
      content: p.content || null,
      featured_image: p.featured_image || null,
      custom_fields: p.custom_fields || {},
      seo_meta: p.seo_meta || {},
      status,
      published_date: status === 'published'
        ? (p.published_date || new Date().toISOString().slice(0, 19).replace('T', ' '))
        : null,
      categories: (p.categories || []).map(c => c.id || c),
    };
    let saved;
    if (p.id) {
      saved = await apiPut(`/cpt/products/${p.id}`, body);
    } else {
      saved = await apiPost('/cpt/products', body);
    }
    const productId = saved.id || p.id;
    // Enregistre les variants si type=variable
    if (productId && (p.custom_fields?.product_type === 'variable')) {
      await apiPut(`/admin/products/${productId}/variants`, { variants: this.state.variants });
    }
    // Recharge pour obtenir l'ID + les valeurs canonisées
    await this.load(productId);
    this.emit('saved', this.state.product);
    return this.state.product;
  }

  async generateMatrix() {
    if (!this.state.product.id) throw new Error('Sauvegardez le produit avant de générer la matrice.');
    await apiPost(`/admin/products/${this.state.product.id}/generate-matrix`);
    const variants = await this._loadVariants(this.state.product.id);
    this.set({ variants });
  }

  // ── Helpers ──

  _hydrate(product) {
    if (typeof product.custom_fields === 'string') {
      try { product.custom_fields = JSON.parse(product.custom_fields); } catch { product.custom_fields = {}; }
    }
    if (typeof product.seo_meta === 'string') {
      try { product.seo_meta = JSON.parse(product.seo_meta); } catch { product.seo_meta = {}; }
    }
    if (typeof product.featured_image === 'string') {
      try { product.featured_image = JSON.parse(product.featured_image); } catch { /* keep string */ }
    }
    product.custom_fields = product.custom_fields || {};
    product.seo_meta = product.seo_meta || {};
    product.categories = product.categories || [];
  }

  async _loadVariants(productId) {
    try {
      const data = await apiGet(`/admin/products/${productId}/variants`);
      return data.variants || [];
    } catch { return []; }
  }

  async _loadTaxonomies() {
    const [rates, cats] = await Promise.all([
      apiGet('/shop/tax-rates').catch(() => ({ rates: [] })),
      apiGet('/cpt/products/categories').catch(() => ({ categories: [] })),
    ]);
    this.set({
      taxRates: rates.rates || [],
      categories: cats.categories || cats || [],
    });
  }
}
