<?php

class AiController {

    private static function getSystemPrompt(): string {
        return <<<'PROMPT'
# GÉNÉRATEUR DE PAGES CMS ASTRO

Tu génères des pages complètes en JSON pour un CMS headless. Retourne UNIQUEMENT du JSON valide, sans markdown, sans texte autour.

## FORMAT DE SORTIE
{"title":"...","slug":"slug-kebab","blocks":[{"id":"b_1_xxx","type":"...","data":{...}},...],"seo":{"meta_title":"... (max 60 car.)","meta_description":"... (max 160 car.)","schema_org":"JSON-LD stringifié"}}

## TYPES DE BLOCS VALIDES (SEULS CES TYPES EXISTENT)

### Bannières
- `banner` : {"title":"...","image":"image-default","banner_height":"small"}
- `hero` : {"is_hero_banner_slider":true,"hero_sliders":[{"title":"...","catchphrase":"...","image":"image-default","cta":{"url":"#","title":"..."}}]}

### Texte & contenu
- `text-simple` : {"text":"<p>HTML...</p>","cta":{"url":"#","title":"..."}}
- `text-image` : {"text":"<p>...</p>","image":"image-default","img_to_left":true,"media_choice":true,"media_ratio":"landscape","text_width":"width-50","cta":{"url":"#","title":"..."}}
- `accordion` : {"accordions":[{"title":"Question ?","text":"<p>Réponse</p>"}]}
- `key-figures` : {"key_list":[{"value":"100","titre":"...","desc":"...","icone":"image-default"}]} (value = chiffres uniquement)
- `quote` : {"quote":"...","name":"...","job":"...","photo":"image-default"}
- `text-scrolling` : {"text_size":"size-m","text_direction":"left","items":[{"text":"..."}]}
- `link-alone` : {"btn_align":"center","cta":{"url":"/","title":"..."}}

### Médias
- `gallery` : {"nbr_column":"columns-3","type_img":"img-fluid","style_choice":"style-1","list":[{"image":"image-default","titre":"...","desc":"..."}]}
- `video` : {"image":"image-default","is_fullscreen":false}
- `images-slider` : {"is_fullscreen":false,"items":[{"image":"image-default","legend":"...","text":"..."}]}
- `clickable-tiles` : {"clickable_block":true,"list_interlocking":[{"title":"...","catchphrase":"...","file":"image-default","primary_link":{"url":"#","title":"..."}}]}
- `icon-logo` : {"grey_filter":false,"items":[{"title":"...","desc":"...","logo":"logo-default","link":{"url":"#","title":"..."}}]}
- `slider-logo` : {"items":[{"logo":"logo-default"}]}
- `images-videos-parallax` : {"items":[{"title":"...","desc":"...","image":"image-default"}]}
- `files` : {"files_preview":false,"items":[{"title":"Document","file":""}]}
- `ornament` : {"image":"image-default","img_opacity":100,"img_placement":"center","transformX":0,"transformY":0,"img_width":200}
- `illus-video` : {"video":"","is_fullscreen":false}

### Fonctionnels
- `free-post` : {"title":"...","image_shadow":true,"items":[{"image":"image-default","title":"...","catchphrase":"...","primary_link":{"url":"#","title":"..."}}]}
- `team` : {"align":"center","list":[{"name":"...","post":"...","desc":"...","picture":"image-default"}]}
- `contact` : {"title":"...","is_map":false,"addresses":[{"name":"...","address":"...","phone":"...","mail":"...","schedule":"..."}]}
- `map` : {"title":"...","items":[{"name":"...","address":"...","lat":0,"lng":0}]}
- `form` : {"title":"...","form_id":"auto"}
- `columns-tab` : {"title":"...","columns_display":"columns-2_2-2","columns_list":[{"columns_module":[{"acf_fc_layout":"text-simple","text":"<p>...</p>"}]},{"columns_module":[{"acf_fc_layout":"text-simple","text":"<p>...</p>"}]}]}
- `separator` : {"separator_style":"style-1","text":""}
- `plan-site` : {"title":"Plan du site"}

⚠️ INTERDITS : head-text, html, heading, reusable-bloc, widget, slider-text-video, newsletter-form, free-post NE DOIVENT JAMAIS être utilisés.
⚠️ summary : NE PAS utiliser sauf si explicitement demandé par l'utilisateur.
⚠️ Pour les logos (icon-logo, slider-logo), utiliser "logo-default" au lieu de "image-default" pour les champs logo.

## PARAMÈTRES OPTIONNELS (dans data)
bloc_color: "no-background-color"|"has-background-primary"|"has-background-secondary"|"has-background-tertiary"
padding_top: "padding-top-small"|"no-padding-top"
padding_bottom: "padding-bottom-small"|"no-padding-bottom"
bloc_title: "titre au-dessus du bloc"
id_bloc: "ancre-html"

## RÈGLES
1. Minimum 12 blocs, maximum 15 blocs. Créer des pages riches et complètes.
2. Le PREMIER bloc doit TOUJOURS être un `banner` ou un `hero`. Jamais un autre type en premier.
3. Varier les types de blocs : ne JAMAIS utiliser deux fois le même type consécutivement. Alterner entre texte, médias, listes, fonctionnels. Utiliser au moins 6 types différents sur la page.
4. Padding : TOUS les blocs (sauf banner/hero) doivent avoir padding_top:"padding-top-small" ET padding_bottom:"padding-bottom-small". Banner/Hero → pas de padding.
5. Images → "image-default". Liens → "/" ou "#".
6. Contenu réel et pertinent, jamais de lorem ipsum. Si tu as accès à la recherche web, utilise-la pour trouver des informations factuelles sur le sujet (adresse, téléphone, horaires, description réelle). Ne jamais inventer d'informations factuelles.
7. SEO : meta_title < 60 car, meta_description < 160 car.
8. Schema.org : JSON-LD adapté au type de page (WebPage, FAQPage, LocalBusiness, etc.), stringifié.
9. Fond coloré : quand un bloc a un bloc_color, le module précédent doit aussi avoir padding_bottom:"padding-bottom-small".
10. Chaque id de bloc doit être unique (format b_NUMBER_RANDOM).
PROMPT;
    }

