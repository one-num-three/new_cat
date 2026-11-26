#include "pn532.h"

#include <Wire.h>

#include "bus.h"

namespace {
constexpr uint8_t ADDR = 0x24;
constexpr uint8_t HOST_TFI = 0xD4;
constexpr uint8_t PN_TFI = 0xD5;
constexpr uint8_t RESP_MAX = 96;  // 一次读取的最大字节数（ESP32 Wire 缓冲 128）

constexpr uint8_t CMD_GET_FIRMWARE   = 0x02;
constexpr uint8_t CMD_SAM_CONFIG     = 0x14;
constexpr uint8_t CMD_POWER_DOWN     = 0x16;
constexpr uint8_t CMD_RF_CONFIG      = 0x32;
constexpr uint8_t CMD_IN_DATA_EXCH   = 0x40;
constexpr uint8_t CMD_IN_LIST        = 0x4A;
constexpr uint8_t CMD_IN_RELEASE     = 0x52;
constexpr uint8_t CMD_TG_GET_DATA    = 0x86;
constexpr uint8_t CMD_TG_INIT        = 0x8C;
constexpr uint8_t CMD_TG_SET_DATA    = 0x8E;

const uint8_t ACK_FRAME[6] = {0x00, 0x00, 0xFF, 0x00, 0xFF, 0x00};
}  // namespace

bool PN532::begin(int rstPin) {
  rst_ = rstPin;
  if (rst_ >= 0) {
    pinMode(rst_, OUTPUT);
    digitalWrite(rst_, LOW);
    delay(10);
    digitalWrite(rst_, HIGH);
    delay(50);
  }
  asleep_ = true;  // 走一遍完整的唤醒 + 配置流程
  return wake();
}

bool PN532::wake() {
  if (!asleep_) return true;
  // I2C 唤醒脉冲：拉醒 PN532 晶振并等待建立
  {
    bus::Lock lk;
    Wire.beginTransmission(ADDR);
    Wire.write(0x00);
    Wire.endTransmission();
  }
  delay(5);
  for (int i = 0; i < 4; i++) {
    uint32_t ver;
    if (getFirmwareVersion(ver) && samConfig() && setPassiveRetries(0x02)) {
      asleep_ = false;
      return true;
    }
    if (i == 1) bus::recover();  // 连续失败尝试 9-clock I2C 总线自愈
    delay(10);
  }
  return false;
}

bool PN532::getFirmwareVersion(uint32_t& ver) {
  uint8_t cmd[] = {CMD_GET_FIRMWARE};
  uint8_t r[8];
  int n = command(cmd, sizeof(cmd), r, sizeof(r), 100);
  if (n < 4) return false;
  ver = ((uint32_t)r[0] << 24) | ((uint32_t)r[1] << 16) | ((uint32_t)r[2] << 8) | r[3];
  return r[0] == 0x32;  // PN532
}

bool PN532::samConfig() {
  uint8_t cmd[] = {CMD_SAM_CONFIG, 0x01, 0x14, 0x00};  // 普通模式，不用 IRQ 引脚
  uint8_t r[4];
  return command(cmd, sizeof(cmd), r, sizeof(r), 100) >= 0;
}

bool PN532::setPassiveRetries(uint8_t n) {
  uint8_t cmd[] = {CMD_RF_CONFIG, 0x05, 0xFF, 0x01, n};
  uint8_t r[4];
  return command(cmd, sizeof(cmd), r, sizeof(r), 100) >= 0;
}

bool PN532::rfField(bool on) {
  if (!wake()) return false;
  uint8_t cmd[] = {CMD_RF_CONFIG, 0x01, (uint8_t)(on ? 0x01 : 0x00)};
  uint8_t r[4];
  return command(cmd, sizeof(cmd), r, sizeof(r), 100) >= 0;
}

bool PN532::powerDown() {
  uint8_t cmd[] = {CMD_POWER_DOWN, 0x80};  // 由 I2C 唤醒
  uint8_t r[4];
  bool ok = command(cmd, sizeof(cmd), r, sizeof(r), 100) >= 1 && r[0] == 0x00;
  if (ok) asleep_ = true;
  return ok;
}

