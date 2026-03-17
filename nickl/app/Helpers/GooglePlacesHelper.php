<?php

namespace App\Helpers;

class GooglePlacesHelper
{
    /**
     * Fetch Google Reviews for a specific Place ID.
     *
     * @param string $placeId
     * @return array|null
     */
    public static function getReviews($placeId)
    {
        if (empty($placeId)) {
            return null;
        }

        $transientKey = 'google_reviews_' . $placeId;
        $cachedReviews = get_transient($transientKey);

        if ($cachedReviews !== false) {
            return $cachedReviews;
        }

        // Try to get key from ACF settings first (set in FeatureAdmin.php)
        $apiKey = acf_get_setting('google_api_key');

        // If that's a placeholder or empty, try a global option field
        if (empty($apiKey) || $apiKey === 'xxxxxxxxx') {
            $apiKey = get_field('google_api_key', 'options');
        }

        if (empty($apiKey) || $apiKey === 'xxxxxxxxx') {
            return ['error' => 'Clé API Google manquante. Veuillez la configurer.'];
        }

        // We need fields: reviews, rating, user_ratings_total
        // Language fr for French reviews
        $url = "https://maps.googleapis.com/maps/api/place/details/json?place_id={$placeId}&fields=reviews,rating,user_ratings_total&key={$apiKey}&language=fr";

        $response = wp_remote_get($url);

        if (is_wp_error($response)) {
            return ['error' => $response->get_error_message()];
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (isset($data['status']) && $data['status'] === 'OK') {
            $result = $data['result'];

            // Cache for 24 hours
            set_transient($transientKey, $result, 24 * HOUR_IN_SECONDS);
            return $result;
        }

        return ['error' => $data['error_message'] ?? 'Erreur inconnue de l\'API Google Places'];
    }
}
