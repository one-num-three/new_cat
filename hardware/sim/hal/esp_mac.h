#pragma once
#include <cstdint>

enum esp_mac_type_t { ESP_MAC_WIFI_STA = 0, ESP_MAC_BT = 2 };
int esp_read_mac(uint8_t* mac, esp_mac_type_t type);
