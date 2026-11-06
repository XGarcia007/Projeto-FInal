const MAX_READINGS = 5000;
const readings = [];

function saveTelemetry(reading) {
	readings.push(reading);
	if (readings.length > MAX_READINGS) {
		readings.splice(0, readings.length - MAX_READINGS);
	}
	return reading;
}

function getLatestTelemetry() {
	return readings.length ? readings[readings.length - 1] : null;
}

function getTelemetryHistory({ from, to, limit = 100 } = {}) {
	const fromTime = from ? new Date(from).getTime() : Number.NEGATIVE_INFINITY;
	const toTime = to ? new Date(to).getTime() : Number.POSITIVE_INFINITY;

	return readings
		.filter((reading) => {
			const timestamp = new Date(reading.timestamp).getTime();
			return timestamp >= fromTime && timestamp <= toTime;
		})
		.slice(-limit)
		.reverse();
}

module.exports = {
	saveTelemetry,
	getLatestTelemetry,
	getTelemetryHistory,
};