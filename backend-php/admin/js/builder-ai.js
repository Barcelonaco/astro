// ========== AI PAGE GENERATION ==========

// Mutable state
window._bulkAiImages = [];
window._bulkAiHtmlFiles = [];

function openAiModal() {
  if (!aiEnabled) {
    showToast('Génération IA temporairement désactivée par un administrateur', 'error');
    return;
  }
  if (aiCreditsAvailable !== null && aiCreditsAvailable <= 0) {
    showToast('Crédits IA épuisés — rechargez les crédits pour générer', 'error');
    return;
  }
  const existingBlocks = pageBuilderState.blocks.length;
  const warningHtml = existingBlocks > 0
    ? `<div class="ai-modal-warning">Cette page contient déjà ${existingBlocks} bloc(s). La génération IA remplacera tout le contenu existant.</div>`
    : '';

  openUiModal({
    title: '✨ Générer la page avec l\'IA',
    bodyHtml: `
      <div class="ai-modal-content">
        ${warningHtml}
        <div class="ai-modal-field">
          <label class="form-label">Décrivez la page que vous souhaitez créer</label>
          <textarea class="form-input ai-prompt-input" id="aiPromptInput" rows="5" placeholder="Ex: Crée une page de présentation pour une agence web spécialisée en React et Node.js, avec nos services, l'équipe, des chiffres clés et un formulaire de contact..."></textarea>
        </div>
        <div class="ai-modal-options">
          <div class="ai-modal-option">
            <label class="form-label">Titre de la page (optionnel)</label>
            <input type="text" class="form-input" id="aiPageTitle" value="${escapeHtml(pageBuilderState.meta.title || '')}" placeholder="Sera généré automatiquement si vide">
          </div>
        </div>
        <div class="ai-modal-row">
          <div class="ai-modal-checkboxes">
            <label class="ai-checkbox-label"><input type="checkbox" id="aiGenSeo" checked> Générer le SEO (meta title + description)</label>
            <label class="ai-checkbox-label"><input type="checkbox" id="aiGenSchema" checked> Générer le Schema.org</label>
            <label class="ai-checkbox-label"><input type="checkbox" id="aiWebSearch" checked> 🔍 Recherche web (infos réelles)</label>
          </div>
          <div class="ai-modal-model">
            <label class="form-label">Modèle</label>
            <select class="form-select" id="aiModelSelect">
              <option value="haiku" selected>Haiku (rapide, ~10s)</option>
              <option value="sonnet">Sonnet (précis, ~30s)</option>
            </select>
          </div>
        </div>
      </div>
    `,
    actions: [
      { label: 'Annuler', variant: 'btn-outline', onClick: () => closeUiModal() },
      { label: '✨ Générer', variant: 'btn-ai', onClick: () => executeAiGeneration() }
    ]
  });
  setTimeout(() => document.getElementById('aiPromptInput')?.focus(), 50);
}

