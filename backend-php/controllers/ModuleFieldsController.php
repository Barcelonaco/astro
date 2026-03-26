<?php

class ModuleFieldsController {
    private const FIELD_TYPE_PATTERN = '/([A-Za-z0-9_]+)::make\s*\(\s*([\'"])((?:[^\'"\\\\]|\\\\.)*)\2\s*(?:,\s*([\'"])((?:[^\'"\\\\]|\\\\.)*)\4)?/s';
    private const CLASS_PATTERN = '/class\s+([A-Za-z0-9_]+)/';
    private const LAYOUT_PATTERN = '/Layout::make\([^,]+,\s*[\'"]([^\'"]+)[\'"]\)/';
    private const BLOCK_PARAMS_REF_PATTERN = '/BlockParams::(get[A-Za-z0-9_]+)/';

    private const INPUT_FIELD_TYPES = [
        'Text', 'Textarea', 'WYSIWYGEditor', 'Image', 'File', 'URL', 'Url', 'Link',
        'TrueFalse', 'Number', 'Range', 'ColorPicker', 'ButtonGroup', 'Select',
        'RadioButton', 'GoogleMap', 'Repeater', 'Group', 'FlexibleContent', 'Email', 'Password'
    ];

    private static function findStatementEnd(string $text): int {
        $depth = 0;
        $inSingle = false;
        $inDouble = false;
        $len = strlen($text);
        for ($i = 0; $i < $len; $i++) {
            $ch = $text[$i];
            if ($inSingle) {
                if ($ch === '\\') { $i++; continue; }
                if ($ch === "'") $inSingle = false;
            } elseif ($inDouble) {
                if ($ch === '\\') { $i++; continue; }
                if ($ch === '"') $inDouble = false;
            } elseif ($ch === "'") {
                $inSingle = true;
            } elseif ($ch === '"') {
                $inDouble = true;
            } elseif ($ch === '(' || $ch === '[') {
                $depth++;
            } elseif ($ch === ')' || $ch === ']') {
                $depth--;
            } elseif ($ch === ';' && $depth === 0) {
                return $i;
            }
        }
        return -1;
    }

    private static function parseChoices(string $chain): ?array {
        if (!preg_match('/->choices\(\s*\[([\s\S]*?)\]\s*\)/', $chain, $m)) return null;
        $raw = $m[1];
        $choices = [];
        $patterns = [
            "/['\"]([^'\"]+)['\"]\s*=>\s*'((?:[^'\\\\]|\\\\.)*)'/",
            '/[\'"]([^\'"]+)[\'"]\s*=>\s*"((?:[^"\\\\]|\\\\.)*)"/',
        ];
        foreach ($patterns as $pattern) {
            if (preg_match_all($pattern, $raw, $matches, PREG_SET_ORDER)) {
                foreach ($matches as $match) {
                    $choices[] = ['value' => $match[1], 'label' => str_replace(["\\'", '\\"'], ["'", '"'], $match[2])];
                }
            }
        }
        return !empty($choices) ? $choices : null;
    }

    private static function parseStylized(string $chain): ?array {
        if (!preg_match('/->stylized\(\s*on\s*:\s*([\'"])(.*?)\1\s*,\s*off\s*:\s*([\'"])(.*?)\3\s*\)/', $chain, $m)) return null;
        return ['onLabel' => $m[2], 'offLabel' => $m[4]];
    }

    private static function parseDefault(string $chain) {
        if (!preg_match_all('/->default\(\s*(?:[\'"]([^\'"]*)[\'"]\s*|(true|false|null|\d+(?:\.\d+)?))\s*\)/', $chain, $matches, PREG_SET_ORDER)) {
            return null; // use null as sentinel for "not found"
        }
        $m = end($matches);
        if ($m[1] !== '') return $m[1];
        $raw = $m[2];
        if ($raw === 'true') return true;
        if ($raw === 'false') return false;
        if ($raw === 'null') return null;
        return (float) $raw == (int) $raw ? (int) $raw : (float) $raw;
    }

