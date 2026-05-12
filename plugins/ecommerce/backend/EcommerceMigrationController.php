<?php

/**
 * Migration e-commerce : crée toutes les tables natives en une passe idempotente.
 * Les CPT (products + product_categories) sont gérés par CustomPostTypeController via plugin.json.
 *
 * Ordre d'exécution : customers avant orders (FK), puis tables satellites produits,
 * panier, checkout/paiement, shipping/tax/coupons, factures, digital, devis, RGPD.
 */
class EcommerceMigrationController {

    public static function migrate(?callable $log = null): int {
        $db = Database::getInstance();
        $log = $log ?? fn(string $msg) => print($msg . "\n");
        $changes = 0;

        $log('  E-commerce tables:');

        // ── PHASE 1 : Customers ─────────────────────────────────────────────
        $changes += self::createTable($db, 'customers', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(191) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            first_name VARCHAR(100) DEFAULT NULL,
            last_name VARCHAR(100) DEFAULT NULL,
            phone VARCHAR(30) DEFAULT NULL,
            company VARCHAR(150) DEFAULT NULL,
            vat_number VARCHAR(30) DEFAULT NULL,
            is_pro TINYINT(1) NOT NULL DEFAULT 0,
            accepts_marketing TINYINT(1) NOT NULL DEFAULT 0,
            email_verified_at DATETIME DEFAULT NULL,
            verification_token VARCHAR(64) DEFAULT NULL,
            locale VARCHAR(10) DEFAULT 'fr',
            last_login_at DATETIME DEFAULT NULL,
            last_activity_at DATETIME DEFAULT NULL,
            inactivity_warning_sent_at DATETIME DEFAULT NULL,
            anonymized_at DATETIME DEFAULT NULL,
            anonymization_reason ENUM('user_request','inactivity_purge','admin_manual') DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_email (email),
            INDEX idx_last_activity (last_activity_at),
            INDEX idx_anonymized (anonymized_at)
        ", $log) ? 1 : 0;

        // Pro signup workflow : siret + activity persistés ; pro_status gate
        // is_pro=1 (interdit l'auto-promotion à l'inscription, exige validation
        // manuelle admin).
        if (self::tableExists($db, 'customers')) {
            if (self::ensureColumn($db, 'customers', 'siret', "VARCHAR(20) DEFAULT NULL", 'vat_number', $log)) $changes++;
            if (self::ensureColumn($db, 'customers', 'activity', "VARCHAR(40) DEFAULT NULL", 'siret', $log)) $changes++;
            if (self::ensureColumn($db, 'customers', 'pro_status', "ENUM('none','pending','approved','rejected') NOT NULL DEFAULT 'none'", 'is_pro', $log)) $changes++;
            if (self::ensureColumn($db, 'customers', 'discount_rate', "DECIMAL(5,2) DEFAULT NULL", 'pro_status', $log)) $changes++;
            if (self::ensureColumn($db, 'customers', 'discount_override', "TINYINT(1) NOT NULL DEFAULT 0", 'discount_rate', $log)) $changes++;
        }

        $changes += self::createTable($db, 'customer_addresses', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT NOT NULL,
            type ENUM('billing','shipping') NOT NULL,
            is_default TINYINT(1) NOT NULL DEFAULT 0,
            first_name VARCHAR(100) DEFAULT NULL,
            last_name VARCHAR(100) DEFAULT NULL,
            company VARCHAR(150) DEFAULT NULL,
            address_line1 VARCHAR(255) DEFAULT NULL,
            address_line2 VARCHAR(255) DEFAULT NULL,
            postcode VARCHAR(20) DEFAULT NULL,
            city VARCHAR(100) DEFAULT NULL,
            region VARCHAR(100) DEFAULT NULL,
            country_code CHAR(2) NOT NULL DEFAULT 'FR',
            phone VARCHAR(30) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_customer_type (customer_id, type),
            CONSTRAINT fk_customer_addresses_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        ", $log) ? 1 : 0;

        $changes += self::createTable($db, 'customer_password_resets', "
            token VARCHAR(64) PRIMARY KEY,
            customer_id INT NOT NULL,
            expires_at DATETIME NOT NULL,
            used_at DATETIME DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_expires (expires_at),
            CONSTRAINT fk_customer_pwd_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        ", $log) ? 1 : 0;

        // ── PHASE 2 : Product satellites (variants, images) ─────────────────
        $changes += self::createTable($db, 'product_variants', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_id INT NOT NULL,
            sku VARCHAR(80) NOT NULL,
            attributes JSON DEFAULT NULL,
            price_cents INT NOT NULL DEFAULT 0,
            compare_at_price_cents INT DEFAULT NULL,
            weight_grams INT DEFAULT NULL,
            stock_quantity INT NOT NULL DEFAULT 0,
            stock_managed TINYINT(1) NOT NULL DEFAULT 1,
            low_stock_threshold INT DEFAULT 5,
            barcode VARCHAR(50) DEFAULT NULL,
            position INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_sku (sku),
            INDEX idx_product (product_id),
            INDEX idx_price (price_cents),
            INDEX idx_stock (stock_quantity)
        ", $log) ? 1 : 0;

        $changes += self::createTable($db, 'product_images', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_id INT NOT NULL,
            variant_id INT DEFAULT NULL,
            media_id INT NOT NULL,
            position INT NOT NULL DEFAULT 0,
            alt TEXT,
            INDEX idx_product (product_id),
            INDEX idx_variant (variant_id)
        ", $log) ? 1 : 0;

        // Extensions cpt_products_categories pour hiérarchie (ajout colonnes si existe)
        if (self::tableExists($db, 'cpt_products_categories')) {
            if (self::ensureColumn($db, 'cpt_products_categories', 'parent_id', 'INT DEFAULT NULL', 'slug', $log)) $changes++;
            if (self::ensureColumn($db, 'cpt_products_categories', 'path', 'VARCHAR(500) DEFAULT NULL', 'parent_id', $log)) $changes++;
            if (self::ensureColumn($db, 'cpt_products_categories', 'level', 'TINYINT UNSIGNED DEFAULT 0', 'path', $log)) $changes++;
            if (self::ensureColumn($db, 'cpt_products_categories', 'position', 'INT DEFAULT 0', 'level', $log)) $changes++;
            if (self::ensureColumn($db, 'cpt_products_categories', 'description', 'TEXT', 'position', $log)) $changes++;
            if (self::ensureColumn($db, 'cpt_products_categories', 'featured_image', 'JSON DEFAULT NULL', 'description', $log)) $changes++;
            if (self::ensureColumn($db, 'cpt_products_categories', 'seo_meta', 'JSON DEFAULT NULL', 'featured_image', $log)) $changes++;
        }

        // ── PHASE 3 : Cart ──────────────────────────────────────────────────
        $changes += self::createTable($db, 'carts', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            token VARCHAR(64) NOT NULL UNIQUE,
            customer_id INT DEFAULT NULL,
            currency CHAR(3) NOT NULL DEFAULT 'EUR',
            coupon_code VARCHAR(50) DEFAULT NULL,
            shipping_method_id INT DEFAULT NULL,
            shipping_address_json JSON DEFAULT NULL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            INDEX idx_customer (customer_id),
            INDEX idx_expires (expires_at),
            CONSTRAINT fk_carts_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
        ", $log) ? 1 : 0;

        $changes += self::createTable($db, 'cart_items', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            cart_id INT NOT NULL,
            variant_id INT NOT NULL,
            product_id INT NOT NULL,
            quantity INT NOT NULL DEFAULT 1,
            unit_price_cents INT NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_cart_variant (cart_id, variant_id),
            INDEX idx_cart (cart_id),
            CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
            CONSTRAINT fk_cart_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
        ", $log) ? 1 : 0;

        // ── PHASE 4 : Tax, shipping, coupons ────────────────────────────────
        $changes += self::createTable($db, 'tax_rates', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(30) NOT NULL UNIQUE,
            label VARCHAR(100) NOT NULL,
            rate DECIMAL(5,2) NOT NULL,
            country_code CHAR(2) NOT NULL DEFAULT 'FR',
            is_default TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_country (country_code)
        ", $log) ? 1 : 0;

        $changes += self::createTable($db, 'shipping_zones', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            countries JSON NOT NULL,
            regions JSON DEFAULT NULL,
            postcode_patterns JSON DEFAULT NULL,
            priority INT NOT NULL DEFAULT 0,
            position INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ", $log) ? 1 : 0;

        $changes += self::createTable($db, 'shipping_methods', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            zone_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            description VARCHAR(255) DEFAULT NULL,
            type ENUM('flat','free','weight','price') NOT NULL DEFAULT 'flat',
            price_cents INT NOT NULL DEFAULT 0,
            free_threshold_cents INT DEFAULT NULL,
            weight_tiers JSON DEFAULT NULL,
            tax_code VARCHAR(30) DEFAULT NULL,
            delivery_min_days INT DEFAULT NULL,
            delivery_max_days INT DEFAULT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            position INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_zone_active (zone_id, is_active),
            CONSTRAINT fk_shipping_methods_zone FOREIGN KEY (zone_id) REFERENCES shipping_zones(id) ON DELETE CASCADE
        ", $log) ? 1 : 0;

        $changes += self::createTable($db, 'coupons', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(50) NOT NULL UNIQUE,
            type ENUM('percent','fixed','free_shipping') NOT NULL,
            value_cents INT DEFAULT NULL,
            percent DECIMAL(5,2) DEFAULT NULL,
            min_subtotal_cents INT DEFAULT NULL,
            max_uses INT DEFAULT NULL,
            max_uses_per_customer INT DEFAULT NULL,
            used_count INT NOT NULL DEFAULT 0,
            starts_at DATETIME DEFAULT NULL,
            expires_at DATETIME DEFAULT NULL,
            applies_to ENUM('all','products','categories') NOT NULL DEFAULT 'all',
            applies_ids JSON DEFAULT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_active (is_active)
        ", $log) ? 1 : 0;

        $changes += self::createTable($db, 'coupon_usages', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            coupon_id INT NOT NULL,
            customer_id INT DEFAULT NULL,
            order_id INT DEFAULT NULL,
            discount_cents INT NOT NULL DEFAULT 0,
            used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_coupon_customer (coupon_id, customer_id),
            INDEX idx_order (order_id),
            CONSTRAINT fk_coupon_usages_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
        ", $log) ? 1 : 0;

        // ── PHASE 5 : Orders ────────────────────────────────────────────────
        $changes += self::createTable($db, 'orders', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_number VARCHAR(30) NOT NULL UNIQUE,
            customer_id INT DEFAULT NULL,
            email VARCHAR(191) NOT NULL,
            status ENUM('pending','awaiting_payment','paid','processing','shipped','delivered','cancelled','refunded','failed') NOT NULL DEFAULT 'pending',
            payment_status ENUM('unpaid','pending','paid','partially_refunded','refunded','failed','refund_failed','refund_pending') NOT NULL DEFAULT 'unpaid',
            payment_method ENUM('stripe','paypal','bank_transfer','on_invoice') NOT NULL,
            currency CHAR(3) NOT NULL DEFAULT 'EUR',
            subtotal_cents INT NOT NULL,
            discount_cents INT NOT NULL DEFAULT 0,
            shipping_cents INT NOT NULL DEFAULT 0,
            tax_cents INT NOT NULL DEFAULT 0,
            total_cents INT NOT NULL,
            tax_breakdown JSON DEFAULT NULL,
            coupon_code VARCHAR(50) DEFAULT NULL,
            shipping_method_id INT DEFAULT NULL,
            shipping_method_label VARCHAR(150) DEFAULT NULL,
            notes TEXT,
            ip_address VARCHAR(45) DEFAULT NULL,
            placed_at DATETIME NOT NULL,
            paid_at DATETIME DEFAULT NULL,
            shipped_at DATETIME DEFAULT NULL,
            delivered_at DATETIME DEFAULT NULL,
            cancelled_at DATETIME DEFAULT NULL,
            cancelled_by ENUM('customer','admin','system') DEFAULT NULL,
            cancelled_by_id INT DEFAULT NULL,
            cancellation_reason TEXT,
            cancellation_deadline DATETIME DEFAULT NULL,
            tracking_number VARCHAR(100) DEFAULT NULL,
            tracking_url VARCHAR(500) DEFAULT NULL,
            guest_token VARCHAR(64) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_customer (customer_id),
            INDEX idx_status (status),
            INDEX idx_email (email),
            INDEX idx_placed (placed_at),
            INDEX idx_status_placed (status, placed_at),
            CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
        ", $log) ? 1 : 0;

        $changes += self::createTable($db, 'order_items', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            product_id INT NOT NULL,
            variant_id INT NOT NULL,
            sku VARCHAR(80) NOT NULL,
            product_title VARCHAR(255) NOT NULL,
            variant_attributes JSON DEFAULT NULL,
            quantity INT NOT NULL,
            unit_price_cents INT NOT NULL,
            tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
            line_subtotal_cents INT NOT NULL,
            line_tax_cents INT NOT NULL DEFAULT 0,
            line_total_cents INT NOT NULL,
            is_digital TINYINT(1) NOT NULL DEFAULT 0,
            requires_shipping TINYINT(1) NOT NULL DEFAULT 1,
            INDEX idx_order (order_id),
            INDEX idx_product (product_id),
            CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        ", $log) ? 1 : 0;

        $changes += self::createTable($db, 'order_addresses', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            type ENUM('billing','shipping') NOT NULL,
            first_name VARCHAR(100) DEFAULT NULL,
            last_name VARCHAR(100) DEFAULT NULL,
            company VARCHAR(150) DEFAULT NULL,
            address_line1 VARCHAR(255) DEFAULT NULL,
            address_line2 VARCHAR(255) DEFAULT NULL,
            postcode VARCHAR(20) DEFAULT NULL,
            city VARCHAR(100) DEFAULT NULL,
            region VARCHAR(100) DEFAULT NULL,
            country_code CHAR(2) DEFAULT NULL,
            phone VARCHAR(30) DEFAULT NULL,
            email VARCHAR(191) DEFAULT NULL,
            vat_number VARCHAR(30) DEFAULT NULL,
            UNIQUE KEY uk_order_type (order_id, type),
            CONSTRAINT fk_order_addresses_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        ", $log) ? 1 : 0;

        $changes += self::createTable($db, 'order_events', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            type VARCHAR(50) NOT NULL,
            payload JSON DEFAULT NULL,
            actor_type ENUM('system','customer','admin','webhook') NOT NULL DEFAULT 'system',
            actor_id INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_order (order_id),
            CONSTRAINT fk_order_events_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        ", $log) ? 1 : 0;

        // ── PHASE 6 : Payments ──────────────────────────────────────────────
        $changes += self::createTable($db, 'payment_intents', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            provider ENUM('stripe','paypal') NOT NULL,
            provider_intent_id VARCHAR(191) NOT NULL,
            client_secret VARCHAR(255) DEFAULT NULL,
            amount_cents INT NOT NULL,
            currency CHAR(3) NOT NULL DEFAULT 'EUR',
            status VARCHAR(50) NOT NULL,
            payment_method_type VARCHAR(50) DEFAULT NULL,
            raw_response JSON DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_provider_intent (provider, provider_intent_id),
            INDEX idx_order (order_id),
            CONSTRAINT fk_payment_intents_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        ", $log) ? 1 : 0;

        $changes += self::createTable($db, 'payment_events', "
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            provider ENUM('stripe','paypal') NOT NULL,
            event_id VARCHAR(191) NOT NULL,
            event_type VARCHAR(100) NOT NULL,
            payload JSON NOT NULL,
            processed_at DATETIME DEFAULT NULL,
            processing_error TEXT,
            received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_provider_event (provider, event_id),
            INDEX idx_processed (processed_at)
        ", $log) ? 1 : 0;

        // ── PHASE 7 : Stock holds ───────────────────────────────────────────
        $changes += self::createTable($db, 'stock_holds', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            variant_id INT NOT NULL,
            order_id INT DEFAULT NULL,
            cart_token VARCHAR(64) DEFAULT NULL,
            quantity INT NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_variant (variant_id),
            INDEX idx_expires (expires_at),
            INDEX idx_order (order_id)
        ", $log) ? 1 : 0;

        // ── PHASE 8 : Invoices & credit notes ───────────────────────────────
        $changes += self::createTable($db, 'invoices', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            invoice_number VARCHAR(30) NOT NULL UNIQUE,
            year SMALLINT NOT NULL,
            total_cents INT NOT NULL,
            tax_cents INT NOT NULL,
            pdf_path VARCHAR(500) NOT NULL,
            issued_at DATETIME NOT NULL,
            archived TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_order (order_id),
            INDEX idx_year (year),
            CONSTRAINT fk_invoices_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT
        ", $log) ? 1 : 0;

        $changes += self::createTable($db, 'credit_notes', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_id INT NOT NULL,
            credit_number VARCHAR(30) NOT NULL UNIQUE,
            reason TEXT,
            amount_cents INT NOT NULL,
            pdf_path VARCHAR(500) NOT NULL,
            issued_at DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_invoice (invoice_id),
            CONSTRAINT fk_credit_notes_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT
        ", $log) ? 1 : 0;

        // ── PHASE 9 : Digital downloads ─────────────────────────────────────
        $changes += self::createTable($db, 'digital_downloads', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_item_id INT NOT NULL,
            customer_id INT DEFAULT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            download_limit INT DEFAULT NULL,
            download_count INT NOT NULL DEFAULT 0,
            expires_at DATETIME DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_order_item (order_item_id),
            INDEX idx_customer (customer_id),
            CONSTRAINT fk_digital_downloads_oi FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
        ", $log) ? 1 : 0;

        $changes += self::createTable($db, 'download_tokens', "
            token VARCHAR(64) PRIMARY KEY,
            download_id INT NOT NULL,
            customer_id INT DEFAULT NULL,
            expires_at DATETIME NOT NULL,
            used_count INT NOT NULL DEFAULT 0,
            last_ip VARCHAR(45) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_expires (expires_at),
            CONSTRAINT fk_download_tokens_download FOREIGN KEY (download_id) REFERENCES digital_downloads(id) ON DELETE CASCADE
        ", $log) ? 1 : 0;

        // ── PHASE 11 : Quote requests ───────────────────────────────────────
        $changes += self::createTable($db, 'quote_requests', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            quote_number VARCHAR(30) DEFAULT NULL UNIQUE,
            customer_id INT DEFAULT NULL,
            email VARCHAR(191) NOT NULL,
            first_name VARCHAR(100) DEFAULT NULL,
            last_name VARCHAR(100) DEFAULT NULL,
            company VARCHAR(150) DEFAULT NULL,
            phone VARCHAR(30) DEFAULT NULL,
            message TEXT NOT NULL,
            items JSON DEFAULT NULL,
            status ENUM('new','in_progress','sent','accepted','rejected','expired') NOT NULL DEFAULT 'new',
            admin_notes TEXT,
            pdf_path VARCHAR(500) DEFAULT NULL,
            total_cents INT DEFAULT NULL,
            valid_until DATE DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            sent_at DATETIME DEFAULT NULL,
            INDEX idx_status (status),
            INDEX idx_email (email),
            CONSTRAINT fk_quote_requests_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
        ", $log) ? 1 : 0;

        // ── PHASE 13 : Stats cache ──────────────────────────────────────────
        $changes += self::createTable($db, 'stats_cache', "
            cache_key VARCHAR(100) PRIMARY KEY,
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            data JSON NOT NULL,
            generated_at DATETIME NOT NULL,
            INDEX idx_period (period_start, period_end)
        ", $log) ? 1 : 0;

        // ── PHASE 14 : RGPD ─────────────────────────────────────────────────
        $changes += self::createTable($db, 'gdpr_erasure_log', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT DEFAULT NULL,
            customer_email_hash VARCHAR(64) NOT NULL,
            reason ENUM('user_request','inactivity_purge','admin_manual') NOT NULL,
            requested_by_type ENUM('customer','admin','system') NOT NULL,
            requested_by_id INT DEFAULT NULL,
            performed_at DATETIME NOT NULL,
            fields_erased JSON NOT NULL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_performed (performed_at)
        ", $log) ? 1 : 0;

        $changes += self::createTable($db, 'gdpr_erasure_requests', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT NOT NULL,
            requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            admin_reviewed_at DATETIME DEFAULT NULL,
            admin_user_id INT DEFAULT NULL,
            status ENUM('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
            notes TEXT,
            INDEX idx_status (status),
            CONSTRAINT fk_gdpr_req_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        ", $log) ? 1 : 0;

        // ── PHASE 15 : Consolidation (tables fusionnées) ────────────────────
        // Étape additive : crée les nouvelles tables + colonnes JSON cibles.
        // Les data migrations + DROP des anciennes tables sont gérés par
        // self::consolidateLegacyTables() une fois les controllers à jour.
        self::consolidateAdditive($db, $log, $changes);

        // ── PHASE 16 : Cart items custom (POOLP configurator) ───────────────
        // Référencée par CartController/OrderController, jamais créée jusqu'ici.
        $changes += self::createTable($db, 'cart_items_custom', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            cart_id INT NOT NULL,
            source_type VARCHAR(50) NOT NULL,
            source_id INT DEFAULT NULL,
            title VARCHAR(255) NOT NULL,
            config_snapshot JSON DEFAULT NULL,
            quantity INT NOT NULL DEFAULT 1,
            unit_price_ttc_cents INT NOT NULL,
            unit_price_pro_ht_cents INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_cart (cart_id),
            CONSTRAINT fk_cart_items_custom_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE
        ", $log) ? 1 : 0;

        // ── Default data : TVA FR ───────────────────────────────────────────
        self::seedDefaultTaxRates($db, $log, $changes);

        // ── Default settings e-commerce ─────────────────────────────────────
        self::seedDefaultSettings($db, $log, $changes);

        return $changes;
    }

    /**
     * Consolidation additive : nouvelles tables + colonnes JSON cibles.
     * Idempotent. Aucune perte de donnée, aucun DROP.
     *
     * Tables cibles :
     *   - tokens          (absorbera customer_password_resets + download_tokens)
     *   - audit_log       (absorbera order_events + payment_events)
     *   - shipping_classes (utilisée par éditeur produit, onglet Expédition)
     *
     * Colonnes ajoutées :
     *   - product_variants.images          JSON (absorbera product_images)
     *   - orders.billing_address           JSON (absorbera order_addresses billing)
     *   - orders.shipping_address          JSON (absorbera order_addresses shipping)
     *   - order_items.download_meta        JSON (absorbera digital_downloads)
     *   - invoices.type                    ENUM (absorbera credit_notes)
     *   - customers.stripe_customer_id     VARCHAR (Stripe saved payment methods)
     */
    private static function consolidateAdditive(PDO $db, callable $log, int &$changes): void {
        // Nouvelles tables unifiées
        $changes += self::createTable($db, 'tokens', "
            token VARCHAR(64) PRIMARY KEY,
            type ENUM('password_reset','download','email_verification') NOT NULL,
            customer_id INT DEFAULT NULL,
            related_id INT DEFAULT NULL,
            payload JSON DEFAULT NULL,
            expires_at DATETIME NOT NULL,
            used_at DATETIME DEFAULT NULL,
            used_count INT NOT NULL DEFAULT 0,
            last_ip VARCHAR(45) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_type_expires (type, expires_at),
            INDEX idx_customer (customer_id),
            INDEX idx_related (related_id),
            CONSTRAINT fk_tokens_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        ", $log) ? 1 : 0;

        $changes += self::createTable($db, 'audit_log', "
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            entity_type ENUM('order','payment','customer','product','quote') NOT NULL,
            entity_id INT DEFAULT NULL,
            event_type VARCHAR(100) NOT NULL,
            provider VARCHAR(30) DEFAULT NULL,
            provider_event_id VARCHAR(191) DEFAULT NULL,
            actor_type ENUM('system','customer','admin','webhook') NOT NULL DEFAULT 'system',
            actor_id INT DEFAULT NULL,
            payload JSON DEFAULT NULL,
            processed_at DATETIME DEFAULT NULL,
            processing_error TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_provider_event (provider, provider_event_id),
            INDEX idx_entity (entity_type, entity_id),
            INDEX idx_created (created_at)
        ", $log) ? 1 : 0;

        // SEPA Direct Debit mandates
        $changes += self::createTable($db, 'sepa_mandates', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT NOT NULL,
            stripe_customer_id VARCHAR(100) DEFAULT NULL,
            stripe_payment_method_id VARCHAR(100) DEFAULT NULL,
            stripe_setup_intent_id VARCHAR(100) DEFAULT NULL,
            iban_last4 VARCHAR(4) DEFAULT NULL,
            bank_name VARCHAR(100) DEFAULT NULL,
            mandate_reference VARCHAR(191) DEFAULT NULL,
            status ENUM('pending_validation','active','revoked','failed') NOT NULL DEFAULT 'pending_validation',
            validated_at DATETIME DEFAULT NULL,
            revoked_at DATETIME DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_sepa_mandates_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
            INDEX idx_customer (customer_id),
            INDEX idx_status (status)
        ", $log) ? 1 : 0;

        $changes += self::createTable($db, 'shipping_classes', "
            id INT AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(50) NOT NULL UNIQUE,
            label VARCHAR(100) NOT NULL,
            description VARCHAR(255) DEFAULT NULL,
            position INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ", $log) ? 1 : 0;

        // Colonnes JSON ajoutées sur tables existantes
        if (self::tableExists($db, 'product_variants')) {
            if (self::ensureColumn($db, 'product_variants', 'images', 'JSON DEFAULT NULL', 'barcode', $log)) $changes++;
        }
        if (self::tableExists($db, 'orders')) {
            if (self::ensureColumn($db, 'orders', 'billing_address',  'JSON DEFAULT NULL', 'tracking_url', $log)) $changes++;
            if (self::ensureColumn($db, 'orders', 'shipping_address', 'JSON DEFAULT NULL', 'billing_address', $log)) $changes++;
        }
        if (self::tableExists($db, 'order_items')) {
            if (self::ensureColumn($db, 'order_items', 'download_meta', 'JSON DEFAULT NULL', 'requires_shipping', $log)) $changes++;
        }
        if (self::tableExists($db, 'invoices')) {
            if (self::ensureColumn($db, 'invoices', 'type', "ENUM('invoice','credit_note','packing_slip','proforma') NOT NULL DEFAULT 'invoice'", 'order_id', $log)) $changes++;
            // pdf_path doit pouvoir être NULL pour packing_slip généré tardivement
            try {
                $db->exec("ALTER TABLE `invoices` MODIFY COLUMN `pdf_path` VARCHAR(500) DEFAULT NULL");
            } catch (\Throwable $e) { /* idempotent */ }
        }
        if (self::tableExists($db, 'customers')) {
            if (self::ensureColumn($db, 'customers', 'stripe_customer_id', 'VARCHAR(191) DEFAULT NULL', 'pro_status', $log)) $changes++;
        }
    }

    /**
     * Migration des données legacy + DROP des anciennes tables.
     * À appeler UNE FOIS après mise à jour des controllers (pour qu'ils
     * lisent/écrivent uniquement le nouveau schéma).
     *
     * Idempotent : skip silencieusement si l'ancienne table n'existe plus.
     * Exécuté via setting `ecommerce_legacy_consolidated` = 1 (one-shot).
     */
    public static function consolidateLegacyTables(?callable $log = null): int {
        $db = Database::getInstance();
        $log = $log ?? fn(string $msg) => print($msg . "\n");
        $changes = 0;

        // Garde-fou : flag dans settings
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'ecommerce_legacy_consolidated'");
        $stmt->execute();
        if ($stmt->fetchColumn() === '1') {
            $log('  Legacy consolidation already done.');
            return 0;
        }

        $log('  Consolidating legacy tables → new schema:');

        // 1. product_images → product_variants.images JSON
        if (self::tableExists($db, 'product_images')) {
            $rows = $db->query("SELECT product_id, variant_id, media_id, position, alt FROM product_images ORDER BY position ASC")->fetchAll();
            $byVariant = [];
            $byProduct = [];
            foreach ($rows as $r) {
                $img = ['media_id' => (int) $r['media_id'], 'position' => (int) $r['position'], 'alt' => $r['alt']];
                if (!empty($r['variant_id'])) $byVariant[(int) $r['variant_id']][] = $img;
                else $byProduct[(int) $r['product_id']][] = $img;
            }
            $upd = $db->prepare("UPDATE product_variants SET images = ? WHERE id = ?");
            foreach ($byVariant as $vid => $imgs) {
                $upd->execute([json_encode($imgs, JSON_UNESCAPED_UNICODE), $vid]);
            }
            // Images sans variant : on les attache au 1er variant du produit
            if (!empty($byProduct)) {
                $first = $db->prepare("SELECT id FROM product_variants WHERE product_id = ? ORDER BY position ASC, id ASC LIMIT 1");
                foreach ($byProduct as $pid => $imgs) {
                    $first->execute([$pid]);
                    if ($vid = $first->fetchColumn()) {
                        $upd->execute([json_encode($imgs, JSON_UNESCAPED_UNICODE), (int) $vid]);
                    }
                }
            }
            $db->exec("DROP TABLE `product_images`");
            $log("    + Migrated " . count($rows) . " product_images → product_variants.images, dropped table");
            $changes++;
        }

        // 2. order_addresses → orders.billing_address / shipping_address JSON
        if (self::tableExists($db, 'order_addresses')) {
            $rows = $db->query("SELECT * FROM order_addresses")->fetchAll();
            $byOrder = [];
            foreach ($rows as $r) {
                $byOrder[(int) $r['order_id']][$r['type']] = [
                    'first_name' => $r['first_name'], 'last_name' => $r['last_name'], 'company' => $r['company'],
                    'address_line1' => $r['address_line1'], 'address_line2' => $r['address_line2'],
                    'postcode' => $r['postcode'], 'city' => $r['city'], 'region' => $r['region'],
                    'country_code' => $r['country_code'], 'phone' => $r['phone'], 'email' => $r['email'],
                    'vat_number' => $r['vat_number'],
                ];
            }
            $upd = $db->prepare("UPDATE orders SET billing_address = ?, shipping_address = ? WHERE id = ?");
            foreach ($byOrder as $oid => $addrs) {
                $upd->execute([
                    isset($addrs['billing']) ? json_encode($addrs['billing'], JSON_UNESCAPED_UNICODE) : null,
                    isset($addrs['shipping']) ? json_encode($addrs['shipping'], JSON_UNESCAPED_UNICODE) : null,
                    $oid,
                ]);
            }
            $db->exec("DROP TABLE `order_addresses`");
            $log("    + Migrated " . count($byOrder) . " order_addresses → orders JSON, dropped table");
            $changes++;
        }

        // 3. credit_notes → invoices (type='credit_note')
        if (self::tableExists($db, 'credit_notes')) {
            $rows = $db->query("SELECT cn.*, i.order_id, i.year FROM credit_notes cn LEFT JOIN invoices i ON i.id = cn.invoice_id")->fetchAll();
            $ins = $db->prepare("INSERT INTO invoices (order_id, invoice_number, year, total_cents, tax_cents, pdf_path, issued_at, type) VALUES (?, ?, ?, ?, 0, ?, ?, 'credit_note')");
            foreach ($rows as $r) {
                if (!$r['order_id']) continue;
                $ins->execute([
                    (int) $r['order_id'],
                    $r['credit_number'],
                    (int) ($r['year'] ?? date('Y')),
                    (int) $r['amount_cents'],
                    $r['pdf_path'],
                    $r['issued_at'],
                ]);
            }
            $db->exec("DROP TABLE `credit_notes`");
            $log("    + Migrated " . count($rows) . " credit_notes → invoices, dropped table");
            $changes++;
        }

        // 4. customer_password_resets + download_tokens → tokens
        if (self::tableExists($db, 'customer_password_resets')) {
            $rows = $db->query("SELECT token, customer_id, expires_at, used_at, created_at FROM customer_password_resets")->fetchAll();
            $ins = $db->prepare("INSERT INTO tokens (token, type, customer_id, expires_at, used_at, created_at) VALUES (?, 'password_reset', ?, ?, ?, ?)");
            foreach ($rows as $r) {
                try { $ins->execute([$r['token'], $r['customer_id'], $r['expires_at'], $r['used_at'], $r['created_at']]); } catch (\Throwable $e) {}
            }
            $db->exec("DROP TABLE `customer_password_resets`");
            $log("    + Migrated " . count($rows) . " password_resets → tokens, dropped table");
            $changes++;
        }
        if (self::tableExists($db, 'download_tokens')) {
            $rows = $db->query("SELECT token, download_id, customer_id, expires_at, used_count, last_ip, created_at FROM download_tokens")->fetchAll();
            $ins = $db->prepare("INSERT INTO tokens (token, type, customer_id, related_id, expires_at, used_count, last_ip, created_at) VALUES (?, 'download', ?, ?, ?, ?, ?, ?)");
            foreach ($rows as $r) {
                try { $ins->execute([$r['token'], $r['customer_id'], $r['download_id'], $r['expires_at'], $r['used_count'], $r['last_ip'], $r['created_at']]); } catch (\Throwable $e) {}
            }
            $db->exec("DROP TABLE `download_tokens`");
            $log("    + Migrated " . count($rows) . " download_tokens → tokens, dropped table");
            $changes++;
        }

        // 5. order_events + payment_events → audit_log
        if (self::tableExists($db, 'order_events')) {
            $rows = $db->query("SELECT order_id, type, payload, actor_type, actor_id, created_at FROM order_events")->fetchAll();
            $ins = $db->prepare("INSERT INTO audit_log (entity_type, entity_id, event_type, payload, actor_type, actor_id, created_at) VALUES ('order', ?, ?, ?, ?, ?, ?)");
            foreach ($rows as $r) {
                $ins->execute([(int) $r['order_id'], $r['type'], $r['payload'], $r['actor_type'], $r['actor_id'], $r['created_at']]);
            }
            $db->exec("DROP TABLE `order_events`");
            $log("    + Migrated " . count($rows) . " order_events → audit_log, dropped table");
            $changes++;
        }
        if (self::tableExists($db, 'payment_events')) {
            $rows = $db->query("SELECT provider, event_id, event_type, payload, processed_at, processing_error, received_at FROM payment_events")->fetchAll();
            $ins = $db->prepare("INSERT INTO audit_log (entity_type, event_type, provider, provider_event_id, payload, actor_type, processed_at, processing_error, created_at) VALUES ('payment', ?, ?, ?, ?, 'webhook', ?, ?, ?)");
            foreach ($rows as $r) {
                try { $ins->execute([$r['event_type'], $r['provider'], $r['event_id'], $r['payload'], $r['processed_at'], $r['processing_error'], $r['received_at']]); } catch (\Throwable $e) {}
            }
            $db->exec("DROP TABLE `payment_events`");
            $log("    + Migrated " . count($rows) . " payment_events → audit_log, dropped table");
            $changes++;
        }

        // 6. digital_downloads → order_items.download_meta JSON
        if (self::tableExists($db, 'digital_downloads')) {
            $rows = $db->query("SELECT order_item_id, file_path, file_name, download_limit, download_count, expires_at FROM digital_downloads")->fetchAll();
            $upd = $db->prepare("UPDATE order_items SET download_meta = ? WHERE id = ?");
            foreach ($rows as $r) {
                $meta = [
                    'file_path' => $r['file_path'],
                    'file_name' => $r['file_name'],
                    'download_limit' => $r['download_limit'] !== null ? (int) $r['download_limit'] : null,
                    'download_count' => (int) $r['download_count'],
                    'expires_at' => $r['expires_at'],
                ];
                $upd->execute([json_encode($meta, JSON_UNESCAPED_UNICODE), (int) $r['order_item_id']]);
            }
            $db->exec("DROP TABLE `digital_downloads`");
            $log("    + Migrated " . count($rows) . " digital_downloads → order_items.download_meta, dropped table");
            $changes++;
        }

        // 7. stats_cache → drop (recompute à la volée)
        if (self::tableExists($db, 'stats_cache')) {
            $db->exec("DROP TABLE `stats_cache`");
            $log("    + Dropped stats_cache (recompute on demand)");
            $changes++;
        }

        // Garde-fou : flag posé une fois la consolidation réussie
        $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('ecommerce_legacy_consolidated', '1') ON DUPLICATE KEY UPDATE setting_value = '1'")->execute();
        $log('  Legacy consolidation done.');

        return $changes;
    }

    /** Crée une table si absente. Retourne true si créée. */
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
        $safeCol = preg_replace('/[^a-zA-Z0-9_]/', '', $column);
        $sql = "ALTER TABLE `{$safe}` ADD COLUMN `{$safeCol}` {$definition}";
        if ($after) $sql .= " AFTER `" . preg_replace('/[^a-zA-Z0-9_]/', '', $after) . "`";
        $db->exec($sql);
        $log("    + Added column {$table}.{$column}");
        return true;
    }

    private static function seedDefaultTaxRates(PDO $db, callable $log, int &$changes): void {
        $defaults = [
            ['FR_STANDARD',    'TVA 20% (taux normal)',        20.00, 'FR', 1],
            ['FR_REDUCED_10',  'TVA 10% (taux intermédiaire)', 10.00, 'FR', 0],
            ['FR_REDUCED_5_5', 'TVA 5,5% (taux réduit)',       5.50,  'FR', 0],
            ['FR_SUPER_2_1',   'TVA 2,1% (taux super réduit)', 2.10,  'FR', 0],
            ['FR_ZERO',        'Exonéré de TVA',               0.00,  'FR', 0],
        ];
        $check = $db->prepare("SELECT COUNT(*) FROM tax_rates WHERE code = ?");
        $insert = $db->prepare("INSERT INTO tax_rates (code, label, rate, country_code, is_default) VALUES (?, ?, ?, ?, ?)");
        foreach ($defaults as [$code, $label, $rate, $country, $isDefault]) {
            $check->execute([$code]);
            if ((int) $check->fetchColumn() === 0) {
                $insert->execute([$code, $label, $rate, $country, $isDefault]);
                $log("    + Seeded tax rate {$code} ({$rate}%)");
                $changes++;
            }
        }
    }

    private static function seedDefaultSettings(PDO $db, callable $log, int &$changes): void {
        $defaults = [
            'ecommerce_enabled' => '0',           // désactivé par défaut (opt-in)
            'shop_currency' => 'EUR',
            'shop_country' => 'FR',
            'shop_payment_methods' => '["bank_transfer"]',
            'stripe_mode' => 'test',
            'paypal_mode' => 'sandbox',
            'invoice_prefix' => 'FR-',
            'invoice_next_number' => '1',
            'quote_prefix' => 'D-',
            'quote_next_number' => '1',
            'checkout_guest_enabled' => '1',
            'order_customer_cancel_enabled' => '1',
            'order_customer_cancel_window_hours' => '24',
            'order_customer_cancel_allowed_statuses' => 'pending,awaiting_payment,paid,processing',
            'order_customer_cancel_reason_required' => '1',
            'ecommerce_notif_recipients' => '[]',
            'shop_franchise_tva' => '0',         // 1 si micro-entreprise franchise de base (pas de TVA)
            'gdpr_auto_erase_enabled' => '0',
            'gdpr_inactivity_years' => '3',
            'gdpr_inactivity_notify_days_before' => '30',
        ];
        $check = $db->prepare("SELECT COUNT(*) FROM settings WHERE setting_key = ?");
        $insert = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)");
        foreach ($defaults as $key => $val) {
            $check->execute([$key]);
            if ((int) $check->fetchColumn() === 0) {
                $insert->execute([$key, $val]);
                $log("    + Seeded setting {$key}");
                $changes++;
            }
        }
    }
}
