<?php

class MediaController {
    private static bool $migrated = false;

    private static function ensureExtraColumns(): void {
        if (self::$migrated) return;
        self::$migrated = true;
        $db = Database::getInstance();
        $existing = [];
        foreach ($db->query("SHOW COLUMNS FROM media_items")->fetchAll() as $col) {
            $existing[] = $col['Field'];
        }
        if (!in_array('alt', $existing))
            $db->exec("ALTER TABLE media_items ADD COLUMN alt VARCHAR(500) DEFAULT '' AFTER original_name");
        if (!in_array('title', $existing))
            $db->exec("ALTER TABLE media_items ADD COLUMN title VARCHAR(500) DEFAULT '' AFTER alt");
        if (!in_array('caption', $existing))
            $db->exec("ALTER TABLE media_items ADD COLUMN caption TEXT AFTER title");
        if (!in_array('description', $existing))
            $db->exec("ALTER TABLE media_items ADD COLUMN description TEXT AFTER caption");
    }

    private static function normalizeFolderId($value): ?int {
        if ($value === null || $value === '' || $value === 'null') return null;
        $parsed = filter_var($value, FILTER_VALIDATE_INT);
        return $parsed !== false ? $parsed : null;
    }

    /** Allowed file extensions whitelist */
    private const ALLOWED_EXTENSIONS = [
        'image' => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'ico'],
        'video' => ['mp4', 'webm'],
        'document' => ['pdf'],
    ];

    /** Dangerous extensions that must NEVER be uploaded */
    private const BLOCKED_EXTENSIONS = [
        'php', 'phtml', 'phar', 'php3', 'php4', 'php5', 'php7', 'phps',
        'inc', 'sh', 'bash', 'cgi', 'pl', 'py', 'rb', 'exe', 'bat', 'cmd',
        'com', 'vbs', 'js', 'jsp', 'asp', 'aspx', 'htaccess', 'htpasswd',
    ];

    private static function detectType(string $mime): ?string {
        if (str_starts_with($mime, 'image/')) return 'image';
        if (str_starts_with($mime, 'video/')) return 'video';
        if ($mime === 'application/pdf') return 'document';
        return null;
    }

    private static function isAllowedExtension(string $ext): bool {
        if (in_array($ext, self::BLOCKED_EXTENSIONS, true)) return false;
        foreach (self::ALLOWED_EXTENSIONS as $exts) {
            if (in_array($ext, $exts, true)) return true;
        }
        return false;
    }

    private static function verifyRealMime(string $filePath): ?string {
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $realMime = $finfo->file($filePath);
        return self::detectType($realMime) ? $realMime : null;
    }

    public static function getFolders(): void {
        $db = Database::getInstance();
        $folders = $db->query('SELECT f.id, f.name, f.parent_id, f.created_at, COUNT(m.id) AS media_count FROM media_folders f LEFT JOIN media_items m ON m.folder_id = f.id GROUP BY f.id ORDER BY f.name ASC')->fetchAll();
        $total = (int) $db->query('SELECT COUNT(*) FROM media_items')->fetchColumn();
        json_response(['folders' => $folders, 'total' => $total]);
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

    private static function selectFields(): string {
        return 'id, folder_id, type, filename, original_name, alt, title, caption, description, mime_type, size, width, height, url, created_at';
    }

    public static function getItems(): void {
        self::ensureExtraColumns();
        $db = Database::getInstance();
        $folderId = self::normalizeFolderId($_GET['folder_id'] ?? null);
        $search = trim($_GET['search'] ?? '');
        $showAll = ($_GET['all'] ?? '') === '1';
        $typeFilter = trim($_GET['type'] ?? '');
        $sort = trim($_GET['sort'] ?? 'date_desc');

        $fields = self::selectFields();
        $sql = "SELECT {$fields} FROM media_items";
        $params = [];
        $where = [];

        if ($search) {
            $where[] = 'original_name LIKE ?';
            $params[] = "%{$search}%";
            if (!$showAll && $folderId !== null) {
                $where[] = 'folder_id <=> ?';
                $params[] = $folderId;
            }
        } elseif (!$showAll) {
            $where[] = 'folder_id <=> ?';
            $params[] = $folderId;
        }

        if (in_array($typeFilter, ['image', 'video', 'document'], true)) {
            $where[] = 'type = ?';
            $params[] = $typeFilter;
        }

        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }

        $orderMap = [
            'date_desc' => 'created_at DESC',
            'date_asc'  => 'created_at ASC',
            'name_asc'  => 'original_name ASC',
            'name_desc' => 'original_name DESC',
            'type_asc'  => 'type ASC, original_name ASC',
            'type_desc' => 'type DESC, original_name ASC',
        ];
        $sql .= ' ORDER BY ' . ($orderMap[$sort] ?? $orderMap['date_desc']);

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        json_response($stmt->fetchAll());
    }

    public static function upload(): void {
        self::ensureExtraColumns();
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

            // Validate extension against whitelist
            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            if (!self::isAllowedExtension($ext)) continue;

            // Validate MIME from client header
            $type = self::detectType($mime);
            if (!$type) continue;

            $safeExt = '.' . $ext;
            $filename = time() . '_' . substr(bin2hex(random_bytes(4)), 0, 8) . $safeExt;
            $destPath = $uploadDir . '/' . $filename;

            if (!move_uploaded_file($tmpName, $destPath)) continue;

            // Verify real MIME type from file content (not client header)
            $realMime = self::verifyRealMime($destPath);
            if (!$realMime) {
                @unlink($destPath);
                continue;
            }
            $mime = $realMime;
            $type = self::detectType($mime);

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
        self::ensureExtraColumns();
        $body = get_json_body();
        $db = Database::getInstance();
        $updates = [];
        $params = [];

        if (array_key_exists('folder_id', $body)) {
            $updates[] = 'folder_id = ?';
            $params[] = self::normalizeFolderId($body['folder_id']);
        }
        if (array_key_exists('original_name', $body)) {
            $updates[] = 'original_name = ?';
            $params[] = trim($body['original_name'] ?? '');
        }
        if (array_key_exists('alt', $body)) {
            $updates[] = 'alt = ?';
            $params[] = trim($body['alt'] ?? '');
        }
        if (array_key_exists('title', $body)) {
            $updates[] = 'title = ?';
            $params[] = trim($body['title'] ?? '');
        }
        if (array_key_exists('caption', $body)) {
            $updates[] = 'caption = ?';
            $params[] = trim($body['caption'] ?? '');
        }
        if (array_key_exists('description', $body)) {
            $updates[] = 'description = ?';
            $params[] = trim($body['description'] ?? '');
        }

        if (!empty($updates)) {
            $params[] = $id;
            $db->prepare('UPDATE media_items SET ' . implode(', ', $updates) . ' WHERE id = ?')->execute($params);
        }

        $fields = self::selectFields();
        $stmt = $db->prepare("SELECT {$fields} FROM media_items WHERE id = ?");
        $stmt->execute([$id]);
        json_response($stmt->fetch());
    }

    public static function cropItem(int $id): void {
        $body = get_json_body();
        $x = (int) ($body['x'] ?? 0);
        $y = (int) ($body['y'] ?? 0);
        $w = (int) ($body['width'] ?? 0);
        $h = (int) ($body['height'] ?? 0);

        if ($w <= 0 || $h <= 0) error_response('Dimensions invalides', 400);

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM media_items WHERE id = ?');
        $stmt->execute([$id]);
        $item = $stmt->fetch();
        if (!$item) error_response('Média introuvable', 404);

        $uploadDir = __DIR__ . '/../uploads/media';
        $srcPath = $uploadDir . '/' . $item['filename'];
        if (!file_exists($srcPath)) error_response('Fichier introuvable', 404);

        $mime = $item['mime_type'];
        $src = match ($mime) {
            'image/jpeg' => @imagecreatefromjpeg($srcPath),
            'image/png'  => @imagecreatefrompng($srcPath),
            'image/gif'  => @imagecreatefromgif($srcPath),
            'image/webp' => @imagecreatefromwebp($srcPath),
            default      => null,
        };
        if (!$src) error_response('Format non supporté pour le recadrage', 400);

        $dst = imagecreatetruecolor($w, $h);

        // Preserve transparency for PNG/GIF
        if ($mime === 'image/png' || $mime === 'image/gif') {
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
            $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
            imagefilledrectangle($dst, 0, 0, $w, $h, $transparent);
        }

        imagecopyresampled($dst, $src, 0, 0, $x, $y, $w, $h, $w, $h);
        imagedestroy($src);

        // Save over original file
        match ($mime) {
            'image/jpeg' => imagejpeg($dst, $srcPath, 92),
            'image/png'  => imagepng($dst, $srcPath, 6),
            'image/gif'  => imagegif($dst, $srcPath),
            'image/webp' => imagewebp($dst, $srcPath, 90),
        };
        imagedestroy($dst);

        // Clear optimized cache
        $optimizedDir = $uploadDir . '/_optimized';
        if (is_dir($optimizedDir)) {
            $baseName = pathinfo($item['filename'], PATHINFO_FILENAME);
            foreach (glob($optimizedDir . '/' . $baseName . '*') as $cached) {
                @unlink($cached);
            }
        }

        // Update dimensions in DB
        $newSize = filesize($srcPath);
        $db->prepare('UPDATE media_items SET width = ?, height = ?, size = ? WHERE id = ?')
            ->execute([$w, $h, $newSize, $id]);

        $fields = self::selectFields();
        $stmt = $db->prepare("SELECT {$fields} FROM media_items WHERE id = ?");
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
