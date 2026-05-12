# Import des médias WordPress vers Astro

Procédure pour migrer la médiathèque d'un site WordPress (incluant multisite) vers la médiathèque Astro CMS, en filtrant automatiquement les variantes générées par WP (thumbnails, scaled, edits) pour ne garder que les originaux référencés en base.

## Prérequis

- Accès SSH au serveur **source** WordPress
- Accès SSH au serveur **cible** Astro (dossier `backend-php/`)
- Accès phpMyAdmin (ou MySQL CLI) à la base WP
- Le script `backend-php/scripts/import-wp-media.php` présent côté Astro

## Vue d'ensemble

```
WP DB (table wp_posts)         WP filesystem (uploads/)
    │                                  │
    │ export _wp_attached_file         │ rsync vers serveur Astro
    ▼                                  ▼
whitelist.txt ─────► import-wp-media.php ◄───── /tmp/wp-import/
                          │
                          ▼
            backend-php/uploads/media/
            + INSERT media_items
```

Le script utilise la **whitelist DB WP** comme source de vérité : seuls les fichiers référencés dans `wp_posts.attachment` sont importés. Les variantes WP (`-WIDTHxHEIGHT`, `-scaled`, `-eTIMESTAMP`), backups, caches plugins et autres extras sont automatiquement filtrés.

---

## Étape 1 — Exporter la whitelist depuis la base WP

Dans phpMyAdmin sur la base WordPress source, exécute :

```sql
SELECT pm.meta_value
FROM wp_posts p
JOIN wp_postmeta pm ON pm.post_id = p.ID AND pm.meta_key = '_wp_attached_file'
WHERE p.post_type = 'attachment';
```

> **Multisite** : remplace `wp_posts` / `wp_postmeta` par le préfixe du sous-site, ex : `wp_85_posts` / `wp_85_postmeta`.

Exporte le résultat en CSV (sans header). Place-le sur le serveur Astro :

```bash
# Upload via SFTP, ou colle directement sur le serveur :
scp wp-attachments.csv user@astro-server:/tmp/wp-attachments.txt
```

Nettoie le fichier (header + quotes phpMyAdmin) :

```bash
ssh user@astro-server
sed -i '1d; s/"//g' /tmp/wp-attachments.txt

# Vérification
head -3 /tmp/wp-attachments.txt
# Doit afficher des chemins type :
#   2025/07/parquet-nimes1.jpg
#   2025/07/IMG_5587.jpeg
```

---

## Étape 2 — Transférer les fichiers via rsync

Connecté sur le serveur Astro, rsync depuis le serveur WP :

```bash
ssh user@astro-server

mkdir -p /tmp/wp-import

rsync -av --progress \
  wp-user@wp-server:/var/www/.../wp-content/uploads/sites/85/ \
  /tmp/wp-import/
```

> **Important** : trailing slash sur la source (`sites/85/` et non `sites/85`) pour copier le contenu et non le dossier lui-même.
>
> Pas d'`--exclude` : la whitelist filtre côté script. Les excludes rsync risquent de virer des fichiers légitimes (filenames contenant des nombres, conversions Imagify, etc.).

---

## Étape 3 — Dry-run

Vérifie sans rien écrire :

```bash
cd ~/atempora.bcnco.site/httpdocs/backend-php

php scripts/import-wp-media.php \
  /tmp/wp-import \
  --whitelist=/tmp/wp-attachments.txt \
  --dry-run | tail -10
```

Sortie attendue :

```
--- Stats ---
scanned             31493
skipped_variant     0
skipped_ext         275
skipped_whitelist   30350     ← extras filtrés
imported            868       ← ≈ taille whitelist
errors              0
```

`imported` doit être proche de la taille de la whitelist. Un écart de 1-3 fichiers est normal (orphelins WP DB pointant vers fichiers vraiment supprimés).

### Diagnostiquer un gros écart

Si `imported` << `whitelist`, lister les fichiers manquants :

```bash
find /tmp/wp-import -type f -printf '%P\n' | sort -u > /tmp/disk-paths.txt
sort /tmp/wp-attachments.txt -o /tmp/wl-sorted.txt
comm -23 /tmp/wl-sorted.txt /tmp/disk-paths.txt
```

Causes typiques :
- **rsync `--exclude`** trop agressif → relancer sans excludes
- **Whitelist mal nettoyée** (header, quotes) → `sed -i '1d; s/"//g' wp-attachments.txt`
- **CR Windows** → `sed -i 's/\r$//' wp-attachments.txt`
- **BOM UTF-8** → `sed -i '1s/^\xEF\xBB\xBF//' wp-attachments.txt`

---

## Étape 4 — Backup puis import réel

```bash
# Backup DB media tables
mysqldump -u USER -p DB_NAME media_items media_folders > /tmp/media_backup.sql

# Backup fichiers media existants
tar -czf /tmp/uploads_backup.tgz ~/atempora.bcnco.site/httpdocs/backend-php/uploads/media/

# Import réel (sans --dry-run)
php scripts/import-wp-media.php \
  /tmp/wp-import \
  --whitelist=/tmp/wp-attachments.txt
```

Le script :
- Copie chaque fichier dans `backend-php/uploads/media/{timestamp}_{random}.ext`
- INSERT dans `media_items` (folder_id NULL = racine "Non classé")
- Préserve `original_name` (nom WP) pour la recherche admin
- Détecte les dimensions via `getimagesize()`
- Affiche progression tous les 50 fichiers

---

## Étape 5 — Cleanup

```bash
# Supprime le rsync temporaire
rm -rf /tmp/wp-import

# Supprime la whitelist
rm /tmp/wp-attachments.txt
```

Vérifie l'admin Astro : la médiathèque doit afficher l'ancien total + le nombre importé.

---

## Options du script

```
php scripts/import-wp-media.php <source_dir> [options]

  --dry-run              Simulation, pas d'écriture DB ni de copie
  --with-folders         Recrée l'arborescence WP (YYYY/MM) en media_folders
  --whitelist=<fichier>  N'importe que les chemins listés dans le fichier
                         (un chemin relatif par ligne)
```

### Modes courants

| Cas | Commande |
|-----|----------|
| Migration propre WP → Astro | `--whitelist=<wp-attachments.txt>` |
| Import simple sans whitelist (filtre regex variants seulement) | (sans flag) |
| Import + arborescence dossiers | `--whitelist=... --with-folders` |
| Aperçu avant exécution | ajouter `--dry-run` à n'importe quelle commande |

---

## Restauration en cas de problème

```bash
# Restore DB
mysql -u USER -p DB_NAME < /tmp/media_backup.sql

# Restore fichiers (écrase les copies réalisées par l'import)
tar -xzf /tmp/uploads_backup.tgz -C /
```

---

## Limitations connues

- **Pas de relations posts ↔ médias** : seule la médiathèque est migrée. Les références dans le contenu des articles WP ne sont pas mises à jour automatiquement.
- **Pas de migration de taxonomies** : si WP utilise un plugin de catégories médias (WP Real Media Library, etc.), les catégories ne sont pas importées.
- **Filenames safe-renommés** : les fichiers reçoivent un nom timestamp+random côté Astro. L'`original_name` est conservé en DB pour la recherche, mais les URL changent. Si tu veux préserver les URL WP exactes, modifier le script pour utiliser `$basename` au lieu du nom safe.
- **Doublons** : le script ne déduplique pas. Si la whitelist contient deux chemins menant au même fichier, deux entries `media_items` seront créées.

---

## Fichier du script

[backend-php/scripts/import-wp-media.php](../backend-php/scripts/import-wp-media.php)
