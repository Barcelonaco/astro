// Schema.org JSON-LD builder. Use custom schema if provided in seo_meta.schema_org,
// otherwise fall back to a sensible WebPage / WebSite default built from page + site data.

interface SiteInfo {
  siteName?: string;
  siteDescription?: string;
}

interface PageLike {
  title?: string;
  excerpt?: string;
  content?: string;
  featured_image?: any;
  seo_meta?: string | null;
  published_date?: string;
  updated_at?: string;
  created_at?: string;
}

interface BuildOpts {
  page?: PageLike | null;
  siteInfo: SiteInfo;
  url: string;        // canonical URL of current page
  siteUrl: string;    // origin
  isHome?: boolean;
}

function resolveImage(featured: any, siteUrl: string): string | undefined {
  if (!featured) return undefined;
  if (typeof featured === 'string') return featured.startsWith('http') ? featured : siteUrl + featured;
  const url = featured.url || featured.sizes?.full || featured.sizes?.large;
  if (!url) return undefined;
  return url.startsWith('http') ? url : siteUrl + url;
}

export function buildSchemaOrg({ page, siteInfo, url, siteUrl, isHome }: BuildOpts): string {
  // 1. Custom schema from back-office
  try {
    const seo = page?.seo_meta ? JSON.parse(page.seo_meta) : null;
    if (seo?.schema_org && typeof seo.schema_org === 'string' && seo.schema_org.trim()) {
      const custom = seo.schema_org.replace(/\{\{site_url\}\}/g, siteUrl);
      // Validate + re-serialize to neutralize any embedded </script> or HTML
      const parsed = JSON.parse(custom);
      return JSON.stringify(parsed).replace(/</g, '\\u003c');
    }
  } catch {
    // fall through to fallback
  }

  // 2. Fallback
  const siteName = siteInfo.siteName || '';
  const description = page?.excerpt || siteInfo.siteDescription || '';
  const title = page?.title || siteName;
  const image = resolveImage(page?.featured_image, siteUrl);
  const datePublished = page?.published_date || page?.created_at;
  const dateModified = page?.updated_at || datePublished;

  const graph: any[] = [];

  // WebSite (always for home, optional elsewhere — keeping it on home only)
  if (isHome) {
    graph.push({
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: siteName,
      description: siteInfo.siteDescription || undefined,
    });
  }

  graph.push({
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: title,
    description: description || undefined,
    inLanguage: 'fr',
    isPartOf: isHome ? { '@id': `${siteUrl}/#website` } : undefined,
    primaryImageOfPage: image ? { '@type': 'ImageObject', url: image } : undefined,
    datePublished: datePublished || undefined,
    dateModified: dateModified || undefined,
  });

  const schema = {
    '@context': 'https://schema.org',
    '@graph': graph.map((node) => {
      // Strip undefined fields for cleaner output
      const cleaned: Record<string, any> = {};
      for (const k of Object.keys(node)) if (node[k] !== undefined) cleaned[k] = node[k];
      return cleaned;
    }),
  };

  return JSON.stringify(schema).replace(/</g, '\\u003c');
}
