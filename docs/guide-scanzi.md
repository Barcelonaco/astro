# Guide utilisateur back-office — Scanzi

## Acces

Connectez-vous sur `https://votre-domaine.com/admin/login.html` avec vos identifiants administrateur.

## Gestion des commandes

### Voir les commandes

Menu lateral > **Commandes**

La liste affiche : numero, client, total, statut, date. Filtres disponibles : statut, date, recherche par email.

### Statuts de commande

- **En attente de paiement** : commande creee, paiement non recu
- **Payee** : paiement confirme (automatique via Stripe)
- **En traitement** : commande en cours de preparation
- **Preparee** : prete a expedier
- **Expediee** : colis envoye (un email est envoye au client)
- **Livree** : colis recu
- **Annulee** / **Remboursee** : commande annulee ou remboursee

### Rembourser une commande

Ouvrir la commande > cliquer "Rembourser" > choisir montant (total ou partiel). Le remboursement est effectue via Stripe automatiquement et un email est envoye au client.

## Gestion des clients

### Comptes pros

Menu lateral > **Clients** > filtrer par "Statut pro : pending"

Pour valider un compte pro :

1. Ouvrir la fiche client
2. Verifier SIRET et activite
3. Changer le statut pro de "En attente" a "Approuvé"
4. Le client recevra automatiquement les prix HT

### Bareme de remises pros

Menu lateral > **Bareme pros**

Le bareme definit les tiers de remise en fonction du CA sur 365 jours glissants :

- Editer les seuils et les taux de remise
- "Recalculer tout" : met a jour les remises de tous les pros
- Override manuel : cocher "override" sur un client pour bloquer le recalc auto

## Gestion des produits

### Creer un produit

Menu lateral > CPT **Produits** > "Nouveau"

Remplir : titre, slug, description, prix de base, SKU, stock, categorie, images.

### Variantes

Pour un produit variable (ex: taille, couleur) :

1. Type de produit = "Variable"
2. Onglet Attributs : definir les attributs (ex: Taille = S, M, L)
3. Onglet Variantes : generer la matrice puis editer prix/SKU/stock par variante

## Livraison

### Zones de livraison

Menu lateral > **Zones de livraison**

Chaque zone = un pays ou ensemble de codes postaux + methodes de livraison associees (forfait, gratuit, par poids, par montant).

## TVA

### Taux de TVA

Menu lateral > **Taux de TVA**

Taux pre-configures pour la France (20%, 10%, 5.5%, 2.1%). Ajouter des taux pour d'autres pays si necessaire.

## Coupons

Menu lateral > **Coupons de reduction**

Types : pourcentage, montant fixe, livraison gratuite. Conditions : montant minimum, dates de validite, limite d'utilisation.

## Factures

Menu lateral > **Factures**

Les factures sont generees automatiquement a chaque paiement recu. Telecharger en PDF via l'icone de telechargement. Generer manuellement si besoin via le bouton "Generer".

## Mandats SEPA

Les mandats SEPA sont visibles dans la fiche client (section Paiement). Pour valider un mandat :

1. Verifier les informations IBAN
2. Changer le statut de "En attente" a "Actif"
3. Les prelevements pourront etre declenches a partir de ce moment

## Configurateur POOLP

### Zones de livraison POOLP

Menu lateral > **POOLP** > Zones de livraison

Definir les zones par code postal (exact, prefix ou range) avec tarifs kit et montee.

### Compositions

Menu lateral > **POOLP** > Compositions

Matrice box × filtre × pompe definissant les packs valides.

### Projets sauvegardes

Menu lateral > **POOLP** > Projets

Liste des configurations sauvegardees par les clients avec lien de reprise.
