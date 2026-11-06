#pragma once

#include "sensors.h"

void initNetwork();
void maintainNetwork();
bool sendTelemetry(SensorData data);