<?php
/**
 * OrderAdminController — gestion des commandes côté admin.
 *
 * Routes :
 *   GET  /admin/orders                  (filtres : status, payment_status, email, date_from, date_to, page, per_page)
 *   GET  /admin/orders/:id              (détail complet + events)
 *   PUT  /admin/orders/:id              { status?, notes? }
 *   POST /admin/orders/:id/refund       { amount_cents?, reason? }   (Stripe refund total ou partiel)
 */
class OrderAdminController {

    /** Liste paginée + filtrable des commandes. */
    public static function listAll(): void {
        $db = Database::getInstance();

        $where = ['1 = 1'];
        $params = [];

        if (!empty($_GET['status'])) {
            $where[] = 'o.status = ?';
            $params[] = $_GET['status'];
        }
        if (!empty($_GET['payment_status'])) {
            $where[] = 'o.payment_status = ?';
            $params[] = $_GET['payment_status'];
        }
        if (!empty($_GET['email'])) {
            $where[] = 'o.email LIKE ?';
            $params[] = '%' . $_GET['email'] . '%';
        }
        if (!empty($_GET['q'])) {
            $where[] = '(o.order_number LIKE ? OR o.email LIKE ? OR o.billing_address LIKE ?)';
            $term = '%' . $_GET['q'] . '%';
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
        }
        if (!empty($_GET['date_from'])) {
            $where[] = 'o.placed_at >= ?';
            $params[] = $_GET['date_from'] . ' 00:00:00';
        }
        if (!empty($_GET['date_to'])) {
            $where[] = 'o.placed_at <= ?';
            $params[] = $_GET['date_to'] . ' 23:59:59';
        }

        $whereStr = implode(' AND ', $where);

        // Count
        $stmt = $db->prepare("SELECT COUNT(*) AS total FROM orders o WHERE {$whereStr}");
        $stmt->execute($params);
        $total = (int) $stmt->fetch()['total'];

        // Paginate
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($_GET['per_page'] ?? 25)));
        $offset = ($page - 1) * $perPage;

        $sort = $_GET['sort'] ?? 'placed_at';
        $allowedSort = ['placed_at', 'total_cents', 'status', 'order_number'];
        if (!in_array($sort, $allowedSort, true)) $sort = 'placed_at';
        $dir = strtoupper($_GET['dir'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

        $stmt = $db->prepare("
            SELECT o.id, o.order_number, o.email, o.status, o.payment_status, o.payment_method,
                   o.currency, o.subtotal_cents, o.discount_cents, o.shipping_cents, o.tax_cents, o.total_cents,
                   o.coupon_code, o.shipping_method_label, o.placed_at, o.paid_at, o.shipped_at, o.delivered_at,
                   o.customer_id, o.billing_address, o.shipping_address
            FROM orders o
            WHERE {$whereStr}
            ORDER BY o.{$sort} {$dir}
            LIMIT {$perPage} OFFSET {$offset}
        ");
        $stmt->execute($params);
        $orders = $stmt->fetchAll();

        foreach ($orders as &$o) {
            $o['billing_address'] = $o['billing_address'] ? (is_string($o['billing_address']) ? json_decode($o['billing_address'], true) : $o['billing_address']) : null;
            $o['shipping_address'] = $o['shipping_address'] ? (is_string($o['shipping_address']) ? json_decode($o['shipping_address'], true) : $o['shipping_address']) : null;
        }
        unset($o);

        json_response([
            'orders' => $orders,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'pages' => (int) ceil($total / $perPage),
        ]);
    }

    /** Détail complet d'une commande + items + events. */
    public static function getById(int $id): void {
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$id]);
        $order = $stmt->fetch();
        if (!$order) error_response('Commande introuvable', 404);

        // Items
        $stmt = $db->prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC');
        $stmt->execute([$id]);
        $items = $stmt->fetchAll();
        foreach ($items as &$it) {
            $it['variant_attributes'] = $it['variant_attributes'] ? (is_string($it['variant_attributes']) ? json_decode($it['variant_attributes'], true) : $it['variant_attributes']) : [];
        }
        unset($it);

        // Events (audit_log)
        $stmt = $db->prepare("SELECT id, event_type, provider, payload, actor_type, created_at FROM audit_log WHERE entity_type = 'order' AND entity_id = ? ORDER BY created_at ASC");
        $stmt->execute([$id]);
        $events = $stmt->fetchAll();
        foreach ($events as &$ev) {
            $ev['payload'] = $ev['payload'] ? (is_string($ev['payload']) ? json_decode($ev['payload'], true) : $ev['payload']) : null;
        }
        unset($ev);

        // Customer info
        $customer = null;
        if ($order['customer_id']) {
            $stmt = $db->prepare('SELECT id, email, first_name, last_name, company, phone, is_pro, pro_status FROM customers WHERE id = ?');
            $stmt->execute([$order['customer_id']]);
            $customer = $stmt->fetch() ?: null;
        }

        // Payment intents
        $stmt = $db->prepare("SELECT id, provider, provider_intent_id, amount_cents, currency, status, payment_method_type, created_at FROM payment_intents WHERE order_id = ? ORDER BY id DESC");
        $stmt->execute([$id]);
        $payments = $stmt->fetchAll();

        // Decode JSON fields
        $order['billing_address'] = $order['billing_address'] ? (is_string($order['billing_address']) ? json_decode($order['billing_address'], true) : $order['billing_address']) : null;
        $order['shipping_address'] = $order['shipping_address'] ? (is_string($order['shipping_address']) ? json_decode($order['shipping_address'], true) : $order['shipping_address']) : null;
        $order['tax_breakdown'] = $order['tax_breakdown'] ? (is_string($order['tax_breakdown']) ? json_decode($order['tax_breakdown'], true) : $order['tax_breakdown']) : [];

        $order['items'] = $items;
        $order['events'] = $events;
        $order['customer'] = $customer;
        $order['payments'] = $payments;

        json_response($order);
    }

    /** MAJ statut + ajout note interne. */
    public static function update(int $id): void {
        $db = Database::getInstance();
        $body = get_json_body();

        $stmt = $db->prepare('SELECT id, status FROM orders WHERE id = ?');
        $stmt->execute([$id]);
        $order = $stmt->fetch();
        if (!$order) error_response('Commande introuvable', 404);

        $fields = [];
        $values = [];

        if (isset($body['status'])) {
            $allowed = ['awaiting_payment', 'paid', 'processing', 'fulfilled', 'shipped', 'delivered', 'cancelled', 'refunded'];
            if (!in_array($body['status'], $allowed, true)) {
                error_response('Statut invalide', 400);
            }
            $fields[] = 'status = ?';
            $values[] = $body['status'];

            // Auto-set timestamp fields
            if ($body['status'] === 'shipped' && empty($order['shipped_at'])) {
                $fields[] = 'shipped_at = NOW()';
            }
            if ($body['status'] === 'delivered' && empty($order['delivered_at'])) {
                $fields[] = 'delivered_at = NOW()';
            }
        }

        if (!empty($fields)) {
            $values[] = $id;
            $stmt = $db->prepare('UPDATE orders SET ' . implode(', ', $fields) . ' WHERE id = ?');
            $stmt->execute($values);
        }

        // Note interne → audit_log
        $note = trim((string) ($body['note'] ?? ''));
        if ($note !== '') {
            $user = authenticate_token();
            $stmt = $db->prepare('INSERT INTO audit_log (entity_type, entity_id, event_type, payload, actor_type, actor_id) VALUES ("order", ?, "admin_note", ?, "admin", ?)');
            $stmt->execute([$id, json_encode(['note' => $note, 'status_change' => $body['status'] ?? null], JSON_UNESCAPED_UNICODE), $user['id'] ?? null]);
        } elseif (isset($body['status'])) {
            $user = authenticate_token();
            $stmt = $db->prepare('INSERT INTO audit_log (entity_type, entity_id, event_type, payload, actor_type, actor_id) VALUES ("order", ?, "status_changed", ?, "admin", ?)');
            $stmt->execute([$id, json_encode(['from' => $order['status'], 'to' => $body['status']], JSON_UNESCAPED_UNICODE), $user['id'] ?? null]);
        }

        // Email notifications on status change
        if (isset($body['status']) && $body['status'] !== $order['status']) {
            try {
                $fullOrder = self::loadFullOrder($id);
                if ($fullOrder) {
                    // Client: shipment notification
                    if ($body['status'] === 'shipped') {
                        OrderMailer::sendShipmentNotif($fullOrder, $body['tracking_url'] ?? null);
                    }
                    // Admin: all status changes
                    OrderMailer::sendAdminStatusChange($fullOrder, $order['status'], $body['status']);
                }
            } catch (\Throwable $e) {
                error_log('OrderMailer status change error: ' . $e->getMessage());
            }
        }

        json_response(['message' => 'Commande mise à jour']);
    }

    /** Remboursement Stripe (total ou partiel). */
    public static function refund(int $id): void {
        $db = Database::getInstance();
        $body = get_json_body();

        $stmt = $db->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$id]);
        $order = $stmt->fetch();
        if (!$order) error_response('Commande introuvable', 404);

        if ($order['payment_method'] !== 'stripe') {
            error_response('Remboursement automatique disponible uniquement pour les paiements Stripe', 400);
        }
        if (!in_array($order['payment_status'], ['paid', 'partially_refunded'], true)) {
            error_response('Commande non remboursable (statut paiement : ' . $order['payment_status'] . ')', 400);
        }

        // Find the successful payment intent
        $stmt = $db->prepare("SELECT provider_intent_id FROM payment_intents WHERE order_id = ? AND provider = 'stripe' AND status = 'succeeded' ORDER BY id DESC LIMIT 1");
        $stmt->execute([$id]);
        $pi = $stmt->fetch();
        if (!$pi) error_response('Aucun paiement Stripe trouvé pour cette commande', 404);

        $amountCents = isset($body['amount_cents']) ? (int) $body['amount_cents'] : (int) $order['total_cents'];
        if ($amountCents <= 0) error_response('Montant invalide', 400);

        $sk = EcommerceSettingsController::getStripeKey('sk');
        if (!$sk) error_response('Stripe non configuré', 500);

        try {
            \Stripe\Stripe::setApiKey($sk);
            \Stripe\Stripe::setApiVersion('2024-06-20');

            $refundParams = [
                'payment_intent' => $pi['provider_intent_id'],
                'amount' => $amountCents,
            ];
            if (!empty($body['reason'])) {
                $allowed = ['duplicate', 'fraudulent', 'requested_by_customer'];
                if (in_array($body['reason'], $allowed, true)) {
                    $refundParams['reason'] = $body['reason'];
                }
            }

            $refund = \Stripe\Refund::create($refundParams);
        } catch (\Stripe\Exception\ApiErrorException $e) {
            error_response('Erreur Stripe : ' . $e->getMessage(), 502);
        }

        $isFull = $amountCents >= (int) $order['total_cents'];
        $newPaymentStatus = $isFull ? 'refunded' : 'partially_refunded';
        $newStatus = $isFull ? 'refunded' : $order['status'];

        $db->prepare('UPDATE orders SET payment_status = ?, status = ? WHERE id = ?')
            ->execute([$newPaymentStatus, $newStatus, $id]);

        $user = authenticate_token();
        $db->prepare('INSERT INTO audit_log (entity_type, entity_id, event_type, provider, payload, actor_type, actor_id) VALUES ("order", ?, "admin_refund", "stripe", ?, "admin", ?)')
            ->execute([$id, json_encode([
                'refund_id' => $refund->id,
                'amount_cents' => $amountCents,
                'is_full' => $isFull,
                'reason' => $body['reason'] ?? null,
            ], JSON_UNESCAPED_UNICODE), $user['id'] ?? null]);

        // Email notifications
        try {
            $fullOrder = self::loadFullOrder($id);
            if ($fullOrder) {
                OrderMailer::sendRefundNotif($fullOrder, $amountCents, $isFull);
                OrderMailer::sendAdminRefundNotif($fullOrder, $amountCents, $isFull);
            }
        } catch (\Throwable $e) {
            error_log('OrderMailer refund email error: ' . $e->getMessage());
        }

        json_response([
            'message' => $isFull ? 'Remboursement total effectué' : 'Remboursement partiel effectué',
            'refund_id' => $refund->id,
            'amount_cents' => $amountCents,
            'payment_status' => $newPaymentStatus,
        ]);
    }

    /** Stats rapides pour le dashboard. */
    public static function stats(): void {
        $db = Database::getInstance();
        $rows = $db->query("
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'awaiting_payment' THEN 1 ELSE 0 END) AS awaiting_payment,
                SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
                SUM(CASE WHEN status = 'fulfilled' THEN 1 ELSE 0 END) AS fulfilled,
                SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) AS shipped,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
                SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) AS refunded,
                SUM(CASE WHEN payment_status = 'paid' THEN total_cents ELSE 0 END) AS revenue_cents
            FROM orders
        ")->fetch();
        json_response($rows);
    }

    // ── Internal ───────────────────────────────────────────────────────────

    /** Load full order with items + decoded JSON for email templates. */
    private static function loadFullOrder(int $id): ?array {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$id]);
        $order = $stmt->fetch();
        if (!$order) return null;

        $stmt = $db->prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC');
        $stmt->execute([$id]);
        $order['items'] = $stmt->fetchAll();

        $order['billing_address'] = $order['billing_address'] ? (is_string($order['billing_address']) ? json_decode($order['billing_address'], true) : $order['billing_address']) : null;
        $order['shipping_address'] = $order['shipping_address'] ? (is_string($order['shipping_address']) ? json_decode($order['shipping_address'], true) : $order['shipping_address']) : null;
        $order['tax_breakdown'] = $order['tax_breakdown'] ? (is_string($order['tax_breakdown']) ? json_decode($order['tax_breakdown'], true) : $order['tax_breakdown']) : [];

        return $order;
    }
}
