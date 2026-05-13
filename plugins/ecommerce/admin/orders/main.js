/**
 * orders/main.js — Presenter for Orders admin page.
 */

import { OrdersModel } from './OrdersModel.js';
import { OrdersTableView } from './OrdersTableView.js';
import { OrderDetailView } from './OrderDetailView.js';
import { confirmDanger, toastSuccess, toastError, withErrorToast } from '../_lib/swal.js';
import { qs } from '../_lib/dom.js';

const model = new OrdersModel();
const tableView = new OrdersTableView();
const detailView = new OrderDetailView();

const Swal = window.Swal;

// ── Filters ──
let debounceTimer = null;
function collectFilters() {
  return {
    q: qs('#filter-q').value.trim(),
    status: qs('#filter-status').value,
    payment_status: qs('#filter-payment').value,
    date_from: qs('#filter-date-from').value,
    date_to: qs('#filter-date-to').value,
  };
}

function reloadFiltered(page) {
  const filters = collectFilters();
  if (page) filters.page = page;
  withErrorToast(() => model.load(filters), 'Erreur de chargement')();
}

qs('#filter-q').addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => reloadFiltered(), 300);
});
qs('#filter-status').addEventListener('change', () => reloadFiltered());
qs('#filter-payment').addEventListener('change', () => reloadFiltered());
qs('#filter-date-from').addEventListener('change', () => reloadFiltered());
qs('#filter-date-to').addEventListener('change', () => reloadFiltered());

// ── View detail modal ──
async function openDetail(id) {
  const order = await model.getDetail(id);

  const result = await Swal.fire({
    title: '',
    html: detailView.buildDetailHtml(order),
    width: '960px',
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: 'Fermer',
    customClass: { popup: 'ecommerce-swal' },
    didRender: () => {
      const updateBtn = qs('#detail-update-btn');
      if (updateBtn) {
        updateBtn.addEventListener('click', async () => {
          try {
            const status = qs('#detail-new-status').value;
            const note = qs('#detail-note').value.trim();
            await model.updateOrder(id, { status, note: note || undefined });
            toastSuccess('Commande mise a jour');
            Swal.close();
          } catch (err) { toastError(err?.message || 'Erreur'); }
        });
      }
      const refundBtn = qs('#detail-refund-btn');
      if (refundBtn) {
        refundBtn.addEventListener('click', async () => {
          const ok = await confirmDanger({
            title: 'Rembourser cette commande ?',
            text: `Remboursement total de ${(order.total_cents / 100).toFixed(2)} EUR via Stripe. Cette action est irreversible.`,
            confirmText: 'Rembourser',
          });
          if (!ok) return;
          try {
            await model.refundOrder(id, { reason: 'requested_by_customer' });
            toastSuccess('Remboursement effectue');
            Swal.close();
          } catch (err) { toastError(err?.message || 'Erreur Stripe'); }
        });
      }
    },
  });
}

// ── Delete order ──
async function deleteOrder(id, orderNumber) {
  const ok = await confirmDanger({
    title: 'Supprimer cette commande ?',
    text: `La commande ${orderNumber || id} sera definitivement supprimee avec ses articles, factures et paiements associes. Cette action est irreversible.`,
    confirmText: 'Supprimer',
  });
  if (!ok) return;
  try {
    await model.deleteOrder(id);
    toastSuccess('Commande supprimee');
  } catch (err) { toastError(err?.message || 'Erreur'); }
}

// ── Wire table view ──
tableView.mount(document.body).bind({
  onView: withErrorToast(openDetail, 'Erreur chargement commande'),
  onDelete: deleteOrder,
  onPage: (page) => reloadFiltered(page),
});

model.addEventListener('change', () => {
  tableView.render(model.state);
  if (model.state.stats) tableView.renderStats(model.state.stats);
});

// ── Init ──
withErrorToast(async () => {
  await Promise.all([model.load(), model.loadStats()]);
}, 'Erreur de chargement')();
