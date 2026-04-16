<?php

require_once __DIR__ . '/../helpers/encryption.php';

class AiCreditController {

    // ── Pricing per million tokens (USD) ──
    private static array $pricing = [
        'haiku'  => ['input' => 1.00, 'output' => 5.00],
        'sonnet' => ['input' => 3.00, 'output' => 15.00],
    ];

    // ── Overview (stats + entries + per-user) ──
    public static function getOverview(): void {
        // Trigger auto-reset if needed (also calculates available)
        $available = self::getAvailableCredits();

        $db = Database::getInstance();
        $month = date('Y-m');
        $monthStart = "{$month}-01 00:00:00";

        // Total credits this month
        $stmt = $db->prepare("SELECT COALESCE(SUM(credits), 0) FROM ai_credits WHERE created_at >= ?");
        $stmt->execute([$monthStart]);
        $totalCredits = (float) $stmt->fetchColumn();

        // Used credits this month
        $stmt = $db->prepare("SELECT COALESCE(SUM(credits_used), 0) FROM ai_credit_usage WHERE created_at >= ?");
        $stmt->execute([$monthStart]);
        $totalUsed = (float) $stmt->fetchColumn();

        // Monthly credit setting
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_monthly_credits'");
        $stmt->execute();
        $monthlyCredits = (float) ($stmt->fetchColumn() ?: 0);

        json_response([
            'total_credits' => round($totalCredits, 4),
            'total_used' => round($totalUsed, 6),
            'available' => round($available, 4),
            'monthly_credits' => $monthlyCredits,
            'month' => $month,
        ]);
    }

