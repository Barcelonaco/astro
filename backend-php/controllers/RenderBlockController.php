<?php

class RenderBlockController {
    private static function renderTemplate(string $template, array $variables): string {
        $html = $template;

        // {!! $var !!} — raw (unescaped) output
        $html = preg_replace_callback('/\{!!\s*\$(\w+)\s*!!\}/', function ($m) use ($variables) {
            return isset($variables[$m[1]]) ? (string) $variables[$m[1]] : '';
        }, $html);

        // {{ $var }} — escaped output
        $html = preg_replace_callback('/\{\{\s*\$(\w+)\s*\}\}/', function ($m) use ($variables) {
            if (!isset($variables[$m[1]])) return '';
            return htmlspecialchars((string) $variables[$m[1]], ENT_QUOTES, 'UTF-8');
        }, $html);

        // Remove Blade directives we can't process
        $html = preg_replace('/@(if|else|elseif|endif|foreach|endforeach|unless|endunless|empty|endempty|isset|endisset|section|endsection|yield|extends|include|php|endphp)\b[\s\S]*?(?=@|$)/', '', $html);

        return $html;
    }

    private static function findTemplate(string $layout): ?string {
        // Sanitize layout name: only allow alphanumeric, hyphens and underscores
        if (!preg_match('/^[a-zA-Z0-9_-]+$/', $layout)) return null;

        $backendRoot = realpath(__DIR__ . '/..');
        $repoRoot = realpath(__DIR__ . '/../..');

        // Try backend-php/templates first
        $localPath = $backendRoot . '/templates/modules/' . $layout . '.blade.php';
        if (file_exists($localPath)) return file_get_contents($localPath);

        // Try nickl (local dev fallback)
        $nicklPath = $repoRoot . '/nickl/resources/views/modules/' . $layout . '.blade.php';
        if (file_exists($nicklPath)) return file_get_contents($nicklPath);

        // Try plugins from all registered roots (monorepo + EXTERNAL_PLUGINS_DIR), skip inactive
        foreach (PluginController::getPluginRoots() as $pluginsDir) {
            if (!is_dir($pluginsDir)) continue;
            foreach (scandir($pluginsDir) as $dir) {
                if ($dir === '.' || $dir === '..') continue;
                if (!is_dir($pluginsDir . '/' . $dir)) continue;
                if (!PluginController::isPluginActive($dir)) continue;
                $candidate = $pluginsDir . '/' . $dir . '/templates/' . $layout . '.blade.php';
                if (file_exists($candidate)) return file_get_contents($candidate);
            }
        }

        return null;
    }

    private static function renderGoogleReviews(array $blockData = []): string {
        // Read plugin settings
        $db = Database::getInstance();
        $stmt = $db->query("SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'plugin_google_reviews_%'");
        $rows = $stmt->fetchAll();
        $s = [];
        foreach ($rows as $row) {
            $s[str_replace('plugin_google_reviews_', '', $row['setting_key'])] = $row['setting_value'];
        }

        $apiKey = $s['google_api_key'] ?? '';
        $placeId = $s['place_id'] ?? '';

        if (empty($apiKey) || empty($placeId)) {
            return '<p style="text-align:center;padding:2rem;opacity:0.6;">Configurez la clé API et le Place ID dans les options du plugin Avis Google.</p>';
        }

        // Fetch reviews (reuse cache logic)
        $limit = max(1, min(5, (int) ($s['limit'] ?? 5)));
        $minRating = max(1, min(5, (int) ($s['min_rating'] ?? 4)));

        $cacheDir = __DIR__ . '/../uploads/.cache';
        if (!is_dir($cacheDir)) mkdir($cacheDir, 0755, true);
        $cacheFile = $cacheDir . '/google_reviews_' . md5($placeId . 'fr') . '.json';

        $reviewsData = null;
        if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < 86400) {
            $reviewsData = json_decode(file_get_contents($cacheFile), true);
        }

