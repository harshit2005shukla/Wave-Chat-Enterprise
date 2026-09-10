import { storage } from './storage';
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
export const SERVER_URL = API_URL.replace(/\/api\/?$/, '');

async function refreshAccess() {
  const refreshToken = storage.getRefresh();
  if (!refreshToken) throw new Error('Session expired');
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken })
  });
  if (!response.ok) throw new Error('Session expired');
  const data = await response.json();
  storage.setSession(data.accessToken, data.refreshToken, storage.getUser());
  return data.accessToken as string;
}

export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const token = storage.getAccess(); if (token) headers.set('Authorization', `Bearer ${token}`);
  let response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401 && retry && storage.getRefresh()) {
    const access = await refreshAccess(); headers.set('Authorization', `Bearer ${access}`);
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  }
  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try { const body = await response.json(); message = body.error ?? message; } catch { /* no JSON */ }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function uploadFile(file: File) {
  const form = new FormData(); form.append('file', file);
  return api<{ file: { url: string; name: string; mime: string; size: number } }>('/uploads', { method: 'POST', body: form });
}