    private static function parseConditionalLogic(string $chain): ?array {
        if (preg_match("/->conditionalLogic\(\[.*?ConditionalLogic::where\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]+)['\"]\s*,\s*(?:['\"]([^'\"]*)['\"]|(\d+|true|false|null))\s*\)/s", $chain, $m)) {
            return ['field' => $m[1], 'operator' => $m[2], 'value' => $m[3] !== '' ? $m[3] : ($m[4] ?? null)];
        }
        if (preg_match("/->conditionalLogic\(\[.*?ConditionalLogic::where\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]+)['\"]\s*\)/s", $chain, $m)) {
            return ['field' => $m[1], 'operator' => $m[2], 'value' => null];
        }
        return null;
    }

    private static function findFieldsRange(string $content, int $fromIndex): ?array {
        $needle = '->fields(';
        $needleIdx = strpos($content, $needle, $fromIndex);
        if ($needleIdx === false) return null;
        $bracketOpen = strpos($content, '[', $needleIdx + strlen($needle));
        if ($bracketOpen === false) return null;

        $depth = 0;
        $inSingle = false;
        $inDouble = false;
        $len = strlen($content);
        for ($i = $bracketOpen; $i < $len; $i++) {
            $ch = $content[$i];
            if ($inSingle) {
                if ($ch === '\\') { $i++; continue; }
                if ($ch === "'") $inSingle = false;
                continue;
            }
            if ($inDouble) {
                if ($ch === '\\') { $i++; continue; }
                if ($ch === '"') $inDouble = false;
                continue;
            }
            if ($ch === "'") { $inSingle = true; continue; }
            if ($ch === '"') { $inDouble = true; continue; }
            if ($ch === '[' || $ch === '(') $depth++;
            elseif ($ch === ']' || $ch === ')') {
                $depth--;
                if ($depth === 0) return ['start' => $bracketOpen + 1, 'end' => $i];
            }
        }
        return null;
    }

    private static function parseFieldList(string $content): array {
        preg_match_all(self::FIELD_TYPE_PATTERN, $content, $rawMatches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);

        $allMatches = [];
        foreach ($rawMatches as $m) {
            $type = $m[1][0];
            $label = $m[3][0] ?? '';
            $name = isset($m[5]) ? $m[5][0] : '';
            $index = $m[0][1];
            if ($name && in_array($type, self::INPUT_FIELD_TYPES)) {
                $allMatches[] = ['type' => $type, 'label' => $label, 'name' => $name, 'index' => $index];
            }
        }

        // Find container ranges
        $containerRanges = [];
        foreach ($allMatches as $m) {
            if (!in_array($m['type'], ['Repeater', 'Group', 'FlexibleContent'])) continue;
            if ($m['type'] === 'FlexibleContent') {
                $layoutsNeedle = '->layouts(';
                $afterType = strpos($content, $layoutsNeedle, $m['index']);
                if ($afterType !== false) {
                    $depth = 0;
                    for ($i = $afterType + strlen($layoutsNeedle); $i < strlen($content); $i++) {
                        $ch = $content[$i];
                        if ($ch === '(' || $ch === '[') $depth++;
                        elseif ($ch === ')' || $ch === ']') {
                            if ($depth === 0) {
                                $containerRanges[] = ['parentIndex' => $m['index'], 'start' => $afterType, 'end' => $i, 'isFlexible' => true];
                                break;
                            }
                            $depth--;
                        }
                    }
                }
                continue;
            }
            $range = self::findFieldsRange($content, $m['index'] + strlen($m['type']));
            if ($range) $containerRanges[] = ['parentIndex' => $m['index'], 'start' => $range['start'], 'end' => $range['end'], 'isFlexible' => false];
        }

        $isSubField = function ($index) use ($containerRanges) {
            foreach ($containerRanges as $r) {
                if ($index > $r['start'] && $index < $r['end']) return true;
            }
            return false;
        };

        $fields = [];
        $seen = [];

        foreach ($allMatches as $m) {
            if ($isSubField($m['index'])) continue;
            $key = $m['name'] . ':' . $m['type'];
            if (isset($seen[$key])) continue;
            $seen[$key] = true;

            $containerRange = null;
            foreach ($containerRanges as $r) {
                if ($r['parentIndex'] === $m['index']) { $containerRange = $r; break; }
            }

            if ($containerRange) {
                $chainEnd = $containerRange['end'] + 1;
            } else {
                $chainEnd = strlen($content);
                foreach ($allMatches as $m2) {
                    if ($m2['index'] > $m['index'] && !$isSubField($m2['index'])) {
                        $chainEnd = $m2['index'];
                        break;
                    }
                }
            }

            $rawChain = substr($content, $m['index'], $chainEnd - $m['index']);
            $semiIdx = self::findStatementEnd($rawChain);
            $chain = $semiIdx !== -1 ? substr($rawChain, 0, $semiIdx + 1) : $rawChain;

            $ownChain = $chain;
            if ($containerRange) {
                $fieldsPos = strpos($chain, '->fields(');
                if ($fieldsPos !== false) $ownChain = substr($chain, 0, $fieldsPos);
            }

            $subFields = null;
            if ($containerRange && empty($containerRange['isFlexible'])) {
                $subContent = substr($content, $containerRange['start'], $containerRange['end'] - $containerRange['start']);
                $subFields = self::parseFieldList($subContent);
            }

            $field = [
                'name' => $m['name'],
                'label' => $m['label'],
                'type' => $m['type'],
                'choices' => self::parseChoices($ownChain),
                'onLabel' => null,
                'offLabel' => null,
                'conditional' => self::parseConditionalLogic($ownChain),
                'subFields' => $subFields,
            ];

            $stylized = self::parseStylized($ownChain);
            if ($stylized) {
                $field['onLabel'] = $stylized['onLabel'];
                $field['offLabel'] = $stylized['offLabel'];
            }

            $defaultValue = self::parseDefault($ownChain);
            if ($defaultValue !== null) $field['defaultValue'] = $defaultValue;

            $fields[] = $field;
        }

        return $fields;
    }

