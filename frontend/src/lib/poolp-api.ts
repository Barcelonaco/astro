/**
 * Client API pour le configurateur POOLP.
 *
 * Convention identique à lib/api.ts : try/catch interne, jamais de throw côté
 * caller — retourne null/[] en cas d'échec, log dans la console.
 */

import type {
  PoolpInput,
  PoolpComputed,
  PoolpBootstrap,
  PoolpProject,
} from './poolp-types'

const API_URL =
  import.meta.env.BUILD_API_URL ||
  import.meta.env.PUBLIC_API_URL ||
  'http://localhost:3000/api'

/**
 * Vérifie que le plugin est actif sur ce site. Utilisé en SSR par la page
 * configurateur.astro pour afficher un 404 si le plugin n'est pas présent
 * (cas des sites où POOLP n'est pas déployé).
 */
export async function isPoolpPluginActive(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/plugins/active`, {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) return false
    const data = await res.json()
    const list = data.plugins || data || []
    return Array.isArray(list) && list.some((p: { name?: string }) => p?.name === 'poolp-configurator')
  } catch (err) {
    console.error('isPoolpPluginActive failed', err)
    return false
  }
}

export async function getPoolpBootstrap(): Promise<PoolpBootstrap | null> {
  try {
    const res = await fetch(`${API_URL}/poolp/bootstrap`)
    if (!res.ok) return null
    return (await res.json()) as PoolpBootstrap
  } catch (err) {
    console.error('getPoolpBootstrap failed', err)
    return null
  }
}

export async function computePoolp(
  input: PoolpInput,
  authToken?: string,
): Promise<PoolpComputed | null> {
  try {
    const res = await fetch(`${API_URL}/poolp/compute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(input),
    })
    const data = await res.json()
    return data as PoolpComputed
  } catch (err) {
    console.error('computePoolp failed', err)
    return null
  }
}

export async function saveProject(
  state: PoolpInput,
  customerEmail?: string,
  authToken?: string,
): Promise<{ token: string; id: number } | null> {
  try {
    const res = await fetch(`${API_URL}/poolp/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ state, customer_email: customerEmail }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.error('saveProject failed', err)
    return null
  }
}

export async function getProject(token: string): Promise<PoolpProject | null> {
  try {
    const res = await fetch(`${API_URL}/poolp/projects/${token}`)
    if (!res.ok) return null
    return (await res.json()) as PoolpProject
  } catch (err) {
    console.error('getProject failed', err)
    return null
  }
}

export async function updateProject(
  token: string,
  patch: Partial<{ state: PoolpInput; is_erp: boolean; status: string }>,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/poolp/projects/${token}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    return res.ok
  } catch (err) {
    console.error('updateProject failed', err)
    return false
  }
}

export async function exportProjectPdf(token: string): Promise<{ url: string } | null> {
  try {
    const res = await fetch(`${API_URL}/poolp/projects/${token}/pdf`, {
      method: 'POST',
    })
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.error('exportProjectPdf failed', err)
    return null
  }
}

export async function addProjectToCart(
  token: string,
): Promise<{ ok: boolean; cart_token?: string } | null> {
  try {
    const cartToken = typeof window !== 'undefined' ? localStorage.getItem('shop_cart_token') : null
    const auth = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (cartToken) headers['X-Cart-Token'] = cartToken
    if (auth) headers['Authorization'] = `Bearer ${auth}`
    const res = await fetch(`${API_URL}/poolp/projects/${token}/cart`, {
      method: 'POST',
      headers,
    })
    if (!res.ok) return null
    const newToken = res.headers.get('X-Cart-Token')
    if (newToken && typeof window !== 'undefined') localStorage.setItem('shop_cart_token', newToken)
    const data = await res.json()
    if (data?.cart_token && typeof window !== 'undefined') localStorage.setItem('shop_cart_token', data.cart_token)
    return data
  } catch (err) {
    console.error('addProjectToCart failed', err)
    return null
  }
}

export { API_URL }
