<?php

/**
 * OrderMailer — envoi d'emails transactionnels commande via Resend API.
 *
 * Emails :
 *   - sendOrderConfirmation(order)   → client (payment_succeeded)
 *   - sendAdminOrderNotif(order)     → destinataires admin configurables (payment_succeeded)
 *   - sendShipmentNotif(order)       → client (status → shipped)
 *   - sendRefundNotif(order, cents)  → client (admin refund)
 *
 * Destinataires admin : setting `ecommerce_notif_recipients` (JSON array d'emails).
 * From address : setting `ecommerce_emails_from` ou env RESEND_FROM_EMAIL.
 */
class OrderMailer {

    // ── Client: confirmation commande ──────────────────────────────────────

    public static function sendOrderConfirmation(array $order): void {
        if (empty($order['email'])) return;

        $d = self::buildOrderData($order);
        $subject = "Confirmation de commande {$order['order_number']} — {$d['siteName']}";
        $html = self::templateConfirmation($d);

        self::send($order['email'], $subject, $html);
    }

    // ── Admin: notification nouvelle commande payée ────────────────────────

    public static function sendAdminOrderNotif(array $order): void {
        $recipients = self::getAdminRecipients();
        if (empty($recipients)) return;

        $d = self::buildOrderData($order);
        $isPaid = ($order['payment_status'] ?? '') === 'paid';
        $prefix = $isPaid ? '[Commande Payee]' : '[Nouvelle commande]';
        $subject = "{$prefix} {$order['order_number']} — {$d['total']} — {$d['siteName']}";
        $html = self::templateAdminNotif($d);

        foreach ($recipients as $email) {
            self::send(trim($email), $subject, $html);
        }
    }

    // ── Client: notification expédition ────────────────────────────────────

    public static function sendShipmentNotif(array $order, ?string $trackingUrl = null): void {
        if (empty($order['email'])) return;

        $d = self::buildOrderData($order);
        $d['trackingUrl'] = $trackingUrl;
        $subject = "Votre commande {$order['order_number']} a ete expediee — {$d['siteName']}";
        $html = self::templateShipment($d);

        self::send($order['email'], $subject, $html);
    }

    // ── Client: notification remboursement ─────────────────────────────────

    public static function sendRefundNotif(array $order, int $amountCents, bool $isFull): void {
        if (empty($order['email'])) return;

        $d = self::buildOrderData($order);
        $d['refundAmount'] = self::formatPrice($amountCents);
        $d['isFull'] = $isFull;
        $subject = ($isFull ? 'Remboursement' : 'Remboursement partiel') . " — commande {$order['order_number']} — {$d['siteName']}";
        $html = self::templateRefund($d);

        self::send($order['email'], $subject, $html);
    }

    // ── Admin: notification remboursement ──────────────────────────────────

    public static function sendAdminRefundNotif(array $order, int $amountCents, bool $isFull): void {
        $recipients = self::getAdminRecipients();
        if (empty($recipients)) return;

        $d = self::buildOrderData($order);
        $label = $isFull ? 'Remboursement total' : 'Remboursement partiel';
        $subject = "[{$label}] {$order['order_number']} — " . self::formatPrice($amountCents) . " — {$d['siteName']}";
        $html = self::templateAdminRefund($d, $amountCents, $isFull);

        foreach ($recipients as $email) {
            self::send(trim($email), $subject, $html);
        }
    }

    // ── Client: notification changement statut (processing, delivered, cancelled) ──