    private static function extractFieldsFromPhp(string $content): array {
        preg_match_all(self::FIELD_TYPE_PATTERN, $content, $rawMatches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);

        $matches = [];
        foreach ($rawMatches as $m) {
            $matches[] = [
                'type' => $m[1][0],
                'label' => $m[3][0] ?? '',
                'name' => isset($m[5]) ? $m[5][0] : '',
                'index' => $m[0][1],
            ];
        }

        $fields = [];
        $seen = [];

        for ($i = 0; $i < count($matches); $i++) {
            $current = $matches[$i];
            $nextIndex = isset($matches[$i + 1]) ? $matches[$i + 1]['index'] : strlen($content);
            $rawChain = substr($content, $current['index'], $nextIndex - $current['index']);
            $semiIdx = self::findStatementEnd($rawChain);
            $chain = $semiIdx !== -1 ? substr($rawChain, 0, $semiIdx + 1) : $rawChain;

            if (!$current['name'] || !in_array($current['type'], self::INPUT_FIELD_TYPES)) continue;
            $key = $current['name'] . ':' . $current['type'];
            if (isset($seen[$key])) continue;
            $seen[$key] = true;

            $field = [
                'name' => $current['name'],
                'label' => $current['label'],
                'type' => $current['type'],
                'choices' => self::parseChoices($chain),
                'onLabel' => null,
                'offLabel' => null,
                'conditional' => self::parseConditionalLogic($chain),
            ];

            $stylized = self::parseStylized($chain);
            if ($stylized) {
                $field['onLabel'] = $stylized['onLabel'];
                $field['offLabel'] = $stylized['offLabel'];
            }

            $defaultValue = self::parseDefault($chain);
            if ($defaultValue !== null) $field['defaultValue'] = $defaultValue;

            $fields[] = $field;
        }

        return $fields;
    }