async function executeAiGeneration() {
  const prompt = document.getElementById('aiPromptInput')?.value?.trim();
  if (!prompt) {
    showToast('Veuillez saisir une description de la page', 'error');
    return;
  }

  const pageTitle = document.getElementById('aiPageTitle')?.value?.trim() || '';
  const genSeo = document.getElementById('aiGenSeo')?.checked ?? true;
  const genSchema = document.getElementById('aiGenSchema')?.checked ?? true;

  closeUiModal();

  // Show loading overlay
  const overlay = document.createElement('div');
  overlay.id = 'aiLoadingOverlay';
  overlay.innerHTML = `
    <div class="ai-loading-card">
      <div class="ai-loading-spinner"></div>
      <h3>Génération en cours...</h3>
      <p id="aiCharCounter">Connexion à l'IA...</p>
    </div>
  `;
  document.body.appendChild(overlay);

  try {
    // Stream response via SSE to avoid FastCGI timeout
    const model = document.getElementById('aiModelSelect')?.value || 'haiku';
    const webSearch = document.getElementById('aiWebSearch')?.checked ?? true;
    const result = await streamAiGeneration(prompt, pageTitle, genSeo, model, webSearch);
    const generated = result.generated;
    if (!generated) throw new Error('Réponse IA vide');

    // Apply generated title & slug
    if (generated.title) {
      pageBuilderState.meta.title = generated.title;
      const titleInput = document.querySelector('.builder-title');
      if (titleInput) titleInput.value = generated.title;
    }
    if (generated.slug) {
      pageBuilderState.meta.slug = generated.slug;
      const slugInput = document.querySelector('.builder-slug');
      if (slugInput) slugInput.value = generated.slug;
    }

    // Apply generated blocks — resolve images + ensure repeater items
    if (generated.blocks && Array.isArray(generated.blocks)) {
      const defaultImg = siteSettingsCache?.replacement_image || '';
      pageBuilderState.blocks = generated.blocks.map(block => ({
        id: block.id || blockId(),
        type: block.type,
        data: processAiBlockData(normalizeAiBlock(block.type, block.data || {}), defaultImg)
      }));
      rebuildBuilderBlocksDOM();
      reattachBlockCardListeners();

      // Async post-processing: geocode addresses + resolve form IDs
      Promise.all([
        geocodeAiBlockAddresses(),
        resolveAiFormIds()
      ]).then(([geoChanged, formChanged]) => {
        if (geoChanged || formChanged) { rebuildBuilderBlocksDOM(); reattachBlockCardListeners(); }
      });
    }

    // Apply SEO
    if (genSeo && generated.seo) {
      pageBuilderState.seoMeta.enabled = true;
      if (generated.seo.meta_title) {
        pageBuilderState.seoMeta.meta_title = generated.seo.meta_title;
      }
      if (generated.seo.meta_description) {
        pageBuilderState.seoMeta.meta_description = generated.seo.meta_description;
      }
      if (genSchema && generated.seo.schema_org) {
        pageBuilderState.seoMeta.schema_org = typeof generated.seo.schema_org === 'string'
          ? generated.seo.schema_org
          : JSON.stringify(generated.seo.schema_org, null, 2);
      }
      // Update SEO fields if visible
      const titleInput = document.getElementById('seo_meta_title');
      const descInput = document.getElementById('seo_meta_description');
      const schemaInput = document.getElementById('seo_schema_org');
      if (titleInput) titleInput.value = pageBuilderState.seoMeta.meta_title;
      if (descInput) descInput.value = pageBuilderState.seoMeta.meta_description;
      if (schemaInput) schemaInput.value = pageBuilderState.seoMeta.schema_org;
      onSeoFieldChange();
    }

    if (result.usage) {
      console.log(`IA tokens — input: ${result.usage.input_tokens}, output: ${result.usage.output_tokens}`);
    }

    showToast(`Page générée avec succès (${pageBuilderState.blocks.length} blocs)`, 'success');

  } catch (error) {
    console.error('AI generation error:', error);
    showToast(`Erreur IA : ${error.message}`, 'error');
  } finally {
    const loadingOverlay = document.getElementById('aiLoadingOverlay');
    if (loadingOverlay) loadingOverlay.remove();
    refreshAiCreditsAvailable();
  }
}

/**
 * Auto-resolve form_id for form blocks. If form_id is "auto" or empty,
 * fetch forms from API and assign the first active "contact" form (or first active form).
 */
async function resolveAiFormIds() {
  const formBlocks = pageBuilderState.blocks.filter(b => b.type === 'form' && (!b.data.form_id || b.data.form_id === 'auto'));
  if (formBlocks.length === 0) return false;
  try {
    const forms = await apiFetch('/forms');
    const active = (forms || []).filter(f => f.status === 'active');
    if (active.length === 0) return false;
    // Prefer a form with "contact" in the title
    const contactForm = active.find(f => /contact/i.test(f.title)) || active[0];
    for (const block of formBlocks) {
      block.data.form_id = String(contactForm.id);
    }
    return true;
  } catch (e) {
    console.warn('Could not resolve form IDs:', e);
    return false;
  }
}

