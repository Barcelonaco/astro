<?php

class GoogleReviewsController {

    /**
     * Lit les options du plugin google-reviews depuis la table settings.
     */
    private static function getPluginSettings(): array {
        $db = Database::getInstance();
        $stmt = $db->query("SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'plugin_google_reviews_%'");
        $rows = $stmt->fetchAll();
        $settings = [];
        foreach ($rows as $row) {
            $key = str_replace('plugin_google_reviews_', '', $row['setting_key']);
            $settings[$key] = $row['setting_value'];
        }
        return $settings;
    }

    /**
     * GET /google-reviews
     * Récupère les avis Google en utilisant les options du plugin.
     * Paramètres query optionnels : place_id, limit, min_rating, lang
     * (surchargent les valeurs du plugin si fournis)
     */
    public static function get(): void {
        $pluginSettings = self::getPluginSettings();

        // Paramètres : query > plugin settings > defaults
        $apiKey = $pluginSettings['google_api_key'] ?? '';
        $placeId = $_GET['place_id'] ?? $pluginSettings['place_id'] ?? '';
        $limit = max(1, min(5, (int) ($_GET['limit'] ?? $pluginSettings['limit'] ?? 5)));
        $minRating = max(1, min(5, (int) ($_GET['min_rating'] ?? $pluginSettings['min_rating'] ?? 4)));
        $lang = $_GET['lang'] ?? 'fr';

        if (empty($apiKey)) {
            error_response('Clé API Google non configurée. Ajoutez-la dans les options du plugin Avis Google.', 500);
        }

        if (empty($placeId)) {
            error_response('Place ID non configuré. Ajoutez-le dans les options du plugin Avis Google.', 400);
        }

        // Cache fichier (24h)
        $cacheDir = __DIR__ . '/../uploads/.cache';
        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0755, true);
        }
        $cacheFile = $cacheDir . '/google_reviews_' . md5($placeId . $lang) . '.json';
        $cacheTTL = 86400;

        $reviewsData = null;
        if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTTL) {
            $reviewsData = json_decode(file_get_contents($cacheFile), true);
        }

        if (!$reviewsData) {
            $url = "https://maps.googleapis.com/maps/api/place/details/json"
                . "?place_id=" . urlencode($placeId)
                . "&fields=reviews,rating,user_ratings_total"
                . "&key=" . urlencode($apiKey)
                . "&language=" . urlencode($lang);

            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 10,
                CURLOPT_SSL_VERIFYPEER => true,
            ]);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($response === false || $httpCode !== 200) {
                error_response('Erreur lors de la récupération des avis Google: ' . ($curlError ?: "HTTP $httpCode"), 502);
            }

            $json = json_decode($response, true);
            if (!$json || ($json['status'] ?? '') !== 'OK') {
                $status = $json['status'] ?? 'UNKNOWN';
                $errorMsg = $json['error_message'] ?? $status;
                error_response("Erreur API Google Places: $errorMsg", 502);
            }

            $reviewsData = [
                'rating' => $json['result']['rating'] ?? 0,
                'user_ratings_total' => $json['result']['user_ratings_total'] ?? 0,
                'reviews' => $json['result']['reviews'] ?? [],
            ];

            file_put_contents($cacheFile, json_encode($reviewsData, JSON_UNESCAPED_UNICODE));
        }

        // Filtrage et limitation
        $reviews = array_filter($reviewsData['reviews'], function ($review) use ($minRating) {
            return isset($review['rating']) && $review['rating'] >= $minRating;
        });
        $reviews = array_slice(array_values($reviews), 0, $limit);

        json_response([
            'rating' => $reviewsData['rating'],
            'total' => $reviewsData['user_ratings_total'],
            'reviews' => $reviews,
        ]);
    }
}
