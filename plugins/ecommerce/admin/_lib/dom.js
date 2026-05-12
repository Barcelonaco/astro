/**
 * DOM helpers — minimaux, pas de framework.
 *
 * - h(tag, attrs, ...children) : create element programmatique
 * - qs / qsa : alias querySelector / querySelectorAll
 * - on : addEventListener avec retour de cleanup
 * - escape : échappement HTML pour interpolation sûre dans innerHTML
 * - cloneTpl : clone un <template id="..."> et retourne le DocumentFragment
 */

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const qs  = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function on(target, event, handler, opts) {
  target.addEventListener(event, handler, opts);
  return () => target.removeEventListener(event, handler, opts);
}

export function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

export function cloneTpl(id) {
  const tpl = document.getElementById(id);
  if (!tpl || !(tpl instanceof HTMLTemplateElement)) throw new Error(`Template #${id} introuvable`);
  return tpl.content.cloneNode(true);
}

/** Délégation d'événement : on(root, 'click', '[data-action]', handler) */
export function delegate(root, event, selector, handler) {
  return on(root, event, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  });
}