// ========== BULK AI PAGE GENERATION ==========

function openBulkAiModal() {
  if (!aiEnabled) {
    showToast('Génération IA temporairement désactivée par un administrateur', 'error');
    return;
  }
  if (aiCreditsAvailable !== null && aiCreditsAvailable <= 0) {
    showToast('Crédits IA épuisés — rechargez les crédits pour générer', 'error');
    return;
  }
  openUiModal({
    title: '✨ Générer des pages par IA',
    bodyHtml: `
      <div class="ai-modal-content">
        <div class="ai-modal-field">
          <label class="form-label">Décrivez les pages ou collez du HTML / wireframe à convertir</label>
          <textarea class="form-input ai-prompt-input" id="bulkAiPromptInput" rows="8" placeholder="Exemples d'utilisation :&#10;&#10;• Collez du HTML/wireframe : l'IA convertira chaque page en blocs Nickl&#10;• Décrivez vos pages : Crée 2 pages pour un artisan plombier — une page d'accueil avec hero et services, une page contact&#10;&#10;L'IA génère EXACTEMENT le nombre de pages décrites."></textarea>
        </div>
        <div class="ai-modal-field" style="margin-top:12px">
          <label class="form-label">URL à analyser (optionnel)</label>
          <p class="form-hint" style="margin:0 0 8px;color:#64748b;font-size:13px">L'IA récupère le HTML de la page et le convertit en blocs Nickl. Plusieurs URLs séparées par des retours à la ligne.</p>
          <textarea class="form-input" id="bulkAiUrlsInput" rows="2" placeholder="https://exemple.com/page-a-convertir"></textarea>
        </div>
        <div class="ai-modal-field" style="margin-top:12px">
          <label class="form-label">Fichiers de référence (optionnel)</label>
          <p class="form-hint" style="margin:0 0 8px;color:#64748b;font-size:13px">Images (screenshots, maquettes), PDF (wireframes, cahiers des charges) ou HTML (pages à convertir) pour guider l'IA.</p>
          <div class="bulk-ai-images-zone" id="bulkAiImagesZone">
            <input type="file" id="bulkAiImagesInput" multiple accept="image/*,application/pdf,text/html,.html,.htm" style="display:none" onchange="handleBulkAiImages(this.files)">
            <button type="button" class="btn btn-sm btn-outline" onclick="document.getElementById('bulkAiImagesInput').click()">📎 Ajouter des fichiers</button>
            <div id="bulkAiImagesPreviews" class="bulk-ai-images-previews"></div>
          </div>
        </div>
        <div class="ai-modal-row" style="margin-top:12px">
          <div class="ai-modal-checkboxes">
            <label class="ai-checkbox-label"><input type="checkbox" id="bulkAiGenSeo" checked> Générer le SEO</label>
            <label class="ai-checkbox-label"><input type="checkbox" id="bulkAiWebSearch" checked> 🔍 Recherche web</label>
          </div>
          <div class="ai-modal-model">
            <label class="form-label">Modèle</label>
            <select class="form-select" id="bulkAiModelSelect">
              <option value="haiku">Haiku (rapide)</option>
              <option value="sonnet" selected>Sonnet (précis)</option>
            </select>
          </div>
        </div>
      </div>
    `,
    actions: [
      { label: 'Annuler', variant: 'btn-outline', onClick: () => closeUiModal() },
      { label: '✨ Générer les pages', variant: 'btn-ai', onClick: () => executeBulkAiGeneration() }
    ]
  });
  setTimeout(() => document.getElementById('bulkAiPromptInput')?.focus(), 50);
}

