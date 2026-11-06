#pragma once

#include <stdint.h>

namespace Config {

constexpr uint8_t OXYGEN_PIN = 34;
constexpr uint8_t PH_PIN = 35;
constexpr uint8_t AMMONIA_PIN = 32;
constexpr uint8_t BATTERY_PIN = 33;

constexpr uint8_t MAIN_AERATOR_RELAY_PIN = 26;
constexpr uint8_t BACKUP_AERATOR_RELAY_PIN = 27;
constexpr uint8_t SIREN_RELAY_PIN = 14;
constexpr uint8_t RELAY_ACTIVE_LEVEL = HIGH;
constexpr uint8_t RELAY_INACTIVE_LEVEL = LOW;

constexpr float OXYGEN_MIN_MG_L = 4.0f;
constexpr float PH_MIN = 6.5f;
constexpr float PH_MAX = 8.5f;
constexpr float AMMONIA_MAX_MG_L = 0.05f;

constexpr float OXYGEN_RECOVERY_MG_L = 4.2f;
constexpr float PH_RECOVERY_MIN = 6.7f;
constexpr float PH_RECOVERY_MAX = 8.3f;
constexpr float AMMONIA_RECOVERY_MAX_MG_L = 0.04f;
constexpr uint32_t ALARM_CLEAR_DELAY_MS = 30000UL;

constexpr uint8_t ADC_SAMPLE_COUNT = 10;
constexpr float ADC_REFERENCE_VOLTAGE = 3.3f;
constexpr float ADC_MAX_COUNT = 4095.0f;

// Estes coeficientes sao valores iniciais e devem ser calibrados para cada modulo.
constexpr float OXYGEN_MG_L_PER_VOLT = 1.0f;
constexpr float OXYGEN_OFFSET_MG_L = 0.0f;
constexpr float PH_PER_VOLT = -5.7f;
constexpr float PH_OFFSET = 21.25f;
constexpr float AMMONIA_MG_L_PER_VOLT = 1.0f;
constexpr float AMMONIA_OFFSET_MG_L = 0.0f;
constexpr float BATTERY_DIVIDER_RATIO = 2.0f;
constexpr float BATTERY_CALIBRATION_FACTOR = 1.0f;

constexpr char WIFI_SSID[] = "SUA_REDE_WIFI";
constexpr char WIFI_PASSWORD[] = "SUA_SENHA_WIFI";
constexpr char API_ENDPOINT[] = "http://192.168.1.100:3000/api/telemetry";

constexpr uint32_t SENSOR_READ_INTERVAL_MS = 10000UL;
constexpr uint32_t WIFI_RETRY_INTERVAL_MS = 15000UL;
constexpr uint16_t HTTP_TIMEOUT_MS = 2500;

}