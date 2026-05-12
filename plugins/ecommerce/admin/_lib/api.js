/**
 * API client — wrapper fetch avec auth Bearer + error handling typé.
 *
 * Le token JWT est lu depuis localStorage (parent window si la page
 * tourne en iframe dans le SPA admin).
 */

const tokenSrc = window.parent && window.parent.localStorage ? window.parent.localStorage : localStorage;

export const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api'
  : '/api';

export class ApiError extends Error {
  constructor(message, { status = 0, body = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function authHeaders(extra = {}) {
  const token = tokenSrc.getItem('token') || '';
  return { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', ...extra };
}

export async function api(method, path, body) {
  const init = { method, headers: authHeaders() };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(API_BASE + path, init);
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON response */ }
  if (!res.ok) throw new ApiError(data?.error || `HTTP ${res.status}`, { status: res.status, body: data });
  return data;
}

export const apiGet    = (path)       => api('GET',    path);
export const apiPost   = (path, body) => api('POST',   path, body);
export const apiPut    = (path, body) => api('PUT',    path, body);
export const apiDelete = (path)       => api('DELETE', path);
