/**
 * SettingsFormView — fill / collect / reveal sur le form HTML statique.
 *
 * Le form lui-même reste défini dans settings.html (énorme, stable). La View
 * ne reconstruit pas le DOM, elle lit/écrit dans les champs existants.
 *
 * Handlers :
 *   onSubmit(payload) — submit form
 *   onRevealSecret(key) → Promise<string> — quand l'utilisateur clique sur "œil"
 */

import { BaseView } from '../_lib/View.js';
import { qs, qsa } from '../_lib/dom.js';

const TEXT_KEYS = [
  'shop_legal_name','shop_siret','shop_vat_number','shop_email','shop_phone','shop_country',
  'shop_address','shop_postcode','shop_city','shop_currency','ecommerce_emails_from','ecommerce_notif_recipients',
  'stripe_mode',
  'stripe_pk_test','stripe_pk_live',
  'stripe_webhook_id_test','stripe_webhook_id_live',
  'bank_holder',
  'invoice_prefix','invoice_next_number','quote_prefix','quote_next_number',
];

const SECRET_KEYS = [
  'stripe_sk_test','stripe_sk_live',
  'stripe_webhook_secret_test','stripe_webhook_secret_live',
  'bank_iban','bank_bic',
];

const PLACEHOLDERS = {
  stripe_sk_test: 'sk_test_… (vide = conserver)',
  stripe_sk_live: 'sk_live_… (vide = conserver)',
  stripe_webhook_secret_test: 'whsec_… (vide = conserver)',
  stripe_webhook_secret_live: 'whsec_… (vide = conserver)',
  bank_iban: 'FR76 … (vide = conserver)',
  bank_bic: '(vide = conserver)',
};

export class SettingsFormView extends BaseView {
  mount(root) {
    this.root = root;
    this.loading = qs('#settings-loading', root);
    this.form = qs('#settings-form', root);

    this.on(this.form, 'submit', async (e) => {
      e.preventDefault();
      const payload = this.collect();
      await this.handlers.onSubmit?.(payload);
    });

    this._wireRevealButtons();
    return this;
  }

  setAccessDenied() {
    this.loading.innerHTML = '<i class="fa-solid fa-lock" style="color:var(--gray-500);margin-right:6px"></i>Accès réservé aux super-administrateurs.';
    this.form.style.display = 'none';
  }

  showLoadError(msg) {
    this.loading.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="color:var(--danger);margin-right:6px"></i>' + msg;
    this.form.style.display = 'none';
  }

  fill(data) {
    for (const [key, val] of Object.entries(data)) {
      if (key.endsWith('_set') || key.endsWith('_masked')) continue;
      const input = this.form.querySelector(`[name="${key}"]`);
      if (!input) continue;
      if (input.type === 'checkbox') input.checked = val === '1' || val === true;
      else input.value = val ?? '';
    }
    let methods = [];
    try { methods = JSON.parse(data.shop_payment_methods || '[]'); } catch {}
    qsa('#payment-methods input', this.form).forEach(cb => {
      cb.checked = methods.includes(cb.value);
    });

    this._setBadge('stripe-sk-test-badge',  data.stripe_sk_test_set,                  data.stripe_sk_test_masked);
    this._setBadge('stripe-sk-live-badge',  data.stripe_sk_live_set,                  data.stripe_sk_live_masked);
    this._setBadge('stripe-whs-test-badge', data.stripe_webhook_secret_test_set,      data.stripe_webhook_secret_test_masked);
    this._setBadge('stripe-whs-live-badge', data.stripe_webhook_secret_live_set,      data.stripe_webhook_secret_live_masked);
    this._setBadge('bank-iban-badge',       data.bank_iban_set,                       data.bank_iban_masked);
    this._setBadge('bank-bic-badge',        data.bank_bic_set,                        data.bank_bic_masked);

    // Webhook URL réelle depuis l'origin parent (iframe).
    const wh = qs('#webhook-url');
    if (wh) {
      const origin = (window.parent && window.parent.location.origin) || window.location.origin;
      wh.textContent = origin + '/api/payments/stripe/webhook';
    }

    this.loading.style.display = 'none';
    this.form.style.display = 'block';
  }

  collect() {
    const fd = new FormData(this.form);
    const payload = {};
    for (const k of TEXT_KEYS) payload[k] = fd.get(k) ?? '';
    payload.shop_payment_methods = qsa('#payment-methods input:checked', this.form).map(cb => cb.value);
    // Checkbox fields → '1' ou '0'
    payload.shop_franchise_tva = this.form.querySelector('[name="shop_franchise_tva"]')?.checked ? '1' : '0';
    // Secrets : on n'envoie que ceux remplis (sinon on conserve la valeur en base).
    for (const k of SECRET_KEYS) {
      const v = fd.get(k);
      if (v) payload[k] = v;
    }
    return payload;
  }

  _setBadge(id, isSet, masked) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isSet) { el.className = 'badge set'; el.textContent = masked || 'définie'; }
    else { el.className = 'badge unset'; el.textContent = 'non définie'; }
  }

  _wireRevealButtons() {
    qsa('button[data-reveal]', this.form).forEach(btn => {
      let revealed = false;
      let fromFetch = false;
      this.on(btn, 'click', async () => {
        const key = btn.dataset.reveal;
        const input = this.form.querySelector(`[name="${key}"]`);
        if (!input) return;

        if (revealed) {
          input.type = 'password';
          if (fromFetch) {
            input.value = '';
            input.placeholder = PLACEHOLDERS[key] || '';
          }
          btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
          revealed = false; fromFetch = false;
          return;
        }

        if (input.value) {
          input.type = 'text';
          btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
          revealed = true; fromFetch = false;
          return;
        }

        try {
          const value = await this.handlers.onRevealSecret?.(key);
          input.type = 'text';
          input.value = value || '';
          input.placeholder = '';
          btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
          revealed = true; fromFetch = true;
        } catch (err) {
          // l'erreur sera gérée en amont par withErrorToast
          throw err;
        }
      });
    });
  }
}
