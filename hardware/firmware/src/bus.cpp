#include "bus.h"

#include "config.h"

namespace bus {
SemaphoreHandle_t i2cMutex = nullptr;

void begin() {
  i2cMutex = xSemaphoreCreateMutex();
  Wire.begin(PIN_SDA, PIN_SCL, I2C_FREQ);
  Wire.setTimeOut(50);
}
}  // namespace bus
