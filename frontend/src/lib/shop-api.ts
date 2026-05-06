/**
 * Shop API client — interroge le backend e-commerce.
 * Pattern cohérent avec lib/api.ts (fetch + cache + fallback).
 */

const API_URL = import.meta.env.BUILD_API_URL || import.meta.env.PUBLIC_API_URL || 'http://localhost:3000/api'

export interface ShopMediaImage {
  id: number | null
  url: string | null
  alt: string
  width: number | null
  height: number | null
  mime_type: string | null
}

export interface ProductVariant {
  id: number
  product_id: number
  sku: string
  attributes: Record<string, string>
  price_cents: number
  compare_at_price_cents: number | null
  weight_grams: number | null
  stock_quantity: number
  stock_managed: boolean
  low_stock_threshold: number | null
  position: number
}

export interface ProductCategoryLite {
  id: number
  name: string
  slug: string
  path: string
  parent_id: number | null
  level: number
}

export interface ProductSummary {
  id: number
  title: string
  slug: string
  excerpt: string | null
  featured_image: any
  status: 'published' | 'draft'
  published_date: string | null
  type: 'physical' | 'digital' | 'service'
  tax_code: string
  is_featured: boolean
  requires_shipping: boolean
  short_features: Array<{ label: string; value: string }>
  price_cents_min: number
  price_cents_max: number
  compare_at_price_cents: number | null
  has_variants: boolean
  in_stock: boolean
  currency: string
  categories: ProductCategoryLite[]
}

export interface ProductDetail extends ProductSummary {
  content: string | null
  custom_fields: Record<string, any>
  seo_meta: any
  variants: ProductVariant[]
  gallery: Array<ProductVariant & ShopMediaImage & { variant_id: number | null }>
  breadcrumb: Array<{ id: number; name: string; slug: string; path: string }>
  related?: ProductSummary[]
}

export interface ProductCategoryNode extends ProductCategoryLite {
  description: string | null
  featured_image: any
  seo_meta: any
  position: number
  product_count?: number
  children?: ProductCategoryNode[]
  breadcrumb?: Array<{ id: number; name: string; slug: string; path: string }>
}

