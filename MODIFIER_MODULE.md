# Modifier un module — Guide front-only

Étapes à suivre pour modifier un module existant **côté frontend uniquement**, sans toucher au dossier `nickl/` (déprécié).

> Le dossier `nickl/` est en cours de retrait. Toute la chaîne SCSS a été migrée dans `frontend/`. Ne pas y éditer de fichiers.

---

## 1. Lire avant de modifier

Avant toute modification, consulte ces fichiers pour comprendre le pattern existant :

| Fichier | Rôle |
|---|---|
| [frontend/src/components/blocks/Nickl{Module}.astro](frontend/src/components/blocks/) | Composant Astro — markup, classes, logique de rendu |
| [frontend/src/styles/nickl/modules/_{slug}.scss](frontend/src/styles/nickl/modules/) | SCSS source du module |
| [backend-php/templates/modules/{slug}.blade.php](backend-php/templates/modules/) | Template Blade (rendu serveur via `POST /api/render-block`) |
| [backend-php/generate-module-fields.php](backend-php/generate-module-fields.php) | Définitions des champs (ex-ACF) |

> **Convention de nommage** : le composant Astro est en PascalCase (`NicklTextImage.astro`), le SCSS en kebab-case avec underscore (`_text-image.scss`), le Blade en kebab-case (`text-image.blade.php`).

---

## 2. Modifier le markup (composant Astro)

Fichier : **`frontend/src/components/blocks/Nickl{Module}.astro`**

Pattern type :

```astro
---
import { buildModuleClasses, cleanHtml, resolveLink } from '../../lib/module-classes';
import { resolveImageUrl } from '../../lib/module-helpers';

const { data } = Astro.props;
const id = data.id || data.id_bloc;
const classes = buildModuleClasses(data);
const isVisible = (data.is_visible ?? 'yes') !== 'no';
---
{isVisible && (
  <div id={id} class={`module module-{slug} ${classes}`}>
    <div class="container">
      {/* Contenu du bloc */}
    </div>
  </div>
)}
```

### Helpers disponibles

- `buildModuleClasses(data)` → classes CSS (bg color, padding, parallax, fullscreen…)
- `cleanHtml(html)` → nettoie les `&nbsp;` Quill
- `resolveLink(raw)` → normalise un lien ACF
- `resolveImageUrl(img, apiOrigin, preferredSize?)` → URL image
- `resolveImageAlt(img)` → alt image
- `extractYouTubeId / extractVimeoId / extractDailymotionId(url)`

### Champs partagés (BlockParams)

Tous les modules supportent : `id_bloc`, `bg_color`, `top_padding`, `bottom_padding`, `is_visible`, `background` (image + opacité + parallax), `bloc_title` (titre + style + alignement). Ces champs sont gérés automatiquement par `buildModuleClasses()` — vérifie qu'ils sont bien appliqués.

---

## 3. Modifier le style (SCSS)

Fichier source : **`frontend/src/styles/nickl/modules/_{slug}.scss`**

Compile après modification :

```bash
cd frontend
npm run compile-css
```

Ce script (`frontend/scripts/compile-nickl-css.js`) :
- Compile chaque `_{slug}.scss` en `frontend/public/nickl-assets/css/{slug}.css`
- Compile aussi `app.scss`, `app-critical.scss`, `app-deferred.scss`
- Remplace l'ancien build Bud/Webpack du dossier `nickl/`

> **Ne jamais éditer directement** `frontend/public/nickl-assets/css/*.css` — ces fichiers sont générés.

### Ajouter un nouveau module au compilateur

Si tu crées un nouveau SCSS, ajoute son entrée dans `frontend/scripts/compile-nickl-css.js` :

```js
const moduleEntries = {
  // ...
  'mon-module': 'modules/_mon-module.scss',
};
```

### Alternative : style scoped dans le composant

Pour une retouche rapide isolée, tu peux ajouter directement dans le `.astro` :

```astro
<style>
  .module-mon-bloc { /* ... */ }
</style>
```

Pas de compilation à lancer, le style reste local au composant.

---

## 4. Modifier le rendu serveur (optionnel)

Si le module passe par `POST /api/render-block` (fallback `PluginBlock` ou rendu PHP côté CMS) :

- **Template Blade** : `backend-php/templates/modules/{slug}.blade.php`
- **Champs ACF** : `backend-php/generate-module-fields.php`

Pas de build à lancer côté PHP — les changements sont pris en compte à la prochaine requête.

---

## 5. Vérifications après modification

Toujours lancer ces vérifications avant de considérer la tâche terminée :

### Couverture des champs
Croiser **tous** les champs définis dans `backend-php/generate-module-fields.php` avec ceux utilisés dans le composant `.astro`. Si un champ existe en backend mais n'est pas exploité côté front, le mentionner explicitement.

### BlockParams
Vérifier que les paramètres communs sont bien gérés :
- bg color
- padding top / bottom
- visibilité (`is_visible`)
- background image + opacité + parallax
- fullscreen
- bloc title (titre + style + alignement)

### Build frontend
```bash
cd frontend && npm run build
```
Pas d'erreur TypeScript ni d'erreur de build.

### Compile CSS (si SCSS modifié)
```bash
cd frontend && npm run compile-css
```

### Rendu serveur (si Blade modifié)
```bash
curl -X POST http://localhost:3000/api/render-block \
  -H "Content-Type: application/json" \
  -d '{"type": "{slug}", "data": { /* données de test */ }}'
```
Tester avec :
- champs vides
- champs remplis
- variantes de style

### Vérification visuelle
Ouvrir une page de test contenant le module sur `http://localhost:4321/pages/{test-page}` et tester différentes combinaisons de paramètres.

---

## Récapitulatif rapide

| Je veux modifier… | Fichier(s) | Build à lancer |
|---|---|---|
| Le HTML / la logique de rendu | `frontend/src/components/blocks/Nickl{Module}.astro` | `cd frontend && npm run build` |
| Le style global du module | `frontend/src/styles/nickl/modules/_{slug}.scss` | `cd frontend && npm run compile-css` |
| Un style isolé temporaire | `<style>` dans le `.astro` | rien |
| Le rendu serveur (Blade) | `backend-php/templates/modules/{slug}.blade.php` | rien |
| Les champs disponibles | `backend-php/generate-module-fields.php` | rien |

---

## Anti-patterns

- Éditer `frontend/public/nickl-assets/css/*.css` directement (généré)
- Toucher à un fichier dans `nickl/` (déprécié)
- Oublier `npm run compile-css` après modif SCSS
- Oublier de gérer `is_visible`, `bg_color`, padding et image de fond dans un nouveau composant
