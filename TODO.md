# TODO POOLP — État vs Cahier des Charges v1.2

Audit projet POOLP (cahier 8 sem, livraison 01/06/2026) au 2026-05-05. Source : `/Users/chulee/Sites/astro/plugins/poolp-configurator/`, `frontend/src/components/poolp/`, `backend-php/`.

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

---

## ⏳ À FAIRE

### 1. Boutique & tunnel commande (CDC §4 + §10) — **CRITIQUE**
- [ ] Page **`/panier`** — listing items, qty, suppression, totaux TTC
- [ ] Pages **`/checkout`** multi-étapes : adresse livraison · adresse facturation · mode livraison · paiement · récap
- [ ] Page **`/commande/confirmation/[id]`** — récap post-paiement
- [ ] Endpoints backend : `POST /cart/items`, `PUT /cart/items/:id`, `DELETE /cart/items/:id`, `POST /orders`, `GET /orders/:id`, `POST /checkout/shipping-rates`
- [ ] Produit **« Box vide en kit »** vendu boutique uniquement — séparé du configurateur (CDC §4.1)
- [ ] Catalogue **consommables piscine** seedés
- [ ] Affichage prix double niveau étanche : TTC public · HT remisé pro après login (CDC §5.2)

### 2. Stripe CB (CDC §2.1 + §5.3) — **CRITIQUE**
- [ ] Composer `stripe/stripe-php` côté backend-php
- [ ] Controller Stripe : `POST /payments/stripe/create-payment-intent`, `POST /payments/stripe/webhook`
- [ ] Stripe Elements côté frontend (composant CheckoutPayment)
- [ ] Règle non-bypass : **1ʳᵉ commande = comptant CB obligatoire** (gate sur `customers.id` + `count(orders WHERE paid)`)
- [ ] Gestion erreurs paiement + retry
- [ ] Stockage `stripe_pk`/`stripe_sk` chiffré (helper encryption déjà présent)

### 3. Stripe SEPA Direct Debit (CDC §5.3) — **CRITIQUE**
- [ ] SetupIntent SEPA + collecte mandat en ligne
- [ ] Formulaire upload **RIB + Kbis** (uploads sécurisés)
- [ ] Validation mandat côté Scanzi (admin)
- [ ] Gate : disponible **uniquement à partir 2ᵉ commande** pour client pro
- [ ] Déclenchement prélèvement à échéance (cron PHP ou hook)
- [ ] Statuts payment_intents : pending_mandate / mandate_active / charged / failed
- [ ] Webhook Stripe SEPA events

### 4. Statuts pros + remises (CDC §5.1) — **CRITIQUE**
- [ ] Table/calcul **CA payé glissant 365 jours** par client pro
- [ ] Barème paramétrable : Bronze 0-5k · Argent 5-15k · Or 15-30k · Platine ≥30k (settings JSON)
- [ ] Job recalc statut (cron quotidien ou trigger sur paiement)
- [ ] **Override manuel** Scanzi : désactive le calcul auto pour ce compte (flag `discount_override`)
- [ ] Application taux remise dans `PoolpComputeService::computeTotals` ✅ (déjà branché sur `customers.discount_rate`) — manque le mapping tier→taux
- [ ] Admin BO : édition barème + édition remise par client + override

### 5. Espace client (CDC §6.2)
- [ ] Page `/login` (référencée step 7 mais inexistante)
- [ ] Page `/compte` dashboard
- [ ] Module **Projets** : liste, ouvrir, modifier, supprimer, transformer en commande, export PDF — endpoints existent côté plugin, manque UI
- [ ] Module **Commandes** : historique, statut, factures (téléchargement PDF), notice de montage
- [ ] Suivi livraison (intégration transporteur — choisir prestataire)
- [ ] Module **Paiement** : historique + échéances SEPA
- [ ] Module **Documents** : fiches techniques, notices
- [ ] **Espace ressources** : notices accessibles si ≥1 achat payé
- [ ] Affichage prix HT pour comptes pros approuvés uniquement

### 6. Notifications email (CDC §6.4) — **CRITIQUE**
- [ ] Choix prestataire : **Resend** ou **Brevo** (CDC §2.1)
- [ ] Service envoi PHP (template + driver)
- [ ] Templates HTML :
  - [ ] Confirmation création compte
  - [ ] Projet sauvegardé (token)
  - [ ] Confirmation commande (client)
  - [ ] Récap commande interne (Scanzi)
  - [ ] Récap commande (atelier)
  - [ ] Relance échéance SEPA proche
- [ ] Hooks d'envoi sur création projet / commande / échéance

### 7. Qualification pro mid-parcours (CDC §3.2 étape 7)
- [ ] Modal/écran **avant** sauvegarde projet ou ajout panier : « êtes-vous pro ? »
- [ ] Si oui → CTA création compte pro + remise revendeur (non bloquant)
- [ ] Persist `qualif_pro_asked = 1` sur projet (endpoint existe)

### 8. CGV + avertissements (CDC §8.2)
- [ ] Page `/cgv` rédigée (mention triphasé, ERP, validité tarifs, paiement comptant 1ʳᵉ commande, prélèvement SEPA, override remise, modification annuelle plafonds)
- [ ] Bandeau warnings step 7 : **ERP** + **triphasé** (déjà côté backend, manque rendu UI dédié — actuellement tout fusionné dans une seule div)
- [ ] CTA contact équipe pour devis ERP / triphasé

### 9. Données de seed manquantes
- [ ] **Équipements** Flowdians (Filterbox EASY/CONNECT/CONNECT VS, passerelle Wi-Fi LR-MB-POOL, Caraibes9, Riverpump VS1, Pentair Clean&Clear+ 320/420, Streamay Vario maxi, Indygo Pool Extender, etc.) — voir tableau §3.3 CDC
- [ ] **Compositions** packs (matrice 3 box × 2 filtres × 2 pompes = 12 entrées)
- [ ] **Finitions** nuancier RAL + références + supplément prix
- [ ] **Zones livraison** par CP
- [ ] Prix HT pro et TTC public à fournir Scanzi
- [ ] **Plage technique** débit min/max et volume min/max sur chaque équipement (CDC §7.2)

### 10. Back-office (CDC §7.1)
- [ ] Module barème **statuts pros** (édition seuils + remises)
- [ ] Liste **comptes pros** (statut, remise, override, conditions paiement)
- [ ] Module **commandes** (suivi, statut, traitement, génération facture)
- [ ] Validation manuelle inscription pro (`pro_status=pending` → `approved`)

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

- **Override remise pro** : champ `discount_rate` lu dans `resolveProContext`, mais aucune UI admin ne permet de le saisir ni de marquer le compte « override » pour bloquer le recalc auto → **à câbler**
- **Tier 365j** : aucune logique de calcul présente, le moteur applique simplement `discount_rate` brut — il manque la fonction qui mappe CA→tier→taux
- **Première commande comptant** : aucune règle métier code, à enforcer dans le checkout
- **Multi-site** : plugin déjà conçu pour `EXTERNAL_PLUGINS_DIR`, OK pour déploiement Scanzi-only
- **Box vide** : à modéliser comme produit ecommerce séparé, pas comme variante du configurateur
