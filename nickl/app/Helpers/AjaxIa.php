<?php

namespace App\Helpers;

class AjaxIa
{
    private $creditManager;

    /**
     * Nom par défaut du champ ACF Flexible Content.
     * Peut être surchargé via la constante BARCELONA_ACF_FIELD dans wp-config.php.
     */
    const DEFAULT_ACF_FIELD = 'flexible_content';

    public function __construct()
    {
        $this->creditManager = IaCreditManager::getInstance();
        $apiKey = $this->creditManager->getApiKey();
        //dd($apiKey);

        add_action('wp_ajax_generer_contenu_ia_claude', [$this, 'ajaxIa']);
        add_action('wp_ajax_nopriv_generer_contenu_ia_claude', [$this, 'ajaxIa']);
        add_action('wp_ajax_find_image_by_url', [$this, 'findImageByUrl']);
        add_action('wp_ajax_nopriv_find_image_by_url', [$this, 'findImageByUrl']);
        add_action('wp_dashboard_setup', [$this, 'addDashboardWidget']);
        add_action('wp_ajax_get_ia_credit_status', [$this, 'ajaxGetCreditStatus']);

        // Hook de publication — envoie les modules conservés au Hub
        add_action('transition_post_status', [$this, 'onSavePost'], 20, 3);
    }

    function ajaxIa()
    {
        if (!current_user_can('edit_posts')) {
            wp_send_json_error('Non autorisé');
        }

        // VÉRIFICATION DU CRÉDIT
        $creditCheck = $this->creditManager->checkGlobalCredit();
        if (!$creditCheck['allowed']) {
            wp_send_json_error([
                'message'          => $creditCheck['message'],
                'remaining_credit' => $creditCheck['remaining'],
                'credit_exhausted' => true,
            ]);
            return;
        }

        $prompt    = sanitize_text_field($_POST['prompt'] ?? '');
        $postId    = intval($_POST['post_id'] ?? 0);
        $pageType  = sanitize_text_field($_POST['page_type'] ?? 'page');
        $pageTitle = sanitize_text_field($_POST['page_title'] ?? '');

        if (!in_array($pageType, ['page', 'news', 'other'], true)) {
            $pageType = 'page';
        }

        if (!$prompt) {
            wp_send_json_error('Prompt vide.');
        }

        // ── Chargement du System Prompt ───────────────────────────────────────
        $systemPrompt = 'Tu es un assistant éditorial qui génère du contenu clair, optimisé pour le SEO et naturel en français.';
        $promptPath   = get_template_directory() . '/resources/docs/system_prompt_ia2.md';
        if (file_exists($promptPath)) {
            $fileContent = file_get_contents($promptPath);
            if ($fileContent) {
                $systemPrompt = $fileContent;
            }
        }

        $hubUrl   = defined('BARCELONA_HUB_URL')   ? rtrim(BARCELONA_HUB_URL, '/')   : '';
        $hubToken = defined('BARCELONA_HUB_TOKEN') ? BARCELONA_HUB_TOKEN              : '';
        $apiKey   = $this->creditManager->getApiKey();

        if ($hubUrl && $apiKey) {
            // ── Étape 1 : Hub prépare le contexte enrichi ────────────────────
            $prepared = $this->hubPrepare($hubUrl, $hubToken, [
                'site_domain'   => $this->getSiteDomain(),
                'user_prompt'   => $prompt,
                'system_prompt' => $systemPrompt,
                'page_type'     => $pageType,
                'page_title'    => $pageTitle ?: null,
            ]);

            if ($prepared !== null) {
                $enrichedPrompt = $prepared['enriched_prompt'] ?? $systemPrompt;
                $logId          = $prepared['log_id'] ?? null;

                // ── Étape 2 : Appel Claude avec la clé du site ───────────────
                $claudeResult = $this->callClaudeDirect($apiKey, $prompt, $enrichedPrompt);

                if ($claudeResult !== null) {
                    // ── Étape 3 : Hub loggue le résultat ────────────────────
                    if ($logId) {
                        $this->hubComplete($hubUrl, $hubToken, $logId, $claudeResult);
                        if ($postId) {
                            update_post_meta($postId, '_ia_log_id', intval($logId));
                        }
                    }

                    // Usage local (crédit)
                    $this->logUsage(
                        get_current_user_id(),
                        $claudeResult['input_tokens'],
                        $claudeResult['output_tokens']
                    );

                    wp_send_json_success($claudeResult['text']);
                    return;
                }
            }

            error_log('AjaxIa: Hub ou Claude injoignable, fallback direct.');
        }

        // ── Fallback : appel Claude direct sans Hub ───────────────────────────
        $this->fallbackDirectClaude($prompt, $systemPrompt);
    }

