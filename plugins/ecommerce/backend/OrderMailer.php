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
        $subject = "[Commande] {$order['order_number']} — {$d['total']} — {$d['siteName']}";
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
            'fulfilled' => 'Preparee',
            'shipped' => 'Expediee',
            'delivered' => 'Livree',
            'cancelled' => 'Annulee',
            'refunded' => 'Remboursee',
        ];
    }

    private static function paymentLabels(): array {
        return [
            'stripe' => 'Carte bancaire',
            'bank_transfer' => 'Virement bancaire',
            'on_invoice' => 'Sur facture',
            'paypal' => 'PayPal',
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
        ];
    }

    // ── Template wrapper ──────────────────────────────────────────────────

    private static function wrapTemplate(string $siteName, string $body): string {
        $primaryColor = self::getPrimaryColor();
        $frontendUrl = rtrim($_ENV['FRONTEND_URL'] ?? '', '/');
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
  </div>
  <div style="text-align:center;padding:20px;font-size:12px;color:#999">
    <p style="margin:0">{$siteName} &middot; <a href="{$frontendUrl}" style="color:#999">{$frontendUrl}</a></p>
  </div>
</div>
</body>
</html>
HTML;
    }

    // ── Templates ─────────────────────────────────────────────────────────

    private static function templateConfirmation(array $d): string {
        return self::wrapTemplate($d['siteName'], "
    <div style=\"text-align:center;margin-bottom:28px\">
      <div style=\"width:56px;height:56px;border-radius:50%;background:#e8f5e9;color:#2e7d32;display:inline-flex;align-items:center;justify-content:center;font-size:28px;line-height:1\">&#10003;</div>
      <h2 style=\"margin:16px 0 4px;font-size:22px;color:#222\">Commande confirmee</h2>
      <p style=\"margin:0;color:#666\">Merci pour votre commande <strong>{$d['orderNumber']}</strong></p>
    </div>

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
      <strong>Paiement :</strong> {$d['paymentLabel']}
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

    private static function templateAdminNotif(array $d): string {
        return self::wrapTemplate($d['siteName'], "
    <h2 style=\"margin:0 0 16px;font-size:20px;color:#222\">Nouvelle commande Payée</h2>
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

        return self::wrapTemplate($d['siteName'], "
    <div style=\"text-align:center;margin-bottom:28px\">
      <div style=\"width:56px;height:56px;border-radius:50%;background:#e3f2fd;color:#1565c0;display:inline-flex;align-items:center;justify-content:center;font-size:28px;line-height:1\">&#128230;</div>
      <h2 style=\"margin:16px 0 4px;font-size:22px;color:#222\">Votre commande a ete expediee</h2>
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

        return self::wrapTemplate($d['siteName'], "
    <div style=\"text-align:center;margin-bottom:28px\">
      <div style=\"width:56px;height:56px;border-radius:50%;background:{$bgColor};color:{$fgColor};display:inline-flex;align-items:center;justify-content:center;font-size:28px;line-height:1\">{$icon}</div>
      <h2 style=\"margin:16px 0 4px;font-size:22px;color:#222\">{$label}</h2>
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
