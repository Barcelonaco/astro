<?php

/**
 * Compute the current request origin (scheme://host) from server vars.
 */
function current_request_origin(): string {
    $proto = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '';
    $isHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $proto === 'https';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return ($isHttps ? 'https' : 'http') . '://' . $host;
}

/**
 * Read the origin baked into dist/ at build time. Cached per-request.
 * Returns '' if the sentinel file is missing (older builds, dev mode).
 */
function built_origin(): string {
    static $cached = null;
    if ($cached !== null) return $cached;
    $f = __DIR__ . '/../dist/.built_origin';
    $cached = is_file($f) ? trim(file_get_contents($f)) : '';
    return $cached;
}

/**
 * Rewrite the baked origin to the current request origin inside an HTML
 * payload. Catches <link rel="canonical">, og:url, twitter:url, RSS link,
 * og:image (when relative was resolved against Astro.site) and JSON-LD URLs
 * — anything that ended up containing the build-time origin string.
 */
function rewrite_html_origin(string $html): string {
    $built = built_origin();
    if ($built === '') return $html;
    $current = current_request_origin();
    if ($current === $built) return $html;
    return str_replace($built, $current, $html);
}

/**
 * Sitemap / robots.txt host rewriting.
 *
 * Astro generates dist/sitemap-index.xml, dist/sitemap-0.xml and dist/robots.txt
 * at build time with the BUILD_SITE_URL baked in. To avoid rebuilding the
 * frontend for every domain, we serve those files through PHP and rewrite any
 * absolute origin (https://anything/) to the current request origin computed
 * from HTTP_HOST + scheme. Same content, dynamic host.
 */

function serve_dynamic_sitemap_or_robots(string $uri): bool {
    $map = [
        '/sitemap.xml'       => ['file' => 'sitemap-index.xml', 'mime' => 'application/xml; charset=utf-8'],
        '/sitemap-index.xml' => ['file' => 'sitemap-index.xml', 'mime' => 'application/xml; charset=utf-8'],
        '/sitemap-0.xml'     => ['file' => 'sitemap-0.xml',     'mime' => 'application/xml; charset=utf-8'],
        '/robots.txt'        => ['file' => 'robots.txt',        'mime' => 'text/plain; charset=utf-8'],
    ];
    if (!isset($map[$uri])) return false;

    $path = __DIR__ . '/../dist/' . $map[$uri]['file'];
    if (!file_exists($path)) return false;

    $proto = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '';
    $isHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $proto === 'https';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $origin = ($isHttps ? 'https' : 'http') . '://' . $host;

    $body = file_get_contents($path);

    // Rewrite host inside <loc>…</loc> (sitemap entries) and inside
    // "Sitemap: …" directives (robots.txt). xmlns="…" namespace attributes
    // are intentionally left alone — they're identifiers, not URLs to fetch.
    $rewriteUrl = static function (string $url) use ($origin): string {
        $parts = parse_url($url);
        $path = $parts['path'] ?? '/';
        $query = isset($parts['query']) ? '?' . $parts['query'] : '';
        $frag  = isset($parts['fragment']) ? '#' . $parts['fragment'] : '';
        return "{$origin}{$path}{$query}{$frag}";
    };

    $body = preg_replace_callback(
        '#<loc>(https?://[^<]+)</loc>#i',
        fn ($m) => '<loc>' . htmlspecialchars($rewriteUrl(html_entity_decode($m[1])), ENT_XML1) . '</loc>',
        $body
    );

    $body = preg_replace_callback(
        '#^(Sitemap:\s*)(https?://\S+)#mi',
        fn ($m) => $m[1] . $rewriteUrl($m[2]),
        $body
    );

    header('Content-Type: ' . $map[$uri]['mime']);
    header('Cache-Control: public, max-age=3600');
    echo $body;
    return true;
}
