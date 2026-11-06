const telemetryModel = require('../models/telemetry');
const alertService = require('./alertService');

function getCriticalReasons(reading) {
  const reasons = [];
  if (reading.oxygenMgL < 4.0) {
    reasons.push(`Nível crítico de oxigênio (${reading.oxygenMgL.toFixed(2)} mg/L)`);
  }
  if (reading.ammoniaMgL > 0.05) {
    reasons.push(`Nível crítico de amônia (${reading.ammoniaMgL.toFixed(3)} mg/L)`);
  }
  return reasons;
}

function recordTelemetry(reading) {
  const saved = telemetryModel.saveTelemetry(reading);
  const criticalReasons = getCriticalReasons(saved);
  if (criticalReasons.length) {
    void alertService.dispatchEmergencyAlerts(criticalReasons.join('. ')).catch((error) => {
      console.error('Falha ao processar alertas de emergência:', error.message);
    });
  }
  return { reading: saved, critical: criticalReasons.length > 0 };
}

module.exports = { recordTelemetry, getCriticalReasons };