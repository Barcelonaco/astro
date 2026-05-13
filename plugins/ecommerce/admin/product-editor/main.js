/**
 * product-editor/main.js — Presenter racine de l'éditeur produit unifié.
 *
 * Boot :
 *   1. Lit ?id= dans l'URL (vide = nouveau produit)
 *   2. Charge le ProductModel + les taxonomies
 *   3. Monte toutes les Views et les wire au Model
 *   4. Active les tabs
 *   5. Render initial sur Model.change
 */

import { ProductModel } from './ProductModel.js';
import { PublishSidebarView } from './views/PublishSidebarView.js';
import { PageContentView } from './views/PageContentView.js';
import { SeoView } from './views/SeoView.js';
import { ProductDataView } from './views/ProductDataView.js';
import { AttributeBuilderView } from './views/AttributeBuilderView.js';
import { VariantsTableView } from './views/VariantsTableView.js';
import { ImageGalleryView } from './views/ImageGalleryView.js';
import { CategoriesView } from './views/CategoriesView.js';
import { qs, qsa } from '../_lib/dom.js';
import { toastSuccess, toastError, withErrorToast } from '../_lib/swal.js';

// ── Boot ─────────────────────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const productId = params.get('id') ? +params.get('id') : null;

const model = new ProductModel();

const publishView = new PublishSidebarView();
const pageView    = new PageContentView();
const seoView     = new SeoView();
const dataView    = new ProductDataView();
const attrView    = new AttributeBuilderView();
const variantsView = new VariantsTableView();
const imageView   = new ImageGalleryView();
const catsView    = new CategoriesView();

// ── Tabs activator ───────────────────────────────────────────────────────────
function activateTabs() {
  qsa('[data-tabs-nav]').forEach(nav => {
    const key = nav.dataset.tabsNav;
    const panel = qs(`[data-tabs-panel="${key}"]`);
    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (!btn || btn.hidden) return;
      qsa('[data-tab]', nav).forEach(b => b.classList.toggle('active', b === btn));
      qsa('[data-panel]', panel).forEach(p => p.classList.toggle('active', p.dataset.panel === btn.dataset.tab));
    });
  });
}

// ── Title input ──────────────────────────────────────────────────────────────
function wireTitle() {
  const input = qs('#pe-title');
  input.addEventListener('input', (e) => model.patch({ title: e.target.value }));
}

// ── Save flow ────────────────────────────────────────────────────────────────
const save = async (status) => {
  publishView.setSaving(true);
  try {
    if (status) model.patch({ status });
    // Sync variants table → model (en cas d'édition inline non flushée)
    if (model.state.product.custom_fields?.product_type === 'variable') {
      model.setVariants(variantsView.collect());
    }
    await model.save();
    dataView.refreshStock();
    toastSuccess('Produit enregistré');
    if (model.state.product.id && !productId) {
      history.replaceState(null, '', `?id=${model.state.product.id}`);
    }
  } catch (err) {
    console.error(err);
    toastError(err?.message || 'Erreur lors de l\'enregistrement');
  } finally {
    publishView.setSaving(false);
    publishView.render(model.state);
  }
};

