#!/usr/bin/env php
<?php
/**
 * Database Migration Script
 *
 * Safe to run multiple times — uses IF NOT EXISTS and checks existing columns.
 * Never drops tables, columns, or data.
 *
 * Usage: php migrate.php
 */

require_once __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

require_once __DIR__ . '/config/database.php';

$db = Database::getInstance();

echo "=== CMS Astro — Database Migration ===\n\n";
echo "Database: " . ($_ENV['DB_NAME'] ?? 'astro_blog_cms') . "\n";
echo "Host: " . ($_ENV['DB_HOST'] ?? 'localhost') . "\n\n";

$changes = 0;

// ─── Helper functions ───────────────────────────────────────────────────────

function table_exists(PDO $db, string $table): bool {
    $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $result = $db->query("SHOW TABLES LIKE '{$safe}'")->fetch();
    return (bool) $result;
}

function get_columns(PDO $db, string $table): array {
    $cols = [];
    foreach ($db->query("SHOW COLUMNS FROM `{$table}`")->fetchAll() as $col) {
        $cols[$col['Field']] = $col;
    }
    return $cols;
}

function ensure_column(PDO $db, string $table, string $column, string $definition, ?string $after = null): bool {
    $cols = get_columns($db, $table);
    if (isset($cols[$column])) return false;

    $sql = "ALTER TABLE `{$table}` ADD COLUMN `{$column}` {$definition}";
    if ($after) $sql .= " AFTER `{$after}`";
    $db->exec($sql);
    echo "  + Added column {$table}.{$column}\n";
    return true;
}

// ─── Table: users ───────────────────────────────────────────────────────────

echo "Table: users\n";
if (!table_exists($db, 'users')) {
    $db->exec("
        CREATE TABLE users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            role ENUM('super_admin', 'admin_site', 'editor', 'reader') NOT NULL DEFAULT 'reader',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "  + Created table\n";

    // Default admin users
    $defaultUsers = [
        ['Chulee',   'chulee@barcelona-co.fr',   'GS3iQMjJROQj'],
        ['Quentin',  'quentin@barcelona-co.fr',   'Linoleum-Impurity-Launder0-Scariness'],
        ['Olivier',  'olivier@barcelona-co.fr',    'Overvalue-Cactus-Hunter0'],
    ];
    $stmt = $db->prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'super_admin')");
    foreach ($defaultUsers as [$name, $email, $pwd]) {
        $stmt->execute([$name, $email, password_hash($pwd, PASSWORD_DEFAULT)]);
        echo "  + Created admin ({$email})\n";
    }
    $changes++;
} else {
    // Migrate role ENUM to 4-role system (3-step: expand → update → shrink)
    $colInfo = $db->query("SHOW COLUMNS FROM users LIKE 'role'")->fetch();
    if ($colInfo && strpos($colInfo['Type'], 'super_admin') === false) {
        $db->exec("ALTER TABLE users MODIFY COLUMN role ENUM('admin','editor','super_admin','admin_site','reader') NOT NULL DEFAULT 'reader'");
        $db->exec("UPDATE users SET role = 'super_admin' WHERE role = 'admin'");
        $db->exec("ALTER TABLE users MODIFY COLUMN role ENUM('super_admin','admin_site','editor','reader') NOT NULL DEFAULT 'reader'");
        echo "  + Migrated role column to 4-role system\n";
        $changes++;
    }

    // Ensure default admin users exist
    $defaultUsers = [
        ['Chulee',   'chulee@barcelona-co.fr',   'GS3iQMjJROQj'],
        ['Quentin',  'quentin@barcelona-co.fr',   'Linoleum-Impurity-Launder0-Scariness'],
        ['Olivier',  'olivier@barcelona-co.fr',    'Overvalue-Cactus-Hunter0'],
    ];
    $check = $db->prepare("SELECT id FROM users WHERE email = ?");
    $insert = $db->prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'super_admin')");
    foreach ($defaultUsers as [$name, $email, $pwd]) {
        $check->execute([$email]);
        if (!$check->fetch()) {
            $insert->execute([$name, $email, password_hash($pwd, PASSWORD_DEFAULT)]);
            echo "  + Created super_admin ({$email})\n";
            $changes++;
        }
    }
    if ($changes === 0) echo "  OK\n";
}
$changes += ensure_column($db, 'users', 'username', "VARCHAR(100) DEFAULT NULL", 'name') ? 1 : 0;
// Add UNIQUE index on username if column was just added or index doesn't exist
$idxCheck = $db->query("SHOW INDEX FROM users WHERE Key_name = 'idx_username'")->fetch();
if (!$idxCheck) {
    try {
        $db->exec("ALTER TABLE users ADD UNIQUE INDEX idx_username (username)");
        echo "  + Added unique index on username\n";
        $changes++;
    } catch (PDOException $e) {
        // Ignore if duplicate values prevent unique index (shouldn't happen with NULLs)
    }
}

