/**
 * coupons/main.js — Presenter racine de la page Coupons.
 */

import { CouponsModel } from './CouponsModel.js';
import { CouponsTableView } from './CouponsTableView.js';
import { CouponFormView } from './CouponFormView.js';
import { confirmDanger, modalForm, toastSuccess, withErrorToast } from '../_lib/swal.js';

const model = new CouponsModel();
const tableView = new CouponsTableView();
const formView = new CouponFormView();
formView.mount();

async function openForm({ coupon, title }) {
  formView.setCoupon(coupon);
  const result = await modalForm({
    title,
    body: formView.getElement(),
    confirmText: 'Enregistrer',
    size: 'md',
    preConfirm: async () => {
      const data = formView.collect();
      return await model.save(data);
    },
  });
  if (result.isConfirmed) toastSuccess(coupon ? 'Coupon modifié' : 'Coupon créé');
}

tableView.mount(document.body).bind({
  onCreate: () => openForm({ coupon: null, title: 'Nouveau coupon' }),
  onEdit:   (coupon) => openForm({ coupon, title: 'Modifier le coupon' }),
  onDelete: withErrorToast(async (id) => {
    const ok = await confirmDanger({ title: 'Supprimer ce coupon ?' });
    if (!ok) return;
    await model.remove(id);
    toastSuccess('Coupon supprimé');
  }, 'Erreur lors de la suppression'),
});

model.addEventListener('change', () => tableView.render(model.state));

withErrorToast(() => model.load(), 'Erreur de chargement')();
