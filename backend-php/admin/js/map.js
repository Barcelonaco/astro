// ═══════════════════════════════════════════════════════════════════════════
// map.js — Mapbox geocoding + mini-map preview for GoogleMap fields
// ═══════════════════════════════════════════════════════════════════════════

function ensureMapboxGL() {
  if (_mapboxGLLoaded || window.mapboxgl) { window._mapboxGLLoaded = true; return Promise.resolve(); }
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
    script.onload = () => { window._mapboxGLLoaded = true; resolve(); };
    document.head.appendChild(script);
  });
}

function initGoogleMapField(uid) {
  const root = document.getElementById(uid);
  if (!root) return;
  const searchInput = root.querySelector('.googlemap-search');
  const suggestionsEl = root.querySelector('.googlemap-suggestions');
  const latInput = root.querySelector('[name$="__lat"]');
  const lngInput = root.querySelector('[name$="__lng"]');
  const addressInput = root.querySelector('[name$="__address"]');
  const placeIdInput = root.querySelector('[name$="__place_id"]');
  const streetNumberInput = root.querySelector('[name$="__street_number"]');
  const streetNameInput = root.querySelector('[name$="__street_name"]');
  const streetNameShortInput = root.querySelector('[name$="__street_name_short"]');
  const postCodeInput = root.querySelector('[name$="__post_code"]');
  const cityInput = root.querySelector('[name$="__city"]');
  const nameInput = root.querySelector('[name$="__name"]');
  const previewEl = root.querySelector('.googlemap-preview');
  let debounceTimer = null;
  let miniMap = null;
  let miniMarker = null;

  const existingLat = parseFloat(latInput?.value);
  const existingLng = parseFloat(lngInput?.value);
  if (existingLat && existingLng) {
    showMiniMap(existingLat, existingLng);
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = searchInput.value.trim();
    if (query.length < 3) { suggestionsEl.innerHTML = ''; suggestionsEl.style.display = 'none'; return; }
    debounceTimer = setTimeout(() => geocodeSearch(query), 300);
  });

  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) { suggestionsEl.innerHTML = ''; suggestionsEl.style.display = 'none'; }
  });

  async function geocodeSearch(query) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5&language=fr`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.features || data.features.length === 0) {
        suggestionsEl.innerHTML = '<div class="googlemap-suggestion-empty">Aucun résultat</div>';
        suggestionsEl.style.display = 'block';
        return;
      }
      suggestionsEl.innerHTML = data.features.map((f, i) =>
        `<div class="googlemap-suggestion" data-idx="${i}">${escapeHtml(f.place_name)}</div>`
      ).join('');
      suggestionsEl.style.display = 'block';

      suggestionsEl.querySelectorAll('.googlemap-suggestion').forEach((el) => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.idx);
          const feature = data.features[idx];
          if (!feature) return;
          const [lng, lat] = feature.center;
          searchInput.value = feature.place_name;
          latInput.value = lat;
          lngInput.value = lng;
          placeIdInput.value = feature.id || '';
          const ctx = feature.context || [];
          const getCtx = (prefix) => { const c = ctx.find(c => c.id && c.id.startsWith(prefix)); return c ? c.text : ''; };
          if (streetNumberInput) streetNumberInput.value = feature.address || '';
          if (streetNameInput) streetNameInput.value = feature.text || '';
          if (streetNameShortInput) streetNameShortInput.value = feature.text || '';
          if (postCodeInput) postCodeInput.value = getCtx('postcode');
          if (cityInput) cityInput.value = getCtx('place');
          if (nameInput) nameInput.value = feature.place_name || '';
          if (addressInput) addressInput.value = feature.place_name || '';
          suggestionsEl.innerHTML = '';
          suggestionsEl.style.display = 'none';
          showMiniMap(lat, lng);
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });
    } catch (err) {
      console.warn('Geocoding error:', err);
    }
  }

  async function showMiniMap(lat, lng) {
    if (miniMap) { try { miniMap.remove(); } catch(e) {} miniMap = null; miniMarker = null; }
    previewEl.innerHTML = '';
    previewEl.style.height = '200px';
    await ensureMapboxGL();
    if (!window.mapboxgl) { previewEl.innerHTML = `<div style="text-align:center;padding:20px;">📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>`; return; }
    mapboxgl.accessToken = MAPBOX_TOKEN;
    miniMap = new mapboxgl.Map({
      container: previewEl,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: 15,
      interactive: true,
    });
    miniMap.addControl(new mapboxgl.NavigationControl(), 'top-right');
    miniMarker = new mapboxgl.Marker({ draggable: true }).setLngLat([lng, lat]).addTo(miniMap);
    miniMap.on('load', () => { miniMap.resize(); });
    setTimeout(() => { if (miniMap) miniMap.resize(); }, 200);
    setTimeout(() => { if (miniMap) miniMap.resize(); }, 600);
    miniMarker.on('dragend', () => {
      const lngLat = miniMarker.getLngLat();
      latInput.value = lngLat.lat.toFixed(6);
      lngInput.value = lngLat.lng.toFixed(6);
      latInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  [latInput, lngInput].forEach(inp => {
    if (!inp) return;
    inp.addEventListener('change', () => {
      const lat = parseFloat(latInput.value);
      const lng = parseFloat(lngInput.value);
      if (lat && lng) showMiniMap(lat, lng);
    });
  });
}

// --- Expose on window ---
Object.assign(window, {
  ensureMapboxGL, initGoogleMapField,
});
