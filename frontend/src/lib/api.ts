const API_URL = import.meta.env.BUILD_API_URL || import.meta.env.PUBLIC_API_URL || 'http://localhost:3000/api'

/**
 * Origin used for media/upload URLs in built HTML.
 * BUILD_MEDIA_ORIGIN overrides so that a local build-time API (127.0.0.1)
 * doesn't leak into production pages.
 */
export const MEDIA_ORIGIN: string = import.meta.env.BUILD_MEDIA_ORIGIN
  || API_URL.replace(/\/api\/?$/, '')

export interface Post {
  id: number
  title: string
  slug: string
  excerpt: string
  content: string
  featured_image?: string
  author: {
    id: number
    name: string
  }
  categories?: Array<{
    id: number
    name: string
    slug?: string
  }>
  tags?: string[]
  published_date: string
  status: 'draft' | 'published'
  created_at: string
  updated_at: string
}

export interface Category {
  id: number
  name: string
  slug: string
  description?: string
  created_at: string
  updated_at: string
}

export interface Page {
  id: number
  title: string
  slug: string
  content: string
  color_overrides?: string
  status: 'draft' | 'published'
  show_in_menu: boolean
  menu_order: number
  parent_id?: number
  parent_title?: string
  parent_slug?: string
  created_at: string
  updated_at: string
}

export interface NavigationItem {
  id: number
  title: string
  slug: string
  menu_order: number
  parent_id?: number
  children?: NavigationItem[]
}

// In-memory cache for SSR API calls (avoids re-fetching on every page render)
const apiCache = new Map<string, { data: any; expires: number }>()
const CACHE_TTL = 30_000 // 30 seconds

async function fetchAPI(endpoint: string, options?: RequestInit) {
  const url = `${API_URL}${endpoint}`

  // Check cache (only for GET requests, skip for options endpoints)
  const useCache = !options?.method && !options?.body && !endpoint.includes('/options')
  if (useCache) {
    const cached = apiCache.get(endpoint)
    if (cached && cached.expires > Date.now()) {
      return cached.data
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()

    // Cache GET responses
    if (useCache) {
      apiCache.set(endpoint, { data, expires: Date.now() + CACHE_TTL })
    }

    return data
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error)
    return null
  }
}

export async function getAllPosts(): Promise<Post[]> {
  const data = await fetchAPI('/posts?status=published')
  return data || []
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const data = await fetchAPI(`/posts/${slug}`)
  return data || null
}

export async function getPostsByCategory(categorySlug: string): Promise<Post[]> {
  const data = await fetchAPI(`/posts?status=published&category=${categorySlug}`)
  return data || []
}

export async function getAllCategories(): Promise<Category[]> {
  const data = await fetchAPI('/categories')
  return data || []
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const data = await fetchAPI(`/categories/${slug}`)
  return data || null
}

export async function getAllPages(): Promise<Page[]> {
  const data = await fetchAPI('/pages')
  return data || []
}

export async function getPageBySlug(slug: string): Promise<Page | null> {
  const data = await fetchAPI(`/pages/${slug}`)
  return data || null
}

export async function getNavigation(): Promise<NavigationItem[]> {
  const data = await fetchAPI('/pages/navigation')
  return data || []
}

export async function getStyleSettings(): Promise<Record<string, string>> {
  try {
    const data = await fetchAPI('/settings/style')
    return data || {}
  } catch {
    return {}
  }
}

export interface FrontendBootstrap {
  siteInfo: SiteSettings
  styleSettings: Record<string, string>
  siteSettings: Record<string, string>
  navigation: NavigationItem[]
  secondaryNavigation: NavigationItem[]
  frontPage: Page | null
}

