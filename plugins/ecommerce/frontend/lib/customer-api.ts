/**
 * Customer API client — auth, profile, addresses, orders.
 *
 * Token stored in localStorage as `customer_token`.
 * All methods throw on error (caller handles UI feedback).
 */

const API_URL = import.meta.env.BUILD_API_URL || import.meta.env.PUBLIC_API_URL || 'http://localhost:3000/api'

// ── Token management ─────────────────────────────────────────────────────

export function getToken(): string | null {
  try { return localStorage.getItem('customer_token') } catch { return null }
}

export function setToken(token: string): void {
  try { localStorage.setItem('customer_token', token) } catch {}
}

export function clearToken(): void {
  try { localStorage.removeItem('customer_token') } catch {}
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

// ── Fetch wrapper ────────────────────────────────────────────────────────

async function apiFetch<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...opts.headers as any }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...opts, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || `HTTP ${res.status}`, res.status)
  return data as T
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────

export interface Customer {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  company: string | null
  vat_number: string | null
  siret: string | null
  activity: string | null
  is_pro: boolean
  pro_status: 'none' | 'pending' | 'approved' | 'rejected'
  accepts_marketing: boolean
  locale: string
  last_login_at: string | null
  created_at: string
}

export interface LoginResult {
  token: string
  customer: Customer
  message: string
}

export interface RegisterResult {
  token: string
  customer: Customer
  message: string
}

/** Get reCAPTCHA v3 token if available. */
export async function getRecaptchaToken(action = 'submit'): Promise<string | null> {
  const key = document.body.dataset.recaptchaKey
  if (!key || !(window as any).grecaptcha) return null
  try {
    return await (window as any).grecaptcha.execute(key, { action })
  } catch { return null }
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const _recaptcha_token = await getRecaptchaToken('login')
  const data = await apiFetch<LoginResult>('/customer/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, ...(_recaptcha_token ? { _recaptcha_token } : {}) }),
  })
  if (data.token) setToken(data.token)
  return data
}

export async function register(body: Record<string, any>): Promise<RegisterResult> {
  const _recaptcha_token = await getRecaptchaToken('register')
  const data = await apiFetch<RegisterResult>('/customer/auth/register', {
    method: 'POST',
    body: JSON.stringify({ ...body, ...(_recaptcha_token ? { _recaptcha_token } : {}) }),
  })
  if (data.token) setToken(data.token)
  return data
}

export async function logout(): Promise<void> {
  try { await apiFetch('/customer/auth/logout', { method: 'POST' }) } catch {}
  clearToken()
}

export async function getMe(): Promise<Customer> {
  return apiFetch<Customer>('/customer/auth/me')
}

