<?php

class SearchController {
    /**
     * GET /search?q=...&limit=20&offset=0
     * Searches across posts, pages, and CPT tables (published only).
     * Returns unified results sorted by relevance.
     */
    public static function search(): void {
        $q = trim($_GET['q'] ?? '');
        if ($q !== '' && mb_strlen($q) < 2) {
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
        $hasQuery = $q !== '';
        $like = $hasQuery ? '%' . $q . '%' : '';

        $allResults = [];

        // ── Posts ──
        if ($hasQuery) {
            $stmt = $db->prepare("
                SELECT p.id, p.title, p.slug, p.excerpt, p.featured_image, p.published_date,
                       'post' as result_type, '/blog/' as base_url
                FROM posts p
                WHERE p.status = 'published'
                  AND (p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?)
                ORDER BY p.published_date DESC
            ");
            $stmt->execute([$like, $like, $like]);
        } else {
            $stmt = $db->query("
                SELECT p.id, p.title, p.slug, p.excerpt, p.featured_image, p.published_date,
                       'post' as result_type, '/blog/' as base_url
                FROM posts p
                WHERE p.status = 'published'
                ORDER BY p.published_date DESC
            ");
        }
        $allResults = array_merge($allResults, $stmt->fetchAll());

        // ── Pages ──
        if ($hasQuery) {
            $stmt = $db->prepare("
                SELECT p.id, p.title, p.slug, '' as excerpt, '' as featured_image, p.created_at as published_date,
                       'page' as result_type, '/' as base_url
                FROM pages p
                WHERE p.status = 'published'
                  AND (p.title LIKE ? OR p.content LIKE ?)
                ORDER BY p.menu_order ASC
            ");
            $stmt->execute([$like, $like]);
        } else {
            $stmt = $db->query("
                SELECT p.id, p.title, p.slug, '' as excerpt, '' as featured_image, p.created_at as published_date,
                       'page' as result_type, '/' as base_url
                FROM pages p
                WHERE p.status = 'published'
                ORDER BY p.menu_order ASC
            ");
        }
        $allResults = array_merge($allResults, $stmt->fetchAll());

        // ── CPT tables (dynamic — discover all cpt_* tables from DB) ──
        $dbName = $_ENV['DB_NAME'] ?? 'astro_blog_cms';
        $cptStmt = $db->prepare("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE 'cpt\\_%' AND TABLE_NAME NOT LIKE '%\\_categories' AND TABLE_NAME NOT LIKE '%\\_category\\_map'");
        $cptStmt->execute([$dbName]);
        $cptTables = $cptStmt->fetchAll(PDO::FETCH_COLUMN);

        foreach ($cptTables as $table) {
                    $slug = preg_replace('/^cpt_/', '', $table);
                    $baseUrl = "/{$slug}/";
                    try {
                        if ($hasQuery) {
                            $stmt = $db->prepare("
                                SELECT id, title, slug, excerpt, featured_image, published_date,
                                       ? as result_type, ? as base_url
                                FROM `{$table}`
                                WHERE status = 'published'
                                  AND (title LIKE ? OR excerpt LIKE ? OR content LIKE ?)
                                ORDER BY published_date DESC
                            ");
                            $stmt->execute([$slug, $baseUrl, $like, $like, $like]);
                        } else {
                            $stmt = $db->prepare("
                                SELECT id, title, slug, excerpt, featured_image, published_date,
                                       ? as result_type, ? as base_url
                                FROM `{$table}`
                                WHERE status = 'published'
                                ORDER BY published_date DESC
                            ");
                            $stmt->execute([$slug, $baseUrl]);
                        }
                        $allResults = array_merge($allResults, $stmt->fetchAll());
                    } catch (\PDOException $e) {
                        // Skip CPT tables with incompatible schema
                        continue;
                    }
        }

        // Score results by relevance (title match > excerpt match > content match)
        if ($hasQuery) {
            $qLower = mb_strtolower($q);
            foreach ($allResults as &$r) {
                $score = 0;
                if (mb_stripos($r['title'] ?? '', $q) !== false) $score += 10;
                if (mb_stripos($r['excerpt'] ?? '', $q) !== false) $score += 5;
                if (mb_strtolower($r['title'] ?? '') === $qLower) $score += 20;
                $r['_score'] = $score;
            }
            unset($r);
            usort($allResults, function($a, $b) {
                if ($a['_score'] !== $b['_score']) return $b['_score'] - $a['_score'];
                return strcmp($b['published_date'] ?? '', $a['published_date'] ?? '');
            });
        }

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
