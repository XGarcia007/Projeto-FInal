#include <Arduino.h>
#include <math.h>
#include "config.h"
#include "relays.h"

namespace {

struct SafetyLatch {
	bool active = false;
	bool recoveryTiming = false;
	uint32_t recoveryStartedAt = 0;
};

SafetyLatch aerationLatch;
SafetyLatch alarmLatch;
bool manualMainAerator = false;
bool manualBackupAerator = false;
bool manualSiren = false;
RelayState currentState = {false, false, false};

void updateLatch(SafetyLatch& latch, bool critical, bool safeToClear, uint32_t now) {
	if (critical) {
		latch.active = true;
		latch.recoveryTiming = false;
		return;
	}

	if (!latch.active) {
		return;
	}

	if (!safeToClear) {
		latch.recoveryTiming = false;
		return;
	}

	if (!latch.recoveryTiming) {
		latch.recoveryTiming = true;
		latch.recoveryStartedAt = now;
		return;
	}

	if (now - latch.recoveryStartedAt >= Config::ALARM_CLEAR_DELAY_MS) {
		latch.active = false;
		latch.recoveryTiming = false;
	}
}

void writeRelay(uint8_t pin, bool enabled) {
	digitalWrite(pin, enabled ? Config::RELAY_ACTIVE_LEVEL : Config::RELAY_INACTIVE_LEVEL);
}

void applyRelayStates() {
	currentState.mainAerator = manualMainAerator;
	currentState.backupAerator = manualBackupAerator || aerationLatch.active;
	currentState.siren = manualSiren || alarmLatch.active;

	writeRelay(Config::MAIN_AERATOR_RELAY_PIN, currentState.mainAerator);
	writeRelay(Config::BACKUP_AERATOR_RELAY_PIN, currentState.backupAerator);
	writeRelay(Config::SIREN_RELAY_PIN, currentState.siren);
}

}

void initRelays() {
	pinMode(Config::MAIN_AERATOR_RELAY_PIN, OUTPUT);
	pinMode(Config::BACKUP_AERATOR_RELAY_PIN, OUTPUT);
	pinMode(Config::SIREN_RELAY_PIN, OUTPUT);

	writeRelay(Config::MAIN_AERATOR_RELAY_PIN, false);
	writeRelay(Config::BACKUP_AERATOR_RELAY_PIN, false);
	writeRelay(Config::SIREN_RELAY_PIN, false);

	aerationLatch = SafetyLatch{};
	alarmLatch = SafetyLatch{};
	manualMainAerator = false;
	manualBackupAerator = false;
	manualSiren = false;
	currentState = {false, false, false};
}

void evaluateLimitsAndControl(SensorData data) {
	const bool oxygenValid = isfinite(data.oxygenMgL);
	const bool ammoniaValid = isfinite(data.ammoniaMgL);
	const bool phValid = isfinite(data.ph);

	const bool oxygenOrAmmoniaCritical =
			!oxygenValid || !ammoniaValid ||
			data.oxygenMgL < Config::OXYGEN_MIN_MG_L ||
			data.ammoniaMgL > Config::AMMONIA_MAX_MG_L;
	const bool phCritical = !phValid || data.ph < Config::PH_MIN || data.ph > Config::PH_MAX;

	const bool oxygenAndAmmoniaRecovered =
			oxygenValid && ammoniaValid &&
			data.oxygenMgL >= Config::OXYGEN_RECOVERY_MG_L &&
			data.ammoniaMgL <= Config::AMMONIA_RECOVERY_MAX_MG_L;
	const bool phRecovered = phValid && data.ph >= Config::PH_RECOVERY_MIN &&
													 data.ph <= Config::PH_RECOVERY_MAX;

	const uint32_t now = millis();
	updateLatch(aerationLatch, oxygenOrAmmoniaCritical,
							oxygenAndAmmoniaRecovered, now);
	updateLatch(alarmLatch, oxygenOrAmmoniaCritical || phCritical,
							oxygenAndAmmoniaRecovered && phRecovered, now);
	applyRelayStates();
}

void setRelayManual(int relayPin, bool state) {
	if (relayPin == Config::MAIN_AERATOR_RELAY_PIN) {
		manualMainAerator = state;
	} else if (relayPin == Config::BACKUP_AERATOR_RELAY_PIN) {
		manualBackupAerator = state;
	} else if (relayPin == Config::SIREN_RELAY_PIN) {
		manualSiren = state;
	} else {
		return;
	}

	applyRelayStates();
}

RelayState getRelayState() {
	return currentState;
}