export async function updateProfile(body: Record<string, any>): Promise<{ customer: Customer; message: string }> {
  return apiFetch('/customer/auth/profile', { method: 'PUT', body: JSON.stringify(body) })
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const _recaptcha_token = await getRecaptchaToken('forgot_password')
  return apiFetch('/customer/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email, ...(_recaptcha_token ? { _recaptcha_token } : {}) }) })
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return apiFetch('/customer/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) })
}

// ── Addresses ────────────────────────────────────────────────────────────

export interface CustomerAddress {
  id: number
  type: 'billing' | 'shipping'
  is_default: boolean
  first_name: string
  last_name: string
  company: string | null
  address_line1: string
  address_line2: string | null
  postcode: string
  city: string
  region: string | null
  country_code: string
  phone: string | null
}

export async function getAddresses(): Promise<CustomerAddress[]> {
  return apiFetch<CustomerAddress[]>('/customer/addresses')
}

export async function createAddress(body: Record<string, any>): Promise<{ id: number; message: string }> {
  return apiFetch('/customer/addresses', { method: 'POST', body: JSON.stringify(body) })
}

export async function updateAddress(id: number, body: Record<string, any>): Promise<{ message: string }> {
  return apiFetch(`/customer/addresses/${id}`, { method: 'PUT', body: JSON.stringify(body) })
}

export async function deleteAddress(id: number): Promise<{ message: string }> {
  return apiFetch(`/customer/addresses/${id}`, { method: 'DELETE' })
}

// ── Orders ───────────────────────────────────────────────────────────────

export interface OrderSummary {
  id: number
  order_number: string
  status: string
  payment_status: string
  total_cents: number
  currency: string
  placed_at: string
  paid_at: string | null
  shipped_at: string | null
  delivered_at: string | null
}

export interface OrderDetail extends OrderSummary {
  email: string
  payment_method: string
  subtotal_cents: number
  discount_cents: number
  shipping_cents: number
  tax_cents: number
  coupon_code: string | null
  shipping_method_label: string | null
  billing_address: Record<string, any> | null
  shipping_address: Record<string, any> | null
  items: OrderItem[]
}

export interface OrderItem {
  id: number
  product_title: string
  sku: string
  variant_attributes: Record<string, string>
  quantity: number
  unit_price_cents: number
  tax_rate: number
  line_subtotal_cents: number
  line_tax_cents: number
  line_total_cents: number
}

export async function getMyOrders(): Promise<{ orders: OrderSummary[] }> {
  return apiFetch('/orders')
}

export async function getOrderByNumber(number: string, guestToken?: string): Promise<OrderDetail> {
  const qs = guestToken ? `?guest_token=${encodeURIComponent(guestToken)}` : ''
  return apiFetch(`/orders/by-number/${encodeURIComponent(number)}${qs}`)
}

/** Guest order tracking — lookup by order number + email (no auth needed). */
export async function trackOrder(number: string, email: string): Promise<OrderDetail> {
  const params = new URLSearchParams({ number, email })
  return apiFetch(`/orders/track?${params.toString()}`)
}

// ── SEPA Mandates ────────────────────────────────────────────────────────

export interface SEPAMandate {
  id: number
  status: 'pending_validation' | 'active' | 'revoked' | 'failed'
  iban_last4: string | null
  bank_name: string | null
  mandate_reference: string | null
  created_at: string
  validated_at: string | null
  revoked_at: string | null
}

export async function getSEPAMandates(): Promise<{ mandates: SEPAMandate[] }> {
  return apiFetch('/payments/sepa/mandates')
}

export async function createSEPASetupIntent(): Promise<{ client_secret: string; setup_intent_id: string }> {
  return apiFetch('/payments/sepa/setup-intent', { method: 'POST' })
}

export async function chargeSEPA(orderId: number): Promise<{ status: string; message: string }> {
  return apiFetch('/payments/sepa/charge', { method: 'POST', body: JSON.stringify({ order_id: orderId }) })
}

// ── SEPA documents (RIB, Kbis, mandate) ───────────────────────────

export interface SEPADocument {
  id: number
  mandate_id: number | null
  doc_type: 'rib' | 'kbis' | 'mandate' | 'other'
  original_name: string
  mime_type: string
  size: number
  created_at: string
}

export async function getSEPADocuments(): Promise<{ documents: SEPADocument[] }> {
  return apiFetch('/payments/sepa/documents')
}

export async function uploadSEPADocument(file: File, docType: string, mandateId?: number): Promise<{ id: number; message: string }> {
  const token = getToken()
  const form = new FormData()
  form.append('file', file)
  form.append('doc_type', docType)
  if (mandateId) form.append('mandate_id', String(mandateId))

  const res = await fetch(`${API_URL}/payments/sepa/documents`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || `HTTP ${res.status}`, res.status)
  return data
}

export async function deleteSEPADocument(id: number): Promise<{ message: string }> {
  return apiFetch(`/payments/sepa/documents/${id}`, { method: 'DELETE' })
}

// ── Product documents / resources (CDC §6.2) ──────────────────────

export interface ProductDocument {
  id: number
  product_id: number | null
  title: string
  doc_type: 'technical_sheet' | 'manual' | 'notice' | 'certificate' | 'other'
  original_name: string
  mime_type: string
  size: number
  requires_purchase: boolean
  product_title?: string
  created_at: string
}

export async function getMyDocuments(): Promise<{ documents: ProductDocument[]; has_purchases: boolean }> {
  return apiFetch('/customer/documents')
}

export function getDocumentDownloadUrl(docId: number): string {
  const token = getToken()
  return `${API_URL}/customer/documents/${docId}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`
}

// ── Invoice download ────────────────────────────────────────────────

export function getInvoiceUrl(orderId: number): string {
  const token = getToken()
  return `${API_URL}/orders/${orderId}/invoice${token ? `?token=${encodeURIComponent(token)}` : ''}`
}

// ── Account deletion (RGPD) ─────────────────────────────────────────

export async function deleteAccount(password: string): Promise<{ message: string }> {
  return apiFetch('/customer/auth/account', { method: 'POST', body: JSON.stringify({ password }) })
}

export async function requestErasure(reason?: string): Promise<{ message: string }> {
  return apiFetch('/customer/auth/erasure-request', { method: 'POST', body: JSON.stringify({ reason }) })
}

// ── Payment history ─────────────────────────────────────────────────

export async function getPaymentHistory(): Promise<{ orders: OrderSummary[] }> {
  return apiFetch('/orders')
}

// ── Helpers ──────────────────────────────────────────────────────────────

export function formatPrice(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100)
}

export function formatDate(s: string | null): string {
  if (!s) return '-'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateTime(s: string | null): string {
  if (!s) return '-'
  return new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: 'En attente de paiement',
  paid: 'Payée',
  processing: 'En traitement',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Non Payé',
  pending: 'En attente',
  paid: 'Payé',
  failed: 'Echoue',
  refunded: 'Rembourse',
  partially_refunded: 'Partiel. rembourse',
}
