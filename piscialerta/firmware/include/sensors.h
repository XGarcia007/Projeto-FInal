#pragma once

struct SensorData {
  float oxygenMgL;
  float ph;
  float ammoniaMgL;
  float batteryVoltage;
};

void initSensors();
float readOxygen();
float readPH();
float readAmmonia();
float readBatteryVoltage();
SensorData readAllSensors();