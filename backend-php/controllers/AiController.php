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

### Avis / Témoignages
- `google-reviews` : {"place_id":"ChIJ...","limit":3,"min_rating":4,"display_google_reviews_link":true,"button_text":"Voir tous les avis","button_link":"https://g.page/r/PLACE_ID/reviews"}

### Fonctionnels
- `team` : {"align":"center","list":[{"name":"...","post":"...","desc":"...","picture":"image-default"}]}
- `contact` : {"title":"...","is_map":false,"addresses":[{"name":"...","address":"...","phone":"...","mail":"...","schedule":"..."}]}
- `map` : {"title":"...","items":[{"name":"...","address":"...","lat":0,"lng":0}]}
- `form` : {"title":"...","form_id":"auto"}
- `columns-tab` : {"title":"...","columns_display":"columns-2_2-2","columns_list":[{"columns_module":[{"acf_fc_layout":"text-simple","text":"<p>...</p>"}]},{"columns_module":[{"acf_fc_layout":"text-simple","text":"<p>...</p>"}]}]}
- `separator` : {"separator_style":"style-1","text":""}
- `plan-site` : {"title":"Plan du site"}

### Fallback
- `widget` : {"widget":"<div class='...'>HTML complet du widget</div>"} — UNIQUEMENT quand aucun autre module natif ne convient (simulateurs, calculateurs, éléments interactifs custom). Génère du HTML propre, autonome, avec styles inline.

⚠️ INTERDITS : head-text, html, heading, reusable-bloc, slider-text-video, newsletter-form, free-post. NE DOIVENT JAMAIS être utilisés.
⚠️ summary : NE PAS utiliser sauf si explicitement demandé par l'utilisateur.
⚠️ Pour les logos (icon-logo, slider-logo), utiliser "logo-default" au lieu de "image-default" pour les champs logo.
⚠️ Pour les témoignages/avis clients dans un wireframe, TOUJOURS utiliser `google-reviews` (jamais `quote` pour des avis).
⚠️ Les simulateurs/calculateurs ne sont PAS des formulaires → utiliser `widget` avec HTML interactif complet (jamais `form`).

