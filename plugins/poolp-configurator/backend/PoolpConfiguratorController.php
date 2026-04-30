<?php
/**
 * PoolpConfiguratorController — endpoints API du plugin POOLP.
 *
 * Routes (toutes préfixées par /api dans le routeur du monorepo) :
 *   POST   /poolp/compute
 *   GET    /poolp/bootstrap
 *   GET    /poolp/delivery-zones/:cp
 *   POST   /poolp/projects
 *   GET    /poolp/projects/:token
 *   PUT    /poolp/projects/:token
 *   POST   /poolp/projects/:token/pdf
 *   POST   /poolp/projects/:token/cart
 *   POST   /poolp/projects/:token/qualify
 *
 *   GET/POST/PUT/DELETE  /poolp/admin/zones[/:id]   (auth editor+)
 *   GET                  /poolp/admin/projects[/:id] (auth editor+)
 */
class PoolpConfiguratorController {

    // ── Bootstrap : données de base pour le wizard ─────────────────────────
    public static function bootstrap(): void {
        $db = Database::getInstance();
        $boxes = self::cptList($db, 'cpt_poolp_boxes');
        $equipments = self::cptList($db, 'cpt_poolp_equipments');
        $finitions = self::cptList($db, 'cpt_poolp_finitions');
        $compositions = self::cptList($db, 'cpt_poolp_compositions');

        json_response([
            'boxes' => $boxes,
            'equipments' => $equipments,
            'finitions' => $finitions,
            'compositions' => $compositions,
            'treatments' => PoolpComputeService::TREATMENTS,
        ]);
    }

    private static function cptList(PDO $db, string $table): array {
        try {
            $stmt = $db->query("SELECT id, title, slug, featured_image, custom_fields FROM `{$table}` WHERE status = 'published' ORDER BY id ASC");
            $rows = $stmt->fetchAll();
            foreach ($rows as &$r) {
                $r['custom_fields'] = json_decode($r['custom_fields'] ?? '{}', true) ?: [];
            }
            return $rows;
        } catch (\Throwable $e) {
            return [];
        }
    }

    // ── Compute : cœur du moteur métier ─────────────────────────────────────
    public static function compute(): void {
        $body = get_json_body();
        [$isPro, $rate] = self::resolveProContext();
        $result = PoolpComputeService::compute($body, $isPro, $rate);
        if (isset($result['error'])) {
            json_response($result, 400);
        }
        json_response($result);
    }

    private static function resolveProContext(): array {
        // Lit le customer connecté si présent. Pas de require — endpoint public.
        $token = get_bearer_token();
        if (!$token) return [false, 0.0];
        try {
            $customer = authenticate_customer();
        } catch (\Throwable $e) {
            return [false, 0.0];
        }
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT is_pro, discount_rate FROM customers WHERE id = ?");
        $stmt->execute([$customer['id']]);
        $row = $stmt->fetch();
        if (!$row || !(int)$row['is_pro']) return [false, 0.0];
        return [true, (float)$row['discount_rate']];
    }

    // ── Delivery zone resolution ────────────────────────────────────────────
    public static function deliveryZone(string $cp): void {
        $mode = $_GET['mode'] ?? 'kit';
        $zone = PoolpComputeService::resolveDeliveryZone($cp, $mode);
        if (!$zone) {
            error_response('Zone de livraison introuvable pour ce code postal', 404);
        }
        json_response($zone);
    }

    // ── Projects CRUD (public) ──────────────────────────────────────────────
    public static function createProject(): void {
        $body = get_json_body();
        $state = $body['state'] ?? null;
        if (!is_array($state)) {
            error_response('state required', 400);
        }
        $db = Database::getInstance();
        $token = bin2hex(random_bytes(16));
        $email = $body['customer_email'] ?? null;
        $customerId = null;
        $bearer = get_bearer_token();
        if ($bearer) {
            try {
                $customer = authenticate_customer();
                $customerId = (int)$customer['id'];
                $email = $email ?: $customer['email'];
            } catch (\Throwable $e) { /* anonymous OK */ }
        }
        $stmt = $db->prepare("INSERT INTO poolp_projects (public_token, customer_id, customer_email, state, status) VALUES (?, ?, ?, ?, 'saved')");
        $stmt->execute([$token, $customerId, $email, json_encode($state, JSON_UNESCAPED_UNICODE)]);
        json_response(['token' => $token, 'id' => (int)$db->lastInsertId()], 201);
    }

