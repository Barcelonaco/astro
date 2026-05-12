# Variables d'environnement

Guide complet des variables d'environnement à configurer pour faire tourner le projet, avec les commandes pour générer les secrets.

> **Pour les non-développeurs** : les variables d'environnement sont des **réglages secrets** stockés dans un fichier `.env` à part du code. On y met les mots de passe, clés d'API et URLs, pour ne **jamais** les pousser sur Git. Chaque environnement (local, préprod, prod) a son propre fichier.

---

## Table des matières

1. [Rappel sur les fichiers `.env`](#1-rappel-sur-les-fichiers-env)
2. [Backend (`backend-php/.env`)](#2-backend-backend-phpenv)
3. [Frontend (`frontend/.env`)](#3-frontend-frontendenv)
4. [Générer les secrets](#4-générer-les-secrets)
5. [Récapitulatif d'installation](#5-récapitulatif-dinstallation)
6. [Sécurité](#6-sécurité)

---

## 1. Rappel sur les fichiers `.env`

| Fichier | Statut | Rôle |
|---|---|---|
| `.env.example` | **versionné** sur Git | Modèle vide qui liste toutes les variables attendues. |
| `.env` | **ignoré** par Git (`.gitignore`) | Vraies valeurs locales (secrets, mots de passe…). |

À chaque clone du projet, **copier** `.env.example` vers `.env` puis remplir les valeurs :

```bash
cp backend-php/.env.example backend-php/.env
cp frontend/.env.example frontend/.env
```

---

## 2. Backend (`backend-php/.env`)

### Vue d'ensemble

```env
APP_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_NAME=astro_blog_cms
DB_USER=root
DB_PASSWORD=root
JWT_SECRET=<voir section générer les secrets>
ADMIN_URL=https://astro.lan/admin
FRONTEND_URL=https://astro.lan
RESEND_API_KEY=
RESEND_FROM_EMAIL=
API_KEY=<voir section générer les secrets>
ANTHROPIC_API_KEY=
AI_ENCRYPTION_KEY=<voir section générer les secrets>
EXTERNAL_PLUGINS_DIR=
```

### Détail variable par variable

#### Environnement

| Variable | Obligatoire | Exemple | Rôle |
|---|---|---|---|
| `APP_ENV` | oui | `development` ou `production` | Mode de l'application. En `production`, les messages d'erreur détaillés sont masqués. |

#### Base de données MySQL

| Variable | Obligatoire | Exemple | Rôle |
|---|---|---|---|
| `DB_HOST` | oui | `localhost` | Hôte du serveur MySQL. |
| `DB_PORT` | oui | `3306` | Port MySQL (8889 sous MAMP). |
| `DB_NAME` | oui | `astro_blog_cms` | Nom de la base de données. |
| `DB_USER` | oui | `root` | Utilisateur MySQL. |
| `DB_PASSWORD` | oui | `root` | Mot de passe MySQL. |

> **Pour les non-devs** : la base de données est l'endroit où sont stockés les pages, articles, médias, utilisateurs, paramètres. Sans ces 5 variables, l'application ne peut rien lire ni écrire.

#### URLs publiques

| Variable | Obligatoire | Exemple | Rôle |
|---|---|---|---|
| `ADMIN_URL` | oui | `https://astro.lan/admin` | URL absolue du back-office. Utilisée dans les emails (lien de réinitialisation de mot de passe, etc.). |
| `FRONTEND_URL` | oui | `https://astro.lan` | URL absolue du site public. Utilisée dans les emails et notifications. |

#### Sécurité — secrets à générer

| Variable | Obligatoire | Génération | Rôle |
|---|---|---|---|
| `JWT_SECRET` | oui | `openssl rand -base64 64 \| tr -d '\n'` | Clé qui signe les jetons de connexion (JWT). Si elle change, **tous** les utilisateurs sont déconnectés. |
| `API_KEY` | oui | `openssl rand -base64 48 \| tr -d '\n'` | Clé d'API interne pour les appels machine-à-machine (ex. webhooks). |
| `AI_ENCRYPTION_KEY` | seulement si IA activée | `openssl rand -hex 32` | Chiffre les clés API IA stockées par utilisateur en base. |

> ⚠️ **Ne jamais réutiliser** ces secrets entre environnements. Chaque site (local, préprod, prod) doit avoir ses propres valeurs. Si un secret fuite, le régénérer immédiatement.

#### Email transactionnel ([Resend](https://resend.com))

| Variable | Obligatoire | Exemple | Rôle |
|---|---|---|---|
| `RESEND_API_KEY` | oui pour envoyer des emails | `re_xxxxxxxxxxxx` | Clé API Resend (créée sur le dashboard Resend). |
| `RESEND_FROM_EMAIL` | idem | `dev@exemple.fr` | Adresse expéditrice (doit être validée chez Resend). |

> **Pour les non-devs** : sert à envoyer les emails automatiques (confirmation d'inscription, mot de passe oublié, notifications de formulaire de contact).

#### IA — assistant Claude (optionnel)

| Variable | Obligatoire | Rôle |
|---|---|---|
| `ANTHROPIC_API_KEY` | non | Clé API Anthropic globale (fallback si l'utilisateur n'a pas configuré la sienne). |

#### Plugins spécifiques au site (optionnel)

| Variable | Obligatoire | Exemple | Rôle |
|---|---|---|---|
| `EXTERNAL_PLUGINS_DIR` | non | `/var/poolp-plugins` | Chemin d'un dossier de plugins **propre à ce site**, scanné en plus du dossier `plugins/`. |

> ⚠️ **Important** (mémoire projet) : les plugins mono-site **ne** vont **pas** dans `plugins/` (qui est partagé via Git pour les 3 sites). On les met dans le dossier pointé par `EXTERNAL_PLUGINS_DIR`, défini **uniquement** sur le site cible.

---

## 3. Frontend (`frontend/.env`)

### Vue d'ensemble

```env
PUBLIC_API_URL=https://astro.lan/api
# Optionnel — pour des builds avec API interne séparée :
# BUILD_API_URL=http://127.0.0.1:8888/api
# BUILD_MEDIA_ORIGIN=http://127.0.0.1:8888
# BUILD_SITE_URL=https://www.monsite.fr
```

### Détail variable par variable

#### Variables publiques (préfixe `PUBLIC_`)

Astro expose **toute** variable préfixée `PUBLIC_` dans le bundle JavaScript livré au navigateur. À utiliser uniquement pour des valeurs **non secrètes**.

| Variable | Obligatoire | Exemple | Rôle |
|---|---|---|---|
| `PUBLIC_API_URL` | oui | `https://astro.lan/api` | URL de l'API PHP appelée par le navigateur depuis les composants côté client (formulaires, recherches, etc.). |

#### Variables de build (préfixe `BUILD_`)

Lues seulement pendant la commande `npm run build`, jamais exposées au navigateur. Permettent de séparer l'API utilisée **pendant la fabrication des pages** (souvent locale, plus rapide) de celle utilisée **par le visiteur**.

| Variable | Obligatoire | Exemple | Rôle |
|---|---|---|---|
| `BUILD_API_URL` | non | `http://127.0.0.1:8888/api` | API utilisée par Astro pendant le build (override de `PUBLIC_API_URL`). Évite de passer par le DNS / HTTPS public lors du build. |
| `BUILD_MEDIA_ORIGIN` | non | `http://127.0.0.1:8888` | Origine des médias pendant le build (utile si différente de l'API). |
| `BUILD_SITE_URL` | non | `https://www.monsite.fr` | URL canonique gravée dans le HTML (sitemap, balises `<link rel="canonical">`, JSON-LD…). |

> **Pour les non-devs** : le frontend est fabriqué en avance (build). Pendant cette étape, Astro a besoin d'appeler le backend pour récupérer le contenu. Les variables `BUILD_*` permettent de viser une API locale rapide. Une fois en ligne, les visiteurs utilisent `PUBLIC_API_URL`.

---

## 4. Générer les secrets

Toutes les commandes utilisent `openssl`, déjà installé sur macOS et Linux.

### Tout d'un coup

Copier-coller dans un terminal pour générer les 3 secrets backend :

```bash
echo "JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
echo "API_KEY=$(openssl rand -base64 48 | tr -d '\n')"
echo "AI_ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

Sortie type :

```
JWT_SECRET=Tw6cJ...soixanteCaractères...==
API_KEY=Bn9Qa...quaranteHuitCaractères...
AI_ENCRYPTION_KEY=c5bc799cea7d6e19...soixanteQuatreHexa
```

→ Copier les 3 lignes telles quelles dans `backend-php/.env`.

### Un par un

| Secret | Commande | Format obtenu |
|---|---|---|
| `JWT_SECRET` | `openssl rand -base64 64 \| tr -d '\n'` | ~88 caractères base64 |
| `API_KEY` | `openssl rand -base64 48 \| tr -d '\n'` | ~64 caractères base64 |
| `AI_ENCRYPTION_KEY` | `openssl rand -hex 32` | 64 caractères hexadécimaux |

> Le `tr -d '\n'` supprime le retour à la ligne ajouté par `openssl rand -base64`, qui casserait le `.env`.

### Sous Windows (sans WSL)

PowerShell équivalent :

```powershell
# JWT_SECRET (base64, 64 octets)
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Maximum 256 }))

# AI_ENCRYPTION_KEY (hex, 32 octets)
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

---

## 5. Récapitulatif d'installation

Procédure complète depuis un clone vierge :

```bash
# 1. Cloner et entrer dans le projet
git clone <url> astro && cd astro

# 2. Créer les fichiers .env
cp backend-php/.env.example backend-php/.env
cp frontend/.env.example frontend/.env

# 3. Générer les secrets backend et les afficher
echo "JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
echo "API_KEY=$(openssl rand -base64 48 | tr -d '\n')"
echo "AI_ENCRYPTION_KEY=$(openssl rand -hex 32)"

# 4. Coller les secrets dans backend-php/.env
#    + remplir DB_*, ADMIN_URL, FRONTEND_URL, RESEND_*

# 5. Vérifier frontend/.env
#    PUBLIC_API_URL doit pointer vers le backend (ex. https://astro.lan/api)

# 6. Installer les dépendances
cd backend-php && composer install && cd ..
cd frontend && npm install && cd ..

# 7. Initialiser la base de données
cd backend-php && php migrate.php && cd ..

# 8. Démarrer le frontend
cd frontend && npm run dev
```

Le backend PHP doit être servi à part (MAMP Pro, ou `php -S localhost:8888 backend-php/index.php`).

---

## 6. Sécurité

### Règles d'or

1. **Ne jamais committer** un `.env` contenant des vrais secrets. Vérifier que `.env` est dans `.gitignore`.
2. **Ne jamais coller** un secret dans un message Slack / Discord / email. Utiliser un gestionnaire de secrets (1Password, Bitwarden, Vault…).
3. **Régénérer** un secret immédiatement s'il fuite, **et redémarrer** le backend pour qu'il prenne effet.
4. **Différencier** les secrets entre local / préprod / prod. Un secret de prod ne doit pas tourner sur le poste d'un développeur.
5. **Sauvegarder** `JWT_SECRET` et `AI_ENCRYPTION_KEY` quelque part de sûr : si tu les perds, **tous** les utilisateurs sont déconnectés et **toutes** les clés IA stockées en base deviennent illisibles.

### Vérifier que `.env` n'est pas tracké

```bash
git check-ignore -v backend-php/.env frontend/.env
```

Sortie attendue :

```
.gitignore:NN:.env	backend-php/.env
.gitignore:NN:.env	frontend/.env
```

Si un `.env` apparaît dans `git status`, l'ajouter au `.gitignore` immédiatement et **régénérer tous les secrets** (considérer comme fuités).

### Audit rapide

Pour lister toutes les variables d'env utilisées dans le code :

```bash
# Backend
grep -rE "\\\$_ENV\[|getenv\(" backend-php/{controllers,models,helpers,middleware,index.php} \
  | grep -oE "(\\\$_ENV\['[A-Z_]+'\]|getenv\('[A-Z_]+'\))" | sort -u

# Frontend
grep -rE "import\.meta\.env\.[A-Z_]+" frontend/src \
  | grep -oE "import\.meta\.env\.[A-Z_]+" | sort -u
```

Toute variable trouvée par ce grep doit être documentée dans ce fichier. Toute variable documentée ici doit avoir une utilité réelle dans le code.

---

## Pour aller plus loin

- [README.md](README.md) — vue d'ensemble du projet
- [ARCHITECTURE_PAGE_ASTRO.md](ARCHITECTURE_PAGE_ASTRO.md) — anatomie d'une page
- [MULTISITE.md](MULTISITE.md) — gestion multi-sites
- [Documentation Astro — Variables d'environnement](https://docs.astro.build/en/guides/environment-variables/)
- [Documentation phpdotenv](https://github.com/vlucas/phpdotenv)
- [Documentation Resend](https://resend.com/docs)
