/**
 * settings/main.js — Presenter racine de la page Paramètres e-commerce.
 */

import { SettingsModel } from './SettingsModel.js';
import { SettingsFormView } from './SettingsFormView.js';
import { toastSuccess, toastError, withErrorToast } from '../_lib/swal.js';

const model = new SettingsModel();
const view = new SettingsFormView();

view.mount(document.body).bind({
  onSubmit: withErrorToast(async (payload) => {
    await model.save(payload);
    toastSuccess('Paramètres enregistrés');
  }, 'Erreur lors de l\'enregistrement'),

  onRevealSecret: async (key) => {
    try {
      return await model.revealSecret(key);
    } catch (err) {
      toastError(err?.message || 'Impossible d\'afficher la valeur');
      throw err;
    }
  },
});

model.addEventListener('change', () => {
  if (model.state.accessDenied) view.setAccessDenied();
  else if (model.state.data) view.fill(model.state.data);
});

withErrorToast(async () => {
  try {
    await model.load();
  } catch (err) {
    view.showLoadError(err?.message || 'Erreur de chargement');
  }
}, 'Erreur de chargement')();
