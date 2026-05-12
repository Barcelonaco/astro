# Anatomie d'une page Astro

Ce document explique comment est construite une page Astro dans ce projet, à travers l'exemple de [frontend/src/pages/[...slug].astro](frontend/src/pages/[...slug].astro) — la page qui affiche **n'importe quelle page créée depuis le back-office**.

L'objectif : qu'un développeur **comme une personne non-technique** puisse comprendre ce qui se passe.

---

## Table des matières

1. [Pour les non-développeurs : c'est quoi Astro ?](#1-pour-les-non-développeurs--cest-quoi-astro-)
2. [Structure d'un fichier `.astro`](#2-structure-dun-fichier-astro)
3. [Le fichier décortiqué, partie par partie](#3-le-fichier-décortiqué-partie-par-partie)
4. [Le flux complet : de l'URL à la page affichée](#4-le-flux-complet--de-lurl-à-la-page-affichée)
5. [Glossaire](#5-glossaire)

---

## 1. Pour les non-développeurs : c'est quoi Astro ?

Imagine un **moule à gaufres**.

- Le **back-office** (le CMS) est l'endroit où l'éditeur écrit la pâte : titre, texte, images, blocs.
- **Astro** est le moule qui transforme cette pâte en page web finale (HTML).
- Le **navigateur** de l'internaute reçoit la gaufre déjà cuite.

Particularité d'Astro : il fabrique les pages **à l'avance** (au moment du « build »), pas à chaque visite. Résultat : sites très rapides, peu de code envoyé au navigateur.

Une page Astro est donc une **recette** : elle dit

1. quelles données aller chercher,
2. comment les arranger en HTML,
3. quel style appliquer.

---

## 2. Structure d'un fichier `.astro`

Tout fichier `.astro` a **trois zones** distinctes :

```astro
---
// ZONE 1 — FRONTMATTER
// Code TypeScript exécuté côté serveur, au moment de la fabrication.
// Ici on récupère les données et on prépare les variables.
---

<!-- ZONE 2 — TEMPLATE -->
<!-- Le HTML de la page, avec des {expressions} pour insérer des données. -->

<style>
  /* ZONE 3 — STYLES */
  /* Du CSS qui ne s'applique qu'à ce composant. */
</style>
```

Analogie :

- **Frontmatter** = la liste de courses + la préparation des ingrédients
- **Template** = le dressage de l'assiette
- **Style** = la décoration finale

---

## 3. Le fichier décortiqué, partie par partie

### 3.1. Les imports (lignes 1-12)

```ts
import BaseHead from "../components/BaseHead.astro";
import { getAllPages, getFrontendBootstrap } from "../lib/api";
```

C'est l'équivalent de **« quels outils je sors du tiroir avant de cuisiner »**.

Trois familles d'outils :

- **Composants** (`BaseHead`, `Header`, `Footer`…) : briques de page réutilisables.
- **Helpers de données** : fonctions qui vont chercher l'info auprès de l'API PHP.
- **Helpers d'images et SEO** : utilitaires de transformation.

---

### 3.2. `getStaticPaths()` — la liste des pages à fabriquer (lignes 14-29)

```ts
export async function getStaticPaths() {
  const pages = await getAllPages();
  return pages
    .filter(...)
    .map((p) => ({ params: { slug: p.slug }, props: { page: p } }));
}
```

**Pour les non-devs :** le fichier s'appelle `[...slug].astro`. Les crochets veulent dire « je m'occupe de toutes les URLs ». Mais Astro ne peut pas deviner quelles pages existent : `getStaticPaths` lui donne la **liste**.

C'est comme dire au moule : « voici les 47 saveurs de gaufres à préparer ». Astro fabrique alors 47 pages HTML, une par saveur.

Trois filtres importants :

- **Slugs réservés** (`blog`, `search`, etc.) : ces URLs sont déjà gérées par d'autres fichiers, on les écarte pour éviter les conflits.
- **Statut publié** : on ne fabrique pas les brouillons.
- **Date future** : on n'affiche pas les pages programmées avant leur date.

---

### 3.3. Les helpers locaux (lignes 31-71)

#### `parseBlocks()` — JSON ou HTML ?

Le contenu d'une page peut être de deux formes :

- un **tableau de blocs** (page composée dans le back-office, format JSON),
- du **HTML brut** (page classique).

`parseBlocks` essaie de lire le contenu comme du JSON ; si ça échoue, c'est que c'est du HTML.

#### `extractLcpImages()` — la photo principale en avance

**Pour les non-devs :** Google mesure la vitesse des sites. Une métrique-clé : le temps avant que la **plus grosse image** s'affiche (« LCP »). Plus c'est rapide, mieux le site est référencé.

Cette fonction repère la première image importante de la page (héro, bannière…) et la signale au navigateur **avant même** qu'il commence à lire le HTML, pour qu'il la télécharge en parallèle.

---

### 3.4. Récupération des données (lignes 73-81)

```ts
const { page, isPrivate } = Astro.props;
const { siteInfo, styleSettings, navigation } = await getFrontendBootstrap();
```

Deux sources :

- **`Astro.props`** : les données passées par `getStaticPaths` (la page elle-même).
- **`getFrontendBootstrap()`** : un seul appel à l'API qui ramène **tout** (paramètres du site, menus, identité). On évite ainsi 5 appels séparés.

**Bonne pratique :** un appel groupé > plusieurs appels séquentiels.

---

### 3.5. Le booléen pivot (lignes 83-85)

```ts
const blocks = parseBlocks(page.content);
const isBlockPage = blocks !== null;
```

`isBlockPage` décide tout le reste de la page :

- **vrai** → on affiche des modules construits dans le back-office,
- **faux** → on affiche le HTML legacy dans une mise en page d'article (template préfabriqué, ex : les actualités).

---

### 3.6. Surcharge des couleurs par page (lignes 87-100)

Certaines pages doivent avoir un thème de couleurs différent du reste du site (ex. landing page promo). Le back-office le permet via le champ `color_overrides`.

Le code transforme ce JSON :

```json
{ "primary_color": "#ff0", "background_color": "#000" }
```

en variables CSS :

```css
--color-primary: #ff0;
--color-background: #000;
```

appliquées plus tard sur la balise `<main>`. Le navigateur résout automatiquement.

**Pour les non-devs :** on injecte les nouvelles couleurs sans recompiler le site.

---

### 3.7. Le SEO (lignes 102-110)

Pattern classique « valeur par défaut + override optionnel » :

```ts
let seoTitle = `${page.title} | ${siteName}`; // par défaut
if (seo?.enabled) seoTitle = seo.meta_title; // surcharge si activée
```

Si l'éditeur a rempli le bloc SEO du back-office, on utilise sa valeur ; sinon, on génère automatiquement.

---

### 3.8. Les données structurées (lignes 112-120)

```ts
const schemaOrg = buildSchemaOrg({ page, ... });
```

Génère un bloc `<script type="application/ld+json">` que Google lit pour afficher des **résultats enrichis** dans la recherche (étoiles, dates, fil d'Ariane…). C'est invisible à l'œil nu mais essentiel au référencement.

---

### 3.9. Classes du `<body>` (lignes 122-126)

Les paramètres globaux d'identité (« coins arrondis ? », « tout en majuscules ? ») sont traduits en classes CSS sur le `<body>`. Le reste du CSS s'adapte ensuite.

---

### 3.10. Le template HTML (lignes 128-170)

C'est l'**assemblage final**. La structure est classique :

```
<html>
  <head>
    BaseHead         ← titre, meta, preload de l'image
    schema.org       ← données structurées Google
    ModuleStyles     ← CSS spécifique aux blocs présents
  </head>

  <body>
    Header           ← logo + navigation
    <main>
      <article>
        <BlockRenderer> ou <prose>  ← le contenu
      </article>
    </main>
    Footer
    SiteOverlays      ← popups, cookies, etc.
    DeferredLoader    ← scripts non critiques chargés après
  </body>
</html>
```

#### Quelques tournures Astro à connaître

| Syntaxe                    | Ce que ça fait                                  |
| -------------------------- | ----------------------------------------------- |
| `{maVariable}`             | Insère la valeur de la variable                 |
| `{condition && <X />}`     | Affiche `X` seulement si la condition est vraie |
| `{cond ? <A/> : <B/>}`     | Affiche `A` ou `B` selon la condition           |
| `<Component prop={val} />` | Appelle un composant et lui passe une valeur    |
| `set:html={...}`           | Insère du HTML brut (à utiliser avec prudence)  |

#### Trois composants à comprendre

- **`<ModuleStyles blocks={blocks} />`** — regarde les blocs présents et n'inclut **que** les feuilles de style des modules utilisés. Pas de CSS inutile.
- **`<BlockRenderer blocks={blocks} />`** — le **chef d'orchestre des blocs**. Pour chaque bloc, il affiche le bon composant (`NicklHero`, `NicklTextImage`, etc.).
- **`<DeferredLoader />`** — charge les scripts non essentiels (animations, sliders) **après** le rendu initial, pour ne pas ralentir l'affichage.

---

### 3.11. Le script de protection des pages privées (lignes 159-170)

```js
if (document.body.dataset.private === "true") {
  const token = localStorage.getItem("auth_token");
  if (!token) document.body.innerHTML = "<page de login>";
}
```

Si la page est marquée « privée » dans le CMS, on vérifie côté navigateur qu'un jeton de connexion existe. Sinon, on remplace tout le contenu par un message.

> **Attention** : ce n'est pas une vraie sécurité. Quelqu'un qui désactive JavaScript verra le contenu. Pour une protection sérieuse, il faut une vérification côté serveur.

---

### 3.12. Les styles scopés (`<style>`)

```astro
<style>
  .title { color: white; }
  .prose :global(h2) { margin-top: 2em; }
</style>
```

**Pour les non-devs :** par défaut, les styles d'un fichier `.astro` ne s'appliquent **qu'à ce fichier**. Astro ajoute en interne un identifiant unique aux classes pour éviter les conflits avec d'autres pages. C'est comme un **mur invisible** autour du composant.

`:global(...)` perce ce mur quand on a besoin de cibler du HTML inséré dynamiquement (qui n'a pas l'identifiant unique).

---

### 3.13. Les styles globaux (`<style is:global>`)

```astro
<style is:global>
  main.has-color-overrides .module h1 { color: var(--color-default); }
</style>
```

`is:global` désactive le mur : ces styles s'appliquent **partout** dans la page, y compris dans les autres composants (les modules `NicklXxx`).

Utilisé ici parce qu'on veut surcharger les couleurs **dans les modules**, qui sont eux-mêmes des composants scopés. Sans `is:global`, on ne pourrait pas les atteindre.

---

## 4. Le flux complet : de l'URL à la page affichée

```
1.  L'éditeur crée une page « ma-page » dans le back-office PHP.
                          │
                          ▼
2.  Au moment du build, Astro appelle getStaticPaths().
    → reçoit la liste de toutes les pages publiées.
    → décide qu'il faut fabriquer /ma-page.
                          │
                          ▼
3.  Pour chaque page, Astro exécute le frontmatter :
    - appelle getFrontendBootstrap() pour les settings globaux,
    - parse le contenu (blocs ou HTML),
    - calcule SEO, schema.org, classes body, surcharge couleurs.
                          │
                          ▼
4.  Astro assemble le HTML :
    <head> avec metas et preloads ;
    <body> avec Header, BlockRenderer, Footer.
                          │
                          ▼
5.  Le HTML est écrit en dur dans dist/ma-page/index.html.
                          │
                          ▼
6.  L'internaute visite /ma-page :
    le serveur lui sert directement le fichier HTML pré-fabriqué.
    → ultra-rapide, pas de calcul à la volée.
                          │
                          ▼
7.  Une fois la page affichée, DeferredLoader charge en arrière-plan
    les sliders, animations et autres scripts secondaires.
```

---

## 5. Glossaire

| Terme                    | Définition simple                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------ |
| **Astro**                | Outil qui fabrique des pages HTML à partir de composants `.astro`.                   |
| **Composant**            | Un bloc de page réutilisable (ex. un Header, un Footer).                             |
| **Frontmatter**          | La zone entre `---` en haut d'un fichier `.astro`. Code exécuté côté serveur.        |
| **Template**             | La partie HTML d'un fichier `.astro`.                                                |
| **Build**                | Étape où Astro génère tous les fichiers HTML d'un coup.                              |
| **SSG**                  | « Static Site Generation » — fabrication des pages à l'avance.                       |
| **Slug**                 | Partie de l'URL qui identifie une page (ex. `mon-article` dans `/blog/mon-article`). |
| **getStaticPaths**       | Fonction qui dit à Astro quelles pages fabriquer.                                    |
| **Props**                | Données passées d'un composant parent à un composant enfant.                         |
| **Bloc / Module**        | Une section de page composable (héro, gallery, formulaire…).                         |
| **LCP**                  | « Largest Contentful Paint » — temps avant que la plus grosse image s'affiche.       |
| **JSON-LD / Schema.org** | Données structurées lues par Google pour mieux référencer le site.                   |
| **JWT**                  | Jeton de connexion stocké dans le navigateur après authentification.                 |
| **Style scopé**          | Style qui ne s'applique qu'à un composant, pas au reste du site.                     |

---

## Pour aller plus loin

- [README.md](README.md) — vue d'ensemble du projet.
- [MODIFIER_MODULE.md](MODIFIER_MODULE.md) — comment modifier un module existant.
- [frontend/src/pages/](frontend/src/pages/) — toutes les routes du site.
- [frontend/src/components/blocks/](frontend/src/components/blocks/) — les composants de bloc.
- Documentation officielle Astro : https://docs.astro.build
