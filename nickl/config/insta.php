<?php

use GuzzleHttp\Client;

if (!defined('ABSPATH')) {
    exit;
}

add_action('init', function () {
    if (!wp_next_scheduled('regenerate_instagram_token_daily')) {
        wp_schedule_event(time(), 'daily', 'regenerate_instagram_token_daily');
    }
});

// Fonction principale appelée chaque jour

if (!function_exists('regenerate_instagram_long_lived_tokens')) {
    function regenerate_instagram_long_lived_tokens()
    {
        $sites = function_exists('get_sites') ? get_sites() : [(object)['blog_id' => get_current_blog_id()]];

        foreach ($sites as $site) {
            switch_to_blog($site->blog_id);

            $client = new Client();

            $shortLivedToken = get_field('access_token_instagram', 'option') ?? null;
            $client_id       = get_field('id_application_instagram', 'option') ?? null;
            $secret_key      = get_field('secret_key_application_instagram', 'option') ?? null;

            if (!$shortLivedToken || !$client_id || !$secret_key) {
                error_log("[blog_id {$site->blog_id}] ⚠️ Paramètres Instagram manquants.");
                restore_current_blog();
                continue;
            }

            try {
                $url = sprintf(
                    'https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=%s&client_secret=%s&fb_exchange_token=%s',
                    urlencode($client_id),
                    urlencode($secret_key),
                    urlencode($shortLivedToken)
                );

                $response = $client->get($url);
                $data = json_decode($response->getBody()->getContents(), true);

                if (!isset($data['access_token'])) {
                    error_log("[blog_id {$site->blog_id}] ❌ Jeton non reçu : " . json_encode($data));
                    restore_current_blog();
                    continue;
                }

                $accessToken = $data['access_token'];
                $expiresAt = time() + ($data['expires_in'] ?? (60 * 24 * 60 * 60));

                $upload_dir = wp_upload_dir();
                $filePath = $upload_dir['basedir'] . '/instagram_token.json';

                file_put_contents($filePath, json_encode([
                    'access_token' => $accessToken,
                    'expires_at'   => $expiresAt
                ]));

                error_log("[blog_id {$site->blog_id}] ✅ Jeton mis à jour. Expire le " . date('Y-m-d H:i:s', $expiresAt));

            } catch (\Exception $e) {
                error_log("[blog_id {$site->blog_id}] 💥 Erreur Instagram : " . $e->getMessage());
            }

            restore_current_blog();
        }
    }
    add_action('regenerate_instagram_token_daily', 'regenerate_instagram_long_lived_tokens');
}

