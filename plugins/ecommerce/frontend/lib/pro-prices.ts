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
  pro_tier: string | null
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
        pro_tier: customer.pro_tier || null,
        discount_rate: customer.discount_rate != null ? parseFloat(customer.discount_rate) : null,
      }
    }
  } catch {}
  return null
}

function applyProPrices(customer: CustomerInfo): void {
  const rate = customer.discount_rate || 0
  const tier = customer.pro_tier || ''
  const priceDisplays = document.querySelectorAll<HTMLElement>('.price-display')

  priceDisplays.forEach(el => {
    const htEl = el.querySelector<HTMLElement>('.price-ht')
    if (!htEl) return

    const htMin = parseInt(el.dataset.htMin || '0', 10)
    const currency = el.dataset.currency || 'EUR'

    if (htMin <= 0) return

    // Pas de remise pro sur un produit déjà en promo (prix promo = prix final)
    const isOnSale = el.dataset.onSale === '1'

    // Apply discount (sauf promo active)
    const hasDiscount = rate > 0 && !isOnSale
    const discountedHt = hasDiscount ? Math.round(htMin * (1 - rate / 100)) : htMin

    const valueEl = htEl.querySelector<HTMLElement>('.price-ht-value')
    if (valueEl) valueEl.textContent = formatPrice(discountedHt, currency)

    // Show original HT strikethrough + discount badge
    const discountEl = htEl.querySelector<HTMLElement>('.price-ht-discount')
    if (discountEl && hasDiscount) {
      const originalHtFormatted = formatPrice(htMin, currency)
      const label = tier ? `${tier} -${rate}%` : `-${rate}%`
      discountEl.innerHTML = `<span class="price-ht-original">${originalHtFormatted}</span> <span class="pro-tier-badge">${label}</span>`
      discountEl.style.display = ''
    }

    // Add is-pro class: HT becomes primary, TTC becomes strikethrough
    el.classList.add('is-pro')
    htEl.style.display = ''
  })
}

// Auto-run — only on sites with poolp-configurator (data-pro-pricing="1" on body)
;(async () => {
  if (document.body.dataset.proPricing !== '1') return
  try {
    const customer = await getCustomerIfPro()
    if (customer) applyProPrices(customer)
  } catch {}
})()