    public static function getProject(string $token): void {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT * FROM poolp_projects WHERE public_token = ?");
        $stmt->execute([$token]);
        $row = $stmt->fetch();
        if (!$row) error_response('Projet introuvable', 404);

        $state = json_decode($row['state'] ?? '{}', true) ?: [];
        // Recalcule prix logistiques courants (CDC §4.2 : pas de prix figés dans state)
        [$isPro, $rate] = self::resolveProContext();
        $computed = PoolpComputeService::compute($state, $isPro, $rate);

        json_response([
            'token' => $row['public_token'],
            'state' => $state,
            'status' => $row['status'],
            'is_erp' => (bool)$row['is_erp'],
            'qualif_pro_asked' => (bool)$row['qualif_pro_asked'],
            'pdf_path' => $row['pdf_path'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'computed' => $computed,
        ]);
    }

    public static function updateProject(string $token): void {
        $body = get_json_body();
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT id FROM poolp_projects WHERE public_token = ?");
        $stmt->execute([$token]);
        $row = $stmt->fetch();
        if (!$row) error_response('Projet introuvable', 404);

        $fields = [];
        $values = [];
        if (isset($body['state'])) {
            $fields[] = 'state = ?';
            $values[] = json_encode($body['state'], JSON_UNESCAPED_UNICODE);
        }
        if (isset($body['is_erp'])) {
            $fields[] = 'is_erp = ?';
            $values[] = $body['is_erp'] ? 1 : 0;
        }
        if (isset($body['status']) && in_array($body['status'], ['draft','saved','quote_requested','converted_to_cart','ordered'], true)) {
            $fields[] = 'status = ?';
            $values[] = $body['status'];
        }
        if (empty($fields)) {
            json_response(['ok' => true, 'noop' => true]);
        }
        $values[] = $token;
        $sql = "UPDATE poolp_projects SET " . implode(', ', $fields) . " WHERE public_token = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute($values);
        json_response(['ok' => true]);
    }

    public static function qualifyProject(string $token): void {
        $body = get_json_body();
        $isPro = !empty($body['is_pro']);
        $db = Database::getInstance();
        $stmt = $db->prepare("UPDATE poolp_projects SET qualif_pro_asked = 1 WHERE public_token = ?");
        $stmt->execute([$token]);
        json_response(['ok' => true, 'is_pro' => $isPro]);
    }

    public static function exportPdf(string $token): void {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT * FROM poolp_projects WHERE public_token = ?");
        $stmt->execute([$token]);
        $row = $stmt->fetch();
        if (!$row) error_response('Projet introuvable', 404);

        $state = json_decode($row['state'] ?? '{}', true) ?: [];
        [$isPro, $rate] = self::resolveProContext();
        $computed = PoolpComputeService::compute($state, $isPro, $rate);

        // Generate via Dompdf if available, otherwise fallback to a simple HTML
        $pdfDir = realpath(__DIR__ . '/../../../') . '/backend-php/uploads/poolp/pdf';
        // Try to resolve uploads dir reliably (we may be loaded from EXTERNAL_PLUGINS_DIR)
        $altDir = self::resolveUploadsPdfDir();
        if ($altDir) $pdfDir = $altDir;
        if (!is_dir($pdfDir)) @mkdir($pdfDir, 0755, true);

        $filename = $token . '.pdf';
        $path = $pdfDir . '/' . $filename;

        $html = self::renderPdfHtml($row, $state, $computed);

        $generated = false;
        if (class_exists('\\Dompdf\\Dompdf')) {
            try {
                $dompdf = new \Dompdf\Dompdf(['isHtml5ParserEnabled' => true, 'isRemoteEnabled' => false]);
                $dompdf->loadHtml($html, 'UTF-8');
                $dompdf->setPaper('A4', 'portrait');
                $dompdf->render();
                file_put_contents($path, $dompdf->output());
                $generated = true;
            } catch (\Throwable $e) {
                error_log('Dompdf failed: ' . $e->getMessage());
            }
        }
        if (!$generated) {
            // Fallback : on stocke l'HTML pour inspection, le client doit utiliser
            // l'impression navigateur en attendant l'install de Dompdf.
            file_put_contents($path . '.html', $html);
            error_response('Dompdf non installé. Lance `composer require dompdf/dompdf` dans backend-php.', 501);
        }

        $url = '/uploads/poolp/pdf/' . $filename;
        $stmt = $db->prepare("UPDATE poolp_projects SET pdf_path = ? WHERE public_token = ?");
        $stmt->execute([$url, $token]);

        json_response(['url' => $url]);
    }

    private static function resolveUploadsPdfDir(): ?string {
        // Walks up from this file to find backend-php/uploads/. Works for both
        // monorepo plugins (plugins/<dir>/backend/) and external plugins
        // (EXTERNAL_PLUGINS_DIR/<dir>/backend/) — we use the BACKEND_PATH if it
        // was registered by the bootstrap, otherwise fall back to env-based guess.
        $envBackend = $_ENV['BACKEND_PHP_DIR'] ?? null;
        if ($envBackend && is_dir($envBackend)) {
            return rtrim($envBackend, '/') . '/uploads/poolp/pdf';
        }
        // Last-resort guess: assume monorepo layout where backend-php sits next to plugins/
        $guesses = [
            __DIR__ . '/../../../astro/backend-php/uploads/poolp/pdf',
            __DIR__ . '/../../../backend-php/uploads/poolp/pdf',
        ];
        foreach ($guesses as $g) {
            $parent = dirname($g);
            if (is_dir($parent) || @mkdir($parent, 0755, true)) {
                return $g;
            }
        }
        return null;
    }

    private static function renderPdfHtml(array $row, array $state, array $computed): string {
        $tpl = self::resolveTemplate('pdf/project');
        if (!$tpl) {
            return '<html><body><h1>POOLP — Récap projet</h1><pre>' . htmlspecialchars(json_encode(['state' => $state, 'computed' => $computed], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) . '</pre></body></html>';
        }
        // Tiny mustache-like rendering : we expose $state and $computed.
        // For richer rendering, use BladeRenderer if available.
        ob_start();
        $project = $row;
        include $tpl;
        return ob_get_clean();
    }

    private static function resolveTemplate(string $name): ?string {
        // Look for the template file alongside the plugin (templates/<name>.blade.php
        // or templates/<name>.phtml). The plugin lives at __DIR__/../templates.
        $base = realpath(__DIR__ . '/..');
        if (!$base) return null;
        $candidates = [
            $base . '/templates/' . $name . '.phtml',
            $base . '/templates/' . $name . '.blade.php',
        ];
        foreach ($candidates as $c) {
            if (is_file($c)) return $c;
        }
        return null;
    }

    public static function addToCart(string $token): void {
        $db = Database::getInstance();
        // Check that the carts table exists (ecommerce plugin must be installed)
        try {
            $stmt = $db->query("SHOW TABLES LIKE 'carts'");
            if (!$stmt->fetch()) {
                error_response('Le plugin ecommerce doit être installé pour utiliser le panier', 501);
            }
        } catch (\Throwable $e) {
            error_response('DB error', 500);
        }

        $stmt = $db->prepare("SELECT * FROM poolp_projects WHERE public_token = ?");
        $stmt->execute([$token]);
        $project = $stmt->fetch();
        if (!$project) error_response('Projet introuvable', 404);

        $state = json_decode($project['state'] ?? '{}', true) ?: [];
        [$isPro, $rate] = self::resolveProContext();
        $computed = PoolpComputeService::compute($state, $isPro, $rate);
        if (isset($computed['error'])) {
            json_response($computed, 400);
        }

        // Resolve or create a cart token (cookie-based, ecommerce convention)
        $cartToken = $_COOKIE['cart_token'] ?? bin2hex(random_bytes(16));
        $stmt = $db->prepare("SELECT id FROM carts WHERE token = ? LIMIT 1");
        $stmt->execute([$cartToken]);
        $cart = $stmt->fetch();
        if (!$cart) {
            $stmt = $db->prepare("INSERT INTO carts (token, expires_at) VALUES (?, DATE_ADD(NOW(), INTERVAL 30 DAY))");
            $stmt->execute([$cartToken]);
            $cartId = (int)$db->lastInsertId();
            setcookie('cart_token', $cartToken, [
                'expires' => time() + 86400 * 30,
                'path' => '/',
                'samesite' => 'Lax',
                'secure' => isset($_SERVER['HTTPS']),
                'httponly' => false,
            ]);
        } else {
            $cartId = (int)$cart['id'];
        }

        $title = sprintf('Configurateur POOLP — Box %s', $computed['box']['code'] ?? '?');
        $unitTtcCents = (int) round($computed['totaux']['ttc'] * 100);
        $unitProHtCents = isset($computed['totaux']['pro_ht_remise']) && $computed['totaux']['pro_ht_remise'] !== null
            ? (int) round($computed['totaux']['pro_ht_remise'] * 100)
            : null;

        $snapshot = ['state' => $state, 'computed' => $computed];

        $stmt = $db->prepare("INSERT INTO cart_items_custom (cart_id, source_type, source_id, title, config_snapshot, unit_price_ttc_cents, unit_price_pro_ht_cents, quantity) VALUES (?, 'poolp_configurator', ?, ?, ?, ?, ?, 1)");
        $stmt->execute([$cartId, (int)$project['id'], $title, json_encode($snapshot, JSON_UNESCAPED_UNICODE), $unitTtcCents, $unitProHtCents]);

        $stmt = $db->prepare("UPDATE poolp_projects SET status = 'converted_to_cart' WHERE id = ?");
        $stmt->execute([(int)$project['id']]);

        json_response(['ok' => true, 'cart_token' => $cartToken, 'cart_id' => $cartId]);
    }

    // ── Admin : zones de livraison ──────────────────────────────────────────
    public static function adminListZones(): void {
        $db = Database::getInstance();
        $rows = $db->query("SELECT * FROM poolp_delivery_zones ORDER BY sort_order, id")->fetchAll();
        foreach ($rows as &$r) {
            $r['postal_codes'] = json_decode($r['postal_codes'] ?? '[]', true) ?: [];
        }
        json_response($rows);
    }

    public static function adminCreateZone(): void {
        $body = get_json_body();
        $db = Database::getInstance();
        $stmt = $db->prepare("INSERT INTO poolp_delivery_zones (zone_label, postal_codes, delay_label, fee_kit_ttc_cents, fee_assembled_ttc_cents, fee_kit_pro_ht_cents, fee_assembled_pro_ht_cents, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $body['zone_label'] ?? 'Zone',
            json_encode($body['postal_codes'] ?? [], JSON_UNESCAPED_UNICODE),
            $body['delay_label'] ?? null,
            (int)round((float)($body['fee_kit_ttc'] ?? 0) * 100),
            (int)round((float)($body['fee_assembled_ttc'] ?? 0) * 100),
            (int)round((float)($body['fee_kit_pro_ht'] ?? 0) * 100),
            (int)round((float)($body['fee_assembled_pro_ht'] ?? 0) * 100),
            !empty($body['is_active']) ? 1 : 0,
            (int)($body['sort_order'] ?? 0),
        ]);
        json_response(['id' => (int)$db->lastInsertId()], 201);
    }

    public static function adminUpdateZone(int $id): void {
        $body = get_json_body();
        $db = Database::getInstance();
        $stmt = $db->prepare("UPDATE poolp_delivery_zones SET zone_label = ?, postal_codes = ?, delay_label = ?, fee_kit_ttc_cents = ?, fee_assembled_ttc_cents = ?, fee_kit_pro_ht_cents = ?, fee_assembled_pro_ht_cents = ?, is_active = ?, sort_order = ? WHERE id = ?");
        $stmt->execute([
            $body['zone_label'] ?? 'Zone',
            json_encode($body['postal_codes'] ?? [], JSON_UNESCAPED_UNICODE),
            $body['delay_label'] ?? null,
            (int)round((float)($body['fee_kit_ttc'] ?? 0) * 100),
            (int)round((float)($body['fee_assembled_ttc'] ?? 0) * 100),
            (int)round((float)($body['fee_kit_pro_ht'] ?? 0) * 100),
            (int)round((float)($body['fee_assembled_pro_ht'] ?? 0) * 100),
            !empty($body['is_active']) ? 1 : 0,
            (int)($body['sort_order'] ?? 0),
            $id,
        ]);
        json_response(['ok' => true]);
    }

    public static function adminDeleteZone(int $id): void {
        $db = Database::getInstance();
        $stmt = $db->prepare("DELETE FROM poolp_delivery_zones WHERE id = ?");
        $stmt->execute([$id]);
        json_response(['ok' => true]);
    }

    // ── Admin : projets sauvegardés ─────────────────────────────────────────
    public static function adminListProjects(): void {
        $db = Database::getInstance();
        $rows = $db->query("SELECT id, public_token, customer_id, customer_email, status, is_erp, pdf_path, created_at, updated_at FROM poolp_projects ORDER BY created_at DESC LIMIT 200")->fetchAll();
        json_response($rows);
    }

    public static function adminGetProject(int $id): void {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT * FROM poolp_projects WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) error_response('Projet introuvable', 404);
        $row['state'] = json_decode($row['state'] ?? '{}', true) ?: [];
        json_response($row);
    }

    public static function adminDeleteProject(int $id): void {
        $db = Database::getInstance();
        $stmt = $db->prepare("DELETE FROM poolp_projects WHERE id = ?");
        $stmt->execute([$id]);
        json_response(['ok' => true]);
    }
}
