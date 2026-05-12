// @ts-check

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SITE_URL = process.env.BUILD_SITE_URL
	|| process.env.BUILD_MEDIA_ORIGIN
	|| 'http://localhost:4321';

// ── Plugin integrations auto-loader ────────────────────────────────────────
// Charge tous les `plugins/*/frontend/astro-integration.mjs` présents.
// Permet à un plugin (ex. ecommerce) d'embarquer ses pages/components/lib
// dans son propre dossier — aucun code plugin-specific dans frontend/src/.
async function loadPluginIntegrations() {
	const pluginsDir = path.resolve(__dirname, '../plugins');
	const out = [];
	if (!fs.existsSync(pluginsDir)) return out;
	for (const name of fs.readdirSync(pluginsDir)) {
		const integ = path.join(pluginsDir, name, 'frontend/astro-integration.mjs');
		if (!fs.existsSync(integ)) continue;
		const mod = await import(`file://${integ}`);
		if (typeof mod.default === 'function') out.push(mod.default());
	}
	return out;
}
const pluginIntegrations = await loadPluginIntegrations();

function robotsTxtIntegration() {
	return {
		name: 'robots-txt',
		hooks: {
			'astro:build:done': ({ dir }) => {
				const outDir = typeof dir === 'string' ? dir : dir.pathname;
				const body = [
					'User-agent: *',
					'Allow: /',
					'Disallow: /admin/',
					'Disallow: /api/',
					'Disallow: /uploads/_optimized/',
					'',
					`Sitemap: ${SITE_URL.replace(/\/$/, '')}/sitemap-index.xml`,
					'',
				].join('\n');
				fs.writeFileSync(path.join(outDir, 'robots.txt'), body);
				// Sentinel read at runtime by backend-php to rewrite the baked origin
				// (canonical, og:url, twitter:url, JSON-LD, …) to the actual request host,
				// so a single build can serve any domain without a per-site rebuild.
				fs.writeFileSync(path.join(outDir, '.built_origin'), SITE_URL.replace(/\/$/, ''));
			},
		},
	};
}

// https://astro.build/config
export default defineConfig({
	site: SITE_URL,
	output: 'static',
	integrations: [mdx(), sitemap(), robotsTxtIntegration(), ...pluginIntegrations],
	scopedStyleStrategy: 'where',
	redirects: {
		// Le CPT produits s'appelle "products" côté backend (DB + admin).
		// On redirige donc les URLs générées par l'admin vers le chemin FR choisi pour le front.
		'/products/[slug]': '/produits/[slug]',
	},
	build: {
		// 'auto' inlines small sheets, externalizes large ones (cacheable + smaller HTML)
		inlineStylesheets: 'auto',
	},
	vite: {
		server: {
			// Allow Vite to read files outside frontend/, in particular astro/plugins/<name>/templates/*.astro
			fs: {
				allow: [path.resolve(__dirname, '..')],
			},
		},
		resolve: {
			alias: {
				'@plugins': path.resolve(__dirname, '../plugins'),
				'@frontend': path.resolve(__dirname, 'src'),
			},
		},
	},
});
