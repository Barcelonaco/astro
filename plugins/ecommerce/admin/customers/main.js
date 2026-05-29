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

// ── State ──
let currentTab = 'active'; // 'active' | 'deleted'
let currentSort = 'created_at';
let currentDir = 'DESC';
let debounceTimer = null;

function collectFilters() {
  const f = {
    q: qs('#filter-q').value.trim(),
    pro_status: qs('#filter-pro-status').value,
    anonymized: currentTab === 'deleted' ? '1' : '0',
    sort: currentSort,
    dir: currentDir,
  };
  return f;
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

// ── Tabs ──
document.querySelectorAll('#customers-tabs .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentTab = btn.dataset.tab;
    document.querySelectorAll('#customers-tabs .tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === currentTab);
      b.style.color = b.dataset.tab === currentTab ? '' : 'var(--gray-500,#6b7280)';
      b.style.borderBottomColor = b.dataset.tab === currentTab ? 'var(--primary,#222)' : 'transparent';
    });
    reloadFiltered();
  });
});
// Set initial tab style
qs('#customers-tabs .tab-btn.active').style.borderBottomColor = 'var(--primary,#222)';

// ── Sort ──
document.querySelectorAll('th.sortable').forEach(th => {
  th.style.cursor = 'pointer';
  th.style.userSelect = 'none';
  th.addEventListener('click', () => {
    const col = th.dataset.sort;
    if (currentSort === col) {
      currentDir = currentDir === 'DESC' ? 'ASC' : 'DESC';
    } else {
      currentSort = col;
      currentDir = 'ASC';
    }
    // Update sort indicators
    document.querySelectorAll('th.sortable').forEach(h => {
      h.classList.remove('sort-asc', 'sort-desc');
    });
    th.classList.add(currentDir === 'ASC' ? 'sort-asc' : 'sort-desc');
    reloadFiltered();
  });
});

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
      const delBtn = qs('#detail-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', async () => {
          const confirm = await Swal.fire({
            title: 'Supprimer ce client ?',
            text: 'Cette action est irreversible. Le compte sera anonymisé (RGPD).',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#b91c1c',
          });
          if (!confirm.isConfirmed) return;
          try {
            await model.deleteCustomer(id);
            toastSuccess('Client supprime');
            Swal.close();
            reloadFiltered();
          } catch (err) { toastError(err?.message || 'Erreur'); }
        });
      }
    },
  });
}

// ── Wire table view ──
async function deleteFromTable(id) {
  const confirm = await Swal.fire({
    title: 'Supprimer ce client ?',
    text: 'Cette action est irreversible. Le compte sera anonymisé (RGPD).',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Supprimer',
    cancelButtonText: 'Annuler',
    confirmButtonColor: '#b91c1c',
  });
  if (!confirm.isConfirmed) return;
  try {
    await model.deleteCustomer(id);
    toastSuccess('Client supprime');
    reloadFiltered();
  } catch (err) { toastError(err?.message || 'Erreur'); }
}

tableView.mount(document.body).bind({
  onView: withErrorToast(openDetail, 'Erreur chargement client'),
  onDelete: withErrorToast(deleteFromTable, 'Erreur suppression'),
  onPage: (page) => reloadFiltered(page),
});

model.addEventListener('change', () => {
  tableView.render(model.state);
  if (model.state.stats) tableView.renderStats(model.state.stats);
});

// ── Init ──
withErrorToast(async () => {
  await Promise.all([model.load({ anonymized: '0', sort: 'created_at', dir: 'DESC' }), model.loadStats()]);
}, 'Erreur de chargement')();
