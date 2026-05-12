# TODO POOLP — État vs Cahier des Charges v1.2

Audit projet POOLP (cahier 8 sem, livraison 01/06/2026) au 2026-05-07. Source : `/Users/chulee/Sites/astro/plugins/poolp-configurator/`, `frontend/src/components/poolp/`, `backend-php/`, `plugins/ecommerce/`.

---

## ✅ FAIT

### Configurateur (cœur métier — CDC §3)
- [x] Plugin `poolp-configurator` site-spécifique (chargé via `EXTERNAL_PLUGINS_DIR`)
- [x] 4 CPT : `poolp_boxes`, `poolp_equipments`, `poolp_finitions`, `poolp_compositions`
- [x] **Moteur PHP `PoolpComputeService`** (pure, 558 lignes)
  - [x] Validation inputs (longueur/largeur/hauteur, traitement, filtre, pompe)
  - [x] Calculs hydrauliques étape 2 : surface, volume, débit (vol÷5), nb skimmers (max(S÷25, D÷6) ceil), nb bondes (+1 si volet), nb refoulements
  - [x] Exclusions box étape 3.5 : UV→exclut S, by-pass PAC→exclut S, vol >37 et ≤52→exclut S, vol >52 et ≤75→exclut S+M, vol >75→hors gamme
  - [x] Restriction traitements bassin couvert (pas électrolyse seule)
  - [x] Sélection box auto = plus petite non exclue ≥ volume (override box possible)
  - [x] Sélection équipements via composition (box × filtre × pompe) + fallback compatibilité
  - [x] Coffret programmation déduit pompe (mono→Bluetooth, variable→Wi-Fi)
  - [x] Finition (CPT)
  - [x] Logistique : code postal → zone (exact / range `30000-30999` / prefix `30*`), tarif kit/montée, validité 7j paramétrable
  - [x] Totaux TTC + pro HT brut + pro HT remisé
  - [x] Avertissements triphasé + ERP
- [x] **30 tests unitaires PHPUnit** (`PoolpComputeServiceTest.php`) couvrant exclusions, hydraulique, traitements, codes postaux, validation, totaux pro
- [x] Endpoints API : `POST /poolp/compute`, `GET /poolp/bootstrap`, `GET /poolp/delivery-zones/:cp`, projets CRUD, qualify, exportPdf, addToCart
- [x] Endpoints admin : zones livraison + projets sauvegardés
- [x] Migration tables `poolp_projects` + `poolp_delivery_zones`
- [x] Seeds boxes S/M/L (`seeds/packs-filtration.json`)

### Frontend configurateur (CDC §3.2)
- [x] Page `/configurateur.astro`
- [x] Wizard 6 étapes (`PoolpWizard.astro`, 805 lignes) : Bassin · Équipements · Votre box · Finitions · Livraison · Récap
- [x] Store client `poolp-store.ts` (publish/subscribe + localStorage + debounce 300ms)
- [x] Client API `poolp-api.ts`
- [x] Restore projet via `?p=<token>`
- [x] Boutons step 7 : Sauvegarder projet · Ajouter panier · Exporter PDF · Connexion / Inscription pro
- [x] Bandeau warning triphasé fin parcours
- [x] Page `/inscription-pro.astro`

### Back-office configurateur (CDC §7)
- [x] Mini-admin HTML : zones livraison, matrice compositions, projets sauvegardés
- [x] CRUD CPT poolp_* via interface CMS standard
- [x] Options plugin : TVA, fallback ecom, remise pro défaut, validité transport, toggle warnings

### PDF (CDC §3.2 étape 7)
- [x] Endpoint `POST /poolp/projects/:token/pdf` avec Dompdf + fallback HTML
- [x] Template `templates/pdf/project.phtml`

### Comptes clients (base — CDC §6.1)
- [x] Schema `customers` (avec `is_pro`, `pro_status` enum pending/approved/rejected, `siret`, `company`, `activity`, `discount_rate`)
- [x] Endpoints `/customer/auth/{register,login,logout,me,profile,forgot-password,reset-password}`
- [x] Endpoint `/customer/addresses` GET/POST

