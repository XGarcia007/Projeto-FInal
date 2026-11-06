import {
  checkApiConnection,
  fetchLatestTelemetry,
  fetchTelemetryHistory,
  getApiBaseUrl,
  saveApiBaseUrl,
  triggerRelayManual,
} from './api.js';
import { renderOxygenChart } from './charts.js';
import { requireAuth, signOut } from './auth.js';
import { initializeSimulatorUI } from './simulator-ui.js';
import { initializeUsersPanel, loadUsers } from './users.js';

const OXYGEN_MIN = 4.0;
const OXYGEN_MAX_DISPLAY = 10;
const POLL_INTERVAL_MS = 10_000;
const BATTERY_ESTIMATE = { emptyVoltage: 10.5, fullVoltage: 12.6 };
const views = ['inicio', 'tanques', 'bateria', 'graficos', 'ajustes', 'usuarios'];

let latestReading = null;
let selectedPeriod = '24h';
let selectedRelay = null;
let confirmationStep = 1;
let operationMode = 'automatico';
let dismissedAlertForTimestamp = null;
let polling = false;
let canManageUsers = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function formatNumber(value, digits = 1) {
  return Number.isFinite(Number(value))
    ? Number(value).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '--';
}

function setConnection(online, loading = false) {
  const pill = $('#connection-status');
  if (!pill) return;
  pill.classList.toggle('is-online', online);
  pill.classList.toggle('is-offline', !online && !loading);
  pill.classList.toggle('is-loading', loading);
  const label = loading ? 'Conectando' : online ? 'Online' : 'Sem conexão';
  setText('#connection-label', label);
  setText('#settings-connection', label);
}

function setMetricState(cardSelector, badgeSelector, state, label) {
  const card = $(cardSelector);
  const badge = $(badgeSelector);
  if (!card || !badge) return;
  card.classList.remove('is-safe', 'is-critical', 'is-warning');
  badge.classList.remove('state-safe', 'state-critical', 'state-warning', 'state-unknown');
  card.classList.add(state === 'safe' ? 'is-safe' : state === 'critical' ? 'is-critical' : state === 'warning' ? 'is-warning' : '');
  badge.classList.add(state === 'safe' ? 'state-safe' : state === 'critical' ? 'state-critical' : state === 'warning' ? 'state-warning' : 'state-unknown');
  badge.textContent = label;
}

