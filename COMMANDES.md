# Commandes Rapides

## Démarrage rapide

```bash
# Tout démarrer en une commande (nécessite MongoDB démarré)
./start.sh

# Ou manuellement
npm run dev
```

## Backend (Payload CMS)

```bash
cd backend

# Développement
npm run dev

# Build
npm run build

# Production
npm run serve

# CLI Payload
npm run payload
```

## Frontend (Astro)

```bash
cd frontend

# Développement
npm run dev

# Build
npm run build

# Preview du build
npm run preview
```

## Utilitaires

```bash
# Installer toutes les dépendances (root + backend + frontend)
npm run install:all

# Build complet (backend + frontend)
npm run build

# Nettoyer les node_modules
rm -rf node_modules backend/node_modules frontend/node_modules

# Régénérer les types Payload
cd backend && npm run generate:types
```

## MongoDB

```bash
# macOS
brew services start mongodb-community
brew services stop mongodb-community
brew services restart mongodb-community

# Linux
sudo systemctl start mongodb
sudo systemctl stop mongodb
sudo systemctl restart mongodb

# Vérifier le status
pgrep mongod
```

## Git

```bash
# Initialiser un repo
git init
git add .
git commit -m "Initial commit: Astro + Payload CMS"

# Ajouter une remote
git remote add origin https://github.com/username/repo.git
git push -u origin main
```

## Déploiement

### Frontend (Vercel)
```bash
cd frontend
npm install -g vercel
vercel
```

### Backend (Railway/Render)
```bash
cd backend
# Suivre les instructions de votre plateforme
```

## Résolution de problèmes

```bash
# Nettoyer le cache Astro
cd frontend
rm -rf .astro

# Nettoyer le cache Payload
cd backend
rm -rf .cache build dist

# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install

# Vérifier les ports utilisés
lsof -i :3000  # Backend
lsof -i :4321  # Frontend
```

## Variables d'environnement

```bash
# Backend
cp backend/.env.example backend/.env
# Puis éditez backend/.env

# Frontend
cp frontend/.env.example frontend/.env
# Puis éditez frontend/.env
```

## Logs et Debug

```bash
# Voir les logs MongoDB
tail -f /usr/local/var/log/mongodb/mongo.log

# Voir les logs en temps réel
npm run dev | tee logs.txt
```