export async function getFrontendBootstrap(): Promise<FrontendBootstrap> {
  try {
    const data = await fetchAPI('/frontend-bootstrap')
    return {
      siteInfo: data.siteInfo || { siteName: '', siteDescription: '', frontPage: '' },
      styleSettings: data.styleSettings || {},
      siteSettings: data.siteSettings || {},
      navigation: data.navigation || [],
      secondaryNavigation: data.secondaryNavigation || [],
      frontPage: data.frontPage || null,
    }
  } catch {
    return {
      siteInfo: { siteName: '', siteDescription: '', frontPage: '' },
      styleSettings: {},
      siteSettings: {},
      navigation: [],
      secondaryNavigation: [],
      frontPage: null,
    }
  }
}

export interface ThemeSettings {
  useChildTheme: boolean
  activeTheme: string
}

export interface SiteSettings {
  siteName: string
  siteDescription: string
  frontPage: string
}

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const data = await fetchAPI('/settings/site')
    return {
      siteName: data.siteName || '',
      siteDescription: data.siteDescription || '',
      frontPage: data.frontPage || '',
    }
  } catch {
    return { siteName: '', siteDescription: '', frontPage: '' }
  }
}

export async function getThemeSettings(): Promise<ThemeSettings> {
  try {
    const data = await fetchAPI('/settings/theme')
    return {
      useChildTheme: data.useChildTheme ?? false,
      activeTheme: data.activeTheme || 'default'
    }
  } catch {
    return { useChildTheme: false, activeTheme: 'default' }
  }
}

export interface ReusableBloc {
  id: number
  title: string
  content: string
  status: 'draft' | 'published'
  created_at: string
  updated_at: string
}

export async function getReusableBlocById(id: number): Promise<ReusableBloc | null> {
  try {
    const data = await fetchAPI(`/reusable-blocs/${id}`)
    return data || null
  } catch {
    return null
  }
}

// ============ REFERENCES (CPT) ============

export interface ReferenceItem {
  id: number
  title: string
  slug: string
  excerpt: string
  content: string
  featured_image: Record<string, any> | null
  custom_fields: {
    customer_name?: string
    text?: string
    photos?: string
    link?: string
    project_url?: string
    year?: number
  }
  categories: Array<{ id: number; name: string; slug: string }>
  status: 'draft' | 'published'
  created_at: string
  updated_at: string
}

export interface ReferenceCategory {
  id: number
  name: string
  slug: string
}

export async function getReferences(options?: {
  status?: string
  category?: string
  limit?: number
  offset?: number
  order?: string
}): Promise<{ items: ReferenceItem[]; total: number } | ReferenceItem[]> {
  const params = new URLSearchParams()
  if (options?.status) params.set('status', options.status)
  if (options?.category) params.set('category', options.category)
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.offset) params.set('offset', String(options.offset))
  if (options?.order) params.set('order', options.order)
  const qs = params.toString()
  try {
    const data = await fetchAPI(`/cpt/references${qs ? '?' + qs : ''}`)
    return data || []
  } catch {
    return options?.limit ? { items: [], total: 0 } : []
  }
}

export async function getReferenceBySlug(slug: string): Promise<ReferenceItem | null> {
  try {
    const data = await fetchAPI(`/cpt/references/${slug}`)
    return data || null
  } catch {
    return null
  }
}

export async function getReferenceCategories(): Promise<ReferenceCategory[]> {
  try {
    const data = await fetchAPI('/cpt/references/categories')
    return data || []
  } catch {
    return []
  }
}

export async function getCPTOptions(postType: string): Promise<Record<string, string>> {
  try {
    const data = await fetchAPI(`/cpt/${postType}/options`)
    return data || {}
  } catch {
    return {}
  }
}

export interface GoogleReview {
  author_name: string
  author_url?: string
  profile_photo_url: string
  rating: number
  relative_time_description: string
  text: string
  time: number
}

export interface GoogleReviewsData {
  rating: number
  total: number
  reviews: GoogleReview[]
}

export async function getGoogleReviews(limit?: number, minRating?: number): Promise<GoogleReviewsData | null> {
  try {
    const params = new URLSearchParams()
    if (limit) params.set('limit', String(limit))
    if (minRating) params.set('min_rating', String(minRating))
    const qs = params.toString()
    const data = await fetchAPI(`/google-reviews${qs ? '?' + qs : ''}`)
    return data || null
  } catch {
    return null
  }
}

