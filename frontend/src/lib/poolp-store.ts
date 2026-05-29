/**
 * Store réactif minimal pour le wizard POOLP — pattern publish/subscribe sans
 * framework, conforme à la philosophie du repo (cf. BeforeAfter.astro).
 *
 * - State persisté dans localStorage à chaque mutation.
 * - computePoolp() debouncé (300ms) à chaque update du state input.
 * - Multi-instance safe : exposé sur window.__poolpStore.
 */

import type { PoolpInput, PoolpComputed } from './poolp-types'
import { computePoolp } from './poolp-api'

export type WizardStep = 1 | 3 | 4 | 5 | 6 | 7

export interface PoolpState {
  step: WizardStep
  input: PoolpInput
  computed: PoolpComputed | null
  isPro: boolean
  projectToken: string | null
}

const LS_KEY = 'poolp:wizard:v2'

const defaultInput: PoolpInput = {
  longueur: 8,
  largeur: 4,
  hauteur: 1.5,
  volet_immerge: false,
  prise_balai: false,
  projecteurs_led: 0,
  bassin_couvert: false,
  filtre: 'sable',
  pompe: 'variable',
  traitement: 'electrolyse_ph',
  bypass_pac: false,
  finition_id: 0,
  code_postal: '',
  mode_livraison: 'montee',
  is_erp: false,
}

let state: PoolpState = {
  step: 1,
  input: { ...defaultInput },
  computed: null,
  isPro: false,
  projectToken: null,
}

const subscribers = new Set<(s: PoolpState) => void>()

function persist(): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ input: state.input, step: state.step, projectToken: state.projectToken }))
  } catch {}
}

function restore(): void {
  try {
    // Sweep older versions to free quota
    try { localStorage.removeItem('poolp:wizard:v1') } catch {}

    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return

    const stored = (data.input || {}) as Record<string, unknown>
    const merged: Record<string, unknown> = { ...defaultInput }
    // Coerce types defensively : prevents stale localStorage from sending
    // strings/empty values to the compute API (which validates strictly).
    const numericKeys = ['longueur', 'largeur', 'hauteur', 'finition_id', 'projecteurs_led']
    const stringKeys = ['filtre', 'pompe', 'traitement', 'mode_livraison', 'code_postal']
    const boolKeys = ['volet_immerge', 'prise_balai', 'bassin_couvert', 'bypass_pac', 'is_erp']

    for (const k of Object.keys(stored)) {
      const v = stored[k]
      if (numericKeys.includes(k)) {
        const n = typeof v === 'number' ? v : parseFloat(String(v))
        if (Number.isFinite(n) && n > 0) merged[k] = n
        else if (k === 'finition_id' || k === 'projecteurs_led') merged[k] = Number.isFinite(n) ? n : 0
      } else if (stringKeys.includes(k)) {
        if (typeof v === 'string') merged[k] = v
      } else if (boolKeys.includes(k)) {
        merged[k] = Boolean(v)
      } else {
        merged[k] = v
      }
    }
    state.input = merged as PoolpInput
    if (data.step) state.step = data.step
    if (data.projectToken) state.projectToken = data.projectToken
  } catch {}
}

function notify(): void {
  subscribers.forEach(fn => fn(state))
}

export function subscribe(fn: (s: PoolpState) => void): () => void {
  subscribers.add(fn)
  fn(state)
  return () => subscribers.delete(fn)
}

export function getState(): PoolpState {
  return state
}

export function setStep(step: WizardStep): void {
  state.step = step
  persist()
  notify()
}

let computeTimer: number | null = null

export function updateInput(patch: Partial<PoolpInput>): void {
  state.input = { ...state.input, ...patch }
  persist()
  notify()
  // Debounced compute
  if (computeTimer) window.clearTimeout(computeTimer)
  computeTimer = window.setTimeout(() => {
    void runCompute()
  }, 300)
}

export async function runCompute(): Promise<void> {
  // Skip if dimensions are not valid yet — avoids hitting the API with
  // invalid input and getting a 400 (CDC requires positive numeric L/l/h).
  const { longueur, largeur, hauteur } = state.input
  if (!(longueur > 0) || !(largeur > 0) || !(hauteur > 0)) {
    state.computed = null
    notify()
    return
  }
  const result = await computePoolp(state.input)
  state.computed = result
  notify()
}

export function setProjectToken(token: string | null): void {
  state.projectToken = token
  persist()
  notify()
}

export function setIsPro(isPro: boolean): void {
  state.isPro = isPro
  notify()
}

export function reset(): void {
  state = {
    step: 1,
    input: { ...defaultInput },
    computed: null,
    isPro: false,
    projectToken: null,
  }
  try { localStorage.removeItem(LS_KEY) } catch {}
  notify()
}

// Initialise le store côté client uniquement
if (typeof window !== 'undefined') {
  restore()
  ;(window as unknown as { __poolpStore: unknown }).__poolpStore = {
    getState, subscribe, setStep, updateInput, runCompute, setProjectToken, setIsPro, reset,
  }
  // Compute initial après restore
  void runCompute()
}