function handleBulkAiImages(files) {
  const container = document.getElementById('bulkAiImagesPreviews');
  if (!container) return;

  for (const file of files) {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const nameLower = (file.name || '').toLowerCase();
    const isHtml = file.type === 'text/html' || nameLower.endsWith('.html') || nameLower.endsWith('.htm');
    if (!isImage && !isPdf && !isHtml) continue;

    if (isHtml) {
      const reader = new FileReader();
      reader.onload = (e) => {
        window._bulkAiHtmlFiles.push({ name: file.name, content: e.target.result });
        const idx = window._bulkAiHtmlFiles.length - 1;
        const preview = document.createElement('div');
        preview.className = 'bulk-ai-image-preview';
        preview.dataset.kind = 'html';
        preview.dataset.idx = String(idx);
        preview.innerHTML = `<div class="bulk-ai-pdf-icon">HTML</div>
           <button type="button" class="bulk-ai-image-remove" onclick="removeBulkAiHtmlFile(${idx}, this.parentElement)">&times;</button>
           <span class="bulk-ai-image-name">${escapeHtml(file.name)}</span>`;
        container.appendChild(preview);
      };
      reader.readAsText(file);
      continue;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result.split(',')[1];
      window._bulkAiImages.push({ data: base64, media_type: file.type, name: file.name, kind: isPdf ? 'document' : 'image' });

      const idx = window._bulkAiImages.length - 1;
      const preview = document.createElement('div');
      preview.className = 'bulk-ai-image-preview';
      preview.innerHTML = isPdf
        ? `<div class="bulk-ai-pdf-icon">PDF</div>
           <button type="button" class="bulk-ai-image-remove" onclick="removeBulkAiImage(${idx}, this.parentElement)">&times;</button>
           <span class="bulk-ai-image-name">${escapeHtml(file.name)}</span>`
        : `<img src="${e.target.result}" alt="${escapeHtml(file.name)}">
           <button type="button" class="bulk-ai-image-remove" onclick="removeBulkAiImage(${idx}, this.parentElement)">&times;</button>
           <span class="bulk-ai-image-name">${escapeHtml(file.name)}</span>`;
      container.appendChild(preview);
    };
    reader.readAsDataURL(file);
  }
}

function removeBulkAiImage(index, element) {
  window._bulkAiImages[index] = null;
  if (element) element.remove();
}

function removeBulkAiHtmlFile(index, element) {
  window._bulkAiHtmlFiles[index] = null;
  if (element) element.remove();
}

