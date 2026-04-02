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
require_once __DIR__ . '/middleware/auth.php';

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

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── Static file routes (handled before JSON content-type) ───────────────────
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// DEBUG: temporary (remove after testing)
if (strpos($uri, 'debug') !== false || strpos($_SERVER['REQUEST_URI'], 'debug') !== false) {
    header('Content-Type: application/json');
    echo json_encode([
        'REQUEST_URI' => $_SERVER['REQUEST_URI'],
        'SCRIPT_NAME' => $_SERVER['SCRIPT_NAME'] ?? null,
        'DOCUMENT_ROOT' => $_SERVER['DOCUMENT_ROOT'] ?? null,
        'parsed_uri' => $uri,
        '__DIR__' => __DIR__,
        'admin_exists' => is_dir(__DIR__ . '/admin'),
        'login_exists' => file_exists(__DIR__ . '/admin/login.html'),
        'dist_exists' => is_dir(__DIR__ . '/dist'),
        'htaccess_exists' => file_exists(__DIR__ . '/.htaccess'),
    ]);
    exit;
}

// Serve admin interface files
if (preg_match('#^/admin(?:/(.*))?$#', $uri, $m)) {
    $path = $m[1] ?? '';
    if (empty($path) || $path === '/') {
        // /admin → serve index.html (app.js handles auth check)
        header('Content-Type: text/html; charset=utf-8');
        readfile(__DIR__ . '/admin/index.html');
        exit;
    }
    $file = __DIR__ . '/admin/' . $path;
    if (file_exists($file) && !is_dir($file)) {
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        $mimeMap = ['html' => 'text/html', 'css' => 'text/css', 'js' => 'application/javascript', 'json' => 'application/json', 'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'ico' => 'image/x-icon'];
        $mime = $mimeMap[$ext] ?? mime_content_type($file);
        header("Content-Type: $mime; charset=utf-8");
        readfile($file);
        exit;
    }
    http_response_code(404);
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

// Serve nickl-assets: try nickl/public/ first, then backend/public/nickl/
if (preg_match('#^/nickl-assets/(.+)$#', $uri, $m)) {
    $candidates = [
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

// Serve plugin-assets from the plugins directory
if (preg_match('#^/plugin-assets/(.+)$#', $uri, $m)) {
    $file = __DIR__ . '/../plugins/' . $m[1];
    if (file_exists($file)) {
        $mime = mime_content_type($file);
        header("Content-Type: $mime");
        readfile($file);
        exit;
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
            readfile($distHome);
            exit;
        }
        // Fallback: redirect to admin
        header('Location: /admin/login.html');
        exit;
    }

    if (file_exists($distFile) && !is_dir($distFile)) {
        $mime = mime_content_type($distFile) ?: 'application/octet-stream';
        header("Content-Type: $mime");
        readfile($distFile);
        exit;
    }

    if (file_exists($distIndex)) {
        header('Content-Type: text/html; charset=utf-8');
        readfile($distIndex);
        exit;
    }

    // 404: serve dist/404.html if it exists
    $dist404 = __DIR__ . '/dist/404.html';
    if (file_exists($dist404)) {
        http_response_code(404);
        header('Content-Type: text/html; charset=utf-8');
        readfile($dist404);
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
    // ── Auth ──
    if ($method === 'POST' && $path === '/auth/login') {
        AuthController::login();
    }
    elseif ($method === 'GET' && $path === '/auth/me') {
        $user = authenticate_token();
        AuthController::me($user);
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
        PostController::create($user);
    }
    elseif ($method === 'PUT' && match_route('/posts/:id', $path, $params)) {
        $user = authenticate_token();
        PostController::update((int) $params['id'], $user);
    }
    elseif ($method === 'DELETE' && match_route('/posts/:id', $path, $params)) {
        $user = authenticate_token();
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
        CategoryController::create();
    }
    elseif ($method === 'PUT' && match_route('/categories/:id', $path, $params)) {
        $user = authenticate_token();
        CategoryController::update((int) $params['id']);
    }
    elseif ($method === 'DELETE' && match_route('/categories/:id', $path, $params)) {
        $user = authenticate_token();
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
        require_admin($user);
        MenuController::getAllPageMenuInfo();
    }
    elseif ($method === 'GET' && match_route('/pages/:slug', $path, $params)) {
        // Check if slug is a pageId for menu routes
        if (is_numeric($params['slug'])) {
            // Could be /pages/:pageId/menus
            // Handled below in page-menu routes
        }
        PageController::getBySlug($params['slug']);
    }
    elseif ($method === 'POST' && $path === '/pages') {
        $user = authenticate_token();
        PageController::create($user);
    }
    elseif ($method === 'PUT' && match_route('/pages/:id', $path, $params)) {
        // Check for /pages/:pageId/menus
        if (preg_match('#^/pages/(\d+)/menus$#', $path, $pm)) {
            $user = authenticate_token();
            require_admin($user);
            MenuController::syncPageMenus((int) $pm[1]);
            return;
        }
        $user = authenticate_token();
        PageController::update((int) $params['id'], $user);
    }
    elseif ($method === 'DELETE' && match_route('/pages/:id', $path, $params)) {
        $user = authenticate_token();
        PageController::delete((int) $params['id']);
    }

    // ── Page ↔ Menu assignments ──
    elseif ($method === 'GET' && match_route('/pages/:pageId/menus', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        MenuController::getPageMenus((int) $params['pageId']);
    }
    elseif ($method === 'PUT' && match_route('/pages/:pageId/menus', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
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
        ReusableBlocController::create($user);
    }
    elseif ($method === 'PUT' && match_route('/reusable-blocs/:id', $path, $params)) {
        $user = authenticate_token();
        ReusableBlocController::update((int) $params['id']);
    }
    elseif ($method === 'DELETE' && match_route('/reusable-blocs/:id', $path, $params)) {
        $user = authenticate_token();
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
        require_admin($user);
        SettingsController::getAllSettings();
    }
    elseif ($method === 'PUT' && $path === '/settings') {
        $user = authenticate_token();
        require_admin($user);
        SettingsController::updateSettings();
    }

    // ── Rebuild ──
    elseif ($method === 'POST' && $path === '/rebuild') {
        $user = authenticate_token();
        require_admin($user);
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

    // ── Module fields & templates (admin) ──
    elseif ($method === 'GET' && $path === '/module-fields') {
        $user = authenticate_token();
        require_admin($user);
        ModuleFieldsController::getModuleFields();
    }
    elseif ($method === 'GET' && $path === '/module-template') {
        $user = authenticate_token();
        require_admin($user);
        ModuleTemplatesController::getModuleTemplate();
    }

    // ── Plugins (admin) ──
    elseif ($method === 'GET' && $path === '/plugins') {
        $user = authenticate_token();
        require_admin($user);
        PluginController::getPlugins();
    }

    // ── Block rendering ──
    elseif ($method === 'POST' && $path === '/render-block') {
        RenderBlockController::renderBlock();
    }

    // ── Media (admin) ──
    elseif ($method === 'GET' && $path === '/media/folders') {
        $user = authenticate_token();
        require_admin($user);
        MediaController::getFolders();
    }
    elseif ($method === 'POST' && $path === '/media/folders') {
        $user = authenticate_token();
        require_admin($user);
        MediaController::createFolder();
    }
    elseif ($method === 'PUT' && match_route('/media/folders/:id', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        MediaController::updateFolder((int) $params['id']);
    }
    elseif ($method === 'DELETE' && match_route('/media/folders/:id', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        MediaController::deleteFolder((int) $params['id']);
    }
    elseif ($method === 'GET' && $path === '/media') {
        $user = authenticate_token();
        require_admin($user);
        MediaController::getItems();
    }
    elseif ($method === 'POST' && $path === '/media/upload') {
        $user = authenticate_token();
        require_admin($user);
        MediaController::upload();
    }
    elseif ($method === 'PUT' && match_route('/media/:id', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        MediaController::updateItem((int) $params['id']);
    }
    elseif ($method === 'DELETE' && match_route('/media/:id', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
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
        require_admin($user);
        MenuController::getAll();
    }
    elseif ($method === 'GET' && $path === '/menus/pages') {
        $user = authenticate_token();
        require_admin($user);
        MenuController::getAvailablePages();
    }
    elseif ($method === 'GET' && $path === '/menus/cpt-items') {
        $user = authenticate_token();
        require_admin($user);
        MenuController::getAvailableCptItems();
    }
    elseif ($method === 'GET' && match_route('/menus/:id', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        MenuController::getById((int) $params['id']);
    }
    elseif ($method === 'POST' && $path === '/menus') {
        $user = authenticate_token();
        require_admin($user);
        MenuController::create();
    }
    elseif ($method === 'PUT' && match_route('/menus/:id/items', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        MenuController::saveItems((int) $params['id']);
    }
    elseif ($method === 'PUT' && match_route('/menus/:id', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        MenuController::update((int) $params['id']);
    }
    elseif ($method === 'DELETE' && match_route('/menus/:id', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        MenuController::delete((int) $params['id']);
    }

    // ── Forms (public) ──
    elseif ($method === 'GET' && match_route('/forms/public/:id', $path, $params)) {
        FormController::getPublicForm((int) $params['id']);
    }
    elseif ($method === 'POST' && match_route('/forms/:id/submit', $path, $params)) {
        FormController::submitForm((int) $params['id']);
    }

    // ── Forms (admin) ──
    elseif ($method === 'GET' && $path === '/forms') {
        $user = authenticate_token();
        require_admin($user);
        FormController::getAll();
    }
    elseif ($method === 'GET' && match_route('/forms/:id/entries/export', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        FormController::exportEntries((int) $params['id']);
    }
    elseif ($method === 'GET' && match_route('/forms/:id/entries', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        FormController::getEntries((int) $params['id']);
    }
    elseif ($method === 'GET' && match_route('/forms/entries/:entryId', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        FormController::getEntryById((int) $params['entryId']);
    }
    elseif ($method === 'PUT' && match_route('/forms/entries/:entryId/status', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        FormController::updateEntryStatus((int) $params['entryId']);
    }
    elseif ($method === 'DELETE' && match_route('/forms/entries/:entryId', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        FormController::deleteEntry((int) $params['entryId']);
    }
    elseif ($method === 'GET' && match_route('/forms/:id', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        FormController::getById((int) $params['id']);
    }
    elseif ($method === 'POST' && $path === '/forms') {
        $user = authenticate_token();
        require_admin($user);
        FormController::create();
    }
    elseif ($method === 'PUT' && match_route('/forms/:id', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        FormController::update((int) $params['id']);
    }
    elseif ($method === 'DELETE' && match_route('/forms/:id', $path, $params)) {
        $user = authenticate_token();
        require_admin($user);
        FormController::delete((int) $params['id']);
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
        CustomPostTypeController::createCategory($params['postType']);
    }
    elseif ($method === 'PUT' && match_route('/cpt/:postType/categories/:id', $path, $params)) {
        $user = authenticate_token();
        CustomPostTypeController::updateCategory($params['postType'], (int) $params['id']);
    }
    elseif ($method === 'DELETE' && match_route('/cpt/:postType/categories/:id', $path, $params)) {
        $user = authenticate_token();
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
        CustomPostTypeController::createItem($params['postType'], $user);
    }
    elseif ($method === 'PUT' && match_route('/cpt/:postType/:id', $path, $params)) {
        $user = authenticate_token();
        CustomPostTypeController::updateItem($params['postType'], (int) $params['id']);
    }
    elseif ($method === 'DELETE' && match_route('/cpt/:postType/:id', $path, $params)) {
        $user = authenticate_token();
        CustomPostTypeController::deleteItem($params['postType'], (int) $params['id']);
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

    // Generate optimized version with GD
    $info = getimagesize($originalPath);
    if (!$info) {
        // Not an image, serve original
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
