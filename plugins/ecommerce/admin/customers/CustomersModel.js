/**
 * CustomersModel — state + API for customers admin.
 */

import { BaseModel } from '../_lib/Model.js';
import { apiGet, apiPut } from '../_lib/api.js';

export class CustomersModel extends BaseModel {
  constructor() {
    super({ customers: [], loading: false, total: 0, page: 1, pages: 0, per_page: 25, filters: {}, stats: null });
  }

  async load(filters = {}) {
    this.set({ loading: true, filters });
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.pro_status) params.set('pro_status', filters.pro_status);
    if (filters.page) params.set('page', filters.page);

    const qs = params.toString();
    const data = await apiGet('/admin/customers' + (qs ? '?' + qs : ''));
    this.set({
      customers: data.customers || [],
      total: data.total || 0,
      page: data.page || 1,
      pages: data.pages || 0,
      per_page: data.per_page || 25,
      loading: false,
    });
  }

  async getDetail(id) {
    return apiGet(`/admin/customers/${id}`);
  }

  async updateCustomer(id, body) {
    const result = await apiPut(`/admin/customers/${id}`, body);
    await this.load(this.state.filters);
    this.emit('updated', result);
    return result;
  }

  async loadStats() {
    const stats = await apiGet('/admin/customers/stats');
    this.set({ stats });
  }
}
