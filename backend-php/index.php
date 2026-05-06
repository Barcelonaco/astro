<?php
/**
 * CMS Astro — PHP Backend
 * Front controller + Router
 */

// Enable gzip compression for all PHP output (HTML, JSON, etc.)
if (!ini_get('zlib.output_compression') && extension_loaded('zlib')) {
    ob_start('ob_gzhandler');
}

// ─── Static file routes (handled before JSON content-type) ───────────────────
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Image optimization fast-path: Handle before Composer/DB loading to save 100-300ms overhead
if (preg_match('#^/uploads/media/_optimized/(.+)$#', $uri, $m)) {
    // We need to define the serve_optimized_image function here if it's placed early
    serve_optimized_image($m[1]);
    exit;
}

// Sitemap / robots.txt fast-path: rewrite baked origin → current host so the
// same dist build serves any domain (no rebuild per deploy).
if (in_array($uri, ['/sitemap.xml', '/sitemap-index.xml', '/sitemap-0.xml', '/robots.txt'], true)) {
    require_once __DIR__ . '/helpers/sitemap.php';
    if (serve_dynamic_sitemap_or_robots($uri)) exit;
}

require_once __DIR__ . '/vendor/autoload.php';

// Load environment
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Core includes
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/helpers/request.php';
require_once __DIR__ . '/helpers/slug.php';
require_once __DIR__ . '/helpers/rebuild.php';
require_once __DIR__ . '/helpers/sitemap.php';
require_once __DIR__ . '/helpers/media-enricher.php';
require_once __DIR__ . '/helpers/plugin-hooks.php';
require_once __DIR__ . '/helpers/CoreRegistry.php';
require_once __DIR__ . '/middleware/auth.php';
require_once __DIR__ . '/helpers/rate-limit.php';

// Models
require_once __DIR__ . '/models/User.php';
require_once __DIR__ . '/models/Post.php';
require_once __DIR__ . '/models/Category.php';
require_once __DIR__ . '/models/Page.php';
require_once __DIR__ . '/models/ReusableBloc.php';
require_once __DIR__ . '/models/Menu.php';
require_once __DIR__ . '/models/Form.php';

// Controllers
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/PostController.php';
require_once __DIR__ . '/controllers/CategoryController.php';
require_once __DIR__ . '/controllers/PageController.php';
require_once __DIR__ . '/controllers/SettingsController.php';
require_once __DIR__ . '/controllers/UserController.php';
require_once __DIR__ . '/controllers/MediaController.php';
require_once __DIR__ . '/controllers/MenuController.php';
require_once __DIR__ . '/controllers/ReusableBlocController.php';
require_once __DIR__ . '/controllers/FormController.php';
require_once __DIR__ . '/controllers/CustomPostTypeController.php';
require_once __DIR__ . '/controllers/ModuleFieldsController.php';
require_once __DIR__ . '/controllers/ModuleTemplatesController.php';
require_once __DIR__ . '/controllers/RenderBlockController.php';
require_once __DIR__ . '/controllers/PluginController.php';
require_once __DIR__ . '/controllers/GoogleReviewsController.php';
require_once __DIR__ . '/controllers/AiController.php';
require_once __DIR__ . '/controllers/AiCreditController.php';
require_once __DIR__ . '/helpers/encryption.php';
require_once __DIR__ . '/controllers/SearchController.php';

// E-commerce : tout est isolé dans le plugin `ecommerce/` (chargé via autoload
// si actif). Le cœur n'a aucune dépendance directe sur le commerce.

// ─── Plugin autoload (monorepo plugins/ + EXTERNAL_PLUGINS_DIR) ──────────────
// Each plugin can ship a backend/autoload.php that registers its controllers,
// routes and migrations. Loaded only if the plugin is active.
// Wrapped in try/catch so a bad plugin can't crash the entire boot.
try {
    foreach (PluginController::getPluginRoots() as $__pluginRoot) {
        if (!is_dir($__pluginRoot)) continue;
        foreach (glob($__pluginRoot . '/*/backend/autoload.php') as $__autoload) {
            $__pluginDir = basename(dirname(dirname($__autoload)));
            if (!PluginController::isPluginActive($__pluginDir)) continue;
            require_once $__autoload;
        }
    }
    unset($__pluginRoot, $__autoload, $__pluginDir);
} catch (\Throwable $__e) {
    error_log('Plugin autoload failed: ' . $__e->getMessage());
}

// ─── CORS ────────────────────────────────────────────────────────────────────
$allowedOrigins = [
    $_ENV['FRONTEND_URL'] ?? 'http://localhost:4321',
    $_ENV['ADMIN_URL'] ?? 'http://localhost:3000',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

// ─── Security headers ────────────────────────────────────────────────────────
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header('Strict-Transport-Security: max-age=31536000; includeSubDomains');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── Static file routes (handled before JSON content-type) ───────────────────
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);


