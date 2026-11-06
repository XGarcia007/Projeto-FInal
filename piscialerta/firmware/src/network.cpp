#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <stdio.h>
#include <string.h>
#include "config.h"
#include "network.h"
#include "relays.h"

namespace {

uint32_t lastWifiAttemptAt = 0;
bool networkInitialized = false;

bool wifiCredentialsConfigured() {
	return Config::WIFI_SSID[0] != '\0' &&
				 strcmp(Config::WIFI_SSID, "SUA_REDE_WIFI") != 0;
}

}

void initNetwork() {
	WiFi.mode(WIFI_STA);
	WiFi.setAutoReconnect(true);
	networkInitialized = true;
	lastWifiAttemptAt = millis();

	if (wifiCredentialsConfigured()) {
		WiFi.begin(Config::WIFI_SSID, Config::WIFI_PASSWORD);
	}
}

void maintainNetwork() {
	if (!networkInitialized || WiFi.status() == WL_CONNECTED ||
			!wifiCredentialsConfigured()) {
		return;
	}

	const uint32_t now = millis();
	if (now - lastWifiAttemptAt >= Config::WIFI_RETRY_INTERVAL_MS) {
		lastWifiAttemptAt = now;
		WiFi.disconnect();
		WiFi.begin(Config::WIFI_SSID, Config::WIFI_PASSWORD);
	}
}

bool sendTelemetry(SensorData data) {
	maintainNetwork();
	if (WiFi.status() != WL_CONNECTED) {
		return false;
	}

	const RelayState relays = getRelayState();
	char payload[256];
	const int payloadLength = snprintf(
			payload, sizeof(payload),
			"{\"O2\":%.3f,\"pH\":%.3f,\"ammonia\":%.4f,\"battery\":%.3f,"
			"\"relays\":{\"mainAerator\":%s,\"backupAerator\":%s,\"siren\":%s}}",
			data.oxygenMgL, data.ph, data.ammoniaMgL, data.batteryVoltage,
			relays.mainAerator ? "true" : "false",
			relays.backupAerator ? "true" : "false",
			relays.siren ? "true" : "false");

	if (payloadLength <= 0 || static_cast<size_t>(payloadLength) >= sizeof(payload)) {
		return false;
	}

	WiFiClient client;
	HTTPClient http;
	http.setConnectTimeout(Config::HTTP_TIMEOUT_MS);
	http.setTimeout(Config::HTTP_TIMEOUT_MS);

	if (!http.begin(client, Config::API_ENDPOINT)) {
		return false;
	}

	http.addHeader("Content-Type", "application/json");
	const int responseCode = http.POST(
			reinterpret_cast<uint8_t*>(payload), static_cast<size_t>(payloadLength));
	http.end();
	return responseCode >= 200 && responseCode < 300;
}