// ── Mount + wire ─────────────────────────────────────────────────────────────
async function mountViews() {
  publishView.mount(qs('#pe-publish-body')).bind({
    onPublish: () => save('published'),
    onSaveDraft: () => save('draft'),
    onStatusChange: (status) => model.patch({ status }),
    onVisibilityChange: (v) => model.patch({ custom_fields: { visibility_catalog: v } }),
  });

  await pageView.mount({
    headerRoot: qs('#pe-page-header'),
    contentRoot: qs('#pe-page-content'),
    settingsRoot: qs('#pe-page-settings'),
  });
  pageView.bind({
    onPatch: (patch) => model.patch(patch),
    onPatchCustomFields: (patch) => {
      // patch est { header_config: {...} } ou { layout_config: {...} }
      const cf = model.state.product.custom_fields || {};
      const merged = {};
      for (const [k, v] of Object.entries(patch)) {
        merged[k] = { ...(cf[k] || {}), ...v };
      }
      model.patch({ custom_fields: merged });
    },
    onOpenBlockBuilder: withErrorToast(async () => {
      // Auto-save d'abord pour s'assurer que le builder opère sur la donnée à jour.
      if (model.state.dirty || !model.state.product.id) await save();
      const id = model.state.product.id;
      if (!id) throw new Error('Sauvegardez d\'abord le produit');
      // Délègue au block builder Nickl natif via le SPA admin parent.
      // La route `cpt-content:` (ajoutée dans app.js) bypasse l\'editor.url override.
      if (window.parent && typeof window.parent.loadSection === 'function') {
        window.parent.loadSection(`cpt-content:products:${id}`);
      } else {
        // Fallback : nouvelle fenêtre vers /admin avec hash.
        window.open(`/admin/?section=cpt-content:products:${id}`, '_top');
      }
    }, 'Impossible d\'ouvrir le block builder'),
  });

  seoView.mount({
    seoRoot: qs('#pe-seo-main'),
    schemaRoot: qs('#pe-seo-schema'),
  }).bind({
    onPatch: (patch) => model.patch(patch),
  });

  dataView.mount({
    headerRoot: qs('#pe-data-header'),
    panels: {
      general:    qs('#pe-data-general'),
      inventory:  qs('#pe-data-inventory'),
      shipping:   qs('#pe-data-shipping'),
      linked:     qs('#pe-data-linked'),
      attributes: qs('#pe-data-attributes'),
      variations: qs('#pe-data-variations'),
      downloads:  qs('#pe-data-downloads'),
      pro:        qs('#pe-data-pro'),
      advanced:   qs('#pe-data-advanced'),
    },
  }).bind({
    onPatchCustomFields: (patch) => model.patch({ custom_fields: patch }),
    getCustomFields: () => model.state.product.custom_fields || {},
  });

  attrView.mount(qs('#pe-attr-builder-mount') || qs('#pe-data-attributes')).bind({
    onChange: (attrs) => model.patch({ custom_fields: { attributes: attrs } }),
  });

  variantsView.mount(qs('#pe-variants-mount') || qs('#pe-data-variations')).bind({
    onChange: (variants) => model.setVariants(variants),
    onGenerateMatrix: withErrorToast(async () => {
      await model.generateMatrix();
      toastSuccess('Matrice de variations générée');
    }, 'Erreur lors de la génération'),
  });

  imageView.mount({
    imageRoot: qs('#pe-image-body'),
    galleryRoot: qs('#pe-gallery-body'),
  }).bind({
    onChange: (patch) => model.patch(patch),
    onChangeGallery: (gallery) => model.patch({ custom_fields: { gallery } }),
  });

  catsView.mount(qs('#pe-categories-body')).bind({
    onChange: (categories) => model.patch({ categories }),
    onCreated: async (created) => {
      // Reload categories list, auto-check the new category
      await model._loadTaxonomies();
      const current = model.state.product.categories || [];
      model.patch({ categories: [...current, { id: created.id }] });
    },
  });
}

// ── Render dispatcher ────────────────────────────────────────────────────────
function renderAll() {
  const state = model.state;
  qs('#pe-title').value = state.product.title || '';
  publishView.render(state);
  pageView.render(state);
  seoView.render(state);
  dataView.render(state);
  attrView.render(state);
  variantsView.render(state);
  imageView.render(state);
  catsView.render(state);
}

// ── Init ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    activateTabs();
    await mountViews();
    wireTitle();
    await model.load(productId);
    qs('#pe-loading').style.display = 'none';
    qs('#pe-app').style.display = 'grid';
    renderAll();
    model.addEventListener('change', renderAll);

    // Cmd/Ctrl + S → save
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    });
  } catch (err) {
    console.error(err);
    qs('#pe-loading').textContent = 'Erreur : ' + (err?.message || 'Chargement impossible');
  }
})();
