# Guide Multisite

Ce guide explique comment transformer votre installation actuelle en système multisite.

## Architecture Multisite

```
/
├── backend/              # CMS unique pour tous les sites
├── site-principal/       # Premier site (renommé depuis frontend/)
├── site-anglais/         # Deuxième site (version anglaise)
├── site-partenaire/      # Troisième site (pour un partenaire)
└── package.json          # Scripts globaux
```

## Étape 1 : Préparer le Backend

### 1.1 Ajouter le champ "site" aux collections

Éditez `backend/src/payload.config.ts` :

```typescript
// Dans la collection 'posts'
{
  name: 'site',
  type: 'select',
  required: true,
  defaultValue: 'site-principal',
  options: [
    { label: 'Site Principal', value: 'site-principal' },
    { label: 'Site Anglais', value: 'site-anglais' },
    { label: 'Site Partenaire', value: 'site-partenaire' },
  ],
  admin: {
    position: 'sidebar',
  },
}
```

Ajoutez ce champ à toutes les collections : `posts`, `categories`, `pages`.

### 1.2 Ajouter des filtres par défaut

```typescript
{
  slug: 'posts',
  admin: {
    defaultColumns: ['title', 'site', 'status'],
    useAsTitle: 'title',
  },
  // ... reste de la config
}
```

### 1.3 Ajouter une configuration globale par site

```typescript
{
  slug: 'site-settings',
  fields: [
    {
      name: 'site',
      type: 'select',
      required: true,
      unique: true,
      options: [
        { label: 'Site Principal', value: 'site-principal' },
        { label: 'Site Anglais', value: 'site-anglais' },
        { label: 'Site Partenaire', value: 'site-partenaire' },
      ],
    },
    {
      name: 'siteName',
      type: 'text',
      required: true,
    },
    {
      name: 'siteDescription',
      type: 'textarea',
      required: true,
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'domain',
      type: 'text',
      admin: {
        description: 'Domaine du site (ex: example.com)',
      },
    },
  ],
}
```

## Étape 2 : Dupliquer le Frontend

```bash
# Renommer le frontend actuel
mv frontend site-principal

# Créer les nouveaux sites
cp -r site-principal site-anglais
cp -r site-principal site-partenaire
```

## Étape 3 : Configurer chaque site

### site-principal/.env
```env
PUBLIC_PAYLOAD_URL=http://localhost:3000/api
PUBLIC_SITE_ID=site-principal
```

### site-anglais/.env
```env
PUBLIC_PAYLOAD_URL=http://localhost:3000/api
PUBLIC_SITE_ID=site-anglais
```

### site-partenaire/.env
```env
PUBLIC_PAYLOAD_URL=http://localhost:3000/api
PUBLIC_SITE_ID=site-partenaire
```

## Étape 4 : Modifier le client API

Dans chaque site, éditez `src/lib/payload.ts` :

```typescript
const SITE_ID = import.meta.env.PUBLIC_SITE_ID || 'site-principal'

export async function getAllPosts(): Promise<Post[]> {
  const data = await fetchAPI(
    `/posts?where[status][equals]=published&where[site][equals]=${SITE_ID}&sort=-publishedDate`
  )
  return data.docs || []
}

export async function getAllCategories(): Promise<Category[]> {
  const data = await fetchAPI(`/categories?where[site][equals]=${SITE_ID}`)
  return data.docs || []
}

export async function getPageBySlug(slug: string): Promise<Page | null> {
  const data = await fetchAPI(
    `/pages?where[slug][equals]=${slug}&where[status][equals]=published&where[site][equals]=${SITE_ID}`
  )
  return data.docs?.[0] || null
}

export async function getSiteSettings(): Promise<Settings> {
  const data = await fetchAPI(`/globals/site-settings?where[site][equals]=${SITE_ID}`)
  return data
}
```

## Étape 5 : Mettre à jour les scripts

Dans `package.json` à la racine :

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:site1\" \"npm run dev:site2\" \"npm run dev:site3\"",
    "dev:backend": "cd backend && npm run dev",
    "dev:site1": "cd site-principal && npm run dev",
    "dev:site2": "cd site-anglais && npm run dev --port 4322",
    "dev:site3": "cd site-partenaire && npm run dev --port 4323",

    "build:all": "npm run build:backend && npm run build:site1 && npm run build:site2 && npm run build:site3",
    "build:backend": "cd backend && npm run build",
    "build:site1": "cd site-principal && npm run build",
    "build:site2": "cd site-anglais && npm run build",
    "build:site3": "cd site-partenaire && npm run build"
  }
}
```

## Étape 6 : Personnaliser chaque site

### Thèmes différents

Chaque site peut avoir son propre thème. Éditez `src/styles/theme.css` dans chaque dossier.

**site-principal** : Thème par défaut
**site-anglais** : Thème bleu professionnel
**site-partenaire** : Thème avec les couleurs du partenaire

### Langues différentes

Pour un site multilingue :

```typescript
// site-anglais/src/consts.ts
export const SITE_TITLE = 'My Blog'
export const SITE_DESCRIPTION = 'Welcome to my website!'
export const SITE_LANG = 'en'

// site-principal/src/consts.ts
export const SITE_TITLE = 'Mon Blog'
export const SITE_DESCRIPTION = 'Bienvenue sur mon site!'
export const SITE_LANG = 'fr'
```

## Étape 7 : Gestion du contenu

### Dans Payload CMS

1. Créez un article
2. Sélectionnez le site cible dans le champ "site"
3. Publiez

L'article n'apparaîtra que sur le site sélectionné.

### Contenu partagé

Pour du contenu partagé entre sites, vous pouvez :

1. **Option A** : Créer une collection séparée sans filtre de site
```typescript
{
  slug: 'shared-content',
  // Pas de champ 'site'
}
```

2. **Option B** : Utiliser un champ multi-select
```typescript
{
  name: 'sites',
  type: 'select',
  hasMany: true,  // Permet de sélectionner plusieurs sites
  options: [/* ... */],
}
```

## Déploiement Multisite

### Option 1 : Domaines séparés

```
site-principal.com    → site-principal/
site-anglais.com      → site-anglais/
partenaire.com        → site-partenaire/
api.monprojet.com     → backend/
```

### Option 2 : Sous-domaines

```
www.monsite.com       → site-principal/
en.monsite.com        → site-anglais/
partner.monsite.com   → site-partenaire/
api.monsite.com       → backend/
```

### Option 3 : Sous-dossiers

```
monsite.com/          → site-principal/
monsite.com/en/       → site-anglais/
monsite.com/partner/  → site-partenaire/
monsite.com/api/      → backend/
```

## Avantages de cette Architecture

1. **Un seul CMS** : Gérez tous vos sites depuis une seule interface
2. **Contenu réutilisable** : Partagez des médias et du contenu entre sites
3. **Flexibilité** : Chaque site peut avoir son propre design et configuration
4. **Efficacité** : Une seule base de données, une seule infrastructure backend
5. **Scalabilité** : Ajoutez facilement de nouveaux sites

## Cas d'usage

- **Multilingue** : Un site par langue
- **Multi-marque** : Un site par marque de votre entreprise
- **White-label** : Des sites pour différents clients avec le même backend
- **Environnements** : Dev, staging, production sur le même CMS

## Ressources

- [Documentation Payload Multi-tenant](https://payloadcms.com/docs/configuration/overview)
- [Guide Astro Multi-site](https://docs.astro.build)

## Support

Pour plus d'informations sur la mise en place d'un système multisite complexe, consultez la documentation officielle ou contactez un développeur expérimenté.
