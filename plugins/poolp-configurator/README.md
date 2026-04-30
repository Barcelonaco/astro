# Plugin POOLP — Configurateur de box piscine

Plugin **site-spécifique** (Scanzi / POOLP) pour le CMS Astro. Configurateur 7 étapes permettant à un visiteur de calculer la box adaptée à son bassin et de l'ajouter au panier ou de l'exporter en PDF.

> **Important** : ce plugin **ne vit pas dans le monorepo astro/**. Il est chargé via la variable d'environnement `EXTERNAL_PLUGINS_DIR` côté backend, ce qui permet de ne le déployer **que sur le site cible**.

## Structure

```
poolp-configurator/
├── plugin.json                 # manifest (CPT, options, admin_pages)
├── composer.json               # dompdf + phpunit
├── phpunit.xml
├── backend/
│   ├── autoload.php            # enregistre routes + migration
│   ├── PoolpComputeService.php # moteur métier (calculs + règles CDC §3)
│   ├── PoolpMigrationController.php
│   ├── PoolpConfiguratorController.php
│   └── tests/                  # PHPUnit
├── templates/
│   ├── poolp-configurator.blade.php
│   └── pdf/project.phtml       # template PDF Dompdf
├── admin/
│   ├── zones.html              # mini-admin zones livraison
│   ├── compositions.html       # matrice box × filtre × pompe
│   └── projects.html           # projets sauvegardés
├── css/poolp-configurator.css  # wizard frontend
├── admin-css/poolp-configurator.css
└── seeds/packs-filtration.json # données d'amorçage CDC §3.3
```

## Installation locale (dev)

```bash
# 1. Cloner ce repo à côté du monorepo astro/
cd ~/Sites
git clone git@github.com:chulee/astro-plugins-poolp.git

# 2. Configurer le monorepo pour le voir
echo "EXTERNAL_PLUGINS_DIR=/Users/chulee/Sites/astro-plugins-poolp" >> ~/Sites/astro/backend-php/.env

# 3. Installer les deps
cd ~/Sites/astro-plugins-poolp/poolp-configurator
composer install

# 4. Activer le plugin
curl -X PUT http://astro.lan/api/plugins/poolp-configurator/toggle \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"active": true}'

# 5. Migrer
cd ~/Sites/astro/backend-php && php migrate.php
```

## Tests

```bash
cd poolp-configurator
./vendor/bin/phpunit
```

29 tests, 61 assertions — couvre les règles CDC §3 (calculs hydrauliques,
exclusions box, traitements compatibles, matching CP, validation inputs,
totaux).

## Déploiement

CI GitHub Actions — secrets requis sur le repo GitHub :

| Secret | Description |
|---|---|
| `SCANZI_HOST` | Host SSH du serveur (ex : `scanzi.bcnco.site`) |
| `SCANZI_USER` | User SSH |
| `SCANZI_SSH_KEY` | Clé privée SSH (PEM) |
| `SCANZI_PORT` | (optionnel) Port SSH, défaut 22 |
| `SCANZI_PLUGIN_DIR` | (optionnel) Chemin `/var/poolp-plugins/poolp-configurator` |
| `SCANZI_BACKEND_DIR` | (optionnel) Chemin `/var/www/astro/backend-php` |

Setup serveur initial (manuel, une fois) :

```bash
ssh chulee@scanzi.bcnco.site
sudo mkdir -p /var/poolp-plugins
sudo chown chulee:chulee /var/poolp-plugins
cd /var/poolp-plugins
git clone git@github.com:chulee/astro-plugins-poolp.git poolp-configurator

# .env du backend
echo "EXTERNAL_PLUGINS_DIR=/var/poolp-plugins" >> /var/www/astro/backend-php/.env

# Première migration
cd /var/www/astro/backend-php && php migrate.php
```

## Endpoints API

Tous préfixés par `/api`.

### Public
- `GET  /poolp/bootstrap` — boxes + équipements + finitions + traitements
- `POST /poolp/compute` — body inputs → résultat complet
- `GET  /poolp/delivery-zones/:cp` — résolution zone par code postal
- `POST /poolp/projects` — sauvegarde projet (token public)
- `GET  /poolp/projects/:token` — lecture projet (recalcule prix logistiques courants)
- `PUT  /poolp/projects/:token` — MAJ état
- `POST /poolp/projects/:token/qualify` — qualif pro/non pro
- `POST /poolp/projects/:token/pdf` — génère PDF (Dompdf)
- `POST /poolp/projects/:token/cart` — ajoute au panier ecommerce

### Admin (JWT editor+)
- `GET/POST/PUT/DELETE /poolp/admin/zones[/:id]`
- `GET /poolp/admin/projects` — liste projets
- `GET/DELETE /poolp/admin/projects/:id`

## Documentation

Voir le cahier des charges complet : `POOLP_CAHIER DES CHARGES.pdf`.