$changes += ensure_column($db, 'users', 'reset_token', "VARCHAR(64) DEFAULT NULL") ? 1 : 0;
$changes += ensure_column($db, 'users', 'reset_token_expires', "DATETIME DEFAULT NULL", 'reset_token') ? 1 : 0;

// ─── Table: posts ───────────────────────────────────────────────────────────

echo "Table: posts\n";
if (!table_exists($db, 'posts')) {
    $db->exec("
        CREATE TABLE posts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            excerpt TEXT,
            content LONGTEXT,
            featured_image TEXT,
            author_id INT NOT NULL,
            status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
            published_date DATETIME,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE INDEX idx_slug (slug),
            INDEX idx_status (status),
            INDEX idx_published_date (published_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "  + Created table\n";
    $changes++;
} else {
    echo "  OK\n";
}

// ─── Table: categories ──────────────────────────────────────────────────────

echo "Table: categories\n";
if (!table_exists($db, 'categories')) {
    $db->exec("
        CREATE TABLE categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            description TEXT,
            UNIQUE INDEX idx_slug (slug)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "  + Created table\n";
    $changes++;
} else {
    echo "  OK\n";
}

// ─── Table: post_categories ─────────────────────────────────────────────────

echo "Table: post_categories\n";
if (!table_exists($db, 'post_categories')) {
    $db->exec("
        CREATE TABLE post_categories (
            post_id INT NOT NULL,
            category_id INT NOT NULL,
            PRIMARY KEY (post_id, category_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "  + Created table\n";
    $changes++;
} else {
    echo "  OK\n";
}

// ─── Table: tags ────────────────────────────────────────────────────────────

echo "Table: tags\n";
if (!table_exists($db, 'tags')) {
    $db->exec("
        CREATE TABLE tags (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "  + Created table\n";
    $changes++;
} else {
    echo "  OK\n";
}

// ─── Table: post_tags ───────────────────────────────────────────────────────

echo "Table: post_tags\n";
if (!table_exists($db, 'post_tags')) {
    $db->exec("
        CREATE TABLE post_tags (
            post_id INT NOT NULL,
            tag_id INT NOT NULL,
            PRIMARY KEY (post_id, tag_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "  + Created table\n";
    $changes++;
} else {
    echo "  OK\n";
}

// ─── Table: pages ───────────────────────────────────────────────────────────

echo "Table: pages\n";
if (!table_exists($db, 'pages')) {
    $db->exec("
        CREATE TABLE pages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            content LONGTEXT,
            color_overrides JSON DEFAULT NULL,
            seo_meta JSON DEFAULT NULL,
            author_id INT NOT NULL,
            status ENUM('draft', 'published', 'private') NOT NULL DEFAULT 'draft',
            published_date DATETIME DEFAULT NULL,
            show_in_menu TINYINT(1) NOT NULL DEFAULT 1,
            menu_order INT NOT NULL DEFAULT 0,
            parent_id INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE INDEX idx_slug (slug),
            INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "  + Created table\n";
    $changes++;
} else {
    // Add columns that may be missing on older installs
    if (ensure_column($db, 'pages', 'color_overrides', 'JSON DEFAULT NULL', 'content')) $changes++;
    if (ensure_column($db, 'pages', 'seo_meta', 'JSON DEFAULT NULL', 'color_overrides')) $changes++;
    if (ensure_column($db, 'pages', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_at')) $changes++;
    if (ensure_column($db, 'pages', 'published_date', 'DATETIME DEFAULT NULL', 'status')) $changes++;

    // Expand status ENUM to include 'private'
    $colInfo = $db->query("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pages' AND COLUMN_NAME = 'status'")->fetchColumn();
    if ($colInfo && strpos($colInfo, "'private'") === false) {
        $db->exec("ALTER TABLE pages MODIFY COLUMN status ENUM('draft','published','private') NOT NULL DEFAULT 'draft'");
        echo "  + Expanded status ENUM to include 'private'\n";
        $changes++;
    }

    // Backfill published_date for existing published pages that have NULL
    $backfilled = $db->exec("UPDATE pages SET published_date = created_at WHERE status = 'published' AND published_date IS NULL");
    if ($backfilled > 0) { echo "  + Backfilled published_date for {$backfilled} pages\n"; $changes++; }

    if ($changes === 0) echo "  OK\n";
}

// ─── Fix dangerous CASCADE on author_id → users ────────────────────────────
// Deleting a user must NOT delete their pages/posts. Change to SET NULL.

foreach (['pages', 'posts'] as $tbl) {
    $fks = $db->query("
        SELECT CONSTRAINT_NAME, DELETE_RULE
        FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = '{$tbl}'
          AND REFERENCED_TABLE_NAME = 'users'
    ")->fetchAll(PDO::FETCH_ASSOC);

    foreach ($fks as $fk) {
        if ($fk['DELETE_RULE'] === 'CASCADE') {
            // author_id must allow NULL for SET NULL to work
            $db->exec("ALTER TABLE `{$tbl}` MODIFY COLUMN author_id INT DEFAULT NULL");
            $db->exec("ALTER TABLE `{$tbl}` DROP FOREIGN KEY `{$fk['CONSTRAINT_NAME']}`");
            $db->exec("ALTER TABLE `{$tbl}` ADD CONSTRAINT `{$fk['CONSTRAINT_NAME']}` FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL");
            echo "  + Fixed {$tbl}.author_id: CASCADE → SET NULL\n";
            $changes++;
        }
    }
}

// ─── Table: settings ────────────────────────────────────────────────────────

echo "Table: settings\n";
if (!table_exists($db, 'settings')) {
    $db->exec("
        CREATE TABLE settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            setting_key VARCHAR(255) NOT NULL UNIQUE,
            setting_value TEXT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    // Default settings
    $defaults = [
        ['site_name', 'Mon Site'],
        ['site_description', ''],
        ['posts_per_page', '10'],
        ['theme_use_child', '0'],
        ['active_theme', 'default'],
        ['active_plugins', '["references","actualites","evenements"]'],
    ];
    $stmt = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)");
    foreach ($defaults as [$key, $val]) {
        $stmt->execute([$key, $val]);
    }
    echo "  + Created table with defaults\n";
    $changes++;
} else {
    echo "  OK\n";
}

// ─── Table: media_folders ───────────────────────────────────────────────────

echo "Table: media_folders\n";
if (!table_exists($db, 'media_folders')) {
    $db->exec("
        CREATE TABLE media_folders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            parent_id INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "  + Created table\n";
    $changes++;
} else {
    echo "  OK\n";
}

// ─── Table: media_items ─────────────────────────────────────────────────────

echo "Table: media_items\n";
if (!table_exists($db, 'media_items')) {
    $db->exec("
        CREATE TABLE media_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            folder_id INT DEFAULT NULL,
            type VARCHAR(20),
            filename VARCHAR(255) NOT NULL,
            original_name VARCHAR(255),
            alt VARCHAR(500) DEFAULT '',
            title VARCHAR(500) DEFAULT '',
            caption TEXT,
            description TEXT,
            mime_type VARCHAR(100),
            size INT,
            width INT,
            height INT,
            url VARCHAR(500),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_folder (folder_id),
            INDEX idx_type (type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "  + Created table\n";
    $changes++;
} else {
    // Add columns that may be missing
    if (ensure_column($db, 'media_items', 'alt', "VARCHAR(500) DEFAULT ''", 'original_name')) $changes++;
    if (ensure_column($db, 'media_items', 'title', "VARCHAR(500) DEFAULT ''", 'alt')) $changes++;
    if (ensure_column($db, 'media_items', 'caption', 'TEXT', 'title')) $changes++;
    if (ensure_column($db, 'media_items', 'description', 'TEXT', 'caption')) $changes++;
    if (ensure_column($db, 'media_items', 'width', 'INT', 'size')) $changes++;
    if (ensure_column($db, 'media_items', 'height', 'INT', 'width')) $changes++;
    // Ensure type column supports 'document' (migrate from ENUM to VARCHAR if needed)
    $typeCol = $db->query("SHOW COLUMNS FROM media_items LIKE 'type'")->fetch();
    if ($typeCol && stripos($typeCol['Type'], 'enum') !== false && stripos($typeCol['Type'], 'document') === false) {
        $db->exec("ALTER TABLE media_items MODIFY COLUMN type VARCHAR(20) NOT NULL");
        echo "  ~ type column: ENUM → VARCHAR(20)\n";
        $changes++;
    }
    if ($changes === 0) echo "  OK\n";
}

// ─── Table: menus ───────────────────────────────────────────────────────────

echo "Table: menus\n";
if (!table_exists($db, 'menus')) {
    $db->exec("
        CREATE TABLE menus (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            location VARCHAR(100) DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "  + Created table\n";

    // Default menus
    $defaultMenus = [
        ['Footer',            'footer'],
        ['Menu principale',   'primary'],
        ['Menu secondaire',   'secondary'],
    ];
    $stmt = $db->prepare("INSERT INTO menus (name, location) VALUES (?, ?)");
    foreach ($defaultMenus as [$name, $loc]) {
        $stmt->execute([$name, $loc]);
        echo "  + Created menu '{$name}' ({$loc})\n";
    }
    $changes++;
} else {
    // Ensure default menus exist
    $defaultMenus = [
        ['Footer',            'footer'],
        ['Menu principale',   'primary'],
        ['Menu secondaire',   'secondary'],
    ];
    $menuChanges = 0;
    $check = $db->prepare("SELECT id FROM menus WHERE location = ?");
    $insert = $db->prepare("INSERT INTO menus (name, location) VALUES (?, ?)");
    foreach ($defaultMenus as [$name, $loc]) {
        $check->execute([$loc]);
        if (!$check->fetch()) {
            $insert->execute([$name, $loc]);
            echo "  + Created menu '{$name}' ({$loc})\n";
            $menuChanges++;
        }
    }
    $changes += $menuChanges;
    if ($menuChanges === 0) echo "  OK\n";
}

// ─── Table: menu_items ──────────────────────────────────────────────────────

echo "Table: menu_items\n";
if (!table_exists($db, 'menu_items')) {
    $db->exec("
        CREATE TABLE menu_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            menu_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            url VARCHAR(500) DEFAULT NULL,
            type VARCHAR(50) NOT NULL DEFAULT 'custom',
            page_id INT DEFAULT NULL,
            parent_id INT DEFAULT NULL,
            menu_order INT NOT NULL DEFAULT 0,
            open_in_new_tab TINYINT(1) NOT NULL DEFAULT 0,
            INDEX idx_menu (menu_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "  + Created table\n";
    $changes++;
} else {
    if (ensure_column($db, 'menu_items', 'open_in_new_tab', "TINYINT(1) NOT NULL DEFAULT 0", 'menu_order')) $changes++;
    if ($changes === 0) echo "  OK\n";
}

// ─── Table: reusable_blocs ──────────────────────────────────────────────────

echo "Table: reusable_blocs\n";
if (!table_exists($db, 'reusable_blocs')) {
    $db->exec("
        CREATE TABLE reusable_blocs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            content LONGTEXT,
            status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
            author_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "  + Created table\n";
    $changes++;
} else {
    echo "  OK\n";
}

// ─── Table: forms ───────────────────────────────────────────────────────────

echo "Table: forms\n";
if (!table_exists($db, 'forms')) {
    $db->exec("
        CREATE TABLE forms (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            description TEXT,
            settings JSON DEFAULT NULL,
            status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "  + Created table\n";
    $changes++;
} else {
    echo "  OK\n";
}

// ─── Table: form_fields ─────────────────────────────────────────────────────

echo "Table: form_fields\n";
if (!table_exists($db, 'form_fields')) {
    $db->exec("
        CREATE TABLE form_fields (
            id INT AUTO_INCREMENT PRIMARY KEY,
            form_id INT NOT NULL,
            type VARCHAR(50) NOT NULL,
            label VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            placeholder VARCHAR(255) DEFAULT '',
            required TINYINT(1) NOT NULL DEFAULT 0,
            options JSON DEFAULT NULL,
            validation JSON DEFAULT NULL,
            field_order INT NOT NULL DEFAULT 0,
            settings JSON DEFAULT NULL,
            INDEX idx_form (form_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "  + Created table\n";
    $changes++;
} else {
    echo "  OK\n";
}

// ─── Table: form_entries ────────────────────────────────────────────────────

echo "Table: form_entries\n";
if (!table_exists($db, 'form_entries')) {
    $db->exec("
        CREATE TABLE form_entries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            form_id INT NOT NULL,
            ip_address VARCHAR(45),
            user_agent TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'new',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_form (form_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "  + Created table\n";
    $changes++;
} else {
    echo "  OK\n";
}

// ─── Table: form_entry_values ───────────────────────────────────────────────

echo "Table: form_entry_values\n";
if (!table_exists($db, 'form_entry_values')) {
    $db->exec("
        CREATE TABLE form_entry_values (
            id INT AUTO_INCREMENT PRIMARY KEY,
            entry_id INT NOT NULL,
            field_id INT DEFAULT NULL,
            field_label VARCHAR(255),
            field_value TEXT,
            INDEX idx_entry (entry_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "  + Created table\n";
    $changes++;
} else {
    echo "  OK\n";
}

// ─── CPT tables (from plugins) ──────────────────────────────────────────────

echo "\nCustom Post Types (plugins):\n";
$pluginsDir = __DIR__ . '/../plugins';
if (is_dir($pluginsDir)) {
    foreach (scandir($pluginsDir) as $dir) {
        $manifest = $pluginsDir . '/' . $dir . '/plugin.json';
        if (!file_exists($manifest)) continue;

        $plugin = json_decode(file_get_contents($manifest), true);
        if (!$plugin || empty($plugin['postTypes'])) continue;

        foreach ($plugin['postTypes'] as $pt) {
            $slug = $pt['slug'];
            $table = "cpt_{$slug}";

            echo "  Table: {$table}\n";
            if (!table_exists($db, $table)) {
                $db->exec("
                    CREATE TABLE `{$table}` (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        title VARCHAR(255) NOT NULL,
                        slug VARCHAR(255) NOT NULL,
                        excerpt TEXT,
                        content LONGTEXT,
                        featured_image JSON DEFAULT NULL,
                        custom_fields JSON DEFAULT NULL,
                        author_id INT NOT NULL,
                        status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
                        published_date DATETIME,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        UNIQUE INDEX idx_slug (slug)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
                echo "    + Created table\n";
                $changes++;
            } else {
                echo "    OK\n";
            }

            if (!empty($pt['hasCategories'])) {
                $catTable = "cpt_{$slug}_categories";
                $mapTable = "cpt_{$slug}_category_map";

                if (!table_exists($db, $catTable)) {
                    $db->exec("
                        CREATE TABLE `{$catTable}` (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            name VARCHAR(255) NOT NULL,
                            slug VARCHAR(255) NOT NULL,
                            UNIQUE INDEX idx_slug (slug)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    ");
                    echo "    + Created {$catTable}\n";
                    $changes++;
                }

                if (!table_exists($db, $mapTable)) {
                    $db->exec("
                        CREATE TABLE `{$mapTable}` (
                            item_id INT NOT NULL,
                            category_id INT NOT NULL,
                            PRIMARY KEY (item_id, category_id)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    ");
                    echo "    + Created {$mapTable}\n";
                    $changes++;
                }
            }
        }
    }
} else {
    echo "  No plugins directory found\n";
}

// ─── AI Credits ─────────────────────────────────────────────────────────────

echo "\nAI Credits:\n";

echo "Table: ai_credits\n";
if (!table_exists($db, 'ai_credits')) {
    $db->exec("
        CREATE TABLE ai_credits (
            id INT AUTO_INCREMENT PRIMARY KEY,
            credits DECIMAL(12,4) NOT NULL DEFAULT 0,
            source ENUM('manual', 'monthly_reset') NOT NULL DEFAULT 'manual',
            note VARCHAR(255) DEFAULT NULL,
            added_by INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    // Default: 2€ initial credits
    $db->exec("INSERT INTO ai_credits (credits, source, note) VALUES (2.0000, 'manual', 'Crédit initial à la création du site')");
    echo "  + Created table with 2€ initial credits\n";
    $changes++;
} else {
    echo "  OK\n";
}

echo "Table: ai_credit_usage\n";
if (!table_exists($db, 'ai_credit_usage')) {
    $db->exec("
        CREATE TABLE ai_credit_usage (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            model VARCHAR(50) NOT NULL,
            input_tokens INT NOT NULL DEFAULT 0,
            output_tokens INT NOT NULL DEFAULT 0,
            credits_used DECIMAL(12,6) NOT NULL DEFAULT 0,
            prompt_summary VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_id (user_id),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "  + Created table\n";
    $changes++;
} else {
    echo "  OK\n";
}

// Recalculate haiku pricing (was $0.25/$1.25 per MTok, correct is $1.00/$5.00)
echo "AI pricing fix (Haiku 4.5):\n";
$stmt = $db->prepare("
    SELECT COUNT(*) FROM ai_credit_usage
    WHERE model = 'haiku'
    AND credits_used > 0
    AND ABS(credits_used - ((input_tokens / 1000000.0) * 0.25 + (output_tokens / 1000000.0) * 1.25)) < 0.000001
");
$stmt->execute();
$oldPricingCount = (int) $stmt->fetchColumn();

if ($oldPricingCount > 0) {
    $db->exec("
        UPDATE ai_credit_usage
        SET credits_used = (input_tokens / 1000000.0) * 1.00 + (output_tokens / 1000000.0) * 5.00
        WHERE model = 'haiku'
    ");
    echo "  + Recalculated {$oldPricingCount} haiku entries with correct Haiku 4.5 pricing\n";
    $changes++;
} else {
    echo "  OK (already correct)\n";
}

// ─── Summary ────────────────────────────────────────────────────────────────

echo "\n=== Done! ";
if ($changes > 0) {
    echo "{$changes} change(s) applied. ===\n";
} else {
    echo "Database is up to date. ===\n";
}
