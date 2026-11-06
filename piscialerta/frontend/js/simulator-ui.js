import { getAccessToken, signOut } from './auth.js';
import { getApiBaseUrl } from './api.js';

const scenarios = [
  { id: 'low-oxygen', label: 'Simular queda de oxigênio (crise)', icon: 'triangle-alert' },
  { id: 'high-ammonia', label: 'Simular pico de amônia', icon: 'flask-conical' },
  { id: 'low-battery', label: 'Simular bateria fraca', icon: 'battery-low' },
  { id: 'reset', label: 'Restaurar estado normal', icon: 'circle-check' },
];

let running = false;
let busy = false;

async function callSimulator(path, method = 'GET') {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) signOut();
  if (!response.ok) throw new Error(body.error || `Falha HTTP ${response.status}`);
  return body;
}

export function initializeSimulatorUI({ user, onReading, onRefresh, notify }) {
  if (String(user?.role || '').toUpperCase() !== 'ADMIN') return;

  const dock = document.createElement('aside');
  dock.className = 'simulator-dock';
  dock.innerHTML = `
    <section class="simulator-panel" id="simulator-panel" hidden aria-label="Controles do simulador">
      <div class="simulator-head">
        <div><h2>Simulador IoT</h2><p>Injeção de telemetria para demonstração</p></div>
        <span class="simulator-status" id="simulator-status">Verificando</span>
      </div>
      <button class="simulator-power" id="simulator-power" type="button" disabled><span class="simulator-power-icon"><i data-lucide="play"></i></span><span class="simulator-power-label">Iniciar simulador</span></button>
      <div class="simulator-scenarios">
        ${scenarios.map((scenario) => `<button class="simulator-scenario" type="button" data-scenario="${scenario.id}" disabled><i data-lucide="${scenario.icon}"></i><span>${scenario.label}</span></button>`).join('')}
      </div>
      <p class="simulator-footnote">Cenários simulam apenas dados do servidor. Não substituem a proteção local do ESP32.</p>
    </section>
    <button class="simulator-toggle" id="simulator-toggle" type="button" aria-expanded="false" aria-controls="simulator-panel">
      <span class="simulator-toggle-label"><i data-lucide="cpu"></i><span>Painel do Simulador IoT</span></span>
      <i class="sim-chevron" data-lucide="chevron-up"></i>
    </button>`;
  document.body.append(dock);
  if (window.lucide) window.lucide.createIcons({ nodes: [dock] });

  const panel = dock.querySelector('#simulator-panel');
  const status = dock.querySelector('#simulator-status');
  const powerButton = dock.querySelector('#simulator-power');
  const scenarioButtons = [...dock.querySelectorAll('.simulator-scenario')];

  function renderStatus(isRunning, label = isRunning ? 'Ativo' : 'Parado') {
    running = isRunning;
    status.textContent = label;
    status.classList.toggle('is-running', running);
    powerButton.disabled = busy;
    powerButton.classList.toggle('is-stop', running);
    powerButton.querySelector('.simulator-power-label').textContent = running ? 'Interromper simulador' : 'Iniciar simulador';
    powerButton.querySelector('.simulator-power-icon').innerHTML = `<i data-lucide="${running ? 'square' : 'play'}"></i>`;
    scenarioButtons.forEach((button) => { button.disabled = busy || !running; });
    if (window.lucide) window.lucide.createIcons({ nodes: [dock] });
  }

  async function refreshStatus() {
    try {
      const result = await callSimulator('/simulator/status');
      renderStatus(Boolean(result.data?.running), result.data?.scenario === 'normal' && result.data?.running ? 'Normal' : undefined);
    } catch (error) {
      renderStatus(false, 'Indisponível');
      notify(`Simulador indisponível: ${error.message}`, 'error');
    }
  }

  async function performAction(path, method, successMessage) {
    if (busy) return;
    busy = true;
    renderStatus(running, 'Processando…');
    try {
      const result = await callSimulator(path, method);
      if (result.data?.oxygenMgL !== undefined) onReading(result.data);
      if (path === '/simulator/start') await onRefresh();
      if (path === '/simulator/stop') renderStatus(false, 'Parado');
      else if (path === '/simulator/start') renderStatus(true, 'Normal');
      else renderStatus(true, result.scenario === 'reset' ? 'Normal' : 'Cenário ativo');
      if (path.includes('/scenario/')) await onRefresh();
      notify(successMessage, 'success');
      if (window.lucide) window.lucide.createIcons({ nodes: [dock] });
    } catch (error) {
      renderStatus(running, running ? 'Ativo' : 'Indisponível');
      notify(error.message, 'error');
    } finally {
      busy = false;
      renderStatus(running);
    }
  }

  dock.querySelector('#simulator-toggle').addEventListener('click', (event) => {
    const expanded = dock.classList.toggle('is-open');
    panel.hidden = !expanded;
    event.currentTarget.setAttribute('aria-expanded', String(expanded));
  });
  powerButton.addEventListener('click', () => {
    const starting = !running;
    void performAction(`/simulator/${starting ? 'start' : 'stop'}`, 'POST',
      starting ? 'Simulador iniciado.' : 'Simulador interrompido.');
  });
  scenarioButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const scenario = button.dataset.scenario;
      const label = scenarios.find((item) => item.id === scenario)?.label || 'Cenário aplicado.';
      void performAction(`/simulator/scenario/${scenario}`, 'POST', label);
    });
  });

  void refreshStatus();
}