// ============ ACTUALITES (CPT) ============

export interface ActualiteItem {
  id: number
  title: string
  slug: string
  excerpt: string
  content: string
  featured_image: Record<string, any> | null
  custom_fields: Record<string, any>
  categories: Array<{ id: number; name: string; slug: string }>
  status: 'draft' | 'published'
  published_date: string
  created_at: string
  updated_at: string
}

export interface ActualiteCategory {
  id: number
  name: string
  slug: string
}

export async function getActualites(options?: {
  status?: string
  category?: string
  limit?: number
  offset?: number
}): Promise<{ items: ActualiteItem[]; total: number } | ActualiteItem[]> {
  const params = new URLSearchParams()
  if (options?.status) params.set('status', options.status)
  if (options?.category) params.set('category', options.category)
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.offset) params.set('offset', String(options.offset))
  const qs = params.toString()
  try {
    const data = await fetchAPI(`/cpt/actualites${qs ? '?' + qs : ''}`)
    return data || []
  } catch {
    return options?.limit ? { items: [], total: 0 } : []
  }
}

export async function getActualiteBySlug(slug: string): Promise<ActualiteItem | null> {
  try {
    const data = await fetchAPI(`/cpt/actualites/${slug}`)
    return data || null
  } catch {
    return null
  }
}

export async function getActualiteCategories(): Promise<ActualiteCategory[]> {
  try {
    const data = await fetchAPI('/cpt/actualites/categories')
    return data || []
  } catch {
    return []
  }
}

// ============ EVENEMENTS (CPT) ============

export interface EvenementItem {
  id: number
  title: string
  slug: string
  excerpt: string
  content: string
  featured_image: Record<string, any> | null
  custom_fields: {
    is_sticky?: boolean | string
    sold_out?: boolean | string
    cta?: string
    desc?: string
    text?: string
    start_date?: string
    end_date?: string
    start_time?: string
    end_time?: string
    contact_name?: string
    contact_phone?: string
    contact_email?: string
    website?: string
    price?: string
    location_name?: string
    location?: string
  }
  categories: Array<{ id: number; name: string; slug: string }>
  status: 'draft' | 'published'
  published_date: string
  created_at: string
  updated_at: string
}

export interface EvenementCategory {
  id: number
  name: string
  slug: string
}

export async function getEvenements(options?: {
  status?: string
  category?: string
  limit?: number
  offset?: number
}): Promise<{ items: EvenementItem[]; total: number } | EvenementItem[]> {
  const params = new URLSearchParams()
  if (options?.status) params.set('status', options.status)
  if (options?.category) params.set('category', options.category)
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.offset) params.set('offset', String(options.offset))
  const qs = params.toString()
  try {
    const data = await fetchAPI(`/cpt/evenements${qs ? '?' + qs : ''}`)
    return data || []
  } catch {
    return options?.limit ? { items: [], total: 0 } : []
  }
}

export async function getEvenementBySlug(slug: string): Promise<EvenementItem | null> {
  try {
    const data = await fetchAPI(`/cpt/evenements/${slug}`)
    return data || null
  } catch {
    return null
  }
}

export async function getEvenementCategories(): Promise<EvenementCategory[]> {
  try {
    const data = await fetchAPI('/cpt/evenements/categories')
    return data || []
  } catch {
    return []
  }
}

// ── Search ──
export interface SearchResult {
  id: number
  title: string
  slug: string
  excerpt: string
  featured_image: string | { url?: string; sizes?: Record<string, string> } | null
  published_date: string
  result_type: string
  base_url: string
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  query: string
}

export async function searchSite(query: string, limit = 20, offset = 0): Promise<SearchResponse> {
  const data = await fetchAPI(`/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`)
  return data || { results: [], total: 0, query }
}

// Helper to format content (since it's now plain text/HTML from MySQL)
export function formatContent(content: string): string {
  if (!content) return ''

  // Replace line breaks with <br> tags
  return content.replace(/\n/g, '<br>')
}