        if (!$reviewsData) {
            // Places API (New)
            $url = "https://places.googleapis.com/v1/places/" . urlencode($placeId) . "?languageCode=fr";
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 10,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
                CURLOPT_HTTPHEADER => [
                    'X-Goog-Api-Key: ' . $apiKey,
                    'X-Goog-FieldMask: rating,userRatingCount,reviews',
                ],
            ]);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            $json = json_decode($response, true);
            if (!$json || $httpCode !== 200) {
                $errorMsg = $json['error']['message'] ?? 'UNKNOWN';
                return '<p style="text-align:center;padding:2rem;color:red;">Erreur API Google Places: ' . htmlspecialchars($errorMsg) . '</p>';
            }
            // Normalize new API response → legacy format
            $reviews = [];
            foreach ($json['reviews'] ?? [] as $r) {
                $reviews[] = [
                    'author_name' => $r['authorAttribution']['displayName'] ?? '',
                    'author_url' => $r['authorAttribution']['uri'] ?? '',
                    'profile_photo_url' => $r['authorAttribution']['photoUri'] ?? '',
                    'rating' => (int) ($r['rating'] ?? 0),
                    'relative_time_description' => $r['relativePublishTimeDescription'] ?? '',
                    'text' => $r['text']['text'] ?? '',
                    'time' => strtotime($r['publishTime'] ?? 'now'),
                ];
            }
            $reviewsData = [
                'rating' => $json['rating'] ?? 0,
                'user_ratings_total' => $json['userRatingCount'] ?? 0,
                'reviews' => $reviews,
            ];
            file_put_contents($cacheFile, json_encode($reviewsData, JSON_UNESCAPED_UNICODE));
        }

        $reviews = array_filter($reviewsData['reviews'], fn($r) => ($r['rating'] ?? 0) >= $minRating);
        $reviews = array_slice(array_values($reviews), 0, $limit);
        $rating = $reviewsData['rating'];
        $total = $reviewsData['user_ratings_total'];

        if (empty($reviews)) {
            return '<p style="text-align:center;padding:2rem;">Aucun avis ne correspond aux critères.</p>';
        }

        // Build preview HTML
        $stars = str_repeat('★', (int) round($rating)) . str_repeat('☆', 5 - (int) round($rating));
        $html = '<div style="text-align:center;margin-bottom:20px;">';
        $html .= '<span style="font-size:2.5rem;font-weight:700;">' . number_format($rating, 1) . '</span> ';
        $html .= '<span style="color:#fbbc04;font-size:1.3rem;">' . $stars . '</span><br>';
        $html .= '<small style="opacity:0.6;">Basé sur <strong>' . $total . '</strong> avis — Google</small>';
        $html .= '</div>';
        $html .= '<div style="display:flex;gap:12px;overflow-x:auto;padding:8px 0;">';
        foreach ($reviews as $r) {
            $rstars = str_repeat('★', (int) $r['rating']) . str_repeat('☆', 5 - (int) $r['rating']);
            $photo = htmlspecialchars($r['profile_photo_url'] ?? '');
            $name = htmlspecialchars($r['author_name'] ?? '');
            $time = htmlspecialchars($r['relative_time_description'] ?? '');
            $text = htmlspecialchars(mb_strimwidth($r['text'] ?? '', 0, 200, '...'));
            $html .= '<div style="flex:0 0 280px;background:rgba(255,255,255,0.15);border-radius:8px;padding:16px;backdrop-filter:blur(4px);">';
            $html .= '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">';
            $html .= '<img src="' . $photo . '" width="36" height="36" style="border-radius:50%;">';
            $html .= '<div><strong style="font-size:0.85rem;">' . $name . '</strong><br><small style="opacity:0.5;">' . $time . '</small></div>';
            $html .= '</div>';
            $html .= '<div style="color:#fbbc04;margin-bottom:6px;">' . $rstars . '</div>';
            $html .= '<p style="font-size:0.85rem;line-height:1.5;margin:0;opacity:0.9;">' . $text . '</p>';
            $html .= '</div>';
        }
        $html .= '</div>';

        // Google Reviews link (place_id from block data or plugin settings)
        $showLink = !empty($blockData['display_google_reviews_link']) && ($blockData['display_google_reviews_link'] === true || $blockData['display_google_reviews_link'] === 1 || $blockData['display_google_reviews_link'] === '1');
        if ($showLink && $placeId) {
            $btnText = htmlspecialchars($blockData['button_text'] ?? 'Voir tous les avis');
            $btnLink = 'https://search.google.com/local/reviews?placeid=' . urlencode($placeId);
            $html .= '<div style="text-align:center;margin-top:2rem;">';
            $html .= '<a href="' . $btnLink . '" target="_blank" rel="noopener noreferrer" class="btn btn-tertiary">' . $btnText . '</a>';
            $html .= '</div>';
        }

        return $html;
    }

    private static function renderBlocReferences(array $data): string {
        $db = Database::getInstance();

        $isManual = !empty($data['is_manual']) && ($data['is_manual'] === true || $data['is_manual'] === 1 || $data['is_manual'] === '1');
        $refsId = $data['refs_id'] ?? [];

        $refs = [];
        try {
            if ($isManual && !empty($refsId)) {
                $ids = array_map('intval', (array) $refsId);
                $placeholders = implode(',', array_fill(0, count($ids), '?'));
                $stmt = $db->prepare("SELECT * FROM cpt_references WHERE id IN ({$placeholders}) AND status = 'published' ORDER BY FIELD(id, {$placeholders})");
                $stmt->execute(array_merge($ids, $ids));
                $refs = $stmt->fetchAll();
            } else {
                $stmt = $db->query("SELECT * FROM cpt_references WHERE status = 'published' ORDER BY created_at DESC LIMIT 3");
                $refs = $stmt->fetchAll();
            }
        } catch (\Exception $e) {
            return '<p style="text-align:center;padding:2rem;opacity:0.6;">Table des références non trouvée.</p>';
        }

        if (empty($refs)) {
            return '<p style="text-align:center;padding:2rem;opacity:0.6;">Aucune référence à afficher.</p>';
        }

        // Attach categories
        $ids = array_column($refs, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        try {
            $stmt = $db->prepare("SELECT m.item_id, c.name FROM cpt_references_category_map m JOIN cpt_references_categories c ON c.id = m.category_id WHERE m.item_id IN ({$placeholders})");
            $stmt->execute($ids);
            $catMap = [];
            foreach ($stmt->fetchAll() as $r) {
                $catMap[$r['item_id']] = $r['name'];
            }
        } catch (\Exception $e) {
            $catMap = [];
        }

        // Detect background color for text contrast
        $bgColor = $data['bloc_color'] ?? '';
        $isDarkBg = str_contains($bgColor, 'background-primary') || str_contains($bgColor, 'background-secondary');
        $catColor = $isDarkBg ? '#fff' : 'var(--color-primary, #3b82f6)';
        $nameColor = $isDarkBg ? '#fff' : '#999';
        $titleColor = $isDarkBg ? '#fff' : 'inherit';
        $btnColor = $isDarkBg ? 'color:#fff;' : '';

        $html = '<ul class="list" style="display:flex;flex-wrap:wrap;gap:26px;row-gap:48px;list-style:none;padding:0;margin:0;">';
        foreach ($refs as $ref) {
            $title = htmlspecialchars($ref['title'] ?? '');
            $customFields = !empty($ref['custom_fields']) ? (is_string($ref['custom_fields']) ? json_decode($ref['custom_fields'], true) : $ref['custom_fields']) : [];
            $customerName = htmlspecialchars($customFields['customer_name'] ?? '');
            $category = htmlspecialchars($catMap[$ref['id']] ?? '');

            // Resolve image
            $imgUrl = '';
            $featuredImage = !empty($ref['featured_image']) ? (is_string($ref['featured_image']) ? json_decode($ref['featured_image'], true) : $ref['featured_image']) : null;
            if ($featuredImage) {
                $imgUrl = is_array($featuredImage) ? ($featuredImage['url'] ?? '') : (string) $featuredImage;
            }
            if (empty($imgUrl)) {
                $photos = $customFields['photos'] ?? '';
                if (is_string($photos)) {
                    $parsed = json_decode($photos, true);
                    if (is_array($parsed) && !empty($parsed)) $imgUrl = $parsed[0];
                }
            }

            $html .= '<li style="width:calc(100% / 3 - 18px);">';
            if ($imgUrl) {
                $imgUrl = htmlspecialchars($imgUrl);
                $html .= '<div style="overflow:hidden;background:rgba(0,0,0,.05);border-radius:.75rem;aspect-ratio:100/74.78;">';
                $html .= '<img src="' . $imgUrl . '" alt="' . $title . '" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy">';
                $html .= '</div>';
            }
            $html .= '<div style="padding-top:.875rem;">';
            if ($category) {
                $html .= '<p style="margin:0 0 .125rem;font-size:.875rem;line-height:1.2;letter-spacing:-.04em;color:' . $catColor . ';text-transform:uppercase;">' . $category . '</p>';
            }
            $html .= '<h3 style="margin:0;font-size:1.5rem;font-weight:700;line-height:1.2;color:' . $titleColor . ';">' . $title . '</h3>';
            if ($customerName) {
                $html .= '<p style="margin-top:.75rem;font-size:1.25rem;line-height:1.2;letter-spacing:-.04em;color:' . $nameColor . ';">' . $customerName . '</p>';
            }
            $html .= '</div>';
            $html .= '</li>';
        }
        $html .= '</ul>';

        // Archive link
        $showArchive = !empty($data['display_archive_link']) && ($data['display_archive_link'] === true || $data['display_archive_link'] === 1 || $data['display_archive_link'] === '1');
        if ($showArchive) {
            $label = htmlspecialchars($data['archive_link_label'] ?? 'Voir toutes les références');
            $html .= '<div style="margin-top:60px;text-align:center;">';
            $html .= '<a href="/references" class="btn btn-tertiary color-primary" style="' . $btnColor . '">' . $label . '</a>';
            $html .= '</div>';
        }

        return $html;
    }

    public static function renderBlock(): void {
        $body = get_json_body();
        $type = $body['type'] ?? '';
        if (empty($type)) error_response('Missing type', 400);

        // Block types from disabled plugins → render nothing
        if (!PluginController::isBlockTypeActive($type)) {
            json_response(['html' => '']);
            return;
        }

        // Special handling for bloc-references: fetch live data from DB
        if ($type === 'bloc-references') {
            $html = self::renderBlocReferences($body['data'] ?? []);
            json_response(['html' => $html]);
            return;
        }

        // Special handling for google-reviews: fetch live data from plugin settings
        if ($type === 'google-reviews') {
            $html = self::renderGoogleReviews($body['data'] ?? []);
            json_response(['html' => $html]);
            return;
        }

        $template = self::findTemplate($type);
        if (!$template) {
            json_response(['html' => '']);
            return;
        }

        $variables = $body['data'] ?? [];
        $html = self::renderTemplate($template, $variables);
        json_response(['html' => $html]);
    }
}
