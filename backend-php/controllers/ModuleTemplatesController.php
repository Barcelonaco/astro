<?php

class ModuleTemplatesController {
    private static function safeSlug(string $input): string {
        return preg_replace('/[^a-z0-9\-_]/', '', strtolower($input));
    }

    public static function getModuleTemplate(): void {
        $layout = self::safeSlug(get_query_param('layout', ''));
        if (empty($layout)) {
            error_response('Missing layout', 400);
        }

        $backendRoot = realpath(__DIR__ . '/..');
        $repoRoot = realpath(__DIR__ . '/../..');

        // Look for template: first in backend-php/templates, then nickl/, then plugins/
        $templatePath = $backendRoot . '/templates/modules/' . $layout . '.blade.php';
        $pluginDir = null;

        if (!file_exists($templatePath)) {
            $templatePath = $repoRoot . '/nickl/resources/views/modules/' . $layout . '.blade.php';
        }

        if (!file_exists($templatePath)) {
            $pluginsDir = $repoRoot . '/plugins';
            if (is_dir($pluginsDir)) {
                foreach (scandir($pluginsDir) as $dir) {
                    if ($dir === '.' || $dir === '..') continue;
                    if (!is_dir($pluginsDir . '/' . $dir)) continue;
                    $candidate = $pluginsDir . '/' . $dir . '/templates/' . $layout . '.blade.php';
                    if (file_exists($candidate)) {
                        $templatePath = $candidate;
                        $pluginDir = $dir;
                        break;
                    }
                }
            }
            if (!file_exists($templatePath)) {
                error_response('Template not found', 404);
            }
        }

        $template = file_get_contents($templatePath);

        // Resolve CSS
        $cssUrl = null;
        $adminModuleCssPath = __DIR__ . '/../admin/modules/' . $layout . '.css';
        $nicklCssPath = $repoRoot . '/nickl/public/css/' . $layout . '.css';
        if (file_exists($adminModuleCssPath)) {
            $cssUrl = '/admin/modules/' . $layout . '.css';
        } elseif (file_exists($nicklCssPath)) {
            // Fallback: nickl compiled CSS (local dev)
            $cssUrl = '/nickl-assets/css/' . $layout . '.css';
        } elseif ($pluginDir) {
            $pluginCssPath = $repoRoot . '/plugins/' . $pluginDir . '/css/' . $layout . '.css';
            if (file_exists($pluginCssPath)) {
                $cssUrl = '/plugin-assets/' . $pluginDir . '/css/' . $layout . '.css';
            }
        }

        // Resolve admin CSS
        $adminCssUrl = null;
        if (file_exists($adminModuleCssPath)) {
            $adminCssUrl = '/admin/modules/' . $layout . '.css';
        } elseif ($pluginDir) {
            $pluginAdminCssPath = $repoRoot . '/plugins/' . $pluginDir . '/admin-css/' . $layout . '.css';
            if (file_exists($pluginAdminCssPath)) {
                $adminCssUrl = '/plugin-assets/' . $pluginDir . '/admin-css/' . $layout . '.css';
            }
        }

        json_response([
            'layout' => $layout,
            'template' => $template,
            'cssUrl' => $cssUrl,
            'adminCssUrl' => $adminCssUrl,
            'plugin' => $pluginDir
        ]);
    }
}
