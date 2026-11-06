const telemetryModel = require('../models/telemetry');
const telemetryService = require('../services/telemetryService');

const CRITICAL_LIMITS = {
	oxygenMinMgL: 4.0,
	ammoniaMaxMgL: 0.05,
};

function finiteNumber(value) {
	return typeof value === 'number' && Number.isFinite(value);
}

function normalizeTelemetry(body) {
	const oxygenMgL = body.O2 ?? body.oxygenMgL ?? body.oxygen;
	const batteryVoltage = body.batteryVoltage ?? body.battery;
	const ph = body.pH ?? body.ph;
	const { ammonia } = body;

	if (!finiteNumber(oxygenMgL) || !finiteNumber(ph) ||
			!finiteNumber(ammonia) || !finiteNumber(batteryVoltage)) {
		return { error: 'O2, pH, ammonia e batteryVoltage devem ser numeros finitos.' };
	}
	if (oxygenMgL < 0 || oxygenMgL > 30 || ph < 0 || ph > 14 ||
			ammonia < 0 || ammonia > 100 || batteryVoltage < 0 || batteryVoltage > 100) {
		return { error: 'Um ou mais valores estao fora da faixa fisica aceita.' };
	}

	const relays = body.relays ?? {};
	if (typeof relays !== 'object' || relays === null || Array.isArray(relays) ||
			Object.values(relays).some((state) => typeof state !== 'boolean')) {
		return { error: 'relays deve ser um objeto cujos estados sejam booleanos.' };
	}

	return {
		reading: {
			oxygenMgL,
			ph,
			ammoniaMgL: ammonia,
			batteryVoltage,
			...(finiteNumber(body.batteryPercent) && body.batteryPercent >= 0 && body.batteryPercent <= 100
				? { batteryPercent: body.batteryPercent }
				: {}),
			relays,
			timestamp: new Date().toISOString(),
		},
	};
}

function receiveTelemetry(req, res) {
	const normalized = normalizeTelemetry(req.body || {});
	if (normalized.error) {
		return res.status(400).json({ error: normalized.error });
	}

	const result = telemetryService.recordTelemetry(normalized.reading);

	return res.status(201).json({
		message: 'Telemetria recebida.',
		data: result.reading,
		critical: result.critical,
	});
}

function getLatestTelemetry(_req, res) {
	const latest = telemetryModel.getLatestTelemetry();
	if (!latest) {
		return res.status(404).json({ error: 'Ainda nao ha leituras de telemetria.' });
	}
	return res.json({ data: latest });
}

function getTelemetryHistory(req, res) {
	const { from, to, period } = req.query;
	let fromDate = from;
	let toDate = to;

	if (period) {
		const match = /^([1-9]\d*)(m|h|d)$/.exec(period);
		if (!match) {
			return res.status(400).json({ error: 'period deve usar formato como 30m, 24h ou 7d.' });
		}
		const units = { m: 60_000, h: 3_600_000, d: 86_400_000 };
		fromDate = new Date(Date.now() - Number(match[1]) * units[match[2]]).toISOString();
		toDate = new Date().toISOString();
	}

	for (const [name, value] of [['from', fromDate], ['to', toDate]]) {
		if (value && !Number.isFinite(Date.parse(value))) {
			return res.status(400).json({ error: `${name} deve ser uma data ISO valida.` });
		}
	}

	const limit = req.query.limit === undefined ? 100 : Number(req.query.limit);
	if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
		return res.status(400).json({ error: 'limit deve ser um inteiro entre 1 e 1000.' });
	}

	const data = telemetryModel.getTelemetryHistory({
		from: fromDate,
		to: toDate,
		limit,
	});
	return res.json({ data, count: data.length });
}

module.exports = {
	receiveTelemetry,
	getLatestTelemetry,
	getTelemetryHistory,
};