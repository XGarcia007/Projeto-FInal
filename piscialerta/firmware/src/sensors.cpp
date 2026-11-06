#include <Arduino.h>
#include "config.h"
#include "sensors.h"

namespace {

float readAverageVoltage(uint8_t pin) {
	uint32_t sampleTotal = 0;
	for (uint8_t sample = 0; sample < Config::ADC_SAMPLE_COUNT; ++sample) {
		sampleTotal += static_cast<uint32_t>(analogRead(pin));
	}

	const float averageCount = static_cast<float>(sampleTotal) /
														 static_cast<float>(Config::ADC_SAMPLE_COUNT);
	return averageCount * Config::ADC_REFERENCE_VOLTAGE / Config::ADC_MAX_COUNT;
}

}

void initSensors() {
	analogReadResolution(12);
	pinMode(Config::OXYGEN_PIN, INPUT);
	pinMode(Config::PH_PIN, INPUT);
	pinMode(Config::AMMONIA_PIN, INPUT);
	pinMode(Config::BATTERY_PIN, INPUT);
}

float readOxygen() {
	const float voltage = readAverageVoltage(Config::OXYGEN_PIN);
	return voltage * Config::OXYGEN_MG_L_PER_VOLT + Config::OXYGEN_OFFSET_MG_L;
}

float readPH() {
	const float voltage = readAverageVoltage(Config::PH_PIN);
	return voltage * Config::PH_PER_VOLT + Config::PH_OFFSET;
}

float readAmmonia() {
	const float voltage = readAverageVoltage(Config::AMMONIA_PIN);
	return voltage * Config::AMMONIA_MG_L_PER_VOLT + Config::AMMONIA_OFFSET_MG_L;
}

float readBatteryVoltage() {
	const float voltage = readAverageVoltage(Config::BATTERY_PIN);
	return voltage * Config::BATTERY_DIVIDER_RATIO * Config::BATTERY_CALIBRATION_FACTOR;
}

SensorData readAllSensors() {
	SensorData data;
	data.oxygenMgL = readOxygen();
	data.ph = readPH();
	data.ammoniaMgL = readAmmonia();
	data.batteryVoltage = readBatteryVoltage();
	return data;
}