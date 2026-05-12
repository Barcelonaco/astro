# Plugin privé site-spécifique

Guide complet pour créer un plugin privé destiné à **un seul site** (ou un sous-ensemble de sites), sans le commiter dans le monorepo `plugins/`.

---

## 1. Concept

| Type | Emplacement | Versionning | Distribution |
|------|------------|-------------|--------------|
| **Plugin partagé** (public, multi-sites) | `astro/plugins/<slug>/` | Commit dans le monorepo | Tous les sites héritent du plugin |
| **Plugin privé site** (ce guide) | `EXTERNAL_PLUGINS_DIR/<slug>/` | Repo git séparé OU dossier local | Seul le site cible y a accès |

### Pourquoi externe

- Code client confidentiel (pas dans git monorepo public)
- Déploiement indépendant du core
- Activable / désactivable par site sans toucher au monorepo
- Aucun import statique côté frontend Astro (rendu server-side via `/api/render-block`)

### Comment ça marche

Le backend PHP scanne **deux racines** au boot :

1. `astro/plugins/` — plugins partagés du monorepo
2. `EXTERNAL_PLUGINS_DIR` — racine externe (env var, optionnelle)

Logique dans [backend-php/controllers/PluginController.php](../backend-php/controllers/PluginController.php) → `getPluginRoots()`.
Autoload des plugins actifs dans [backend-php/index.php:82-98](../backend-php/index.php#L82-L98).

---

## 2. Configuration de la racine externe

### Sur le site cible (uniquement)

Édite `backend-php/.env` du site :

```bash
EXTERNAL_PLUGINS_DIR=/var/www/vhosts/<site>/plugins-private
```

Ou en dev local :

```bash
EXTERNAL_PLUGINS_DIR=/Users/chulee/Sites/astro-plugins-<client>
```

**Ne commit jamais cette ligne dans `.env.example` du monorepo.** Elle est par-site.

### Sur les autres sites

Variable absente → backend ignore la racine, build/runtime fonctionnent normalement.

---

## 3. Anatomie d'un plugin privé

Structure minimale :

```
<EXTERNAL_PLUGINS_DIR>/
└── mon-plugin/
    ├── plugin.json                    # Manifest (obligatoire)
    ├── backend/
    │   ├── autoload.php               # Point d'entrée PHP (routes, migrations)
    │   ├── MonPluginController.php    # Contrôleur(s)
    │   └── tests/                     # PHPUnit (optionnel)
    ├── module-fields/                 # Champs ACF des blocs (optionnel)
    │   └── MonBloc.php
    ├── templates/                     # Templates Blade rendus côté backend
    │   └── mon-bloc.blade.php
    ├── admin/                         # Pages admin HTML (optionnel)
    │   └── settings.html
    ├── admin-css/                     # CSS pour l'admin (optionnel)
    │   └── settings.css
    ├── css/                           # CSS frontend (optionnel)
    │   └── mon-bloc.css
    ├── seeds/                         # Données d'init (optionnel)
    └── composer.json                  # Dépendances PHP (optionnel)
```

### Repo git séparé

Recommandé pour versionner :

```bash
mkdir -p /chemin/vers/mon-plugin
cd /chemin/vers/mon-plugin
git init
git remote add origin git@github.com:<org>/<plugin-repo>.git
```

`EXTERNAL_PLUGINS_DIR` peut pointer vers le dossier parent contenant un ou plusieurs plugins, ou directement vers un plugin unique.

---

## 4. Manifest `plugin.json`

Schéma complet :

```json
{
  "name": "mon-plugin",
  "label": "Mon Plugin",
  "version": "1.0.0",
  "description": "Description courte affichée dans l'admin.",
  "faIcon": "fa-solid fa-cube",

  "requires_ecommerce_enabled": false,

  "modules": {
    "category": {
      "id": "mon-plugin",
      "label": "Mon Plugin",
      "faIcon": "fa-solid fa-cube"
    },
    "items": [
      { "name": "MonBloc", "label": "Mon Bloc" }
    ]
  },

  "postTypes": [
    {
      "slug": "mon_cpt",
      "label": "Item",
      "labelPlural": "Items",
      "isFemale": false,
      "faIcon": "fa-solid fa-list",
      "supports": ["title", "slug", "featured_image", "content", "status"],
      "fields": [
        { "name": "ref", "label": "Référence", "type": "Text" },
        { "name": "price", "label": "Prix", "type": "Number" }
      ],
      "hasCategories": false
    }
  ],

  "admin_pages": [
    {
      "slug": "settings",
      "label": "Paramètres Mon Plugin",
      "url": "/plugin-assets/mon-plugin/admin/settings.html",
      "min_role": "admin"
    }
  ]
}
```

### Champs

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `name` | Oui | Slug technique (kebab-case). Doit matcher le nom du dossier. |
| `label` | Oui | Nom affiché dans l'admin. |
| `version` | Oui | SemVer. |
| `description` | Non | Texte court dans la liste plugins. |
| `faIcon` | Non | Classe FontAwesome. **Pas d'emoji** (cf [feedback no emojis](../../.claude/projects/-Users-chulee-Sites-astro/memory/feedback_no_emojis.md)). |
| `requires_ecommerce_enabled` | Non | `true` si dépend du plugin ecommerce. |
| `modules` | Non | Blocs de contenu (ajoutés à la palette du builder). |
| `postTypes` | Non | CPT auto-créés en DB au boot. |
| `admin_pages` | Non | Pages HTML accessibles depuis le menu admin. |

### Types de champs (`fields[].type`)

`Text`, `Textarea`, `Number`, `Select`, `TrueFalse`, `Date`, `File`, `Photos`, `Repeater` (avec `subFields`), `WYSIWYG`.

---

## 5. Backend PHP

### Autoload (`backend/autoload.php`)

Point d'entrée du plugin. Chargé automatiquement par [backend-php/index.php:89](../backend-php/index.php#L89) si actif :

```php
<?php
// Charger le contrôleur
require_once __DIR__ . '/MonPluginController.php';

// Charger les dépendances composer du plugin (si composer.json présent)
if (file_exists(__DIR__ . '/../vendor/autoload.php')) {
    require_once __DIR__ . '/../vendor/autoload.php';
}

// Enregistrer les routes via le hook system
register_plugin_route('GET', '/api/mon-plugin/items', function () {
    MonPluginController::listItems();
});

register_plugin_route('POST', '/api/mon-plugin/items', function () {
    MonPluginController::createItem();
}, ['auth' => true]);

// Enregistrer les migrations DB
register_plugin_migration('mon_plugin_extra_table', function (\PDO $pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS mon_plugin_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        action VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
});
```

Helpers disponibles : voir [backend-php/helpers/plugin-hooks.php](../backend-php/helpers/plugin-hooks.php).

### Contrôleur (`backend/MonPluginController.php`)

```php
<?php

class MonPluginController
{
    public static function listItems(): void
    {
        global $pdo;

        $stmt = $pdo->query("SELECT * FROM cpt_mon_cpt WHERE status = 'published'");
        $items = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        header('Content-Type: application/json');
        echo json_encode($items);
    }

    public static function createItem(): void
    {
        $body = json_decode(file_get_contents('php://input'), true);

        // Validation
        if (empty($body['title'])) {
            http_response_code(400);
            echo json_encode(['error' => 'title required']);
            return;
        }

        global $pdo;
        $stmt = $pdo->prepare("INSERT INTO cpt_mon_cpt (title, slug, status) VALUES (?, ?, 'published')");
        $stmt->execute([$body['title'], slugify($body['title'])]);

        http_response_code(201);
        echo json_encode(['id' => $pdo->lastInsertId()]);
    }
}
```

### Tables CPT auto-créées

Les `postTypes` du `plugin.json` génèrent automatiquement au boot :

- `cpt_<slug>` — items
- `cpt_<slug>_categories` (si `hasCategories: true`)
- `cpt_<slug>_category_map` (si `hasCategories: true`)

Pas de migration manuelle nécessaire pour ces tables. Pour des tables additionnelles, utiliser `register_plugin_migration()`.

---

## 6. Champs ACF des blocs (`module-fields/MonBloc.php`)

Définit les champs admin du bloc dans le builder de pages.

```php
<?php

namespace MonPlugin\Modules;

use Extended\ACF\Fields\{Layout, Text, WYSIWYGEditor, Image, Link};
use App\Modules\BlockParams;

class MonBloc
{
    public static function getLayout($is_columns = false)
    {
        $fields = [];

        if (!$is_columns) {
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

        $fields = array_merge($fields, [
            Text::make('Titre', 'title')->required(),
            WYSIWYGEditor::make('Contenu', 'content')->disableMediaUpload(),
            Image::make('Image', 'image')->returnFormat('array'),
            Link::make('Bouton', 'cta')->wrapper(['width' => 50]),
        ]);

        return Layout::make('Mon Bloc', 'mon-bloc')
            ->layout('block')
            ->fields($fields);
    }
}
```

**Important** : ne **jamais** modifier l'ordre/layout des `BlockParams` globaux (cf [feedback no_blockparams_layout_change](../../.claude/projects/-Users-chulee-Sites-astro/memory/feedback_no_blockparams_layout_change.md)).

---

## 7. Template Blade (`templates/mon-bloc.blade.php`)

Le template est rendu **côté backend** via `POST /api/render-block`. Le frontend Astro utilise le composant générique `PluginBlock.astro` qui appelle cette route.

```blade
@php
  $id = $data['id'] ?? '';
  $title = $data['title'] ?? '';
  $content = $data['content'] ?? '';
  $cta = $data['cta'] ?? null;

  // Classes utilitaires (bg, padding, visibilité, parallax)
  $classes = build_module_classes($data);
  $isVisible = ($data['is_visible'] ?? 'yes') !== 'no';
@endphp

@if ($isVisible)
<div id="{{ $id }}" class="module module-mon-bloc {{ $classes }}">
  @if (!empty($data['background']))
    <div class="module__bg" style="background-image: url('{{ $data['background'] }}'); opacity: {{ ($data['bg_opacity'] ?? 100) / 100 }};"></div>
  @endif

  <div class="container">
    @if ($title)
      <h2 class="module__title">{{ $title }}</h2>
    @endif

    @if ($content)
      <div class="module__content">{!! $content !!}</div>
    @endif

    @if ($cta && !empty($cta['url']))
      <a href="{{ $cta['url'] }}" target="{{ $cta['target'] ?? '_self' }}" class="btn">
        {{ $cta['title'] ?? 'En savoir plus' }}
      </a>
    @endif
  </div>
</div>
@endif
```

### Couleur des titres selon le fond

Respecter [feedback title_colors_by_bg](../../.claude/projects/-Users-chulee-Sites-astro/memory/feedback_title_colors_by_bg.md) :
- bg `primary`/`secondary` → titre blanc
- bg `tertiary` → couleur par défaut
- bg `none` → hiérarchie h2/h3/h4

---

## 8. CSS frontend (`css/mon-bloc.css`)

Servi automatiquement via `/plugin-assets/mon-plugin/css/mon-bloc.css`. Injecté par `ModuleStyles.astro` quand le bloc est utilisé.

```css
.module-mon-bloc {
  position: relative;
  padding: var(--spacing-l) 0;
}

.module-mon-bloc .module__title {
  font-family: var(--font-title);
  margin-bottom: var(--spacing-m);
}

.module-mon-bloc .module__content {
  max-width: 720px;
  margin: 0 auto;
}
```

Utiliser les CSS variables du thème (`--color-primary`, `--font-general`, etc.) pour respecter la thématisation dynamique.

---

## 9. Page admin (`admin/settings.html`)

Servie via `/plugin-assets/mon-plugin/admin/settings.html`. Iframe-friendly, pas de framework imposé.

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="/plugin-assets/mon-plugin/admin-css/settings.css">
  <title>Paramètres Mon Plugin</title>
</head>
<body>
  <h1>Paramètres Mon Plugin</h1>

  <form id="settings-form">
    <label>
      Clé API
      <input type="text" name="api_key" />
    </label>
    <button type="submit">Enregistrer</button>
  </form>

  <script>
    const token = localStorage.getItem('admin_token');

    document.getElementById('settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ mon_plugin_api_key: data.api_key }),
      });
    });
  </script>
