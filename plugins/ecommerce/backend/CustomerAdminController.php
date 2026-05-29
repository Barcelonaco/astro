<?php
/**
 * CustomerAdminController — gestion des clients côté admin.
 *
 * Routes :
 *   GET  /admin/customers              (filtres : q, pro_status, page, per_page)
 *   GET  /admin/customers/:id          (détail + adresses + commandes récentes)
 *   PUT  /admin/customers/:id          { pro_status?, discount_rate?, discount_override?, note? }
 */
class CustomerAdminController
{

    /** Liste paginée + filtrable des clients. */
    public static function listAll(): void
    {
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
        if (isset($_GET['anonymized'])) {
            if ($_GET['anonymized'] === '1') {
                $where[] = 'c.anonymized_at IS NOT NULL';
            } else {
                $where[] = 'c.anonymized_at IS NULL';
            }
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
        $allowedSort = ['id', 'created_at', 'email', 'last_name', 'last_login_at', 'company', 'pro_status', 'discount_rate', 'order_count', 'total_spent_cents'];
        if (!in_array($sort, $allowedSort, true))
            $sort = 'created_at';
        $dir = strtoupper($_GET['dir'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

        $stmt = $db->prepare("
            SELECT c.id, c.email, c.first_name, c.last_name, c.phone, c.company, c.siret, c.activity,
                   c.is_pro, c.pro_status, c.discount_rate, c.accepts_marketing,
                   c.last_login_at, c.created_at,
                   (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) AS order_count,
                   (SELECT COALESCE(SUM(total_cents), 0) FROM orders WHERE customer_id = c.id AND payment_status IN ('paid', 'partially_refunded')) AS total_spent_cents
            FROM customers c
            WHERE {$whereStr}
            ORDER BY {$sort} {$dir}
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
    public static function getById(int $id): void
    {
        $db = Database::getInstance();

        $customer = CustomerModel::findById($id);
        if (!$customer)
            error_response('Client introuvable', 404);

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
    public static function update(int $id): void
    {
        $db = Database::getInstance();
        $body = get_json_body();

        $customer = CustomerModel::findById($id);
        if (!$customer)
            error_response('Client introuvable', 404);

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

        if (isset($body['payment_terms'])) {
            $allowedTerms = ['immediate', 'net15', 'net30', 'net45', 'net60'];
            if (in_array($body['payment_terms'], $allowedTerms, true)) {
                try {
                    $db->prepare('UPDATE customers SET payment_terms = ? WHERE id = ?')
                        ->execute([$body['payment_terms'], $id]);
                } catch (\Throwable $e) {
                    error_log('payment_terms update failed (column may not exist yet): ' . $e->getMessage());
                }
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
            // Detect pro approval transition
            $wasApproved = isset($data['pro_status']) && $data['pro_status'] === 'approved' && ($customer['pro_status'] ?? '') !== 'approved';

            CustomerModel::updateProfile($id, $data);

            // Send approval email
            if ($wasApproved && !empty($customer['email'])) {
                self::sendProApprovalEmail($customer);
            }
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
    public static function stats(): void
    {
        $db = Database::getInstance();
        $rows = $db->query("
            SELECT
                SUM(CASE WHEN anonymized_at IS NULL THEN 1 ELSE 0 END) AS total_active,
                SUM(CASE WHEN anonymized_at IS NULL AND pro_status = 'none' THEN 1 ELSE 0 END) AS particulier,
                SUM(CASE WHEN anonymized_at IS NULL AND pro_status IN ('approved','pending','rejected') THEN 1 ELSE 0 END) AS pro,
                SUM(CASE WHEN anonymized_at IS NULL AND pro_status = 'pending' THEN 1 ELSE 0 END) AS pending_pro
            FROM customers
        ")->fetch();
        json_response($rows);
    }

    /** Email de notification d'approbation pro. */
    private static function sendProApprovalEmail(array $customer): void
    {
        $name = htmlspecialchars(trim(($customer['first_name'] ?? '') . ' ' . ($customer['last_name'] ?? '')) ?: 'Bonjour');
        $company = htmlspecialchars($customer['company'] ?? '');
        $frontend = rtrim($_ENV['FRONTEND_URL'] ?? '', '/');
        $loginUrl = $frontend . '/compte/connexion';

        $html = "
            <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px'>
                <h2 style='color:#222;margin:0 0 16px'>Votre compte professionnel a été approuvé !</h2>
                <p>Bonjour {$name},</p>
                <p>Nous avons le plaisir de vous informer que votre demande de compte professionnel" . ($company ? " pour <strong>{$company}</strong>" : '') . " a été validée par notre équipe.</p>
                <p>Vous bénéficiez désormais de :</p>
                <ul style='padding-left:20px;line-height:1.8'>
                    <li>Tarifs revendeurs HT sur l'ensemble du catalogue</li>
                    <li>Programme de remise sur chiffre d'affaires cumulé</li>
                    <li>Conditions de paiement adaptées</li>
                </ul>
                <p style='margin-top:20px'>
                    <a href='{$loginUrl}' style='display:inline-block;padding:12px 24px;background:#222;color:#fff;text-decoration:none;border-radius:6px;font-weight:600'>Accéder à mon espace pro</a>
                </p>
                <p style='margin-top:24px;font-size:13px;color:#666'>À bientôt</p>
            </div>
        ";

        CustomerAuthController::sendResendEmail($customer['email'], 'Votre compte professionnel a été approuvé', $html);
    }

    /** Suppression admin (anonymisation RGPD). */
    public static function delete(int $id): void
    {
        $db = Database::getInstance();
        $customer = CustomerModel::findById($id, true);
        if (!$customer)
            error_response('Client introuvable', 404);

        $anonEmail = 'anonymized_' . $id . '@deleted.local';
        $db->prepare("UPDATE customers SET
            email = ?,
            password_hash = '',
            first_name = 'Compte',
            last_name = 'Supprime',
            phone = NULL,
            company = NULL,
            vat_number = NULL,
            siret = NULL,
            activity = NULL,
            anonymized_at = NOW(),
            anonymization_reason = 'admin_manual'
            WHERE id = ?")
            ->execute([$anonEmail, $id]);

        $db->prepare('DELETE FROM customer_addresses WHERE customer_id = ?')->execute([$id]);

        $emailHash = hash('sha256', $customer['email'] ?? '');
        $erasedFields = json_encode(['email', 'password_hash', 'phone', 'company', 'vat_number', 'siret', 'activity']);
        $user = authenticate_token();
        $db->prepare("INSERT INTO gdpr_erasure_log (customer_id, customer_email_hash, reason, requested_by_type, requested_by_id, performed_at, fields_erased, notes) VALUES (?, ?, 'admin_manual', 'admin', ?, NOW(), ?, ?)")
            ->execute([$id, $emailHash, $user['id'] ?? null, $erasedFields, 'Suppression admin']);

        json_response(['message' => 'Client supprime et anonymise']);
    }
}
