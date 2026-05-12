/**
 * Pro pricing — reveals HT prices + applies discount_rate for approved pro customers.
 *
 * Auto-runs on page load. Checks customer auth, and if pro approved:
 *   1. Shows .price-ht elements
 *   2. Applies discount_rate to HT prices
 *
 * Imported by product pages / shop pages that include PriceDisplay.
 */

const API_URL = import.meta.env.BUILD_API_URL || import.meta.env.PUBLIC_API_URL || 'http://localhost:3000/api'

interface CustomerInfo {
  is_pro: boolean
  pro_status: string
  discount_rate: number | null
}

function formatPrice(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100)
}

async function getCustomerIfPro(): Promise<CustomerInfo | null> {
  const token = localStorage.getItem('customer_token')
  if (!token) return null

  try {
    const res = await fetch(`${API_URL}/customer/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!res.ok) return null
    const customer = await res.json()
    if (customer.is_pro && customer.pro_status === 'approved') {
      return {
        is_pro: true,
        pro_status: customer.pro_status,
        discount_rate: customer.discount_rate != null ? parseFloat(customer.discount_rate) : null,
      }
    }
  } catch {}
  return null
}

function applyProPrices(customer: CustomerInfo): void {
  const rate = customer.discount_rate || 0
  const priceDisplays = document.querySelectorAll<HTMLElement>('.price-display')

  priceDisplays.forEach(el => {
    const htEl = el.querySelector<HTMLElement>('.price-ht')
    if (!htEl) return

    const htMin = parseInt(el.dataset.htMin || '0', 10)
    const currency = el.dataset.currency || 'EUR'

    if (htMin <= 0) return

    // Apply discount
    const discountedHt = rate > 0 ? Math.round(htMin * (1 - rate / 100)) : htMin

    const valueEl = htEl.querySelector<HTMLElement>('.price-ht-value')
    if (valueEl) valueEl.textContent = formatPrice(discountedHt, currency)

    // Show discount percentage if applicable
    if (rate > 0) {
      const discountEl = htEl.querySelector<HTMLElement>('.price-ht-discount')
      if (discountEl) {
        discountEl.textContent = `(-${rate}%)`
        discountEl.style.display = ''
      }
    }

    htEl.style.display = ''
  })
}

// Auto-run
;(async () => {
  try {
    const customer = await getCustomerIfPro()
    if (customer) applyProPrices(customer)
  } catch {}
})()
