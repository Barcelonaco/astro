/**
 * SettingsModel — état + API des paramètres e-commerce.
 *
 * State : { data: object|null, loading, role: 'super_admin'|'admin'|... }
 * Events : 'change'
 *
 * Secrets : champs `*_set` / `*_masked` exposés en lecture, valeurs réelles
 * récupérées via revealSecret() (endpoint séparé, audité).
 */

import { BaseModel } from '../_lib/Model.js';
import { apiGet, apiPut } from '../_lib/api.js';

export class SettingsModel extends BaseModel {
  constructor() {
    super({ data: null, loading: false, role: null, accessDenied: false });
  }

  static decodeJwt(t) {
    try {
      const payload = t.split('.')[1];
      return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch { return null; }
  }

  async load() {
    this.set({ loading: true });
    const tokenSrc = window.parent && window.parent.localStorage ? window.parent.localStorage : localStorage;
    const token = tokenSrc.getItem('token');
    const claims = token ? SettingsModel.decodeJwt(token) : null;
    const role = claims?.role || null;

    if (role !== 'super_admin' && role !== 'admin') {
      this.set({ loading: false, role, accessDenied: true });
      return;
    }

    try {
      const data = await apiGet('/ecommerce/settings');
      this.set({ data, role, loading: false, accessDenied: false });
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        this.set({ loading: false, role, accessDenied: true });
        return;
      }
      throw err;
    }
  }

  async save(payload) {
    await apiPut('/ecommerce/settings', payload);
    await this.load();
  }

  async revealSecret(key) {
    const data = await apiGet(`/ecommerce/settings/secret/${encodeURIComponent(key)}`);
    return data.value || '';
  }
}
