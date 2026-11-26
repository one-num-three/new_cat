#include "bus.h"

#include "config.h"

namespace bus {
SemaphoreHandle_t i2cMutex = nullptr;

void begin() {
  if (!i2cMutex) i2cMutex = xSemaphoreCreateMutex();
  Wire.begin(PIN_SDA, PIN_SCL, I2C_FREQ);
  Wire.setTimeOut(50);
}

void recover() {
  Lock lk;
  Wire.end();
  pinMode(PIN_SDA, INPUT_PULLUP);
  pinMode(PIN_SCL, OUTPUT);
  // 标准 I2C 9-clock 脉冲解锁被从机拉死的 SDA
  for (int i = 0; i < 9; i++) {
    digitalWrite(PIN_SCL, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_SCL, LOW);
    delayMicroseconds(10);
  }
  // 产生 STOP 条件：SCL 高时 SDA 由低变高
  pinMode(PIN_SDA, OUTPUT);
  digitalWrite(PIN_SDA, LOW);
  delayMicroseconds(10);
  digitalWrite(PIN_SCL, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_SDA, HIGH);
  delayMicroseconds(10);

  Wire.begin(PIN_SDA, PIN_SCL, I2C_FREQ);
  Wire.setTimeOut(50);
}
}  // namespace bus
