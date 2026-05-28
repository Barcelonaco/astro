// ── SEO Meta panel ──

function toggleSeoPanel(show) {
  const panel = document.getElementById('builderSeoPanel');
  const modules = document.getElementById('builderModulesPanel');
  if (!panel) return;
  if (show) {
    panel.style.display = '';
    if (modules) modules.style.display = 'none';
    const settings = document.getElementById('builderSettings');
    if (settings) settings.style.display = 'none';
    const menuPanel = document.getElementById('builderMenuSettingsPanel');
    if (menuPanel) menuPanel.style.display = 'none';
    const colorPanel = document.getElementById('builderColorOverridesPanel');
    if (colorPanel) colorPanel.style.display = 'none';
  } else {
    panel.style.display = 'none';
    if (modules && !selectedBlockId) modules.style.display = '';
    const settings = document.getElementById('builderSettings');
    if (settings && selectedBlockId) settings.style.display = '';
  }
}


function onSeoFieldChange() {
  const titleInput = document.getElementById('seo_meta_title');
  const descInput = document.getElementById('seo_meta_description');
  if (titleInput) pageBuilderState.seoMeta.meta_title = titleInput.value;
  if (descInput) pageBuilderState.seoMeta.meta_description = descInput.value;
  // Update counters
  const titleCount = document.getElementById('seoTitleCount');
  const descCount = document.getElementById('seoDescCount');
  const tLen = (titleInput?.value || '').length;
  const dLen = (descInput?.value || '').length;
  if (titleCount) titleCount.textContent = `(${tLen}/60)`;
  if (descCount) descCount.textContent = `(${dLen}/160)`;
  // Update progress bars
  const titleBar = document.getElementById('seoTitleBar');
  const descBar = document.getElementById('seoDescBar');
  if (titleBar) { titleBar.style.width = Math.min(100, (tLen / 60) * 100) + '%'; titleBar.style.background = tLen <= 60 ? '#22c55e' : '#ef4444'; }
  if (descBar) { descBar.style.width = Math.min(100, (dLen / 160) * 100) + '%'; descBar.style.background = dLen <= 160 ? '#22c55e' : '#ef4444'; }
  // Update preview
  updateSeoPreview();
}

function updateSeoPreview() {
  const preview = document.getElementById('seoPreview');
  if (!preview) return;
  const title = pageBuilderState.seoMeta.meta_title || pageBuilderState.meta.title || 'Titre de la page';
  const slug = pageBuilderState.meta.slug || 'slug';
  const desc = pageBuilderState.seoMeta.meta_description || 'Description de la page...';
  const basePath = pageBuilderState.cptMode ? pageBuilderState.cptMode.slug : 'pages';
  preview.innerHTML = `
    <div class="seo-preview-title">${escapeHtml(title)}</div>
    <div class="seo-preview-url">example.com/${escapeHtml(basePath)}/${escapeHtml(slug)}</div>
    <div class="seo-preview-desc">${escapeHtml(desc)}</div>
  `;
}

function analyzeSeoPage() {
  const title = pageBuilderState.meta.title || '';
  const blocks = pageBuilderState.blocks || [];
  // Extract text content from blocks
  let textParts = [];
  for (const block of blocks) {
    const d = block.data || {};
    // Collect text from common fields
    if (d.text) textParts.push(stripHtml(d.text));
    if (d.title) textParts.push(stripHtml(d.title));
    if (d.subtitle) textParts.push(stripHtml(d.subtitle));
    if (d.description) textParts.push(stripHtml(d.description));
    if (d.body) textParts.push(stripHtml(d.body));
    if (d.content) textParts.push(stripHtml(d.content));
    if (d.bloc_title) textParts.push(stripHtml(d.bloc_title));
    // Repeater items
    if (d.items && Array.isArray(d.items)) {
      for (const item of d.items) {
        if (item.text) textParts.push(stripHtml(item.text));
        if (item.title) textParts.push(stripHtml(item.title));
        if (item.description) textParts.push(stripHtml(item.description));
      }
    }
    // Hero sliders
    if (d.hero_sliders && Array.isArray(d.hero_sliders)) {
      for (const s of d.hero_sliders) {
        if (s.title) textParts.push(stripHtml(s.title));
        if (s.subtitle) textParts.push(stripHtml(s.subtitle));
        if (s.text) textParts.push(stripHtml(s.text));
      }
    }
  }
  // Build meta_title: page title truncated to 60 chars
  const metaTitle = title.substring(0, 60);
  // Build meta_description: first meaningful text, truncated to 160 chars
  const allText = textParts.filter(t => t && t.trim().length > 10).join('. ').replace(/\s+/g, ' ').trim();
  const metaDesc = allText.substring(0, 160);
  // Set values
  pageBuilderState.seoMeta.meta_title = metaTitle;
  pageBuilderState.seoMeta.meta_description = metaDesc;
  const titleInput = document.getElementById('seo_meta_title');
  const descInput = document.getElementById('seo_meta_description');
  if (titleInput) titleInput.value = metaTitle;
  if (descInput) descInput.value = metaDesc;
  onSeoFieldChange();
  auditSeoImages();
  showToast('Analyse SEO terminée — vérifiez et ajustez les textes', 'success');
}

