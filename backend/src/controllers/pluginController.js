import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pluginsDir = path.resolve(__dirname, '../../../plugins');

/**
 * Read and parse all plugin.json manifests from the plugins/ directory.
 * Returns an array of manifest objects (with _dir injected).
 */
export function getPluginManifests() {
  if (!fs.existsSync(pluginsDir)) return [];

  const manifests = [];
  for (const entry of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(pluginsDir, entry.name, 'plugin.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      manifest._dir = entry.name;
      manifests.push(manifest);
    } catch {
      console.warn(`⚠️  Invalid plugin.json in plugins/${entry.name}`);
    }
  }
  return manifests;
}

/**
 * GET /api/plugins — returns all plugin manifests (admin only).
 */
export function getPlugins(req, res) {
  res.json({ plugins: getPluginManifests() });
}
