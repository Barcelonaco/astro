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
        $html = preg_replace('/@(if|else|elseif|endif|foreach|endforeach|unless|endunless|empty|endempty|isset|endisset|section|endsection|yield|extends|include|php|endphp)\b[^]*?(?=@|$)/', '', $html);

        return $html;
    }

    private static function findTemplate(string $layout): ?string {
        $repoRoot = realpath(__DIR__ . '/../..');

        // Try nickl first
        $nicklPath = $repoRoot . '/nickl/resources/views/modules/' . $layout . '.blade.php';
        if (file_exists($nicklPath)) return file_get_contents($nicklPath);

        // Try plugins
        $pluginsDir = $repoRoot . '/plugins';
        if (is_dir($pluginsDir)) {
            foreach (scandir($pluginsDir) as $dir) {
                if ($dir === '.' || $dir === '..') continue;
                if (!is_dir($pluginsDir . '/' . $dir)) continue;
                $candidate = $pluginsDir . '/' . $dir . '/templates/' . $layout . '.blade.php';
                if (file_exists($candidate)) return file_get_contents($candidate);
            }
        }

        return null;
    }

    private static function renderGoogleReviews(): string {
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
            $url = "https://maps.googleapis.com/maps/api/place/details/json"
                . "?place_id=" . urlencode($placeId)
                . "&fields=reviews,rating,user_ratings_total"
                . "&key=" . urlencode($apiKey)
                . "&language=fr";
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_SSL_VERIFYPEER => true]);
            $response = curl_exec($ch);
            curl_close($ch);
            $json = json_decode($response, true);
            if (!$json || ($json['status'] ?? '') !== 'OK') {
                return '<p style="text-align:center;padding:2rem;color:red;">Erreur API Google Places: ' . htmlspecialchars($json['status'] ?? 'UNKNOWN') . '</p>';
            }
            $reviewsData = [
                'rating' => $json['result']['rating'] ?? 0,
                'user_ratings_total' => $json['result']['user_ratings_total'] ?? 0,
                'reviews' => $json['result']['reviews'] ?? [],
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

        return $html;
    }

    public static function renderBlock(): void {
        $body = get_json_body();
        $type = $body['type'] ?? '';
        if (empty($type)) error_response('Missing type', 400);

        $template = self::findTemplate($type);
        if (!$template) {
            json_response(['html' => '']);
            return;
        }

        // Special handling for google-reviews: fetch live data from plugin settings
        if ($type === 'google-reviews') {
            $html = self::renderGoogleReviews();
            json_response(['html' => $html]);
            return;
        }

        $variables = $body['data'] ?? [];
        $html = self::renderTemplate($template, $variables);
        json_response(['html' => $html]);
    }
}