    private static function parseBlockParamsMethods(string $content): array {
        $methods = [];
        preg_match_all('/public\s+static\s+function\s+([A-Za-z0-9_]+)\s*\(/', $content, $methodMatches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);

        for ($i = 0; $i < count($methodMatches); $i++) {
            $name = $methodMatches[$i][1][0];
            $start = $methodMatches[$i][0][1];
            $end = isset($methodMatches[$i + 1]) ? $methodMatches[$i + 1][0][1] : strlen($content);
            $slice = substr($content, $start, $end - $start);
            $methods[$name] = self::extractFieldsFromPhp($slice);
        }

        return $methods;
    }

    private static function parsePhpFile(string $filePath, array $blockParamsMap): ?array {
        $content = file_get_contents($filePath);
        if (!preg_match(self::CLASS_PATTERN, $content, $classMatch)) return null;

        $className = $classMatch[1];
        preg_match(self::LAYOUT_PATTERN, $content, $layoutMatch);
        $layout = $layoutMatch[1] ?? null;

        $directFields = self::parseFieldList($content);

        // BlockParams shared fields
        $dedup = [];
        $seenRefs = [];
        preg_match_all(self::BLOCK_PARAMS_REF_PATTERN, $content, $refMatches);
        foreach ($refMatches[1] as $ref) {
            if (isset($seenRefs[$ref])) continue;
            $seenRefs[$ref] = true;
            foreach ($blockParamsMap[$ref] ?? [] as $field) {
                if (!isset($dedup[$field['name']])) $dedup[$field['name']] = $field;
            }
        }

        foreach ($directFields as $field) {
            if (!isset($dedup[$field['name']])) $dedup[$field['name']] = $field;
        }

        return ['className' => $className, 'layout' => $layout, 'fields' => array_values($dedup)];
    }

    public static function getModuleFields(): void {
        $repoRoot = realpath(__DIR__ . '/../..');
        $modulesDir = $repoRoot . '/nickl/app/Modules';
        $fieldGroupDir = $modulesDir . '/FieldGroup';
        $blockParamsPath = $modulesDir . '/BlockParams.php';

        $blockParamsMap = file_exists($blockParamsPath)
            ? self::parseBlockParamsMethods(file_get_contents($blockParamsPath))
            : [];

        $modules = [];

        $scanDir = function (string $dir) use (&$scanDir, &$modules, $blockParamsMap) {
            if (!is_dir($dir)) return;
            foreach (scandir($dir) as $entry) {
                if ($entry === '.' || $entry === '..') continue;
                $fullPath = $dir . '/' . $entry;
                if (is_dir($fullPath)) {
                    $scanDir($fullPath);
                    continue;
                }
                if (!str_ends_with($entry, '.php')) continue;

                $parsed = self::parsePhpFile($fullPath, $blockParamsMap);
                if (!$parsed) continue;

                if (!isset($modules[$parsed['className']])) {
                    $modules[$parsed['className']] = ['fields' => $parsed['fields'], 'layout' => $parsed['layout']];
                } else {
                    $existing = [];
                    foreach ($modules[$parsed['className']]['fields'] as $f) $existing[$f['name']] = $f;
                    foreach ($parsed['fields'] as $f) {
                        if (!isset($existing[$f['name']])) $existing[$f['name']] = $f;
                    }
                    $modules[$parsed['className']]['fields'] = array_values($existing);
                    if (!$modules[$parsed['className']]['layout'] && $parsed['layout']) {
                        $modules[$parsed['className']]['layout'] = $parsed['layout'];
                    }
                }
            }
        };

        $scanDir($modulesDir);
        if (is_dir($fieldGroupDir)) $scanDir($fieldGroupDir);

        // Scan plugin modules
        $pluginsDir = $repoRoot . '/plugins';
        if (is_dir($pluginsDir)) {
            foreach (scandir($pluginsDir) as $entry) {
                if ($entry === '.' || $entry === '..') continue;
                $pluginModulesDir = $pluginsDir . '/' . $entry . '/modules';
                $scanDir($pluginModulesDir);
            }
        }

        json_response(['modules' => $modules]);
    }
}