    /**
     * Étape 1 — Demande au Hub le system prompt enrichi + crée un log partiel.
     *
     * @return array|null  { enriched_prompt, log_id, context } ou null si injoignable
     */
    private function hubPrepare(string $hubUrl, string $token, array $payload): ?array
    {
        try {
            $client   = new \GuzzleHttp\Client(['timeout' => 15]);
            $response = $client->post($hubUrl . '/api/ia/prepare', [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'X-Hub-Token'  => $token,
                ],
                'json' => $payload,
            ]);

            $body = json_decode($response->getBody(), true);

            if (json_last_error() !== JSON_ERROR_NONE || !isset($body['enriched_prompt'])) {
                error_log('AjaxIa hubPrepare: réponse invalide.');
                return null;
            }

            return $body;

        } catch (\Exception $e) {
            error_log('AjaxIa hubPrepare error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Étape 2 — Appel direct à l'API Anthropic avec la clé du site.
     *
     * @return array|null  { text, input_tokens, output_tokens } ou null si erreur
     */
    private function callClaudeDirect(string $apiKey, string $userPrompt, string $systemPrompt): ?array
    {
        try {
            $client   = new \GuzzleHttp\Client(['timeout' => 60]);
            $response = $client->post('https://api.anthropic.com/v1/messages', [
                'headers' => [
                    'x-api-key'         => $apiKey,
                    'anthropic-version' => '2023-06-01',
                    'content-type'      => 'application/json',
                ],
                'json' => [
                    'model'      => 'claude-sonnet-4-5',
                    'max_tokens' => 4000,
                    'system'     => $systemPrompt,
                    'messages'   => [
                        ['role' => 'user', 'content' => $userPrompt],
                    ],
                ],
            ]);

            $body = json_decode($response->getBody(), true);
            $text = $body['content'][0]['text'] ?? '';

            if (!$text) {
                error_log('AjaxIa callClaudeDirect: pas de contenu.');
                return null;
            }

            return [
                'text'          => trim($text),
                'input_tokens'  => $body['usage']['input_tokens']  ?? 0,
                'output_tokens' => $body['usage']['output_tokens'] ?? 0,
            ];

        } catch (\Exception $e) {
            error_log('AjaxIa callClaudeDirect error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Étape 3 — Envoie le résultat au Hub pour compléter le log.
     */
    private function hubComplete(string $hubUrl, string $token, int $logId, array $claudeResult): void
    {
        try {
            $client = new \GuzzleHttp\Client(['timeout' => 10]);
            $client->patch($hubUrl . '/api/ia/logs/' . $logId . '/complete', [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'X-Hub-Token'  => $token,
                ],
                'json' => [
                    'result'        => $claudeResult['text'],
                    'input_tokens'  => $claudeResult['input_tokens'],
                    'output_tokens' => $claudeResult['output_tokens'],
                ],
            ]);

        } catch (\Exception $e) {
            error_log('AjaxIa hubComplete error: ' . $e->getMessage());
        }
    }

    /**
     * Fallback : appel direct à l'API Anthropic si le Hub est injoignable.
     * Termine toujours par wp_send_json_* (ne retourne pas).
     */
    private function fallbackDirectClaude(string $prompt, string $systemPrompt): void
    {
        $userId = get_current_user_id();
        $apiKey = $this->creditManager->getApiKey();

        if (!$apiKey) {
            wp_send_json_error('API Key non configurée.');
            return;
        }

        $client = new \GuzzleHttp\Client();

        try {
            $response = $client->post('https://api.anthropic.com/v1/messages', [
                'headers' => [
                    'x-api-key'         => $apiKey,
                    'anthropic-version' => '2023-06-01',
                    'content-type'      => 'application/json',
                ],
                'json' => [
                    'model'      => 'claude-sonnet-4-5',
                    'max_tokens' => 4000,
                    'system'     => $systemPrompt,
                    'messages'   => [
                        ['role' => 'user', 'content' => $prompt],
                    ],
                ],
            ]);

            $body = json_decode($response->getBody(), true);

            if (isset($body['usage'])) {
                $input  = $body['usage']['input_tokens'] ?? 0;
                $output = $body['usage']['output_tokens'] ?? 0;
                $this->logUsage($userId, $input, $output);
            }

            $text = $body['content'][0]['text'] ?? '';

            if ($text) {
                wp_send_json_success(trim($text));
            }

            wp_send_json_error('Pas de contenu généré (Claude direct)');

        } catch (\Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    /**
     * Hook déclenché lors de la transition de statut d'un post.
     * Quand un post passe à "publish", envoie les modules conservés au Hub.
     *
     * @param string   $newStatus  Nouveau statut
     * @param string   $oldStatus  Ancien statut
     * @param \WP_Post $post       Objet post
     */
    public function onSavePost(string $newStatus, string $oldStatus, \WP_Post $post): void
    {
        // On ne traite que la première publication
        if ($newStatus !== 'publish' || $oldStatus === 'publish') {
            return;
        }

        // Pas de log_id → cette page n'a pas été générée par l'IA
        $logId = get_post_meta($post->ID, '_ia_log_id', true);
        if (!$logId) {
            return;
        }

        $hubUrl   = defined('BARCELONA_HUB_URL')   ? rtrim(BARCELONA_HUB_URL, '/')   : '';
        $hubToken = defined('BARCELONA_HUB_TOKEN') ? BARCELONA_HUB_TOKEN              : '';

        if (!$hubUrl) {
            return;
        }

        // Récupération des modules ACF conservés
        $acfField     = defined('BARCELONA_ACF_FIELD') ? BARCELONA_ACF_FIELD : self::DEFAULT_ACF_FIELD;
        $flexRows     = function_exists('get_field') ? get_field($acfField, $post->ID) : null;
        $modulesKept  = [];

        if (is_array($flexRows)) {
            foreach ($flexRows as $row) {
                $layout = $row['acf_fc_layout'] ?? 'unknown';
                // On extrait toutes les clés sauf acf_fc_layout comme "data"
                $data = array_diff_key($row, ['acf_fc_layout' => true]);
                $modulesKept[] = ['layout' => $layout, 'data' => $data];
            }
        }

        try {
            $client = new \GuzzleHttp\Client(['timeout' => 15]);
            $client->patch($hubUrl . '/api/ia/logs/' . intval($logId) . '/publish', [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'X-Hub-Token'  => $hubToken,
                ],
                'json' => [
                    'modules_kept' => $modulesKept,
                    'wp_post_id'   => $post->ID,
                    'page_title'   => get_the_title($post->ID),
                ],
            ]);

            error_log('AjaxIa: Modules publiés envoyés au Hub (log #' . $logId . ', ' . count($modulesKept) . ' modules).');

        } catch (\Exception $e) {
            error_log('AjaxIa Hub publish error: ' . $e->getMessage());
        }
    }

    /**
     * Retourne le domaine du site courant sans protocole ni www.
     */
    private function getSiteDomain(): string
    {
        $url  = get_option('siteurl');
        $host = parse_url($url, PHP_URL_HOST) ?: ($_SERVER['HTTP_HOST'] ?? '');
        return preg_replace('/^www\./', '', $host);
    }

    private function logUsage($userId, $input, $output)
    {
        error_log("AjaxIa logUsage called: userId=$userId, input=$input, output=$output");

        // Pricing (Claude 3.5 Sonnet)
        // Input: $3 / 1M tokens
        // Output: $15 / 1M tokens
        $costInput  = ($input / 1000000) * 3;
        $costOutput = ($output / 1000000) * 15;
        $totalRequestCost = $costInput + $costOutput;

        // Utiliser le gestionnaire de crédit
        $this->creditManager->logUsage($userId, $totalRequestCost, $input, $output);

        // Garder aussi les stats globales (optionnel)
        $globalStats = get_option('ia_usage_stats', ['total_cost' => 0, 'total_input' => 0, 'total_output' => 0, 'history' => []]);
        $globalStats['total_cost']   += $totalRequestCost;
        $globalStats['total_input']  += $input;
        $globalStats['total_output'] += $output;
        $globalStats['last_updated']  = current_time('mysql');

        if (!isset($globalStats['history'])) {
            $globalStats['history'] = [];
        }
        $globalStats['history'][] = [
            'date'    => current_time('mysql'),
            'user_id' => $userId,
            'input'   => $input,
            'output'  => $output,
            'cost'    => $totalRequestCost,
        ];
        if (count($globalStats['history']) > 50) {
            array_shift($globalStats['history']);
        }

        update_option('ia_usage_stats', $globalStats);
    }

    public function addDashboardWidget()
    {
        error_log('AjaxIa: Adding Dashboard Widget...');
        wp_add_dashboard_widget('ia_usage_dashboard_widget', 'Coûts API IA (Claude)', [$this, 'renderDashboardWidget']);
    }

    public function renderDashboardWidget()
    {
        $stats = get_option('ia_usage_stats', ['total_cost' => 0, 'total_input' => 0, 'total_output' => 0]);

        $data = [
            'cost'   => number_format((float) $stats['total_cost'], 4),
            'input'  => number_format((int) $stats['total_input']),
            'output' => number_format((int) $stats['total_output']),
        ];

        echo \Roots\view('widget.blocs.ia_stats', $data);
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
                'id'  => $id,
                'url' => wp_get_attachment_url($id),
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
                'id'  => $id,
                'url' => wp_get_attachment_url($id),
            ]);
        } else {
            error_log('AjaxIa: Image not found via DB for: ' . $url . ' (Filename: ' . $filename . ')');
            wp_send_json_error('Image non trouvée pour : ' . $url);
        }
    }

    /**
     * AJAX: Récupérer le statut du crédit de l'utilisateur
     */
    public function ajaxGetCreditStatus()
    {
        if (!current_user_can('edit_posts')) {
            wp_send_json_error('Non autorisé');
        }

        $stats = $this->creditManager->getGlobalStats();

        wp_send_json_success([
            'remaining_credit' => $stats['remaining_credit'],
            'used_credit'      => $stats['used_credit'],
            'total_credit'     => $stats['total_credit'],
            'request_count'    => $stats['request_count'],
            'percentage_used'  => $stats['total_credit'] > 0 ? ($stats['used_credit'] / $stats['total_credit']) * 100 : 0,
        ]);
    }
}
