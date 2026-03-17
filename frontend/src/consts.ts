// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'Astro Blog';
export const SITE_DESCRIPTION = 'Welcome to my website!';

import { getSiteSettings } from './lib/api';

export async function getSiteInfo() {
  const data = await getSiteSettings();
  return {
    siteName: data.siteName || SITE_TITLE,
    siteDescription: data.siteDescription || SITE_DESCRIPTION,
  };
}
