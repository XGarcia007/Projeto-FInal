const TOKEN_KEY = 'piscialerta-token';
const USER_KEY = 'piscialerta-user';
const NAME_KEY = 'piscialerta-name';
const ROLE_KEY = 'piscialerta-role';
const DEFAULT_API_BASE = `${window.location.protocol}//${window.location.hostname || 'localhost'}:3000/api`;

function apiBaseUrl() {
  return (localStorage.getItem('piscialerta-api-base') || window.PISCIALERTA_API_BASE || DEFAULT_API_BASE)
    .replace(/\/$/, '');
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch (_error) {
    return null;
  }
}

export function getSessionRole() {
  return localStorage.getItem(ROLE_KEY) || getCurrentUser()?.role || null;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(ROLE_KEY);
}

export function hasValidSession() {
  const token = getAccessToken();
  const user = getCurrentUser();
  if (!token || !user) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const tokenRole = String(payload.role || '').toUpperCase();
    const userRole = String(user.role || '').toUpperCase();
    if (!payload.exp || payload.exp * 1000 <= Date.now() || !tokenRole || tokenRole !== userRole) {
      throw new Error('Sessão inválida.');
    }
    if (payload.id && payload.id !== user.id) throw new Error('Sessão inválida.');
    return true;
  } catch (_error) {
    clearSession();
    return false;
  }
}

export function requireAuth() {
  if (!hasValidSession()) {
    window.location.replace('login.html');
    return null;
  }
  return getCurrentUser();
}

export async function signIn(email, password) {
  const response = await fetch(`${apiBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Não foi possível autenticar.');
  if (!result.token || !result.user?.name || !result.user?.role) {
    throw new Error('A API retornou uma sessão incompleta. Tente novamente.');
  }
  localStorage.setItem(TOKEN_KEY, result.token);
  localStorage.setItem(USER_KEY, JSON.stringify(result.user));
  localStorage.setItem(NAME_KEY, result.user.name);
  localStorage.setItem(ROLE_KEY, result.user.role);
  return result.user;
}

export function signOut() {
  clearSession();
  window.location.replace('login.html');
}