    /**
     * Stream AI generation via SSE (Server-Sent Events).
     * Anthropic sends text_delta chunks; we forward them to the browser in real-time.
     * This prevents FastCGI idle timeout since data flows continuously.
     */
    public static function generateStream(): void {
        $user = authenticate_token();
        set_time_limit(120);

        $body = get_json_body();
        $prompt = trim($body['prompt'] ?? '');
        $pageTitle = trim($body['page_title'] ?? '');
        $context = trim($body['context'] ?? '');
        $model = trim($body['model'] ?? '');

        if (empty($prompt)) {
            // Send error as SSE then close
            self::startSSE();
            self::sendSSE('error', json_encode(['error' => 'Le prompt est requis']));
            exit;
        }

        $apiKey = AiCreditController::getDecryptedApiKey();
        if (empty($apiKey)) {
            self::startSSE();
            self::sendSSE('error', json_encode(['error' => 'Clé API Anthropic non configurée']));
            exit;
        }

        // Check available credits
        $available = AiCreditController::getAvailableCredits();
        if ($available <= 0) {
            self::startSSE();
            self::sendSSE('error', json_encode(['error' => 'Crédits IA insuffisants. Ajoutez des crédits dans Crédits IA.']));
            exit;
        }

        // Build user message
        $userMessage = $prompt;
        if ($pageTitle) {
            $userMessage = "Titre de la page : {$pageTitle}\n\n{$userMessage}";
        }
        if ($context) {
            $userMessage = "{$userMessage}\n\nContexte supplémentaire : {$context}";
        }

        $allowedModels = [
            'haiku' => 'claude-haiku-4-5-20251001',
            'sonnet' => 'claude-sonnet-4-20250514',
        ];
        $modelKey = isset($allowedModels[$model]) ? $model : 'haiku';
        $modelId = $allowedModels[$modelKey];

        // Disable all output buffering
        while (ob_get_level()) ob_end_clean();

        // Start SSE headers
        self::startSSE();

        // Send initial event so the browser knows we're alive
        self::sendSSE('start', json_encode(['model' => $modelKey]));

        // Web search option
        $useWebSearch = !empty($body['web_search']);

        // Build Anthropic payload with stream: true
        $payloadData = [
            'model' => $modelId,
            'max_tokens' => 8192,
            'stream' => true,
            'system' => self::getSystemPrompt(),
            'messages' => [
                ['role' => 'user', 'content' => $userMessage]
            ]
        ];

        // Add web_search tool if enabled
        if ($useWebSearch) {
            $payloadData['tools'] = [
                [
                    'type' => 'web_search_20250305',
                    'name' => 'web_search',
                    'max_uses' => 3,
                ]
            ];
        }

        $payload = json_encode($payloadData);

        // Use curl with a write callback to forward chunks in real-time
        $textBlocks = [];      // Collect text from each content_block separately
        $currentBlockIdx = -1;
        $inputTokens = 0;
        $outputTokens = 0;
        $sseBuffer = '';

        $ch = curl_init('https://api.anthropic.com/v1/messages');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'x-api-key: ' . $apiKey,
                'anthropic-version: 2023-06-01',
            ],
            CURLOPT_TIMEOUT => 120,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_RETURNTRANSFER => false,
            // Process each chunk as it arrives from Anthropic
            CURLOPT_WRITEFUNCTION => function ($ch, $data) use (&$textBlocks, &$currentBlockIdx, &$inputTokens, &$outputTokens, &$sseBuffer) {
                $sseBuffer .= $data;

                // Process complete SSE lines from Anthropic
                while (($pos = strpos($sseBuffer, "\n")) !== false) {
                    $line = substr($sseBuffer, 0, $pos);
                    $sseBuffer = substr($sseBuffer, $pos + 1);
                    $line = trim($line);

                    if (empty($line) || strpos($line, 'event:') === 0) continue;
                    if (strpos($line, 'data: ') !== 0) continue;

                    $jsonStr = substr($line, 6);
                    if ($jsonStr === '[DONE]') continue;

                    $event = json_decode($jsonStr, true);
                    if (!$event) continue;

                    $type = $event['type'] ?? '';

                    if ($type === 'content_block_start') {
                        $blockType = $event['content_block']['type'] ?? '';
                        if ($blockType === 'text') {
                            // New text content block — start collecting
                            $currentBlockIdx++;
                            $textBlocks[$currentBlockIdx] = '';
                        } elseif ($blockType === 'server_tool_use') {
                            AiController::sendSSE('status', 'Recherche web en cours...');
                        } elseif ($blockType === 'web_search_tool_result') {
                            AiController::sendSSE('status', 'Résultats trouvés, génération...');
                        }
                    } elseif ($type === 'content_block_delta') {
                        $text = $event['delta']['text'] ?? '';
                        if ($text !== '' && $currentBlockIdx >= 0) {
                            $textBlocks[$currentBlockIdx] .= $text;
                            AiController::sendSSE('chunk', $text);
                        }
                    } elseif ($type === 'message_start') {
                        $inputTokens = $event['message']['usage']['input_tokens'] ?? 0;
                    } elseif ($type === 'message_delta') {
                        $outputTokens = $event['usage']['output_tokens'] ?? 0;
                    }
                }

                return strlen($data);
            },
        ]);

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErrno = curl_errno($ch);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            self::sendSSE('error', json_encode(['error' => "Erreur API : {$curlError}"]));
            exit;
        }

        if ($httpCode !== 200 && empty($fullText)) {
            self::sendSSE('error', json_encode(['error' => "Erreur API (HTTP {$httpCode})"]));
            exit;
        }

        // Extract JSON from all collected text
        $allText = implode("\n", $textBlocks);
        $parsed = self::extractJson($allText);

        if (!$parsed) {
            self::sendSSE('error', json_encode([
                'error' => 'Réponse IA invalide (JSON mal formé)',
                'raw' => substr($allText, 0, 500)
            ]));
            exit;
        }

        // Log AI credit usage
        try {
            AiCreditController::logUsage(
                (int) $user['id'],
                $modelKey,
                $inputTokens,
                $outputTokens,
                mb_substr($prompt, 0, 255)
            );
        } catch (\Exception $e) {
            error_log('AI credit logging failed: ' . $e->getMessage());
        }

        // Send final complete result
        self::sendSSE('done', json_encode([
            'generated' => $parsed,
            'model' => $modelKey,
            'usage' => ['input_tokens' => $inputTokens, 'output_tokens' => $outputTokens]
        ]));
        exit;
    }

    private static function startSSE(): void {
        header('Content-Type: text/event-stream; charset=utf-8');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no');
    }

    public static function sendSSE(string $event, string $data): void {
        echo "event: {$event}\ndata: {$data}\n\n";
        flush();
    }

    /**
     * Extract valid JSON object from text that may contain prose, markdown, etc.
     * Tries multiple strategies: direct parse, ```json blocks, brace matching.
     */
    private static function extractJson(string $text): ?array {
        $text = trim($text);
        if (empty($text)) return null;

        // Strategy 1: Extract from ```json ... ``` block
        if (preg_match('/```(?:json)?\s*(\{[\s\S]*?\})\s*```/', $text, $m)) {
            $parsed = json_decode($m[1], true);
            if ($parsed && isset($parsed['blocks'])) return $parsed;
        }

        // Strategy 2: Find the outermost { ... } that contains "blocks"
        $start = strpos($text, '{"');
        if ($start === false) $start = strpos($text, "{\n");
        if ($start === false) $start = strpos($text, "{ ");
        if ($start !== false) {
            // Find matching closing brace by counting depth
            $depth = 0;
            $inString = false;
            $escape = false;
            $len = strlen($text);
            for ($i = $start; $i < $len; $i++) {
                $ch = $text[$i];
                if ($escape) { $escape = false; continue; }
                if ($ch === '\\' && $inString) { $escape = true; continue; }
                if ($ch === '"') { $inString = !$inString; continue; }
                if ($inString) continue;
                if ($ch === '{') $depth++;
                elseif ($ch === '}') {
                    $depth--;
                    if ($depth === 0) {
                        $jsonStr = substr($text, $start, $i - $start + 1);
                        $parsed = json_decode($jsonStr, true);
                        if ($parsed && isset($parsed['blocks'])) return $parsed;
                        break;
                    }
                }
            }
        }

        // Strategy 3: Direct parse (whole text is JSON)
        $clean = preg_replace('/^```(?:json)?\s*/', '', $text);
        $clean = preg_replace('/\s*```$/', '', $clean);
        $parsed = json_decode(trim($clean), true);
        if ($parsed && isset($parsed['blocks'])) return $parsed;

        return null;
    }
}