## PARAMÈTRES DANS data
bloc_color: "no-background-color"|"has-background-primary"|"has-background-secondary"|"has-background-tertiary"
padding_top: "padding-top-small"|"no-padding-top"
padding_bottom: "padding-bottom-small"|"no-padding-bottom"
title: "titre au-dessus du bloc" — IMPORTANT : le nom du champ est "title" (pas "bloc_title")
title_style: "2"|"3"|"4" (balise h2/h3/h4, défaut "4")
title_align: "left"|"center"|"right" (défaut "center") — OBLIGATOIRE pour chaque bloc (sauf banner/hero). Chaque section doit avoir un titre descriptif.
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

        if (!AiCreditController::isEnabled()) {
            self::startSSE();
            self::sendSSE('error', json_encode(['error' => 'Génération IA temporairement désactivée par un administrateur']));
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

    private static function getBulkSystemPrompt(): string {
        return <<<'PROMPT'
# CONVERTISSEUR HTML/PROMPT → PAGES CMS ASTRO

Tu convertis du contenu (HTML, wireframes, descriptions textuelles) en pages CMS au format JSON. Retourne UNIQUEMENT du JSON valide, sans markdown, sans texte autour.

## RÈGLE ABSOLUE SUR LE NOMBRE DE PAGES
Génère EXACTEMENT le nombre de pages décrites dans l'entrée. Ni plus, ni moins.
- Si l'entrée contient 2 pages → retourne exactement 2 pages.
- Si l'entrée dit "crée 3 pages" → retourne exactement 3 pages.
- Ne JAMAIS inventer de pages supplémentaires.
- Ne JAMAIS sous-diviser une page en plusieurs pages.

## FORMAT DE SORTIE
{"forms":[...],"pages":[{"title":"...","slug":"slug-kebab","blocks":[{"id":"b_1_xxx","type":"...","data":{...}}],"seo":{"meta_title":"< 60 car","meta_description":"< 160 car","schema_org":"JSON-LD stringifié"}}]}

## FORMULAIRES (clé "forms")
Si une page nécessite un formulaire (contact, devis, inscription, etc.), CRÉE la définition du formulaire dans la clé "forms" et référence-le dans le bloc.

Format d'un formulaire :
{"ref":"form_1","title":"Demande de devis","slug":"demande-devis","description":"","settings":{"submit_text":"Envoyer","confirmation_message":"Merci, nous reviendrons vers vous rapidement.","notification_enabled":true},"fields":[{"type":"name","label":"Nom complet","name":"name","required":true,"settings":{"width":"100"}},{"type":"email","label":"Email","name":"email","required":true,"settings":{"width":"50"}},{"type":"phone","label":"Téléphone","name":"phone","required":false,"settings":{"width":"50"}},{"type":"textarea","label":"Message","name":"message","required":false,"settings":{"width":"100","rows":4}}]}

Types de champs disponibles : text, email, phone, number, textarea, select, radio, checkbox, date, time, url, file, hidden, html, name
- Pour select/radio/checkbox : ajouter "options":["Valeur 1","Valeur 2"] ou "options":["value1|Label 1","value2|Label 2"]
- Pour html : ajouter "settings":{"html_content":"<p>Texte d'aide</p>"}
- Pour name : ajouter "settings":{"first_label":"Prénom","last_label":"Nom","width":"100"}
- Champ width : "100", "50", "33" (pourcentage de largeur)

Référencer dans le bloc : {"type":"form","data":{"form_id":"form_1","title":"..."}}
Le "form_id" du bloc doit correspondre au "ref" du formulaire. Le système remplacera par l'ID réel après création.

Adapte les champs au contexte :
- Formulaire de contact : nom, email, téléphone, message
- Demande de devis : nom, email, téléphone, type de projet (select), message
- Inscription : nom, email, etc.

Si AUCUN formulaire n'est nécessaire, retourne "forms":[].

⚠️ IMPORTANT : les simulateurs, calculateurs, estimateurs ne sont PAS des formulaires. Utiliser `widget` avec HTML interactif complet (JavaScript inline pour le calcul). JAMAIS `form` pour un simulateur.

⚠️ IMPORTANT : les paramètres bloc_color, padding_top, padding_bottom, title, title_style, title_align, id_bloc vont DANS le champ "data" de chaque bloc, pas au niveau racine du bloc.

## CONVERSION HTML → BLOCS
Quand l'entrée contient du HTML ou un wireframe :
- Analyse chaque section du HTML et choisis le bloc Nickl le plus approprié
- Préserve TOUT le contenu textuel (titres, textes, listes, témoignages, chiffres)
- Les annotations de section (ex: "SECTION 2 · AMÉNAGEMENTS", "Section 4 · Réassurance") sont des commentaires du wireframe → les IGNORER. Le titre descriptif qui suit (ex: "Quel projet pour votre salle de bain ?") doit devenir le champ `title` dans data du module.
- Convertis les grilles de cards/services/offres en `clickable-tiles` (titre + description + lien par card) — c'est LE bloc à utiliser pour les listes de services, aides, offres, avantages présentés en cards
- Convertis les sections héro en blocs `hero` ou `banner`
- Convertis les FAQ en blocs `accordion`
- Convertis les témoignages/avis clients en `google-reviews` (avis Google dynamiques via place_id)
- Convertis les simulateurs/calculateurs/estimateurs en `widget` (HTML+JS interactif complet, JAMAIS en `form`)
- Convertis les étapes/processus numérotées en `key-figures` (value = numéro de l'étape)
- Convertis les chiffres clés/statistiques en `key-figures`
- Convertis les logos partenaires/certifications en `icon-logo` ou `slider-logo`
- Convertis les sections CTA finales en `link-alone` ou `text-simple` avec CTA
- Préserve les liens et URLs tels quels
- Ignore les éléments de navigation/header/footer (ce sont des éléments globaux du site)
- Si un contenu ne correspond à AUCUN module existant (widget custom, élément complexe), utilise le bloc `widget` avec le HTML complet à l'intérieur. Génère un HTML propre et fonctionnel.

## TYPES DE BLOCS VALIDES

### Bannières
- `banner` : {"title":"...","image":"image-default","banner_height":"small"}
- `hero` : {"is_hero_banner_slider":true,"hero_sliders":[{"title":"...","catchphrase":"...","image":"image-default","cta":{"url":"#","title":"..."}}]}

### Texte & contenu
- `text-simple` : {"text":"<p>HTML...</p>","cta":{"url":"#","title":"..."}}
- `text-image` : {"text":"<p>...</p>","image":"image-default","img_to_left":true,"media_choice":true,"media_ratio":"landscape","text_width":"width-50","cta":{"url":"#","title":"..."}}
- `accordion` : {"accordions":[{"title":"Question ?","text":"<p>Réponse</p>"}]}
- `key-figures` : {"key_list":[{"value":"100","titre":"...","desc":"...","icone":"image-default"}]}
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
- `team` : {"align":"center","list":[{"name":"...","post":"...","desc":"...","picture":"image-default"}]}
- `contact` : {"title":"...","is_map":false,"addresses":[{"name":"...","address":"...","phone":"...","mail":"...","schedule":"..."}]}
- `map` : {"title":"...","items":[{"name":"...","address":"...","lat":0,"lng":0}]}
- `form` : {"title":"...","form_id":"auto"}
- `columns-tab` : {"title":"...","columns_display":"columns-2_2-2","columns_list":[{"columns_module":[{"acf_fc_layout":"text-simple","text":"<p>...</p>"}]},{"columns_module":[{"acf_fc_layout":"text-simple","text":"<p>...</p>"}]}]}
- `google-reviews` : {"place_id":"ChIJ...","limit":3,"min_rating":4,"display_google_reviews_link":true,"button_text":"Voir tous les avis","button_link":"https://g.page/r/PLACE_ID/reviews"}
- `widget` : {"widget":"<div class='...'>HTML complet du widget</div>"} — UNIQUEMENT quand aucun autre bloc ne convient. Génère du HTML propre, autonome, avec styles inline ou classes utilitaires.
- `separator` : {"separator_style":"style-1","text":""}
- `plan-site` : {"title":"Plan du site"}

⚠️ INTERDITS : head-text, html, heading, reusable-bloc, slider-text-video, newsletter-form, free-post
⚠️ summary : NE PAS utiliser sauf si explicitement demandé.
⚠️ Pour les logos, utiliser "logo-default" au lieu de "image-default".
⚠️ Pour les témoignages/avis clients, TOUJOURS utiliser `google-reviews` (jamais `quote` pour des avis).
⚠️ Le `widget` est un FALLBACK — toujours préférer un module natif quand c'est possible.

## PARAMÈTRES OPTIONNELS (DANS data de chaque bloc)
bloc_color: "no-background-color"|"has-background-primary"|"has-background-secondary"|"has-background-tertiary"
padding_top: "padding-top-small"|"no-padding-top"
padding_bottom: "padding-bottom-small"|"no-padding-bottom"
title: "titre au-dessus du bloc" — IMPORTANT : le nom du champ est "title" (pas "bloc_title")
title_style: "2"|"3"|"4" (balise h2/h3/h4, défaut "4")
title_align: "left"|"center"|"right" (défaut "center")
id_bloc: "ancre-html"

## RÈGLES PAR PAGE
1. Le PREMIER bloc = `banner` ou `hero`. Jamais un autre type.
2. Varier les types : jamais 2 fois le même type consécutivement.
3. Padding : TOUS les blocs (sauf banner/hero) doivent avoir padding_top et padding_bottom dans data.
4. Images → "image-default". Logos → "logo-default".
5. Contenu : préserver le texte original. Jamais de lorem ipsum.
6. SEO : meta_title < 60 car, meta_description < 160 car.
7. Schema.org : JSON-LD stringifié adapté au type de page.
8. Chaque slug unique entre les pages.
9. Chaque id de bloc unique (format b_PAGENUMBER_BLOCNUMBER).
PROMPT;
    }

    /**
     * Bulk-generate multiple pages via SSE streaming.
     * Generates pages, auto-saves them as drafts, streams progress.
     */
    public static function generatePagesStream(): void {
        $user = authenticate_token();
        set_time_limit(300);

        $body = get_json_body();
        $prompt = trim($body['prompt'] ?? '');
        $model = trim($body['model'] ?? 'haiku');
        $imagesContext = $body['images_context'] ?? '';

        if (empty($prompt)) {
            self::startSSE();
            self::sendSSE('error', json_encode(['error' => 'Le prompt est requis']));
            exit;
        }

        if (!AiCreditController::isEnabled()) {
            self::startSSE();
            self::sendSSE('error', json_encode(['error' => 'Génération IA temporairement désactivée par un administrateur']));
            exit;
        }

        $apiKey = AiCreditController::getDecryptedApiKey();
        if (empty($apiKey)) {
            self::startSSE();
            self::sendSSE('error', json_encode(['error' => 'Clé API Anthropic non configurée']));
            exit;
        }

        $available = AiCreditController::getAvailableCredits();
        if ($available <= 0) {
            self::startSSE();
            self::sendSSE('error', json_encode(['error' => 'Crédits IA insuffisants']));
            exit;
        }

        // Fetch URL content if provided
        $urls = $body['urls'] ?? [];
        $fetchedHtml = '';
        if (!empty($urls) && is_array($urls)) {
            foreach ($urls as $url) {
                $url = trim($url);
                if (empty($url) || !filter_var($url, FILTER_VALIDATE_URL)) continue;
                $html = self::fetchUrlContent($url);
                if ($html) {
                    $fetchedHtml .= "\n\n--- CONTENU HTML DE {$url} ---\n{$html}\n--- FIN HTML ---";
                }
            }
        }

        // Uploaded HTML files (read as text on the client, stripped here)
        $htmlFiles = $body['html_files'] ?? [];
        if (!empty($htmlFiles) && is_array($htmlFiles)) {
            foreach ($htmlFiles as $file) {
                $name = trim((string)($file['name'] ?? 'fichier.html'));
                $content = (string)($file['content'] ?? '');
                if ($content === '') continue;
                $stripped = self::stripHtmlContent($content);
                if ($stripped === '') continue;
                $fetchedHtml .= "\n\n--- CONTENU HTML DE {$name} ---\n{$stripped}\n--- FIN HTML ---";
            }
        }

        // Build user message
        $userMessage = $prompt;
        if ($fetchedHtml) {
            $userMessage .= "\n\nVoici le HTML des pages à convertir en blocs Nickl :{$fetchedHtml}";
        }
        if ($imagesContext) {
            $userMessage .= "\n\nContexte visuel fourni par l'utilisateur : {$imagesContext}";
        }

        $allowedModels = [
            'haiku' => 'claude-haiku-4-5-20251001',
            'sonnet' => 'claude-sonnet-4-20250514',
        ];
        $modelKey = isset($allowedModels[$model]) ? $model : 'haiku';
        $modelId = $allowedModels[$modelKey];

        while (ob_get_level()) ob_end_clean();
        self::startSSE();
        self::sendSSE('start', json_encode(['model' => $modelKey]));

        $useWebSearch = !empty($body['web_search']);

        // Build content array — text + optional images/PDFs
        $contentParts = [];

        // Add uploaded files as base64 (images + PDFs)
        $images = $body['images'] ?? [];
        if (!empty($images) && is_array($images)) {
            foreach ($images as $img) {
                if (empty($img['data']) || empty($img['media_type'])) continue;
                $kind = $img['kind'] ?? 'image';
                if ($kind === 'document' || $img['media_type'] === 'application/pdf') {
                    // PDF → document type for Anthropic API
                    $contentParts[] = [
                        'type' => 'document',
                        'source' => [
                            'type' => 'base64',
                            'media_type' => 'application/pdf',
                            'data' => $img['data'],
                        ]
                    ];
                } else {
                    // Image
                    $contentParts[] = [
                        'type' => 'image',
                        'source' => [
                            'type' => 'base64',
                            'media_type' => $img['media_type'],
                            'data' => $img['data'],
                        ]
                    ];
                }
            }
        }

        $contentParts[] = ['type' => 'text', 'text' => $userMessage];

        $payloadData = [
            'model' => $modelId,
            'max_tokens' => 16384,
            'stream' => true,
            'system' => self::getBulkSystemPrompt(),
            'messages' => [
                ['role' => 'user', 'content' => $contentParts]
            ]
        ];

        if ($useWebSearch) {
            $payloadData['tools'] = [
                ['type' => 'web_search_20250305', 'name' => 'web_search', 'max_uses' => 5]
            ];
        }

        $payload = json_encode($payloadData);

        $textBlocks = [];
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
            CURLOPT_TIMEOUT => 300,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_WRITEFUNCTION => function ($ch, $data) use (&$textBlocks, &$currentBlockIdx, &$inputTokens, &$outputTokens, &$sseBuffer) {
                $sseBuffer .= $data;
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

        curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            self::sendSSE('error', json_encode(['error' => "Erreur API : {$curlError}"]));
            exit;
        }

        if ($httpCode !== 200 && empty($textBlocks)) {
            self::sendSSE('error', json_encode(['error' => "Erreur API (HTTP {$httpCode})"]));
            exit;
        }

        $allText = implode("\n", $textBlocks);
        $parsed = self::extractBulkJson($allText);

        if (!$parsed || empty($parsed['pages'])) {
            self::sendSSE('error', json_encode([
                'error' => 'Réponse IA invalide (JSON mal formé ou pas de pages)',
                'raw' => substr($allText, 0, 500)
            ]));
            exit;
        }

        // Auto-create forms if AI generated any
        $formRefToId = [];
        $createdForms = [];
        $db = Database::getInstance();

        $aiForms = $parsed['forms'] ?? [];
        if (!empty($aiForms) && is_array($aiForms)) {
            foreach ($aiForms as $formDef) {
                $ref = $formDef['ref'] ?? '';
                $formTitle = $formDef['title'] ?? 'Formulaire';
                $formSlug = $formDef['slug'] ?? self::slugify($formTitle);

                // Ensure unique slug
                $baseSlug = $formSlug;
                $counter = 1;
                while (true) {
                    $stmt = $db->prepare('SELECT id FROM forms WHERE slug = ?');
                    $stmt->execute([$formSlug]);
                    if (!$stmt->fetch()) break;
                    $formSlug = $baseSlug . '-' . $counter++;
                }

                // Create form
                $settings = $formDef['settings'] ?? [];
                $stmt = $db->prepare('INSERT INTO forms (title, slug, description, settings, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())');
                $stmt->execute([
                    $formTitle,
                    $formSlug,
                    $formDef['description'] ?? '',
                    json_encode($settings, JSON_UNESCAPED_UNICODE),
                    'active',
                ]);
                $formId = (int) $db->lastInsertId();

                // Create fields
                $fields = $formDef['fields'] ?? [];
                foreach ($fields as $order => $field) {
                    $stmt = $db->prepare('INSERT INTO form_fields (form_id, type, label, name, placeholder, required, options, validation, field_order, settings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                    $stmt->execute([
                        $formId,
                        $field['type'] ?? 'text',
                        $field['label'] ?? '',
                        $field['name'] ?? self::slugify($field['label'] ?? 'field'),
                        $field['placeholder'] ?? '',
                        !empty($field['required']) ? 1 : 0,
                        isset($field['options']) ? json_encode($field['options'], JSON_UNESCAPED_UNICODE) : null,
                        isset($field['validation']) ? json_encode($field['validation'], JSON_UNESCAPED_UNICODE) : null,
                        $order,
                        isset($field['settings']) ? json_encode($field['settings'], JSON_UNESCAPED_UNICODE) : null,
                    ]);
                }

                $formRefToId[$ref] = $formId;
                $createdForms[] = ['id' => $formId, 'title' => $formTitle, 'slug' => $formSlug, 'fields_count' => count($fields)];

                self::sendSSE('form_created', json_encode([
                    'id' => $formId,
                    'title' => $formTitle,
                    'fields_count' => count($fields),
                ]));
            }
        }

        // Auto-save each page as draft
        $savedPages = [];

        foreach ($parsed['pages'] as $pageData) {
            $title = $pageData['title'] ?? 'Page sans titre';
            $slug = $pageData['slug'] ?? self::slugify($title);

            // Ensure unique slug
            $baseSlug = $slug;
            $counter = 1;
            while (true) {
                $stmt = $db->prepare('SELECT id FROM pages WHERE slug = ?');
                $stmt->execute([$slug]);
                if (!$stmt->fetch()) break;
                $slug = $baseSlug . '-' . $counter++;
            }

            $blocks = $pageData['blocks'] ?? [];
            $seo = $pageData['seo'] ?? null;

            // Normalize blocks: merge top-level params into data
            $blocks = self::normalizeBlocks($blocks);

            // Replace form refs with real IDs
            if (!empty($formRefToId)) {
                foreach ($blocks as &$block) {
                    if (($block['type'] ?? '') === 'form') {
                        $ref = $block['data']['form_id'] ?? '';
                        if (isset($formRefToId[$ref])) {
                            $block['data']['form_id'] = (string) $formRefToId[$ref];
                        }
                    }
                }
                unset($block);
            }

            $content = json_encode($blocks, JSON_UNESCAPED_UNICODE);
            $seoMeta = $seo ? json_encode($seo, JSON_UNESCAPED_UNICODE) : null;

            $stmt = $db->prepare('INSERT INTO pages (title, slug, content, seo_meta, author_id, status, show_in_menu, menu_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())');
            $stmt->execute([$title, $slug, $content, $seoMeta, $user['id'], 'draft', 0, 0]);
            $pageId = $db->lastInsertId();

            $savedPages[] = [
                'id' => (int) $pageId,
                'title' => $title,
                'slug' => $slug,
                'blocks_count' => count($blocks),
            ];

            self::sendSSE('page_saved', json_encode([
                'id' => (int) $pageId,
                'title' => $title,
                'slug' => $slug,
                'blocks_count' => count($blocks),
                'index' => count($savedPages),
                'total' => count($parsed['pages']),
            ]));
        }

        // Log credit usage
        try {
            AiCreditController::logUsage(
                (int) $user['id'],
                $modelKey,
                $inputTokens,
                $outputTokens,
                mb_substr('Bulk: ' . $prompt, 0, 255)
            );
        } catch (\Exception $e) {
            error_log('AI credit logging failed: ' . $e->getMessage());
        }

        self::sendSSE('done', json_encode([
            'pages' => $savedPages,
            'forms' => $createdForms,
            'model' => $modelKey,
            'usage' => ['input_tokens' => $inputTokens, 'output_tokens' => $outputTokens]
        ]));
        exit;
    }

    /**
     * Extract JSON with "pages" array from AI response.
     */
    /**
     * Normalize AI blocks: ensure {id, type, data} structure.
     * Merges top-level bloc params into data, generates missing IDs.
     */
    private static function normalizeBlocks(array $blocks): array {
        // Fetch site default image and logo for placeholder resolution
        $db = Database::getInstance();
        $defaultImg = '';
        $logoUrl = '';
        try {
            $stmt = $db->prepare("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('replacement_image', 'logo')");
            $stmt->execute();
            while ($row = $stmt->fetch()) {
                if ($row['setting_key'] === 'replacement_image') $defaultImg = $row['setting_value'] ?? '';
                if ($row['setting_key'] === 'logo') $logoUrl = $row['setting_value'] ?? '';
            }
        } catch (\Exception $e) {}
        if (empty($logoUrl)) $logoUrl = $defaultImg;

        $normalized = [];
        foreach ($blocks as $i => $block) {
            $type = $block['type'] ?? '';
            if (empty($type)) continue;

            $data = $block['data'] ?? [];

            // If AI put fields at root level instead of in data, merge them
            foreach ($block as $key => $value) {
                if (in_array($key, ['id', 'type', 'data'])) continue;
                if (!isset($data[$key])) {
                    $data[$key] = $value;
                }
            }

            // Normalize bloc_title → title (AI may use old name)
            if (isset($data['bloc_title']) && !isset($data['title'])) {
                $data['title'] = $data['bloc_title'];
                unset($data['bloc_title']);
            }

            // Ensure default padding for non-banner blocks
            if (!in_array($type, ['banner', 'hero'])) {
                if (empty($data['padding_top'])) $data['padding_top'] = 'padding-top-small';
                if (empty($data['padding_bottom'])) $data['padding_bottom'] = 'padding-bottom-small';
            }
            if (empty($data['bloc_color'])) {
                $data['bloc_color'] = 'no-background-color';
            }

            // Resolve image placeholders recursively
            $data = self::resolveImagePlaceholders($data, $defaultImg, $logoUrl);

            $normalized[] = [
                'id' => $block['id'] ?? 'b_' . ($i + 1) . '_' . substr(md5(uniqid()), 0, 6),
                'type' => $type,
                'data' => $data,
            ];
        }
        return $normalized;
    }

    /**
     * Recursively replace "image-default"/"logo-default" strings with proper media objects.
     */
    private static function resolveImagePlaceholders($value, string $defaultImg, string $logoUrl) {
        $imageFields = ['image', 'bg_img', 'photo', 'picture', 'logo', 'icon', 'preview', 'file', 'icone', 'image_mobile'];

        if (is_string($value)) {
            if ($value === 'image-default' || $value === 'image_default') {
                return self::makeImageObject($defaultImg);
            }
            if ($value === 'logo-default' || $value === 'logo_default') {
                return self::makeImageObject($logoUrl);
            }
            return $value;
        }

        if (is_array($value)) {
            // Check if it's a sequential array (list) vs associative (object)
            if (array_is_list($value)) {
                return array_map(fn($item) => self::resolveImagePlaceholders($item, $defaultImg, $logoUrl), $value);
            }
            // Associative array — process each key
            $result = [];
            foreach ($value as $key => $val) {
                if (is_string($val) && in_array($key, $imageFields)) {
                    if ($val === 'image-default' || $val === 'image_default') {
                        $result[$key] = self::makeImageObject($defaultImg);
                    } elseif ($val === 'logo-default' || $val === 'logo_default') {
                        $result[$key] = self::makeImageObject($logoUrl);
                    } elseif ($val !== '') {
                        $result[$key] = self::makeImageObject($val);
                    } else {
                        $result[$key] = $val;
                    }
                } else {
                    $result[$key] = self::resolveImagePlaceholders($val, $defaultImg, $logoUrl);
                }
            }
            return $result;
        }

        return $value;
    }

    private static function makeImageObject(string $url): array {
        return ['id' => null, 'url' => $url, 'alt' => '', 'title' => '', 'caption' => '', 'width' => null, 'height' => null];
    }

    private static function extractBulkJson(string $text): ?array {
        $text = trim($text);
        if (empty($text)) return null;

        // Strategy 1: ```json block
        if (preg_match('/```(?:json)?\s*(\{[\s\S]*?\})\s*```/', $text, $m)) {
            $parsed = json_decode($m[1], true);
            if ($parsed && isset($parsed['pages'])) return $parsed;
        }

        // Strategy 2: Find outermost { that contains "pages"
        $start = strpos($text, '{');
        if ($start !== false) {
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
                        if ($parsed && isset($parsed['pages'])) return $parsed;
                        break;
                    }
                }
            }
        }

        // Strategy 3: Direct parse
        $clean = preg_replace('/^```(?:json)?\s*/', '', $text);
        $clean = preg_replace('/\s*```$/', '', $clean);
        $parsed = json_decode(trim($clean), true);
        if ($parsed && isset($parsed['pages'])) return $parsed;

        // Strategy 4: Maybe it returned a single page with "blocks" — wrap it
        $single = self::extractJson($text);
        if ($single && isset($single['blocks'])) {
            return ['pages' => [$single]];
        }

        return null;
    }

    /**
     * Fetch HTML content from a URL. Strips scripts/styles, limits size.
     */
    private static function fetchUrlContent(string $url): ?string {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; AstroCMS/1.0)',
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $html = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if (!$html || $httpCode !== 200) return null;

        return self::stripHtmlContent($html);
    }

    /**
     * Strip scripts/styles/svg/comments, extract body, collapse whitespace, cap size.
     */
    private static function stripHtmlContent(string $html): string {
        $html = preg_replace('/<script[^>]*>[\s\S]*?<\/script>/i', '', $html);
        $html = preg_replace('/<style[^>]*>[\s\S]*?<\/style>/i', '', $html);
        $html = preg_replace('/<svg[^>]*>[\s\S]*?<\/svg>/i', '', $html);
        $html = preg_replace('/<!--[\s\S]*?-->/', '', $html);

        if (preg_match('/<body[^>]*>([\s\S]*?)<\/body>/i', $html, $m)) {
            $html = $m[1];
        }

        $html = preg_replace('/\s+/', ' ', $html);
        $html = trim($html);

        if (mb_strlen($html) > 80000) {
            $html = mb_substr($html, 0, 80000) . "\n[... tronqué — page trop longue]";
        }

        return $html;
    }

    private static function slugify(string $text): string {
        $text = transliterator_transliterate('Any-Latin; Latin-ASCII; Lower()', $text);
        $text = preg_replace('/[^a-z0-9]+/', '-', $text);
        return trim($text, '-');
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