    public static function sendClientStatusNotif(array $order, string $statusLabel, string $message, string $bgColor, string $fgColor): void {
        if (empty($order['email'])) return;
        $d = self::buildOrderData($order);
        $subject = "Commande {$order['order_number']} — {$statusLabel} — {$d['siteName']}";

        $html = self::wrapClientTemplate($d['siteName'], "
            <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom:28px\"><tr><td align=\"center\">
              <table cellpadding=\"0\" cellspacing=\"0\"><tr><td style=\"width:56px;height:56px;border-radius:50%;background:{$bgColor};color:{$fgColor};text-align:center;vertical-align:middle;font-size:28px;line-height:56px\">&#9679;</td></tr></table>
              <h2 style=\"margin:16px 0 4px;font-size:22px;color:#222\">{$statusLabel}</h2>
              <p style=\"margin:0;color:#666\">Commande <strong>{$d['orderNumber']}</strong></p>
            </td></tr></table>

            <div style=\"padding:16px;background:#fafafa;border-radius:8px;margin-bottom:20px;text-align:center;font-size:15px\">
              {$message}
            </div>

            <div style=\"text-align:center;margin-top:20px\">
              <a href=\"{$d['trackUrl']}\" style=\"display:inline-block;padding:10px 24px;background:{$d['primaryColor']};color:#fff;text-decoration:none;border-radius:6px;font-weight:600\">Voir ma commande</a>
            </div>
        ");

        self::send($order['email'], $subject, $html);
    }

    // ── Client: facture disponible ──────────────────────────────────────

    public static function buildInvoiceEmail(string $siteName, string $primaryColor, string $frontendUrl, string $invoiceNumber, string $orderNumber, string $total, string $downloadUrl): string {
        $icon = self::iconCircle('&#128196;', '#e8f5e9', '#2e7d32');
        return self::wrapClientTemplate($siteName, "
            <div style=\"text-align:center;margin-bottom:28px\">
              {$icon}
              <h2 style=\"margin:0 0 4px;font-size:22px;color:#222\">Votre facture est disponible</h2>
              <p style=\"margin:0;color:#666\">Commande <strong>{$orderNumber}</strong></p>
            </div>

            <div style=\"padding:16px;background:#fafafa;border-radius:8px;margin-bottom:20px;text-align:center\">
              <div style=\"font-size:14px;color:#666\">Facture n°</div>
              <div style=\"font-size:18px;font-weight:700;margin-top:4px\">{$invoiceNumber}</div>
              <div style=\"font-size:14px;color:#666;margin-top:8px\">Montant : <strong>{$total}</strong></div>
            </div>

            <div style=\"text-align:center;margin-top:24px\">
              <a href=\"{$downloadUrl}\" style=\"display:inline-block;padding:12px 28px;background:{$primaryColor};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px\">Telecharger ma facture</a>
            </div>

            <p style=\"text-align:center;color:#999;font-size:12px;margin-top:16px\">Vous pouvez egalement retrouver toutes vos factures dans votre espace client.</p>
        ");
    }

    // ── Admin: notification changement statut ─────────────────────────────

    public static function sendAdminStatusChange(array $order, string $from, string $to): void {
        $recipients = self::getAdminRecipients();
        if (empty($recipients)) return;

        $d = self::buildOrderData($order);
        $subject = "[Statut] {$order['order_number']} : {$from} → {$to} — {$d['siteName']}";

        $statusLabels = self::statusLabels();
        $fromLabel = $statusLabels[$from] ?? $from;
        $toLabel = $statusLabels[$to] ?? $to;

        $html = self::wrapTemplate($d['siteName'], "
            <h2 style=\"margin:0 0 16px;font-size:20px;color:#222\">Changement de statut</h2>
            <p>La commande <strong>{$d['orderNumber']}</strong> est passee de <strong>{$fromLabel}</strong> a <strong>{$toLabel}</strong>.</p>
            <table style=\"width:100%;border-collapse:collapse;margin:16px 0\">
                <tr><td style=\"padding:6px 0;color:#666\">Client</td><td>{$d['email']}</td></tr>
                <tr><td style=\"padding:6px 0;color:#666\">Total</td><td>{$d['total']}</td></tr>
                <tr><td style=\"padding:6px 0;color:#666\">Paiement</td><td>{$d['paymentLabel']}</td></tr>
            </table>
            <div style=\"text-align:center;margin-top:20px\">
                <a href=\"{$d['adminUrl']}\" style=\"display:inline-block;padding:10px 24px;background:{$d['primaryColor']};color:#fff;text-decoration:none;border-radius:6px;font-weight:600\">Voir dans l'admin</a>
            </div>
        ");

        foreach ($recipients as $email) {
            self::send(trim($email), $subject, $html);
        }
    }

    // ── Configurable recipients ────────────────────────────────────────────

    private static function getAdminRecipients(): array {
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'ecommerce_notif_recipients' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch();
            if ($row && $row['setting_value']) {
                $decoded = json_decode($row['setting_value'], true);
                if (is_array($decoded) && !empty($decoded)) {
                    return array_filter($decoded, function ($e) { return filter_var(trim($e), FILTER_VALIDATE_EMAIL); });
                }
                // Fallback: comma-separated string
                if (is_string($row['setting_value']) && str_contains($row['setting_value'], '@')) {
                    return array_filter(
                        array_map('trim', explode(',', $row['setting_value'])),
                        function ($e) { return filter_var($e, FILTER_VALIDATE_EMAIL); }
                    );
                }
            }
        } catch (\Throwable $e) {
            error_log('OrderMailer: getAdminRecipients failed: ' . $e->getMessage());
        }
        return [];
    }

    // ── Shared helpers ────────────────────────────────────────────────────

    private static function send(string $to, string $subject, string $html): void {
        $apiKey = $_ENV['RESEND_API_KEY'] ?? '';
        $from = self::getFromAddress();
        if (!$apiKey || !$from) {
            error_log("OrderMailer: RESEND_API_KEY ou from manquant — email non envoye ({$subject} → {$to})");
            return;
        }

        $payload = json_encode([
            'from' => $from,
            'to' => [$to],
            'subject' => $subject,
            'html' => $html,
        ], JSON_UNESCAPED_UNICODE);

        $ch = curl_init('https://api.resend.com/emails');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey,
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 400) {
            error_log("OrderMailer: Resend HTTP {$httpCode} — {$response}");
        }
    }

    private static function getFromAddress(): string {
        // Priority: DB setting > env ECOMMERCE_EMAILS_FROM > env RESEND_FROM_EMAIL
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'ecommerce_emails_from' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch();
            if ($row && $row['setting_value'] && filter_var($row['setting_value'], FILTER_VALIDATE_EMAIL)) {
                return $row['setting_value'];
            }
        } catch (\Throwable $e) {}
        return $_ENV['ECOMMERCE_EMAILS_FROM'] ?? $_ENV['RESEND_FROM_EMAIL'] ?? '';
    }

