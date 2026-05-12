/**
 * HeaderConfigView — onglet "Header" du metabox Contenu du produit.
 *
 * 2 types possibles : Banner | Hero. Pour chaque type, on rend dynamiquement les
 * mêmes champs que le module Nickl correspondant, fetché depuis
 * /api/module-fields (mêmes paramètres que dans le block builder).
 *
 * Stockage : custom_fields.header_config = { type, fields: { ... } }
 */

import { BaseView } from '../../_lib/View.js';
import { FieldRenderer } from '../../_lib/FieldRenderer.js';
import { apiGet } from '../../_lib/api.js';
import { h, qs } from '../../_lib/dom.js';

let _moduleSchemaPromise = null;
function loadModuleSchema() {
  if (!_moduleSchemaPromise) {
    _moduleSchemaPromise = apiGet('/module-fields').catch(() => ({ modules: {} }));
  }
  return _moduleSchemaPromise;
}

export class HeaderConfigView extends BaseView {
  async mount(root) {
    this.root = root;
    this._schema = await loadModuleSchema();
    this._currentType = null;
    this._renderShell();
    return this;
  }

  render(state) {
    if (!this.root) return;
    const select = qs('#pe-header-type', this.root);
    if (!select) {
      // Shell perdu (ne devrait pas arriver) — re-render défensif
      this._renderShell();
      this._currentType = null;
    }
    const cfg = state.product.custom_fields?.header_config || {};
    const type = cfg.type || 'none';
    const sel = qs('#pe-header-type', this.root);
    if (sel) sel.value = type;

    // Ne reconstruit le FieldRenderer que si le type a changé : sinon on perd
    // le state du formulaire (focus, repeater rows en cours, etc.) à chaque
    // keystroke d'un autre champ.
    if (type !== this._currentType) {
      this._currentType = type;
      this._renderFields(type, cfg.fields || {});
    }
  }

  _renderShell() {
    this.root.replaceChildren(
      h('div', { class: 'form-group' },
        h('label', { class: 'form-label' }, 'Type de header'),
        h('select', { id: 'pe-header-type', class: 'form-select', style: 'max-width:280px',
          onchange: (e) => {
            const newType = e.target.value;
            this._currentType = newType;
            this._renderFields(newType, {});
            this._emit({ type: newType, fields: this._renderer ? this._renderer.collect() : {} });
          },
        },
          h('option', { value: 'none' }, 'Aucun'),
          h('option', { value: 'banner' }, 'Banner'),
          h('option', { value: 'hero' }, 'Hero banner'),
        ),
      ),
      h('div', { id: 'pe-header-fields-mount', style: 'margin-top:16px' }),
    );
  }

  _renderFields(type, values) {
    const mount = qs('#pe-header-fields-mount', this.root);
    if (type === 'none') {
      this._renderer = null;
      mount.replaceChildren();
      return;
    }
    const moduleKey = type === 'hero' ? 'Hero' : 'Banner';
    const schema = this._schema?.modules?.[moduleKey];
    if (!schema) {
      mount.replaceChildren(h('div', { class: 'empty', style: 'padding:16px' },
        `Schéma ${moduleKey} introuvable. Régénère module-fields.json côté backend.`));
      return;
    }
    this._renderer = new FieldRenderer(schema.fields || [], values, (newValues) => {
      this._emit({ type, fields: newValues });
    });
    mount.replaceChildren(this._renderer.render());
  }

  _emit(headerConfig) {
    this.handlers.onChange?.(headerConfig);
  }
}
