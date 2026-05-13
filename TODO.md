# TODO POOLP — État vs Cahier des Charges v1.2

Audit projet POOLP (cahier 8 sem, livraison 01/06/2026) — MAJ 2026-05-12. Source : `plugins/poolp-configurator/`, `frontend/src/components/poolp/`, `backend-php/`, `plugins/ecommerce/`.

---

## ✅ FAIT

### Configurateur (cœur métier — CDC §3)
- [x] Plugin `poolp-configurator` site-spécifique (chargé via `EXTERNAL_PLUGINS_DIR`)
- [x] 4 CPT : `poolp_boxes`, `poolp_equipments`, `poolp_finitions`, `poolp_compositions`
- [x] **Moteur PHP `PoolpComputeService`** (pure, 558 lignes)
  - [x] Validation inputs, calculs hydrauliques, exclusions box, traitements, sélection auto
  - [x] Coffret programmation déduit pompe, finition, logistique CP→zone, totaux TTC/HT pro
  - [x] Avertissements triphasé + ERP
- [x] **30 tests unitaires PHPUnit** (`PoolpComputeServiceTest.php`)
- [x] Endpoints API complets : compute, bootstrap, delivery-zones, projets CRUD, qualify, exportPdf, addToCart
- [x] Endpoints admin : zones livraison + projets + compositions
- [x] Seeds boxes S/M/L + équipements + finitions RAL (`seeds/packs-filtration.json`)
- [x] Seeds compositions matrice 3×2×2 = 12 entrées (`seeds/compositions.json`)
- [x] Seeds zones livraison par CP (`seeds/delivery-zones.json`)

### Frontend configurateur (CDC §3.2)
- [x] Page `/configurateur.astro` + Wizard 7 étapes
- [x] Store client `poolp-store.ts` + Client API `poolp-api.ts` + Restore via `?p=<token>`
- [x] Boutons step 7 : Sauvegarder · Ajouter panier · Exporter PDF · Connexion/Inscription pro
- [x] **Modal qualification pro** avant sauvegarde/ajout panier (`qualif_pro_asked` persisté)
- [x] **Warnings dédiés ERP + triphasé** avec blocs séparés + CTA contact
- [x] Page `/inscription-pro.astro`

### Back-office configurateur (CDC §7)
- [x] Mini-admin HTML : zones livraison, matrice compositions, projets sauvegardés
- [x] CRUD CPT poolp_* via interface CMS standard
- [x] Options plugin : TVA, fallback ecom, remise pro défaut, validité transport, toggle warnings

### PDF (CDC §3.2 étape 7)
- [x] Endpoint `POST /poolp/projects/:token/pdf` avec Dompdf + fallback HTML
- [x] `composer require dompdf/dompdf` installé côté backend-php

### Comptes clients (CDC §6.1 + §6.2)
- [x] Schema `customers` (avec `is_pro`, `pro_status`, `siret`, `company`, `activity`, `discount_rate`, `discount_override`, `pro_tier`)
- [x] Endpoints `/customer/auth/{register,login,logout,me,profile,forgot-password,reset-password}`
- [x] Endpoints `/customer/addresses` CRUD
- [x] **Pages espace client** : `/compte/connexion`, `/compte` dashboard, `/compte/profil`, `/compte/adresses`, `/compte/paiement`, `/compte/commandes`, `/compte/commandes/detail`, `/compte/telechargements`
- [x] Navigation compte (`AccountNav.astro`)

