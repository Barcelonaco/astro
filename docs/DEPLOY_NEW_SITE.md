**Comment déployer un nouveau site ?**

1. Créer le nouveau domaine ou sous-domaine sur Plesk.

2. Ajouter ce nom de domaine dans Cloudflare.

3. Créer le certificat SSL pour le nouveau domaine.

4. Créer la base de donnée lié au site.

5. Créer les dossiers "httpdocs" puis dedans "backend-php" sur le serveur, dedans ajouter le fichier .env en se basant sur le .env.example du dossier "backend-php".

6. Faire pointer la racine du site vers "httpdocs/backend-php".

7. Modifier les directives supplémentaire Nginx

```
location ~* ^/xmlrpc.php$ {
return 403;
}

# ── Serve static files directly (bypass PHP-FPM) ──

# Astro build assets (fingerprinted → immutable)

location /\_astro/ {
alias /var/www/vhosts/bcnco.site/[URLSITE]/httpdocs/frontend/dist/\_astro/;
expires 1y;
add_header Cache-Control "public, max-age=31536000, immutable";
access_log off;
}

# Plugin assets

location /plugin-assets/ {
alias /var/www/vhosts/bcnco.site/[URLSITE]/httpdocs/plugins/;
expires 30d;
add_header Cache-Control "public, max-age=2592000";
access_log off;
}

# Favicon

location = /favicon.ico {
alias /var/www/vhosts/bcnco.site/[URLSITE]/httpdocs/frontend/dist/favicon.ico;
expires 30d;
access_log off;
}

location /fonts/ {
alias /var/www/vhosts/bcnco.site/[URLSITE]/httpdocs/frontend/dist/fonts/;
expires 1y;
add_header Cache-Control "public, max-age=31536000, immutable";
access_log off;
}

# Gzip

gzip on;
gzip_vary on;
gzip_types text/css application/javascript application/json image/svg+xml text/xml;
gzip_min_length 256;
```

8. Ajouter dans .github/workflows/ les informations pour le nouveau site, dans le fichier deploy-server[NUMERO_SERVER].yml.

**Note :**

- server 1 correspond au serveur 192.19.56.20 à l'abonnement bcnco.site
- server 2 correspond au serveur 192.19.56.20 à l'abonnement poolp
- Pour chaque site ayant leur propre abonnement Plesk, il faut créer un fichier deploy-server[NUMERO_SERVER].yml.

9. Ajouter les variables d'environnements dans les secrets Github du dépôt.

**À configurer :**

- NOMDUSITE_SSH_USER : Utilisateur ssh
- NOMDUSITE_SSH_HOST : Adresse ip
- NOMDUSITE_API_URL : https://nom-du-site.com/api

10. Vérifier que le nouveau workflow existe : `gh workflow list`

11. Lancer le workflow : `gh workflow run deploy-server[NUMERO_SERVER].yml site=[URLSITE]`

12. Vérifier que le workflow s'est bien déroulé : `gh run list`
