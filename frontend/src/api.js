const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function getToken() { return localStorage.getItem('cq_token'); }

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) throw new Error(body?.error || res.statusText);
  return body;
}

export const auth = {
  login: (username, password) => api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => api('/auth/me'),
  logout: () => api('/auth/logout', { method: 'POST' }),
};

export const quests = {
  list: () => api('/quests'),
  create: (data) => api('/quests', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/quests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id) => api(`/quests/${id}`, { method: 'DELETE' }),
  submit: (id, data) => api(`/quests/${id}/submit`, { method: 'POST', body: JSON.stringify(data) }),
  pending: () => api('/quests/submissions/pending'),
  mine: () => api('/quests/submissions/mine'),
  review: (id, action, note) => api(`/quests/submissions/${id}/review`, {
    method: 'POST', body: JSON.stringify({ action, review_note: note }),
  }),
};

export const shop = {
  items: () => api('/shop/items'),
  redeem: (id, qty = 1) => api(`/shop/items/${id}/redeem`, { method: 'POST', body: JSON.stringify({ quantity: qty }) }),
  myLogs: () => api('/shop/logs/mine'),
  allLogs: () => api('/shop/logs'),
  createItem: (data) => api('/shop/items', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id, data) => api(`/shop/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteItem: (id) => api(`/shop/items/${id}`, { method: 'DELETE' }),
};

export const users = {
  list: (role) => api(`/users${role ? `?role=${encodeURIComponent(role)}` : ''}`),
  create: (data) => api('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  adjustPoints: (id, delta, note) => api(`/users/${id}/adjust-points`, {
    method: 'POST', body: JSON.stringify({ delta, note }),
  }),
  remove: (id) => api(`/users/${id}`, { method: 'DELETE' }),
};
