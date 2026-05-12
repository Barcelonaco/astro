/**
 * ShippingModel — état + API zones de livraison + méthodes (relation 1:N).
 *
 * State : { zones: Zone[], loading: boolean }
 * Chaque zone embarque ses methods : { id, name, countries, postcode_patterns, methods: [...] }
 *
 * API:
 *   GET    /admin/shipping-zones                         (liste avec methods)
 *   POST   /admin/shipping-zones                         (create zone)
 *   PUT    /admin/shipping-zones/:id                     (update zone)
 *   DELETE /admin/shipping-zones/:id                     (delete zone + cascade methods)
 *   POST   /admin/shipping-zones/:zoneId/methods         (create method)
 *   PUT    /admin/shipping-methods/:id                   (update method)
 *   DELETE /admin/shipping-methods/:id                   (delete method)
 */

import { BaseModel } from '../_lib/Model.js';
import { apiGet, apiPost, apiPut, apiDelete } from '../_lib/api.js';

export class ShippingModel extends BaseModel {
  constructor() {
    super({ zones: [], loading: false });
  }

  async load() {
    this.set({ loading: true });
    const data = await apiGet('/admin/shipping-zones');
    this.set({ zones: data.zones || [], loading: false });
  }

  async saveZone(zone) {
    const body = {
      name: zone.name,
      countries: (zone.countries || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
      postcode_patterns: (zone.postcode_patterns || '').split('\n').map(s => s.trim()).filter(Boolean),
      priority: +zone.priority || 0,
      position: +zone.position || 0,
    };
    const saved = zone.id
      ? await apiPut(`/admin/shipping-zones/${zone.id}`, body)
      : await apiPost('/admin/shipping-zones', body);
    await this.load();
    return saved;
  }

  async removeZone(id) {
    await apiDelete(`/admin/shipping-zones/${id}`);
    await this.load();
  }

  async saveMethod(method) {
    const tiers = (method.weight_tiers_text || '').split('\n').map(s => {
      const parts = s.split(':');
      if (parts.length < 3) return null;
      return { min: +parts[0], max: parts[1] === '' ? null : +parts[1], price_cents: +parts[2] };
    }).filter(Boolean);

    const body = {
      name: method.name,
      type: method.type,
      description: method.description,
      price_cents: +method.price_cents || 0,
      free_threshold_cents: method.free_threshold_cents ? +method.free_threshold_cents : null,
      weight_tiers: (method.type === 'weight' || method.type === 'price') ? tiers : null,
      delivery_min_days: method.delivery_min_days ? +method.delivery_min_days : null,
      delivery_max_days: method.delivery_max_days ? +method.delivery_max_days : null,
      tax_code: method.tax_code || null,
      is_active: !!method.is_active,
      position: +method.position || 0,
    };
    const saved = method.id
      ? await apiPut(`/admin/shipping-methods/${method.id}`, body)
      : await apiPost(`/admin/shipping-zones/${method.zone_id}/methods`, body);
    await this.load();
    return saved;
  }

  async removeMethod(id) {
    await apiDelete(`/admin/shipping-methods/${id}`);
    await this.load();
  }

  findZone(id) { return this.state.zones.find(z => z.id === id); }
  findMethod(zoneId, methodId) {
    const zone = this.findZone(zoneId);
    return zone ? (zone.methods || []).find(m => m.id === methodId) : null;
  }
}
