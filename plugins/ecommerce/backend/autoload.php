<?php
/**
 * Plugin ecommerce — autoload.php
 *
 * Le cœur (backend-php/) ne charge plus aucun code e-commerce. Tout est ici :
 *   - helpers (ecommerce-flag, customer-auth)
 *   - models (Customer, CustomerAddress, Product*)
 *   - controllers (Cart, Order, Shipping, Stripe, EcommerceSettings, CustomerAuth, Product, ProductCategory)
 *   - migration (EcommerceMigrationController)
 *
 * Loaded uniquement si le plugin est actif (cf. backend-php/index.php boot).
 *
 * Toutes les routes ecom sont enregistrées via register_plugin_route. Si le
 * plugin n'est pas actif sur un site, aucune de ces routes n'existe et le
 * code n'est jamais chargé en mémoire.
 */

// ── Helpers + middleware ───────────────────────────────────────────────────
require_once __DIR__ . '/ecommerce-flag.php';
require_once __DIR__ . '/customer-auth.php';

// ── Models ─────────────────────────────────────────────────────────────────
require_once __DIR__ . '/models/Customer.php';
require_once __DIR__ . '/models/CustomerAddress.php';
require_once __DIR__ . '/models/ProductVariant.php';
require_once __DIR__ . '/models/ProductImage.php';
require_once __DIR__ . '/models/ProductCategory.php';

// ── Controllers ────────────────────────────────────────────────────────────
require_once __DIR__ . '/EcommerceSettingsController.php';
require_once __DIR__ . '/EcommerceMigrationController.php';
require_once __DIR__ . '/CustomerAuthController.php';
require_once __DIR__ . '/ProductController.php';
require_once __DIR__ . '/ProductCategoryController.php';
require_once __DIR__ . '/TaxResolver.php';
require_once __DIR__ . '/CartController.php';
require_once __DIR__ . '/ShippingController.php';
require_once __DIR__ . '/ShippingAdminController.php';
require_once __DIR__ . '/TaxAdminController.php';
require_once __DIR__ . '/CouponsAdminController.php';
require_once __DIR__ . '/OrderController.php';
require_once __DIR__ . '/OrderAdminController.php';
require_once __DIR__ . '/OrderMailer.php';
require_once __DIR__ . '/CustomerAdminController.php';
require_once __DIR__ . '/StripeController.php';
require_once __DIR__ . '/SEPAController.php';

// ── Migration ──────────────────────────────────────────────────────────────
register_plugin_migration('ecommerce', function (callable $log): int {
    $changes = EcommerceMigrationController::migrate($log);
    // One-shot legacy schema consolidation (gated par setting `ecommerce_legacy_consolidated`).
    // Migre product_images / order_addresses / order_events / payment_events / credit_notes /
    // customer_password_resets / download_tokens / digital_downloads / stats_cache vers
    // les tables/colonnes consolidées, puis DROP des anciennes.
    $changes += EcommerceMigrationController::consolidateLegacyTables($log);
    return $changes;
});

// ── Helper local pour matcher les routes paramétrées ───────────────────────
// (équivalent du match_route() de index.php — non importé pour rester autonome)
$ecommerce_match = static function (string $pattern, string $path, array &$params = []): bool {
    $regex = preg_replace('#:([a-zA-Z]+)#', '(?P<$1>[^/]+)', $pattern);
    $regex = '#^' . $regex . '$#';
    if (preg_match($regex, $path, $matches)) {
        $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
        return true;
    }
    return false;
};

