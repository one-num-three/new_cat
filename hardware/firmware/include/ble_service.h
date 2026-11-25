#pragma once
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

#include "protocol.h"

namespace ble {
struct InfoSnapshot {
  uint8_t bandId[6];
  uint8_t fwMajor;
  uint8_t fwMinor;
  uint8_t role;
  uint8_t team;
  uint32_t session;
  uint16_t battMv;
  uint8_t battPct;
  uint8_t hwFlags;  // bit0: IMU ok, bit1: NFC ok
};

// cmdQ：收到手机写入指令后推入队列；nameSuffix：广播名 CMB-XXXX
void begin(const uint8_t bandId[6], QueueHandle_t cmdQ);
bool connected();
bool takeJustSubscribed();

// 发送 EVENT Notify
bool notify(const uint8_t* data, uint8_t len);

// 更新 INFO 特征值与广播包厂商数据（角色/队伍/电量/场次）
void updateInfo(const InfoSnapshot& info);
}  // namespace ble
