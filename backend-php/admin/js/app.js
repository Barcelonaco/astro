// ═══════════════════════════════════════════════════════════════════════════
// app.js — Entry point (ES module)
//
// Imports all modules. Each module self-registers its functions on window
// via Object.assign(window, { ... }) as a side effect of evaluation.
// ═══════════════════════════════════════════════════════════════════════════

import './state.js';
import './utils.js';
import './auth.js';
import './theme.js';
import './settings.js';
import './plugins.js';
import './navigation.js';
import './dashboard.js';
import './pages.js';
import './media.js';
import './media-picker.js';
import './link-picker.js';
import './map.js';
import './builder-template.js';
import './builder-forms.js';
import './builder-core.js';
import './builder-inline.js';
import './builder-ai.js';
import './builder-seo.js';
import './builder-meta.js';
import './cpt.js';
import './menus.js';
import './users.js';
import './forms.js';
import './ai-credits.js';
import './reusable-blocs.js';

// ── Boot ──────────────────────────────────────────────────────────────────

if (!window.token) {
  window.location.href = '/login';
} else {
  startInactivityTracker();
  init();
}