async function executeBulkAiGeneration() {
  const prompt = document.getElementById('bulkAiPromptInput')?.value?.trim();
  if (!prompt) {
    showToast('Veuillez décrire les pages à générer', 'error');
    return;
  }

  const model = document.getElementById('bulkAiModelSelect')?.value || 'sonnet';
  const webSearch = document.getElementById('bulkAiWebSearch')?.checked ?? true;
  const genSeo = document.getElementById('bulkAiGenSeo')?.checked ?? true;
  const images = window._bulkAiImages.filter(Boolean);
  const htmlFiles = window._bulkAiHtmlFiles.filter(Boolean);
  const urlsRaw = document.getElementById('bulkAiUrlsInput')?.value?.trim() || '';
  const urls = urlsRaw.split(/[\n,]+/).map(u => u.trim()).filter(u => u.startsWith('http'));

  closeUiModal();

  // Show loading overlay
  const overlay = document.createElement('div');
  overlay.id = 'aiLoadingOverlay';
  overlay.innerHTML = `
    <div class="ai-loading-card bulk-ai-loading">
      <div class="ai-loading-spinner"></div>
      <h3>Génération des pages en cours...</h3>
      <p id="bulkAiStatus">${urls.length > 0 ? 'Récupération des URLs...' : 'Connexion à l\'IA...'}</p>
      <div id="bulkAiProgress" class="bulk-ai-progress"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  try {
    const body = JSON.stringify({
      prompt: genSeo ? prompt + '\n\nGénère aussi le SEO (meta title + description) et le Schema.org pour chaque page.' : prompt,
      model,
      web_search: webSearch,
      images: images.length > 0 ? images : undefined,
      urls: urls.length > 0 ? urls : undefined,
      html_files: htmlFiles.length > 0 ? htmlFiles : undefined,
    });

    const result = await new Promise((resolve, reject) => {
      fetch(`${API_BASE}/ai/generate-pages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body
      }).then(response => {
        if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
          return response.json().then(err => { throw new Error(err.error || 'Request failed'); });
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let charCount = 0;
        let currentEvent = '';
        let resolved = false;

        function handleLine(line) {
          if (resolved) return;
          if (line.startsWith('event: ')) { currentEvent = line.slice(7).trim(); return; }
          if (!line.startsWith('data: ')) return;
          const data = line.slice(6);

          const statusEl = document.getElementById('bulkAiStatus');
          const progressEl = document.getElementById('bulkAiProgress');

          if (currentEvent === 'status') {
            if (statusEl) statusEl.textContent = data;
          } else if (currentEvent === 'chunk') {
            charCount += data.length;
            if (statusEl) statusEl.textContent = `${charCount} caractères générés...`;
          } else if (currentEvent === 'form_created') {
            try {
              const form = JSON.parse(data);
              if (progressEl) {
                progressEl.innerHTML += `
                  <div class="bulk-ai-page-done">
                    📋 Formulaire créé : <strong>${escapeHtml(form.title)}</strong> — ${form.fields_count} champs
                  </div>`;
              }
              if (statusEl) statusEl.textContent = 'Formulaire créé, génération des pages...';
            } catch (e) {}
          } else if (currentEvent === 'page_saved') {
            try {
              const page = JSON.parse(data);
              if (progressEl) {
                progressEl.innerHTML += `
                  <div class="bulk-ai-page-done">
                    ✅ <strong>${escapeHtml(page.title)}</strong> — ${page.blocks_count} blocs <span class="text-muted">(${page.index}/${page.total})</span>
                  </div>`;
              }
              if (statusEl) statusEl.textContent = `Page ${page.index}/${page.total} sauvegardée...`;
            } catch (e) {}
          } else if (currentEvent === 'done') {
            resolved = true;
            try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('JSON invalide')); }
          } else if (currentEvent === 'error') {
            resolved = true;
            try { reject(new Error(JSON.parse(data).error || 'Erreur IA')); } catch (e) { reject(new Error(data)); }
          }
        }

        function processChunks() {
          reader.read().then(({ done, value }) => {
            if (value) buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = done ? '' : lines.pop();
            for (const line of lines) handleLine(line);
            if (done && buffer) handleLine(buffer);
            if (resolved) return;
            if (done) { reject(new Error('Stream terminé sans résultat')); return; }
            processChunks();
          }).catch(reject);
        }
        processChunks();
      }).catch(reject);
    });

    const pages = result.pages || [];
    const forms = result.forms || [];
    window._bulkAiImages = [];
    window._bulkAiHtmlFiles = [];

    if (result.usage) {
      console.log(`IA bulk tokens — input: ${result.usage.input_tokens}, output: ${result.usage.output_tokens}`);
    }

    const summary = [
      `${pages.length} page${pages.length > 1 ? 's' : ''}`,
      forms.length > 0 ? `${forms.length} formulaire${forms.length > 1 ? 's' : ''}` : ''
    ].filter(Boolean).join(' + ');
    showToast(`${summary} créé${pages.length + forms.length > 1 ? 's' : ''} avec succès`, 'success');

    // Refresh pages list
    const content = document.getElementById('content');
    if (content) content.innerHTML = await renderPages();

    // Show results modal with action buttons
    if (pages.length > 0) {
      const formsHtml = forms.length > 0 ? `
        <div style="margin-bottom:14px">
          <h4 style="font-size:14px;margin:0 0 8px 0;color:#64748b">📋 Formulaires créés</h4>
          ${forms.map(f => `
            <div class="bulk-ai-result-row" style="padding:8px 0">
              <div class="bulk-ai-result-info">
                <strong>${escapeHtml(f.title)}</strong>
                <span class="text-muted" style="font-size:12px">${f.fields_count} champs</span>
              </div>
            </div>
          `).join('')}
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 14px 0">
      ` : '';

      const pagesList = pages.map(p => `
        <div class="bulk-ai-result-row">
          <div class="bulk-ai-result-info">
            <strong>${escapeHtml(p.title)}</strong>
            <span class="text-muted" style="font-size:12px">/${escapeHtml(p.slug)} · ${p.blocks_count} blocs</span>
          </div>
          <div class="bulk-ai-result-actions">
            <button type="button" class="btn btn-sm btn-primary" onclick="closeUiModal(); openPageBuilder(${p.id})">Modifier</button>
            <button type="button" class="btn btn-sm btn-outline" onclick="bulkAiPublishAndPreview(${p.id}, '${escapeHtml(p.slug)}')">Publier & voir</button>
          </div>
        </div>
      `).join('');

      openUiModal({
        title: `✅ ${pages.length} page${pages.length > 1 ? 's' : ''} créée${pages.length > 1 ? 's' : ''}`,
        bodyHtml: `
          <div class="bulk-ai-results">
            <p style="color:#64748b;font-size:13px;margin:0 0 14px 0">Pages créées en brouillon. Vous pouvez les modifier dans le builder ou les publier pour les prévisualiser sur le site.</p>
            ${formsHtml}
            ${pagesList}
          </div>
        `,
        actions: [
          { label: 'Fermer', variant: 'btn-outline', onClick: () => closeUiModal() }
        ]
      });
    }

  } catch (error) {
    console.error('Bulk AI error:', error);
    showToast(`Erreur IA : ${error.message}`, 'error');
  } finally {
    const loadingOverlay = document.getElementById('aiLoadingOverlay');
    if (loadingOverlay) loadingOverlay.remove();
    refreshAiCreditsAvailable();
  }
}

