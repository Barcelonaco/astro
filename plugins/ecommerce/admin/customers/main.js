/**
 * customers/main.js — Presenter for Customers admin page.
 */

import { CustomersModel } from './CustomersModel.js';
import { CustomersTableView } from './CustomersTableView.js';
import { CustomerDetailView } from './CustomerDetailView.js';
import { toastSuccess, toastError, withErrorToast } from '../_lib/swal.js';
import { qs } from '../_lib/dom.js';

const model = new CustomersModel();
const tableView = new CustomersTableView();
const detailView = new CustomerDetailView();

const Swal = window.Swal;

// ── Filters ──
let debounceTimer = null;
function collectFilters() {
  return {
    q: qs('#filter-q').value.trim(),
    pro_status: qs('#filter-pro-status').value,
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
qs('#filter-pro-status').addEventListener('change', () => reloadFiltered());

// ── View detail modal ──
async function openDetail(id) {
  const customer = await model.getDetail(id);

  await Swal.fire({
    title: '',
    html: detailView.buildDetailHtml(customer),
    width: '880px',
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: 'Fermer',
    customClass: { popup: 'ecommerce-swal' },
    didRender: () => {
      const saveBtn = qs('#detail-save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          try {
            const proStatus = qs('#detail-pro-status').value;
            const discountRaw = qs('#detail-discount').value;
            const paymentTerms = qs('#detail-payment-terms')?.value || 'immediate';
            const note = qs('#detail-note').value.trim();
            const body = {
              pro_status: proStatus,
              discount_rate: discountRaw !== '' ? parseFloat(discountRaw) : null,
              payment_terms: paymentTerms,
              note: note || undefined,
            };
            await model.updateCustomer(id, body);
            toastSuccess('Client mis a jour');
            Swal.close();
          } catch (err) { toastError(err?.message || 'Erreur'); }
        });
      }
    },
  });
}

// ── Wire table view ──
tableView.mount(document.body).bind({
  onView: withErrorToast(openDetail, 'Erreur chargement client'),
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