### E-commerce schema (CDC §4 — base)
- [x] Migration tables : carts, cart_items, shipping_zones, shipping_methods, tax_rates, coupons, orders, order_items, order_addresses, order_events, payment_intents, payment_events, invoices, credit_notes, quote_requests, digital_downloads, stock_holds, GDPR
- [x] Plugin `ecommerce` avec CPT `products`
- [x] Pages boutique : `/boutique/` + `/boutique/categorie/[...slug]`, `/produits/[slug]`
- [x] Composants shop : ProductCard, ProductGrid, FilterSidebar, AddToCartButton, PriceDisplay, VariantSelector, Pagination, SortDropdown

### E-commerce — boutique & tunnel commande (CDC §4)
- [x] Page `/panier` ([panier.astro](frontend/src/pages/panier.astro), 240 lignes) — listing items + custom_items, qty, suppression, totaux TTC
- [x] Page `/checkout` 5 étapes ([checkout.astro](frontend/src/pages/checkout.astro), 614 lignes) : adresse livraison · facturation · mode livraison · paiement · récap, avec Stripe Elements wired
- [x] Page `/commande/confirmation` ([commande/confirmation.astro](frontend/src/pages/commande/confirmation.astro), 291 lignes) — récap + retry Stripe en cas d'échec
- [x] Endpoints backend cart : `GET /cart`, `POST /cart/items`, `PUT /cart/items/:id`, `DELETE /cart/items/:id`, `DELETE /cart`, `POST/DELETE /cart/coupon` ([CartController.php](plugins/ecommerce/backend/CartController.php))
- [x] Endpoints backend orders : `POST /orders`, `GET /orders`, `GET /orders/:id`, `GET /orders/by-number/:number` ([OrderController.php](plugins/ecommerce/backend/OrderController.php))
- [x] Endpoints shipping : `GET /shop/shipping-rates` avec match CP (exact / range / prefix) + tiers poids/prix ([ShippingController.php](plugins/ecommerce/backend/ShippingController.php))
- [x] Endpoints public catalogue : `/shop/products`, `/shop/products/facets`, `/shop/products/:slug`, `/shop/products/:slug/variants`, `/shop/categories`, `/shop/categories/by-path` ([ProductController.php](plugins/ecommerce/backend/ProductController.php))

