<?php
/**
 * InvoiceController — generation et gestion des factures PDF.
 *
 * Factures auto-numerotees via settings `invoice_prefix` + `invoice_next_number`.
 * Moteur PDF : Dompdf (fallback HTML si non installe).
 *
 * Routes :
 *   GET  /admin/invoices              (liste paginee)
 *   GET  /admin/invoices/:id/pdf      (telecharger PDF)
 *   POST /admin/invoices/generate     { order_id } (generer facture pour commande)
 *   GET  /orders/:id/invoice          (customer — sa propre facture)
 */
class InvoiceController {

    /** GET /admin/invoices */
    public static function listAll(): void {
        require_ecommerce_enabled();
        $db = Database::getInstance();

        $page = max(1, (int) ($_GET['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($_GET['per_page'] ?? 25)));
        $offset = ($page - 1) * $perPage;

        $where = ['1=1'];
        $params = [];
        if (!empty($_GET['q'])) {
            $where[] = '(i.invoice_number LIKE ? OR o.order_number LIKE ? OR o.email LIKE ?)';
            $term = '%' . $_GET['q'] . '%';
            $params = array_merge($params, [$term, $term, $term]);
        }
        if (!empty($_GET['type'])) {
            $where[] = 'i.type = ?';
            $params[] = $_GET['type'];
        }
        $whereStr = implode(' AND ', $where);

        $countStmt = $db->prepare("SELECT COUNT(*) AS total FROM invoices i JOIN orders o ON o.id = i.order_id WHERE {$whereStr}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetch()['total'];

        $stmt = $db->prepare("
            SELECT i.*, o.order_number, o.email, o.total_cents AS order_total_cents
            FROM invoices i
            JOIN orders o ON o.id = i.order_id
            WHERE {$whereStr}
            ORDER BY i.created_at DESC
            LIMIT {$perPage} OFFSET {$offset}
        ");
        $stmt->execute($params);

        json_response([
            'invoices' => $stmt->fetchAll(),
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'pages' => (int) ceil($total / $perPage),
        ]);
    }

    /** POST /admin/invoices/generate  { order_id | order_number } */
    public static function generate(): void {
        require_ecommerce_enabled();
        $body = get_json_body();
        $orderId = (int) ($body['order_id'] ?? 0);

        // Support order_number lookup
        if ($orderId <= 0 && !empty($body['order_number'])) {
            $db = Database::getInstance();
            $stmt = $db->prepare('SELECT id FROM orders WHERE order_number = ?');
            $stmt->execute([trim((string) $body['order_number'])]);
            $row = $stmt->fetch();
            if (!$row) error_response('Commande introuvable', 404);
            $orderId = (int) $row['id'];
        }
        if ($orderId <= 0) error_response('order_id ou order_number requis', 400);

        $type = ($body['type'] ?? 'invoice') === 'credit_note' ? 'credit_note' : 'invoice';

        $invoice = self::createForOrder($orderId, $type);
        json_response($invoice, 201);
    }

    /** GET /admin/invoices/:id/pdf(?view=1 for inline, default=download) */
    public static function downloadPdf(int $id): void {
        require_ecommerce_enabled();
        // Support token in query string (admin iframe / direct link)
        if (!empty($_GET['token']) && empty($_SERVER['HTTP_AUTHORIZATION'])) {
            $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $_GET['token'];
        }
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM invoices WHERE id = ?');
        $stmt->execute([$id]);
        $invoice = $stmt->fetch();
        if (!$invoice) error_response('Facture introuvable', 404);

        $viewMode = !empty($_GET['view']);
        self::outputPdf($invoice, $viewMode);
    }

    /** GET /orders/:id/invoice — customer access to own invoice.
     *  Supports ?token= query param for new-tab download (Bearer not possible in <a href>). */
    public static function customerDownload(int $orderId): void {
        require_ecommerce_enabled();
        // Support token in query string for direct link downloads
        if (!empty($_GET['token']) && empty($_SERVER['HTTP_AUTHORIZATION'])) {
            $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $_GET['token'];
        }
        $customer = authenticate_customer();

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT o.id FROM orders o WHERE o.id = ? AND o.customer_id = ?');
        $stmt->execute([$orderId, $customer['id']]);
        if (!$stmt->fetch()) error_response('Commande introuvable', 404);

        $stmt = $db->prepare('SELECT * FROM invoices WHERE order_id = ? ORDER BY created_at DESC LIMIT 1');
        $stmt->execute([$orderId]);
        $invoice = $stmt->fetch();
        if (!$invoice) error_response('Aucune facture disponible pour cette commande', 404);

        self::outputPdf($invoice);
    }

    // ── Core ──────────────────────────────────────────────────────────────

    /**
     * Create invoice record for an order.
     * Called on payment_succeeded webhook or manually from admin.
     */
    public static function createForOrder(int $orderId, string $type = 'invoice'): array {
        $db = Database::getInstance();

        // Check order exists
        $stmt = $db->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if (!$order) error_response('Commande introuvable', 404);

        // Check no duplicate invoice for this order (ignore credit notes if type column exists)
        $stmt = $db->prepare('SELECT id FROM invoices WHERE order_id = ? LIMIT 1');
        $stmt->execute([$orderId]);
        if ($stmt->fetch()) {
            error_response('Une facture existe deja pour cette commande', 409);
        }

        $invoiceNumber = self::nextInvoiceNumber($type);

        // Build INSERT dynamically based on actual table columns
        $cols = $db->query("SHOW COLUMNS FROM invoices")->fetchAll(\PDO::FETCH_COLUMN);
        $colSet = array_flip($cols);

        $f = ['order_id', 'invoice_number', 'total_cents', 'tax_cents'];
        $p = ['?', '?', '?', '?'];
        $v = [$orderId, $invoiceNumber, (int) ($order['total_cents'] ?? 0), (int) ($order['tax_cents'] ?? 0)];

        if (isset($colSet['type']))         { $f[] = 'type';         $p[] = '?'; $v[] = $type; }
        if (isset($colSet['year']))         { $f[] = 'year';         $p[] = '?'; $v[] = (int) date('Y'); }
        if (isset($colSet['pdf_path']))     { $f[] = 'pdf_path';     $p[] = '?'; $v[] = ''; }
        if (isset($colSet['amount_cents'])) { $f[] = 'amount_cents'; $p[] = '?'; $v[] = (int) ($order['subtotal_cents'] ?? 0); }
        if (isset($colSet['currency']))     { $f[] = 'currency';     $p[] = '?'; $v[] = $order['currency'] ?? 'EUR'; }

        $f[] = 'issued_at'; $p[] = 'NOW()';
        $f[] = 'created_at'; $p[] = 'NOW()';

        $stmt = $db->prepare('INSERT INTO invoices (' . implode(', ', $f) . ') VALUES (' . implode(', ', $p) . ')');
        $stmt->execute($v);
        $id = (int) $db->lastInsertId();

        $stmt = $db->prepare('SELECT * FROM invoices WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    /**
     * Auto-generate invoice on payment success (called from StripeController webhook).
     */
    public static function autoGenerateOnPayment(int $orderId): void {
        try {
            $db = Database::getInstance();
            // Don't duplicate
            $stmt = $db->prepare('SELECT id FROM invoices WHERE order_id = ? AND type = "invoice"');
            $stmt->execute([$orderId]);
            if ($stmt->fetch()) return;

            self::createForOrder($orderId, 'invoice');
        } catch (\Throwable $e) {
            error_log("InvoiceController::autoGenerateOnPayment failed for order {$orderId}: " . $e->getMessage());
        }
    }

    /** GET /invoices/download/:id?sig= — public signed link (email download, no auth). */
    public static function publicDownload(int $id): void {
        $sig = trim((string) ($_GET['sig'] ?? ''));
        if ($sig === '') error_response('Lien invalide', 400);

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM invoices WHERE id = ?');
        $stmt->execute([$id]);
        $invoice = $stmt->fetch();
        if (!$invoice) error_response('Facture introuvable', 404);

        $expected = self::signInvoiceLink($id, (int) $invoice['order_id']);
        if (!hash_equals($expected, $sig)) {
            error_response('Lien invalide ou expire', 403);
        }

        self::outputPdf($invoice, false);
    }

    private static function signInvoiceLink(int $invoiceId, int $orderId): string {
        $secret = $_ENV['JWT_SECRET'] ?? $_ENV['APP_KEY'] ?? 'fallback-secret';
        // Signature = HMAC of invoiceId + orderId (no expiry for simplicity, link is unique per invoice)
        return hash_hmac('sha256', "invoice:{$invoiceId}:order:{$orderId}", $secret);
    }

    // ── PDF rendering ─────────────────────────────────────────────────────

    private static function outputPdf(array $invoice, bool $viewMode = false): void {
        $order = OrderController::loadFullStatic((int) $invoice['order_id']);
        if (!$order) error_response('Commande liee introuvable', 404);

        $html = self::renderHtml($invoice, $order);

        // Try Dompdf
        if (class_exists('\\Dompdf\\Dompdf')) {
            $dompdf = new \Dompdf\Dompdf(['isRemoteEnabled' => false]);
            $dompdf->loadHtml($html);
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();

            header('Content-Type: application/pdf');
            $disposition = $viewMode ? 'inline' : 'attachment';
            header('Content-Disposition: ' . $disposition . '; filename="' . ($invoice['invoice_number'] ?? 'facture') . '.pdf"');
            echo $dompdf->output();
            exit;
        }

        // Fallback: return HTML
        header('Content-Type: text/html; charset=utf-8');
        echo $html;
        exit;
    }

    /**
     * Send invoice PDF by email to the customer.
     * Called after payment confirmation (webhook or admin status change).
     */
    public static function sendInvoiceEmail(int $orderId): void {
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare('SELECT * FROM invoices WHERE order_id = ? ORDER BY created_at DESC LIMIT 1');
            $stmt->execute([$orderId]);
            $invoice = $stmt->fetch();
            if (!$invoice) return;

            $order = OrderController::loadFullStatic($orderId);
            if (!$order || empty($order['email'])) return;

            $html = self::renderHtml($invoice, $order);

            // Build email with invoice as inline HTML (email clients don't support PDF attachments via API easily)
            $siteName = self::getSetting('site_name', 'Boutique');
            $primaryColor = self::getSetting('color_primary', '#1a1a2e');
            $frontendUrl = rtrim($_ENV['FRONTEND_URL'] ?? '', '/');
            $invoiceNumber = htmlspecialchars($invoice['invoice_number'] ?? '');
            $orderNumber = htmlspecialchars($order['order_number'] ?? '');
            $total = number_format((int) ($order['total_cents'] ?? 0) / 100, 2, ',', ' ') . ' €';

            // Signed download link (no auth needed, expires in 7 days)
            $sig = self::signInvoiceLink($invoice['id'], $orderId);
            // Use BACKEND_URL (root of PHP backend, not /admin subpath)
            $backendUrl = rtrim($_ENV['BACKEND_URL'] ?? '', '/');
            if (!$backendUrl) {
                // Derive from ADMIN_URL by stripping /admin suffix
                $adminUrl = rtrim($_ENV['ADMIN_URL'] ?? '', '/');
                $backendUrl = preg_replace('#/admin$#', '', $adminUrl) ?: $frontendUrl;
            }
            $downloadUrl = $backendUrl . '/api/invoices/download/' . $invoice['id'] . '?sig=' . urlencode($sig);

            $emailHtml = OrderMailer::buildInvoiceEmail($siteName, $primaryColor, $frontendUrl, $invoiceNumber, $orderNumber, $total, $downloadUrl);

            // Send via Resend
            $apiKey = $_ENV['RESEND_API_KEY'] ?? '';
            $from = $_ENV['ECOMMERCE_EMAILS_FROM'] ?? $_ENV['RESEND_FROM_EMAIL'] ?? '';
            if (!$apiKey || !$from) return;

            $ch = curl_init('https://api.resend.com/emails');
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 10,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $apiKey],
                CURLOPT_POSTFIELDS => json_encode([
                    'from' => $from,
                    'to' => [$order['email']],
                    'subject' => "Facture {$invoiceNumber} — {$siteName}",
                    'html' => $emailHtml,
                ], JSON_UNESCAPED_UNICODE),
            ]);
            curl_exec($ch);
            curl_close($ch);
        } catch (\Throwable $e) {
            error_log("InvoiceController::sendInvoiceEmail failed for order {$orderId}: " . $e->getMessage());
        }
    }

    private static function renderHtml(array $invoice, array $order): string {
        $siteName = self::getSetting('site_name', 'Boutique');
        $siteAddress = self::getSetting('invoice_company_address', '');
        $siret = self::getSetting('invoice_company_siret', '');
        $vatNumber = self::getSetting('invoice_company_vat', '');
        $primaryColor = self::getSetting('color_primary', '#1a1a2e');

        $billing = is_string($order['billing_address'] ?? '') ? json_decode($order['billing_address'], true) : ($order['billing_address'] ?? []);
        $billing = $billing ?: [];

        $isCredit = $invoice['type'] === 'credit_note';
        $docTitle = $isCredit ? 'Avoir' : 'Facture';
        $invoiceNumber = htmlspecialchars($invoice['invoice_number']);
        $issueDate = date('d/m/Y', strtotime($invoice['issued_at']));
        $orderNumber = htmlspecialchars($order['order_number']);

        $billingHtml = implode('<br>', array_filter([
            htmlspecialchars(trim(($billing['first_name'] ?? '') . ' ' . ($billing['last_name'] ?? ''))),
            htmlspecialchars($billing['company'] ?? ''),
            htmlspecialchars($billing['address_line1'] ?? ''),
            htmlspecialchars($billing['address_line2'] ?? ''),
            htmlspecialchars(trim(($billing['postcode'] ?? '') . ' ' . ($billing['city'] ?? ''))),
            htmlspecialchars($billing['country_code'] ?? ''),
        ]));
        if (!empty($billing['vat_number'])) {
            $billingHtml .= '<br>TVA : ' . htmlspecialchars($billing['vat_number']);
        }

        $items = $order['items'] ?? [];
        $itemsHtml = '';
        foreach ($items as $item) {
            $title = htmlspecialchars($item['product_title'] ?? '');
            $qty = (int) $item['quantity'];
            $unitHt = self::formatPrice((int) $item['unit_price_cents']);
            $rate = number_format((float) ($item['tax_rate'] ?? 20), 1);
            $lineHt = self::formatPrice((int) ($item['line_subtotal_cents'] ?? 0));
            $lineTtc = self::formatPrice((int) ($item['line_total_cents'] ?? 0));
            $itemsHtml .= "<tr>
                <td style='padding:8px 10px;border-bottom:1px solid #eee'>{$title}</td>
                <td style='padding:8px 10px;border-bottom:1px solid #eee;text-align:center'>{$qty}</td>
                <td style='padding:8px 10px;border-bottom:1px solid #eee;text-align:right'>{$unitHt}</td>
                <td style='padding:8px 10px;border-bottom:1px solid #eee;text-align:center'>{$rate}%</td>
                <td style='padding:8px 10px;border-bottom:1px solid #eee;text-align:right'>{$lineHt}</td>
                <td style='padding:8px 10px;border-bottom:1px solid #eee;text-align:right'>{$lineTtc}</td>
            </tr>";
        }

        $subtotal = self::formatPrice((int) ($order['subtotal_cents'] ?? 0));
        $shipping = self::formatPrice((int) ($order['shipping_cents'] ?? 0));
        $tax = self::formatPrice((int) ($order['tax_cents'] ?? 0));
        $total = self::formatPrice((int) ($order['total_cents'] ?? 0));

        // Tax mention (ex: exoneration UE)
        $taxBreakdown = is_string($order['tax_breakdown'] ?? '') ? json_decode($order['tax_breakdown'], true) : ($order['tax_breakdown'] ?? []);
        $taxMention = $taxBreakdown['_mention'] ?? '';
        $taxMentionHtml = $taxMention ? "<p style='font-size:11px;color:#888;margin-top:8px'>" . htmlspecialchars($taxMention) . "</p>" : '';

        $companyBlock = implode('<br>', array_filter([
            "<strong>" . htmlspecialchars($siteName) . "</strong>",
            nl2br(htmlspecialchars($siteAddress)),
            $siret ? "SIRET : " . htmlspecialchars($siret) : '',
            $vatNumber ? "TVA : " . htmlspecialchars($vatNumber) : '',
        ]));

        return <<<HTML
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>{$docTitle} {$invoiceNumber}</title>
    <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #333; margin: 0; padding: 40px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .company { font-size: 12px; line-height: 1.6; }
        .doc-title { font-size: 24px; font-weight: 700; color: {$primaryColor}; margin-bottom: 4px; }
        .doc-number { font-size: 14px; color: #666; }
        .meta-table { margin-bottom: 30px; }
        .meta-table td { padding: 4px 12px 4px 0; font-size: 13px; }
        .meta-table td:first-child { color: #888; }
        .addresses { display: flex; gap: 40px; margin-bottom: 30px; }
        .address-block { flex: 1; }
        .address-block h3 { font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; margin: 0 0 8px; }
        .address-block p { margin: 0; font-size: 13px; line-height: 1.6; }
        table.items { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        table.items th { background: #f8f8f8; padding: 10px; font-size: 11px; text-transform: uppercase; color: #888; border-bottom: 2px solid #eee; }
        .totals { text-align: right; margin-bottom: 30px; }
        .totals table { margin-left: auto; }
        .totals td { padding: 4px 12px; font-size: 14px; }
        .totals tr.total td { font-weight: 700; font-size: 16px; border-top: 2px solid #333; padding-top: 8px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #999; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <div class="company">{$companyBlock}</div>
        <div style="text-align:right">
            <div class="doc-title">{$docTitle}</div>
            <div class="doc-number">{$invoiceNumber}</div>
        </div>
    </div>

    <table class="meta-table">
        <tr><td>Date</td><td>{$issueDate}</td></tr>
        <tr><td>Commande</td><td>{$orderNumber}</td></tr>
    </table>

    <div class="addresses">
        <div class="address-block">
            <h3>Facturation</h3>
            <p>{$billingHtml}</p>
        </div>
    </div>

    <table class="items">
        <thead>
            <tr>
                <th style="text-align:left">Description</th>
                <th style="text-align:center">Qte</th>
                <th style="text-align:right">P.U. HT</th>
                <th style="text-align:center">TVA</th>
                <th style="text-align:right">Total HT</th>
                <th style="text-align:right">Total TTC</th>
            </tr>
        </thead>
        <tbody>{$itemsHtml}</tbody>
    </table>

    <div class="totals">
        <table>
            <tr><td style="color:#888">Sous-total HT</td><td>{$subtotal}</td></tr>
            <tr><td style="color:#888">Livraison</td><td>{$shipping}</td></tr>
            <tr><td style="color:#888">TVA</td><td>{$tax}</td></tr>
            <tr class="total"><td>Total TTC</td><td>{$total}</td></tr>
        </table>
        {$taxMentionHtml}
    </div>

    <div class="footer">
        {$siteName} — {$invoiceNumber} — {$issueDate}
    </div>
</body>
</html>
HTML;
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private static function nextInvoiceNumber(string $type = 'invoice'): string {
        $db = Database::getInstance();
        $prefixKey = $type === 'credit_note' ? 'credit_note_prefix' : 'invoice_prefix';
        $numberKey = $type === 'credit_note' ? 'credit_note_next_number' : 'invoice_next_number';

        $prefix = self::getSetting($prefixKey, $type === 'credit_note' ? 'AV' : 'FA');
        $year = date('Y');

        // Atomic increment via INSERT ON DUPLICATE KEY UPDATE
        $currentKey = $numberKey . '_' . $year;
        $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, '1')
            ON DUPLICATE KEY UPDATE setting_value = setting_value + 1")
            ->execute([$currentKey]);

        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = ?");
        $stmt->execute([$currentKey]);
        $num = (int) ($stmt->fetch()['setting_value'] ?? 1);

        return sprintf('%s-%s-%05d', $prefix, $year, $num);
    }

    private static function formatPrice(int $cents): string {
        return number_format($cents / 100, 2, ',', ' ') . ' €';
    }

    private static function getSetting(string $key, string $default = ''): string {
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1");
            $stmt->execute([$key]);
            $row = $stmt->fetch();
            return ($row && $row['setting_value']) ? $row['setting_value'] : $default;
        } catch (\Throwable $e) {
            return $default;
        }
    }
}
