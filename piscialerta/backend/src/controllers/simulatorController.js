const simulator = require('../simulator');

function start(_req, res) {
  const status = simulator.startSimulator();
  return res.json({ message: 'Simulador iniciado.', data: status });
}

function stop(_req, res) {
  const status = simulator.stopSimulator();
  return res.json({ message: 'Simulador interrompido.', data: status });
}

function status(_req, res) {
  return res.json({ data: simulator.getSimulatorStatus() });
}

function scenario(name) {
  return (_req, res) => {
    try {
      const result = simulator.injectScenario(name);
      return res.status(201).json({
        message: 'Cenário aplicado.',
        data: result.reading,
        critical: result.critical,
        scenario: name,
      });
    } catch (error) {
      return res.status(409).json({ error: error.message });
    }
  };
}

module.exports = {
  start,
  stop,
  status,
  lowOxygen: scenario('low-oxygen'),
  highAmmonia: scenario('high-ammonia'),
  lowBattery: scenario('low-battery'),
  reset: scenario('reset'),
};