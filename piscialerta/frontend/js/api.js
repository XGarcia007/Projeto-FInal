import { getAccessToken, signOut } from './auth.js';

// Verifica se está a correr localmente ou no servidor da nuvem (Render)
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Em produção no Render usa a origem atual sem a porta :3000
const DEFAULT_API_BASE = isLocalhost 
  ? 'http://localhost:3000/api' 
  : `${window.location.origin}/api`;

const STORAGE_KEY = 'piscialerta-api-base';

export function getApiBaseUrl() {
  const stored = localStorage.getItem(STORAGE_KEY);
  
  // Se houver uma URL antiga com :3000 salva no navegador fora do localhost, limpa-a
  if (stored && !isLocalhost && stored.includes(':3000')) {
    localStorage.removeItem(STORAGE_KEY);
  }

  return (localStorage.getItem(STORAGE_KEY) || window.PISCIALERTA_API_BASE || DEFAULT_API_BASE)
    .replace(/\/$/, '');
}

export function saveApiBaseUrl(value) {
  const normalized = value.trim().replace(/\/$/, '');
  if (!/^https?:\/\/.+\/api$/.test(normalized)) {
    throw new Error('Informe uma URL HTTP(S) terminada em /api.');
  }
  localStorage.setItem(STORAGE_KEY, normalized);
  return normalized;
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
        ...options.headers,
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && getAccessToken()) signOut();
      const error = new Error(body.error || `Falha HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return body;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Tempo limite ao conectar com a API.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchLatestTelemetry() {
  const result = await request('/telemetry/latest');
  return result.data;
}

export async function fetchTelemetryHistory(period = '24h') {
  const params = new URLSearchParams({ period });
  const result = await request(`/telemetry/history?${params}`);
  return result.data || [];
}

export async function triggerRelayManual(relayPin, state) {
  if (![26, 27, 14].includes(Number(relayPin)) || typeof state !== 'boolean') {
    throw new Error('Comando de relé inválido.');
  }
  return request('/relays/manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ relayPin: Number(relayPin), state }),
  });
}

export async function checkApiConnection() {
  try {
    return await request('/telemetry/latest');
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}