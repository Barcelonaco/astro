/**
 * BaseModel — état + EventTarget natif (pub/sub).
 *
 * Convention : les sous-classes appellent this.set({ ... }) qui merge le state
 * et émet 'change' (CustomEvent). Les Views s'abonnent à model.addEventListener('change', ...).
 *
 * État accessible en lecture via model.state (figé via Object.freeze pour éviter
 * les mutations directes — toute modif passe par set()).
 */

export class BaseModel extends EventTarget {
  constructor(initial = {}) {
    super();
    this._state = Object.freeze({ ...initial });
  }

  get state() { return this._state; }

  set(patch) {
    const next = { ...this._state, ...patch };
    this._state = Object.freeze(next);
    this.dispatchEvent(new CustomEvent('change', { detail: this._state }));
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