### Stripe CB (CDC §2.1 + §5.3)
- [x] `composer require stripe/stripe-php ^20.1` côté backend-php
- [x] `POST /payments/stripe/create-payment-intent` + `POST /payments/stripe/webhook` ([StripeController.php](plugins/ecommerce/backend/StripeController.php))
- [x] Stripe Elements frontend ([stripe-api.ts](frontend/src/lib/stripe-api.ts)) intégré dans `/checkout` step 4 + retry sur `/commande/confirmation`
- [x] **1ʳᵉ commande comptant CB obligatoire** — gate dans [OrderController.php:45-50](plugins/ecommerce/backend/OrderController.php#L45-L50) (refuse `on_invoice` si `isFirstOrder`)
- [x] Webhook events : `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded` → MAJ `orders.payment_status` + `order_events`
- [x] Stockage `stripe_sk_*` + `stripe_webhook_secret_*` chiffré AES-256-CBC (test/live séparés, [EcommerceSettingsController.php](plugins/ecommerce/backend/EcommerceSettingsController.php))
- [x] UI admin paramétrage Stripe ([plugins/ecommerce/admin/settings.html](plugins/ecommerce/admin/settings.html))

---

## ⏳ À FAIRE

### 1. Boutique POOLP — produits manquants (CDC §4 + §5.2) — **CRITIQUE**
- [ ] Produit **« Box vide en kit »** vendu boutique uniquement — séparé du configurateur (CDC §4.1) : entrée CPT + seed prix + page produit
- [ ] Catalogue **consommables piscine** seedés (CPT `products` + catégories)
- [ ] **Affichage prix double niveau étanche** : TTC public · HT remisé pro après login (CDC §5.2)
  - PriceDisplay.astro ne rend que TTC → étendre pour fetcher `/customer/auth/me` côté client et afficher HT remisé si `is_pro && pro_status === 'approved'`
  - Backend `/shop/products` doit exposer `base_price_ht` (déjà calculable depuis tax_code) et appliquer `discount_rate` si user pro authentifié

### 2. Stripe SEPA Direct Debit (CDC §5.3) — **CRITIQUE**
- [ ] SetupIntent SEPA + collecte mandat en ligne
- [ ] Formulaire upload **RIB + Kbis** (uploads sécurisés)
- [ ] Validation mandat côté Scanzi (admin)
- [ ] Gate : disponible **uniquement à partir 2ᵉ commande** pour client pro
- [ ] Déclenchement prélèvement à échéance (cron PHP ou hook)
- [ ] Statuts payment_intents : pending_mandate / mandate_active / charged / failed
- [ ] Webhook Stripe SEPA events

### 3. Statuts pros + remises (CDC §5.1) — **CRITIQUE**
- [ ] Table/calcul **CA payé glissant 365 jours** par client pro
- [ ] Barème paramétrable : Bronze 0-5k · Argent 5-15k · Or 15-30k · Platine ≥30k (settings JSON)
- [ ] Job recalc statut (cron quotidien ou trigger sur paiement)
- [ ] **Override manuel** Scanzi : désactive le calcul auto pour ce compte (flag `discount_override`)
- [ ] Application taux remise dans `PoolpComputeService::computeTotals` ✅ (déjà branché sur `customers.discount_rate`) — manque le mapping tier→taux
- [ ] Admin BO : édition barème + édition remise par client + override

### 4. Espace client (CDC §6.2)
- [ ] Page `/login` (référencée step 7 mais inexistante)
- [ ] Page `/compte` dashboard
- [ ] Module **Projets** : liste, ouvrir, modifier, supprimer, transformer en commande, export PDF — endpoints existent côté plugin, manque UI
- [ ] Module **Commandes** : historique, statut, factures (téléchargement PDF), notice de montage
- [ ] Suivi livraison (intégration transporteur — choisir prestataire)
- [ ] Module **Paiement** : historique + échéances SEPA
- [ ] Module **Documents** : fiches techniques, notices
- [ ] **Espace ressources** : notices accessibles si ≥1 achat payé
- [ ] Affichage prix HT pour comptes pros approuvés uniquement

### 5. Notifications email (CDC §6.4) — **CRITIQUE**
- [x] Choix prestataire : **Resend** (via RESEND_API_KEY)
- [x] Service envoi PHP (template + driver) — [OrderMailer.php](plugins/ecommerce/backend/OrderMailer.php) Resend driver + configurable from/recipients
- [x] Templates HTML :
  - [ ] Confirmation création compte
  - [ ] Projet sauvegardé (token)
  - [x] Confirmation commande (client) — `sendOrderConfirmation`
  - [x] Récap commande interne (Scanzi) — `sendAdminOrderNotif` (destinataires configurables via `ecommerce_notif_recipients`)
  - [ ] Récap commande (atelier) — utiliser même setting avec emails atelier
  - [ ] Relance échéance SEPA proche
- [x] Hooks d'envoi sur payment_succeeded (webhook Stripe) + transitions statut admin + remboursement
- [x] Email expédition client (`sendShipmentNotif`) sur status → shipped
- [x] Email remboursement client + admin (`sendRefundNotif` + `sendAdminRefundNotif`)
- [x] Email changement statut admin (`sendAdminStatusChange`)
- [x] Destinataires admin configurables dynamiquement (`ecommerce_notif_recipients` dans settings admin)

### 6. Qualification pro mid-parcours (CDC §3.2 étape 7)
- [ ] Modal/écran **avant** sauvegarde projet ou ajout panier : « êtes-vous pro ? »
- [ ] Si oui → CTA création compte pro + remise revendeur (non bloquant)
- [ ] Persist `qualif_pro_asked = 1` sur projet (endpoint existe)

### 7. CGV + avertissements (CDC §8.2)
- [ ] Page `/cgv` rédigée (mention triphasé, ERP, validité tarifs, paiement comptant 1ʳᵉ commande, prélèvement SEPA, override remise, modification annuelle plafonds)
- [ ] Bandeau warnings step 7 : **ERP** + **triphasé** (déjà côté backend, manque rendu UI dédié — actuellement tout fusionné dans une seule div)
- [ ] CTA contact équipe pour devis ERP / triphasé

### 8. Données de seed manquantes (POOLP)
- [ ] **Équipements** Flowdians (Filterbox EASY/CONNECT/CONNECT VS, passerelle Wi-Fi LR-MB-POOL, Caraibes9, Riverpump VS1, Pentair Clean&Clear+ 320/420, Streamay Vario maxi, Indygo Pool Extender, etc.) — voir tableau §3.3 CDC
- [ ] **Compositions** packs (matrice 3 box × 2 filtres × 2 pompes = 12 entrées)
- [ ] **Finitions** nuancier RAL + références + supplément prix
- [ ] **Zones livraison** par CP
- [ ] Prix HT pro et TTC public à fournir Scanzi
- [ ] **Plage technique** débit min/max et volume min/max sur chaque équipement (CDC §7.2)

### 9. Back-office POOLP (CDC §7.1)
- [ ] Module barème **statuts pros** (édition seuils + remises)
- [ ] Liste **comptes pros** (statut, remise, override, conditions paiement)
- [ ] Module **commandes** (suivi, statut, traitement, génération facture) — voir aussi §10 (admin ecommerce générique)
- [ ] Validation manuelle inscription pro (`pro_status=pending` → `approved`)

### 10. Plugin ecommerce **standalone** (déploiement non-POOLP) — **CRITIQUE**

Objectif : permettre à un site d'utiliser uniquement le plugin `ecommerce` sans `poolp-configurator` (boutique classique). Le plugin contient déjà CPT + checkout + Stripe ; il manque le découplage POOLP et l'admin UI.

**Découplage POOLP**
- [ ] Cart `custom_items` : actuellement codé pour POOLP (label "Configuration POOLP" en dur dans [panier.astro:92](frontend/src/pages/panier.astro#L92), commentaires "POOLP" dans [CartController.php:252-255](plugins/ecommerce/backend/CartController.php#L252-L255) et [OrderController.php:117](plugins/ecommerce/backend/OrderController.php#L117)) → généraliser : libellé customizable côté API (`title` + `subtitle`), pas de mention POOLP côté frontend si plugin poolp inactif
- [ ] Vérifier que `CartController::addCustomItem` n'est pas exposé publiquement quand poolp absent (sinon route à conditionner sur plugin actif)

**Admin UI manquante (aucune interface aujourd'hui hors `settings.html`)**
- [x] **Commandes** : liste/détail/recherche, MAJ statut (awaiting_payment → paid → fulfilled → shipped → delivered → refunded), remboursement Stripe, ajout note interne (table `audit_log`) — [OrderAdminController.php](plugins/ecommerce/backend/OrderAdminController.php) + [orders.html](plugins/ecommerce/admin/orders.html)
- [x] **Clients** : liste customers, fiche détail (commandes, adresses, total dépensé), édition `discount_rate`, validation `pro_status` (pending → approved/rejected), recherche — [CustomerAdminController.php](plugins/ecommerce/backend/CustomerAdminController.php) + [customers.html](plugins/ecommerce/admin/customers.html)
- [ ] **Produits** : déjà via CPT générique mais **manque** UI dédiée pour éditer **variants** (matrice attribut/option, prix/SKU/stock par variant) — endpoints `GET/PUT /admin/products/:id/variants` et `POST /admin/products/:id/generate-matrix` existent
- [ ] **Catégories produits** : UI hiérarchique (parent/enfants) — endpoints `POST/PUT/DELETE /admin/product-categories` existent
- [ ] **Zones livraison + méthodes** : CRUD zones (countries, postcode_patterns) + méthodes (flat/free/weight/price tiers), seuils gratuit, délais — **endpoints à créer** (tables présentes mais aucune route admin)
- [ ] **Taux TVA** : CRUD `tax_rates` (code, label, rate, country, is_default) — **endpoints à créer**
- [ ] **Coupons** : CRUD coupons (code, type pct/amount, min cart, dates, usage limits) — **endpoints à créer**
- [ ] **Factures + avoirs** : génération PDF facture sur paiement, numérotation auto via `invoice_prefix` + `invoice_next_number` (settings existent), historique téléchargeable — moteur PDF (dompdf) requis (cf. §12)

**Backend endpoints admin manquants**
- [x] `GET /admin/orders` (filtres : statut, date, email, montant) + `GET /admin/orders/:id` + `PUT /admin/orders/:id` (statut + notes) + `GET /admin/orders/stats`
- [x] `POST /admin/orders/:id/refund` (Stripe refund)
- [x] `GET /admin/customers` (filtres : pro_status, recherche email/nom) + `GET /admin/customers/:id` + `PUT /admin/customers/:id` (discount_rate, pro_status, discount_override) + `GET /admin/customers/stats`
- [ ] `GET/POST/PUT/DELETE /admin/shipping-zones` + `/admin/shipping-methods`
- [ ] `GET/POST/PUT/DELETE /admin/tax-rates`
- [ ] `GET/POST/PUT/DELETE /admin/coupons`
- [ ] `GET /admin/invoices` + `GET /admin/invoices/:id/pdf`

**Email transactionnels (boutique générique, pas que POOLP)**
- [x] Templates : confirmation commande client, notif interne admin (vente reçue), expédition (avec tracking), remboursement — [OrderMailer.php](plugins/ecommerce/backend/OrderMailer.php)
- [x] Hook envoi sur `payment_succeeded` webhook + sur transitions de statut order + remboursement
- [x] Destinataires admin configurables via `ecommerce_notif_recipients` (settings admin)
- [ ] Abandon panier (relance optionnelle) — non implémenté

**Pages frontend manquantes pour shop standalone**
- [ ] `/login`, `/compte` (cf. §4) — partagées POOLP/ecommerce
- [ ] `/compte/commandes`, `/compte/commandes/:number` (historique + détail + facture PDF)
- [ ] `/compte/adresses` (CRUD)
- [ ] `/cgv`, `/mentions-legales`, `/politique-confidentialite` (templates génériques rédigeables via CMS)
- [ ] Page **panier vide** + page **commande introuvable** (404 spécialisé)

**Documentation plugin**
- [ ] README plugin ecommerce : installation, dépendances, paramétrage Stripe, schéma DB, points d'extension

### 11. Vitrine + SEO (CDC sprint 5)
- [ ] Page d'accueil POOLP (présentation produit)
- [ ] Pages CMS produit (vitrine technique)
- [ ] Sitemap.xml + meta + OpenGraph
- [ ] Performance Astro (Lighthouse)

### 12. Documentation + livrables (CDC §10.2)
- [ ] Doc technique architecture + modèle de données
- [ ] Guide utilisateur back-office (Scanzi)
- [ ] Jeu de tests CDC documenté (au-delà des 30 tests PHPUnit moteur)

### 13. Recette + production (CDC §11.3)
- [ ] **2 mai** — validation moteur métier Scanzi (jalon)
- [ ] **9 mai** — recette interne #1
- [ ] **19 mai** — recette client Scanzi
- [ ] **1ᵉʳ juin** — mise en prod (domaine, hosting OVH, DNS, certs, monitoring)
- [ ] `composer require dompdf/dompdf` côté backend-php (PDF actuellement renvoie 501 si non installé)

---

## 🟡 Vérifications/risques

- **Override remise pro** : champ `discount_rate` lu dans `resolveProContext`, mais aucune UI admin ne permet de le saisir ni de marquer le compte « override » pour bloquer le recalc auto → **à câbler** (cf. §10)
- **Tier 365j** : aucune logique de calcul présente, le moteur applique simplement `discount_rate` brut — il manque la fonction qui mappe CA→tier→taux (cf. §3)
- ~~**Première commande comptant**~~ ✅ codée dans [OrderController.php:45-50](plugins/ecommerce/backend/OrderController.php#L45-L50)
- **Multi-site** : plugin déjà conçu pour `EXTERNAL_PLUGINS_DIR`, OK pour déploiement Scanzi-only — **mais** plugin `ecommerce` doit aussi tourner seul sur d'autres sites (cf. §10)
- **Box vide** : à modéliser comme produit ecommerce séparé, pas comme variante du configurateur
- **POOLP coupling dans ecommerce** : `custom_items` du panier ont du label "Configuration POOLP" en dur — bloquant pour réutilisation sur autre site (cf. §10 découplage)
- **Admin ecommerce** : aucune section dédiée dans le SPA admin (`backend-php/admin/index.html`), uniquement `settings.html` accessible via plugin admin_pages — à étoffer pour gérer commandes/clients/zones/coupons