async function bulkAiPublishAndPreview(pageId, slug) {
  try {
    // Fetch full page data
    const page = await apiFetch(`/pages/${slug}`);
    if (!page) { showToast('Page introuvable', 'error'); return; }

    // Publish it
    await apiFetch(`/pages/${pageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: page.title,
        slug: page.slug,
        content: page.content,
        color_overrides: page.color_overrides,
        seo_meta: page.seo_meta,
        status: 'published',
        show_in_menu: page.show_in_menu ?? false,
        menu_order: page.menu_order ?? 0,
        parent_id: page.parent_id || null,
      })
    });

    // Open frontend in new tab
    const frontendUrl = siteSettingsCache?.frontend_url || window.location.origin;
    window.open(`${frontendUrl}/${slug}`, '_blank');

    showToast('Page publiée', 'success');
    // Refresh pages list
    const content = document.getElementById('content');
    if (content) content.innerHTML = await renderPages();
  } catch (error) {
    console.error('Publish error:', error);
    showToast(`Erreur : ${error.message}`, 'error');
  }
}

async function geocodeAiBlockAddresses() {
  let changed = false;
  for (const block of pageBuilderState.blocks) {
    if (block.type !== 'contact' && block.type !== 'map') continue;
    const items = block.data.addresses || block.data.items || [];
    for (const item of items) {
      const addr = item.address;
      if (!addr) continue;
      // Get the address string — either from object or direct string
      const query = typeof addr === 'object' ? (addr.address || '') : addr;
      if (!query || query.length < 3) continue;
      // Skip if already geocoded (has valid lat/lng)
      if (typeof addr === 'object' && addr.lat && addr.lng && addr.lat !== 0 && addr.lng !== 0) continue;
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=1&language=fr`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const f = data.features[0];
          const [lng, lat] = f.center;
          const ctx = f.context || [];
          const getCtx = (prefix) => { const c = ctx.find(c => c.id?.startsWith(prefix)); return c ? c.text : ''; };
          item.address = {
            address: f.place_name || query,
            lat, lng,
            place_id: f.id || '',
            street_number: f.address || '',
            street_name: f.text || '',
            street_name_short: f.text || '',
            post_code: getCtx('postcode'),
            city: getCtx('place'),
            name: f.place_name || query
          };
          changed = true;
        }
      } catch (e) {
        console.warn('Geocoding failed for:', query, e);
      }
    }
  }
  return changed;
}

