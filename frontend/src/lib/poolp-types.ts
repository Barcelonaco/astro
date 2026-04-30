/**
 * Types frontend du configurateur POOLP — alignés sur les sorties de
 * PoolpComputeService côté backend (PHP).
 */

export type FiltreType = 'sable' | 'cartouche'
export type PompeType = 'mono' | 'variable'
export type Traitement =
  | 'aucun'
  | 'regul_ph'
  | 'electrolyse_ph'
  | 'electrolyse_ph_redox'
  | 'uv_oxygene'
export type ModeLivraison = 'kit' | 'montee'
export type BoxCode = 'S' | 'M' | 'L'

export interface PoolpInput {
  longueur: number
  largeur: number
  hauteur: number
  volet_immerge: boolean
  prise_balai: boolean
  projecteurs_led: 0 | 1 | 2
  bassin_couvert: boolean

  filtre?: FiltreType
  pompe?: PompeType
  traitement?: Traitement
  bypass_pac?: boolean

  finition_id?: number
  code_postal?: string
  mode_livraison?: ModeLivraison

  is_erp?: boolean
  box_override?: BoxCode | null
}

export interface PoolpHydraulic {
  surface: number
  volume: number
  debit: number
  nb_skimmers: number
  nb_bondes: number
  nb_refoulements: number
}

export interface PoolpBox {
  id: number
  code: BoxCode
  label: string
  slug: string
  volume_max: number
  debit: number
  diametre_canalisations: number
  surface_ext: number
  surface_utile: number
  taux_utile: number
  poids: number
  prix_base_ttc: number
  prix_base_pro_ht: number
  photo_url: string | null
  description: string | null
}

export interface PoolpEquipment {
  id: number
  label: string
  slug: string
  category: string | null
  slug_choice: string | null
  reference: string | null
  marque: string | null
  description: string | null
  icon: string | null
  prix_ttc: number
  prix_pro_ht: number
  photo_url: string | null
}

export interface PoolpFinition {
  id: number
  label: string
  color_label: string
  color_hex: string | null
  ral_ref: string | null
  prix_supplement_ttc: number
  prix_supplement_pro_ht: number
  preview_image: string | null
}

export interface PoolpDelivery {
  zone_id: number
  zone_label: string
  mode: ModeLivraison
  delay_label: string | null
  fee_ttc: number
  fee_pro_ht: number
  valid_until: string
  source: 'poolp' | 'ecommerce_fallback'
}

export interface PoolpTotals {
  ttc: number
  pro_ht_brut: number
  pro_ht_remise: number | null
  discount_rate: number
}

export interface PoolpComputed {
  hydraulic: PoolpHydraulic
  box: PoolpBox
  equipements: Record<string, PoolpEquipment>
  finition: PoolpFinition | null
  livraison: PoolpDelivery | null
  totaux: PoolpTotals
  excluded_boxes: BoxCode[]
  allowed_treatments: Traitement[]
  warnings: string[]
  is_pro?: boolean
  error?: string
}

export interface PoolpBootstrap {
  boxes: Array<{ id: number; title: string; custom_fields: Record<string, unknown> }>
  equipments: Array<{ id: number; title: string; custom_fields: Record<string, unknown> }>
  finitions: Array<{ id: number; title: string; custom_fields: Record<string, unknown> }>
  compositions: Array<{ id: number; title: string; custom_fields: Record<string, unknown> }>
  treatments: Traitement[]
}

export interface PoolpProject {
  token: string
  state: PoolpInput
  status: string
  is_erp: boolean
  qualif_pro_asked: boolean
  pdf_path: string | null
  created_at: string
  updated_at: string
  computed: PoolpComputed
}
