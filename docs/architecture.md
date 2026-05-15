# Architecture technique — POOLP + E-commerce

## Vue d'ensemble

Monorepo CMS headless multi-composant avec boutique e-commerce integree.

```
astro/
├── backend-php/      # API REST PHP (PDO + MySQL)
├── frontend/         # Site statique Astro 5 (SSG + SSR hybride)
├── nickl/            # Framework de theme modulaire (Sage 6.x, deprecie)
├── plugins/          # Plugins extensibles
│   ├── ecommerce/    # Boutique complete (produits, panier, checkout, paiements)
│   └── poolp-*/      # Configurateur piscine POOLP (site-specifique)
└── docs/             # Documentation
```

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | Astro 5 (SSG + SSR) |
| Backend | PHP 8.1+ (custom router, PDO MySQL) |
| Paiement | Stripe (CB + SEPA Direct Debit) |
| Email | Resend API |
| PDF | Dompdf 3.x |
| Auth admin | JWT (firebase/php-jwt) |
| Auth client | JWT separe (type=customer) |

## Architecture plugin

Les plugins sont auto-decouverts au boot via `backend-php/helpers/plugin-hooks.php`. Chaque plugin peut enregistrer :
- **Migrations** : `register_plugin_migration(name, callback)` — tables SQL idempotentes
- **Routes** : `register_plugin_route(name, callback)` — routes API (retourne true si handled)
- **Pages admin** : `plugin.json > admin_pages[]` — pages HTML servies via `/plugin-assets/`
- **Pages frontend** : `frontend/astro-integration.mjs` — injecte des routes Astro dynamiquement

### Plugin ecommerce

**Tables** : customers, customer_addresses, product_variants, product_images, carts, cart_items, cart_items_custom, orders, order_items, invoices, payment_intents, shipping_zones, shipping_methods, tax_rates, coupons, coupon_usages, sepa_mandates, audit_log, tokens, stock_holds, quote_requests, stats_cache, gdpr_erasure_log, gdpr_erasure_requests

**Controllers** (15) : CartController, OrderController, OrderAdminController, CustomerAuthController, CustomerAdminController, ProductController, ProductCategoryController, ShippingController, ShippingAdminController, TaxAdminController, CouponsAdminController, StripeController, SEPAController, InvoiceController, ProTierService

**Pages admin** (8) : orders, customers, settings, shipping, tax, coupons, pro-tiers, invoices

**Pages frontend** (14) : boutique, categorie, produit, panier, checkout, confirmation, compte (dashboard, connexion, profil, adresses, paiement, commandes, telechargements), cgv, mentions-legales, politique-confidentialite

### Plugin poolp-configurator (site-specifique)

Charge via `EXTERNAL_PLUGINS_DIR`. Moteur de calcul PHP (`PoolpComputeService`) avec 30 tests PHPUnit.

**Flow** : Wizard 7 etapes → compute API → save/export/add-to-cart

## Flux de paiement

### CB (Stripe)
1. `POST /orders` — cree commande (status=awaiting_payment)
2. `POST /payments/stripe/create-payment-intent` — retourne client_secret
3. Frontend confirme via Stripe Elements
4. Webhook `payment_intent.succeeded` → status=paid + emails + facture auto + recalc tier pro

### SEPA (pros uniquement, 2e commande+)
1. `POST /payments/sepa/setup-intent` — collecte mandat IBAN
2. Webhook `setup_intent.succeeded` → mandat enregistre (status=pending)
3. Admin valide mandat (status=active)
4. `POST /payments/sepa/charge` — prelevement off-session
5. Webhook `payment_intent.succeeded` → idem CB

## Systeme de tiers pros

Barème paramétrable via settings `ecommerce_pro_tiers` (JSON). Par defaut :
- Bronze (0-5k€) : 0%
- Argent (5k-15k€) : 5%
- Or (15k-30k€) : 10%
- Platine (30k€+) : 15%

Recalcul automatique apres chaque paiement + batch admin. Override manuel possible par client.

## Factures PDF

Auto-generees sur `payment_succeeded` webhook. Numerotation : `FA-2026-00001`. Template HTML rendu via Dompdf (fallback HTML si non installe). Telechargement client via `/orders/:id/invoice`, admin via `/admin/invoices/:id/pdf`.

## Multi-site

Un seul codebase deploye sur N sites. Variables d'env par site :
- `FRONTEND_URL`, `ADMIN_URL` — URLs specifiques
- `EXTERNAL_PLUGINS_DIR` — plugins site-specifiques (ex: poolp-configurator)
- `DB_NAME` — base de donnees par site

Le plugin ecommerce est generique et fonctionne sans poolp-configurator.