/**
 * Normalize AI-generated block data to match the real module field schema.
 * Fixes field name mismatches and injects required defaults.
 */
function normalizeAiBlock(type, data) {
  if (!data || typeof data !== 'object') return data;

  const RULES = {
    'text-image': {
      rename: { content: 'text' },
      defaults: { media_choice: true }
    },
    'accordion': {
      rename: { items: 'accordions' },
      subRename: { accordions: { content: 'text' } }
    },
    'key-figures': {
      rename: { items: 'key_list' },
      subRename: { key_list: { title: 'titre', icon: 'icone' } }
    },
    'gallery': {
      rename: { items: 'list', style: 'style_choice' },
      subRename: { list: { title: 'titre' } }
    },
    'clickable-tiles': {
      rename: { items: 'list_interlocking', is_clickable: 'clickable_block' },
      subRename: { list_interlocking: { text: 'catchphrase', image: 'file', link: 'primary_link' } }
    },
    'team': {
      rename: { items: 'list', members: 'list' }
    },
    'contact': {
      rename: { items: 'addresses' }
    },
    'hero': {
      defaults: { is_hero_banner_slider: true },
      subRename: { hero_sliders: { subtitle: 'catchphrase' } }
    },
    'banner': {
      rename: { bg_img: 'image', background: 'banner_height' }
    }
  };

  const d = { ...data };

  // Global rename: "background" → "bloc_color" (applies to ALL block types)
  if (d.background !== undefined && d.bloc_color === undefined) {
    d.bloc_color = d.background;
    delete d.background;
  }
  // Ensure bloc_color always has a value (schema default)
  if (!d.bloc_color) d.bloc_color = 'no-background-color';

  const rules = RULES[type];
  if (!rules) return d;

  // Inject defaults for missing required fields
  if (rules.defaults) {
    for (const [key, val] of Object.entries(rules.defaults)) {
      if (d[key] === undefined) d[key] = val;
    }
  }

  // Rename top-level fields
  if (rules.rename) {
    for (const [from, to] of Object.entries(rules.rename)) {
      if (d[from] !== undefined && d[to] === undefined) {
        d[to] = d[from];
        delete d[from];
      }
    }
  }

  // Rename sub-fields inside repeater arrays
  if (rules.subRename) {
    for (const [arrayKey, fieldMap] of Object.entries(rules.subRename)) {
      if (Array.isArray(d[arrayKey])) {
        d[arrayKey] = d[arrayKey].map(item => {
          if (!item || typeof item !== 'object') return item;
          const row = { ...item };
          for (const [from, to] of Object.entries(fieldMap)) {
            if (row[from] !== undefined && row[to] === undefined) {
              row[to] = row[from];
              delete row[from];
            }
          }
          return row;
        });
      }
    }
  }

  // Special: Contact addresses — convert string address to GoogleMap object + auto-enable map
  if (type === 'contact' && Array.isArray(d.addresses)) {
    let hasAddress = false;
    d.addresses = d.addresses.map(addr => {
      if (typeof addr.address === 'string' && addr.address.trim()) {
        addr.address = { address: addr.address, lat: 0, lng: 0 };
        hasAddress = true;
      } else if (addr.address && typeof addr.address === 'object' && addr.address.address) {
        hasAddress = true;
      }
      return addr;
    });
    // If addresses have location data, force map view (Carte) instead of photo
    if (hasAddress) d.is_map = true;
  }

  return d;
}

/**
 * Post-process AI-generated block data:
 * - Replace "image-default" strings with the site's replacement_image as a media object
 * - Ensure repeater fields (items, hero_sliders, columns_list) are proper arrays
 * - Normalize sub-modules in columns-tab flexible content
 */
