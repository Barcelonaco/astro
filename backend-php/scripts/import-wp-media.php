<?php
/**
 * Import WP media folder → Astro CMS media library.
 *
 * Skips WP auto-generated variants (-WIDTHxHEIGHT.ext, .webp siblings),
 * keeps originals only. Inserts rows in media_items, copies files to
 * backend-php/uploads/media/ with safe filename, preserves original_name.
 *
 * Usage:
 *   php scripts/import-wp-media.php <source_dir> [--dry-run] [--with-folders] [--whitelist=<file>]
 *
 * Examples:
 *   php scripts/import-wp-media.php /tmp/wp-import
 *   php scripts/import-wp-media.php /tmp/wp-import --dry-run
 *   php scripts/import-wp-media.php /tmp/wp-import --whitelist=/tmp/wp-attachments.txt
 *
 * Notes:
 *   - --dry-run: no DB writes, no file copies
 *   - --with-folders: recreate media_folders matching WP subdirectory tree
 *   - --whitelist=<file>: only import files whose relative path matches a line
 *     in this file. Use to align with wp_posts.attachment via _wp_attached_file.
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only.\n");
    exit(1);
}

$args = array_slice($argv, 1);
if (empty($args) || in_array('--help', $args, true) || in_array('-h', $args, true)) {
    echo "Usage: php import-wp-media.php <source_dir> [--dry-run] [--with-folders]\n";
    exit(0);
}

$sourceDir = realpath($args[0] ?? '');
$dryRun = in_array('--dry-run', $args, true);
$withFolders = in_array('--with-folders', $args, true);

$whitelist = null;
foreach ($args as $a) {
    if (str_starts_with($a, '--whitelist=')) {
        $wlPath = substr($a, 12);
        if (!is_file($wlPath)) {
            fwrite(STDERR, "Whitelist file not found: {$wlPath}\n");
            exit(1);
        }
        $whitelist = [];
        foreach (file($wlPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $whitelist[ltrim(trim($line), '/')] = true;
        }
        echo "Whitelist loaded: " . count($whitelist) . " entries\n";
    }
}

if (!$sourceDir || !is_dir($sourceDir)) {
    fwrite(STDERR, "Source dir invalid: {$args[0]}\n");
    exit(1);
}

require_once __DIR__ . '/../vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();
require_once __DIR__ . '/../config/database.php';

$uploadDir = realpath(__DIR__ . '/../uploads/media');
if (!$uploadDir) {
    mkdir(__DIR__ . '/../uploads/media', 0755, true);
    $uploadDir = realpath(__DIR__ . '/../uploads/media');
}

$db = $dryRun ? null : Database::getInstance();

// Filter: skip WP variants and edit artifacts
//   -1080x550.png       (resized variant)
//   -scaled.jpg         (WP downscale for >2560px sources)
//   -e1752672767657.jpg (image edited/cropped in WP admin)
//   -150x150.jpg.webp   (Imagify/ShortPixel webp sibling of variant)
$variantRegex = '/(-\d+x\d+|-scaled|-e\d{10,})\.(jpe?g|png|gif|webp|avif)(\.webp)?$/i';
$allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'mp4', 'webm', 'mov', 'pdf'];

$mimeMap = [
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'gif' => 'image/gif',
    'webp' => 'image/webp',
    'avif' => 'image/avif',
    'svg' => 'image/svg+xml',
    'mp4' => 'video/mp4',
    'webm' => 'video/webm',
    'mov' => 'video/quicktime',
    'pdf' => 'application/pdf',
];

$folderCache = [];

function getOrCreateFolder(PDO $db, string $name, ?int $parentId, array &$cache): int
{
    $key = ($parentId ?? 'root') . '/' . $name;
    if (isset($cache[$key]))
        return $cache[$key];

    $stmt = $db->prepare('SELECT id FROM media_folders WHERE name = ? AND ' . ($parentId === null ? 'parent_id IS NULL' : 'parent_id = ?'));
    $stmt->execute($parentId === null ? [$name] : [$name, $parentId]);
    $existing = $stmt->fetchColumn();
    if ($existing) {
        $cache[$key] = (int) $existing;
        return $cache[$key];
    }

    $ins = $db->prepare('INSERT INTO media_folders (name, parent_id) VALUES (?, ?)');
    $ins->execute([$name, $parentId]);
    $cache[$key] = (int) $db->lastInsertId();
    return $cache[$key];
}

function resolveFolderId(?PDO $db, string $relPath, ?int $rootBase, array &$cache): ?int
{
    if (!$db)
        return null;
    $parts = array_filter(explode('/', trim(dirname($relPath), '/.')));
    if (empty($parts))
        return null;
    $parentId = $rootBase;
    foreach ($parts as $part) {
        $parentId = getOrCreateFolder($db, $part, $parentId, $cache);
    }
    return $parentId;
}

$stats = ['scanned' => 0, 'skipped_variant' => 0, 'skipped_ext' => 0, 'skipped_whitelist' => 0, 'imported' => 0, 'errors' => 0];

$it = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($sourceDir, FilesystemIterator::SKIP_DOTS),
    RecursiveIteratorIterator::LEAVES_ONLY
);

$insertSql = 'INSERT INTO media_items (folder_id, type, filename, original_name, mime_type, size, width, height, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
$insertStmt = $db ? $db->prepare($insertSql) : null;

echo ($dryRun ? "[DRY-RUN] " : "") . "Source: {$sourceDir}\n";
echo "Folders: " . ($withFolders ? "preserve WP tree" : "flat (root)") . "\n\n";

foreach ($it as $file) {
    if (!$file->isFile())
        continue;
    $stats['scanned']++;

    $absPath = $file->getPathname();
    $relPath = ltrim(str_replace($sourceDir, '', $absPath), '/');
    $basename = $file->getBasename();
    $ext = strtolower($file->getExtension());

    if (!in_array($ext, $allowedExt, true)) {
        $stats['skipped_ext']++;
        continue;
    }

    // When whitelist provided, it's authoritative — skip regex pre-filter
    // (WP can register -scaled.jpg or -eTIMESTAMP.jpg as legit attachments)
    if ($whitelist !== null) {
        if (!isset($whitelist[$relPath])) {
            $stats['skipped_whitelist']++;
            continue;
        }
    } else {
        if (preg_match($variantRegex, $basename)) {
            $stats['skipped_variant']++;
            continue;
        }
    }

    $size = $file->getSize();
    $mime = $mimeMap[$ext] ?? 'application/octet-stream';
    $type = str_starts_with($mime, 'image/') ? 'image' : (str_starts_with($mime, 'video/') ? 'video' : 'file');

    $width = null;
    $height = null;
    if ($type === 'image' && $ext !== 'svg') {
        $info = @getimagesize($absPath);
        if ($info) {
            $width = $info[0];
            $height = $info[1];
        }
    }

    $safeName = time() . '_' . substr(bin2hex(random_bytes(4)), 0, 8) . '.' . $ext;
    $destPath = $uploadDir . '/' . $safeName;
    $url = '/uploads/media/' . $safeName;

    $folderId = $withFolders ? resolveFolderId($db, $relPath, null, $folderCache) : null;

    if ($dryRun) {
        echo "KEEP {$relPath} → {$safeName} (folder=" . ($folderId ?? 'root') . ", {$width}x{$height})\n";
        $stats['imported']++;
        continue;
    }

    if (!@copy($absPath, $destPath)) {
        fwrite(STDERR, "ERROR copy: {$absPath}\n");
        $stats['errors']++;
        continue;
    }

    try {
        $insertStmt->execute([$folderId, $type, $safeName, $basename, $mime, $size, $width, $height, $url]);
        $stats['imported']++;
        if ($stats['imported'] % 50 === 0) {
            echo "... {$stats['imported']} imported\n";
        }
    } catch (Throwable $e) {
        @unlink($destPath);
        fwrite(STDERR, "ERROR insert {$basename}: " . $e->getMessage() . "\n");
        $stats['errors']++;
    }
}

echo "\n--- Stats ---\n";
foreach ($stats as $k => $v)
    echo str_pad($k, 20) . $v . "\n";
echo $dryRun ? "\n[DRY-RUN] No changes written.\n" : "\nDone.\n";
