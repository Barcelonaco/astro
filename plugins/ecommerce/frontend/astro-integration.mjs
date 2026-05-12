/**
 * Astro integration du plugin ecommerce.
 *
 * Scanne `frontend/pages/` du plugin et appelle `injectRoute()` pour chaque
 * fichier .astro/.md/.mdx trouvé. Permet au plugin d'embarquer ses propres
 * pages (boutique, panier, checkout, compte) sans modifier `frontend/src/`.
 *
 * Conventions de nommage des routes :
 *   pages/boutique/index.astro            → /boutique
 *   pages/produits/[slug].astro           → /produits/[slug]
 *   pages/compte/commandes/[number].astro → /compte/commandes/[number]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_NAME = 'plugin-ecommerce';
const PAGE_EXTS = new Set(['.astro', '.md', '.mdx']);

export default function ecommerceIntegration() {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const pagesRoot = path.join(root, 'pages');

  return {
    name: PLUGIN_NAME,
    hooks: {
      'astro:config:setup': ({ injectRoute, logger }) => {
        if (!fs.existsSync(pagesRoot)) {
          logger.info(`${PLUGIN_NAME}: no pages/ directory, skipping`);
          return;
        }

        const files = walk(pagesRoot);
        let count = 0;
        for (const file of files) {
          if (!PAGE_EXTS.has(path.extname(file))) continue;
          const rel = path.relative(pagesRoot, file).replace(/\\/g, '/');
          const pattern = '/' + rel
            .replace(/\.(astro|md|mdx)$/, '')
            .replace(/\/index$/, '')
            .replace(/^index$/, '');
          injectRoute({ pattern: pattern || '/', entrypoint: file });
          count++;
        }
        logger.info(`${PLUGIN_NAME}: injected ${count} route(s)`);
      },
    },
  };
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