function auditSeoImages() {
  const blocks = pageBuilderState.blocks || [];
  const allImages = [];

  function collectImage(imgObj, blockLabel) {
    if (!imgObj) return;
    if (typeof imgObj === 'string') {
      if (imgObj.match(/\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)/i)) {
        allImages.push({ url: imgObj, alt: '', title: '', block: blockLabel });
      }
      return;
    }
    if (imgObj.url || imgObj.src) {
      allImages.push({
        url: imgObj.url || imgObj.src || '',
        alt: imgObj.alt || imgObj.alt_text || '',
        title: imgObj.title || imgObj.name || '',
        block: blockLabel
      });
    }
  }

  function collectFromObj(obj, blockLabel) {
    if (!obj || typeof obj !== 'object') return;
    // Direct image fields
    const imgFields = ['image', 'photo', 'logo', 'icon', 'icon_image', 'bg_image', 'background', 'background_image', 'featured_image', 'preview', 'media', 'cover', 'thumbnail', 'picture'];
    for (const f of imgFields) {
      if (obj[f]) collectImage(obj[f], blockLabel);
    }
    // Array image fields
    const arrFields = ['images', 'gallery', 'photos', 'logos', 'slides', 'sliders', 'hero_sliders'];
    for (const f of arrFields) {
      if (Array.isArray(obj[f])) {
        for (const item of obj[f]) {
          if (item && typeof item === 'object') {
            // item itself could be image or contain image sub-fields
            if (item.url || item.src) {
              collectImage(item, blockLabel);
            } else {
              collectFromObj(item, blockLabel);
            }
          }
        }
      }
    }
    // Repeater items
    if (Array.isArray(obj.items)) {
      for (const item of obj.items) collectFromObj(item, blockLabel);
    }
    if (Array.isArray(obj.columns)) {
      for (const col of obj.columns) collectFromObj(col, blockLabel);
    }
    if (Array.isArray(obj.members)) {
      for (const m of obj.members) collectFromObj(m, blockLabel);
    }
    if (Array.isArray(obj.references)) {
      for (const r of obj.references) collectFromObj(r, blockLabel);
    }
    if (Array.isArray(obj.tiles)) {
      for (const t of obj.tiles) collectFromObj(t, blockLabel);
    }
    if (Array.isArray(obj.files)) {
      for (const f of obj.files) collectFromObj(f, blockLabel);
    }
  }

  for (const block of blocks) {
    const def = BLOCK_TYPES[block.type] || {};
    const label = def.label || block.type || '?';
    collectFromObj(block.data || {}, label);
  }

  // Dedup by URL — keep first occurrence
  const seen = new Set();
  const uniqueImages = [];
  for (const img of allImages) {
    const key = (img.url || '').replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueImages.push(img);
  }

  const missingAlt = uniqueImages.filter(i => !i.alt || !i.alt.trim());
  const missingTitle = uniqueImages.filter(i => !i.title || !i.title.trim());
  const total = uniqueImages.length;

  // Render audit panel
  const panels = document.querySelectorAll('.seo-image-audit');
  panels.forEach(panel => {
    if (total === 0) {
      panel.innerHTML = `<div class="seo-audit-summary seo-audit-empty">Aucune image détectée dans les blocs</div>`;
      panel.style.display = '';
      return;
    }

    let html = `<div class="seo-audit-summary" style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:${missingAlt.length > 0 ? '10' : '0'}px;">
      <div class="seo-audit-stat"><strong>${total}</strong> image${total > 1 ? 's' : ''}</div>
      <div class="seo-audit-stat ${missingAlt.length > 0 ? 'seo-audit-warn' : 'seo-audit-ok'}"><strong>${missingAlt.length}</strong> sans alt</div>
      <div class="seo-audit-stat ${missingTitle.length > 0 ? 'seo-audit-warn' : 'seo-audit-ok'}"><strong>${missingTitle.length}</strong> sans titre</div>
    </div>`;

    if (missingAlt.length > 0) {
      html += `<details class="seo-audit-details"><summary>Images sans texte alternatif (${missingAlt.length})</summary><ul>`;
      for (const img of missingAlt) {
        const fname = (img.url || '').split('/').pop() || '?';
        html += `<li><span class="seo-audit-block">${escapeHtml(img.block)}</span> — <span class="seo-audit-file">${escapeHtml(fname)}</span></li>`;
      }
      html += `</ul></details>`;
    }
    if (missingTitle.length > 0) {
      html += `<details class="seo-audit-details"><summary>Images sans titre (${missingTitle.length})</summary><ul>`;
      for (const img of missingTitle) {
        const fname = (img.url || '').split('/').pop() || '?';
        html += `<li><span class="seo-audit-block">${escapeHtml(img.block)}</span> — <span class="seo-audit-file">${escapeHtml(fname)}</span></li>`;
      }
      html += `</ul></details>`;
    }

    panel.innerHTML = html;
    panel.style.display = '';
  });
}