</body>
</html>
```

**Pas d'emoji.** Utiliser des SVG inline (24×24, `stroke="currentColor"`, `fill="none"`) pour les icônes.

---

## 10. Activation / désactivation

### Via admin

Page `Plugins` du backoffice → toggle activer/désactiver. Stocké en DB (`settings.plugin_<slug>_active`).

### Via API

```bash
curl -X PUT http://localhost:3000/api/plugins/mon-plugin/active \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"active": true}'
```

Un plugin **inactif** :
- Son `backend/autoload.php` n'est pas chargé
- Ses blocs sont filtrés du rendu (cf `inactiveTypes` dans [BlockRenderer.astro](../frontend/src/components/BlockRenderer.astro))
- Ses tables CPT restent en DB (pas de drop automatique)

---

## 11. Tests locaux

### 1. Boot backend

```bash
cd backend-php
php -S localhost:3000 index.php
```

Vérifier dans les logs :
- `[plugin] mon-plugin loaded` (autoload OK)
- Pas d'erreur PHP

### 2. Manifest reconnu

```bash
curl http://localhost:3000/api/plugins | jq '.[] | select(.name == "mon-plugin")'
```

### 3. Rendu d'un bloc

```bash
curl -X POST http://localhost:3000/api/render-block \
  -H "Content-Type: application/json" \
  -d '{
    "type": "mon-bloc",
    "data": {
      "id": "test",
      "title": "Hello",
      "content": "<p>World</p>",
      "bg_color": "primary"
    }
  }'
