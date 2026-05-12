/**
 * BaseView — squelette d'une vue MVP.
 *
 * Convention :
 *   class TaxTableView extends BaseView {
 *     mount(root) { ... } // attache au DOM la première fois
 *     render(state) { ... } // mise à jour surgicale (pas d'innerHTML destructif sur formulaires)
 *     bind(handlers) { this.handlers = handlers; } // câblage callbacks → Presenter
 *     destroy() { ... } // cleanup listeners (optionnel)
 *   }
 *
 * Les sous-classes implémentent mount/render/bind. Cette base fournit just
 * le contrat + helpers communs (cleanup automatique des listeners enregistrés
 * via this.on()).
 */

import { on } from './dom.js';

export class BaseView {
  constructor() {
    this._cleanups = [];
    this.handlers = {};
  }

  /** Attache un listener et le track pour cleanup auto sur destroy(). */
  on(target, event, handler, opts) {
    this._cleanups.push(on(target, event, handler, opts));
  }

  bind(handlers) { this.handlers = handlers; return this; }

  /** Supprime tous les listeners attachés via this.on(). */
  destroy() {
    while (this._cleanups.length) this._cleanups.pop()();
  }

  /** À implémenter par les sous-classes. */
  mount(root) { throw new Error('mount() not implemented'); }
  render(state) { throw new Error('render() not implemented'); }
}