function switchSeoTab(tab) {
  const preview = document.getElementById('seoPreview');
  const btnPreview = document.getElementById('seoTabPreview');
  if (tab === 'preview') {
    if (preview) preview.style.display = preview.style.display === 'none' ? '' : 'none';
    if (btnPreview) btnPreview.classList.toggle('active');
  }
}

function onSchemaOrgChange() {
  const textarea = document.getElementById('seo_schema_org');
  if (textarea) pageBuilderState.seoMeta.schema_org = textarea.value;
}

async function generateSchemaOrg() {
  const title = pageBuilderState.seoMeta.meta_title || pageBuilderState.meta.title || '';
  const description = pageBuilderState.seoMeta.meta_description || '';
  const slug = pageBuilderState.meta.slug || '';
  const blocks = pageBuilderState.blocks || [];

  // Detect block types present
  const types = blocks.map(b => {
    const def = BLOCK_TYPES[b.type] || {};
    return def.moduleName || b.type;
  });

  // Base WebPage schema
  const schema = {
    '@context': 'https://schema.org',
    '@graph': []
  };

  // WebPage — always present
  const webPage = {
    '@type': 'WebPage',
    'name': title,
    'url': `{{site_url}}/${slug}`
  };
  if (description) webPage.description = description;
  schema['@graph'].push(webPage);

  // FAQPage if Accordion blocks exist
  const accordionBlocks = blocks.filter(b => (BLOCK_TYPES[b.type]?.moduleName || b.type) === 'Accordion');
  if (accordionBlocks.length > 0) {
    const faqItems = [];
    for (const block of accordionBlocks) {
      const items = block.data?.items || block.data?.accordions || [];
      for (const item of items) {
        const q = stripHtml(item.title || item.question || '');
        const a = stripHtml(item.text || item.content || item.answer || '');
        if (q && a) faqItems.push({ '@type': 'Question', 'name': q, 'acceptedAnswer': { '@type': 'Answer', 'text': a } });
      }
    }
    if (faqItems.length > 0) {
      schema['@graph'].push({ '@type': 'FAQPage', 'mainEntity': faqItems });
    }
  }

  // LocalBusiness / Organization if Contact block
  const contactBlocks = blocks.filter(b => (BLOCK_TYPES[b.type]?.moduleName || b.type) === 'Contact');
  if (contactBlocks.length > 0) {
    const c = contactBlocks[0].data || {};
    const org = { '@type': 'LocalBusiness', 'name': title };
    if (c.address || c.adresse) org.address = { '@type': 'PostalAddress', 'streetAddress': stripHtml(c.address || c.adresse || '') };
    if (c.phone || c.telephone) org.telephone = stripHtml(c.phone || c.telephone || '');
    if (c.email || c.mail) org.email = stripHtml(c.email || c.mail || '');
    schema['@graph'].push(org);
  }

  // Product if Product block
  const productBlocks = blocks.filter(b => (BLOCK_TYPES[b.type]?.moduleName || b.type) === 'Product');
  if (productBlocks.length > 0) {
    for (const block of productBlocks) {
      const d = block.data || {};
      const product = { '@type': 'Product', 'name': stripHtml(d.title || d.name || title) };
      if (d.description) product.description = stripHtml(d.description);
      if (d.image?.url) product.image = d.image.url;
      if (d.price) product.offers = { '@type': 'Offer', 'price': d.price, 'priceCurrency': 'EUR' };
      schema['@graph'].push(product);
    }
  }

  // ImageGallery if Gallery block
  const galleryBlocks = blocks.filter(b => (BLOCK_TYPES[b.type]?.moduleName || b.type) === 'Gallery');
  if (galleryBlocks.length > 0) {
    for (const block of galleryBlocks) {
      const images = block.data?.images || block.data?.gallery || [];
      if (images.length > 0) {
        schema['@graph'].push({
          '@type': 'ImageGallery',
          'name': stripHtml(block.data?.bloc_title || block.data?.title || 'Galerie'),
          'image': images.slice(0, 10).map(img => img.url || img.image?.url || '').filter(Boolean)
        });
      }
    }
  }

  // VideoObject if Video block
  const videoBlocks = blocks.filter(b => ['Video', 'IllusVideo'].includes(BLOCK_TYPES[b.type]?.moduleName || b.type));
  if (videoBlocks.length > 0) {
    for (const block of videoBlocks) {
      const d = block.data || {};
      const url = d.video_url || d.url || d.video || '';
      if (url) {
        schema['@graph'].push({
          '@type': 'VideoObject',
          'name': stripHtml(d.title || d.bloc_title || title),
          'contentUrl': url
        });
      }
    }
  }

  // Event if EventsSlider block — fetch from CPT API
  const hasEvents = blocks.some(b => (BLOCK_TYPES[b.type]?.moduleName || b.type) === 'EventsSlider');
  if (hasEvents) {
    try {
      const evData = await apiFetch('/cpt/evenements?status=published&limit=10');
      const evItems = evData.items || evData || [];
      for (const ev of evItems) {
        const cf = ev.custom_fields || {};
        const event = { '@type': 'Event', 'name': stripHtml(ev.title || '') };
        if (cf.start_date) {
          // Convert DD/MM/YYYY to ISO date
          const parts = cf.start_date.split('/');
          event.startDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : cf.start_date;
        }
        if (cf.end_date) {
          const parts = cf.end_date.split('/');
          event.endDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : cf.end_date;
        }
        if (cf.start_time) event.startDate = (event.startDate || '') + 'T' + cf.start_time;
        if (cf.location_name) event.location = { '@type': 'Place', 'name': stripHtml(cf.location_name) };
        if (cf.location) {
          const loc = typeof cf.location === 'string' ? (() => { try { return JSON.parse(cf.location); } catch(e) { return {}; } })() : cf.location;
          if (loc.city || loc.address) {
            if (!event.location) event.location = { '@type': 'Place', 'name': stripHtml(cf.location_name || loc.city || '') };
            event.location.address = { '@type': 'PostalAddress', 'addressLocality': loc.city || '', 'streetAddress': loc.address || '' };
          }
        }
        if (cf.contact_name) event.organizer = { '@type': 'Person', 'name': stripHtml(cf.contact_name) };
        if (cf.price) event.offers = { '@type': 'Offer', 'price': stripHtml(cf.price), 'priceCurrency': 'EUR' };
        if (ev.excerpt) event.description = stripHtml(ev.excerpt);
        if (event.name) schema['@graph'].push(event);
      }
    } catch (e) { console.warn('Schema.org: erreur chargement evenements', e); }
  }

  // BlocReferences — CreativeWork items from CPT API
  const hasRefs = blocks.some(b => (BLOCK_TYPES[b.type]?.moduleName || b.type) === 'BlocReferences');
  if (hasRefs) {
    try {
      const refData = await apiFetch('/cpt/references?status=published&limit=10');
      const refItems = refData.items || refData || [];
      for (const ref of refItems) {
        const cf = ref.custom_fields || {};
        const work = { '@type': 'CreativeWork', 'name': stripHtml(ref.title || '') };
        if (cf.customer_name) work.creator = { '@type': 'Organization', 'name': stripHtml(cf.customer_name) };
        if (cf.text) work.description = stripHtml(cf.text);
        if (ref.featured_image) work.image = typeof ref.featured_image === 'string' ? ref.featured_image : (ref.featured_image.url || '');
        const cats = ref.categories || [];
        if (cats.length > 0) work.genre = cats.map(c => c.name).join(', ');
        if (cf.link) {
          const linkUrl = typeof cf.link === 'string' ? cf.link : (cf.link.url || '');
          if (linkUrl) work.url = linkUrl;
        }
        if (work.name) schema['@graph'].push(work);
      }
    } catch (e) { console.warn('Schema.org: erreur chargement references', e); }
  }

  // NewsSlider — NewsArticle items from CPT API
  const hasNews = blocks.some(b => (BLOCK_TYPES[b.type]?.moduleName || b.type) === 'NewsSlider');
  if (hasNews) {
    try {
      const newsData = await apiFetch('/cpt/actualites?status=published&limit=10');
      const newsItems = newsData.items || newsData || [];
      for (const item of newsItems) {
        const article = { '@type': 'NewsArticle', 'headline': stripHtml(item.title || '') };
        if (item.published_date || item.created_at) article.datePublished = item.published_date || item.created_at;
        if (item.excerpt) article.description = stripHtml(item.excerpt);
        if (item.featured_image) article.image = typeof item.featured_image === 'string' ? item.featured_image : (item.featured_image.url || '');
        const cats = item.categories || [];
        if (cats.length > 0) article.articleSection = cats[0].name;
        article.url = `{{site_url}}/actualites/${item.slug || ''}`;
        if (article.headline) schema['@graph'].push(article);
      }
    } catch (e) { console.warn('Schema.org: erreur chargement actualites', e); }
  }

  // Team / Person if Team block
  const teamBlocks = blocks.filter(b => (BLOCK_TYPES[b.type]?.moduleName || b.type) === 'Team');
  if (teamBlocks.length > 0) {
    for (const block of teamBlocks) {
      const members = block.data?.members || block.data?.items || block.data?.team || [];
      for (const m of members) {
        const person = { '@type': 'Person', 'name': stripHtml(m.name || m.title || m.nom || '') };
        if (m.role || m.poste || m.job) person.jobTitle = stripHtml(m.role || m.poste || m.job || '');
        if (m.image?.url) person.image = m.image.url;
        if (person.name) schema['@graph'].push(person);
      }
    }
  }

  // Review if GoogleReviews or Review block
  const reviewBlocks = blocks.filter(b => ['GoogleReviews', 'Review'].includes(BLOCK_TYPES[b.type]?.moduleName || b.type));
  if (reviewBlocks.length > 0) {
    for (const block of reviewBlocks) {
      const reviews = block.data?.reviews || block.data?.items || [];
      for (const r of reviews) {
        const review = { '@type': 'Review', 'author': { '@type': 'Person', 'name': stripHtml(r.author || r.name || r.nom || 'Anonyme') } };
        if (r.text || r.content) review.reviewBody = stripHtml(r.text || r.content || '');
        if (r.rating || r.note) review.reviewRating = { '@type': 'Rating', 'ratingValue': r.rating || r.note };
        schema['@graph'].push(review);
      }
    }
  }

  // BreadcrumbList
  schema['@graph'].push({
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Accueil', 'item': '{{site_url}}/' },
      { '@type': 'ListItem', 'position': 2, 'name': title, 'item': `{{site_url}}/${slug}` }
    ]
  });

  const json = JSON.stringify(schema, null, 2);
  pageBuilderState.seoMeta.schema_org = json;
  const textarea = document.getElementById('seo_schema_org');
  if (textarea) textarea.value = json;
  showToast('Schema.org genere depuis le contenu de la page', 'success');
}

// Expose all on window
Object.assign(window, {
  toggleSeoPanel,
  onSeoFieldChange,
  updateSeoPreview,
  analyzeSeoPage,
  auditSeoImages,
  switchSeoTab,
  onSchemaOrgChange,
  generateSchemaOrg,
});
