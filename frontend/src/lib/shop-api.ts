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
