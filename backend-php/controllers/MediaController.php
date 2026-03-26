<?php

class MediaController {
    private static function normalizeFolderId($value): ?int {
        if ($value === null || $value === '' || $value === 'null') return null;
        $parsed = filter_var($value, FILTER_VALIDATE_INT);
        return $parsed !== false ? $parsed : null;
    }

    private static function detectType(string $mime): ?string {
        if (str_starts_with($mime, 'image/')) return 'image';
        if (str_starts_with($mime, 'video/')) return 'video';
        return null;
    }

    public static function getFolders(): void {
        $db = Database::getInstance();
        json_response($db->query('SELECT id, name, parent_id, created_at FROM media_folders ORDER BY name ASC')->fetchAll());
    }

    public static function createFolder(): void {
        $body = get_json_body();
        $name = trim($body['name'] ?? '');
        $parentId = self::normalizeFolderId($body['parent_id'] ?? null);
        if (empty($name)) error_response('Nom de dossier requis', 400);

        $db = Database::getInstance();
        $stmt = $db->prepare('INSERT INTO media_folders (name, parent_id) VALUES (?, ?)');
        $stmt->execute([$name, $parentId]);
        $id = (int) $db->lastInsertId();

        $stmt = $db->prepare('SELECT id, name, parent_id, created_at FROM media_folders WHERE id = ?');
        $stmt->execute([$id]);
        json_response($stmt->fetch(), 201);
    }

    public static function updateFolder(int $id): void {
        $body = get_json_body();
        $name = trim($body['name'] ?? '');
        $parentId = self::normalizeFolderId($body['parent_id'] ?? null);
        if (empty($name)) error_response('Nom de dossier requis', 400);

        $db = Database::getInstance();
        $db->prepare('UPDATE media_folders SET name = ?, parent_id = ? WHERE id = ?')->execute([$name, $parentId, $id]);

        $stmt = $db->prepare('SELECT id, name, parent_id, created_at FROM media_folders WHERE id = ?');
        $stmt->execute([$id]);
        json_response($stmt->fetch());
    }

    public static function deleteFolder(int $id): void {
        $db = Database::getInstance();
        $db->prepare('UPDATE media_items SET folder_id = NULL WHERE folder_id = ?')->execute([$id]);
        $db->prepare('UPDATE media_folders SET parent_id = NULL WHERE parent_id = ?')->execute([$id]);
        $db->prepare('DELETE FROM media_folders WHERE id = ?')->execute([$id]);
        json_response(['success' => true]);
    }

    public static function getItems(): void {
        $db = Database::getInstance();
        $folderId = self::normalizeFolderId($_GET['folder_id'] ?? null);
        $search = trim($_GET['search'] ?? '');
        $showAll = ($_GET['all'] ?? '') === '1';

        $sql = 'SELECT id, folder_id, type, filename, original_name, mime_type, size, width, height, url, created_at FROM media_items';
        $params = [];

        if ($search) {
            $sql .= ' WHERE original_name LIKE ?';
            $params[] = "%{$search}%";
            if (!$showAll && $folderId !== null) {
                $sql .= ' AND folder_id <=> ?';
                $params[] = $folderId;
            }
        } elseif (!$showAll) {
            $sql .= ' WHERE folder_id <=> ?';
            $params[] = $folderId;
        }

        $sql .= ' ORDER BY created_at DESC';
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        json_response($stmt->fetchAll());
    }

    public static function upload(): void {
        $uploadDir = __DIR__ . '/../uploads/media';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

        $folderId = self::normalizeFolderId($_POST['folder_id'] ?? null);

        if (empty($_FILES['files'])) {
            error_response('Aucun fichier fourni', 400);
        }

        $files = $_FILES['files'];
        $created = [];
        $db = Database::getInstance();
        $stmt = $db->prepare('INSERT INTO media_items (folder_id, type, filename, original_name, mime_type, size, width, height, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

        // Normalize $_FILES array (handle both single and multiple uploads)
        $fileCount = is_array($files['name']) ? count($files['name']) : 1;

        for ($i = 0; $i < $fileCount; $i++) {
            $name = is_array($files['name']) ? $files['name'][$i] : $files['name'];
            $tmpName = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
            $mime = is_array($files['type']) ? $files['type'][$i] : $files['type'];
            $size = is_array($files['size']) ? $files['size'][$i] : $files['size'];
            $error = is_array($files['error']) ? $files['error'][$i] : $files['error'];

            if ($error !== UPLOAD_ERR_OK) continue;

            $type = self::detectType($mime);
            if (!$type) continue;

            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            $safeExt = (strlen($ext) <= 10) ? '.' . $ext : '';
            $filename = time() . '_' . substr(bin2hex(random_bytes(4)), 0, 8) . $safeExt;
            $destPath = $uploadDir . '/' . $filename;

            if (!move_uploaded_file($tmpName, $destPath)) continue;

            // Dimensions
            $width = null;
            $height = null;
            if ($type === 'image') {
                $imgInfo = @getimagesize($destPath);
                if ($imgInfo) {
                    $width = $imgInfo[0];
                    $height = $imgInfo[1];
                }
            }

            $url = '/uploads/media/' . $filename;
            $stmt->execute([$folderId, $type, $filename, $name, $mime, $size, $width, $height, $url]);

            $created[] = [
                'id' => (int) $db->lastInsertId(),
                'folder_id' => $folderId,
                'type' => $type,
                'filename' => $filename,
                'original_name' => $name,
                'mime_type' => $mime,
                'size' => $size,
                'width' => $width,
                'height' => $height,
                'url' => $url,
            ];
        }

        json_response($created, 201);
    }

    public static function updateItem(int $id): void {
        $body = get_json_body();
        $db = Database::getInstance();
        $updates = [];
        $params = [];

        if (array_key_exists('folder_id', $body)) {
            $updates[] = 'folder_id = ?';
            $params[] = self::normalizeFolderId($body['folder_id']);
        }
        if (!empty($body['original_name'])) {
            $updates[] = 'original_name = ?';
            $params[] = trim($body['original_name']);
        }

        if (!empty($updates)) {
            $params[] = $id;
            $db->prepare('UPDATE media_items SET ' . implode(', ', $updates) . ' WHERE id = ?')->execute($params);
        }

        $stmt = $db->prepare('SELECT id, folder_id, type, filename, original_name, mime_type, size, width, height, url, created_at FROM media_items WHERE id = ?');
        $stmt->execute([$id]);
        json_response($stmt->fetch());
    }

    public static function deleteItem(int $id): void {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT filename FROM media_items WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) error_response('Media introuvable', 404);

        $db->prepare('DELETE FROM media_items WHERE id = ?')->execute([$id]);

        if ($row['filename']) {
            $filePath = __DIR__ . '/../uploads/media/' . $row['filename'];
            @unlink($filePath);
        }
        json_response(['success' => true]);
    }
}
