<?php
/**
 * PoolpMigrationController — création des tables custom du plugin POOLP.
 *
 * - Idempotent (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS).
 * - Appelé par migrate.php du monorepo via le hook "poolp_migrate" enregistré
 *   par autoload.php du plugin (cf. backend/autoload.php).
 * - Les CPT cpt_poolp_* sont créés par CustomPostTypeController via plugin.json
 *   (rien à faire ici pour eux).
 */
class PoolpMigrationController {

    public static function migrate(?callable $log = null): int {
        $log = $log ?? fn(string $msg) => print($msg . "\n");
        $db = Database::getInstance();
        $changes = 0;

        $log('  POOLP plugin tables:');

        // ── Zones de livraison spécifiques au configurateur POOLP ───────────
        $changes += self::createTable($db, 'poolp_delivery_zones', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            zone_label VARCHAR(255) NOT NULL,
            postal_codes JSON NOT NULL,
            delay_label VARCHAR(255) DEFAULT NULL,
            fee_kit_ttc_cents INT DEFAULT 0,
            fee_assembled_ttc_cents INT DEFAULT 0,
            fee_kit_pro_ht_cents INT DEFAULT 0,
            fee_assembled_pro_ht_cents INT DEFAULT 0,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            sort_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_active (is_active)
        ", $log) ? 1 : 0;

        // ── Projets sauvegardés (token public + lien email) ─────────────────
        $changes += self::createTable($db, 'poolp_projects', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            public_token VARCHAR(64) NOT NULL,
            customer_id INT DEFAULT NULL,
            customer_email VARCHAR(255) DEFAULT NULL,
            state JSON NOT NULL,
            pdf_path VARCHAR(500) DEFAULT NULL,
            status ENUM('draft','saved','quote_requested','converted_to_cart','ordered') DEFAULT 'draft',
            is_erp TINYINT(1) NOT NULL DEFAULT 0,
            qualif_pro_asked TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_token (public_token),
            INDEX idx_customer (customer_id),
            INDEX idx_status (status)
        ", $log) ? 1 : 0;

        // ── Line items custom : configurations POOLP ajoutées au panier ─────
        // Ne dépend pas de la table carts si elle n'existe pas (sites sans ecommerce
        // n'auront simplement pas accès à l'add-to-cart, mais la table peut exister).
        if (self::tableExists($db, 'carts')) {
            $changes += self::createTable($db, 'cart_items_custom', "
                id INT AUTO_INCREMENT PRIMARY KEY,
                cart_id INT NOT NULL,
                source_type VARCHAR(64) NOT NULL,
                source_id INT DEFAULT NULL,
                title VARCHAR(255) NOT NULL,
                config_snapshot JSON NOT NULL,
                unit_price_ttc_cents INT NOT NULL,
                unit_price_pro_ht_cents INT DEFAULT NULL,
                quantity INT NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
                INDEX idx_cart (cart_id),
                INDEX idx_source (source_type, source_id)
            ", $log) ? 1 : 0;
        } else {
            $log("    SKIP cart_items_custom (carts table not present — install ecommerce plugin first)");
        }

        // ── Ajout colonne discount_rate sur customers (pour tarifs pros) ────
        // Le calcul Bronze/Argent/Or/Platine est hors plugin — POOLP lit juste cette
        // colonne pour appliquer la remise. On la crée si absente, on ne touche
        // pas à customers.is_pro qui existe déjà côté ecommerce.
        if (self::tableExists($db, 'customers')) {
            $changes += self::ensureColumn(
                $db,
                'customers',
                'discount_rate',
                'DECIMAL(5,4) NOT NULL DEFAULT 0',
                'is_pro',
                $log
            ) ? 1 : 0;
            $changes += self::ensureColumn(
                $db,
                'customers',
                'discount_rate_override',
                'TINYINT(1) NOT NULL DEFAULT 0',
                'discount_rate',
                $log
            ) ? 1 : 0;
        }

        return $changes;
    }

    private static function createTable(PDO $db, string $name, string $columns, callable $log): bool {
        if (self::tableExists($db, $name)) {
            $log("    OK {$name}");
            return false;
        }
        $safeName = preg_replace('/[^a-zA-Z0-9_]/', '', $name);
        $db->exec("CREATE TABLE `{$safeName}` ({$columns}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $log("    + Created {$name}");
        return true;
    }

    private static function tableExists(PDO $db, string $table): bool {
        $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
        return (bool) $db->query("SHOW TABLES LIKE '{$safe}'")->fetch();
    }

    private static function ensureColumn(PDO $db, string $table, string $column, string $definition, ?string $after, callable $log): bool {
        $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
        $cols = $db->query("SHOW COLUMNS FROM `{$safe}`")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($cols as $c) {
            if ($c['Field'] === $column) return false;
        }
        $sql = "ALTER TABLE `{$safe}` ADD COLUMN `{$column}` {$definition}";
        if ($after) $sql .= " AFTER `{$after}`";
        $db->exec($sql);
        $log("    + Added column {$table}.{$column}");
        return true;
    }
}
