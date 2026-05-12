/**
 * TaxModel — état + API pour les taux de TVA.
 *
 * State : { rates: TaxRate[], loading: boolean, error: string|null }
 * Events : 'change' (state), 'saved' (TaxRate), 'deleted' (id)
 */

import { BaseModel } from '../_lib/Model.js';
import { apiGet, apiPost, apiPut, apiDelete } from '../_lib/api.js';

export class TaxModel extends BaseModel {
  constructor() {
    super({ rates: [], loading: false, error: null });
  }

  async load() {
    this.set({ loading: true, error: null });
    const data = await apiGet('/admin/tax-rates');
    this.set({ rates: data.rates || [], loading: false });
  }

  async save(rate) {
    const id = rate.id;
    const body = {
      code: rate.code.toUpperCase(),
      label: rate.label,
      rate: parseFloat(rate.rate),
      country_code: rate.country_code.toUpperCase(),
      is_default: !!rate.is_default,
    };
    const saved = id
      ? await apiPut(`/admin/tax-rates/${id}`, body)
      : await apiPost('/admin/tax-rates', body);
    await this.load();
    this.emit('saved', saved);
    return saved;
  }

  async remove(id) {
    await apiDelete(`/admin/tax-rates/${id}`);
    await this.load();
    this.emit('deleted', id);
  }
}
