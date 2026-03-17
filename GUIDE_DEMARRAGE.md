# Guide de Démarrage Rapide

Ce guide vous permettra de lancer votre site en 5 minutes !

## Étape 1 : Démarrer MongoDB

### Sur macOS
```bash
brew services start mongodb-community
```

### Sur Linux
```bash
sudo systemctl start mongodb
```

### Ou utiliser MongoDB Atlas (Cloud)
1. Allez sur [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Créez un compte gratuit
3. Créez un cluster
4. Récupérez la connection string
5. Mettez-la dans `backend/.env` :
```env
MONGODB_URI=votre-connection-string
```

## Étape 2 : Démarrer le Backend

```bash
cd backend
npm run dev
```

Vous devriez voir :
```
✨ Payload Admin URL: http://localhost:3000/admin
🚀 Server started on http://localhost:3000
```

## Étape 3 : Créer votre compte admin

1. Ouvrez http://localhost:3000/admin
2. Créez votre premier compte utilisateur
3. Connectez-vous

## Étape 4 : Démarrer le Frontend

Dans un nouveau terminal :

```bash
cd frontend
npm run dev
```

Vous devriez voir :
```
🚀 astro v... ready in ... ms
┃ Local    http://localhost:4321/
```

## Étape 5 : Créer votre premier article

1. Dans Payload (http://localhost:3000/admin), allez dans **Posts**
2. Cliquez sur **Create New**
3. Remplissez les champs requis :
   - **Title**: Mon premier article
   - **Slug**: mon-premier-article
   - **Excerpt**: Ceci est mon premier article de blog
   - **Content**: Écrivez votre contenu ici...
   - **Author**: Sélectionnez votre utilisateur
   - **Published Date**: Aujourd'hui
   - **Status**: Published
4. Cliquez sur **Save**

## Étape 6 : Voir votre article

Ouvrez http://localhost:4321/blog et admirez votre nouvel article !

## Personnaliser le thème

1. Ouvrez `frontend/src/styles/theme.css`
2. Changez la couleur principale :
```css
:root {
  --accent: #ff6b6b;  /* Votre couleur préférée */
}
```
3. Rechargez la page (le hot reload s'occupe du reste !)

## Prochaines étapes

- Lisez le [README.md](README.md) complet pour plus de détails
- Explorez les autres collections dans Payload (Categories, Pages, Settings)
- Personnalisez davantage votre thème
- Ajoutez vos propres pages

## Besoin d'aide ?

Consultez le README.md, section "Résolution de Problèmes".

Bon développement ! 🚀
