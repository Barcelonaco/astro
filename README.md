# Site Web Astro avec Payload CMS

Un site web de blog moderne construit avec [Astro](https://astro.build) et [Payload CMS](https://payloadcms.com), avec un thème entièrement personnalisable.

## Structure du Projet

```
/
├── frontend/          # Application Astro (frontend)
│   ├── src/
│   │   ├── components/    # Composants Astro
│   │   ├── layouts/       # Layouts
│   │   ├── pages/         # Pages du site
│   │   │   ├── blog/      # Pages des articles
│   │   │   └── category/  # Pages des catégories
│   │   ├── lib/           # Bibliothèques et utilitaires
│   │   │   └── payload.ts # Client API Payload
│   │   └── styles/        # Styles CSS
│   │       ├── global.css # Styles globaux
│   │       └── theme.css  # Configuration du thème
│   └── theme-config.json  # Configuration des thèmes
│
└── backend/           # Application Payload CMS (backend)
    ├── src/
    │   ├── payload.config.ts # Configuration Payload
    │   └── server.ts         # Serveur Express
    └── media/               # Fichiers uploadés
```

## Prérequis

- Node.js 18 ou supérieur
- MongoDB (local ou cloud)
- npm ou yarn

## Installation

### 1. Installer MongoDB

**Option A: MongoDB Local**
```bash
# macOS avec Homebrew
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Linux
sudo apt-get install mongodb

# Windows
# Téléchargez l'installateur depuis https://www.mongodb.com/try/download/community
```

**Option B: MongoDB Cloud (gratuit)**
- Créez un compte sur [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- Créez un cluster gratuit
- Récupérez la connection string
- Mettez à jour `backend/.env` avec votre connection string

### 2. Installer les dépendances

**Backend (Payload CMS):**
```bash
cd backend
npm install
```

**Frontend (Astro):**
```bash
cd frontend
npm install
```

## Configuration

### Backend

Le fichier `backend/.env` contient la configuration du backend :

```env
# Payload CMS
PAYLOAD_SECRET=development-secret-key-change-in-production
MONGODB_URI=mongodb://localhost:27017/astro-blog

# Server
PORT=3000
```

**Important:** Changez `PAYLOAD_SECRET` en production !

### Frontend

Le fichier `frontend/.env` contient la configuration du frontend :

```env
PUBLIC_PAYLOAD_URL=http://localhost:3000/api
```

## Démarrage

### Démarrer le Backend (Payload CMS)

```bash
cd backend
npm run dev
```

Le CMS sera accessible sur [http://localhost:3000/admin](http://localhost:3000/admin)

### Démarrer le Frontend (Astro)

Dans un nouveau terminal :

```bash
cd frontend
npm run dev
```

Le site sera accessible sur [http://localhost:4321](http://localhost:4321)

## Première Utilisation

### 1. Créer un compte administrateur

1. Ouvrez [http://localhost:3000/admin](http://localhost:3000/admin)
2. Créez votre premier compte utilisateur
3. Vous serez redirigé vers le tableau de bord

### 2. Configurer les paramètres du site

1. Dans le menu, allez dans **Globals → Settings**
2. Configurez :
   - Nom du site
   - Description
   - Logo (optionnel)
   - Footer
   - Liens sociaux

### 3. Créer des catégories

1. Allez dans **Collections → Categories**
2. Créez vos catégories de blog (ex: Technologie, Design, etc.)
3. Chaque catégorie nécessite :
   - Nom
   - Slug (URL-friendly)
   - Description (optionnelle)

### 4. Créer votre premier article

1. Allez dans **Collections → Posts**
2. Cliquez sur **Create New**
3. Remplissez :
   - Titre
   - Slug
   - Extrait (description courte)
   - Contenu
   - Image à la une (optionnelle)
   - Auteur
   - Catégories
   - Tags
   - Date de publication
   - Status: **Published**
4. Cliquez sur **Save**

### 5. Voir votre article

Ouvrez [http://localhost:4321/blog](http://localhost:4321/blog) pour voir votre nouvel article !

## Personnalisation du Thème

### Méthode 1 : Modifier les variables CSS

Éditez `frontend/src/styles/theme.css` :

```css
:root {
  /* Changer la couleur principale */
  --accent: #2337ff;
  --accent-dark: #000d8a;

  /* Changer les couleurs de texte */
  --black: 15, 18, 25;
  --gray: 96, 115, 159;

  /* etc... */
}
```

### Méthode 2 : Utiliser un thème prédéfini

Dans `frontend/src/styles/theme.css`, décommentez un des thèmes prédéfinis :

- **Thème sombre** : Design moderne avec fond sombre
- **Thème minimaliste** : Noir et blanc épuré
- **Thème coloré** : Couleurs vibrantes et joyeuses
- **Thème nature** : Couleurs vertes et apaisantes

### Méthode 3 : Configuration JSON

Éditez `frontend/theme-config.json` pour gérer plusieurs thèmes et basculer entre eux.

## Structure des Collections Payload

### Posts (Articles)
- **title**: Titre de l'article
- **slug**: URL de l'article
- **excerpt**: Description courte
- **content**: Contenu riche (Rich Text)
- **featuredImage**: Image principale
- **author**: Relation avec Users
- **categories**: Relations avec Categories
- **tags**: Liste de tags
- **publishedDate**: Date de publication
- **status**: draft | published
- **seo**: Métadonnées SEO

### Categories
- **name**: Nom de la catégorie
- **slug**: URL de la catégorie
- **description**: Description de la catégorie

### Pages
- **title**: Titre de la page
- **slug**: URL de la page
- **content**: Contenu riche
- **status**: draft | published

### Media
- **alt**: Texte alternatif de l'image
- Support des images uniquement

### Settings (Global)
- **siteName**: Nom du site
- **siteDescription**: Description du site
- **logo**: Logo du site
- **footer**: Contenu du footer
- **socialLinks**: Liens réseaux sociaux

## API REST

Payload CMS expose automatiquement une API REST complète :

### Endpoints principaux

```bash
# Récupérer tous les articles publiés
GET http://localhost:3000/api/posts?where[status][equals]=published

# Récupérer un article par slug
GET http://localhost:3000/api/posts?where[slug][equals]=mon-article

# Récupérer toutes les catégories
GET http://localhost:3000/api/categories

# Récupérer les paramètres globaux
GET http://localhost:3000/api/globals/settings
```

### Documentation complète

La documentation API est accessible sur [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

## Déploiement

### Backend (Payload CMS)

**Option 1: Payload Cloud**
```bash
cd backend
npm run deploy
```

**Option 2: Serveur classique (VPS, etc.)**
```bash
cd backend
npm run build
npm run serve
```

N'oubliez pas de :
- Configurer MongoDB en production
- Définir les variables d'environnement
- Utiliser un gestionnaire de processus (PM2)

### Frontend (Astro)

**Option 1: Vercel/Netlify**
```bash
cd frontend
npm run build
# Déployer le dossier dist/
```

**Option 2: Serveur statique**
```bash
cd frontend
npm run build
# Copier le contenu de dist/ sur votre serveur
```

**Configuration importante:** Mettez à jour `PUBLIC_PAYLOAD_URL` dans `.env` avec l'URL de production de votre API.

## Préparation pour le Multisite

Ce projet est conçu pour évoluer vers un système multisite. Voici comment procéder :

### 1. Structure recommandée

```
/
├── frontend-site1/
├── frontend-site2/
├── frontend-site3/
└── backend/  # CMS partagé
```

### 2. Ajouter un champ "site" dans Payload

Modifiez `backend/src/payload.config.ts` pour ajouter :

```typescript
{
  name: 'site',
  type: 'select',
  required: true,
  options: [
    { label: 'Site 1', value: 'site1' },
    { label: 'Site 2', value: 'site2' },
  ]
}
```

### 3. Filtrer par site dans le frontend

```typescript
const posts = await fetchAPI('/posts?where[site][equals]=site1&where[status][equals]=published')
```

## Commandes Utiles

### Frontend
```bash
npm run dev          # Démarrer le serveur de développement
npm run build        # Build pour la production
npm run preview      # Prévisualiser le build
```

### Backend
```bash
npm run dev          # Démarrer Payload en mode développement
npm run build        # Compiler TypeScript
npm run serve        # Démarrer en production
npm run payload      # CLI Payload
```

## Résolution de Problèmes

### Le CMS ne se connecte pas à MongoDB

Vérifiez que :
- MongoDB est démarré : `brew services list` (macOS)
- La connection string dans `.env` est correcte
- Votre adresse IP est autorisée (si MongoDB Atlas)

### Les articles n'apparaissent pas

Vérifiez que :
- Le backend est démarré
- Le status de l'article est "published"
- La date de publication n'est pas dans le futur
- L'URL de l'API est correcte dans `frontend/.env`

### Erreur de CORS

Vérifiez que l'origine du frontend est autorisée dans `backend/src/payload.config.ts` :

```typescript
cors: [
  'http://localhost:4321',  // Ajoutez votre URL
]
```

## Ressources

- [Documentation Astro](https://docs.astro.build)
- [Documentation Payload CMS](https://payloadcms.com/docs)
- [Guide de déploiement Astro](https://docs.astro.build/en/guides/deploy/)
- [Guide de déploiement Payload](https://payloadcms.com/docs/production/deployment)

## Support

Pour toute question ou problème :
1. Consultez la documentation
2. Vérifiez les issues GitHub d'Astro et Payload
3. Rejoignez les communautés Discord

## License

MIT