### E-commerce complet (CDC §4)
- [x] Migration 40+ tables : customers, carts, cart_items, cart_items_custom, orders, order_items, invoices, payment_intents, shipping_zones, shipping_methods, tax_rates, coupons, sepa_mandates, audit_log, tokens, stock_holds, etc.
- [x] Plugin `ecommerce` v1.1.0 avec CPT `products` (39 custom fields, types simple/variable/external/grouped)
- [x] Pages boutique : `/boutique/`, `/boutique/categorie/[...slug]`, `/produits/[slug]`
- [x] Composants : ProductCard, ProductGrid, FilterSidebar, AddToCartButton, PriceDisplay, VariantSelector, Pagination, SortDropdown, Breadcrumb
- [x] **Affichage prix double niveau** : TTC public + HT remisé pro (PriceDisplay.astro + pro-prices.ts client-side)
- [x] Page `/panier` — listing items + custom_items, qty, suppression, totaux TTC
- [x] Page `/checkout` 5 étapes avec Stripe Elements wired
- [x] Page `/commande/confirmation` — récap + retry Stripe
- [x] Pages légales : `/cgv`, `/mentions-legales`, `/politique-confidentialite`

### Panier & commandes
- [x] CartController : CRUD items, custom items (avec `subtitle` dynamique, découplé POOLP), coupons
- [x] OrderController : create, listMine, getById, getByNumber, track (rate-limited)
- [x] Snapshot complet panier → order_items avec calcul TVA incluse
- [x] **Découplage POOLP** : plus de label hardcodé, `subtitle` dynamique côté API

### Stripe CB (CDC §5.3)
- [x] Stripe PaymentIntent + webhook complet (succeeded, failed, canceled, refunded)
- [x] 1ère commande CB obligatoire (gate OrderController)
- [x] Clés Stripe chiffrées AES-256-CBC (test/live séparés)
- [x] UI admin paramétrage Stripe

### Stripe SEPA Direct Debit (CDC §5.3)
- [x] SEPAController complet : SetupIntent, listMandates, charge off-session
- [x] Gate : pro approved + ≥1 commande payée
- [x] Webhook `setup_intent.succeeded` → mandat enregistré
- [x] Admin : list/validate mandates (status active/revoked)

### Statuts pros + remises (CDC §5.1)
- [x] **ProTierService.php** : calcul CA payé glissant 365j, mapping tier→discount_rate
- [x] Barème paramétrable via settings JSON (`ecommerce_pro_tiers`) — défaut Bronze/Argent/Or/Platine
- [x] Recalcul auto sur `payment_succeeded` webhook + batch admin (`POST /admin/pro-tiers/recalc`)
- [x] Override manuel (`discount_override` flag, skip recalc)
- [x] Admin BO : page barème pros (édition tiers + preview + recalc)
- [x] Colonne `pro_tier` sur table customers

### Factures PDF (CDC §4)
- [x] **InvoiceController.php** : génération, numérotation auto `FA-YYYY-NNNNN`, template HTML A4
- [x] Auto-génération sur `payment_succeeded` webhook
- [x] Téléchargement client (`GET /orders/:id/invoice`) + admin (`GET /admin/invoices/:id/pdf`)
- [x] Admin page factures (liste + recherche + download + génération manuelle)
- [x] Dompdf installé (fallback HTML si absent)

### Notifications email (CDC §6.4)
- [x] Resend API + service OrderMailer complet
- [x] Templates : confirmation commande, notif admin, expédition, remboursement (client+admin), changement statut
- [x] **Email bienvenue** sur inscription (avec note pro pending si applicable)
- [x] **Email projet sauvegardé** avec lien de reprise (`sendProjectSaved`)
- [x] **Email rappel échéance SEPA** (`sendSepaReminder`)
- [x] **Email récap atelier** (`sendWorkshopRecap`)
- [x] Destinataires admin configurables

### Admin e-commerce (8 pages)
- [x] Commandes : liste/détail/recherche/statut/remboursement/notes
- [x] Clients : liste/détail/pro_status/discount_rate/override
- [x] Paramètres : Stripe config (test/live), emails, devise
- [x] Zones livraison : CRUD zones + méthodes (flat/free/weight/price)
- [x] Taux TVA : CRUD tax_rates
- [x] Coupons : CRUD coupons (%, montant, livraison gratuite)
- [x] **Barème pros** : édition tiers + preview CA/tier + recalc batch
- [x] **Factures** : liste + recherche + download PDF + génération manuelle

