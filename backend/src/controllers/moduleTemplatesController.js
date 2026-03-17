import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function safeSlug(input) {
  return String(input || '').toLowerCase().replace(/[^a-z0-9-_]/g, '');
}

export function getModuleTemplate(req, res) {
  try {
    const layout = safeSlug(req.query.layout);
    if (!layout) {
      return res.status(400).json({ error: 'Missing layout' });
    }

    const repoRoot = path.resolve(__dirname, '../../..');

    // Look for template: first in nickl, then in plugins
    let templatePath = path.join(repoRoot, 'nickl', 'resources', 'views', 'modules', `${layout}.blade.php`);
    let pluginDir = null;

    if (!fs.existsSync(templatePath)) {
      const pluginsDir = path.join(repoRoot, 'plugins');
      if (fs.existsSync(pluginsDir)) {
        for (const dir of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
          if (!dir.isDirectory()) continue;
          const candidate = path.join(pluginsDir, dir.name, 'templates', `${layout}.blade.php`);
          if (fs.existsSync(candidate)) {
            templatePath = candidate;
            pluginDir = dir.name;
            break;
          }
        }
      }
      if (!fs.existsSync(templatePath)) {
        return res.status(404).json({ error: 'Template not found' });
      }
    }

    const template = fs.readFileSync(templatePath, 'utf-8');

    // Resolve CSS: nickl first, then plugin
    let cssUrl = null;
    const nicklCssPath = path.join(repoRoot, 'nickl', 'public', 'css', `${layout}.css`);
    if (fs.existsSync(nicklCssPath)) {
      cssUrl = `/nickl-assets/css/${layout}.css`;
    } else if (pluginDir) {
      const pluginCssPath = path.join(repoRoot, 'plugins', pluginDir, 'css', `${layout}.css`);
      if (fs.existsSync(pluginCssPath)) cssUrl = `/plugin-assets/${pluginDir}/css/${layout}.css`;
    }

    // Resolve admin CSS: admin/modules first, then plugin
    let adminCssUrl = null;
    const adminCssPath = path.join(__dirname, '../../public/admin/modules', `${layout}.css`);
    if (fs.existsSync(adminCssPath)) {
      adminCssUrl = `/admin/modules/${layout}.css`;
    } else if (pluginDir) {
      const pluginAdminCssPath = path.join(repoRoot, 'plugins', pluginDir, 'admin-css', `${layout}.css`);
      if (fs.existsSync(pluginAdminCssPath)) adminCssUrl = `/plugin-assets/${pluginDir}/admin-css/${layout}.css`;
    }

    res.json({ layout, template, cssUrl, adminCssUrl, plugin: pluginDir });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load template' });
  }
}
