#pragma once
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

// NFC 管理：在独立的 FreeRTOS 任务里运行，按角色在 Poll / Listen 间切换
namespace nfc {
enum Mode : uint8_t { MODE_AUTO = 0, MODE_POLL = 1, MODE_LISTEN = 2 };

// eventQ：BandEvent 队列，NFC 事件会推到这里
bool begin(const uint8_t bandId[6], QueueHandle_t eventQ);
bool ok();
bool busy();

void setIdentity(uint8_t role, uint8_t team, uint32_t session);
void setFlags(uint8_t flags);
void setBindUrl(const String& prefix);

// 打开一个 NFC 窗口；若当前窗口正在进行则忽略
void requestWindow(Mode mode, uint16_t ms);
// 强制结束当前窗口（例如关机前）
void cancel();
void sleep();
}  // namespace nfc
