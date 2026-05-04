// @ts-check

import fs from 'node:fs';
import path from 'node:path';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

const SITE_URL = process.env.BUILD_SITE_URL
	|| process.env.BUILD_MEDIA_ORIGIN
	|| 'http://localhost:4321';

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
			},
		},
	};
}

// https://astro.build/config
export default defineConfig({
	site: SITE_URL,
	output: 'static',
	integrations: [mdx(), sitemap(), robotsTxtIntegration()],
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
});
