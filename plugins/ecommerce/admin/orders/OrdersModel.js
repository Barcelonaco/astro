/**
 * OrdersModel — state + API for orders admin.
 *
 * State : { orders: [], loading, total, page, pages, per_page, filters, stats }
 */

import { BaseModel } from '../_lib/Model.js';
import { apiGet, apiPut, apiPost, apiDelete } from '../_lib/api.js';

export class OrdersModel extends BaseModel {
  constructor() {
    super({ orders: [], loading: false, total: 0, page: 1, pages: 0, per_page: 25, filters: {}, stats: null });
  }

  async load(filters = {}) {
    this.set({ loading: true, filters });
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.status) params.set('status', filters.status);
    if (filters.payment_status) params.set('payment_status', filters.payment_status);
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    if (filters.page) params.set('page', filters.page);

    const qs = params.toString();
    const data = await apiGet('/admin/orders' + (qs ? '?' + qs : ''));
    this.set({
      orders: data.orders || [],
      total: data.total || 0,
      page: data.page || 1,
      pages: data.pages || 0,
      per_page: data.per_page || 25,
      loading: false,
    });
  }

  async getDetail(id) {
    return apiGet(`/admin/orders/${id}`);
  }

  async updateOrder(id, body) {
    const result = await apiPut(`/admin/orders/${id}`, body);
    await this.load(this.state.filters);
    this.emit('updated', result);
    return result;
  }

  async refundOrder(id, body) {
    const result = await apiPost(`/admin/orders/${id}/refund`, body);
    await this.load(this.state.filters);
    this.emit('refunded', result);
    return result;
  }

  async deleteOrder(id) {
    const result = await apiDelete(`/admin/orders/${id}`);
    await this.load(this.state.filters);
    this.emit('deleted', result);
    return result;
  }

  async loadStats() {
    const stats = await apiGet('/admin/orders/stats');
    this.set({ stats });
  }
}