```

Doit retourner du HTML avec `<div class="module module-mon-bloc has-bg-primary">`.

### 4. Build frontend

```bash
cd frontend && npm run build
```

Le build **doit passer** même si le plugin n'existe pas. C'est garanti par l'absence d'import statique dans `BlockRenderer.astro` (les types inconnus tombent dans `default` → `PluginBlock`).

### 5. Vérification visuelle

Crée une page de test dans l'admin contenant le bloc, puis ouvre `http://localhost:4321/pages/<test-page>`.

---

## 12. Déploiement

### Stratégie 1 — Repo git séparé + checkout CI

`.github/workflows/deploy-<site>.yml` du site cible :

```yaml
- name: Checkout main repo
  uses: actions/checkout@v4

- name: Checkout plugin privé
  uses: actions/checkout@v4
  with:
    repository: <org>/mon-plugin
    token: ${{ secrets.PLUGIN_TOKEN }}
    path: plugins-private/mon-plugin

- name: Set EXTERNAL_PLUGINS_DIR
  run: echo "EXTERNAL_PLUGINS_DIR=$GITHUB_WORKSPACE/plugins-private" >> backend-php/.env
```

### Stratégie 2 — Plugin déjà sur le serveur

Le serveur de prod a `EXTERNAL_PLUGINS_DIR=/var/poolp-plugins` configuré. Tu fais ton `git pull` du plugin séparément :

