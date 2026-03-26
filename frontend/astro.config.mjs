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
	build: {
		// Inline all CSS — avoids render-blocking external requests on slow 3G
		inlineStylesheets: 'always',
	},
});
