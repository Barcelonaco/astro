// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://astro.bcnco.site',
	output: 'static',
	integrations: [mdx(), sitemap()],
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
