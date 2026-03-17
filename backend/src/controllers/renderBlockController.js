import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

/**
 * Simple Blade-like variable substitution for plugin templates.
 * Handles {{ $variable }} and {!! $variable !!} patterns.
 */
function renderTemplate(template, variables) {
  let html = template;

  // {!! $var !!} — raw (unescaped) output
  html = html.replace(/\{!!\s*\$(\w+)\s*!!\}/g, (_, name) => {
    const val = variables[name];
    return val != null ? String(val) : '';
  });

  // {{ $var }} — escaped output
  html = html.replace(/\{\{\s*\$(\w+)\s*\}\}/g, (_, name) => {
    const val = variables[name];
    if (val == null) return '';
    return String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  });

  // Remove Blade directives we can't process (@if, @foreach, etc.)
  html = html.replace(/@(if|else|elseif|endif|foreach|endforeach|unless|endunless|empty|endempty|isset|endisset|section|endsection|yield|extends|include|php|endphp)\b[^]*?(?=@|$)/g, '');

  return html;
}

/**
 * Find the Blade template for a given layout name.
 * Searches nickl modules first, then plugin template directories.
 */
function findTemplate(layout) {
  // Try nickl first
  const nicklPath = path.join(repoRoot, 'nickl', 'resources', 'views', 'modules', `${layout}.blade.php`);
  if (fs.existsSync(nicklPath)) return fs.readFileSync(nicklPath, 'utf-8');

  // Try plugins
  const pluginsDir = path.join(repoRoot, 'plugins');
  if (fs.existsSync(pluginsDir)) {
    for (const dir of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const candidate = path.join(pluginsDir, dir.name, 'templates', `${layout}.blade.php`);
      if (fs.existsSync(candidate)) return fs.readFileSync(candidate, 'utf-8');
    }
  }

  return null;
}

/**
 * POST /api/render-block
 * Body: { type: string, data: object }
 * Returns: { html: string }
 */
export function renderBlock(req, res) {
  try {
    const { type, data } = req.body;
    if (!type) return res.status(400).json({ error: 'Missing type' });

    const template = findTemplate(type);
    if (!template) {
      // No template found — return a simple fallback
      return res.json({ html: '' });
    }

    // Build template variables from data
    const variables = { ...(data || {}) };

    const html = renderTemplate(template, variables);
    res.json({ html });
  } catch (error) {
    console.error('Render block error:', error);
    res.status(500).json({ error: 'Failed to render block' });
  }
}
