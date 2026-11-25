#pragma once
#include <Arduino.h>

// 精简版 PN532 I2C 驱动：读卡（Initiator）+ 卡模拟（Target）
class PN532 {
 public:
  bool begin(int rstPin);
  bool wake();
  bool getFirmwareVersion(uint32_t& ver);
  bool rfField(bool on);
  bool powerDown();

  // ---- 读卡 ----
  // 找到 ISO14443A 目标返回 true；sak & 0x20 表示支持 ISO-DEP（另一只手环 / 手机）
  bool inListPassiveTarget(uint8_t* uid, uint8_t& uidLen, uint8_t& sak, uint16_t timeoutMs);
  bool inDataExchange(const uint8_t* tx, uint8_t txLen, uint8_t* rx, uint8_t& rxLen, uint16_t timeoutMs);
  bool inRelease();

  // ---- 卡模拟 ----
  // 1 = 被读卡器激活（initRx/initLen 返回随激活附带的首条 APDU），0 = 超时（已中止），-1 = 错误
  int tgInitAsTarget(uint8_t* initRx, uint8_t& initLen, uint16_t timeoutMs);
  // 返回数据长度；-1 = 读卡器已离开 / 错误
  int tgGetData(uint8_t* rx, uint8_t maxLen, uint16_t timeoutMs);
  bool tgSetData(const uint8_t* tx, uint8_t len, uint16_t timeoutMs);

  void abort();

 private:
  bool samConfig();
  bool setPassiveRetries(uint8_t n);
  bool writeCommand(const uint8_t* cmd, uint8_t len);
  bool waitReady(uint16_t timeoutMs);
  bool readAck(uint16_t timeoutMs);
  int readResponse(uint8_t cmd, uint8_t* out, uint8_t maxLen, uint16_t timeoutMs);
  int command(const uint8_t* cmd, uint8_t len, uint8_t* out, uint8_t maxLen, uint16_t timeoutMs);

  int rst_ = -1;
  bool asleep_ = false;
};