// ---------------- 读卡 ----------------
bool PN532::inListPassiveTarget(uint8_t* uid, uint8_t& uidLen, uint8_t& sak, uint16_t timeoutMs) {
  uint8_t cmd[] = {CMD_IN_LIST, 0x01, 0x00};  // 1 个目标，106 kbps Type A
  uint8_t r[64];
  int n = command(cmd, sizeof(cmd), r, sizeof(r), timeoutMs);
  // r: NbTg, Tg, SENS_RES(2), SEL_RES, NFCIDLen, NFCID...
  if (n < 6 || r[0] == 0) return false;
  sak = r[4];
  uidLen = r[5];
  if (uidLen > 10 || 6 + uidLen > n) return false;
  memcpy(uid, &r[6], uidLen);
  return true;
}

bool PN532::inDataExchange(const uint8_t* tx, uint8_t txLen, uint8_t* rx, uint8_t& rxLen, uint16_t timeoutMs) {
  uint8_t cmd[72];
  if (txLen > sizeof(cmd) - 2) return false;
  cmd[0] = CMD_IN_DATA_EXCH;
  cmd[1] = 0x01;  // Tg
  memcpy(&cmd[2], tx, txLen);
  uint8_t r[RESP_MAX];
  int n = command(cmd, txLen + 2, r, sizeof(r), timeoutMs);
  if (n < 1 || (r[0] & 0x3F) != 0) return false;
  uint8_t dataLen = n - 1;
  if (dataLen > rxLen) dataLen = rxLen;
  memcpy(rx, &r[1], dataLen);
  rxLen = dataLen;
  return true;
}

bool PN532::inRelease() {
  uint8_t cmd[] = {CMD_IN_RELEASE, 0x00};
  uint8_t r[4];
  return command(cmd, sizeof(cmd), r, sizeof(r), 50) >= 0;
}

// ---------------- 卡模拟 ----------------
int PN532::tgInitAsTarget(uint8_t* initRx, uint8_t& initLen, uint16_t timeoutMs) {
  uint8_t maxInit = initLen;
  initLen = 0;
  if (!wake()) return -1;
  uint8_t cmd[] = {
      CMD_TG_INIT,
      0x05,                    // Mode：仅 PICC + 仅被动
      0x04, 0x00,              // SENS_RES
      0x00, 0x00, 0x00,        // NFCID1t（PN532 会自动加 0x08 前缀，随机 UID）
      0x20,                    // SEL_RES：支持 ISO14443-4
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  // FeliCaParams
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0,                          // NFCID3t
      0x00,                    // Gt 长度
      0x00,                    // Tk 长度
  };
  if (!writeCommand(cmd, sizeof(cmd))) return -1;
  if (!readAck(50)) return -1;
  uint8_t r[RESP_MAX];
  int n = readResponse(CMD_TG_INIT, r, sizeof(r), timeoutMs);
  if (n == -1) {  // 超时：没有读卡器靠近
    abort();
    return 0;
  }
  if (n < 1) return -1;
  // r[0] 为激活 Mode，r[1..n-1] 为读卡器发来的首条 InitiatorCommand（如 SELECT AID）
  if (n > 1 && initRx && maxInit > 0) {
    uint8_t copyLen = (n - 1) > maxInit ? maxInit : (uint8_t)(n - 1);
    memcpy(initRx, &r[1], copyLen);
    initLen = copyLen;
  }
  return 1;
}

int PN532::tgGetData(uint8_t* rx, uint8_t maxLen, uint16_t timeoutMs) {
  uint8_t cmd[] = {CMD_TG_GET_DATA};
  uint8_t r[RESP_MAX];
  int n = command(cmd, sizeof(cmd), r, sizeof(r), timeoutMs);
  if (n == -1) abort();
  if (n < 1 || r[0] != 0x00) return -1;  // 0x29 = 读卡器释放
  int len = n - 1;
  if (len > maxLen) len = maxLen;
  memcpy(rx, &r[1], len);
  return len;
}

