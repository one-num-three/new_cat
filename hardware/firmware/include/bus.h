#pragma once
#include <Arduino.h>
#include <Wire.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

// I2C 总线由 IMU（主循环）和 PN532（NFC 任务）共享，用互斥锁保护。
namespace bus {
void begin();
// I2C 总线死锁自愈：输出 9 个 SCL 脉冲 + STOP 条件并重建 Wire
void recover();
extern SemaphoreHandle_t i2cMutex;

struct Lock {
  Lock() { xSemaphoreTake(i2cMutex, portMAX_DELAY); }
  ~Lock() { xSemaphoreGive(i2cMutex); }
};
}  // namespace bus