    // ── Per-user usage this month ──
    public static function getPerUserUsage(): void {
        $db = Database::getInstance();
        $monthStart = date('Y-m') . '-01 00:00:00';

        $stmt = $db->prepare("
            SELECT u.id, u.name, u.email,
                   COUNT(cu.id) as request_count,
                   COALESCE(SUM(cu.input_tokens), 0) as total_input_tokens,
                   COALESCE(SUM(cu.output_tokens), 0) as total_output_tokens,
                   COALESCE(SUM(cu.credits_used), 0) as total_credits_used
            FROM ai_credit_usage cu
            JOIN users u ON u.id = cu.user_id
            WHERE cu.created_at >= ?
            GROUP BY u.id, u.name, u.email
            ORDER BY total_credits_used DESC
        ");
        $stmt->execute([$monthStart]);

        json_response($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // ── Usage log (paginated) ──
    public static function getUsageLog(): void {
        $db = Database::getInstance();
        $page = max(1, (int) get_query_param('page', 1));
        $limit = 50;
        $offset = ($page - 1) * $limit;
        $userId = get_query_param('user_id');
        $month = get_query_param('month', date('Y-m'));
        $monthStart = "{$month}-01 00:00:00";
        $monthEnd = date('Y-m-t 23:59:59', strtotime($monthStart));

        $where = "cu.created_at >= ? AND cu.created_at <= ?";
        $params = [$monthStart, $monthEnd];

        if ($userId) {
            $where .= " AND cu.user_id = ?";
            $params[] = (int) $userId;
        }

        // Count
        $stmt = $db->prepare("SELECT COUNT(*) FROM ai_credit_usage cu WHERE {$where}");
        $stmt->execute($params);
        $total = (int) $stmt->fetchColumn();

        // Rows
        $stmt = $db->prepare("
            SELECT cu.*, u.name as user_name
            FROM ai_credit_usage cu
            JOIN users u ON u.id = cu.user_id
            WHERE {$where}
            ORDER BY cu.created_at DESC
            LIMIT {$limit} OFFSET {$offset}
        ");
        $stmt->execute($params);

        json_response([
            'data' => $stmt->fetchAll(PDO::FETCH_ASSOC),
            'total' => $total,
            'page' => $page,
            'pages' => ceil($total / $limit),
        ]);
    }

    // ── Per-model usage this month ──
    public static function getPerModelUsage(): void {
        $db = Database::getInstance();
        $monthStart = date('Y-m') . '-01 00:00:00';

        $stmt = $db->prepare("
            SELECT model,
                   COUNT(id) as request_count,
                   COALESCE(SUM(input_tokens), 0) as total_input_tokens,
                   COALESCE(SUM(output_tokens), 0) as total_output_tokens,
                   COALESCE(SUM(credits_used), 0) as total_credits_used
            FROM ai_credit_usage
            WHERE created_at >= ?
            GROUP BY model
            ORDER BY total_credits_used DESC
        ");
        $stmt->execute([$monthStart]);

        json_response($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // ── Credit entries this month ──
    public static function getCreditEntries(): void {
        $db = Database::getInstance();
        $month = get_query_param('month', date('Y-m'));
        $monthStart = "{$month}-01 00:00:00";
        $monthEnd = date('Y-m-t 23:59:59', strtotime($monthStart));

        $stmt = $db->prepare("
            SELECT ac.*, u.name as added_by_name
            FROM ai_credits ac
            LEFT JOIN users u ON u.id = ac.added_by
            WHERE ac.created_at >= ? AND ac.created_at <= ?
            ORDER BY ac.created_at DESC
        ");
        $stmt->execute([$monthStart, $monthEnd]);

        json_response($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // ── Add manual credits ──
    public static function addCredits(array $user): void {
        $body = get_json_body();
        $credits = (float) ($body['credits'] ?? 0);
        $note = trim($body['note'] ?? '');

        if ($credits <= 0) {
            error_response('Le montant doit être supérieur à 0', 400);
            return;
        }

        $db = Database::getInstance();
        $stmt = $db->prepare("INSERT INTO ai_credits (credits, source, note, added_by) VALUES (?, 'manual', ?, ?)");
        $stmt->execute([$credits, $note ?: null, $user['id']]);

        json_response(['id' => (int) $db->lastInsertId(), 'message' => 'Crédits ajoutés'], 201);
    }

    // ── Delete manual credit entry ──
    public static function deleteCredit(int $id): void {
        $db = Database::getInstance();

        // Only allow deleting manual entries
        $stmt = $db->prepare("SELECT source FROM ai_credits WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            error_response('Entrée non trouvée', 404);
            return;
        }
        if ($row['source'] !== 'manual') {
            error_response('Seuls les crédits manuels peuvent être supprimés', 403);
            return;
        }

        $stmt = $db->prepare("DELETE FROM ai_credits WHERE id = ?");
        $stmt->execute([$id]);

        json_response(['message' => 'Crédit supprimé']);
    }

    // ── Get API key (masked or revealed) ──
    public static function getApiKey(): void {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_api_key_encrypted'");
        $stmt->execute();
        $encrypted = $stmt->fetchColumn();

        $reveal = get_query_param('reveal') === '1';
        $masked = '';
        $plain = '';
        $hasKey = false;

        if ($encrypted) {
            try {
                $key = decrypt_value($encrypted);
                $hasKey = true;
                if ($reveal) {
                    $plain = $key;
                }
                if (strlen($key) > 11) {
                    $masked = substr($key, 0, 7) . str_repeat('•', strlen($key) - 11) . substr($key, -4);
                } else {
                    $masked = str_repeat('•', strlen($key));
                }
            } catch (\Exception $e) {
                $masked = '(erreur de déchiffrement)';
            }
        }

        $response = ['has_key' => $hasKey, 'masked' => $masked];
        if ($reveal && $plain) {
            $response['plain'] = $plain;
        }
        json_response($response);
    }

    // ── Save API key (encrypted) ──
    public static function saveApiKey(): void {
        $body = get_json_body();
        $apiKey = trim($body['api_key'] ?? '');

        if (empty($apiKey)) {
            error_response('La clé API est requise', 400);
            return;
        }

        $encrypted = encrypt_value($apiKey);
        $db = Database::getInstance();
        $stmt = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('ai_api_key_encrypted', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
        $stmt->execute([$encrypted]);

        json_response(['message' => 'Clé API sauvegardée']);
    }

    // ── Update credit limit ──
    public static function updateLimit(): void {
        $body = get_json_body();
        $limit = (float) ($body['limit'] ?? 0);

        $db = Database::getInstance();
        $stmt = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('ai_credit_limit', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
        $stmt->execute([$limit]);

        json_response(['message' => 'Limite mise à jour']);
    }

    // ── Update monthly auto-credit amount ──
    public static function updateMonthlyCredits(): void {
        $body = get_json_body();
        $amount = (float) ($body['amount'] ?? 0);

        $db = Database::getInstance();
        $stmt = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('ai_monthly_credits', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
        $stmt->execute([$amount]);

        json_response(['message' => 'Crédits mensuels mis à jour']);
    }

    // ── Monthly reset (called by cron or auto-check) ──
    public static function resetMonthlyCredits(): void {
        $db = Database::getInstance();
        $currentMonth = date('Y-m');

        // Check if already reset this month
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_last_reset_date'");
        $stmt->execute();
        $lastReset = $stmt->fetchColumn();

        if ($lastReset && strpos($lastReset, $currentMonth) === 0) {
            json_response(['message' => 'Déjà réinitialisé ce mois-ci', 'skipped' => true]);
            return;
        }

        // Get monthly amount
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_monthly_credits'");
        $stmt->execute();
        $amount = (float) ($stmt->fetchColumn() ?: 0);

        if ($amount > 0) {
            $stmt = $db->prepare("INSERT INTO ai_credits (credits, source, note) VALUES (?, 'monthly_reset', ?)");
            $stmt->execute([$amount, "Allocation mensuelle {$currentMonth}"]);
        }

        // Update last reset date
        $stmt = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('ai_last_reset_date', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
        $stmt->execute([date('Y-m-d')]);

        json_response(['message' => "Crédits réinitialisés : {$amount} USD", 'credits' => $amount]);
    }

    // ── Internal: get available credits for current month ──
    public static function getAvailableCredits(): float {
        $db = Database::getInstance();
        $monthStart = date('Y-m') . '-01 00:00:00';

        // Auto-reset check: if first of month and no reset yet
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_last_reset_date'");
        $stmt->execute();
        $lastReset = $stmt->fetchColumn();
        $currentMonth = date('Y-m');

        if (!$lastReset || strpos($lastReset, $currentMonth) !== 0) {
            // Auto-trigger monthly reset
            $stmtAmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_monthly_credits'");
            $stmtAmt->execute();
            $amount = (float) ($stmtAmt->fetchColumn() ?: 0);

            if ($amount > 0) {
                $ins = $db->prepare("INSERT INTO ai_credits (credits, source, note) VALUES (?, 'monthly_reset', ?)");
                $ins->execute([$amount, "Allocation mensuelle {$currentMonth}"]);
            }

            $upd = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('ai_last_reset_date', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
            $upd->execute([date('Y-m-d')]);
        }

        $stmt = $db->prepare("SELECT COALESCE(SUM(credits), 0) FROM ai_credits WHERE created_at >= ?");
        $stmt->execute([$monthStart]);
        $totalCredits = (float) $stmt->fetchColumn();

        $stmt = $db->prepare("SELECT COALESCE(SUM(credits_used), 0) FROM ai_credit_usage WHERE created_at >= ?");
        $stmt->execute([$monthStart]);
        $totalUsed = (float) $stmt->fetchColumn();

        return $totalCredits - $totalUsed;
    }

    // ── Internal: get decrypted API key ──
    public static function getDecryptedApiKey(): string {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_api_key_encrypted'");
        $stmt->execute();
        $encrypted = $stmt->fetchColumn();

        if (!$encrypted) {
            // Fallback to env
            return $_ENV['ANTHROPIC_API_KEY'] ?? '';
        }

        try {
            return decrypt_value($encrypted);
        } catch (\Exception $e) {
            // Fallback to env if decryption fails
            return $_ENV['ANTHROPIC_API_KEY'] ?? '';
        }
    }

    // ── Internal: log AI usage ──
    public static function logUsage(int $userId, string $model, int $inputTokens, int $outputTokens, string $promptSummary = ''): void {
        $pricing = self::$pricing[$model] ?? self::$pricing['haiku'];
        $cost = ($inputTokens / 1_000_000) * $pricing['input'] + ($outputTokens / 1_000_000) * $pricing['output'];

        $db = Database::getInstance();
        $stmt = $db->prepare("
            INSERT INTO ai_credit_usage (user_id, model, input_tokens, output_tokens, credits_used, prompt_summary)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$userId, $model, $inputTokens, $outputTokens, $cost, mb_substr($promptSummary, 0, 255)]);
    }
}
