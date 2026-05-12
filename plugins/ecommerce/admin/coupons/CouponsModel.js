/**
 * CouponsModel — état + API pour les coupons.
 *
 * State : { coupons: Coupon[], loading: boolean }
 * Events : 'change', 'saved' (Coupon), 'deleted' (id)
 */

import { BaseModel } from '../_lib/Model.js';
import { apiGet, apiPost, apiPut, apiDelete } from '../_lib/api.js';

export class CouponsModel extends BaseModel {
  constructor() {
    super({ coupons: [], loading: false });
  }

  async load() {
    this.set({ loading: true });
    const data = await apiGet('/admin/coupons');
    this.set({ coupons: data.coupons || [], loading: false });
  }

  async save(coupon) {
    const id = coupon.id;
    const body = {
      code: coupon.code.toUpperCase(),
      type: coupon.type,
      percent: coupon.type === 'percent' ? parseFloat(coupon.percent || '0') : null,
      value_cents: coupon.type === 'fixed' ? parseInt(coupon.value_cents || '0') : null,
      min_subtotal_cents: coupon.min_subtotal_cents ? parseInt(coupon.min_subtotal_cents) : null,
      max_uses: coupon.max_uses ? parseInt(coupon.max_uses) : null,
      max_uses_per_customer: coupon.max_uses_per_customer ? parseInt(coupon.max_uses_per_customer) : null,
      starts_at: coupon.starts_at ? coupon.starts_at.replace('T', ' ') + ':00' : null,
      expires_at: coupon.expires_at ? coupon.expires_at.replace('T', ' ') + ':00' : null,
      applies_to: coupon.applies_to,
      is_active: !!coupon.is_active,
    };
    const saved = id
      ? await apiPut(`/admin/coupons/${id}`, body)
      : await apiPost('/admin/coupons', body);
    await this.load();
    this.emit('saved', saved);
    return saved;
  }

  async remove(id) {
    await apiDelete(`/admin/coupons/${id}`);
    await this.load();
    this.emit('deleted', id);
  }
}