    private static function formatPrice(int $cents): string {
        return number_format($cents / 100, 2, ',', ' ') . ' &euro;';
    }

    private static function formatAddress(?array $addr): string {
        if (!$addr) return '';
        $lines = array_filter([
            trim(($addr['first_name'] ?? '') . ' ' . ($addr['last_name'] ?? '')),
            $addr['company'] ?? null,
            $addr['address_line1'] ?? null,
            $addr['address_line2'] ?? null,
            trim(($addr['postcode'] ?? '') . ' ' . ($addr['city'] ?? '')),
            $addr['country_code'] ?? null,
            $addr['phone'] ?? null,
        ]);
        return implode('<br>', array_map('htmlspecialchars', $lines));
    }

    private static function getSiteName(): string {
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'site_name' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch();
            return $row ? $row['setting_value'] : 'Boutique';
        } catch (\Throwable $e) {
            return 'Boutique';
        }
    }

    private static function getPrimaryColor(): string {
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'color_primary' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch();
            if ($row && $row['setting_value']) return $row['setting_value'];
        } catch (\Throwable $e) {}
        return '#1a1a2e';
    }

    private static function statusLabels(): array {
        return [
            'awaiting_payment' => 'En attente de paiement',
            'paid' => 'Payée',
            'processing' => 'En traitement',
            'shipped' => 'Expédiée',
            'delivered' => 'Livrée',
            'cancelled' => 'Annulée',
            'refunded' => 'Remboursée',
        ];
    }

    private static function paymentLabels(): array {
        return [
            'stripe' => 'Carte bancaire',
            'bank_transfer' => 'Virement bancaire',
            'on_invoice' => 'Sur facture',
            'paypal' => 'PayPal',
            'cheque' => 'Chèque',
        ];
    }

    private static function buildOrderData(array $order): array {
        $siteName = self::getSiteName();
        $frontendUrl = rtrim($_ENV['FRONTEND_URL'] ?? '', '/');
        $adminUrl = rtrim($_ENV['ADMIN_URL'] ?? $_ENV['BACKEND_URL'] ?? 'http://localhost:3000', '/') . '/admin';
        $primaryColor = self::getPrimaryColor();
        $paymentLabels = self::paymentLabels();

        $billing = $order['billing_address'] ?? [];
        if (is_string($billing)) $billing = json_decode($billing, true) ?: [];
        $shipping = $order['shipping_address'] ?? [];
        if (is_string($shipping)) $shipping = json_decode($shipping, true) ?: [];

        $items = $order['items'] ?? [];
        $itemsHtml = '';
        foreach ($items as $item) {
            $title = htmlspecialchars($item['product_title'] ?? '');
            $attrs = '';
            $va = $item['variant_attributes'] ?? [];
            if (is_string($va)) $va = json_decode($va, true) ?: [];
            if (!empty($va)) {
                $parts = [];
                foreach ($va as $k => $v) $parts[] = htmlspecialchars($k) . ' : ' . htmlspecialchars($v);
                $attrs = '<div style="font-size:12px;color:#888;margin-top:2px">' . implode(' &middot; ', $parts) . '</div>';
            }
            $qty = (int) $item['quantity'];
            $total = self::formatPrice((int) $item['line_total_cents']);
            $itemsHtml .= "<tr>
                <td style=\"padding:10px 12px;border-bottom:1px solid #f0f0f0\">{$title}{$attrs}</td>
                <td style=\"padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center\">{$qty}</td>
                <td style=\"padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right\">{$total}</td>
            </tr>";
        }

        $trackUrl = $frontendUrl . '/commande/confirmation?order=' . $order['id'];
        if (!empty($order['guest_token'])) {
            $trackUrl .= '&guest_token=' . urlencode($order['guest_token']);
        }

        return [
            'siteName' => $siteName,
            'frontendUrl' => $frontendUrl,
            'adminUrl' => $adminUrl,
            'primaryColor' => $primaryColor,
            'orderNumber' => htmlspecialchars($order['order_number'] ?? ''),
            'email' => htmlspecialchars($order['email'] ?? ''),
            'itemsHtml' => $itemsHtml,
            'subtotal' => self::formatPrice((int) ($order['subtotal_cents'] ?? 0)),
            'shipping' => self::formatPrice((int) ($order['shipping_cents'] ?? 0)),
            'tax' => self::formatPrice((int) ($order['tax_cents'] ?? 0)),
            'total' => self::formatPrice((int) ($order['total_cents'] ?? 0)),
            'totalCents' => (int) ($order['total_cents'] ?? 0),
            'paymentLabel' => $paymentLabels[$order['payment_method'] ?? ''] ?? ($order['payment_method'] ?? ''),
            'shippingAddress' => self::formatAddress($shipping),
            'billingAddress' => self::formatAddress($billing),
            'shippingMethod' => htmlspecialchars($order['shipping_method_label'] ?? ''),
            'trackUrl' => $trackUrl,
            'billingName' => trim(($billing['first_name'] ?? '') . ' ' . ($billing['last_name'] ?? '')),
            'paymentMethod' => $order['payment_method'] ?? '',
            'paymentStatus' => $order['payment_status'] ?? '',
        ];
    }

    // ── Template wrappers ─────────────────────────────────────────────────

    /** Wrap for admin emails (no help section). */
    private static function wrapTemplate(string $siteName, string $body): string {
        $primaryColor = self::getPrimaryColor();
        $frontendUrl = rtrim($_ENV['FRONTEND_URL'] ?? '', '/');
        return self::baseWrap($siteName, $primaryColor, $frontendUrl, $body, false);
    }

    /** Wrap for client emails (with help section). */
    private static function wrapClientTemplate(string $siteName, string $body): string {
        $primaryColor = self::getPrimaryColor();
        $frontendUrl = rtrim($_ENV['FRONTEND_URL'] ?? '', '/');
        return self::baseWrap($siteName, $primaryColor, $frontendUrl, $body, true);
    }

    private static function baseWrap(string $siteName, string $primaryColor, string $frontendUrl, string $body, bool $showHelp): string {
        $helpBlock = '';
        if ($showHelp) {
            $contactEmail = self::getContactSetting('contact_email');
            $contactPhone = self::getContactSetting('contact_phone');
            if ($contactEmail || $contactPhone) {
                $lines = [];
                if ($contactEmail) $lines[] = "Email : <a href=\"mailto:{$contactEmail}\" style=\"color:{$primaryColor};text-decoration:none\">{$contactEmail}</a>";
                if ($contactPhone) $lines[] = "Tel : <a href=\"tel:{$contactPhone}\" style=\"color:{$primaryColor};text-decoration:none\">{$contactPhone}</a>";
                $helpBlock = "
                <div style=\"margin-top:32px;padding:20px;background:#fafafa;border-radius:8px;text-align:center\">
                  <h3 style=\"margin:0 0 8px;font-size:15px;color:#333\">Besoin d'aide ?</h3>
                  <p style=\"margin:0;font-size:14px;color:#666;line-height:1.8\">" . implode('<br>', $lines) . "</p>
                </div>";
            }
        }
        return <<<HTML
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333;font-size:15px;line-height:1.6">
<div style="max-width:600px;margin:0 auto;padding:20px">
  <div style="background:{$primaryColor};color:#fff;padding:24px 32px;border-radius:8px 8px 0 0;text-align:center">
    <h1 style="margin:0;font-size:20px;font-weight:600;letter-spacing:0.5px">{$siteName}</h1>
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 8px 8px">
    {$body}
    {$helpBlock}
  </div>
  <div style="text-align:center;padding:20px;font-size:12px;color:#999">
    <p style="margin:0">{$siteName} &middot; <a href="{$frontendUrl}" style="color:#999">{$frontendUrl}</a></p>
  </div>
</div>
</body>
</html>
HTML;
    }

    private static function getContactSetting(string $key): string {
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1");
            $stmt->execute([$key]);
            $row = $stmt->fetch();
            return ($row && $row['setting_value']) ? htmlspecialchars($row['setting_value']) : '';
        } catch (\Throwable $e) { return ''; }
    }

    // ── Templates ─────────────────────────────────────────────────────────

    /** Helper: table-based centered icon circle (email-safe, no flexbox). */
    private static function iconCircle(string $char, string $bg, string $fg): string {
        return "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin-bottom:16px\"><tr><td align=\"center\">
            <table cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td width=\"56\" height=\"56\" style=\"width:56px;height:56px;border-radius:50%;background:{$bg};color:{$fg};text-align:center;vertical-align:middle;font-size:28px;line-height:56px;font-family:Arial,sans-serif\">{$char}</td></tr></table>
        </td></tr></table>";
    }

    private static function templateConfirmation(array $d): string {
        $isPaid = $d['paymentStatus'] === 'paid';
        $isBankTransfer = $d['paymentMethod'] === 'bank_transfer';
        $isCheque = $d['paymentMethod'] === 'cheque';
        $isOffline = in_array($d['paymentMethod'], ['bank_transfer', 'cheque', 'on_invoice'], true);

        $heroTitle = $isPaid ? 'Commande confirmee' : 'Commande enregistree';
        $heroSubtitle = $isPaid
            ? "Merci pour votre commande <strong>{$d['orderNumber']}</strong>"
            : "Votre commande <strong>{$d['orderNumber']}</strong> a bien ete enregistree";
        $heroIcon = self::iconCircle($isPaid ? '&#10003;' : '&#128230;', $isPaid ? '#e8f5e9' : '#fff8e1', $isPaid ? '#2e7d32' : '#b28900');

        // Bank transfer instructions with IBAN from settings
        $bankBlock = '';
        if ($isBankTransfer && !$isPaid) {
            $iban = self::getBankSetting('bank_iban');
            $bic = self::getBankSetting('bank_bic');
            $bankName = self::getBankSetting('bank_account_name') ?: $d['siteName'];
            $bankBlock = "
            <div style=\"padding:16px 20px;background:#fff8e1;border:1px solid #ffe082;border-radius:8px;margin-bottom:24px\">
              <h3 style=\"margin:0 0 10px;font-size:16px;color:#795548\">Instructions de virement</h3>
              <p style=\"margin:0 0 10px;font-size:14px\">Effectuez le virement de <strong>{$d['total']}</strong> en mentionnant la reference <strong>{$d['orderNumber']}</strong>.</p>"
              . ($iban ? "<table style=\"border-collapse:collapse;margin-bottom:10px;font-size:14px\">
                <tr><td style=\"padding:4px 12px 4px 0;color:#666;font-weight:600\">Titulaire</td><td>{$bankName}</td></tr>
                <tr><td style=\"padding:4px 12px 4px 0;color:#666;font-weight:600\">IBAN</td><td style=\"font-family:monospace;letter-spacing:1px\">{$iban}</td></tr>"
                . ($bic ? "<tr><td style=\"padding:4px 12px 4px 0;color:#666;font-weight:600\">BIC</td><td style=\"font-family:monospace\">{$bic}</td></tr>" : '')
                . "</table>" : '')
              . "<p style=\"margin:0;font-size:13px;color:#888\">Votre commande sera traitee a reception du virement.</p>
            </div>";
        }
        if ($isCheque && !$isPaid) {
            $chequeAddress = self::getBankSetting('cheque_address') ?: '';
            $bankBlock = "
            <div style=\"padding:16px 20px;background:#fff8e1;border:1px solid #ffe082;border-radius:8px;margin-bottom:24px\">
              <h3 style=\"margin:0 0 10px;font-size:16px;color:#795548\">Paiement par cheque</h3>
              <p style=\"margin:0 0 10px;font-size:14px\">Etablissez un cheque de <strong>{$d['total']}</strong> a l'ordre de <strong>{$d['siteName']}</strong> en indiquant la reference <strong>{$d['orderNumber']}</strong> au dos.</p>"
              . ($chequeAddress ? "<p style=\"margin:0 0 10px;font-size:14px\">Adresse d'envoi :<br><strong>" . nl2br(htmlspecialchars($chequeAddress)) . "</strong></p>" : '')
              . "<p style=\"margin:0;font-size:13px;color:#888\">Votre commande sera traitee a reception du cheque.</p>
            </div>";
        }

        return self::wrapClientTemplate($d['siteName'], "
    <div style=\"text-align:center;margin-bottom:28px\">
      {$heroIcon}
      <h2 style=\"margin:0 0 4px;font-size:22px;color:#222\">{$heroTitle}</h2>
      <p style=\"margin:0;color:#666\">{$heroSubtitle}</p>
    </div>

    {$bankBlock}

    <table style=\"width:100%;border-collapse:collapse;margin-bottom:20px\">
      <thead><tr style=\"background:#fafafa\">
        <th style=\"padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#888;border-bottom:2px solid #eee\">Article</th>
        <th style=\"padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;color:#888;border-bottom:2px solid #eee\">Qte</th>
        <th style=\"padding:10px 12px;text-align:right;font-size:12px;text-transform:uppercase;color:#888;border-bottom:2px solid #eee\">Total</th>
      </tr></thead>
      <tbody>{$d['itemsHtml']}</tbody>
    </table>

    <table style=\"width:100%;border-collapse:collapse;margin-bottom:24px\">
      <tr><td style=\"padding:6px 12px;color:#666\">Sous-total HT</td><td style=\"padding:6px 12px;text-align:right\">{$d['subtotal']}</td></tr>
      <tr><td style=\"padding:6px 12px;color:#666\">Livraison</td><td style=\"padding:6px 12px;text-align:right\">{$d['shipping']}</td></tr>
      <tr><td style=\"padding:6px 12px;color:#666\">TVA</td><td style=\"padding:6px 12px;text-align:right\">{$d['tax']}</td></tr>
      <tr style=\"border-top:2px solid #eee\">
        <td style=\"padding:12px 12px 6px;font-weight:700;font-size:16px\">Total TTC</td>
        <td style=\"padding:12px 12px 6px;text-align:right;font-weight:700;font-size:16px\">{$d['total']}</td>
      </tr>
    </table>

    <div style=\"padding:10px 14px;background:#fafafa;border-radius:6px;font-size:14px;margin-bottom:24px\">
      <strong>Paiement :</strong> {$d['paymentLabel']}" . ($isOffline && !$isPaid ? " — <em>En attente</em>" : '') . "
    </div>

    <table style=\"width:100%;border-collapse:collapse;margin-bottom:24px\">
      <tr>
        <td style=\"width:50%;vertical-align:top;padding-right:12px\">
          <h3 style=\"margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#888;letter-spacing:0.5px\">Livraison</h3>
          <div style=\"padding:12px;background:#fafafa;border-radius:6px;font-size:14px;line-height:1.6\">{$d['shippingAddress']}</div>
          <div style=\"margin-top:6px;font-size:13px;color:#888\">{$d['shippingMethod']}</div>
        </td>
        <td style=\"width:50%;vertical-align:top;padding-left:12px\">
          <h3 style=\"margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#888;letter-spacing:0.5px\">Facturation</h3>
          <div style=\"padding:12px;background:#fafafa;border-radius:6px;font-size:14px;line-height:1.6\">{$d['billingAddress']}</div>
        </td>
      </tr>
    </table>

    <div style=\"text-align:center;margin-top:28px\">
      <a href=\"{$d['trackUrl']}\" style=\"display:inline-block;padding:12px 28px;background:{$d['primaryColor']};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px\">Suivre ma commande</a>
    </div>
        ");
    }

    private static function getBankSetting(string $key): string {
        static $encrypted = ['bank_iban', 'bank_bic'];
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1");
            $stmt->execute([$key]);
            $row = $stmt->fetch();
            if (!$row || !$row['setting_value']) return '';
            if (in_array($key, $encrypted, true) && function_exists('decrypt_value')) {
                return decrypt_value($row['setting_value']);
            }
            return $row['setting_value'];
        } catch (\Throwable $e) { return ''; }
    }

    private static function templateAdminNotif(array $d): string {
        $isPaid = $d['paymentStatus'] === 'paid';
        $title = $isPaid ? 'Nouvelle commande payee' : 'Nouvelle commande — en attente de paiement';
        return self::wrapTemplate($d['siteName'], "
    <h2 style=\"margin:0 0 16px;font-size:20px;color:#222\">{$title}</h2>
    <table style=\"width:100%;border-collapse:collapse;margin-bottom:16px\">
      <tr><td style=\"padding:8px 0;color:#666;width:140px\">N° commande</td><td style=\"font-weight:600\">{$d['orderNumber']}</td></tr>
      <tr><td style=\"padding:8px 0;color:#666\">Client</td><td>{$d['billingName']} ({$d['email']})</td></tr>
      <tr><td style=\"padding:8px 0;color:#666\">Total TTC</td><td style=\"font-weight:700;font-size:16px\">{$d['total']}</td></tr>
      <tr><td style=\"padding:8px 0;color:#666\">Paiement</td><td>{$d['paymentLabel']}</td></tr>
      <tr><td style=\"padding:8px 0;color:#666\">Livraison</td><td>{$d['shippingMethod']}</td></tr>
    </table>

    <h3 style=\"margin:16px 0 8px;font-size:14px;text-transform:uppercase;color:#888\">Articles</h3>
    <table style=\"width:100%;border-collapse:collapse;margin-bottom:20px\">
      <thead><tr style=\"background:#fafafa\">
        <th style=\"padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#888;border-bottom:2px solid #eee\">Article</th>
        <th style=\"padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#888;border-bottom:2px solid #eee\">Qte</th>
        <th style=\"padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#888;border-bottom:2px solid #eee\">Total</th>
      </tr></thead>
      <tbody>{$d['itemsHtml']}</tbody>
    </table>

    <table style=\"width:100%;border-collapse:collapse;margin-bottom:16px\">
      <tr><td style=\"padding:4px 0;color:#666\">Adresse livraison</td><td>{$d['shippingAddress']}</td></tr>
    </table>

    <div style=\"text-align:center;margin-top:20px\">
      <a href=\"{$d['adminUrl']}\" style=\"display:inline-block;padding:10px 24px;background:{$d['primaryColor']};color:#fff;text-decoration:none;border-radius:6px;font-weight:600\">Voir dans l'admin</a>
    </div>
        ");
    }

    private static function templateShipment(array $d): string {
        $trackingBlock = '';
        if (!empty($d['trackingUrl'])) {
            $trackingBlock = "<div style=\"text-align:center;margin:20px 0\">
                <a href=\"{$d['trackingUrl']}\" style=\"display:inline-block;padding:10px 24px;background:{$d['primaryColor']};color:#fff;text-decoration:none;border-radius:6px;font-weight:600\">Suivre mon colis</a>
            </div>";
        }

        $icon = self::iconCircle('&#128230;', '#e3f2fd', '#1565c0');
        return self::wrapClientTemplate($d['siteName'], "
    <div style=\"text-align:center;margin-bottom:28px\">
      {$icon}
      <h2 style=\"margin:0 0 4px;font-size:22px;color:#222\">Votre commande a ete expediee</h2>
      <p style=\"margin:0;color:#666\">Commande <strong>{$d['orderNumber']}</strong></p>
    </div>

    <div style=\"padding:16px;background:#fafafa;border-radius:8px;margin-bottom:20px\">
      <div style=\"font-size:14px\"><strong>Livraison :</strong> {$d['shippingMethod']}</div>
      <div style=\"font-size:14px;margin-top:8px\">{$d['shippingAddress']}</div>
    </div>

    {$trackingBlock}

    <div style=\"text-align:center;margin-top:20px\">
      <a href=\"{$d['trackUrl']}\" style=\"display:inline-block;padding:10px 24px;background:{$d['primaryColor']};color:#fff;text-decoration:none;border-radius:6px;font-weight:600\">Voir ma commande</a>
    </div>
        ");
    }

    private static function templateRefund(array $d): string {
        $label = $d['isFull'] ? 'Remboursement total' : 'Remboursement partiel';
        $icon = $d['isFull'] ? '&#8617;' : '&#8617;';
        $bgColor = $d['isFull'] ? '#fce4ec' : '#fff3e0';
        $fgColor = $d['isFull'] ? '#c62828' : '#e65100';

        $iconHtml = self::iconCircle($icon, $bgColor, $fgColor);
        return self::wrapClientTemplate($d['siteName'], "
    <div style=\"text-align:center;margin-bottom:28px\">
      {$iconHtml}
      <h2 style=\"margin:0 0 4px;font-size:22px;color:#222\">{$label}</h2>
      <p style=\"margin:0;color:#666\">Commande <strong>{$d['orderNumber']}</strong></p>
    </div>

    <div style=\"padding:16px;background:#fafafa;border-radius:8px;margin-bottom:20px;text-align:center\">
      <div style=\"font-size:14px;color:#666\">Montant rembourse</div>
      <div style=\"font-size:24px;font-weight:700;margin-top:4px\">{$d['refundAmount']}</div>
    </div>

    <p style=\"color:#666;font-size:14px;text-align:center\">Le remboursement sera visible sur votre releve bancaire sous 5 a 10 jours ouvrables.</p>

    <div style=\"text-align:center;margin-top:20px\">
      <a href=\"{$d['trackUrl']}\" style=\"display:inline-block;padding:10px 24px;background:{$d['primaryColor']};color:#fff;text-decoration:none;border-radius:6px;font-weight:600\">Voir ma commande</a>
    </div>
        ");
    }

    // ── Client: notification projet sauvegardé ──────────────────────────

    public static function sendProjectSaved(string $email, string $firstName, string $token, string $projectLabel): void {
        if (empty($email)) return;
        $siteName = self::getSiteName();
        $primaryColor = self::getPrimaryColor();
        $frontend = rtrim($_ENV['FRONTEND_URL'] ?? '', '/');
        $projectUrl = "{$frontend}/configurateur?p={$token}";
        $name = htmlspecialchars($firstName ?: 'Bonjour');
        $label = htmlspecialchars($projectLabel);

        $iconHtml = self::iconCircle('&#128190;', '#e8f5e9', '#2e7d32');
        $html = self::wrapClientTemplate($siteName, "
            <div style=\"text-align:center;margin-bottom:28px\">
              {$iconHtml}
              <h2 style=\"margin:0 0 4px;font-size:22px;color:#222\">Projet sauvegarde</h2>
              <p style=\"margin:0;color:#666\">Bonjour {$name}, votre projet <strong>{$label}</strong> a ete sauvegarde.</p>
            </div>
            <p style=\"color:#555;text-align:center\">Vous pouvez retrouver votre configuration a tout moment via le lien ci-dessous :</p>
            <div style=\"text-align:center;margin:24px 0\">
              <a href=\"{$projectUrl}\" style=\"display:inline-block;padding:12px 28px;background:{$primaryColor};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px\">Reprendre mon projet</a>
            </div>
            <p style=\"color:#999;font-size:12px;text-align:center\">Reference : {$token}</p>
        ");

        self::send($email, "Votre projet a ete sauvegarde — {$siteName}", $html);
    }

    // ── Client: rappel echeance SEPA ──────────────────────────────────────

    public static function sendSepaReminder(string $email, string $firstName, string $orderNumber, int $amountCents, string $dueDate): void {
        if (empty($email)) return;
        $siteName = self::getSiteName();
        $primaryColor = self::getPrimaryColor();
        $frontend = rtrim($_ENV['FRONTEND_URL'] ?? '', '/');
        $name = htmlspecialchars($firstName ?: 'Bonjour');
        $amount = self::formatPrice($amountCents);
        $date = htmlspecialchars($dueDate);

        $iconHtml = self::iconCircle('&#128197;', '#fff3e0', '#e65100');
        $html = self::wrapClientTemplate($siteName, "
            <div style=\"text-align:center;margin-bottom:28px\">
              {$iconHtml}
              <h2 style=\"margin:0 0 4px;font-size:22px;color:#222\">Echeance de prelevement</h2>
            </div>
            <p style=\"text-align:center;color:#555\">Bonjour {$name},</p>
            <p style=\"text-align:center;color:#555\">Un prelevement SEPA de <strong>{$amount}</strong> pour la commande <strong>{$orderNumber}</strong> sera effectue le <strong>{$date}</strong>.</p>
            <div style=\"padding:16px;background:#fafafa;border-radius:8px;margin:20px 0;text-align:center\">
              <div style=\"font-size:14px;color:#666\">Montant</div>
              <div style=\"font-size:22px;font-weight:700;margin-top:4px\">{$amount}</div>
              <div style=\"font-size:13px;color:#888;margin-top:4px\">Date de prelevement : {$date}</div>
            </div>
            <p style=\"color:#666;font-size:14px;text-align:center\">Veuillez vous assurer que votre compte bancaire est suffisamment approvisionne.</p>
            <div style=\"text-align:center;margin-top:24px\">
              <a href=\"{$frontend}/compte/paiement\" style=\"display:inline-block;padding:10px 24px;background:{$primaryColor};color:#fff;text-decoration:none;border-radius:6px;font-weight:600\">Mon espace paiement</a>
            </div>
        ");

        self::send($email, "Echeance de prelevement — commande {$orderNumber} — {$siteName}", $html);
    }

    // ── Admin: recap commande atelier ─────────────────────────────────────

    public static function sendWorkshopRecap(array $order, array $workshopRecipients): void {
        if (empty($workshopRecipients)) return;
        $d = self::buildOrderData($order);
        $subject = "[Atelier] Commande {$order['order_number']} — {$d['siteName']}";

        $html = self::wrapTemplate($d['siteName'], "
            <h2 style=\"margin:0 0 16px;font-size:20px;color:#222\">Nouvelle commande a preparer</h2>
            <table style=\"width:100%;border-collapse:collapse;margin-bottom:16px\">
              <tr><td style=\"padding:8px 0;color:#666;width:140px\">N° commande</td><td style=\"font-weight:600\">{$d['orderNumber']}</td></tr>
              <tr><td style=\"padding:8px 0;color:#666\">Client</td><td>{$d['billingName']} ({$d['email']})</td></tr>
              <tr><td style=\"padding:8px 0;color:#666\">Livraison</td><td>{$d['shippingMethod']}</td></tr>
            </table>

            <h3 style=\"margin:16px 0 8px;font-size:14px;text-transform:uppercase;color:#888\">Articles a preparer</h3>
            <table style=\"width:100%;border-collapse:collapse;margin-bottom:20px\">
              <thead><tr style=\"background:#fafafa\">
                <th style=\"padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#888;border-bottom:2px solid #eee\">Article</th>
                <th style=\"padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#888;border-bottom:2px solid #eee\">Qte</th>
              </tr></thead>
              <tbody>{$d['itemsHtml']}</tbody>
            </table>

            <table style=\"width:100%;border-collapse:collapse;margin-bottom:16px\">
              <tr><td style=\"padding:4px 0;color:#666\">Adresse livraison</td><td>{$d['shippingAddress']}</td></tr>
            </table>
        ");

        foreach ($workshopRecipients as $email) {
            self::send(trim($email), $subject, $html);
        }
    }

    private static function templateAdminRefund(array $d, int $amountCents, bool $isFull): string {
        $label = $isFull ? 'Remboursement total' : 'Remboursement partiel';
        return self::wrapTemplate($d['siteName'], "
    <h2 style=\"margin:0 0 16px;font-size:20px;color:#222\">{$label}</h2>
    <table style=\"width:100%;border-collapse:collapse;margin-bottom:16px\">
      <tr><td style=\"padding:8px 0;color:#666;width:140px\">Commande</td><td style=\"font-weight:600\">{$d['orderNumber']}</td></tr>
      <tr><td style=\"padding:8px 0;color:#666\">Client</td><td>{$d['billingName']} ({$d['email']})</td></tr>
      <tr><td style=\"padding:8px 0;color:#666\">Montant rembourse</td><td style=\"font-weight:700;font-size:16px\">" . self::formatPrice($amountCents) . "</td></tr>
      <tr><td style=\"padding:8px 0;color:#666\">Total commande</td><td>{$d['total']}</td></tr>
    </table>
    <div style=\"text-align:center;margin-top:20px\">
      <a href=\"{$d['adminUrl']}\" style=\"display:inline-block;padding:10px 24px;background:{$d['primaryColor']};color:#fff;text-decoration:none;border-radius:6px;font-weight:600\">Voir dans l'admin</a>
    </div>
        ");
    }
}
