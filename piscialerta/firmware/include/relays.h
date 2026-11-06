#pragma once

#include "sensors.h"

struct RelayState {
  bool mainAerator;
  bool backupAerator;
  bool siren;
};

void initRelays();
void evaluateLimitsAndControl(SensorData data);
void setRelayManual(int relayPin, bool state);
RelayState getRelayState();