function batteryPercentage(voltage) {
  if (!Number.isFinite(Number(voltage))) return null;
  const raw = ((Number(voltage) - BATTERY_ESTIMATE.emptyVoltage) /
    (BATTERY_ESTIMATE.fullVoltage - BATTERY_ESTIMATE.emptyVoltage)) * 100;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

function setBattery(reading) {
  const reportedPercent = Number(reading?.batteryPercent);
  const percent = Number.isFinite(reportedPercent)
    ? Math.max(0, Math.min(100, Math.round(reportedPercent)))
    : batteryPercentage(Number(reading?.batteryVoltage));
  const voltageText = percent === null ? '-- V' : `${formatNumber(reading.batteryVoltage, 2)} V`;
  const percentText = percent === null ? '--%' : `${percent}%`;
  setText('#header-battery', percentText);
  setText('#battery-percent', percentText);
  setText('#battery-large-percent', percent === null ? '--' : String(percent));
  setText('#battery-voltage', voltageText);
  setText('#battery-detail-voltage', voltageText);
  setText('#battery-estimate-note', percent === null ? 'Aguardando leitura de tensão' : 'Estimativa linear para banco Li-ion 3S');
  setText('#battery-runtime', 'Não configurada');
  setText('#battery-detail-runtime', 'Não configurada');

  const normalized = percent ?? 0;
  const color = normalized <= 20 ? '#ef4444' : normalized <= 40 ? '#f59e0b' : '#22c55e';
  const ring = $('#battery-ring');
  if (ring) ring.style.background = `conic-gradient(${color} ${normalized}%, #e8efec 0)`;
  const fill = $('#battery-fill');
  if (fill) {
    fill.style.height = `${normalized}%`;
    fill.classList.toggle('is-low', normalized <= 20);
  }
  const scaleFill = $('#battery-scale-fill');
  if (scaleFill) {
    scaleFill.style.width = `${normalized}%`;
    scaleFill.style.background = color;
  }
}

function renderRelayState(relays = {}) {
  const states = [
    ['mainAerator', '#main-aerator-state', '#main-relay-description', 26],
    ['backupAerator', '#backup-aerator-state', '#backup-relay-description', 27],
  ];
  for (const [key, summarySelector, descriptionSelector, pin] of states) {
    const isOn = relays[key];
    const label = typeof isOn === 'boolean' ? (isOn ? 'Ligado' : 'Desligado') : '--';
    setText(summarySelector, label);
    setText(descriptionSelector, label === '--' ? 'Estado desconhecido' : `Estado atual: ${label.toLowerCase()}`);
    const button = $(`.relay-action[data-relay-pin="${pin}"]`);
    if (button) {
      button.classList.toggle('is-on', isOn === true);
      button.setAttribute('aria-pressed', String(isOn === true));
      button.disabled = operationMode !== 'manual' || typeof isOn !== 'boolean';
    }
  }
  const siren = relays.siren;
  setText('#siren-state', typeof siren === 'boolean' ? (siren ? 'Ativo' : 'Inativo') : '--');
}

function renderReading(reading) {
  latestReading = reading;
  const oxygen = Number(reading.oxygenMgL ?? reading.O2);
  const ph = Number(reading.ph ?? reading.pH);
  const ammonia = Number(reading.ammoniaMgL ?? reading.ammonia);

  setText('#oxygen-value', formatNumber(oxygen, 1));
  setText('#gauge-oxygen-value', formatNumber(oxygen, 1));
  setText('#chart-current-value', formatNumber(oxygen, 1));
  const oxygenCritical = !Number.isFinite(oxygen) || oxygen < OXYGEN_MIN;
  const oxygenSafe = Number.isFinite(oxygen) && oxygen >= OXYGEN_MIN;
  setMetricState('#oxygen-card', '#oxygen-status', oxygenCritical ? 'critical' : oxygenSafe ? 'safe' : 'unknown', oxygenCritical ? 'Crítico' : oxygenSafe ? 'Seguro' : 'Sem leitura');
  setMetricState('#oxygen-card', '#detail-oxygen-status', oxygenCritical ? 'critical' : oxygenSafe ? 'safe' : 'unknown', oxygenCritical ? 'Crítico' : oxygenSafe ? 'Seguro' : 'Sem leitura');
  const oxygenWidth = Number.isFinite(oxygen) ? Math.max(0, Math.min(100, oxygen / OXYGEN_MAX_DISPLAY * 100)) : 0;
  $('#oxygen-bar').style.width = `${oxygenWidth}%`;
  const gaugeFill = $('#oxygen-gauge-fill');
  gaugeFill.style.strokeDasharray = `${oxygenWidth} 100`;
  gaugeFill.classList.toggle('is-critical', oxygenCritical);
  setText('#oxygen-guidance', oxygenCritical ? 'Acionamento de emergência deve ser verificado imediatamente.' : 'Oxigênio acima do limite mínimo de segurança.');

  setText('#ph-value', formatNumber(ph, 1));
  setText('#detail-ph-value', formatNumber(ph, 1));
  const phSafe = Number.isFinite(ph) && ph >= 6.5 && ph <= 8.5;
  setMetricState('#ph-card', '#ph-status', phSafe ? 'safe' : Number.isFinite(ph) ? 'critical' : 'unknown', phSafe ? 'Seguro' : Number.isFinite(ph) ? 'Crítico' : 'Sem leitura');
  const phPercent = Number.isFinite(ph) ? Math.max(0, Math.min(100, ph / 14 * 100)) : 0;
  $('#ph-bar').style.width = `${phPercent}%`;

  setText('#ammonia-value', formatNumber(ammonia, 3));
  setText('#detail-ammonia-value', `${formatNumber(ammonia, 3)} mg/L`);
  const ammoniaSafe = Number.isFinite(ammonia) && ammonia <= 0.05;
  setMetricState('#ammonia-card', '#ammonia-status', ammoniaSafe ? 'safe' : Number.isFinite(ammonia) ? 'critical' : 'unknown', ammoniaSafe ? 'Seguro' : Number.isFinite(ammonia) ? 'Crítico' : 'Sem leitura');
  const ammoniaPercent = Number.isFinite(ammonia) ? Math.max(0, Math.min(100, ammonia / 0.1 * 100)) : 0;
  $('#ammonia-bar').style.width = `${ammoniaPercent}%`;

  const detailPhStatus = $('#detail-ph-status');
  detailPhStatus.className = `state-badge ${phSafe ? 'state-safe' : Number.isFinite(ph) ? 'state-critical' : 'state-unknown'}`;
  detailPhStatus.textContent = phSafe ? 'Seguro' : Number.isFinite(ph) ? 'Crítico' : 'Sem leitura';
  const detailAmmoniaStatus = $('#detail-ammonia-status');
  detailAmmoniaStatus.className = `state-badge ${ammoniaSafe ? 'state-safe' : Number.isFinite(ammonia) ? 'state-critical' : 'state-unknown'}`;
  detailAmmoniaStatus.textContent = ammoniaSafe ? 'Seguro' : Number.isFinite(ammonia) ? 'Crítico' : 'Sem leitura';

  const criticalParts = [];
  if (oxygenCritical) criticalParts.push(`Oxigênio abaixo do mínimo (${formatNumber(oxygen, 1)} mg/L)`);
  if (Number.isFinite(ammonia) && ammonia > 0.05) criticalParts.push(`Amônia acima do máximo (${formatNumber(ammonia, 3)} mg/L)`);
  const banner = $('#critical-banner');
  if (criticalParts.length && dismissedAlertForTimestamp !== reading.timestamp) {
    setText('#critical-message', criticalParts.join(' · '));
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }

  const updated = reading.timestamp ? new Date(reading.timestamp) : null;
  const updateText = updated && !Number.isNaN(updated.getTime())
    ? `Atualizado ${updated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : 'Leitura recebida';
  setText('#last-updated', updateText);
  setText('#tank-updated', updateText);
  setText('#settings-last-reading', updateText);

  renderRelayState(reading.relays || {});
  setBattery(reading);
}

async function refreshLatest() {
  if (polling) return;
  polling = true;
  try {
    const reading = await fetchLatestTelemetry();
    renderReading(reading);
    setConnection(true);
  } catch (error) {
    setConnection(error.status === 404);
    if (error.status === 404) setText('#last-updated', 'Nenhuma leitura recebida');
    else console.warn('Falha ao atualizar telemetria:', error.message);
  } finally {
    polling = false;
  }
}

async function refreshHistory(period = selectedPeriod) {
  selectedPeriod = period;
  $$('.period-button').forEach((button) => {
    const selected = button.dataset.period === period;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  try {
    const readings = await fetchTelemetryHistory(period);
    renderOxygenChart(readings, period);
  } catch (error) {
    console.warn('Falha ao carregar histórico:', error.message);
    renderOxygenChart([], period);
    showToast('Não foi possível carregar o histórico da API.', 'error');
  }
}

function navigate(viewName) {
  if (viewName === 'usuarios' && !canManageUsers) return;
  if (!views.includes(viewName)) return;
  $$('.view').forEach((view) => {
    const active = view.id === `view-${viewName}`;
    view.classList.toggle('is-active', active);
    view.hidden = !active;
  });
  $$('.nav-item').forEach((item) => {
    const active = item.dataset.nav === viewName;
    item.classList.toggle('is-active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  if (viewName === 'graficos') void refreshHistory(selectedPeriod);
  if (viewName === 'usuarios') void loadUsers();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message, type = '') {
  const toast = document.createElement('div');
  toast.className = `toast ${type ? `is-${type}` : ''}`;
  toast.textContent = message;
  $('#toast-region').append(toast);
  window.setTimeout(() => toast.remove(), 4800);
}

function setMode(mode) {
  operationMode = mode;
  $$('.mode-button').forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const note = mode === 'manual'
    ? 'Comandos exigem confirmação dupla e suporte de controle no backend.'
    : 'No modo automático, o ESP32 mantém a proteção local independente da rede.';
  setText('#manual-control-note', note);
  renderRelayState(latestReading?.relays || {});
}

function openCommandConfirmation(button) {
  const pin = Number(button.dataset.relayPin);
  const key = pin === 26 ? 'mainAerator' : 'backupAerator';
  const current = latestReading?.relays?.[key];
  if (typeof current !== 'boolean') {
    showToast('Sem estado atualizado do relé. Aguarde uma leitura do equipamento.', 'error');
    return;
  }
  selectedRelay = { pin, state: !current, label: button.dataset.relayLabel };
  confirmationStep = 1;
  setText('#dialog-title', `${selectedRelay.state ? 'Ligar' : 'Desligar'} ${selectedRelay.label.toLowerCase()}?`);
  setText('#dialog-copy', 'Este comando altera a aeração do Tanque 02. O controle de emergência local do ESP32 continua prioritário.');
  setText('#dialog-step', 'Etapa 1 de 2');
  $('#dialog-step').classList.remove('is-final');
  $('#confirm-command').textContent = 'Entendi, continuar';
  $('#confirm-dialog').showModal();
}

async function confirmCommand() {
  if (!selectedRelay) return;
  if (confirmationStep === 1) {
    confirmationStep = 2;
    setText('#dialog-step', 'Etapa 2 de 2');
    $('#dialog-step').classList.add('is-final');
    $('#confirm-command').textContent = 'Enviar comando ao equipamento';
    return;
  }

  const command = selectedRelay;
  $('#confirm-command').disabled = true;
  try {
    await triggerRelayManual(command.pin, command.state);
    showToast(`Comando enviado para ${command.label}.`, 'success');
    $('#confirm-dialog').close();
  } catch (error) {
    showToast(`Comando não enviado: ${error.message}`, 'error');
  } finally {
    $('#confirm-command').disabled = false;
    selectedRelay = null;
  }
}

async function saveApiSettings() {
  try {
    const base = saveApiBaseUrl($('#api-base-input').value);
    $('#api-base-input').value = base;
    const status = $('#api-setting-status');
    status.textContent = 'Verificando…';
    status.classList.remove('is-connected');
    await checkApiConnection();
    status.textContent = 'Conectado';
    status.classList.add('is-connected');
    showToast('Endereço da API salvo e verificado.', 'success');
    await refreshLatest();
  } catch (error) {
    $('#api-setting-status').textContent = 'Sem conexão';
    $('#api-setting-status').classList.remove('is-connected');
    showToast(error.message, 'error');
  }
}

function initialize() {
  const user = requireAuth();
  if (!user) return;
  canManageUsers = String(user.role || '').toUpperCase() === 'ADMIN';
  $('#users-nav').hidden = !canManageUsers;

  const apiInput = $('#api-base-input');
  apiInput.value = getApiBaseUrl();
  $('#profile-avatar').src = user.avatar;
  $('#profile-avatar').alt = `Foto de ${user.name}`;
  setText('#profile-name', user.name);
  setText('#profile-role', user.roleLabel);
  setConnection(false, true);
  if (window.lucide) window.lucide.createIcons();

  $$('[data-nav]').forEach((control) => control.addEventListener('click', () => navigate(control.dataset.nav)));
  $$('.mode-button').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  $$('.relay-action').forEach((button) => button.addEventListener('click', () => openCommandConfirmation(button)));
  $$('.period-button').forEach((button) => button.addEventListener('click', () => void refreshHistory(button.dataset.period)));
  $('#confirm-command').addEventListener('click', () => void confirmCommand());
  $('#cancel-command').addEventListener('click', () => $('#confirm-dialog').close());
  $('#dismiss-alert').addEventListener('click', () => {
    dismissedAlertForTimestamp = latestReading?.timestamp;
    $('#critical-banner').hidden = true;
  });
  $('#save-api-button').addEventListener('click', () => void saveApiSettings());
  $('#refresh-now-button').addEventListener('click', () => void refreshLatest());
  $('#battery-ring').addEventListener('click', () => navigate('bateria'));
  $('#logout-button').addEventListener('click', signOut);
  if (canManageUsers) initializeUsersPanel(showToast);
  initializeSimulatorUI({
    user,
    onReading: renderReading,
    onRefresh: async () => {
      await refreshLatest();
      if ($('#view-graficos').classList.contains('is-active')) await refreshHistory(selectedPeriod);
    },
    notify: showToast,
  });

  void refreshLatest();
  window.setInterval(() => void refreshLatest(), POLL_INTERVAL_MS);
}

initialize();