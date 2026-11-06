require('dotenv').config();

const telemetryService = require('./services/telemetryService');

const INTERVAL_MS = 10_000;
const scenarioNames = new Set(['low-oxygen', 'high-ammonia', 'low-battery', 'reset']);
let timer = null;
let activeScenario = 'normal';
let currentRelays = { mainAerator: true, backupAerator: false, siren: false };

function randomBetween(min, max, digits = 2) {
  const value = min + Math.random() * (max - min);
  return Number(value.toFixed(digits));
}

function makeReading(scenario = activeScenario) {
  let reading = {
    oxygenMgL: randomBetween(5.8, 6.8),
    ph: randomBetween(7.1, 7.4),
    ammoniaMgL: randomBetween(0.01, 0.02, 3),
    batteryVoltage: randomBetween(12.4, 13.8),
    batteryPercent: Math.round(randomBetween(85, 100, 0)),
    relays: { ...currentRelays },
    timestamp: new Date().toISOString(),
    source: 'simulator',
  };

  if (scenario === 'low-oxygen') {
    reading.oxygenMgL = 2.1;
    reading.relays = { mainAerator: true, backupAerator: true, siren: true };
  } else if (scenario === 'high-ammonia') {
    reading.ammoniaMgL = 0.08;
    reading.relays = { mainAerator: true, backupAerator: true, siren: true };
  } else if (scenario === 'low-battery') {
    reading.batteryVoltage = 10.5;
    reading.batteryPercent = 15;
    reading.relays = { mainAerator: true, backupAerator: false, siren: false };
  } else if (scenario === 'reset' || scenario === 'normal') {
    reading.relays = { ...currentRelays };
  }

  currentRelays = { ...reading.relays };
  return reading;
}

function publish(reading) {
  return telemetryService.recordTelemetry(reading);
}

function startSimulator() {
  if (timer) return getSimulatorStatus();
  activeScenario = 'normal';
  currentRelays = { mainAerator: true, backupAerator: false, siren: false };
  publish(makeReading('normal'));
  timer = setInterval(() => {
    if (activeScenario === 'normal') publish(makeReading('normal'));
  }, INTERVAL_MS);
  return getSimulatorStatus();
}

function stopSimulator() {
  if (timer) clearInterval(timer);
  timer = null;
  return getSimulatorStatus();
}

function injectScenario(name) {
  if (!scenarioNames.has(name)) throw new Error('Cenário de simulação desconhecido.');
  if (!timer) throw new Error('Simulador inativo. Inicie o simulador antes de injetar um cenário.');

  if (name === 'reset') {
    currentRelays = { mainAerator: true, backupAerator: false, siren: false };
  }
  activeScenario = name === 'reset' ? 'normal' : name;
  const result = publish(makeReading(name));
  return result;
}

function setSimulatedRelay(relayPin, state) {
  if (!timer) throw new Error('Simulador inativo.');
  const safetyCritical = activeScenario === 'low-oxygen' || activeScenario === 'high-ammonia';
  if (safetyCritical && ((relayPin === 27 && !state) || (relayPin === 14 && !state))) {
    throw new Error('A proteção de emergência mantém o aerador reserva e o alarme ativos. Restaure os sensores antes de desligá-los.');
  }

  const relayNames = { 26: 'mainAerator', 27: 'backupAerator', 14: 'siren' };
  const desiredRelays = { ...currentRelays, [relayNames[relayPin]]: state };
  const reading = makeReading(activeScenario);
  reading.relays = desiredRelays;
  currentRelays = { ...reading.relays };
  return publish(reading);
}

function getSimulatorStatus() {
  return { running: Boolean(timer), intervalMs: INTERVAL_MS, scenario: activeScenario };
}

module.exports = {
  startSimulator,
  stopSimulator,
  injectScenario,
  setSimulatedRelay,
  getSimulatorStatus,
};

if (require.main === module) {
  const app = require('./app');
  const port = Number.parseInt(process.env.PORT || '3000', 10);
  const server = app.listen(port, () => {
    console.log(`PisciAlerta API de simulacao ouvindo na porta ${port}.`);
    startSimulator();
  });

  const shutdown = () => {
    stopSimulator();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}