bool PN532::tgSetData(const uint8_t* tx, uint8_t len, uint16_t timeoutMs) {
  uint8_t cmd[80];
  if (len > sizeof(cmd) - 1) return false;
  cmd[0] = CMD_TG_SET_DATA;
  memcpy(&cmd[1], tx, len);
  uint8_t r[4];
  int n = command(cmd, len + 1, r, sizeof(r), timeoutMs);
  return n >= 1 && r[0] == 0x00;
}

void PN532::abort() {
  // 主机发送 ACK 帧即可中止 PN532 当前的命令
  {
    bus::Lock lk;
    Wire.beginTransmission(ADDR);
    Wire.write(ACK_FRAME, sizeof(ACK_FRAME));
    Wire.endTransmission();
  }
  delay(2);
}

// ---------------- 底层帧 ----------------
bool PN532::writeCommand(const uint8_t* cmd, uint8_t len) {
  uint8_t frame[8 + 80];
  if (len > 80) return false;
  uint8_t L = len + 1;  // TFI + 数据
  uint8_t i = 0;
  frame[i++] = 0x00;
  frame[i++] = 0x00;
  frame[i++] = 0xFF;
  frame[i++] = L;
  frame[i++] = (uint8_t)(~L + 1);
  frame[i++] = HOST_TFI;
  uint8_t sum = HOST_TFI;
  for (uint8_t k = 0; k < len; k++) {
    frame[i++] = cmd[k];
    sum += cmd[k];
  }
  frame[i++] = (uint8_t)(~sum + 1);
  frame[i++] = 0x00;

  bus::Lock lk;
  Wire.beginTransmission(ADDR);
  Wire.write(frame, i);
  return Wire.endTransmission() == 0;
}

bool PN532::waitReady(uint16_t timeoutMs) {
  uint32_t start = millis();
  while (true) {
    {
      bus::Lock lk;
      if (Wire.requestFrom((int)ADDR, 1) == 1 && (Wire.read() & 0x01)) return true;
    }
    if (millis() - start >= timeoutMs) return false;
    delay(3);  // 让出 CPU，也让 IMU 能用总线
  }
}

bool PN532::readAck(uint16_t timeoutMs) {
  if (!waitReady(timeoutMs)) return false;
  uint8_t b[7];
  {
    bus::Lock lk;
    if (Wire.requestFrom((int)ADDR, 7) != 7) return false;
    for (int i = 0; i < 7; i++) b[i] = Wire.read();
  }
  return memcmp(&b[1], ACK_FRAME, 6) == 0;  // b[0] 是状态字节
}

// 返回数据长度（不含 TFI 和响应码）；-1 = 超时，-2 = 帧错误
int PN532::readResponse(uint8_t cmd, uint8_t* out, uint8_t maxLen, uint16_t timeoutMs) {
  if (!waitReady(timeoutMs)) return -1;
  uint8_t b[RESP_MAX + 1];
  int got;
  {
    bus::Lock lk;
    got = Wire.requestFrom((int)ADDR, (int)sizeof(b));
    for (int i = 0; i < got; i++) b[i] = Wire.read();
  }
  // b[0] 状态字节，然后是 00 00 FF LEN LCS TFI CMD+1 DATA... DCS 00
  int p = 1;
  while (p + 1 < got && !(b[p] == 0x00 && b[p + 1] == 0xFF)) p++;
  p += 2;
  if (p + 2 >= got) return -2;
  uint8_t L = b[p], LCS = b[p + 1];
  if ((uint8_t)(L + LCS) != 0 || L < 2) return -2;
  if (p + 2 + L + 1 > got) return -2;
  const uint8_t* body = &b[p + 2];
  if (body[0] != PN_TFI || body[1] != (uint8_t)(cmd + 1)) return -2;
  uint8_t sum = 0;
  for (int i = 0; i < L; i++) sum += body[i];
  if ((uint8_t)(sum + body[L]) != 0) return -2;
  int n = L - 2;
  if (n > maxLen) n = maxLen;
  memcpy(out, &body[2], n);
  return n;
}

int PN532::command(const uint8_t* cmd, uint8_t len, uint8_t* out, uint8_t maxLen, uint16_t timeoutMs) {
  if (!writeCommand(cmd, len)) return -2;
  if (!readAck(50)) return -2;
  return readResponse(cmd[0], out, maxLen, timeoutMs);
}
