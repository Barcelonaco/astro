<?php

namespace App\Helpers;

class AjaxIa2
{
    public function __construct()
    {
        add_action('wp_ajax_generer_contenu_ia_via_ajax', [$this, 'ajaxIa']);
        add_action('wp_ajax_nopriv_generer_contenu_ia_via_ajax', [$this, 'ajaxIa']);
        add_action('wp_ajax_find_image_by_url', [$this, 'findImageByUrl']);
        add_action('wp_ajax_nopriv_find_image_by_url', [$this, 'findImageByUrl']);
    }
    function ajaxIa()
    {
        if (!current_user_can('edit_posts')) {
            wp_send_json_error('Non autorisé');
        }

        $prompt = sanitize_text_field($_POST['prompt'] ?? '');

        if (!$prompt) {
            wp_send_json_error('Prompt vide.');
        }

        if (defined('MISTRAL_API_KEY')) {
            $apiKey = constant('MISTRAL_API_KEY');
        } else {
            $apiKey = null;
        }


        $client = new \GuzzleHttp\Client();

        try {
            $response = $client->post('https://api.mistral.ai/v1/chat/completions', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $apiKey,
                    'Content-Type' => 'application/json',
                ],
                'json' => [
                    'model' => 'mistral-small',
                    'messages' => [
                        ['role' => 'system', 'content' => 'Tu es un assistant éditorial qui génère du contenu clair, optimisé pour le SEO et naturel en français.'],
                        ['role' => 'user', 'content' => $prompt],
                    ],
                    'temperature' => 0.7,
                ],
            ]);

            $body = json_decode($response->getBody(), true);
            $text = $body['choices'][0]['message']['content'] ?? '';

            if ($text) {
                wp_send_json_success(trim($text));
            }

            wp_send_json_error('Pas de contenu généré');

        } catch (\Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    public function findImageByUrl()
    {
        // Optional: Check nonce if you want strict security
        // check_ajax_referer('ajax_nonce');

        $url = isset($_POST['url']) ? esc_url_raw($_POST['url']) : '';
        $url = urldecode($url); // Handle encoded spaces etc.

        if (!$url) {
            wp_send_json_error('URL manquante');
        }

        // Clean URL (remove query params)
        $url = strtok($url, '?');

        $id = attachment_url_to_postid($url);

        // Retry without dimensions (e.g. -scaled.jpg, -150x150.jpg)
        $cleanUrl = $url;
        if (!$id) {
            // Regex to remove dimensions like -1024x768 or -scaled
            $cleanUrl = preg_replace('/-[\d]+x[\d]+(\.[a-z]{3,4})$/i', '$1', $url);
            if ($cleanUrl !== $url) {
                $id = attachment_url_to_postid($cleanUrl);
            }

            // Try removing -scaled if present
            if (!$id) {
                $cleanUrl = str_replace('-scaled', '', $url);
                if ($cleanUrl !== $url) {
                    $id = attachment_url_to_postid($cleanUrl);
                }
            }
        }

        if ($id) {
            wp_send_json_success([
                'id' => $id,
                'url' => wp_get_attachment_url($id)
            ]);
            return;
        }

        // Fallback: Direct DB query for the filename (handles domain/protocol mismatches)
        global $wpdb;
        $filename = basename($cleanUrl ?? $url);

        // 1. Try finding by GUID (ending with filename)
        $sql = $wpdb->prepare(
            "SELECT ID FROM $wpdb->posts WHERE post_type = 'attachment' AND guid LIKE %s LIMIT 1",
            ['%' . $wpdb->esc_like($filename)]
        );
        $id = $wpdb->get_var($sql);

        // 2. Try finding by _wp_attached_file meta
        if (!$id) {
            $sql = $wpdb->prepare(
                "SELECT post_id FROM $wpdb->postmeta WHERE meta_key = '_wp_attached_file' AND meta_value LIKE %s LIMIT 1",
                ['%' . $wpdb->esc_like($filename)]
            );
            $id = $wpdb->get_var($sql);
        }

        // 3. Try finding by Title/Name (Slug)
        if (!$id) {
            // Filename without extension
            $name = pathinfo($filename, PATHINFO_FILENAME);
            // WordPress sanitizes title for slug
            $slug = sanitize_title($name);

            $sql = $wpdb->prepare(
                "SELECT ID FROM $wpdb->posts WHERE post_type = 'attachment' AND post_name = %s LIMIT 1",
                [$slug]
            );
            $id = $wpdb->get_var($sql);
        }

        if ($id) {
            wp_send_json_success([
                'id' => $id,
                'url' => wp_get_attachment_url($id)
            ]);
        } else {
            error_log('AjaxIa: Image not found via DB for: ' . $url . ' (Filename: ' . $filename . ')');
            wp_send_json_error('Image non trouvée pour : ' . $url);
        }
    }
}
