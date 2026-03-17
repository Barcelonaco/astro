# CLAUDE.md - Astro CMS Blog

## Instructions de travail

### Avant de créer ou modifier un module Nickl

Toujours lire ces fichiers en premier (s'ils existent) :

1. **FieldGroup** : `nickl/app/Modules/{Module}.php` — définition des champs ACF
2. **View** : `nickl/resources/views/modules/{module-slug}.blade.php` — template Blade
3. **Style** : `nickl/resources/styles/modules/_{module-slug}.scss` — SCSS du module
4. **JS** : `nickl/resources/scripts/modules/{module-slug}.js` — JavaScript du module
5. **Bloc frontend** : `frontend/src/components/blocks/Nickl{Module}.astro` — composant Astro correspondant

Ne jamais modifier ou créer un module sans avoir d'abord consulté ces fichiers pour comprendre le pattern existant.

### Après création ou modification d'un module Nickl

Vérifier que tous les paramètres du module fonctionnent :

1. **Couverture des champs** : croiser TOUS les champs définis dans `nickl/app/Modules/{Module}.php` avec ceux utilisés dans `frontend/src/components/blocks/Nickl{Module}.astro`. Lister les champs manquants s'il y en a.
2. **BlockParams** : vérifier que les paramètres communs sont gérés (bg color, padding top/bottom, visibilité, background image + opacité + parallax, fullscreen, bloc title)
3. **Rendu serveur** : tester via `curl -X POST http://localhost:3000/api/render-block -H "Content-Type: application/json" -d '{"type": "{module-slug}", "data": { ... }}'` avec des données de test couvrant tous les cas (champs vides, champs remplis, variantes de style)
4. **Build frontend** : lancer `cd frontend && npm run build` pour vérifier l'absence d'erreurs TypeScript et de build
5. **Vérification visuelle** : créer ou utiliser une page de test contenant le module avec différentes combinaisons de paramètres, puis vérifier visuellement via `http://localhost:4321/pages/{test-page}`

### Après chaque modification de code

Toujours vérifier qu'il n'y a pas d'erreur après une modification :

- **Backend JS** : vérifier que le serveur ne crash pas (`npm run dev` dans backend)
- **Frontend Astro** : vérifier qu'il n'y a pas d'erreur de build (`npm run build` dans frontend)
- **SCSS Nickl** : vérifier la compilation (`npm run build` dans nickl)
- **PHP** : vérifier la syntaxe si un fichier PHP a été modifié
- **TypeScript** : vérifier les erreurs de type dans les fichiers `.ts` / `.astro`

---

## Project Overview

CMS headless multi-composant avec frontend statique. Architecture monorepo à 4 dossiers : backend API REST (Express + MySQL), frontend SSG (Astro), framework de thème modulaire (Nickl/Sage), et système de plugins extensible.

## Architecture Monorepo

```
astro/
├── backend/          # API REST Express.js + MySQL (port 3000)
├── frontend/         # Site statique Astro (port 4321)
├── nickl/            # Framework de thème Sage 6.x (PHP, 40 modules ACF)
├── plugins/          # Plugins extensibles (CPT, templates, assets)
└── package.json      # Scripts concurrents (dev, build, install:all)
```

## Stack Technique

| Composant         | Technologie                        | Version                        |
| ----------------- | ---------------------------------- | ------------------------------ |
| Frontend          | Astro (SSG + SSR hybride)          | 5.16.15                        |
| Backend           | Express.js (ESM)                   | 4.21.2                         |
| Base de données   | MySQL (mysql2/promise)             | 3.11.4                         |
| Auth              | JWT + bcrypt                       | jsonwebtoken 9.x, bcrypt 5.1.1 |
| Upload fichiers   | Multer                             | 1.4.5-lts.1                    |
| Validation        | express-validator                  | 7.2.1                          |
| Images            | Sharp                              | 0.34.3                         |
| Dimensions images | image-size                         | 2.0.2                          |
| Thème PHP         | Sage/Roots + Acorn                 | 6.24.0 / 5.0.3                 |
| Build Nickl       | Bud (Webpack 5)                    | 6.24.0                         |
| CSS Nickl         | SCSS + Tailwind (via Bud)          | sass 1.64.2                    |
| JS Nickl          | GSAP 3.12, Swiper 11.2, jQuery 3.7 | -                              |
| Cartes            | Mapbox GL                          | 3.8.0                          |
| Cookies           | vanilla-cookieconsent              | 3.1.0                          |
| Monorepo          | concurrently                       | 9.1.2                          |

## Commandes principales

```bash
# Racine — lancement simultané
npm run dev                # Frontend + Backend en parallèle (concurrently)
npm run dev:backend        # Backend seul (nodemon)
npm run dev:frontend       # Frontend seul (astro dev)
npm run build              # Build backend puis frontend
npm run install:all        # npm install dans les 3 projets

# Backend (cd backend)
npm run dev                # nodemon src/server.js
npm start                  # node src/server.js (production)
npm run setup              # Initialise la DB MySQL (tables + admin par défaut)
npm run css                # Compile les 41 CSS modules Nickl → public/admin/modules/

# Frontend (cd frontend)
npm run dev                # astro dev (port 4321)
npm run build              # astro build → dist/
npm run preview            # Prévisualisation du build statique

# Nickl (cd nickl)
npm run dev                # Bud dev server + HMR
npm run build              # Build production → public/
npm run clean              # Nettoyage du cache Bud
```

## Variables d'environnement

### Backend (`backend/.env`)

```
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_NAME=astro_blog_cms
DB_USER=root
DB_PASSWORD=root
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_URL=http://localhost:3000/admin
FRONTEND_URL=http://localhost:4321
```

### Frontend (`frontend/.env`)

```
PUBLIC_API_URL=http://localhost:3000/api
```

Le préfixe `PUBLIC_` rend la variable accessible côté client (navigateur).

---

## Architecture Backend

```
backend/
├── src/
│   ├── server.js                    # Point d'entrée Express, middleware stack, CORS
│   ├── db.js                        # Pool MySQL (mysql2/promise, 10 connexions max)
│   ├── setup.js                     # Initialisation DB (tables + données par défaut)
│   ├── routes/
│   │   └── api.js                   # Toutes les routes API
│   ├── models/
│   │   ├── User.js                  # findByEmail, findById, create, findAll, update, delete, verifyPassword
│   │   ├── Post.js                  # findAll, findBySlug, create, update, delete, setCategories, setTags
│   │   ├── Category.js              # findAll, findBySlug, create, update, delete
│   │   └── Page.js                  # findAll, findBySlug, create, update, delete, findNavigation
│   ├── controllers/
│   │   ├── authController.js        # login, me
│   │   ├── postController.js        # CRUD posts + relations catégories/tags
│   │   ├── categoryController.js    # CRUD catégories
│   │   ├── pageController.js        # CRUD pages + navigation hiérarchique
│   │   ├── settingsController.js    # getAllSettings, getSiteInfo, getThemeSettings, updateSettings
│   │   ├── userController.js        # CRUD utilisateurs (admin)
│   │   ├── mediaController.js       # Upload Multer, CRUD médias + dossiers
│   │   ├── moduleFieldsController.js      # Parse PHP → champs ACF (regex)
│   │   ├── moduleTemplatesController.js   # Templates Blade + résolution CSS
│   │   ├── renderBlockController.js       # Rendu server-side des blocs (Blade simplifié)
│   │   ├── customPostTypeController.js    # CPT dynamiques via plugins (tables auto-créées)
│   │   └── pluginController.js            # Lecture des manifests plugin.json
│   ├── middleware/
│   │   └── auth.js                  # authenticateToken (JWT), isAdmin (rôle)
│   └── styles/
│       └── compile-modules.js       # Compilation SCSS → CSS pour l'admin
├── public/admin/                    # Interface d'administration (HTML statique)
└── uploads/media/                   # Fichiers uploadés
```

### Middleware Stack (ordre dans server.js)

1. **CORS** — Whitelist : `FRONTEND_URL` (4321) + `ADMIN_URL` (3000)
2. **Body parsing** — `express.json()` + `express.urlencoded({ extended: true })`
3. **Fichiers statiques** :
   - `/uploads` → `backend/uploads/`
   - `/nickl-assets` → `nickl/public/`
   - `/plugin-assets` → `plugins/`
   - `/admin` → `backend/public/admin/`
4. **Routes API** — `/api` → `routes/api.js`
5. **Redirect racine** — `GET /` → `/admin/login.html`
6. **404 handler** — `{ error: 'Not found' }`
7. **Error handler global** — `{ error: 'Internal server error' }` + log console

### Boot

Au démarrage, `migratePluginTables()` est appelé pour créer/mettre à jour les tables des CPT définis dans les plugins.

---

## Base de données MySQL

**Nom** : `astro_blog_cms` | **Charset** : `utf8mb4_unicode_ci`

### Tables statiques

| Table             | Description                      | Clés                                                                                     |
| ----------------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| `users`           | Utilisateurs (admin/editor)      | PK: id, UNIQUE: email                                                                    |
| `posts`           | Articles de blog                 | PK: id, UNIQUE: slug, FK: author_id → users, INDEX: status, published_date               |
| `categories`      | Catégories                       | PK: id, UNIQUE: slug                                                                     |
| `post_categories` | Liaison posts ↔ categories       | PK composite (post_id, category_id), FK cascade                                          |
| `tags`            | Tags                             | PK: id, UNIQUE: name                                                                     |
| `post_tags`       | Liaison posts ↔ tags             | PK composite (post_id, tag_id), FK cascade                                               |
| `pages`           | Pages hiérarchiques              | PK: id, UNIQUE: slug, FK: author_id → users, FK: parent_id → pages (self), INDEX: status |
| `settings`        | Paramètres clé/valeur (60+ clés) | PK: id, UNIQUE: setting_key                                                              |
| `media_folders`   | Dossiers médiathèque             | PK: id, FK: parent_id (self)                                                             |
| `media_items`     | Fichiers médias (image/video)    | PK: id, FK: folder_id → media_folders, INDEX: folder_id, type                            |

### Tables dynamiques (CPT — créées au runtime)

Les plugins déclarent des Custom Post Types dans `plugin.json`. Les tables suivantes sont auto-créées :

```sql
cpt_{slug}                  -- Contenu (title, slug, excerpt, content, featured_image JSON, custom_fields JSON, author_id, status, published_date)
cpt_{slug}_categories       -- Catégories du CPT (si hasCategories: true)
cpt_{slug}_category_map     -- Liaison CPT items ↔ catégories
```

### Données par défaut (setup.js)

- **Admin** : `admin@example.com` / `admin123` (rôle admin)
- **Settings** : site_name, site_description, posts_per_page (10), theme_use_child (0), active_theme (default)

### Statuts et rôles

- Posts/Pages : `draft` | `published`
- Utilisateurs : `admin` | `editor`

---

## API REST

**Base URL** : `http://localhost:3000/api`

### Routes publiques

```
POST /auth/login                    # Auth → JWT (expire 7 jours)
GET  /posts                         # Posts publiés (?status=published&category=slug)
GET  /posts/:slug                   # Post par slug (avec auteur, catégories, tags)
GET  /categories                    # Toutes les catégories
GET  /categories/:slug              # Catégorie par slug
GET  /pages                         # Toutes les pages
GET  /pages/navigation              # Navigation hiérarchique (arbre parent/children)
GET  /pages/:slug                   # Page par slug
GET  /settings/theme                # Config thème (useChildTheme, activeTheme)
GET  /settings/site                 # Identité site (siteName, siteDescription, frontPage)
POST /render-block                  # Rendu server-side d'un bloc (type + data → HTML)
GET  /cpt/:postType                 # Items d'un CPT
GET  /cpt/:postType/:slug           # Item CPT par slug
GET  /cpt/:postType/categories      # Catégories d'un CPT
```

### Routes protégées (JWT — header `Authorization: Bearer <token>`)

```
GET    /auth/me                     # Profil utilisateur connecté
POST   /posts                       # Créer un post
PUT    /posts/:id                   # Modifier un post
DELETE /posts/:id                   # Supprimer un post
POST   /categories                  # Créer une catégorie
PUT    /categories/:id              # Modifier une catégorie
DELETE /categories/:id              # Supprimer une catégorie
POST   /pages                       # Créer une page
PUT    /pages/:id                   # Modifier une page
DELETE /pages/:id                   # Supprimer une page
POST   /cpt/:postType               # Créer un item CPT
PUT    /cpt/:postType/:id           # Modifier un item CPT
DELETE /cpt/:postType/:id           # Supprimer un item CPT
POST   /cpt/:postType/categories    # Créer une catégorie CPT
PUT    /cpt/:postType/categories/:id    # Modifier une catégorie CPT
DELETE /cpt/:postType/categories/:id    # Supprimer une catégorie CPT
```

### Routes admin uniquement (JWT + rôle admin)

```
GET    /settings                    # Tous les paramètres (60+ clés)
PUT    /settings                    # Modifier les paramètres (INSERT ON DUPLICATE KEY UPDATE)
GET    /users                       # Lister les utilisateurs
POST   /users                       # Créer un utilisateur
PUT    /users/:id                   # Modifier un utilisateur
DELETE /users/:id                   # Supprimer un utilisateur (auto-suppression interdite)
GET    /module-fields               # Champs ACF parsés depuis les modules PHP
GET    /module-template             # Template Blade + URLs CSS (?layout=slug)
GET    /plugins                     # Manifests des plugins installés
GET    /media/folders               # Dossiers de la médiathèque
POST   /media/folders               # Créer un dossier
PUT    /media/folders/:id           # Renommer un dossier
DELETE /media/folders/:id           # Supprimer un dossier
GET    /media                       # Lister les médias
POST   /media/upload                # Upload (Multer : 200 Mo max, 50 fichiers, image/video)
PUT    /media/:id                   # Modifier métadonnées d'un média
DELETE /media/:id                   # Supprimer un média
```

### Format de réponse

```javascript
// Succès
res.json(data); // 200
res.status(201).json({ id, message: "..." }); // Création

// Erreur
res.status(400).json({ error: "message" }); // Validation
res.status(401).json({ error: "..." }); // Non authentifié
res.status(403).json({ error: "..." }); // Non autorisé
res.status(404).json({ error: "..." }); // Non trouvé
res.status(500).json({ error: "..." }); // Erreur serveur
```

---

## Architecture Frontend (Astro)

```
frontend/src/
├── pages/
│   ├── index.astro                # Accueil dynamique (prerender: false, page via settings.frontPage)
│   ├── about.astro                # Page statique À propos
│   ├── blog/
│   │   ├── index.astro            # Liste des articles (grille 2 colonnes)
│   │   ├── [slug].astro           # Article CMS (getStaticPaths)
│   │   └── [...slug].astro        # Article MDX local (content collections)
│   ├── category/
│   │   └── [slug].astro           # Articles par catégorie (getStaticPaths)
│   └── pages/
│       └── [slug].astro           # Pages CMS dynamiques (prerender: false)
├── components/
│   ├── BaseHead.astro             # Meta, fonts, CSS global, ThemeInjector
│   ├── Header.astro               # Logo + nav + liens sociaux
│   ├── Footer.astro               # Copyright + liens sociaux
│   ├── Navigation.astro           # Menu hiérarchique depuis l'API (sous-menus hover)
│   ├── HeaderLink.astro           # Lien avec détection de route active
│   ├── FormattedDate.astro        # Date formatée (locale en-us)
│   ├── BlockRenderer.astro        # Routeur JSON → composants blocs (45+ types)
│   ├── ModuleStyles.astro         # Injection CSS conditionnelle par bloc utilisé
│   ├── ThemeInjector.astro        # CSS variables dynamiques depuis API settings
│   └── blocks/                    # 45+ composants de blocs
│       ├── Heading.astro, Text.astro, Image.astro, Hero.astro, Cta.astro, Spacer.astro, Html.astro
│       ├── NicklText.astro, NicklAccordion.astro, NicklGallery.astro, NicklHeadText.astro, ...
│       └── PluginBlock.astro      # Bloc générique (rendu server-side via POST /api/render-block)
├── layouts/
│   └── BlogPost.astro             # Layout articles MDX (hero image, dates, prose)
├── lib/
│   ├── api.ts                     # Client API (fetch, interfaces TS, gestion d'erreurs)
│   ├── module-classes.ts          # buildModuleClasses, cleanHtml, resolveLink, resolveBackgroundImage
│   └── module-helpers.ts          # extractYouTubeId, extractVimeoId, resolveImageUrl, resolveImageAlt
├── styles/
│   ├── global.css                 # Reset, typographie, prose, variables CSS
│   └── theme.css                  # 30+ CSS custom properties, presets de thème
├── content/
│   ├── content.config.ts          # Schéma collection blog (title, description, pubDate, heroImage)
│   └── blog/                      # Articles MDX locaux
└── consts.ts                      # SITE_TITLE, SITE_DESCRIPTION, getSiteInfo()
```

### Intégrations Astro

- `@astrojs/mdx` — Support MDX pour contenu local
- `@astrojs/sitemap` — Génération automatique de sitemap.xml
- `@astrojs/rss` — Flux RSS

### Proxy Vite (dev uniquement)

```javascript
// astro.config.mjs
'/nickl-assets' → 'http://localhost:3000'   // Assets compilés du thème Nickl
'/uploads'      → 'http://localhost:3000'   // Fichiers médias uploadés
```

### Client API (`lib/api.ts`)

**Fonctions exportées :**

```typescript
getAllPosts(): Promise<Post[]>
getPostBySlug(slug): Promise<Post | null>
getPostsByCategory(categorySlug): Promise<Post[]>
getAllCategories(): Promise<Category[]>
getCategoryBySlug(slug): Promise<Category | null>
getAllPages(): Promise<Page[]>
getPageBySlug(slug): Promise<Page | null>
getNavigation(): Promise<NavigationItem[]>
getSiteSettings(): Promise<SiteSettings>        // fallback defaults si erreur
getThemeSettings(): Promise<ThemeSettings>       // fallback defaults si erreur
formatContent(content: string): string           // \n → <br>
```

**Gestion d'erreurs** : try/catch, log console, retourne `null` ou `[]` en cas d'échec (jamais de throw).

### Interfaces TypeScript

```typescript
interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image?: string;
  author: { id: number; name: string };
  categories?: Array<{ id: number; name: string; slug?: string }>;
  tags?: string[];
  published_date: string;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface Page {
  id: number;
  title: string;
  slug: string;
  content: string;
  status: "draft" | "published";
  show_in_menu: boolean;
  menu_order: number;
  parent_id?: number;
  parent_title?: string;
  parent_slug?: string;
  created_at: string;
  updated_at: string;
}

interface NavigationItem {
  id: number;
  title: string;
  slug: string;
  menu_order: number;
  parent_id?: number;
  children?: NavigationItem[];
}

interface SiteSettings {
  siteName: string;
  siteDescription: string;
  frontPage: string;
}
interface ThemeSettings {
  useChildTheme: boolean;
  activeTheme: string;
}
```

---

## Système de blocs de contenu

Le contenu des pages est stocké en JSON dans la colonne `content` et rendu via `BlockRenderer.astro`. Chaque bloc a un `type` (string) et un `data` (objet).

### Blocs natifs (Astro pur)

| Type      | Composant     | Props principales                         |
| --------- | ------------- | ----------------------------------------- |
| `heading` | Heading.astro | level, text                               |
| `text`    | Text.astro    | title, body                               |
| `image`   | Image.astro   | src, alt, caption                         |
| `hero`    | Hero.astro    | sliders, blocks, CTAs (Swiper)            |
| `cta`     | Cta.astro     | title, description, buttonText, buttonUrl |
| `spacer`  | Spacer.astro  | —                                         |
| `html`    | Html.astro    | content (set:html brut)                   |

### Blocs Nickl (40 modules)

Tous les blocs Nickl suivent le même pattern :

```astro
---
import { buildModuleClasses } from '../../lib/module-classes';
const { data } = Astro.props;
const id = data.id || data.id_bloc;
const classes = buildModuleClasses(data);
const isVisible = (data.is_visible ?? 'yes') !== 'no';
---
{isVisible && (
  <div id={id} class={`module module-{type} ${classes}`}>
    {/* Background image optionnel */}
    <div class="container">
      {/* Contenu du bloc */}
    </div>
  </div>
)}
```

**Modules disponibles** : Accordion, Banner, BlocReferences, ClickableTiles, ColumnsTab, Contact, EventsSlider, Files, Form, FreePost, Gallery, GoogleReviews, HeadText, Icons, IllusVideo, ImagesSlider, ImagesVideosParallax, InstaFeed, KeyFigures, Link, LogosSlider, Map, NewsSlider, NewsletterForm, Ornament, PlanSite, Product, Quote, ReusableBloc, Review, Separator, Share, SliderTextVideo, Summary, Team, Text, TextImage, TextScrolling, ThreadsFeed, Video, Widget

### PluginBlock (fallback)

Les types de blocs non reconnus sont envoyés au backend via `POST /api/render-block` pour un rendu server-side (template Blade simplifié).

### ModuleStyles.astro

Injecte uniquement les fichiers CSS des blocs effectivement utilisés sur la page :

- Blocs Nickl : `/nickl-assets/css/{type}.css`
- Blocs plugins : `/plugin-assets/{plugin}/css/{type}.css`

### ThemeInjector.astro

Script inline qui :

1. Fetch `/settings/theme` et `/settings` au chargement
2. Injecte des CSS variables sur `:root` (couleurs, polices, spacing)
3. Charge dynamiquement les Google Fonts
4. Applique `data-theme="dark"` si thème sombre actif

---

## Framework Nickl (Thème modulaire)

Framework PHP basé sur Sage 6.x avec 40 modules ACF.

```
nickl/
├── app/
│   ├── Modules/               # 40 modules PHP (définitions ACF)
│   │   ├── BlockParams.php    # Paramètres partagés (titre, bg, padding, visibilité)
│   │   ├── Accordion.php      # ... jusqu'à Widget.php
│   │   └── ... (40 fichiers)
│   ├── FieldGroup/            # 10 groupes de champs ACF (Params, CustomFields, etc.)
│   ├── Helpers/               # 18 classes utilitaires (ThemeHelper, AcfHelper, etc.)
│   ├── Providers/             # ThemeServiceProvider, WooCommerceServiceProvider
│   ├── Posttype/              # Définitions CPT WordPress
│   ├── Taxonomy/              # Taxonomies custom
│   ├── Features/              # Toggles de fonctionnalités
│   ├── setup.php              # Hooks d'initialisation
│   └── filters.php            # Filtres WordPress
├── config/                    # 14 fichiers config (theme, acorn, scripts, ia, insta, etc.)
├── resources/
│   ├── views/                 # Templates Blade (sections, modules, WooCommerce)
│   ├── styles/
│   │   ├── app.scss           # Entry point principal (imports base, libs, components, modules)
│   │   ├── base/              # reset.scss, variables.scss, mixin.scss
│   │   ├── components/        # 14 fichiers (_buttons, _form, _sliders, _tabs, etc.)
│   │   ├── partials/          # 7 fichiers (_header, _footer, _sidebar, etc.)
│   │   └── modules/           # 40 fichiers SCSS (un par module)
│   └── scripts/
│       ├── app.js             # Entry JS principal
│       ├── admin.js           # Scripts admin WordPress
│       ├── autoload/          # Ajax handlers (AjaxRefs, AjaxNews, AjaxEvents)
│       └── util/              # Router, animation (GSAP), swipper, camelCase
├── public/                    # Output compilé (css/, js/, manifest.json, entrypoints.json)
├── bud.config.js              # Webpack/Bud — 6 entry points + 41 entry CSS modules
├── composer.json              # PHP 8.3+, roots/acorn 5.0.3, mobiledetect
└── package.json               # Node 24.8.0+, Bud 6.24.0
```

### Pattern des modules PHP

Chaque module = 1 classe statique avec une méthode `getLayout()` :

```php
namespace App\Modules;

use Extended\ACF\Fields\{Layout, Text, WYSIWYGEditor, Link, ButtonGroup, Repeater, Image};
use Extended\ACF\ConditionalLogic;

class TextSimple
{
    public static function getLayout($is_columns = false)
    {
        $fields = [];

        // Paramètres communs (sauf si imbriqué dans ColumnsTab)
        if ($is_columns === false) {
            $fields = array_merge($fields, [
                BlockParams::getBlocId(20),
                BlockParams::getBgColor(null, 20),
                BlockParams::getTopPadding(20),
                BlockParams::getBottomPadding(20),
                BlockParams::getBackground(),
                BlockParams::getBackgroundOpacity(),
                BlockParams::getBackgroundParallax(),
                BlockParams::getIsVisible(20),
            ]);
        }

        // Champs spécifiques au module
        $fields = array_merge($fields, [
            WYSIWYGEditor::make('Texte', 'text')->disableMediaUpload(),
            Link::make('Lien', 'cta')->wrapper(['width' => 50]),
            // ...
        ]);

        return Layout::make('Texte', 'text')
            ->layout('block')
            ->fields($fields);
    }
}
```

### BlockParams.php — Paramètres partagés

Méthodes statiques réutilisées par tous les modules :

| Méthode                                | Description                                       |
| -------------------------------------- | ------------------------------------------------- |
| `getBlocTitle()`                       | Titre + ID + alignement + style                   |
| `getBgColor($active, $width, $layout)` | Couleur de fond (primary/secondary/tertiary/none) |
| `getTopPadding($width, $default)`      | Padding haut (Normal/Small/None)                  |
| `getBottomPadding(...)`                | Padding bas                                       |
| `getIsVisible(...)`                    | Toggle affichage                                  |
| `getBackground()`                      | Image de fond                                     |
| `getBackgroundOpacity()`               | Opacité (range 0-100)                             |
| `getBackgroundParallax()`              | Effet parallax                                    |
| `getFullScreen($width)`                | Pleine largeur                                    |
| `getMargin($width)`                    | Marge réduite                                     |
| `getBannerHeight($width)`              | Hauteur bannière                                  |

### Build Nickl

Bud (Webpack 5) compile 6 entry points JS + 41 entry points CSS modules :

```bash
cd nickl
npm run build    # → public/css/*.css, public/js/*.js, manifest.json
```

Le backend compile aussi les CSS modules pour l'admin via `npm run css` (backend) → `backend/public/admin/modules/`.

---

## Système de plugins

```
plugins/
└── mon-plugin/
    ├── plugin.json            # Manifest (name, postTypes[], hasCategories)
    ├── templates/             # Templates Blade pour les blocs
    ├── css/                   # Styles du plugin
    └── admin-css/             # Styles admin du plugin
```

Le `plugin.json` déclare des Custom Post Types. Au boot du serveur, `migratePluginTables()` crée automatiquement les tables SQL correspondantes (`cpt_*`).

Les assets des plugins sont servis via `/plugin-assets/{plugin-dir}/`.

---

## Thématisation

### Settings en base de données

La table `settings` stocke 60+ clés couvrant :

- **Identité** : site_name, site_description, front_page
- **Thème** : theme_use_child, active_theme
- **Couleurs** : color_primary, color_secondary, color_tertiary, accent_color
- **Polices** : font_title, font_general (→ Google Fonts dynamiques)
- **Layout** : menu_seamless, rounded_corners, uppercase_titles
- **Tracking** : google_analytics_id, gtm_id, meta_pixel_id
- **Social** : social_facebook, social_instagram, social_linkedin, etc.
- **Footer/Newsletter/Maintenance/Popup** : configurations variées

### CSS Variables

`ThemeInjector.astro` injecte sur `:root` :

```css
--color-primary, --color-secondary, --color-tertiary
--font-title, --font-general
--accent, --accent-dark, --accent-gradient
--spacing-xs → --spacing-xl
--border-radius, --border-radius-sm, --border-radius-lg
```

### Presets de thème

5 presets disponibles : `default`, `dark`, `minimal`, `colorful`, `nature`.

Le thème `dark` active `[data-theme="dark"]` sur le HTML.

---

## Conventions de code

### Nommage

| Contexte                  | Convention            | Exemples                                              |
| ------------------------- | --------------------- | ----------------------------------------------------- |
| Tables/colonnes DB        | snake_case            | `post_categories`, `featured_image`, `published_date` |
| Clés settings             | snake_case            | `site_name`, `theme_use_child`, `active_theme`        |
| Champs ACF                | snake_case            | `bg_opacity`, `is_visible`, `style_choice`            |
| Routes/URLs/Slugs         | kebab-case            | `/api/render-block`, `mon-article`                    |
| Classes PHP               | PascalCase            | `TextSimple`, `BlockParams`, `ThemeHelper`            |
| Méthodes PHP              | camelCase             | `getLayout()`, `getBgColor()`                         |
| Namespaces PHP            | PascalCase            | `App\Modules`, `App\Helpers`                          |
| Fichiers controllers JS   | camelCase             | `postController.js`, `authController.js`              |
| Composants Astro          | PascalCase            | `BlockRenderer.astro`, `NicklGallery.astro`           |
| Variables/fonctions JS/TS | camelCase             | `getAllPosts()`, `buildModuleClasses()`               |
| Classes CSS/SCSS          | kebab-case            | `.module-gallery`, `.has-background-image`            |
| Fichiers SCSS             | kebab-case préfixé \_ | `_text-image.scss`, `_head-text.scss`                 |

### Patterns Backend

```javascript
// Model — objet avec méthodes statiques async (pas de try/catch, erreurs bubblent)
export const Post = {
  async findBySlug(slug) {
    const [rows] = await db.query("SELECT ... FROM posts WHERE slug = ?", [
      slug,
    ]);
    return rows[0];
  },
  async setCategories(postId, categoryIds) {
    /* ... */
  },
};

// Controller — async arrow function avec try/catch
export const getPostBySlug = async (req, res) => {
  try {
    const post = await Post.findBySlug(req.params.slug);
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch post" });
  }
};

// Route — middleware chain
router.get("/posts/:slug", postController.getPostBySlug); // public
router.post("/posts", authenticateToken, postController.createPost); // protégé
router.delete(
  "/users/:id",
  authenticateToken,
  isAdmin,
  userController.deleteUser,
); // admin

// Query DB — destructuring du résultat mysql2
const [rows] = await db.query("SELECT ...", [param1, param2]);
const [result] = await db.query("INSERT ...", [values]);
// result.insertId pour l'ID créé
```

### Patterns Frontend (Astro)

```astro
---
// Pages statiques — getStaticPaths (build time)
export async function getStaticPaths() {
  const posts = await getAllPosts();
  return posts.map(post => ({ params: { slug: post.slug }, props: { post } }));
}
const { post } = Astro.props;

// Pages dynamiques — prerender: false (request time)
export const prerender = false;
const { slug } = Astro.params;
const page = await getPageBySlug(slug);
if (!page) return Astro.redirect('/404');

// Blocs — props data + classes utilitaires
const { data } = Astro.props;
const classes = buildModuleClasses(data);     // maps ACF fields → CSS classes
const html = cleanHtml(data.text);            // remove Quill &nbsp; encoding
const link = resolveLink(data.cta);           // normalize ACF link (string|object)
const imgUrl = resolveImageUrl(data.image, apiOrigin, 'banner');
---
<div set:html={html} />  <!-- HTML brut depuis WYSIWYG -->
```

### Patterns Nickl/PHP

```php
// 1 module = 1 classe statique
class MonModule {
    public static function getLayout($is_columns = false) {
        $fields = [];
        if (!$is_columns) {
            $fields = array_merge($fields, [
                ...BlockParams::getBlocTitle(),    // spread pour multiple fields
                BlockParams::getBgColor(),
                BlockParams::getTopPadding(),
                BlockParams::getBottomPadding(),
                BlockParams::getIsVisible(),
            ]);
        }
        $fields = array_merge($fields, [ /* champs spécifiques */ ]);
        return Layout::make('Label', 'slug')->layout('block')->fields($fields);
    }
}

// Extended\ACF fluent API
Text::make('Label', 'key')
    ->wrapper(['width' => 50])
    ->default('valeur')
    ->required()
    ->conditionalLogic([ConditionalLogic::where('other_field', '!=', '')])
    ->helperText('Aide contextuelle');

// Champs admin width : 75, 50, 33, 25, 20 (% de largeur dans l'interface)
```

---

## Guide de contribution

### Ajouter un bloc frontend

1. Créer `frontend/src/components/blocks/MonBloc.astro`
2. L'enregistrer dans `BlockRenderer.astro` (switch sur `block.type`)
3. Ajouter le mapping CSS dans `ModuleStyles.astro` (type → fichier CSS)

### Ajouter une route API

1. Définir la route dans `backend/src/routes/api.js`
2. Créer ou modifier le controller dans `backend/src/controllers/`
3. Appliquer le middleware approprié : rien (public), `authenticateToken` (protégé), `authenticateToken + isAdmin` (admin)

### Ajouter un module Nickl

1. Créer la classe PHP dans `nickl/app/Modules/MonModule.php` (namespace `App\Modules`)
2. Implémenter `getLayout($is_columns = false)` avec les champs ACF
3. Créer le fichier SCSS `nickl/resources/styles/modules/_mon-module.scss`
4. Ajouter l'entry dans `nickl/bud.config.js` : `.entry('mon-module', ['@styles/modules/_mon-module.scss'])`
5. Créer le template Blade `nickl/resources/views/modules/mon-module.blade.php`
6. Compiler : `cd nickl && npm run build`

### Ajouter un plugin

1. Créer `plugins/mon-plugin/plugin.json` :
   ```json
   {
     "name": "Mon Plugin",
     "postTypes": [{ "slug": "mon-cpt", "hasCategories": true }]
   }
   ```
2. Ajouter les templates dans `plugins/mon-plugin/templates/`
3. Ajouter les styles dans `plugins/mon-plugin/css/` et `plugins/mon-plugin/admin-css/`
4. Redémarrer le backend (les tables `cpt_*` sont auto-créées au boot)

---

## Serveur statique (Backend)

Le backend sert 4 répertoires de fichiers statiques :

| Route            | Répertoire              | Contenu                         |
| ---------------- | ----------------------- | ------------------------------- |
| `/uploads`       | `backend/uploads/`      | Fichiers médias uploadés        |
| `/nickl-assets`  | `nickl/public/`         | CSS/JS compilés du thème        |
| `/plugin-assets` | `plugins/`              | Assets des plugins              |
| `/admin`         | `backend/public/admin/` | Interface d'administration HTML |

## Utilitaires Frontend

### module-classes.ts

| Fonction                                  | Description                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| `buildModuleClasses(data)`                | Convertit les champs ACF en classes CSS (bg color, padding, parallax, fullscreen) |
| `cleanHtml(html)`                         | Nettoie les `&nbsp;` encodés par Quill                                            |
| `isTruthy(val)`                           | Normalise les booleans ACF (true, 1, '1' → true)                                  |
| `resolveBackgroundImage(data, apiOrigin)` | Retourne `{ url, opacity }` pour l'image de fond                                  |
| `resolveBlocTitle(data)`                  | Retourne `{ title, style, align }` depuis les champs ACF                          |
| `resolveLink(raw)`                        | Normalise un lien ACF (string ou objet) → `{ url, title, target }`                |

### module-helpers.ts

| Fonction                                          | Description                                   |
| ------------------------------------------------- | --------------------------------------------- |
| `extractYouTubeId(url)`                           | Extrait l'ID YouTube (?v=, youtu.be/, embed/) |
| `extractVimeoId(url)`                             | Extrait l'ID Vimeo                            |
| `extractDailymotionId(url)`                       | Extrait l'ID Dailymotion                      |
| `resolveImageUrl(img, apiOrigin, preferredSize?)` | Résout URL image ACF (objet ou string)        |
| `resolveImageAlt(img)`                            | Extrait le texte alt d'un objet image ACF     |

## Styling

Le frontend utilise du **CSS pur** (pas de Tailwind côté Astro) :

- `global.css` — Reset, typographie, prose, variables CSS de base, max-width 720px
- `theme.css` — 30+ CSS custom properties surchargées par ThemeInjector
- Composants Astro : `<style>` scoped par défaut
- Blocs Nickl : `<style is:global>` (classes partagées entre modules)
- Breakpoints : 1200px, 1024px, 960px, 720px, 600px, 480px
