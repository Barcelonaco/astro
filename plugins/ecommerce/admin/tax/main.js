/**
 * tax/main.js — Presenter racine de la page Taux de TVA.
 *
 * Wire Model ↔ Views via SweetAlert2 :
 *   - TaxModel.change → TaxTableView.render(state)
 *   - TaxTableView.onCreate → modalForm Swal en mode création
 *   - TaxTableView.onEdit(rate) → modalForm Swal en mode édition
 *   - TaxTableView.onDelete(id) → confirmDanger Swal + TaxModel.remove(id)
 */

import { TaxModel } from './TaxModel.js';
import { TaxTableView } from './TaxTableView.js';
import { TaxFormView } from './TaxFormView.js';
import { confirmDanger, modalForm, toastSuccess, withErrorToast } from '../_lib/swal.js';

const model = new TaxModel();
const tableView = new TaxTableView();
const formView = new TaxFormView();
formView.mount();

async function openForm({ rate, title }) {
  formView.setRate(rate);
  const result = await modalForm({
    title,
    body: formView.getElement(),
    confirmText: 'Enregistrer',
    size: 'sm',
    preConfirm: async () => {
      const data = formView.collect();
      return await model.save(data);
    },
  });
  if (result.isConfirmed) toastSuccess(rate ? 'Taux modifié' : 'Taux créé');
}

tableView.mount(document.body).bind({
  onCreate: () => openForm({ rate: null, title: 'Nouveau taux' }),
  onEdit:   (rate) => openForm({ rate, title: 'Modifier le taux' }),
  onDelete: withErrorToast(async (id) => {
    const ok = await confirmDanger({
      title: 'Supprimer ce taux ?',
      text: 'Les produits qui l\'utilisent perdront leur taux.',
    });
    if (!ok) return;
    await model.remove(id);
    toastSuccess('Taux supprimé');
  }, 'Erreur lors de la suppression'),
});

model.addEventListener('change', () => tableView.render(model.state));

withErrorToast(() => model.load(), 'Erreur de chargement')();
