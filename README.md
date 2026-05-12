# CMS Astro

Un système de gestion de contenu (CMS) sur mesure, qui permet de créer et publier plusieurs sites web rapides à partir d'un même back-office.

> Ce README est volontairement accessible : un éditeur de contenu doit pouvoir comprendre ce que fait le projet, et un développeur doit pouvoir l'installer et y contribuer.

---

## Table des matières

1. [En une phrase](#1-en-une-phrase)
2. [Pour les non-développeurs](#2-pour-les-non-développeurs)
3. [Pour les développeurs](#3-pour-les-développeurs)
4. [Installation](#4-installation)
5. [Démarrer le projet](#5-démarrer-le-projet)
6. [Comment fonctionne une page ?](#6-comment-fonctionne-une-page-)
7. [Personnaliser le site](#7-personnaliser-le-site)
8. [Multi-sites](#8-multi-sites)
9. [Déploiement](#9-déploiement)
10. [Documents complémentaires](#10-documents-complémentaires)
11. [Dépannage](#11-dépannage)

---

## 1. En une phrase

> Un back-office en PHP où l'on compose des pages avec des **blocs** (héro, galerie, formulaire…), et un site public en **Astro** qui transforme ces blocs en pages HTML ultra-rapides.

---

## 2. Pour les non-développeurs

### À quoi sert ce projet ?

Le CMS permet à un éditeur de :

- Créer et organiser des pages (accueil, contact, articles de blog, fiches produits…).
- Composer chaque page comme un **Lego de blocs** : un héro avec une grande image, un texte avec illustration, une galerie, un formulaire, etc.
- Gérer des actualités, événements, références, produits, formulaires de contact.
- Personnaliser les couleurs, polices et le menu sans toucher au code.

### Comment ça s'organise ?

Le projet a deux faces :

| Face | Qui l'utilise ? | Adresse type |
|---|---|---|
| **Le back-office** | L'éditeur (toi) | `monsite.fr/admin` |
| **Le site public** | Les visiteurs | `monsite.fr` |

Quand tu publies une modification dans le back-office, le site public est automatiquement reconstruit. Le visiteur voit toujours une version **pré-fabriquée** de la page : très rapide, peu coûteuse en serveur.

### Le vocabulaire utile

| Terme | Définition simple |
|---|---|
| **Bloc / module** | Une section de page (un héro, une galerie, un formulaire…). |
| **Page** | Un assemblage de blocs publié sur le site. |
| **Slug** | La fin de l'URL d'une page (`/contact` → slug = `contact`). |
| **Build** | Étape automatique où le site reconstruit toutes ses pages. |
| **Plugin** | Ajout optionnel qui apporte de nouveaux blocs (ex. : avant/après, configurateur). |

---

## 3. Pour les développeurs

### Stack technique

| Brique | Technologie |
|---|---|
| **Frontend** | [Astro 5](https://astro.build) (SSG), SCSS compilé via Sass |
| **Backend** | PHP ≥ 8.1 (custom MVC), MySQL, JWT, Stripe SDK, templates Blade |
| **Back-office** | HTML/CSS/JS vanilla (pas de framework) |
| **Plugins** | PHP + Blade + CSS + manifeste `plugin.json` |
| **Build** | Sass natif via `frontend/scripts/compile-nickl-css.js` |

> ⚠️ Le projet utilisait initialement un backend Node/Payload avec MongoDB. **Cette stack est obsolète** — l'API est désormais en PHP avec MySQL. Le dossier `nickl/` (legacy SCSS/Bud) est en cours de retrait : ne plus y éditer de fichiers.

### Architecture

```
astro/
├── frontend/           # Site public (Astro)
│   ├── src/
│   │   ├── pages/      # Routes du site
│   │   ├── components/ # Composants réutilisables
│   │   ├── layouts/    # Templates de page
│   │   ├── lib/        # Helpers (api, images, schema-org)
│   │   └── styles/     # SCSS + CSS
│   ├── public/         # Assets statiques + CSS compilés
│   └── theme-config.json
│
├── backend-php/        # API + back-office (PHP)
│   ├── index.php       # Front controller / router
│   ├── controllers/    # Endpoints API (Posts, Pages, Auth…)
│   ├── models/         # Accès DB
│   ├── templates/      # Templates Blade pour rendu serveur
│   ├── admin/          # Back-office statique (HTML/JS/CSS)
│   ├── config/         # database.php, module-fields.json…
│   ├── helpers/        # response, request, slug, sitemap…
│   ├── middleware/     # auth, rate-limit
│   └── uploads/        # Médias uploadés
│
├── plugins/            # Plugins partagés entre sites
│   └── {plugin}/
│       ├── plugin.json
│       ├── modules/    # Définitions PHP
│       ├── templates/  # Blade
│       └── css/
│
└── docs/               # Guides de déploiement
```

### Flux de données

```
Éditeur (back-office HTML)
        │  POST /api/pages
        ▼
backend-php (PHP + MySQL)
        │  GET /api/pages/{slug}
        ▼
frontend (Astro build)
        │  HTML statique pré-généré
        ▼
Visiteur (navigateur)
```

Pour les blocs spéciaux non-implémentés en Astro, le frontend appelle `POST /api/render-block` qui rend un template Blade côté serveur — le HTML est ensuite injecté dans la page.

---

## 4. Installation

### Pré-requis

- **PHP** ≥ 8.1 avec extensions `pdo_mysql`, `gd`, `zlib`
- **MySQL** ≥ 5.7 ou MariaDB
- **Node.js** ≥ 18
- **Composer** (gestionnaire de paquets PHP)
- **MAMP Pro** ou équivalent en local (recommandé sur macOS)

### Étapes

```bash
# 1. Cloner le dépôt
git clone <url> astro && cd astro

# 2. Installer les dépendances PHP
cd backend-php && composer install && cd ..

# 3. Installer les dépendances Node (frontend)
cd frontend && npm install && cd ..

# 4. Configurer la base de données
#    Créer une base MySQL puis copier .env.example vers .env
cd backend-php
cp .env.example .env
# Éditer .env : DB_HOST, DB_NAME, DB_USER, DB_PASS, JWT_SECRET, STRIPE_KEY…

# 5. Initialiser la BDD
php migrate.php

# 6. Configurer l'URL de l'API côté frontend
cd ../frontend
cp .env.example .env
# Éditer .env : PUBLIC_API_URL=http://localhost:8888
```

---

## 5. Démarrer le projet

Deux serveurs doivent tourner en parallèle.

### Serveur PHP (back-office + API)

Avec MAMP Pro, pointe un host vers `backend-php/` (port `8888` par défaut).

Sans MAMP :
```bash
cd backend-php
php -S localhost:8888 index.php
```

→ Back-office accessible sur `http://localhost:8888/admin`

### Serveur Astro (site public)

```bash
cd frontend
npm run dev
```

→ Site accessible sur `http://localhost:4321`

### Compilation des styles

Lors de la modification de SCSS dans `frontend/src/styles/nickl/` :

```bash
cd frontend
npm run compile-css
```

Le script `compile-css` est aussi exécuté automatiquement avant `npm run dev` et `npm run build`.

---

## 6. Comment fonctionne une page ?

Une page existe à 3 niveaux :

| Niveau | Fichier | Rôle |
|---|---|---|
| **Modèle de données** | `backend-php/models/Page.php` | Stockage en BDD |
| **API** | `backend-php/controllers/PageController.php` | Endpoints CRUD |
| **Affichage** | `frontend/src/pages/[...slug].astro` | Rendu HTML public |

Pour comprendre en détail comment Astro fabrique une page (frontmatter, getStaticPaths, blocs, styles…), voir [ARCHITECTURE_PAGE_ASTRO.md](ARCHITECTURE_PAGE_ASTRO.md).

### Anatomie d'un bloc

Un bloc (ex. `text-image`) est défini en **3 endroits** :

1. **Champs admin** — `backend-php/generate-module-fields.php` : décrit les champs éditables dans le back-office.
2. **Rendu serveur** — `backend-php/templates/modules/text-image.blade.php` : utilisé en fallback ou via `POST /api/render-block`.
3. **Rendu front** — `frontend/src/components/blocks/NicklTextImage.astro` + `frontend/src/styles/nickl/modules/_text-image.scss` : rendu côté Astro.

Pour modifier un bloc existant, suivre la procédure pas-à-pas dans [MODIFIER_MODULE.md](MODIFIER_MODULE.md).

---

## 7. Personnaliser le site

### Le thème (couleurs, polices)

Trois niveaux de personnalisation :

1. **Variables CSS globales** — [frontend/src/styles/theme.css](frontend/src/styles/theme.css) : couleurs, typographies, espacements.
2. **Configuration multi-thèmes** — [frontend/theme-config.json](frontend/theme-config.json) : presets de thème activables.
3. **Surcharge dynamique depuis le back-office** — [frontend/src/components/ThemeInjector.astro](frontend/src/components/ThemeInjector.astro) : variables CSS injectées en runtime depuis les paramètres de site.

Une page peut aussi avoir ses **propres couleurs** (champ `color_overrides` dans le back-office, lu par [...slug].astro](frontend/src/pages/[...slug].astro)).

### Les styles d'un bloc

Source : `frontend/src/styles/nickl/modules/_{slug}.scss` → recompiler avec `npm run compile-css`.

Pour une retouche locale isolée, ajoute un bloc `<style>` directement dans le composant `.astro` du bloc.

> **Ne jamais éditer** `frontend/public/nickl-assets/css/*.css` : ces fichiers sont générés.

### Les styles du back-office

Pas de build : édite directement [backend-php/admin/style.css](backend-php/admin/style.css) ou les fichiers par module dans [backend-php/admin/modules/](backend-php/admin/modules/).

### Créer un plugin

Voir le squelette [plugins/before-after/](plugins/before-after/) — minimal, complet, à recopier :

```
plugins/mon-plugin/
├── plugin.json          # Manifeste : nom, modules exposés
├── modules/MonBloc.php  # Logique
├── templates/mon-bloc.blade.php
└── css/mon-bloc.css
```

⚠️ Plugin **mono-site** → ne pas le mettre dans `plugins/` (qui est partagé entre tous les sites). Utiliser plutôt la variable d'environnement `EXTERNAL_PLUGINS_DIR`, définie uniquement sur le site cible.

---

## 8. Multi-sites

Le projet héberge **plusieurs sites avec un seul code source**. Chaque site a sa propre BDD, ses propres médias, ses propres paramètres, mais partage la stack technique et les plugins communs.

Voir [MULTISITE.md](MULTISITE.md) pour le détail. En bref :

- Un seul dépôt Git, plusieurs sites en production.
- Variable d'environnement `SITE_ID` ou similaire pour différencier.
- Plugins mono-site stockés hors du dépôt (`EXTERNAL_PLUGINS_DIR`).
- **Ne jamais hardcoder d'URL** dans le code (utiliser les helpers).

---

## 9. Déploiement

Le déploiement se fait par **`git push`** vers la branche du site cible. Voir [docs/DEPLOY_NEW_SITE.md](docs/DEPLOY_NEW_SITE.md) pour ajouter un nouveau site.

### Frontend (Astro)

```bash
cd frontend
npm run build
# → dist/ contient le site statique prêt à servir
```

### Backend (PHP)

Pas de build. Pousser le code et s'assurer que le serveur a :
- PHP ≥ 8.1
- BDD MySQL accessible
- Dossier `uploads/` en écriture
- Variables d'environnement configurées

---

## 10. Documents complémentaires

| Document | À quoi ça sert |
|---|---|
| [ARCHITECTURE_PAGE_ASTRO.md](ARCHITECTURE_PAGE_ASTRO.md) | Anatomie détaillée d'une page Astro (pour devs et non-devs) |
| [MODIFIER_MODULE.md](MODIFIER_MODULE.md) | Procédure pas-à-pas pour modifier un bloc existant |
| [MULTISITE.md](MULTISITE.md) | Architecture multi-sites |
| [GUIDE_DEMARRAGE.md](GUIDE_DEMARRAGE.md) | Guide de démarrage rapide |
| [COMMANDES.md](COMMANDES.md) | Liste des commandes utiles |
| [docs/DEPLOY_NEW_SITE.md](docs/DEPLOY_NEW_SITE.md) | Mettre en ligne un nouveau site |
| [CLAUDE.md](CLAUDE.md) | Instructions pour l'assistant IA Claude |
| [TODO.md](TODO.md) | Roadmap et tâches en cours |

---

## 11. Dépannage

### Le back-office ne charge pas

- Vérifier que le serveur PHP tourne (`http://localhost:8888/admin`).
- Vérifier les permissions du dossier `backend-php/uploads/` (en écriture).
- Vérifier la connexion BDD dans `backend-php/.env`.

### Le frontend n'affiche pas les pages

- Vérifier que `PUBLIC_API_URL` dans `frontend/.env` pointe vers le backend.
- Vérifier que la page est bien en statut **publié** (pas brouillon).
- Vérifier la **date de publication** (pas dans le futur).
- Relancer `npm run dev` après modification du `.env`.

### Erreur de CORS

Le backend doit autoriser l'origine du frontend (configuré dans `backend-php/middleware/` ou `index.php`).

### Les styles d'un bloc ne s'appliquent pas

- Lancer `npm run compile-css` dans `frontend/`.
- Vérifier que le SCSS du bloc est bien déclaré dans [frontend/scripts/compile-nickl-css.js](frontend/scripts/compile-nickl-css.js).
- Ne pas avoir édité `frontend/public/nickl-assets/css/*.css` à la main (écrasé au prochain build).

### Une image ne s'affiche pas

- Vérifier que le fichier existe dans `backend-php/uploads/`.
- Vérifier la route d'optimisation `/uploads/media/_optimized/...` dans [backend-php/index.php](backend-php/index.php).
- Forcer le rafraîchissement (les images optimisées sont mises en cache).

---

## Ressources externes

- [Documentation Astro](https://docs.astro.build)
- [Documentation PHP](https://www.php.net/docs.php)
- [Documentation Blade (Laravel)](https://laravel.com/docs/blade)

## Licence

MIT
