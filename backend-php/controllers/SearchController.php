<?php

class SearchController {
    /**
     * GET /search?q=...&limit=20&offset=0
     * Searches across posts, pages, and CPT tables (published only).
     * Returns unified results sorted by relevance.
     */
    public static function search(): void {
        $q = trim($_GET['q'] ?? '');
        if ($q === '' || mb_strlen($q) < 2) {
            json_response(['results' => [], 'total' => 0, 'query' => $q]);
            return;
        }
        // Cap search query length to prevent DoS via massive LIKE queries
        if (mb_strlen($q) > 200) {
            $q = mb_substr($q, 0, 200);
        }

        $limit  = min(max((int) ($_GET['limit'] ?? 20), 1), 100);
        $offset = max((int) ($_GET['offset'] ?? 0), 0);
        $db = Database::getInstance();
        $like = '%' . $q . '%';

        $allResults = [];

        // ── Posts ──
        $stmt = $db->prepare("
            SELECT p.id, p.title, p.slug, p.excerpt, p.featured_image, p.published_date,
                   'post' as result_type, '/blog/' as base_url
            FROM posts p
            WHERE p.status = 'published'
              AND (p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?)
            ORDER BY p.published_date DESC
        ");
        $stmt->execute([$like, $like, $like]);
        $allResults = array_merge($allResults, $stmt->fetchAll());

        // ── Pages ──
        $stmt = $db->prepare("
            SELECT p.id, p.title, p.slug, '' as excerpt, '' as featured_image, p.created_at as published_date,
                   'page' as result_type, '/' as base_url
            FROM pages p
            WHERE p.status = 'published'
              AND (p.title LIKE ? OR p.content LIKE ?)
            ORDER BY p.menu_order ASC
        ");
        $stmt->execute([$like, $like]);
        $allResults = array_merge($allResults, $stmt->fetchAll());

        // ── CPT tables (dynamic) ──
        $pluginsDir = dirname(__DIR__) . '/plugins';  // Fallback
        // Try the monorepo plugins dir first
        $monorepoPlugins = dirname(__DIR__, 2) . '/plugins';
        if (is_dir($monorepoPlugins)) {
            $pluginsDir = $monorepoPlugins;
        }

        if (is_dir($pluginsDir)) {
            foreach (glob($pluginsDir . '/*/plugin.json') as $manifest) {
                $plugin = json_decode(file_get_contents($manifest), true);
                if (!$plugin || empty($plugin['postTypes'])) continue;

                foreach ($plugin['postTypes'] as $pt) {
                    $slug = $pt['slug'] ?? '';
                    if (!$slug) continue;

                    // Validate slug format
                    if (!preg_match('/^[a-z0-9-]+$/', $slug)) continue;
                    $table = "cpt_{$slug}";
                    // Check table exists (parameterized)
                    $checkStmt = $db->prepare("SHOW TABLES LIKE ?");
                    $checkStmt->execute([$table]);
                    $check = $checkStmt->fetch();
                    if (!$check) continue;

                    $baseUrl = "/{$slug}/";
                    $stmt = $db->prepare("
                        SELECT id, title, slug, excerpt, featured_image, published_date,
                               ? as result_type, ? as base_url
                        FROM `{$table}`
                        WHERE status = 'published'
                          AND (title LIKE ? OR excerpt LIKE ? OR content LIKE ?)
                        ORDER BY published_date DESC
                    ");
                    $stmt->execute([$slug, $baseUrl, $like, $like, $like]);
                    $allResults = array_merge($allResults, $stmt->fetchAll());
                }
            }
        }

        // Score results by relevance (title match > excerpt match > content match)
        $qLower = mb_strtolower($q);
        foreach ($allResults as &$r) {
            $score = 0;
            if (mb_stripos($r['title'] ?? '', $q) !== false) $score += 10;
            if (mb_stripos($r['excerpt'] ?? '', $q) !== false) $score += 5;
            // Exact title match bonus
            if (mb_strtolower($r['title'] ?? '') === $qLower) $score += 20;
            $r['_score'] = $score;
        }
        unset($r);

        // Sort by score DESC, then date DESC
        usort($allResults, function($a, $b) {
            if ($a['_score'] !== $b['_score']) return $b['_score'] - $a['_score'];
            return strcmp($b['published_date'] ?? '', $a['published_date'] ?? '');
        });

        $total = count($allResults);

        // Paginate
        $paged = array_slice($allResults, $offset, $limit);

        // Clean up internal fields and format output
        $results = array_map(function($r) {
            unset($r['_score']);
            // Parse featured_image JSON if needed
            if (!empty($r['featured_image']) && is_string($r['featured_image'])) {
                $decoded = json_decode($r['featured_image'], true);
                if ($decoded) {
                    $r['featured_image'] = $decoded;
                }
            }
            return $r;
        }, $paged);

        json_response([
            'results' => array_values($results),
            'total'   => $total,
            'query'   => $q,
        ]);
    }
}
