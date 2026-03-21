// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://example.com',
	output: 'static',
	adapter: node({ mode: 'standalone' }),
	integrations: [mdx(), sitemap()],
	scopedStyleStrategy: 'where',
	build: {
		// Inline all CSS — avoids render-blocking external requests on slow 3G
		inlineStylesheets: 'always',
	},
	vite: {
		server: {
			proxy: {
				'/uploads': 'http://localhost:3000',
			},
		},
	},
});