export interface ProductListResult {
  data: ProductSummary[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface ProductFacets {
  total: number
  price: { min: number; max: number }
  attributes: Array<{ name: string; options: Array<{ value: string; count: number }> }>
  categories: Array<{ id: number; name: string; slug: string; path: string; parent_id: number | null; count: number }>
}

export interface ProductListFilters {
  category?: string
  categories?: string[]
  search?: string
  min_price?: number
  max_price?: number
  in_stock?: boolean
  on_sale?: boolean
  type?: 'physical' | 'digital' | 'service'
  attributes?: Record<string, string>
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc' | 'popularity'
  page?: number
  per_page?: number
  include_subcategories?: boolean
}

function buildQuery(filters: ProductListFilters): string {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', filters.category)
  if (filters.categories?.length) params.set('categories', filters.categories.join(','))
  if (filters.search) params.set('search', filters.search)
  if (filters.min_price !== undefined) params.set('min_price', String(filters.min_price))
  if (filters.max_price !== undefined) params.set('max_price', String(filters.max_price))
  if (filters.in_stock) params.set('in_stock', '1')
  if (filters.on_sale) params.set('on_sale', '1')
  if (filters.type) params.set('type', filters.type)
  if (filters.attributes) {
    for (const [k, v] of Object.entries(filters.attributes)) {
      params.append(`attributes[${k}]`, v)
    }
  }
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.per_page) params.set('per_page', String(filters.per_page))
  if (filters.include_subcategories === false) params.set('include_subcategories', '0')
  const s = params.toString()
  return s ? '?' + s : ''
}

async function shopFetch<T>(endpoint: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${endpoint}`)
    if (!res.ok) return fallback
    return await res.json()
  } catch (err) {
    console.error(`Shop API error (${endpoint}):`, err)
    return fallback
  }
}

export async function listProducts(filters: ProductListFilters = {}): Promise<ProductListResult> {
  return shopFetch(`/shop/products${buildQuery(filters)}`, {
    data: [], total: 0, page: 1, per_page: 24, pages: 0,
  })
}

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  return shopFetch(`/shop/products/${encodeURIComponent(slug)}`, null as ProductDetail | null)
}

export async function getProductVariants(slug: string): Promise<ProductVariant[]> {
  return shopFetch(`/shop/products/${encodeURIComponent(slug)}/variants`, [])
}

export async function getShopFacets(filters: ProductListFilters = {}): Promise<ProductFacets> {
  return shopFetch(`/shop/products/facets${buildQuery(filters)}`, {
    total: 0, price: { min: 0, max: 0 }, attributes: [], categories: [],
  })
}

export async function getCategoryTree(withCounts = true): Promise<ProductCategoryNode[]> {
  const q = new URLSearchParams({ tree: '1' })
  if (withCounts) q.set('counts', '1')
  return shopFetch(`/shop/categories?${q.toString()}`, [])
}

export async function getAllCategories(): Promise<ProductCategoryNode[]> {
  return shopFetch(`/shop/categories`, [])
}

export async function getCategoryBySlug(slug: string): Promise<ProductCategoryNode | null> {
  return shopFetch(`/shop/categories/${encodeURIComponent(slug)}`, null as ProductCategoryNode | null)
}

export async function getCategoryByPath(path: string): Promise<ProductCategoryNode | null> {
  const q = new URLSearchParams({ path })
  return shopFetch(`/shop/categories/by-path?${q.toString()}`, null as ProductCategoryNode | null)
}

/** Formatage monétaire FR. Les prix backend sont en cents. */
export function formatPrice(cents: number, currency = 'EUR'): string {
  const amount = cents / 100
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount)
}

// ─── Cart ────────────────────────────────────────────────────────────────────

const CART_TOKEN_KEY = 'shop_cart_token'
const CART_AUTH_KEY = 'customer_token'

export interface CartItem {
  id: number
  kind: 'product' | 'custom'
  product_id?: number
  product_slug?: string
  product_title?: string
  variant_id?: number
  sku?: string
  attributes?: Record<string, string>
  quantity: number
  unit_price_cents: number
  line_total_cents: number
  weight_grams?: number | null
  tax_code?: string
  is_digital?: boolean
  requires_shipping?: boolean
  featured_image?: any
  source_type?: string
  source_id?: number | null
  title?: string
  config_snapshot?: any
  unit_price_pro_ht_cents?: number | null
}

export interface Cart {
  id: number | null
  token: string | null
  customer_id?: number | null
  currency: string
  coupon_code: string | null
  shipping_method_id?: number | null
  items: CartItem[]
  custom_items: CartItem[]
  subtotal_cents: number
  tax_cents: number
  total_cents: number
  tax_breakdown: Record<string, number>
  items_count: number
}

export interface ShippingRate {
  method_id: number
  zone_id: number
  zone_name: string
  name: string
  description: string | null
  type: 'flat' | 'free' | 'weight' | 'price'
  price_cents: number
  tax_code: string | null
  delivery_min_days: number | null
  delivery_max_days: number | null
}

export interface OrderItem {
  id: number
  product_id: number
  variant_id: number
  sku: string
  product_title: string
  variant_attributes: Record<string, any>
  quantity: number
  unit_price_cents: number
  tax_rate: string | number
  line_subtotal_cents: number
  line_tax_cents: number
  line_total_cents: number
  is_digital: number | boolean
  requires_shipping: number | boolean
}

export interface OrderAddress {
  type: 'billing' | 'shipping'
  first_name: string | null
  last_name: string | null
  company: string | null
  address_line1: string | null
  address_line2: string | null
  postcode: string | null
  city: string | null
  region: string | null
  country_code: string | null
  phone: string | null
  email: string | null
  vat_number: string | null
}

export interface Order {
  id: number
  order_number: string
  customer_id: number | null
  email: string
  status: string
  payment_status: string
  payment_method: string
  currency: string
  subtotal_cents: number
  discount_cents: number
  shipping_cents: number
  tax_cents: number
  total_cents: number
  tax_breakdown: Record<string, number>
  coupon_code: string | null
  shipping_method_id: number | null
  shipping_method_label: string | null
  notes: string | null
  placed_at: string
  paid_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  guest_token: string | null
  items: OrderItem[]
  billing_address: OrderAddress | null
  shipping_address: OrderAddress | null
}

function getCartToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(CART_TOKEN_KEY)
}

function setCartToken(t: string | null): void {
  if (typeof window === 'undefined') return
  if (t) localStorage.setItem(CART_TOKEN_KEY, t)
  else localStorage.removeItem(CART_TOKEN_KEY)
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(CART_AUTH_KEY)
}

function shopHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra }
  const token = getCartToken()
  if (token) headers['X-Cart-Token'] = token
  const auth = getAuthToken()
  if (auth) headers['Authorization'] = `Bearer ${auth}`
  return headers
}

async function shopRequest<T>(method: string, path: string, body?: any): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: shopHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    })
    const newToken = res.headers.get('X-Cart-Token')
    if (newToken) setCartToken(newToken)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur serveur' }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return await res.json()
  } catch (err) {
    console.error(`Shop request ${method} ${path}:`, err)
    throw err
  }
}

export async function getCart(): Promise<Cart> {
  const c = await shopRequest<Cart>('GET', '/cart')
  return c || emptyCart()
}

export async function addCartItem(variantId: number, quantity = 1): Promise<Cart> {
  return (await shopRequest<Cart>('POST', '/cart/items', { variant_id: variantId, quantity }))!
}

export async function updateCartItem(itemId: number, quantity: number): Promise<Cart> {
  return (await shopRequest<Cart>('PUT', `/cart/items/${itemId}`, { quantity }))!
}

export async function removeCartItem(itemId: number): Promise<Cart> {
  return (await shopRequest<Cart>('DELETE', `/cart/items/${itemId}`))!
}

export async function removeCustomCartItem(itemId: number): Promise<Cart> {
  return (await shopRequest<Cart>('DELETE', `/cart/items/custom/${itemId}`))!
}

export async function clearCart(): Promise<Cart> {
  return (await shopRequest<Cart>('DELETE', '/cart'))!
}

export async function getShippingRates(postcode: string, country = 'FR'): Promise<ShippingRate[]> {
  const token = getCartToken() || ''
  const q = new URLSearchParams({ postcode, country })
  if (token) q.set('cart_token', token)
  const res = await shopRequest<{ rates: ShippingRate[] }>('GET', `/shop/shipping-rates?${q.toString()}`)
  return res?.rates || []
}

export interface CheckoutPayload {
  billing: Partial<OrderAddress>
  shipping?: Partial<OrderAddress>
  shipping_method_id: number
  payment_method: 'stripe' | 'paypal' | 'bank_transfer' | 'on_invoice'
  notes?: string
}

export async function createOrder(payload: CheckoutPayload): Promise<Order> {
  const order = await shopRequest<Order>('POST', '/orders', payload)
  setCartToken(null)
  return order!
}

export async function getOrder(id: number, guestToken?: string): Promise<Order> {
  const q = guestToken ? `?guest_token=${encodeURIComponent(guestToken)}` : ''
  return (await shopRequest<Order>('GET', `/orders/${id}${q}`))!
}

export async function getOrderByNumber(number: string, guestToken?: string): Promise<Order> {
  const q = guestToken ? `?guest_token=${encodeURIComponent(guestToken)}` : ''
  return (await shopRequest<Order>('GET', `/orders/by-number/${encodeURIComponent(number)}${q}`))!
}

export async function listMyOrders(): Promise<Order[]> {
  const res = await shopRequest<{ orders: Order[] }>('GET', '/orders')
  return res?.orders || []
}

export function emptyCart(): Cart {
  return {
    id: null, token: null, currency: 'EUR', coupon_code: null,
    items: [], custom_items: [],
    subtotal_cents: 0, tax_cents: 0, total_cents: 0, tax_breakdown: {}, items_count: 0,
  }
}

export { getCartToken, setCartToken }
