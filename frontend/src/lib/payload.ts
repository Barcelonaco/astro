const PAYLOAD_API_URL = import.meta.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000/api'

export interface Post {
  id: string
  title: string
  slug: string
  excerpt: string
  content: any
  featuredImage?: {
    url: string
    alt: string
  }
  author: {
    name: string
  }
  categories?: Array<{
    name: string
    slug: string
  }>
  tags?: Array<{ tag: string }>
  publishedDate: string
  status: 'draft' | 'published'
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
}

export interface Page {
  id: string
  title: string
  slug: string
  content: any
  status: 'draft' | 'published'
}

export interface Settings {
  siteName: string
  siteDescription: string
  logo?: {
    url: string
    alt: string
  }
  footer?: any
  socialLinks?: Array<{
    platform: string
    url: string
  }>
}

async function fetchAPI(endpoint: string, options?: RequestInit) {
  const url = `${PAYLOAD_API_URL}${endpoint}`

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

    return await response.json()
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error)
    throw error
  }
}

export async function getAllPosts(): Promise<Post[]> {
  const data = await fetchAPI('/posts?where[status][equals]=published&sort=-publishedDate')
  return data.docs || []
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const data = await fetchAPI(`/posts?where[slug][equals]=${slug}&where[status][equals]=published`)
  return data.docs?.[0] || null
}

export async function getPostsByCategory(categorySlug: string): Promise<Post[]> {
  const data = await fetchAPI(
    `/posts?where[categories.slug][equals]=${categorySlug}&where[status][equals]=published&sort=-publishedDate`
  )
  return data.docs || []
}

export async function getAllCategories(): Promise<Category[]> {
  const data = await fetchAPI('/categories')
  return data.docs || []
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const data = await fetchAPI(`/categories?where[slug][equals]=${slug}`)
  return data.docs?.[0] || null
}

export async function getPageBySlug(slug: string): Promise<Page | null> {
  const data = await fetchAPI(`/pages?where[slug][equals]=${slug}&where[status][equals]=published`)
  return data.docs?.[0] || null
}

export async function getSettings(): Promise<Settings> {
  const data = await fetchAPI('/globals/settings')
  return data
}

// Helper function to render rich text content
export function renderRichText(content: any): string {
  if (!content) return ''

  // Simple rich text renderer for Slate format
  // You may want to use a proper renderer library like @payloadcms/richtext-slate-to-html
  if (Array.isArray(content)) {
    return content
      .map((node) => {
        if (node.type === 'h1') return `<h1>${node.children.map((c: any) => c.text).join('')}</h1>`
        if (node.type === 'h2') return `<h2>${node.children.map((c: any) => c.text).join('')}</h2>`
        if (node.type === 'h3') return `<h3>${node.children.map((c: any) => c.text).join('')}</h3>`
        if (node.type === 'ul') {
          return `<ul>${node.children
            .map((li: any) => `<li>${li.children.map((c: any) => c.text).join('')}</li>`)
            .join('')}</ul>`
        }
        if (node.type === 'ol') {
          return `<ol>${node.children
            .map((li: any) => `<li>${li.children.map((c: any) => c.text).join('')}</li>`)
            .join('')}</ol>`
        }
        if (node.type === 'link') {
          return `<a href="${node.url}">${node.children.map((c: any) => c.text).join('')}</a>`
        }
        // Default paragraph
        return `<p>${node.children?.map((c: any) => {
          let text = c.text || ''
          if (c.bold) text = `<strong>${text}</strong>`
          if (c.italic) text = `<em>${text}</em>`
          if (c.code) text = `<code>${text}</code>`
          return text
        }).join('') || ''}</p>`
      })
      .join('')
  }

  return String(content)
}
