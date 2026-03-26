<?php

class RenderBlockController {
    private static function renderTemplate(string $template, array $variables): string {
        $html = $template;

        // {!! $var !!} — raw (unescaped) output
        $html = preg_replace_callback('/\{!!\s*\$(\w+)\s*!!\}/', function ($m) use ($variables) {
            return isset($variables[$m[1]]) ? (string) $variables[$m[1]] : '';
        }, $html);

        // {{ $var }} — escaped output
        $html = preg_replace_callback('/\{\{\s*\$(\w+)\s*\}\}/', function ($m) use ($variables) {
            if (!isset($variables[$m[1]])) return '';
            return htmlspecialchars((string) $variables[$m[1]], ENT_QUOTES, 'UTF-8');
        }, $html);

        // Remove Blade directives we can't process
        $html = preg_replace('/@(if|else|elseif|endif|foreach|endforeach|unless|endunless|empty|endempty|isset|endisset|section|endsection|yield|extends|include|php|endphp)\b[^]*?(?=@|$)/', '', $html);

        return $html;
    }

    private static function findTemplate(string $layout): ?string {
        $repoRoot = realpath(__DIR__ . '/../..');

        // Try nickl first
        $nicklPath = $repoRoot . '/nickl/resources/views/modules/' . $layout . '.blade.php';
        if (file_exists($nicklPath)) return file_get_contents($nicklPath);

        // Try plugins
        $pluginsDir = $repoRoot . '/plugins';
        if (is_dir($pluginsDir)) {
            foreach (scandir($pluginsDir) as $dir) {
                if ($dir === '.' || $dir === '..') continue;
                if (!is_dir($pluginsDir . '/' . $dir)) continue;
                $candidate = $pluginsDir . '/' . $dir . '/templates/' . $layout . '.blade.php';
                if (file_exists($candidate)) return file_get_contents($candidate);
            }
        }

        return null;
    }

    public static function renderBlock(): void {
        $body = get_json_body();
        $type = $body['type'] ?? '';
        if (empty($type)) error_response('Missing type', 400);

        $template = self::findTemplate($type);
        if (!$template) {
            json_response(['html' => '']);
            return;
        }

        $variables = $body['data'] ?? [];
        $html = self::renderTemplate($template, $variables);
        json_response(['html' => $html]);
    }
}
