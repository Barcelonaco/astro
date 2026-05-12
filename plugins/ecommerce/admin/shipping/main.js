/**
 * shipping/main.js — Presenter racine de la page Zones de livraison.
 */

import { ShippingModel } from './ShippingModel.js';
import { ZonesListView } from './ZonesListView.js';
import { ZoneFormView } from './ZoneFormView.js';
import { MethodFormView } from './MethodFormView.js';
import { confirmDanger, modalForm, toastSuccess, withErrorToast } from '../_lib/swal.js';

const model = new ShippingModel();
const listView = new ZonesListView();
const zoneForm = new ZoneFormView();
const methodForm = new MethodFormView();
zoneForm.mount();
methodForm.mount();

async function openZoneForm({ zone, title }) {
  zoneForm.setZone(zone);
  const r = await modalForm({
    title,
    body: zoneForm.getElement(),
    confirmText: 'Enregistrer',
    size: 'md',
    preConfirm: async () => {
      const data = zoneForm.collect();
      return await model.saveZone(data);
    },
  });
  if (r.isConfirmed) toastSuccess(zone ? 'Zone modifiée' : 'Zone créée');
}

async function openMethodForm({ method, zoneId, title }) {
  methodForm.setMethod(method, zoneId);
  const r = await modalForm({
    title,
    body: methodForm.getElement(),
    confirmText: 'Enregistrer',
    size: 'md',
    preConfirm: async () => {
      const data = methodForm.collect();
      return await model.saveMethod(data);
    },
  });
  if (r.isConfirmed) toastSuccess(method ? 'Méthode modifiée' : 'Méthode créée');
}

listView.mount(document.body).bind({
  onCreateZone: () => openZoneForm({ zone: null, title: 'Nouvelle zone' }),
  onEditZone:   (id) => openZoneForm({ zone: model.findZone(id), title: 'Modifier la zone' }),
  onDeleteZone: withErrorToast(async (id) => {
    const ok = await confirmDanger({
      title: 'Supprimer cette zone ?',
      text: 'Toutes les méthodes de la zone seront aussi supprimées.',
    });
    if (!ok) return;
    await model.removeZone(id);
    toastSuccess('Zone supprimée');
  }, 'Erreur lors de la suppression'),

  onAddMethod:   (zoneId) => openMethodForm({ method: null, zoneId, title: 'Nouvelle méthode' }),
  onEditMethod:  (zoneId, methodId) => openMethodForm({
    method: model.findMethod(zoneId, methodId), zoneId, title: 'Modifier la méthode'
  }),
  onDeleteMethod: withErrorToast(async (id) => {
    const ok = await confirmDanger({ title: 'Supprimer cette méthode ?' });
    if (!ok) return;
    await model.removeMethod(id);
    toastSuccess('Méthode supprimée');
  }, 'Erreur lors de la suppression'),
});

model.addEventListener('change', () => listView.render(model.state));

withErrorToast(() => model.load(), 'Erreur de chargement')();