```bash
ssh user@server
cd /var/poolp-plugins/mon-plugin
git pull origin main
```

Le backend recharge le plugin au prochain hit (autoload exécuté à chaque requête PHP).

### Stratégie 3 — Submodule (déconseillé)

`git submodule add` dans le monorepo. **Évite** : casse l'isolation site-spécifique, le submodule devient visible dans tous les checkouts du monorepo.

---

## 13. Multi-site

Variables d'env par site :

| Site | `EXTERNAL_PLUGINS_DIR` | Plugins privés disponibles |
|------|------------------------|----------------------------|
| Site test | (non défini) | aucun |
| Site client A | `/var/clientA-plugins` | `client-a-feature`, `client-a-billing` |
| Site client B | `/var/clientB-plugins` | `client-b-portal` |
| Site poolp | `/var/poolp-plugins` | `poolp-configurator`, `poolp-box-finitions`, … |

Le **monorepo reste identique**. Seul le `.env` du site cible change.

---

## 14. Checklist création plugin privé

- [ ] Repo git créé (séparé du monorepo)
- [ ] `plugin.json` rempli avec `name`, `label`, `version`
- [ ] `backend/autoload.php` enregistre routes / migrations
- [ ] Contrôleur PHP créé et testé
- [ ] (Si bloc) `module-fields/<Module>.php` avec champs ACF
- [ ] (Si bloc) `templates/<slug>.blade.php` rend le HTML
- [ ] (Si bloc) `css/<slug>.css` style frontend
- [ ] (Si page admin) `admin/<page>.html` + `admin-css/<page>.css`
- [ ] Aucun emoji, icônes SVG inline ou FontAwesome
- [ ] BlockParams globaux non modifiés
- [ ] Couleurs des titres respectent les règles selon bg
- [ ] Test `curl /api/render-block` OK
- [ ] Build frontend `npm run build` passe
- [ ] Test visuel sur `http://localhost:4321/pages/<test>`
- [ ] `EXTERNAL_PLUGINS_DIR` configuré sur le site cible **uniquement**
- [ ] Plugin **non commité** dans le monorepo
- [ ] Workflow CI du site cible checkout le plugin

