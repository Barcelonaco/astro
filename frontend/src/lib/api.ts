const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3000/api'

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

  // Check cache (only for GET requests, i.e. no body/method override)
  if (!options?.method && !options?.body) {
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
    if (!options?.method && !options?.body) {
      apiCache.set(endpoint, { data, expires: Date.now() + CACHE_TTL })
    }

    return data
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error)
    throw error
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
      frontPage: data.frontPage || null,
    }
  } catch {
    return {
      siteInfo: { siteName: '', siteDescription: '', frontPage: '' },
      styleSettings: {},
      siteSettings: {},
      navigation: [],
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

// Helper to format content (since it's now plain text/HTML from MySQL)
export function formatContent(content: string): string {
  if (!content) return ''

  // Replace line breaks with <br> tags
  return content.replace(/\n/g, '<br>')
}
