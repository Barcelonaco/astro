/**
 * stripe-api — client Stripe.js + endpoints PaymentIntent backend.
 *
 * Charge dynamiquement le SDK Stripe.js (https://js.stripe.com/v3/) à la
 * demande pour ne pas pénaliser les pages sans paiement. Le pk_* est servi
 * par GET /shop/payment-config (public).
 */

const API_URL = import.meta.env.BUILD_API_URL || import.meta.env.PUBLIC_API_URL || 'http://localhost:3000/api'

export interface PaymentConfig {
  enabled: boolean
  currency: string
  payment_methods: string[]
  stripe: { enabled: boolean; pk: string; mode: 'test' | 'live' }
}

export interface PaymentIntentResponse {
  client_secret: string
  payment_intent_id: string
  amount: number
  currency: string
}

let configCache: PaymentConfig | null = null

export async function getPaymentConfig(force = false): Promise<PaymentConfig> {
  if (configCache && !force) return configCache
  try {
    const res = await fetch(`${API_URL}/shop/payment-config`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    configCache = await res.json()
    return configCache!
  } catch (err) {
    console.error('getPaymentConfig:', err)
    return { enabled: false, currency: 'EUR', payment_methods: [], stripe: { enabled: false, pk: '', mode: 'test' } }
  }
}

export async function createPaymentIntent(orderId: number, guestToken?: string): Promise<PaymentIntentResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null
  if (auth) headers['Authorization'] = `Bearer ${auth}`
  const res = await fetch(`${API_URL}/payments/stripe/create-payment-intent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ order_id: orderId, guest_token: guestToken || null }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error || 'Échec de l\'initialisation du paiement')
  }
  return await res.json()
}

let stripeJsPromise: Promise<any> | null = null

/** Charge Stripe.js une seule fois et instancie Stripe(pk). */
export async function loadStripe(pk: string): Promise<any> {
  if (typeof window === 'undefined') throw new Error('Stripe.js requires browser')
  if (!pk) throw new Error('Stripe public key missing')
  if (!stripeJsPromise) {
    stripeJsPromise = new Promise((resolve, reject) => {
      if ((window as any).Stripe) return resolve((window as any).Stripe)
      const s = document.createElement('script')
      s.src = 'https://js.stripe.com/v3/'
      s.async = true
      s.onload = () => {
        if ((window as any).Stripe) resolve((window as any).Stripe)
        else reject(new Error('Stripe.js failed to load'))
      }
      s.onerror = () => reject(new Error('Stripe.js script error'))
      document.head.appendChild(s)
    })
  }
  const StripeCtor = await stripeJsPromise
  return StripeCtor(pk)
}
