#include "imu.h"

#include <Wire.h>
#include <math.h>

#include "bus.h"
#include "config.h"

namespace imu {
namespace {
constexpr uint8_t REG_WHO_AM_I    = 0x0F;
constexpr uint8_t REG_CTRL1       = 0x20;
constexpr uint8_t REG_CTRL2       = 0x21;
constexpr uint8_t REG_CTRL3       = 0x22;
constexpr uint8_t REG_CTRL4       = 0x23;
constexpr uint8_t REG_CTRL5       = 0x24;
constexpr uint8_t REG_CTRL6       = 0x25;
constexpr uint8_t REG_OUT_X_L     = 0x28;
constexpr uint8_t REG_CLICK_CFG   = 0x38;
constexpr uint8_t REG_CLICK_SRC   = 0x39;
constexpr uint8_t REG_CLICK_THS   = 0x3A;
constexpr uint8_t REG_TIME_LIMIT  = 0x3B;
constexpr uint8_t REG_TIME_LAT    = 0x3C;
constexpr uint8_t REG_TIME_WINDOW = 0x3D;

uint8_t addr = 0x19;
bool present = false;
uint16_t thresholdMg = IMU_DEFAULT_THRESHOLD_MG;
volatile bool irqFlag = false;

void IRAM_ATTR onIrq() { irqFlag = true; }

bool writeReg(uint8_t reg, uint8_t val) {
  bus::Lock lk;
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.write(val);
  return Wire.endTransmission() == 0;
}

bool readRegs(uint8_t reg, uint8_t* buf, uint8_t n) {
  bus::Lock lk;
  Wire.beginTransmission(addr);
  Wire.write(n > 1 ? (reg | 0x80) : reg);  // 0x80 = 地址自增
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom((int)addr, (int)n) != n) return false;
  for (uint8_t i = 0; i < n; i++) buf[i] = Wire.read();
  return true;
}

uint8_t readReg(uint8_t reg) {
  uint8_t v = 0;
  readRegs(reg, &v, 1);
  return v;
}

uint16_t readMagnitudeMg() {
  uint8_t b[6];
  if (!readRegs(REG_OUT_X_L, b, 6)) return 0;
  // 高分辨率 12 位左对齐，±8g 时 4 mg/LSB
  float x = (int16_t)(b[0] | (b[1] << 8)) >> 4;
  float y = (int16_t)(b[2] | (b[3] << 8)) >> 4;
  float z = (int16_t)(b[4] | (b[5] << 8)) >> 4;
  return (uint16_t)(sqrtf(x * x + y * y + z * z) * 4.0f);
}

void applyThreshold() {
  // ±8g 下单击阈值 1 LSB = 62.5 mg；bit7 = 锁存中断直到读 CLICK_SRC
  uint16_t ths = thresholdMg / 62;
  if (ths < 4) ths = 4;
  if (ths > 127) ths = 127;
  writeReg(REG_CLICK_THS, 0x80 | (uint8_t)ths);
}
}  // namespace

bool begin() {
  for (uint8_t a : {(uint8_t)0x19, (uint8_t)0x18}) {
    addr = a;
    if (readReg(REG_WHO_AM_I) == 0x33) {
      present = true;
      break;
    }
  }
  if (!present) return false;

  writeReg(REG_CTRL1, 0x77);   // 400 Hz，XYZ 使能
  writeReg(REG_CTRL2, 0x04);   // 单击检测走高通滤波（去掉重力）
  writeReg(REG_CTRL3, 0x80);   // 单击中断 -> INT1
  writeReg(REG_CTRL4, 0xA8);   // BDU，±8g，高分辨率
  writeReg(REG_CTRL5, 0x00);
  writeReg(REG_CTRL6, 0x00);   // 中断高电平有效
  writeReg(REG_CLICK_CFG, 0x15);  // X/Y/Z 单击
  applyThreshold();
  writeReg(REG_TIME_LIMIT, 0x10);   // 40 ms
  writeReg(REG_TIME_LAT, 0x14);     // 50 ms
  writeReg(REG_TIME_WINDOW, 0x00);
  readReg(REG_CLICK_SRC);           // 清除残留

  pinMode(PIN_IMU_INT, INPUT);
  attachInterrupt(digitalPinToInterrupt(PIN_IMU_INT), onIrq, RISING);
  return true;
}

bool ok() { return present; }

void setThreshold(uint16_t mg) {
  thresholdMg = mg;
  if (present) applyThreshold();
}

uint16_t threshold() { return thresholdMg; }

bool poll(uint16_t& peakMg) {
  if (!present) return false;
  if (!irqFlag && digitalRead(PIN_IMU_INT) == LOW) return false;
  irqFlag = false;
  uint8_t src = readReg(REG_CLICK_SRC);  // 读取即清除锁存
  if (!(src & 0x40)) return false;       // IA 位
  peakMg = readMagnitudeMg();
  return true;
}

void prepareSleep() {
  if (!present) return;
  writeReg(REG_CTRL1, 0x00);  // 关机进入 Power-down (<1 uA)，由按键唤醒开机
  readReg(REG_CLICK_SRC);
}
}  // namespace imu