---

## 15. Pièges courants

| Symptôme | Cause | Solution |
|----------|-------|----------|
| Build frontend fail `Could not load .../templates/X.astro` | Import statique dans `BlockRenderer.astro` | Vire l'import + case → tombe dans `default` PluginBlock |
| Plugin pas listé dans `/api/plugins` | `EXTERNAL_PLUGINS_DIR` mal défini ou dossier absent | Vérifie `getenv('EXTERNAL_PLUGINS_DIR')` côté PHP |
| Bloc retourne du JSON au lieu du HTML | Template Blade absent ou mal nommé | Fichier doit être `templates/<type>.blade.php` exact |
| `cpt_<slug>` table absente | Plugin pas activé au boot | Active le plugin OU restart backend |
| Routes plugin 404 | `register_plugin_route()` pas appelé | Vérifie autoload.php exécuté (log au boot) |
| Conflits avec plugin partagé même nom | Deux plugins même `name` | Renomme le slug du privé |

---

## Références

- Hooks plugin : [backend-php/helpers/plugin-hooks.php](../backend-php/helpers/plugin-hooks.php)
- Loader : [backend-php/index.php:82-98](../backend-php/index.php#L82-L98)
- Contrôleur plugins : [backend-php/controllers/PluginController.php](../backend-php/controllers/PluginController.php)
- Render block : [backend-php/controllers/RenderBlockController.php](../backend-php/controllers/RenderBlockController.php)
- Composant Astro générique : [frontend/src/components/blocks/PluginBlock.astro](../frontend/src/components/blocks/PluginBlock.astro)
- Exemple complet (poolp) : `astro-plugins-poolp/` (repo séparé)
- Exemple monorepo (ecommerce) : [plugins/ecommerce/](../plugins/ecommerce/)