// ── Routes ─────────────────────────────────────────────────────────────────
register_plugin_route('ecommerce', function (string $method, string $path) use ($ecommerce_match): bool {
    $params = [];

    // ── Settings (admin) ──
    if ($method === 'GET' && $path === '/ecommerce/settings') {
        $u = authenticate_token(); require_admin($u);
        EcommerceSettingsController::getAll();
        return true;
    }
    if ($method === 'PUT' && $path === '/ecommerce/settings') {
        $u = authenticate_token(); require_admin($u);
        EcommerceSettingsController::update();
        return true;
    }
    if ($method === 'GET' && $ecommerce_match('/ecommerce/settings/secret/:key', $path, $params)) {
        $u = authenticate_token(); require_admin($u);
        EcommerceSettingsController::revealSecret($params['key']);
        return true;
    }

    // ── Customer auth ──
    if ($method === 'POST' && $path === '/customer/auth/register')          { CustomerAuthController::register();        return true; }
    if ($method === 'POST' && $path === '/customer/auth/login')             { CustomerAuthController::login();           return true; }
    if ($method === 'POST' && $path === '/customer/auth/logout')            { CustomerAuthController::logout();          return true; }
    if ($method === 'GET'  && $path === '/customer/auth/me')                { CustomerAuthController::me();              return true; }
    if ($method === 'PUT'  && $path === '/customer/auth/profile')           { CustomerAuthController::updateProfile();   return true; }
    if ($method === 'POST' && $path === '/customer/auth/forgot-password')   { CustomerAuthController::forgotPassword();  return true; }
    if ($method === 'POST' && $path === '/customer/auth/reset-password')    { CustomerAuthController::resetPassword();   return true; }
    if ($method === 'GET'  && $path === '/customer/addresses')              { CustomerAuthController::listAddresses();   return true; }
    if ($method === 'POST' && $path === '/customer/addresses')              { CustomerAuthController::createAddress();   return true; }
    if ($method === 'PUT'    && $ecommerce_match('/customer/addresses/:id', $path, $params)) {
        CustomerAuthController::updateAddress((int) $params['id']); return true;
    }
    if ($method === 'DELETE' && $ecommerce_match('/customer/addresses/:id', $path, $params)) {
        CustomerAuthController::deleteAddress((int) $params['id']); return true;
    }

    // ── Shop : catalogue public ──
    if ($method === 'GET' && $path === '/shop/products')        { ProductController::listPublic(); return true; }
    if ($method === 'GET' && $path === '/shop/products/facets') { ProductController::facets();      return true; }
    if ($method === 'GET' && $ecommerce_match('/shop/products/by-id/:id', $path, $params)) {
        ProductController::getById((int) $params['id']); return true;
    }
    if ($method === 'GET' && $ecommerce_match('/shop/products/:slug/variants', $path, $params)) {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id FROM cpt_products WHERE slug = ? AND status = "published"');
        $stmt->execute([$params['slug']]);
        $row = $stmt->fetch();
        if (!$row) { error_response('Produit introuvable', 404); }
        ProductController::listVariants((int) $row['id']);
        return true;
    }
    if ($method === 'GET' && $ecommerce_match('/shop/products/:slug', $path, $params)) {
        ProductController::getBySlug($params['slug']); return true;
    }
    if ($method === 'GET' && $path === '/shop/categories')          { ProductCategoryController::listPublic();  return true; }
    if ($method === 'GET' && $path === '/shop/categories/by-path')  { ProductCategoryController::getByPath();   return true; }
    if ($method === 'GET' && $ecommerce_match('/shop/categories/:slug', $path, $params)) {
        ProductCategoryController::getBySlug($params['slug']); return true;
    }
    if ($method === 'GET' && $path === '/shop/shipping-rates')      { ShippingController::rates();              return true; }
    if ($method === 'GET' && $path === '/shop/payment-config')      { StripeController::publicConfig();         return true; }
    if ($method === 'GET' && $path === '/shop/tax-rates')           { TaxAdminController::listPublic();         return true; }

    // ── Cart ──
    if ($method === 'GET'    && $path === '/cart')           { CartController::getCart();      return true; }
    if ($method === 'POST'   && $path === '/cart/items')     { CartController::addItem();      return true; }
    if ($method === 'DELETE' && $path === '/cart')           { CartController::clearCart();    return true; }
    if ($method === 'POST'   && $path === '/cart/coupon')    { CartController::applyCoupon();  return true; }
    if ($method === 'DELETE' && $path === '/cart/coupon')    { CartController::removeCoupon(); return true; }
    if ($method === 'PUT'    && $ecommerce_match('/cart/items/:id', $path, $params)) {
        CartController::updateItem((int) $params['id']); return true;
    }
    if ($method === 'DELETE' && $ecommerce_match('/cart/items/custom/:id', $path, $params)) {
        CartController::removeCustomItem((int) $params['id']); return true;
    }
    if ($method === 'DELETE' && $ecommerce_match('/cart/items/:id', $path, $params)) {
        CartController::removeItem((int) $params['id']); return true;
    }

    // ── Orders ──
    if ($method === 'POST' && $path === '/orders') { OrderController::create();    return true; }
    if ($method === 'GET'  && $path === '/orders') { OrderController::listMine();  return true; }
    if ($method === 'GET'  && $path === '/orders/track') { OrderController::track(); return true; }
    if ($method === 'GET'  && $ecommerce_match('/orders/by-number/:number', $path, $params)) {
        OrderController::getByNumber($params['number']); return true;
    }
    if ($method === 'GET'  && $ecommerce_match('/orders/:id', $path, $params)) {
        OrderController::getById((int) $params['id']); return true;
    }

    // ── Payments : Stripe ──
    if ($method === 'POST' && $path === '/payments/stripe/create-payment-intent') {
        StripeController::createPaymentIntent(); return true;
    }
    if ($method === 'GET' && $path === '/payments/stripe/check-status') {
        StripeController::checkPaymentStatus(); return true;
    }
    if ($method === 'POST' && $path === '/payments/stripe/webhook') {
        StripeController::webhook(); return true;
    }

    // ── Payments : SEPA ──
    if ($method === 'POST' && $path === '/payments/sepa/setup-intent') {
        SEPAController::createSetupIntent(); return true;
    }
    if ($method === 'GET' && $path === '/payments/sepa/mandates') {
        SEPAController::listMandates(); return true;
    }
    if ($method === 'POST' && $path === '/payments/sepa/charge') {
        SEPAController::charge(); return true;
    }

    // ── Admin SEPA mandates ──
    if ($method === 'GET' && $path === '/admin/sepa/mandates') {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        SEPAController::adminListMandates();
        return true;
    }
    if ($method === 'PUT' && $ecommerce_match('/admin/sepa/mandates/:id', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        SEPAController::adminUpdateMandate((int) $params['id']);
        return true;
    }

    // ── Admin stock summary ──
    if ($method === 'GET' && $path === '/admin/products/stock-summary') {
        $u = authenticate_token(); require_min_role($u, 'editor');
        ProductController::stockSummary();
        return true;
    }
    if ($method === 'GET' && $ecommerce_match('/admin/products/:id/stock', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        ProductController::stockDetail((int) $params['id']);
        return true;
    }

    // ── Admin variants & categories ──
    if ($method === 'GET' && $ecommerce_match('/admin/products/:id/variants', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        ProductController::listVariants((int) $params['id']);
        return true;
    }
    if ($method === 'PUT' && $ecommerce_match('/admin/products/:id/variants', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        ProductController::replaceVariants((int) $params['id']);
        return true;
    }
    if ($method === 'POST' && $ecommerce_match('/admin/products/:id/generate-matrix', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        ProductController::generateMatrix((int) $params['id']);
        return true;
    }
    // ── Admin Shipping Zones / Methods ──
    if ($method === 'GET' && $path === '/admin/shipping-zones') {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        ShippingAdminController::listZones();
        return true;
    }
    if ($method === 'POST' && $path === '/admin/shipping-zones') {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        ShippingAdminController::createZone();
        return true;
    }
    if ($method === 'PUT' && $ecommerce_match('/admin/shipping-zones/:id', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        ShippingAdminController::updateZone((int) $params['id']);
        return true;
    }
    if ($method === 'DELETE' && $ecommerce_match('/admin/shipping-zones/:id', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        ShippingAdminController::deleteZone((int) $params['id']);
        return true;
    }
    if ($method === 'GET' && $ecommerce_match('/admin/shipping-zones/:id/methods', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        ShippingAdminController::listMethods((int) $params['id']);
        return true;
    }
    if ($method === 'POST' && $ecommerce_match('/admin/shipping-zones/:id/methods', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        ShippingAdminController::createMethod((int) $params['id']);
        return true;
    }
    if ($method === 'PUT' && $ecommerce_match('/admin/shipping-methods/:id', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        ShippingAdminController::updateMethod((int) $params['id']);
        return true;
    }
    if ($method === 'DELETE' && $ecommerce_match('/admin/shipping-methods/:id', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        ShippingAdminController::deleteMethod((int) $params['id']);
        return true;
    }

    // ── Admin Tax Rates ──
    if ($method === 'GET' && $path === '/admin/tax-rates') {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        TaxAdminController::listAdmin();
        return true;
    }
    if ($method === 'POST' && $path === '/admin/tax-rates') {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        TaxAdminController::create();
        return true;
    }
    if ($method === 'PUT' && $ecommerce_match('/admin/tax-rates/:id', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        TaxAdminController::update((int) $params['id']);
        return true;
    }
    if ($method === 'DELETE' && $ecommerce_match('/admin/tax-rates/:id', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        TaxAdminController::delete((int) $params['id']);
        return true;
    }

    // ── Admin Coupons ──
    if ($method === 'GET' && $path === '/admin/coupons') {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        CouponsAdminController::listAll();
        return true;
    }
    if ($method === 'POST' && $path === '/admin/coupons') {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        CouponsAdminController::create();
        return true;
    }
    if ($method === 'PUT' && $ecommerce_match('/admin/coupons/:id', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        CouponsAdminController::update((int) $params['id']);
        return true;
    }
    if ($method === 'DELETE' && $ecommerce_match('/admin/coupons/:id', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        CouponsAdminController::delete((int) $params['id']);
        return true;
    }

    // ── Admin Orders ──
    if ($method === 'GET' && $path === '/admin/orders') {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        OrderAdminController::listAll();
        return true;
    }
    if ($method === 'GET' && $path === '/admin/orders/stats') {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        OrderAdminController::stats();
        return true;
    }
    if ($method === 'GET' && $ecommerce_match('/admin/orders/:id', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        OrderAdminController::getById((int) $params['id']);
        return true;
    }
    if ($method === 'PUT' && $ecommerce_match('/admin/orders/:id', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        OrderAdminController::update((int) $params['id']);
        return true;
    }
    if ($method === 'POST' && $ecommerce_match('/admin/orders/:id/refund', $path, $params)) {
        $u = authenticate_token(); require_admin($u);
        require_ecommerce_enabled();
        OrderAdminController::refund((int) $params['id']);
        return true;
    }

    // ── Admin Customers ──
    if ($method === 'GET' && $path === '/admin/customers') {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        CustomerAdminController::listAll();
        return true;
    }
    if ($method === 'GET' && $path === '/admin/customers/stats') {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        CustomerAdminController::stats();
        return true;
    }
    if ($method === 'GET' && $ecommerce_match('/admin/customers/:id', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        CustomerAdminController::getById((int) $params['id']);
        return true;
    }
    if ($method === 'PUT' && $ecommerce_match('/admin/customers/:id', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        CustomerAdminController::update((int) $params['id']);
        return true;
    }

    if ($method === 'POST' && $path === '/admin/product-categories') {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        ProductCategoryController::create();
        return true;
    }
    if ($method === 'PUT' && $ecommerce_match('/admin/product-categories/:id', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        ProductCategoryController::update((int) $params['id']);
        return true;
    }
    if ($method === 'DELETE' && $ecommerce_match('/admin/product-categories/:id', $path, $params)) {
        $u = authenticate_token(); require_min_role($u, 'editor');
        require_ecommerce_enabled();
        ProductCategoryController::delete((int) $params['id']);
        return true;
    }

    return false;
});