function processAiBlockData(data, defaultImgUrl) {
  if (!data || typeof data !== 'object') return data;

  // Image field names that should be media objects
  const imageFields = ['image', 'bg_img', 'photo', 'picture', 'logo', 'icon', 'preview', 'file', 'icone'];
  const logoUrl = siteSettingsCache?.logo || defaultImgUrl;

  function makeImageObject(url) {
    return { id: null, url: url || '', alt: '', title: '', caption: '', width: null, height: null };
  }

  function resolveValue(val, key) {
    // "image-default" → media object with site default image
    if (val === 'image-default' || val === 'image_default') {
      return makeImageObject(defaultImgUrl);
    }
    // "logo-default" → media object with site logo
    if (val === 'logo-default' || val === 'logo_default') {
      return makeImageObject(logoUrl);
    }
    // If it's a string URL in an image field, wrap it as media object
    if (imageFields.includes(key) && typeof val === 'string' && val !== '' && val !== 'image-default' && val !== 'logo-default') {
      return makeImageObject(val);
    }
    // Recurse into objects
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return processObject(val);
    }
    // Recurse into arrays
    if (Array.isArray(val)) {
      return val.map(item => {
        if (item && typeof item === 'object') return processObject(item);
        return item;
      });
    }
    return val;
  }

  function processObject(obj) {
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = resolveValue(val, key);
    }
    return result;
  }

  return processObject(data);
}

/**
 * Stream AI generation via SSE. Returns a Promise that resolves with the final result.
 * Updates the loading overlay with a live character counter.
 */
function streamAiGeneration(prompt, pageTitle, genSeo, model, webSearch = true) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      prompt,
      page_title: pageTitle,
      context: genSeo ? 'Génère aussi le SEO et le Schema.org' : '',
      model,
      web_search: webSearch
    });

    fetch(`${API_BASE}/ai/generate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body
    }).then(response => {
      if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
        return response.json().then(err => { throw new Error(err.error || 'Request failed'); });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let charCount = 0;
      let currentEvent = '';
      let resolved = false;

      function handleLine(line) {
        if (resolved) return;
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
          return;
        }
        if (!line.startsWith('data: ')) return;
        const data = line.slice(6);

        if (currentEvent === 'status') {
          const counter = document.getElementById('aiCharCounter');
          if (counter) counter.textContent = data;
        } else if (currentEvent === 'chunk') {
          charCount += data.length;
          const counter = document.getElementById('aiCharCounter');
          if (counter) counter.textContent = `${charCount} caractères générés...`;
        } else if (currentEvent === 'done') {
          resolved = true;
          try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Réponse finale JSON invalide')); }
        } else if (currentEvent === 'error') {
          resolved = true;
          try { reject(new Error(JSON.parse(data).error || 'Erreur IA')); } catch (e) { reject(new Error(data)); }
        }
      }

      function processChunks() {
        reader.read().then(({ done, value }) => {
          if (value) buffer += decoder.decode(value, { stream: true });

          // Process all complete lines in buffer
          const lines = buffer.split('\n');
          buffer = done ? '' : lines.pop(); // on stream end, process everything
          for (const line of lines) handleLine(line);
          // If stream ended, also process remaining buffer
          if (done && buffer) handleLine(buffer);

          if (resolved) return;
          if (done) { reject(new Error('Stream terminé sans résultat')); return; }
          processChunks();
        }).catch(reject);
      }

      processChunks();
    }).catch(reject);
  });
}

// Expose all on window
Object.assign(window, {
  openAiModal,
  executeAiGeneration,
  resolveAiFormIds,
  openBulkAiModal,
  handleBulkAiImages,
  removeBulkAiImage,
  removeBulkAiHtmlFile,
  executeBulkAiGeneration,
  bulkAiPublishAndPreview,
  geocodeAiBlockAddresses,
  normalizeAiBlock,
  processAiBlockData,
  streamAiGeneration,
});
