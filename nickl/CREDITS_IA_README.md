# Système de Gestion des Crédits API Claude

## 📋 Vue d'ensemble

Ce système permet de limiter l'utilisation de l'API Claude par utilisateur avec un plafond mensuel de **2$ par défaut**, avec la possibilité d'ajouter du crédit manuellement.

## 🎯 Fonctionnalités

### 1. **Limitation par utilisateur**

- Chaque utilisateur dispose de **2$/mois** de crédit par défaut
- Le crédit est automatiquement réinitialisé le 1er de chaque mois
- Les requêtes sont bloquées lorsque le crédit est épuisé

### 2. **Ajout manuel de crédit**

- Les administrateurs peuvent ajouter du crédit à n'importe quel utilisateur
- Historique complet des ajouts de crédit avec raison et date
- Le crédit ajouté s'accumule avec le crédit mensuel

### 3. **Suivi détaillé**

- Nombre de tokens utilisés (input/output)
- Nombre de requêtes effectuées
- Coût total et crédit restant
- Historique des 100 dernières requêtes par utilisateur

### 4. **Interface d'administration**

- Page dédiée : **Réglages > Crédits IA**
- Tableau de bord avec tous les utilisateurs
- Indicateurs visuels (vert/orange/rouge) selon l'utilisation
- Modal pour ajouter du crédit facilement

### 5. **Widget Dashboard**

- Affichage du crédit personnel de l'utilisateur connecté
- Barre de progression visuelle
- Alertes quand le crédit est faible ou épuisé
- Statistiques d'utilisation en temps réel

### 6. **Affichage dans l'éditeur**

- Statut du crédit affiché directement dans l'interface d'édition
- Mise à jour automatique après chaque génération
- Désactivation du bouton si crédit épuisé

## 📁 Fichiers créés/modifiés

### Nouveaux fichiers

1. **`app/Helpers/IaCreditManager.php`** - Gestionnaire principal des crédits
2. **`resources/views/admin/ia-credit-manager.blade.php`** - Page d'administration
3. **`resources/scripts/routes/ia-credit-status.js`** - Affichage du statut dans l'éditeur

### Fichiers modifiés

1. **`app/Helpers/AjaxIa.php`** - Intégration de la vérification du crédit
2. **`resources/views/widget/blocs/ia_stats.blade.php`** - Widget dashboard amélioré
3. **`config/ia.php`** - Initialisation du système

## 🚀 Utilisation

### Pour les administrateurs

#### Accéder à la gestion des crédits

1. Aller dans **Réglages > Crédits IA**
2. Voir tous les utilisateurs et leur consommation
3. Ajouter du crédit à un utilisateur :
   - Cliquer sur "Ajouter du crédit"
   - Entrer le montant (en $)
   - Indiquer la raison (ex: "Bonus", "Projet spécial")
   - Valider

#### Réinitialiser les crédits manuellement

- Bouton "Réinitialiser tous les crédits maintenant" disponible en haut de la page
- Utile pour forcer une réinitialisation avant la fin du mois

### Pour les utilisateurs

#### Voir son crédit

1. **Dashboard WordPress** : Widget "Mon Crédit IA Claude"
2. **Dans l'éditeur** : Affichage automatique au-dessus du bouton de génération

#### Que se passe-t-il quand le crédit est épuisé ?

- Le bouton de génération est désactivé
- Un message d'alerte s'affiche
- Impossible de faire de nouvelles requêtes
- Contacter l'administrateur pour ajouter du crédit

## 💰 Tarification

Le système utilise la tarification officielle de Claude 3.5 Sonnet :

- **Input** : 3$ / 1M tokens
- **Output** : 15$ / 1M tokens

Exemple de consommation :

- Une requête moyenne (1000 tokens input + 2000 tokens output) coûte environ **0.033$**
- Avec 2$ de crédit, un utilisateur peut faire environ **60 requêtes** par mois

## 🔄 Réinitialisation automatique

Un cron job WordPress réinitialise automatiquement tous les crédits le 1er de chaque mois :

- Les stats du mois précédent sont archivées
- Le crédit revient à 2$ pour tous les utilisateurs
- L'historique des requêtes est conservé

## 📊 Archivage

Les statistiques mensuelles sont archivées automatiquement :

- Crédit utilisé
- Nombre de tokens (input/output)
- Nombre de requêtes
- Accessible via `IaCreditManager::getArchivedStats($userId)`

## 🛠️ Configuration

### Modifier la limite mensuelle par défaut

Dans `app/Helpers/IaCreditManager.php`, ligne 13 :

```php
const DEFAULT_MONTHLY_LIMIT = 2.00; // Modifier cette valeur
```

### Modifier la tarification

Dans `app/Helpers/AjaxIa.php`, lignes 110-111 :

```php
$costInput = ($input / 1000000) * 3;   // Prix input
$costOutput = ($output / 1000000) * 15; // Prix output
```

## 🔐 Sécurité

- Vérification des permissions (`manage_options` pour les admins)
- Vérification du crédit avant chaque appel API
- Impossible de contourner la limite côté client
- Logs détaillés de toutes les opérations

## 📝 API / Fonctions utiles

### Vérifier le crédit d'un utilisateur

```php
$creditManager = new IaCreditManager();
$check = $creditManager->checkCredit($userId);
if ($check['allowed']) {
    // Crédit disponible
}
```

### Ajouter du crédit

```php
$creditManager->addCredit($userId, 5.00, 'Bonus mensuel');
```

### Récupérer les stats

```php
$stats = $creditManager->getUserStats($userId);
echo "Crédit restant: $" . $stats['remaining_credit'];
```

### Réinitialiser le crédit mensuel

```php
$creditManager->resetMonthlyCredit($userId);
```

## 🐛 Dépannage

### Le crédit ne se réinitialise pas automatiquement

Vérifier que le cron WordPress fonctionne :

```bash
wp cron event list
```

### Les stats ne s'affichent pas

Vérifier que les scripts JS sont bien chargés dans la console du navigateur

### Erreur "Crédit épuisé" alors qu'il reste du crédit

Vider le cache WordPress et recharger la page

## 📞 Support

Pour toute question ou problème, contacter l'administrateur du site.

---

**Version** : 1.0  
**Date** : Janvier 2026  
**Auteur** : Système de gestion des crédits API Claude
