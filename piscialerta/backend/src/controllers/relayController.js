const simulator = require('../simulator');

const ALLOWED_RELAY_PINS = new Set([26, 27, 14]);

function setManualRelay(req, res) {
  const relayPin = Number(req.body?.relayPin);
  const { state } = req.body || {};
  if (!ALLOWED_RELAY_PINS.has(relayPin) || typeof state !== 'boolean') {
    return res.status(400).json({ error: 'Informe relayPin 26, 27 ou 14 e state booleano.' });
  }

  if (!simulator.getSimulatorStatus().running) {
    return res.status(503).json({ error: 'Controle remoto de hardware ainda nao esta conectado. Ative o simulador para testar comandos.' });
  }

  try {
    const result = simulator.setSimulatedRelay(relayPin, state);
    return res.json({ message: 'Comando simulado aplicado.', data: result.reading });
  } catch (error) {
    return res.status(409).json({ error: error.message });
  }
}

module.exports = { setManualRelay };