### Admin endpoints complets
- [x] Shipping zones + methods CRUD
- [x] Tax rates CRUD
- [x] Coupons CRUD
- [x] Orders list/detail/update/refund/stats
- [x] Customers list/detail/update/stats
- [x] Pro tiers get/update/recalc/preview
- [x] Invoices list/generate/download
- [x] Product variants + categories + stock

### SEO
- [x] Sitemap.xml via `@astrojs/sitemap`
- [x] Robots.txt auto-généré
- [x] Canonical URLs
- [x] OpenGraph + Twitter Cards
- [x] JSON-LD Schema.org (produits + pages)

### Données de seed (POOLP + boutique)
- [x] Boxes S/M/L avec prix TTC/HT pro
- [x] Équipements Flowdians complets (filtres, pompes, coffrets, traitements, bypass, extension)
- [x] Finitions RAL (6 couleurs + suppléments prix)
- [x] Compositions matrice 12 packs
- [x] Zones livraison par CP (IDF, Rhône-Alpes, PACA, Occitanie, etc.)
- [x] Produits boutique : Box vide en kit S/M/L + 8 consommables (`seeds/products-poolp.json`)

### Documentation
- [x] Architecture technique (`docs/architecture.md`)
- [x] Guide utilisateur back-office Scanzi (`docs/guide-scanzi.md`)

---

## ⏳ RESTE À FAIRE

### ~~Configurateur — Demande de devis (CDC §3.2 + §8.2)~~ ✅
- [x] **Bouton "Demander un devis"** en step 7 récap (à côté de Sauvegarder/Panier/PDF)
- [x] **Endpoint API** `POST /poolp/projects/:token/quote` → passe le statut à `quote_requested`
- [x] **Email notification Scanzi** à la demande de devis (récap projet complet via Resend)
- [x] **Email confirmation client** accusé réception devis
- [x] Gate : tout le flux devis vit dans le plugin poolp-configurator (endpoint, emails, bouton), absent si plugin pas chargé
- [ ] Cas triphasé/ERP : le CTA contact existant pourrait rediriger vers ce flux devis au lieu de `/contact`

### ~~Espace client — Module Projets (CDC §6.2)~~ ✅
- [x] **Page `/compte/projets`** — liste des configurations sauvegardées du client
- [x] Actions par projet : modifier (retour configurateur), supprimer, exporter PDF
- [x] **Action "Transformer en commande"** — ajouter au panier depuis la liste projets
- [x] **Action "Demander un devis"** depuis la liste projets
- [x] Prix recalculés dynamiquement à chaque affichage (CDC §4.2 : pas de prix figés)
- [x] Lien dans `AccountNav.astro` vers `/compte/projets` — **affiché seulement si plugin poolp actif**
- [x] Gate : page client-side `isPoolpPluginActive()` + nav conditionnel `data-conditional="poolp"`

### Données Scanzi (en attente fournisseur)
- [ ] Prix HT pro et TTC public définitifs (à confirmer Scanzi)
- [ ] Plage technique débit min/max et volume min/max sur chaque équipement (CDC §7.2)
- [ ] Zones livraison complètes (tous les départements couverts)
- [ ] Formulaire upload RIB + Kbis (spécifications format attendu)

### Fonctionnalités avancées (post-MVP)
- [ ] Suivi livraison (intégration transporteur — choix prestataire à définir)
- [ ] Espace ressources : notices accessibles si ≥1 achat payé (CDC §6.2)
- [ ] Abandon panier (relance email optionnelle)
- [ ] Page d'accueil POOLP (vitrine technique — CDC §1.2)
- [ ] Pages CMS produit (showcase — CDC §1.2)

### Recette + production (CDC §11.3)
- [ ] ~~2 mai~~ — validation moteur métier Scanzi
- [ ] ~~9 mai~~ — recette interne #1
- [ ] **19 mai** — recette client Scanzi
- [ ] **1ᵉʳ juin** — mise en prod (domaine, hosting OVH, DNS, certs, monitoring)