// Serve /login as admin login page
if ($uri === '/login' || $uri === '/login/') {
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');
    $file = __DIR__ . '/admin/login.html';
    $html = file_get_contents($file);
    $html = preg_replace_callback('/href="([^"]+\.css)(?:\?[^"]*)?"/i', function($match) {
        $f = __DIR__ . '/admin/' . basename($match[1]);
        $v = file_exists($f) ? filemtime($f) : time();
        return 'href="' . $match[1] . '?v=' . $v . '"';
    }, $html);
    $html = preg_replace_callback('/src="([^"]+\.js)(?:\?[^"]*)?"/i', function($match) {
        $f = __DIR__ . '/admin/' . basename($match[1]);
        $v = file_exists($f) ? filemtime($f) : time();
        return 'src="' . $match[1] . '?v=' . $v . '"';
    }, $html);
    echo $html;
    exit;
}

// Serve admin interface files
if (preg_match('#^/admin(?:/(.*))?$#', $uri, $m)) {
    $path = $m[1] ?? '';
    if (empty($path) || $path === '/') {
        // /admin → serve index.html (app.js handles auth check)
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        // Inject cache-busting timestamps into asset URLs
        $html = file_get_contents(__DIR__ . '/admin/index.html');
        $html = preg_replace_callback('/href="([^"]+\.css)(?:\?[^"]*)?"/i', function($match) {
            $file = __DIR__ . '/admin/' . basename($match[1]);
            $v = file_exists($file) ? filemtime($file) : time();
            return 'href="' . $match[1] . '?v=' . $v . '"';
        }, $html);
        $html = preg_replace_callback('/src="([^"]+\.js)(?:\?[^"]*)?"/i', function($match) {
            $file = __DIR__ . '/admin/' . basename($match[1]);
            $v = file_exists($file) ? filemtime($file) : time();
            return 'src="' . $match[1] . '?v=' . $v . '"';
        }, $html);
        echo $html;
        exit;
    }
    $file = __DIR__ . '/admin/' . $path;
    if (file_exists($file) && !is_dir($file)) {
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        $mimeMap = ['html' => 'text/html', 'css' => 'text/css', 'js' => 'application/javascript', 'json' => 'application/json', 'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'ico' => 'image/x-icon'];
        $mime = $mimeMap[$ext] ?? mime_content_type($file);
        header("Content-Type: $mime; charset=utf-8");
        // Prevent caching for CSS/JS/HTML so changes appear immediately
        if (in_array($ext, ['css', 'js', 'html'])) {
            header('Cache-Control: no-cache, no-store, must-revalidate');
            header('Pragma: no-cache');
            header('Expires: 0');
        }
        readfile($file);
        exit;
    }
    // SPA fallback: serve index.html for any unmatched /admin/* path
    // (e.g. hard refresh on /admin/evenements)
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');
    $html = file_get_contents(__DIR__ . '/admin/index.html');
    $html = preg_replace_callback('/href="([^"]+\.css)(?:\?[^"]*)?"/i', function($match) {
        $file = __DIR__ . '/admin/' . basename($match[1]);
        $v = file_exists($file) ? filemtime($file) : time();
        return 'href="' . $match[1] . '?v=' . $v . '"';
    }, $html);
    $html = preg_replace_callback('/src="([^"]+\.js)(?:\?[^"]*)?"/i', function($match) {
        $file = __DIR__ . '/admin/' . basename($match[1]);
        $v = file_exists($file) ? filemtime($file) : time();
        return 'src="' . $match[1] . '?v=' . $v . '"';
    }, $html);
    echo $html;
    exit;
}

// Image optimization: /uploads/media/_optimized/{filename}?w=&q=&f=
if (preg_match('#^/uploads/media/_optimized/(.+)$#', $uri, $m)) {
    serve_optimized_image($m[1]);
    exit;
}

// Serve uploads: try local first, then fallback to old backend/uploads
if (preg_match('#^/uploads/(.+)$#', $uri, $m)) {
    $file = __DIR__ . '/uploads/' . $m[1];
    if (!file_exists($file)) {
        $file = __DIR__ . '/../backend/uploads/' . $m[1];
    }
    if (file_exists($file) && !is_dir($file)) {
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        $mimeMap = [
            'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png',
            'gif' => 'image/gif', 'webp' => 'image/webp', 'avif' => 'image/avif',
            'svg' => 'image/svg+xml', 'mp4' => 'video/mp4', 'webm' => 'video/webm',
        ];
        $mime = $mimeMap[$ext] ?? mime_content_type($file);
        header("Content-Type: $mime");
        header('Cache-Control: public, max-age=604800');
        readfile($file);
        exit;
    }
    http_response_code(404);
    exit;
}

// Serve nickl-assets: try dist (Astro build) first, then nickl/public/, then backend/nickl-css/
if (preg_match('#^/nickl-assets/(.+)$#', $uri, $m)) {
    $candidates = [
        __DIR__ . '/dist/nickl-assets/' . $m[1],
        __DIR__ . '/../nickl/public/' . $m[1],
        __DIR__ . '/nickl-css/' . basename($m[1]),
    ];
    foreach ($candidates as $file) {
        if (file_exists($file)) {
            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            $mimeMap = ['css' => 'text/css', 'js' => 'application/javascript', 'svg' => 'image/svg+xml'];
            $mime = $mimeMap[$ext] ?? mime_content_type($file);
            header("Content-Type: $mime");
            header('Cache-Control: public, max-age=2592000');
            readfile($file);
            exit;
        }
    }
    http_response_code(404);
    exit;
}

// Serve plugin-assets from any registered plugin root (monorepo plugins/ + EXTERNAL_PLUGINS_DIR)
if (preg_match('#^/plugin-assets/(.+)$#', $uri, $m)) {
    $rel = $m[1];
    // Path traversal guard
    if (strpos($rel, '..') !== false) {
        http_response_code(403);
        exit;
    }
    // Map web-asset extensions to correct MIME types — mime_content_type() often
    // returns text/plain for CSS/JS which browsers refuse under strict MIME checking.
    static $assetMimeMap = [
        'css'   => 'text/css',
        'js'    => 'application/javascript',
        'mjs'   => 'application/javascript',
        'json'  => 'application/json',
        'html'  => 'text/html; charset=utf-8',
        'svg'   => 'image/svg+xml',
        'png'   => 'image/png',
        'jpg'   => 'image/jpeg',
        'jpeg'  => 'image/jpeg',
        'gif'   => 'image/gif',
        'webp'  => 'image/webp',
        'avif'  => 'image/avif',
        'ico'   => 'image/x-icon',
        'woff'  => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf'   => 'font/ttf',
        'otf'   => 'font/otf',
        'eot'   => 'application/vnd.ms-fontobject',
        'map'   => 'application/json',
        'txt'   => 'text/plain',
        'xml'   => 'application/xml',
    ];
    foreach (PluginController::getPluginRoots() as $root) {
        $file = $root . '/' . $rel;
        if (is_file($file)) {
            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            $mime = $assetMimeMap[$ext] ?? (mime_content_type($file) ?: 'application/octet-stream');
            header("Content-Type: $mime");
            header('Cache-Control: public, max-age=2592000');
            // HTML pages shipped by plugins (admin pages) are loaded inside the
            // admin SPA via an iframe — the global X-Frame-Options: DENY would
            // otherwise block the embed. Allow same-origin framing only.
            if ($ext === 'html') {
                header('X-Frame-Options: SAMEORIGIN');
            }
            readfile($file);
            exit;
        }
    }
    http_response_code(404);
    exit;
}

// ─── JSON API ────────────────────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];

// Strip /api prefix
if (!preg_match('#^/api/(.*)$#', $uri, $apiMatch)) {
    // Non-API requests that reach here: try to serve frontend dist file
    $distFile = __DIR__ . '/dist' . $uri;
    $distIndex = __DIR__ . '/dist' . rtrim($uri, '/') . '/index.html';

    if ($uri === '/' || $uri === '') {
        $distHome = __DIR__ . '/dist/index.html';
        if (file_exists($distHome)) {
            header('Content-Type: text/html; charset=utf-8');
            echo rewrite_html_origin(file_get_contents($distHome));
            exit;
        }
        // Fallback: redirect to admin
        header('Location: /login');
        exit;
    }

    if (file_exists($distFile) && !is_dir($distFile)) {
        $ext = strtolower(pathinfo($distFile, PATHINFO_EXTENSION));
        $mimeMap = [
            'js' => 'application/javascript',
            'mjs' => 'application/javascript',
            'css' => 'text/css',
            'json' => 'application/json',
            'svg' => 'image/svg+xml',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'avif' => 'image/avif',
            'ico' => 'image/x-icon',
            'woff' => 'font/woff',
            'woff2' => 'font/woff2',
            'ttf' => 'font/ttf',
            'xml' => 'application/xml',
            'txt' => 'text/plain',
            'html' => 'text/html; charset=utf-8',
        ];
        $mime = $mimeMap[$ext] ?? (mime_content_type($distFile) ?: 'application/octet-stream');
        header("Content-Type: $mime");
        // Hashed assets (/_astro/) and vendor libs get immutable cache; HTML pages get no-cache
        if (str_contains($uri, '/_astro/') || str_contains($uri, '/vendor/')) {
            header('Cache-Control: public, max-age=31536000, immutable');
        } elseif ($ext !== 'html') {
            header('Cache-Control: public, max-age=86400');
        }
        if ($ext === 'html') {
            echo rewrite_html_origin(file_get_contents($distFile));
        } else {
            readfile($distFile);
        }
        exit;
    }

    if (file_exists($distIndex)) {
        header('Content-Type: text/html; charset=utf-8');
        echo rewrite_html_origin(file_get_contents($distIndex));
        exit;
    }

    // 404: serve dist/404.html if it exists
    $dist404 = __DIR__ . '/dist/404.html';
    if (file_exists($dist404)) {
        http_response_code(404);
        header('Content-Type: text/html; charset=utf-8');
        echo rewrite_html_origin(file_get_contents($dist404));
        exit;
    }

    // If a rebuild is in progress, show a waiting page instead of raw JSON error
    $rebuildStatus = get_rebuild_status();
    if (in_array($rebuildStatus['status'] ?? '', ['building', 'queued'])) {
        http_response_code(503);
        header('Content-Type: text/html; charset=utf-8');
        header('Retry-After: 5');
        echo '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mise à jour en cours…</title><meta http-equiv="refresh" content="3"><style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui,sans-serif;background:#f8f9fa;color:#333}div{text-align:center}.spinner{width:40px;height:40px;border:4px solid #e0e0e0;border-top-color:#666;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 1rem}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div><div class="spinner"></div><p>Le site est en cours de mise à jour…</p><p style="font-size:.85em;color:#888">Rechargement automatique dans quelques secondes</p></div></body></html>';
        exit;
    }

    error_response('Not found', 404);
}

$path = '/' . trim($apiMatch[1], '/');

// ─── Route matching ──────────────────────────────────────────────────────────

// Helper: extract route params like :slug, :id, :postType
function match_route(string $pattern, string $path, array &$params = []): bool {
    // Convert :param to named regex groups
    $regex = preg_replace('#:([a-zA-Z]+)#', '(?P<$1>[^/]+)', $pattern);
    $regex = '#^' . $regex . '$#';
    if (preg_match($regex, $path, $matches)) {
        $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
        return true;
    }
    return false;
}

$params = [];

try {
    // ── Auth (rate limited) ──
    if ($method === 'POST' && $path === '/auth/login') {
        check_rate_limit('login', 5, 300); // 5 attempts per 5 min
        AuthController::login();
    }
    elseif ($method === 'POST' && $path === '/auth/forgot-password') {
        check_rate_limit('forgot-password', 3, 600); // 3 attempts per 10 min
        AuthController::forgotPassword();
    }
    elseif ($method === 'POST' && $path === '/auth/reset-password') {
        check_rate_limit('reset-password', 5, 300);
        AuthController::resetPassword();
    }
    elseif ($method === 'GET' && $path === '/auth/me') {
        $user = authenticate_token();
        AuthController::me($user);
    }
    elseif ($method === 'PUT' && $path === '/auth/profile') {
        $user = authenticate_token();
        AuthController::updateProfile($user);
    }

    // ── Posts ──
    elseif ($method === 'GET' && $path === '/posts') {
        PostController::getAll();
    }
    elseif ($method === 'GET' && match_route('/posts/:slug', $path, $params)) {
        PostController::getBySlug($params['slug']);
    }
    elseif ($method === 'POST' && $path === '/posts') {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        PostController::create($user);
    }
    elseif ($method === 'PUT' && match_route('/posts/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        PostController::update((int) $params['id'], $user);
    }
    elseif ($method === 'DELETE' && match_route('/posts/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        PostController::delete((int) $params['id']);
    }

    // ── Categories ──
    elseif ($method === 'GET' && $path === '/categories') {
        CategoryController::getAll();
    }
    elseif ($method === 'GET' && match_route('/categories/:slug', $path, $params)) {
        CategoryController::getBySlug($params['slug']);
    }
    elseif ($method === 'POST' && $path === '/categories') {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        CategoryController::create();
    }
    elseif ($method === 'PUT' && match_route('/categories/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        CategoryController::update((int) $params['id']);
    }
    elseif ($method === 'DELETE' && match_route('/categories/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        CategoryController::delete((int) $params['id']);
    }

    // ── Pages ──
    elseif ($method === 'GET' && $path === '/pages') {
        PageController::getAll();
    }
    elseif ($method === 'GET' && $path === '/pages/navigation') {
        PageController::getNavigation();
    }
    elseif ($method === 'GET' && $path === '/pages/menu-info') {
        $user = authenticate_token();
        MenuController::getAllPageMenuInfo();
    }
    elseif ($method === 'GET' && match_route('/pages/:pageId/menus', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        MenuController::getPageMenus((int) $params['pageId']);
    }
    elseif ($method === 'GET' && preg_match('#^/pages/(.+)$#', $path, $m)) {
        PageController::getBySlug($m[1]);
    }
    elseif ($method === 'POST' && $path === '/pages') {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        PageController::create($user);
    }
    elseif ($method === 'PUT' && match_route('/pages/:id', $path, $params)) {
        // Check for /pages/:pageId/menus
        if (preg_match('#^/pages/(\d+)/menus$#', $path, $pm)) {
            $user = authenticate_token();
            require_min_role($user, 'admin_site');
            MenuController::syncPageMenus((int) $pm[1]);
            return;
        }
        $user = authenticate_token();
        require_min_role($user, 'editor');
        PageController::update((int) $params['id'], $user);
    }
    elseif ($method === 'DELETE' && match_route('/pages/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        PageController::delete((int) $params['id']);
    }

    // ── Page ↔ Menu assignments ──
    elseif ($method === 'PUT' && match_route('/pages/:pageId/menus', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        MenuController::syncPageMenus((int) $params['pageId']);
    }

    // ── Reusable Blocs ──
    elseif ($method === 'GET' && $path === '/reusable-blocs') {
        ReusableBlocController::getAll();
    }
    elseif ($method === 'GET' && match_route('/reusable-blocs/:id', $path, $params)) {
        ReusableBlocController::getById((int) $params['id']);
    }
    elseif ($method === 'POST' && $path === '/reusable-blocs') {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        ReusableBlocController::create($user);
    }
    elseif ($method === 'PUT' && match_route('/reusable-blocs/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        ReusableBlocController::update((int) $params['id']);
    }
    elseif ($method === 'DELETE' && match_route('/reusable-blocs/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        ReusableBlocController::delete((int) $params['id']);
    }

    // ── Settings ──
    elseif ($method === 'GET' && $path === '/settings/theme') {
        SettingsController::getThemeSettings();
    }
    elseif ($method === 'GET' && $path === '/settings/site') {
        SettingsController::getSiteInfo();
    }
    elseif ($method === 'GET' && $path === '/settings/style') {
        SettingsController::getStyleSettings();
    }
    elseif ($method === 'GET' && $path === '/frontend-bootstrap') {
        SettingsController::getFrontendBootstrap();
    }
    elseif ($method === 'GET' && $path === '/settings') {
        $user = authenticate_token();
        SettingsController::getAllSettings();
    }
    elseif ($method === 'PUT' && $path === '/settings') {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        SettingsController::updateSettings();
    }

    // ── Rebuild ──
    elseif ($method === 'POST' && $path === '/rebuild') {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        $body = get_json_body();
        trigger_frontend_rebuild($body['reason'] ?? 'manual');
        json_response(['message' => 'Rebuild triggered', 'status' => get_rebuild_status()]);
    }
    elseif ($method === 'GET' && $path === '/rebuild/status') {
        $user = authenticate_token();
        json_response(get_rebuild_status());
    }

    // ── Users (admin) ──
    elseif ($method === 'GET' && $path === '/users') {
        $user = authenticate_token();
        require_admin($user);
        UserController::getAll();
    }
    elseif ($method === 'POST' && $path === '/users') {
        $user = authenticate_token();
        require_admin($user);
        UserController::create();
    }
    elseif ($method === 'PUT' && match_route('/users/:id', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        UserController::update((int) $params['id']);
    }
    elseif ($method === 'DELETE' && match_route('/users/:id', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        UserController::delete((int) $params['id'], $user);
    }

    // ── Module fields & templates ──
    elseif ($method === 'GET' && $path === '/module-fields') {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        ModuleFieldsController::getModuleFields();
    }
    elseif ($method === 'GET' && $path === '/module-template') {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        ModuleTemplatesController::getModuleTemplate();
    }

    // ── Core registry (built-in CPTs + modules) ──
    elseif ($method === 'GET' && $path === '/core/post-types') {
        json_response(['postTypes' => CoreRegistry::getCPTs()]);
    }
    elseif ($method === 'GET' && $path === '/core/modules') {
        json_response(['modules' => CoreRegistry::getModules()]);
    }
    elseif ($method === 'GET' && $path === '/core/registry') {
        json_response(CoreRegistry::load());
    }

    // ── Plugins ──
    elseif ($method === 'GET' && $path === '/plugins') {
        $user = authenticate_token();
        PluginController::getPlugins();
    }
    elseif ($method === 'GET' && $path === '/plugins/active') {
        PluginController::getActivePlugins();
    }
    elseif ($method === 'GET' && $path === '/plugins/inactive-types') {
        PluginController::getInactiveTypes();
    }
    elseif ($method === 'PUT' && preg_match('#^/plugins/([a-zA-Z0-9_-]+)/toggle$#', $path, $m)) {
        $user = authenticate_token();
        require_min_role($user, 'super_admin');
        PluginController::togglePlugin($m[1]);
    }

    // ── AI Generation (SSE streaming) ──
    elseif ($method === 'POST' && $path === '/ai/generate') {
        AiController::generateStream();
    }
    elseif ($method === 'POST' && $path === '/ai/generate-pages') {
        AiController::generatePagesStream();
    }

    // ── Google Reviews ──
    elseif ($method === 'GET' && $path === '/google-reviews') {
        GoogleReviewsController::get();
    }

    // ── Block rendering ──
    elseif ($method === 'POST' && $path === '/render-block') {
        RenderBlockController::renderBlock();
    }

    // ── Media (editor+) ──
    elseif ($method === 'GET' && $path === '/media/folders') {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        MediaController::getFolders();
    }
    elseif ($method === 'POST' && $path === '/media/folders') {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        MediaController::createFolder();
    }
    elseif ($method === 'PUT' && match_route('/media/folders/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        MediaController::updateFolder((int) $params['id']);
    }
    elseif ($method === 'DELETE' && match_route('/media/folders/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        MediaController::deleteFolder((int) $params['id']);
    }
    elseif ($method === 'GET' && $path === '/media') {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        MediaController::getItems();
    }
    elseif ($method === 'POST' && $path === '/media/upload') {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        MediaController::upload();
    }
    elseif ($method === 'PUT' && match_route('/media/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        MediaController::updateItem((int) $params['id']);
    }
    elseif ($method === 'POST' && match_route('/media/:id/crop', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        MediaController::cropItem((int) $params['id']);
    }
    elseif ($method === 'DELETE' && match_route('/media/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        MediaController::deleteItem((int) $params['id']);
    }

    // ── Menus ──
    elseif ($method === 'GET' && match_route('/menus/navigation/:location', $path, $params)) {
        MenuController::getNavigationByLocation($params['location']);
    }
    elseif ($method === 'GET' && match_route('/menus/:id/navigation', $path, $params)) {
        MenuController::getNavigationById((int) $params['id']);
    }
    elseif ($method === 'GET' && $path === '/menus') {
        $user = authenticate_token();
        MenuController::getAll();
    }
    elseif ($method === 'GET' && $path === '/menus/pages') {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        MenuController::getAvailablePages();
    }
    elseif ($method === 'GET' && $path === '/menus/cpt-items') {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        MenuController::getAvailableCptItems();
    }
    elseif ($method === 'GET' && match_route('/menus/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        MenuController::getById((int) $params['id']);
    }
    elseif ($method === 'POST' && $path === '/menus') {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        MenuController::create();
    }
    elseif ($method === 'PUT' && match_route('/menus/:id/items', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        MenuController::saveItems((int) $params['id']);
    }
    elseif ($method === 'PUT' && match_route('/menus/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        MenuController::update((int) $params['id']);
    }
    elseif ($method === 'DELETE' && match_route('/menus/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        MenuController::delete((int) $params['id']);
    }

    // ── Forms (public) ──
    elseif ($method === 'GET' && match_route('/forms/public/:id', $path, $params)) {
        FormController::getPublicForm((int) $params['id']);
    }
    elseif ($method === 'POST' && match_route('/forms/:id/submit', $path, $params)) {
        FormController::submitForm((int) $params['id']);
    }

    // ── Forms (admin_site+) ──
    elseif ($method === 'GET' && $path === '/forms') {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        FormController::getAll();
    }
    elseif ($method === 'GET' && match_route('/forms/:id/entries/export', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        FormController::exportEntries((int) $params['id']);
    }
    elseif ($method === 'GET' && match_route('/forms/:id/entries', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        FormController::getEntries((int) $params['id']);
    }
    elseif ($method === 'GET' && match_route('/forms/entries/:entryId', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        FormController::getEntryById((int) $params['entryId']);
    }
    elseif ($method === 'PUT' && match_route('/forms/entries/:entryId/status', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        FormController::updateEntryStatus((int) $params['entryId']);
    }
    elseif ($method === 'DELETE' && match_route('/forms/entries/:entryId', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        FormController::deleteEntry((int) $params['entryId']);
    }
    elseif ($method === 'GET' && match_route('/forms/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        FormController::getById((int) $params['id']);
    }
    elseif ($method === 'POST' && $path === '/forms') {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        FormController::create();
    }
    elseif ($method === 'PUT' && match_route('/forms/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        FormController::update((int) $params['id']);
    }
    elseif ($method === 'DELETE' && match_route('/forms/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'admin_site');
        FormController::delete((int) $params['id']);
    }

    // ── AI Credits ──
    elseif ($method === 'GET' && $path === '/ai-credits/available') {
        authenticate_token();
        AiCreditController::getAvailable();
    }
    elseif ($method === 'GET' && $path === '/ai-credits') {
        $user = authenticate_token();
        require_admin($user);
        AiCreditController::getOverview();
    }
    elseif ($method === 'GET' && $path === '/ai-credits/usage') {
        $user = authenticate_token();
        require_admin($user);
        AiCreditController::getUsageLog();
    }
    elseif ($method === 'GET' && $path === '/ai-credits/per-user') {
        $user = authenticate_token();
        require_admin($user);
        AiCreditController::getPerUserUsage();
    }
    elseif ($method === 'GET' && $path === '/ai-credits/per-model') {
        $user = authenticate_token();
        require_admin($user);
        AiCreditController::getPerModelUsage();
    }
    elseif ($method === 'GET' && $path === '/ai-credits/entries') {
        $user = authenticate_token();
        require_admin($user);
        AiCreditController::getCreditEntries();
    }
    elseif ($method === 'POST' && $path === '/ai-credits') {
        $user = authenticate_token();
        require_admin($user);
        AiCreditController::addCredits($user);
    }
    elseif ($method === 'DELETE' && match_route('/ai-credits/:id', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        AiCreditController::deleteCredit((int) $params['id']);
    }
    elseif ($method === 'GET' && $path === '/ai-credits/api-key') {
        $user = authenticate_token();
        require_admin($user);
        AiCreditController::getApiKey();
    }
    elseif ($method === 'PUT' && $path === '/ai-credits/api-key') {
        $user = authenticate_token();
        require_admin($user);
        AiCreditController::saveApiKey();
    }
    elseif ($method === 'PUT' && $path === '/ai-credits/limit') {
        $user = authenticate_token();
        require_admin($user);
        AiCreditController::updateLimit();
    }
    elseif ($method === 'PUT' && $path === '/ai-credits/monthly-credits') {
        $user = authenticate_token();
        require_admin($user);
        AiCreditController::updateMonthlyCredits();
    }
    elseif ($method === 'POST' && $path === '/ai-credits/reset') {
        $user = authenticate_token();
        require_admin($user);
        AiCreditController::resetMonthlyCredits();
    }
    elseif ($method === 'PUT' && $path === '/ai-credits/enabled') {
        $user = authenticate_token();
        require_admin($user);
        AiCreditController::setEnabled();
    }

    // ── E-commerce ──
    // Toutes les routes /ecommerce/*, /customer/*, /shop/*, /cart, /orders,
    // /payments/stripe/*, /admin/products/*, /admin/product-categories/* sont
    // déclarées par le plugin `ecommerce/` (cf. plugins/ecommerce/backend/autoload.php)
    // et résolues par dispatch_plugin_routes() à la fin du try.

    // ── Search ──
    elseif ($method === 'GET' && $path === '/search') {
        SearchController::search();
    }

    // ── Custom Post Types (dynamic) ──
    elseif ($method === 'GET' && match_route('/cpt/:postType/options', $path, $params)) {
        CustomPostTypeController::getOptions($params['postType']);
    }
    elseif ($method === 'GET' && match_route('/cpt/:postType/categories', $path, $params)) {
        CustomPostTypeController::getCategories($params['postType']);
    }
    elseif ($method === 'POST' && match_route('/cpt/:postType/categories', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        CustomPostTypeController::createCategory($params['postType']);
    }
    elseif ($method === 'PUT' && match_route('/cpt/:postType/categories/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        CustomPostTypeController::updateCategory($params['postType'], (int) $params['id']);
    }
    elseif ($method === 'DELETE' && match_route('/cpt/:postType/categories/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        CustomPostTypeController::deleteCategory($params['postType'], (int) $params['id']);
    }
    elseif ($method === 'GET' && match_route('/cpt/:postType/by-id/:id', $path, $params)) {
        CustomPostTypeController::getItemById($params['postType'], (int) $params['id']);
    }
    elseif ($method === 'GET' && match_route('/cpt/:postType/:slug', $path, $params)) {
        CustomPostTypeController::getItemBySlug($params['postType'], $params['slug']);
    }
    elseif ($method === 'GET' && match_route('/cpt/:postType', $path, $params)) {
        CustomPostTypeController::getItems($params['postType']);
    }
    elseif ($method === 'POST' && match_route('/cpt/:postType', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        CustomPostTypeController::createItem($params['postType'], $user);
    }
    elseif ($method === 'PUT' && match_route('/cpt/:postType/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        CustomPostTypeController::updateItem($params['postType'], (int) $params['id']);
    }
    elseif ($method === 'DELETE' && match_route('/cpt/:postType/:id', $path, $params)) {
        $user = authenticate_token();
        require_min_role($user, 'editor');
        CustomPostTypeController::deleteItem($params['postType'], (int) $params['id']);
    }

    // ── Plugin routes (fallback before 404) ──
    elseif (dispatch_plugin_routes($method, $path)) {
        // handled by a plugin
    }

    // ── 404 ──
    else {
        error_response('Not found', 404);
    }

} catch (PDOException $e) {
    error_log('Database error: ' . $e->getMessage());
    error_response('Internal server error', 500);
} catch (\Exception $e) {
    error_log('Error: ' . $e->getMessage());
    error_response('Internal server error', 500);
}

// ─── Image Optimization ──────────────────────────────────────────────────────
function serve_optimized_image(string $filename): void {
    $w = min((int) ($_GET['w'] ?? 1200), 2400);
    $q = min((int) ($_GET['q'] ?? 80), 100);
    $format = ($_GET['f'] ?? 'webp') === 'avif' ? 'avif' : 'webp';

    $uploadsDir = __DIR__ . '/uploads/media';
    $cacheDir = __DIR__ . '/uploads/media/_optimized';
    $originalPath = $uploadsDir . '/' . basename($filename);

    if (!file_exists($originalPath)) {
        http_response_code(404);
        exit;
    }

    $cacheName = pathinfo($filename, PATHINFO_FILENAME) . "_{$w}_{$q}.{$format}";
    $cachePath = $cacheDir . '/' . $cacheName;

    // Serve from cache
    if (file_exists($cachePath)) {
        header("Content-Type: image/{$format}");
        header('Cache-Control: public, max-age=31536000, immutable');
        readfile($cachePath);
        exit;
    }

    // SVGs can't be rasterized — serve original with cache headers
    $ext = strtolower(pathinfo($originalPath, PATHINFO_EXTENSION));
    if ($ext === 'svg') {
        header('Content-Type: image/svg+xml');
        header('Cache-Control: public, max-age=31536000, immutable');
        readfile($originalPath);
        exit;
    }

    // Generate optimized version with GD
    $info = getimagesize($originalPath);
    if (!$info) {
        // Not an image, serve original with cache
        header('Cache-Control: public, max-age=31536000, immutable');
        readfile($originalPath);
        exit;
    }

    $mime = $info['mime'];
    $srcW = $info[0];
    $srcH = $info[1];

    // Create source image
    switch ($mime) {
        case 'image/jpeg': $src = imagecreatefromjpeg($originalPath); break;
        case 'image/png':  $src = imagecreatefrompng($originalPath); break;
        case 'image/gif':  $src = imagecreatefromgif($originalPath); break;
        case 'image/webp': $src = imagecreatefromwebp($originalPath); break;
        default:
            readfile($originalPath);
            exit;
    }

    if (!$src) {
        readfile($originalPath);
        exit;
    }

    // Resize (without enlargement)
    $newW = min($w, $srcW);
    $newH = (int) round($srcH * ($newW / $srcW));
    $dst = imagecreatetruecolor($newW, $newH);

    // Preserve transparency for PNG
    if ($mime === 'image/png') {
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
    }

    imagecopyresampled($dst, $src, 0, 0, 0, 0, $newW, $newH, $srcW, $srcH);
    imagedestroy($src);

    // Sharpen after downscale to restore lost detail
    if ($newW < $srcW && function_exists('imageconvolution')) {
        $sharpen = [
            [-1, -1, -1],
            [-1, 20, -1],
            [-1, -1, -1],
        ];
        imageconvolution($dst, $sharpen, 12, 0);
    }

    // Ensure cache dir exists
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0755, true);
    }

    // Output based on format
    if ($format === 'avif' && function_exists('imageavif')) {
        imageavif($dst, $cachePath, $q);
    } else {
        $format = 'webp'; // fallback
        imagewebp($dst, $cachePath, $q);
    }
    imagedestroy($dst);

    header("Content-Type: image/{$format}");
    header('Cache-Control: public, max-age=31536000, immutable');
    readfile($cachePath);
    exit;
}
