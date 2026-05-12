<?php
/**
 * CustomerAdminController — gestion des clients côté admin.
 *
 * Routes :
 *   GET  /admin/customers              (filtres : q, pro_status, page, per_page)
 *   GET  /admin/customers/:id          (détail + adresses + commandes récentes)
 *   PUT  /admin/customers/:id          { pro_status?, discount_rate?, discount_override?, note? }
 */
class CustomerAdminController {

    /** Liste paginée + filtrable des clients. */
    public static function listAll(): void {
        $db = Database::getInstance();

        $where = ['1 = 1'];
        $params = [];

        if (!empty($_GET['q'])) {
            $where[] = '(c.email LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.company LIKE ? OR c.siret LIKE ?)';
            $term = '%' . $_GET['q'] . '%';
            $params = array_merge($params, [$term, $term, $term, $term, $term]);
        }
        if (!empty($_GET['pro_status'])) {
            $where[] = 'c.pro_status = ?';
            $params[] = $_GET['pro_status'];
        }
        if (isset($_GET['is_pro']) && $_GET['is_pro'] !== '') {
            $where[] = 'c.is_pro = ?';
            $params[] = (int) $_GET['is_pro'];
        }

        $whereStr = implode(' AND ', $where);

        // Count
        $stmt = $db->prepare("SELECT COUNT(*) AS total FROM customers c WHERE {$whereStr}");
        $stmt->execute($params);
        $total = (int) $stmt->fetch()['total'];

        // Paginate
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($_GET['per_page'] ?? 25)));
        $offset = ($page - 1) * $perPage;

        $sort = $_GET['sort'] ?? 'created_at';
        $allowedSort = ['created_at', 'email', 'last_name', 'last_login_at'];
        if (!in_array($sort, $allowedSort, true)) $sort = 'created_at';
        $dir = strtoupper($_GET['dir'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

        $stmt = $db->prepare("
            SELECT c.id, c.email, c.first_name, c.last_name, c.phone, c.company, c.siret, c.activity,
                   c.is_pro, c.pro_status, c.discount_rate, c.accepts_marketing,
                   c.last_login_at, c.created_at,
                   (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) AS order_count,
                   (SELECT COALESCE(SUM(total_cents), 0) FROM orders WHERE customer_id = c.id AND payment_status IN ('paid', 'partially_refunded')) AS total_spent_cents
            FROM customers c
            WHERE {$whereStr}
            ORDER BY c.{$sort} {$dir}
            LIMIT {$perPage} OFFSET {$offset}
        ");
        $stmt->execute($params);
        $customers = $stmt->fetchAll();

        json_response([
            'customers' => $customers,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'pages' => (int) ceil($total / $perPage),
        ]);
    }

    /** Détail client + adresses + commandes récentes. */
    public static function getById(int $id): void {
        $db = Database::getInstance();

        $customer = CustomerModel::findById($id);
        if (!$customer) error_response('Client introuvable', 404);

        // Adresses
        $addresses = CustomerAddressModel::findByCustomer($id);

        // Commandes récentes (20 dernières)
        $stmt = $db->prepare('SELECT id, order_number, status, payment_status, total_cents, currency, placed_at FROM orders WHERE customer_id = ? ORDER BY placed_at DESC LIMIT 20');
        $stmt->execute([$id]);
        $orders = $stmt->fetchAll();

        // Totaux
        $stmt = $db->prepare("SELECT COUNT(*) AS order_count, COALESCE(SUM(total_cents), 0) AS total_spent_cents FROM orders WHERE customer_id = ? AND payment_status IN ('paid', 'partially_refunded')");
        $stmt->execute([$id]);
        $stats = $stmt->fetch();

        $customer['addresses'] = $addresses;
        $customer['orders'] = $orders;
        $customer['order_count'] = (int) $stats['order_count'];
        $customer['total_spent_cents'] = (int) $stats['total_spent_cents'];

        json_response($customer);
    }

    /** MAJ pro_status, discount_rate, discount_override. */
    public static function update(int $id): void {
        $db = Database::getInstance();
        $body = get_json_body();

        $customer = CustomerModel::findById($id);
        if (!$customer) error_response('Client introuvable', 404);

        $data = [];
        if (isset($body['pro_status'])) {
            $allowed = ['none', 'pending', 'approved', 'rejected'];
            if (!in_array($body['pro_status'], $allowed, true)) {
                error_response('Statut pro invalide', 400);
            }
            $data['pro_status'] = $body['pro_status'];
        }

        if (array_key_exists('discount_rate', $body)) {
            $rate = $body['discount_rate'] !== null && $body['discount_rate'] !== '' ? (float) $body['discount_rate'] : null;
            if ($rate !== null && ($rate < 0 || $rate > 100)) {
                error_response('Taux de remise invalide (0-100)', 400);
            }
            try {
                $db->prepare('UPDATE customers SET discount_rate = ? WHERE id = ?')
                    ->execute([$rate, $id]);
            } catch (\Throwable $e) {
                error_log('discount_rate update failed (column may not exist yet): ' . $e->getMessage());
            }
        }

        if (array_key_exists('discount_override', $body)) {
            try {
                $db->prepare('UPDATE customers SET discount_override = ? WHERE id = ?')
                    ->execute([!empty($body['discount_override']) ? 1 : 0, $id]);
            } catch (\Throwable $e) {
                error_log('discount_override update failed (column may not exist yet): ' . $e->getMessage());
            }
        }

        if (!empty($data)) {
            CustomerModel::updateProfile($id, $data);
        }

        // Note admin → audit_log
        $note = trim((string) ($body['note'] ?? ''));
        if ($note !== '') {
            $user = authenticate_token();
            $db->prepare('INSERT INTO audit_log (entity_type, entity_id, event_type, payload, actor_type, actor_id) VALUES ("customer", ?, "admin_note", ?, "admin", ?)')
                ->execute([$id, json_encode(['note' => $note, 'changes' => array_keys($body)], JSON_UNESCAPED_UNICODE), $user['id'] ?? null]);
        }

        json_response(['message' => 'Client mis à jour']);
    }

    /** Stats rapides. */
    public static function stats(): void {
        $db = Database::getInstance();
        $rows = $db->query("
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN pro_status = 'pending' THEN 1 ELSE 0 END) AS pending_pro,
                SUM(CASE WHEN pro_status = 'approved' THEN 1 ELSE 0 END) AS approved_pro,
                SUM(CASE WHEN is_pro = 1 THEN 1 ELSE 0 END) AS active_pro
            FROM customers
        ")->fetch();
        json_response($rows);
    }
}