---

## ✅ Vérifications passées

- ~~**Override remise pro**~~ ✅ câblé (`discount_override` + ProTierService + admin UI)
- ~~**Tier 365j**~~ ✅ implémenté (ProTierService + recalc auto + batch)
- ~~**Première commande comptant**~~ ✅ codée dans OrderController
- ~~**POOLP coupling dans ecommerce**~~ ✅ découplé (`subtitle` dynamique, plus de label hardcodé)
- ~~**Admin ecommerce**~~ ✅ 8 pages admin complètes
- ~~**Exclusions box §3.5**~~ ✅ UV/PAC→S exclu, volume→S/M exclu, upsizing OK, 5 cas testés
- **Multi-site** : plugin conçu pour `EXTERNAL_PLUGINS_DIR`, fonctionne standalone sans POOLP ✅

## 📐 Règles prix HT/TTC (CDC §5.1 + §5.2)

### Stockage
- Tous prix en **cents TTC** en DB (produits, équipements, box, finitions)
- HT dérivé au runtime : `HT = round(TTC / (1 + taxRate/100))`
- `tax_code` par produit (défaut `FR_STANDARD` = 20%)

### Affichage selon statut client
| Visiteur | Voit | Source |
|----------|------|--------|
| Public (non connecté) | Prix TTC | `price_cents_min` direct |
| Pro connecté (approved) | Prix HT remisé | HT × (1 - discount_rate/100) |

### Barème remise pro (ProTierService — CA payé 365j glissants)
| Statut | CA payé 365j | Remise |
|--------|-------------|--------|
| Bronze | 0 – 5 000 | 0% |
| Argent | 5 000 – 15 000 | 5% |
| Or | 15 000 – 30 000 | 10% |
| Platine | 30 000+ | 15% |

- Override admin : `discount_override` flag → bloque recalc auto
- Recalc auto sur webhook `payment_succeeded` + batch admin `POST /admin/pro-tiers/recalc`
- Seuils + remises paramétrables via settings JSON (`ecommerce_pro_tiers`)

### Taxe contextuelle (TaxResolver)
| Cas | Taux |
|-----|------|
| Particulier FR | 20% |
| Pro FR | 20% |
| Pro EU + n° TVA | 0% (autoliquidation) |
| Pro hors EU | 0% (export) |
| Micro-franchise | 0% |

### POOLP Configurateur (PoolpComputeService.computeTotals)
- Agrège : box + équipements + finition + livraison
- Retourne : `ttc` (public), `pro_ht_brut` (avant remise), `pro_ht_remise` (après remise), `discount_rate`
- Formule pro : `pro_ht_remise = pro_ht_brut × (1 - discount_rate)`
- Fallback : si pro sans tier → `plugin_poolp_configurator_default_pro_discount` (défaut 5%)

### Panier custom items (cart_items_custom)
- Stocke les 2 prix : `unit_price_ttc_cents` + `unit_price_pro_ht_cents`
- CartController.computeTotals() extrait TVA du TTC pour sous-total HT + taxe

### Frontend (pro-prices.ts)
- Au chargement : check auth → fetch `/customer/auth/me` → si `is_pro + approved` → lit `discount_rate`
- Cherche `.price-display` → lit `data-ht-min` → applique remise → affiche HT
- Prix HT masqué si pas pro

### Points de vigilance (CDC §8.2)
- Double niveau prix public/pro doit rester étanche (pas de fuite)
- Override pro persiste, jamais écrasé par recalc auto
- 1ère commande = CB comptant obligatoire sans exception

---

## 🟡 Risques

- **Recette** : jalons 2 mai + 9 mai dépassés — recalage nécessaire avec Scanzi
- ~~**Devis**~~ ✅ flux complet : bouton wizard + endpoint + emails Resend (admin + client)
- ~~**Module Projets**~~ ✅ page `/compte/projets` avec toutes actions (modifier/supprimer/panier/devis/PDF)
