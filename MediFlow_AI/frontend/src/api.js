import { useAuthStore } from './store/useAuthStore';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

// Strip the trailing /api — for endpoints mounted at the origin (e.g. /fhir).
export function originUrl(path) {
  return API_BASE.replace(/\/api$/, '') + path;
}

export function wsUrl(path) {
  return API_BASE.replace(/\/api$/, '').replace(/^http/, 'ws') + path;
}

function formatError(data, status) {
  if (data == null) return `Request failed (${status})`;
  const d = data.detail !== undefined ? data.detail : data;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((e) => (e && e.msg) || JSON.stringify(e)).join('; ');
  if (d && typeof d === 'object') return d.message || JSON.stringify(d);
  return `Request failed (${status})`;
}

export async function apiFetch(path, opts = {}) {
  const token = useAuthStore.getState().token;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, { ...opts, headers });

  if (res.status === 401) {
    useAuthStore.getState().logout();
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const err = new Error(formatError(data, res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// Token-injecting fetch that returns the raw Response (so legacy pages doing
// `.then(r => r.json())` keep working). `path` is relative to API_BASE.
export function rawFetch(path, opts = {}) {
  const token = useAuthStore.getState().token;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = fetch(API_BASE + path, { ...opts, headers });
  return res;
}

// For /fhir (outside /api) — returns the raw Response so callers can download blobs.
export function fhirFetch(path) {
  const token = useAuthStore.getState().token;
  return fetch(originUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
