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
		// 'auto' inlines small sheets, externalizes large ones (cacheable + smaller HTML)
		inlineStylesheets: 'auto',
	},
});
