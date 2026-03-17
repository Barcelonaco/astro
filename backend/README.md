# Backend - Custom CMS with Express + MySQL

CMS personnalisé construit avec Express.js et MySQL, 100% gratuit et compatible Node.js v24.

## Fonctionnalités

- ✅ API REST complète
- ✅ Authentification JWT
- ✅ Gestion des articles (posts)
- ✅ Gestion des catégories
- ✅ Gestion des tags
- ✅ Gestion des pages
- ✅ Interface admin web
- ✅ Support MySQL
- ✅ CORS configuré pour Astro

## Prérequis

1. **MySQL** installé et démarré
2. **Node.js 18+**

## Installation de MySQL

### macOS
```bash
brew install mysql
brew services start mysql
```

### Linux
```bash
sudo apt-get install mysql-server
sudo systemctl start mysql
```

### Windows
Téléchargez depuis [MySQL Downloads](https://dev.mysql.com/downloads/installer/)

## Configuration

### 1. Créer la base de données

```bash
mysql -u root -p
CREATE DATABASE astro_blog_cms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer l'environnement

Le fichier `.env` est déjà configuré avec des valeurs par défaut. Modifiez si nécessaire :
- `DB_PASSWORD` : Votre mot de passe MySQL (vide par défaut)
- `JWT_SECRET` : Changez en production

### 4. Initialiser la base de données

```bash
npm run setup
```

Cela va créer :
- Toutes les tables nécessaires
- Un utilisateur admin par défaut
- Les paramètres par défaut

## Démarrage

```bash
npm run dev
```

Le serveur démarre sur [http://localhost:3000](http://localhost:3000)

## Connexion

**Interface Admin :** [http://localhost:3000/admin](http://localhost:3000/admin)

Identifiants par défaut :
- **Email :** admin@example.com
- **Password :** admin123

⚠️ **Changez ces identifiants après la première connexion !**

## API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Utilisateur actuel (auth requis)

### Articles (Posts)
- `GET /api/posts` - Liste tous les articles
- `GET /api/posts/:slug` - Article par slug
- `POST /api/posts` - Créer un article (auth requis)
- `PUT /api/posts/:id` - Modifier un article (auth requis)
- `DELETE /api/posts/:id` - Supprimer un article (auth requis)

### Catégories
- `GET /api/categories` - Liste toutes les catégories
- `GET /api/categories/:slug` - Catégorie par slug
- `POST /api/categories` - Créer une catégorie (auth requis)
- `PUT /api/categories/:id` - Modifier une catégorie (auth requis)
- `DELETE /api/categories/:id` - Supprimer une catégorie (auth requis)

## Exemples d'utilisation

### Connexion
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

### Créer un article
```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Mon premier article",
    "slug": "mon-premier-article",
    "excerpt": "Un article de test",
    "content": "Contenu de l'article...",
    "published_date": "2024-01-27T12:00:00",
    "status": "published",
    "categories": [1],
    "tags": ["test", "demo"]
  }'
```

### Récupérer les articles
```bash
curl http://localhost:3000/api/posts
```

## Structure de la base de données

### Tables principales
- **users** : Utilisateurs du CMS
- **posts** : Articles de blog
- **categories** : Catégories
- **tags** : Tags
- **post_categories** : Relation articles-catégories
- **post_tags** : Relation articles-tags
- **pages** : Pages statiques
- **settings** : Paramètres globaux

## Scripts

- `npm run dev` - Démarrer en mode développement (avec nodemon)
- `npm start` - Démarrer en production
- `npm run setup` - Initialiser/réinitialiser la base de données

## Sécurité

En production :
1. Changez `JWT_SECRET` dans `.env`
2. Changez le mot de passe admin
3. Utilisez HTTPS
4. Configurez les CORS correctement
5. Utilisez des mots de passe MySQL forts
6. Limitez l'accès à la base de données

## Extensibilité

Le CMS est conçu pour être facilement extensible :
- Ajoutez de nouveaux modèles dans `src/models/`
- Ajoutez de nouveaux contrôleurs dans `src/controllers/`
- Ajoutez de nouvelles routes dans `src/routes/`
- Modifiez le schéma dans `src/setup.js`

## Support multisite

Pour ajouter le support multisite, ajoutez un champ `site_id` aux tables posts, categories et pages dans `src/setup.js`.
