#include <Arduino.h>
#include "config.h"
#include "network.h"
#include "relays.h"
#include "sensors.h"

namespace {

uint32_t lastSensorReadAt = 0;

}

void setup() {
	Serial.begin(115200);
	initSensors();
	initRelays();
	initNetwork();
	lastSensorReadAt = millis() - Config::SENSOR_READ_INTERVAL_MS;
}

void loop() {
	maintainNetwork();

	const uint32_t now = millis();
	if (now - lastSensorReadAt >= Config::SENSOR_READ_INTERVAL_MS) {
		lastSensorReadAt = now;

		const SensorData data = readAllSensors();
		evaluateLimitsAndControl(data);

		Serial.printf("O2: %.2f mg/L | pH: %.2f | NH3: %.3f mg/L | Bateria: %.2f V\n",
									data.oxygenMgL, data.ph, data.ammoniaMgL, data.batteryVoltage);

		if (!sendTelemetry(data)) {
			Serial.println("Telemetria nao enviada; controle local permanece ativo.");
		}
	}
}