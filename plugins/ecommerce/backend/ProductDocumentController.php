<?php
/**
 * ProductDocumentController — product documents (technical sheets, manuals, notices).
 *
 * CDC §6.2 (espace ressources) + §7.2 (fiches techniques produits).
 *
 * Documents can be:
 *   - Public (visible by anyone on product pages)
 *   - Requires purchase (only downloadable by customers who bought the product)
 *
 * Routes:
 *   GET  /shop/products/:id/documents          Public docs for a product
 *   GET  /customer/documents                   All docs available to logged customer (based on purchases)
 *   GET  /customer/documents/:id/download      Download a document (checks purchase gate if needed)
 *   POST /admin/product-documents              Upload a document
 *   GET  /admin/product-documents              List all documents
 *   PUT  /admin/product-documents/:id          Update metadata
 *   DELETE /admin/product-documents/:id        Delete a document
 */
class ProductDocumentController {

    private static $ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'zip'];
    private static $MAX_SIZE = 50 * 1024 * 1024; // 50 MB

    // ── Public ──────────────────────────────────────────────────────────

    /** List public documents for a product. */
    public static function listForProduct(int $productId): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('
            SELECT id, product_id, title, doc_type, original_name, mime_type, size, is_public, requires_purchase, position, created_at
            FROM product_documents
            WHERE product_id = ? AND is_public = 1
            ORDER BY position ASC, id ASC
        ');
        $stmt->execute([$productId]);
        json_response(['documents' => $stmt->fetchAll()]);
    }

    // ── Customer ────────────────────────────────────────────────────────

    /** List all documents available to the logged customer (based on paid orders). */
    public static function listForCustomer(): void {
        require_ecommerce_enabled();
        $customer = authenticate_customer();

        $db = Database::getInstance();

        // Get product IDs the customer has purchased (paid orders)
        $stmt = $db->prepare("
            SELECT DISTINCT oi.product_id
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.customer_id = ? AND o.payment_status IN ('paid', 'partially_refunded')
            AND oi.product_id IS NOT NULL
        ");
        $stmt->execute([$customer['id']]);
        $purchasedIds = array_column($stmt->fetchAll(), 'product_id');

        if (empty($purchasedIds)) {
            json_response(['documents' => [], 'has_purchases' => false]);
            return;
        }

        // Get all documents for purchased products (public + purchase-gated)
        $in = implode(',', array_fill(0, count($purchasedIds), '?'));
        $stmt = $db->prepare("
            SELECT d.id, d.product_id, d.title, d.doc_type, d.original_name, d.mime_type, d.size, d.requires_purchase, d.created_at,
                   p.title AS product_title
            FROM product_documents d
            LEFT JOIN cpt_products p ON p.id = d.product_id
            WHERE d.product_id IN ($in)
            ORDER BY d.doc_type ASC, d.position ASC, d.id ASC
        ");
        $stmt->execute($purchasedIds);

        json_response([
            'documents' => $stmt->fetchAll(),
            'has_purchases' => true,
        ]);
    }

    /** Download a document (checks purchase gate if requires_purchase). */
    public static function download(int $id): void {
        require_ecommerce_enabled();
        $customer = authenticate_customer();

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM product_documents WHERE id = ?');
        $stmt->execute([$id]);
        $doc = $stmt->fetch();
        if (!$doc) error_response('Document introuvable', 404);

        // Purchase gate
        if ($doc['requires_purchase'] && $doc['product_id']) {
            $stmt = $db->prepare("
                SELECT COUNT(*) AS c FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                WHERE o.customer_id = ? AND o.payment_status IN ('paid', 'partially_refunded')
                AND oi.product_id = ?
            ");
            $stmt->execute([$customer['id'], $doc['product_id']]);
            if ((int) $stmt->fetch()['c'] === 0) {
                error_response('Ce document est accessible uniquement apres achat du produit.', 403);
            }
        }

        $uploadDir = dirname(__DIR__, 3) . '/backend-php/uploads/product-docs';
        $filePath = $uploadDir . '/' . $doc['filename'];
        if (!file_exists($filePath)) error_response('Fichier introuvable sur le serveur', 404);

        header('Content-Type: ' . $doc['mime_type']);
        header('Content-Disposition: inline; filename="' . $doc['original_name'] . '"');
        header('Content-Length: ' . filesize($filePath));
        readfile($filePath);
        exit;
    }

    // ── Admin ───────────────────────────────────────────────────────────

    /** Upload a product document. */
    public static function upload(): void {
        require_ecommerce_enabled();

        $productId = !empty($_POST['product_id']) ? (int) $_POST['product_id'] : null;
        $title = trim((string) ($_POST['title'] ?? ''));
        $docType = $_POST['doc_type'] ?? 'other';
        $isPublic = ($_POST['is_public'] ?? '1') === '1' ? 1 : 0;
        $requiresPurchase = ($_POST['requires_purchase'] ?? '0') === '1' ? 1 : 0;

        $validTypes = ['technical_sheet', 'manual', 'notice', 'certificate', 'other'];
        if (!in_array($docType, $validTypes, true)) $docType = 'other';

        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            error_response('Aucun fichier fourni', 400);
        }

        $file = $_FILES['file'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, self::$ALLOWED_EXTENSIONS, true)) {
            error_response('Format non accepte', 400);
        }
        if ($file['size'] > self::$MAX_SIZE) {
            error_response('Fichier trop volumineux (50 Mo max)', 400);
        }

        if ($title === '') $title = pathinfo($file['name'], PATHINFO_FILENAME);

        $uploadDir = dirname(__DIR__, 3) . '/backend-php/uploads/product-docs';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

        $filename = ($productId ? $productId . '_' : '') . $docType . '_' . time() . '_' . substr(bin2hex(random_bytes(4)), 0, 8) . '.' . $ext;
        $destPath = $uploadDir . '/' . $filename;

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            error_response('Erreur lors de l\'enregistrement', 500);
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $realMime = $finfo->file($destPath);

        $db = Database::getInstance();
        $stmt = $db->prepare('INSERT INTO product_documents (product_id, title, doc_type, original_name, filename, mime_type, size, is_public, requires_purchase) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$productId, $title, $docType, $file['name'], $filename, $realMime, $file['size'], $isPublic, $requiresPurchase]);

        json_response([
            'id' => (int) $db->lastInsertId(),
            'title' => $title,
            'doc_type' => $docType,
            'message' => 'Document ajoute',
        ], 201);
    }

    /** List all documents (admin). */
    public static function listAll(): void {
        $db = Database::getInstance();
        $stmt = $db->query('
            SELECT d.*, p.title AS product_title
            FROM product_documents d
            LEFT JOIN cpt_products p ON p.id = d.product_id
            ORDER BY d.created_at DESC
            LIMIT 500
        ');
        json_response(['documents' => $stmt->fetchAll()]);
    }

    /** Update document metadata. */
    public static function update(int $id): void {
        $db = Database::getInstance();
        $body = get_json_body();

        $stmt = $db->prepare('SELECT * FROM product_documents WHERE id = ?');
        $stmt->execute([$id]);
        if (!$stmt->fetch()) error_response('Document introuvable', 404);

        $fields = [];
        $values = [];
        foreach (['title', 'doc_type', 'is_public', 'requires_purchase', 'position', 'product_id'] as $f) {
            if (array_key_exists($f, $body)) {
                $fields[] = "$f = ?";
                $values[] = $body[$f];
            }
        }
        if (empty($fields)) error_response('Rien a modifier', 400);

        $values[] = $id;
        $db->prepare('UPDATE product_documents SET ' . implode(', ', $fields) . ' WHERE id = ?')
            ->execute($values);

        json_response(['message' => 'Document mis a jour']);
    }

    /** Delete a document. */
    public static function delete(int $id): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM product_documents WHERE id = ?');
        $stmt->execute([$id]);
        $doc = $stmt->fetch();
        if (!$doc) error_response('Document introuvable', 404);

        $uploadDir = dirname(__DIR__, 3) . '/backend-php/uploads/product-docs';
        @unlink($uploadDir . '/' . $doc['filename']);

        $db->prepare('DELETE FROM product_documents WHERE id = ?')->execute([$id]);
        json_response(['message' => 'Document supprime']);
    }

    /** Admin: download any document. */
    public static function adminDownload(int $id): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM product_documents WHERE id = ?');
        $stmt->execute([$id]);
        $doc = $stmt->fetch();
        if (!$doc) error_response('Document introuvable', 404);

        $uploadDir = dirname(__DIR__, 3) . '/backend-php/uploads/product-docs';
        $filePath = $uploadDir . '/' . $doc['filename'];
        if (!file_exists($filePath)) error_response('Fichier introuvable', 404);

        header('Content-Type: ' . $doc['mime_type']);
        header('Content-Disposition: inline; filename="' . $doc['original_name'] . '"');
        header('Content-Length: ' . filesize($filePath));
        readfile($filePath);
        exit;
    }
}
