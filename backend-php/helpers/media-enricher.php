<?php

/**
 * Enrichit les objets image dans le contenu JSON des pages/posts
 * en ajoutant les métadonnées à jour depuis media_items (alt, title, caption, width, height).
 * Matche par ID ou par URL (filename).
 */
function enrichMediaInContent(string $contentJson): string {
    if (!$contentJson) return $contentJson;

    $blocks = json_decode($contentJson, true);
    if (!is_array($blocks)) return $contentJson;

    // 1. Collecter toutes les URLs /uploads/media/ et IDs depuis les objets image
    $mediaIds = [];
    $mediaUrls = [];
    collectMediaRefs($blocks, $mediaIds, $mediaUrls);

    if (empty($mediaIds) && empty($mediaUrls)) return $contentJson;

    // 2. Fetch metadata en une seule requête
    $db = Database::getInstance();
    $conditions = [];
    $params = [];

    if (!empty($mediaIds)) {
        $placeholders = implode(',', array_fill(0, count($mediaIds), '?'));
        $conditions[] = "id IN ({$placeholders})";
        $params = array_merge($params, array_values($mediaIds));
    }
    if (!empty($mediaUrls)) {
        $placeholders = implode(',', array_fill(0, count($mediaUrls), '?'));
        $conditions[] = "url IN ({$placeholders})";
        $params = array_merge($params, array_values($mediaUrls));
    }

    $where = implode(' OR ', $conditions);
    $stmt = $db->prepare("SELECT id, url, alt, title, caption, original_name, width, height FROM media_items WHERE {$where}");
    $stmt->execute($params);

    $byId = [];
    $byUrl = [];
    foreach ($stmt->fetchAll() as $row) {
        $byId[(int)$row['id']] = $row;
        $byUrl[$row['url']] = $row;
    }

    if (empty($byId) && empty($byUrl)) return $contentJson;

    // 3. Enrichir les blocs
    enrichBlocks($blocks, $byId, $byUrl);

    return json_encode($blocks, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/**
 * Collecte les IDs et URLs des objets image dans le contenu.
 * Un objet image est un tableau avec une clé "url" qui contient "/uploads/media/".
 */
function collectMediaRefs(mixed $data, array &$ids, array &$urls): void {
    if (!is_array($data)) return;

    // Détecte un objet image : a un "url" string contenant /uploads/media/
    if (isset($data['url']) && is_string($data['url']) && str_contains($data['url'], '/uploads/media/') && !str_contains($data['url'], '_optimized')) {
        if (isset($data['id']) && is_int($data['id']) && $data['id'] > 0) {
            $ids[$data['id']] = $data['id'];
        }
        $urls[$data['url']] = $data['url'];
    }

    // Récurser dans tous les sous-éléments
    foreach ($data as $value) {
        if (is_array($value)) {
            collectMediaRefs($value, $ids, $urls);
        }
    }
}

/**
 * Enrichit les objets image en place avec les métadonnées à jour.
 * Ne transforme PAS les strings — enrichit uniquement les objets existants.
 */
function enrichBlocks(array &$data, array $byId, array $byUrl): void {
    foreach ($data as $key => &$value) {
        if (!is_array($value)) continue;

        // Si c'est un objet image (a un "url" string vers /uploads/media/)
        if (isset($value['url']) && is_string($value['url']) && str_contains($value['url'], '/uploads/media/') && !str_contains($value['url'], '_optimized')) {
            $meta = null;
            if (isset($value['id']) && isset($byId[(int)$value['id']])) {
                $meta = $byId[(int)$value['id']];
            } elseif (isset($byUrl[$value['url']])) {
                $meta = $byUrl[$value['url']];
            }
            if ($meta) {
                $value['id'] = (int)$meta['id'];
                $value['alt'] = $meta['alt'] ?? '';
                $value['title'] = $meta['title'] ?? '';
                $value['caption'] = $meta['caption'] ?? '';
                if ($meta['width']) $value['width'] = (int)$meta['width'];
                if ($meta['height']) $value['height'] = (int)$meta['height'];
            }
        }

        // Récurser
        enrichBlocks($value, $byId, $byUrl);
    }
}
