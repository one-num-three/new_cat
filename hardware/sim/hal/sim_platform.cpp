// 猫鼠手环 V1.5 真实 C++ 固件在环（Firmware-in-the-Loop）虚拟硬件芯片平台
// 直接链接 firmware/src/*.cpp 全部 8 个真实固件源文件，无需修改业务代码。

#include "Arduino.h"
#include "Wire.h"
#include "Adafruit_NeoPixel.h"
#include "NimBLEDevice.h"
#include "esp_mac.h"
#include "esp_sleep.h"

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <deque>
#include <iostream>
#include <mutex>
#include <sstream>
#include <thread>
#include <vector>

// 固件入口（定义在 firmware/src/main.cpp）
extern void setup();
extern void loop();

namespace {
using Clock = std::chrono::steady_clock;
const Clock::time_point gBootTime = Clock::now();

std::mutex gOutMtx;
void emitLine(const std::string& tag, const std::string& body = "") {
  std::lock_guard<std::mutex> lk(gOutMtx);
  if (body.empty()) {
    std::cout << "@@" << tag << "\n" << std::flush;
  } else {
    std::cout << "@@" << tag << " " << body << "\n" << std::flush;
  }
}

std::string toHex(const uint8_t* data, size_t len) {
  static const char* H = "0123456789ABCDEF";
  std::string out;
  out.reserve(len * 2);
  for (size_t i = 0; i < len; i++) {
    out.push_back(H[data[i] >> 4]);
    out.push_back(H[data[i] & 0x0F]);
  }
  return out;
}

std::vector<uint8_t> fromHex(const std::string& s) {
  std::vector<uint8_t> out;
  auto val = [](char c) -> int {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
  };
  for (size_t i = 0; i + 1 < s.size(); i += 2) {
    int a = val(s[i]), b = val(s[i + 1]);
    if (a >= 0 && b >= 0) out.push_back((uint8_t)((a << 4) | b));
  }
  return out;
}

// ---------------- 虚拟 MCU 全局状态 ----------------
uint8_t gMac[6] = {0xA0, 0xB1, 0xC2, 0xD3, 0xE4, 0x01};
std::atomic<bool> gRunning{true};
std::atomic<uint32_t> gBattMv{3950};
std::atomic<int> gI2cFaults{0};

std::mutex gGpioMtx;
int gPinState[48] = {0};
int gPinMode[48] = {0};
void (*gIrqHandler[48])() = {nullptr};
int gIrqMode[48] = {0};
int gLastMotor = 0;
double gLastBuzzFreq = 0.0;
uint64_t gWakeMask = 0;
int gWakeMode = 0;
int gSclPulseCount = 0;

// 串口输入队列
std::mutex gSerialMtx;
std::deque<char> gSerialRx;
std::string gSerialLineAcc;

// 实时能耗累加器（mA * ms）
std::mutex gPwrMtx;
uint32_t gLastPwrMs = 0;
double gTotalMah = 0.0;
double gCurLedMa = 0.0;
bool gCurRfOn = false;
bool gCurMotorOn = false;
bool gCurBuzzOn = false;

void updatePowerAcc() {
  std::lock_guard<std::mutex> lk(gPwrMtx);
  uint32_t now = millis();
  if (now > gLastPwrMs) {
    uint32_t dt = now - gLastPwrMs;
    gLastPwrMs = now;
    // ESP32-C3 BLE 常连约 18mA + 灯环 + PN532 射频场(65mA) + 马达(70mA) + 蜂鸣器(25mA)
    double ma = 18.0 + gCurLedMa + (gCurRfOn ? 65.0 : 0.0) + (gCurMotorOn ? 70.0 : 0.0) + (gCurBuzzOn ? 25.0 : 0.0);
    gTotalMah += (ma * (double)dt) / 3600000.0;
  }
}

void setPinInternal(int pin, int val) {
  if (pin < 0 || pin >= 48) return;
  void (*cb)() = nullptr;
  {
    std::lock_guard<std::mutex> lk(gGpioMtx);
    int prev = gPinState[pin];
    gPinState[pin] = val;
    if (gIrqHandler[pin]) {
      if ((gIrqMode[pin] == RISING && prev == LOW && val == HIGH) ||
          (gIrqMode[pin] == FALLING && prev == HIGH && val == LOW) ||
          (gIrqMode[pin] == CHANGE && prev != val)) {
        cb = gIrqHandler[pin];
      }
    }
  }
  if (cb) cb();
}

// ---------------- 虚拟 LIS2DH12 (I2C 0x19) ----------------
struct VirtualLis2dh12 {
  std::mutex mtx;
  uint8_t regs[64] = {0};
  uint8_t curReg = 0;
  bool autoInc = false;

  VirtualLis2dh12() {
    regs[0x0F] = 0x33;  // WHO_AM_I
  }

  void write(const std::vector<uint8_t>& d) {
    std::lock_guard<std::mutex> lk(mtx);
    if (d.empty()) return;
    autoInc = (d[0] & 0x80) != 0;
    curReg = d[0] & 0x3F;
    for (size_t i = 1; i < d.size(); i++) {
      uint8_t r = autoInc ? (uint8_t)((curReg + i - 1) & 0x3F) : curReg;
      regs[r] = d[i];
      if (r == 0x20) {
        char buf[16];
        std::snprintf(buf, sizeof(buf), "%02X", d[i]);
        emitLine("IMU_CTRL1", buf);
      }
    }
  }

  std::vector<uint8_t> read(int len) {
    std::vector<uint8_t> out(len, 0);
    bool dropInt = false;
    {
      std::lock_guard<std::mutex> lk(mtx);
      for (int i = 0; i < len; i++) {
        uint8_t r = autoInc ? (uint8_t)((curReg + i) & 0x3F) : curReg;
        out[i] = regs[r];
        if (r == 0x39) {  // REG_CLICK_SRC 读取自动清除锁存中断
          regs[0x39] = 0x00;
          dropInt = true;
        }
      }
    }
    if (dropInt) setPinInternal(3, LOW);  // PIN_IMU_INT = GPIO3
    return out;
  }

  void injectImpact(uint16_t mg) {
    bool trigger = false;
    {
      std::lock_guard<std::mutex> lk(mtx);
      uint8_t thsLsb = regs[0x3A] & 0x7F;
      uint16_t thsMg = (uint16_t)(thsLsb * 62);
      // 填入 12-bit 左对齐 X 轴加速度（±8g: 4 mg/LSB）
      int16_t counts = (int16_t)(mg / 4);
      if (counts > 2047) counts = 2047;
      uint16_t raw = (uint16_t)(counts << 4);
      regs[0x28] = (uint8_t)(raw & 0xFF);
      regs[0x29] = (uint8_t)((raw >> 8) & 0xFF);
      regs[0x2A] = regs[0x2B] = regs[0x2C] = regs[0x2D] = 0;
      if ((regs[0x20] & 0xF0) != 0 && mg >= thsMg) {
        regs[0x39] = 0x51;  // IA | SClick | X
        trigger = true;
      }
    }
    if (trigger) setPinInternal(3, HIGH);  // 触发 PIN_IMU_INT 上升沿 ISR
  }
} gImu;

// ---------------- 虚拟 PN532 (I2C 0x24) ----------------
struct VirtualPn532 {
  std::mutex mtx;
  std::condition_variable cv;

  bool asleep = false;
  bool rfOn = false;
  bool waitingTarget = false;
  bool pendingAck = false;
  std::vector<uint8_t> pendingResp;  // 不含首字节 0x01 RDY
  bool hasResp = false;

  // 外部射频事件队列（由总控器通过 stdin 注入）
  enum class RfEventKind { NONE, POLL_FOUND, POLL_NONE, XCHG_RESP, XCHG_FAIL, TG_ACTIVATE, TG_APDU, TG_RELEASE };
  struct RfEvent {
    RfEventKind kind = RfEventKind::NONE;
    uint8_t sak = 0;
    std::vector<uint8_t> data;
  };
  std::deque<RfEvent> rfInbox;
  bool activePoll = false;
  bool activeXchg = false;
  bool activeTgGet = false;

  static std::vector<uint8_t> buildFrame(uint8_t cmdCode, const std::vector<uint8_t>& payload) {
    std::vector<uint8_t> body;
    body.push_back(0xD5);
    body.push_back((uint8_t)(cmdCode + 1));
    body.insert(body.end(), payload.begin(), payload.end());
    uint8_t L = (uint8_t)body.size();
    uint8_t lcs = (uint8_t)(~L + 1);
    uint8_t sum = 0;
    for (uint8_t b : body) sum += b;
    uint8_t dcs = (uint8_t)(~sum + 1);
    std::vector<uint8_t> f = {0x00, 0x00, 0xFF, L, lcs};
    f.insert(f.end(), body.begin(), body.end());
    f.push_back(dcs);
    f.push_back(0x00);
    return f;
  }

  void pushRfEvent(RfEvent ev) {
    std::lock_guard<std::mutex> lk(mtx);
    if (ev.kind == RfEventKind::POLL_FOUND && activePoll) {
      activePoll = false;
      // NbTg=1, Tg=1, SENS_RES=00 04, SEL_RES=sak, NFCIDLen, NFCID...
      std::vector<uint8_t> p = {0x01, 0x01, 0x00, 0x04, ev.sak, (uint8_t)ev.data.size()};
      p.insert(p.end(), ev.data.begin(), ev.data.end());
      pendingResp = buildFrame(0x4A, p);
      hasResp = true;
      return;
    }
    if (ev.kind == RfEventKind::POLL_NONE && activePoll) {
      activePoll = false;
      pendingResp = buildFrame(0x4A, {0x00});
      hasResp = true;
      return;
    }
    if (ev.kind == RfEventKind::XCHG_RESP && activeXchg) {
      activeXchg = false;
      std::vector<uint8_t> p = {0x00};  // Status OK
      p.insert(p.end(), ev.data.begin(), ev.data.end());
      pendingResp = buildFrame(0x40, p);
      hasResp = true;
      return;
    }
    if (ev.kind == RfEventKind::XCHG_FAIL && activeXchg) {
      activeXchg = false;
      pendingResp = buildFrame(0x40, {0x01});  // Timeout/Error
      hasResp = true;
      return;
    }
    if (ev.kind == RfEventKind::TG_ACTIVATE && waitingTarget) {
      waitingTarget = false;
      std::vector<uint8_t> p = {0x04};  // Mode: ISO14443-4 PICC 106kbps
      p.insert(p.end(), ev.data.begin(), ev.data.end());  // 首条 InitiatorCommand APDU!
      pendingResp = buildFrame(0x8C, p);
      hasResp = true;
      return;
    }
    if (ev.kind == RfEventKind::TG_APDU && activeTgGet) {
      activeTgGet = false;
      std::vector<uint8_t> p = {0x00};
      p.insert(p.end(), ev.data.begin(), ev.data.end());
      pendingResp = buildFrame(0x86, p);
      hasResp = true;
      return;
    }
    if (ev.kind == RfEventKind::TG_RELEASE && activeTgGet) {
      activeTgGet = false;
      pendingResp = buildFrame(0x86, {0x29});  // Initiator released
      hasResp = true;
      return;
    }
    // 如果固件尚未发到对应命令，先暂存入收件箱（防止竞争条件丢失！）
    rfInbox.push_back(std::move(ev));
  }

  void tryConsumeInboxLocked() {
    for (auto it = rfInbox.begin(); it != rfInbox.end(); ++it) {
      if (activePoll && (it->kind == RfEventKind::POLL_FOUND || it->kind == RfEventKind::POLL_NONE)) {
        RfEvent ev = std::move(*it);
        rfInbox.erase(it);
        activePoll = false;
        if (ev.kind == RfEventKind::POLL_FOUND) {
          std::vector<uint8_t> p = {0x01, 0x01, 0x00, 0x04, ev.sak, (uint8_t)ev.data.size()};
          p.insert(p.end(), ev.data.begin(), ev.data.end());
          pendingResp = buildFrame(0x4A, p);
        } else {
          pendingResp = buildFrame(0x4A, {0x00});
        }
        hasResp = true;
        return;
      }
      if (activeXchg && (it->kind == RfEventKind::XCHG_RESP || it->kind == RfEventKind::XCHG_FAIL)) {
        RfEvent ev = std::move(*it);
        rfInbox.erase(it);
        activeXchg = false;
        if (ev.kind == RfEventKind::XCHG_RESP) {
          std::vector<uint8_t> p = {0x00};
          p.insert(p.end(), ev.data.begin(), ev.data.end());
          pendingResp = buildFrame(0x40, p);
        } else {
          pendingResp = buildFrame(0x40, {0x01});
        }
        hasResp = true;
        return;
      }
      if (waitingTarget && it->kind == RfEventKind::TG_ACTIVATE) {
        RfEvent ev = std::move(*it);
        rfInbox.erase(it);
        waitingTarget = false;
        std::vector<uint8_t> p = {0x04};
        p.insert(p.end(), ev.data.begin(), ev.data.end());
        pendingResp = buildFrame(0x8C, p);
        hasResp = true;
        return;
      }
      if (activeTgGet && (it->kind == RfEventKind::TG_APDU || it->kind == RfEventKind::TG_RELEASE)) {
        RfEvent ev = std::move(*it);
        rfInbox.erase(it);
        activeTgGet = false;
        if (ev.kind == RfEventKind::TG_APDU) {
          std::vector<uint8_t> p = {0x00};
          p.insert(p.end(), ev.data.begin(), ev.data.end());
          pendingResp = buildFrame(0x86, p);
        } else {
          pendingResp = buildFrame(0x86, {0x29});
        }
        hasResp = true;
        return;
      }
    }
  }

  uint8_t write(const std::vector<uint8_t>& f) {
    std::lock_guard<std::mutex> lk(mtx);
    // 唤醒脉冲（1 字节 0x00）
    if (f.size() == 1 && f[0] == 0x00) {
      asleep = false;
      emitLine("NFC_PD", "0");
      return 0;
    }
    // 主机发 ACK 帧中止当前命令
    static const uint8_t ACK6[6] = {0x00, 0x00, 0xFF, 0x00, 0xFF, 0x00};
    if (f.size() == 6 && std::memcmp(f.data(), ACK6, 6) == 0) {
      if (waitingTarget) {
        waitingTarget = false;
        emitLine("NFC_TG_ABORT");
      }
      activePoll = activeXchg = activeTgGet = false;
      pendingAck = false;
      hasResp = false;
      return 0;
    }
    // 解析标准 PN532 帧: 00 00 FF LEN LCS D4 CMD ... DCS 00
    if (f.size() < 9 || f[0] != 0x00 || f[1] != 0x00 || f[2] != 0xFF) return 4;
    uint8_t L = f[3], LCS = f[4];
    if ((uint8_t)(L + LCS) != 0 || L < 2 || 5 + L + 2 > f.size()) return 4;
    if (f[5] != 0xD4) return 4;
    uint8_t sum = 0;
    for (int i = 0; i < L; i++) sum += f[5 + i];
    if ((uint8_t)(sum + f[5 + L]) != 0) return 4;

    asleep = false;
    uint8_t cmd = f[6];
    const uint8_t* args = &f[7];
    size_t argLen = L - 2;

    pendingAck = true;
    hasResp = false;
    activePoll = activeXchg = activeTgGet = false;

    switch (cmd) {
      case 0x02:  // GetFirmwareVersion
        pendingResp = buildFrame(0x02, {0x32, 0x01, 0x06, 0x07});
        hasResp = true;
        break;
      case 0x14:  // SAMConfiguration
        pendingResp = buildFrame(0x14, {});
        hasResp = true;
        break;
      case 0x16:  // PowerDown
        asleep = true;
        rfOn = false;
        {
          std::lock_guard<std::mutex> plk(gPwrMtx);
          gCurRfOn = false;
        }
        emitLine("NFC_PD", "1");
        pendingResp = buildFrame(0x16, {0x00});
        hasResp = true;
        break;
      case 0x32:  // RFConfiguration
        if (argLen >= 2 && args[0] == 0x01) {
          rfOn = (args[1] & 0x01) != 0;
          updatePowerAcc();
          {
            std::lock_guard<std::mutex> plk(gPwrMtx);
            gCurRfOn = rfOn;
          }
          emitLine("NFC_RF", rfOn ? "1" : "0");
        }
        pendingResp = buildFrame(0x32, {});
        hasResp = true;
        break;
      case 0x4A:  // InListPassiveTarget
        activePoll = true;
        tryConsumeInboxLocked();
        if (activePoll) emitLine("NFC_POLL_REQ");
        break;
      case 0x40:  // InDataExchange (args[0] = Tg)
        activeXchg = true;
        tryConsumeInboxLocked();
        if (activeXchg && argLen >= 1) {
          emitLine("NFC_XCHG_REQ", toHex(args + 1, argLen - 1));
        }
        break;
      case 0x52:  // InRelease
        emitLine("NFC_RELEASE");
        pendingResp = buildFrame(0x52, {0x00});
        hasResp = true;
        break;
      case 0x8C:  // TgInitAsTarget
        waitingTarget = true;
        tryConsumeInboxLocked();
        if (waitingTarget) emitLine("NFC_TG_WAIT");
        break;
      case 0x86:  // TgGetData
        activeTgGet = true;
        tryConsumeInboxLocked();
        break;
      case 0x8E:  // TgSetData
        emitLine("NFC_TG_RESP", toHex(args, argLen));
        pendingResp = buildFrame(0x8E, {0x00});
        hasResp = true;
        break;
      default:
        pendingResp = buildFrame(cmd, {});
        hasResp = true;
        break;
    }
    return 0;
  }

  std::vector<uint8_t> read(int len) {
    std::lock_guard<std::mutex> lk(mtx);
    if (len == 1) {
      // 状态轮询字节：bit0 = RDY
      uint8_t rdy = (pendingAck || hasResp) ? 0x01 : 0x00;
      return {rdy};
    }
    if (pendingAck && len == 7) {
      pendingAck = false;
      return {0x01, 0x00, 0x00, 0xFF, 0x00, 0xFF, 0x00};
    }
    std::vector<uint8_t> out(len, 0x00);
    if (hasResp) {
      hasResp = false;
      out[0] = 0x01;
      size_t n = std::min((size_t)(len - 1), pendingResp.size());
      std::memcpy(&out[1], pendingResp.data(), n);
    }
    return out;
  }
} gPn532;

// ---------------- 虚拟 BLE 全局对象 ----------------
NimBLEServer* gBleServer = nullptr;
NimBLEAdvertising gBleAdv;
NimBLECharacteristic* gBleCmdChr = nullptr;
NimBLECharacteristic* gBleEvtChr = nullptr;
NimBLECharacteristic* gBleInfoChr = nullptr;

// ---------------- stdin 控制线程 ----------------
void stdinThreadFn() {
  std::string line;
  while (gRunning.load() && std::getline(std::cin, line)) {
    while (!line.empty() && (line.back() == '\r' || line.back() == '\n')) line.pop_back();
    if (line.empty()) continue;
    std::istringstream iss(line);
    std::string cmd;
    iss >> cmd;
    if (cmd == "BTN") {
      int pressed = 0;
      iss >> pressed;
      // PIN_BUTTON = GPIO4，低电平按下
      setPinInternal(4, pressed ? LOW : HIGH);
    } else if (cmd == "IMPACT") {
      int mg = 2500;
      iss >> mg;
      gImu.injectImpact((uint16_t)mg);
    } else if (cmd == "BATT") {
      uint32_t mv = 3900;
      iss >> mv;
      gBattMv.store(mv);
    } else if (cmd == "I2C_FAULT") {
      int n = 1;
      iss >> n;
      gI2cFaults.store(n);
    } else if (cmd == "BLE_CONN") {
      int c = 0;
      iss >> c;
      ble_gap_conn_desc desc{};
      if (gBleServer && gBleServer->callbacks()) {
        if (c) {
          gBleServer->callbacks()->onConnect(gBleServer, &desc);
          if (gBleEvtChr && gBleEvtChr->callbacks()) {
            gBleEvtChr->callbacks()->onSubscribe(gBleEvtChr, &desc, 1);
          }
        } else {
          gBleServer->callbacks()->onDisconnect(gBleServer, &desc);
        }
      }
    } else if (cmd == "BLE_CMD") {
      std::string hex;
      iss >> hex;
      auto bytes = fromHex(hex);
      if (gBleCmdChr && gBleCmdChr->callbacks() && !bytes.empty()) {
        ble_gap_conn_desc desc{};
        gBleCmdChr->setValue(bytes.data(), bytes.size());
        gBleCmdChr->callbacks()->onWrite(gBleCmdChr, &desc);
      }
    } else if (cmd == "SERIAL") {
      std::string rest;
      std::getline(iss, rest);
      if (!rest.empty() && rest[0] == ' ') rest.erase(0, 1);
      std::lock_guard<std::mutex> lk(gSerialMtx);
      for (char ch : rest) gSerialRx.push_back(ch);
      gSerialRx.push_back('\n');
    } else if (cmd == "NFC_POLL_FOUND") {
      std::string sakH, uidH;
      iss >> sakH >> uidH;
      VirtualPn532::RfEvent ev;
      ev.kind = VirtualPn532::RfEventKind::POLL_FOUND;
      auto sb = fromHex(sakH);
      ev.sak = sb.empty() ? 0 : sb[0];
      ev.data = fromHex(uidH);
      gPn532.pushRfEvent(std::move(ev));
    } else if (cmd == "NFC_POLL_NONE") {
      VirtualPn532::RfEvent ev;
      ev.kind = VirtualPn532::RfEventKind::POLL_NONE;
      gPn532.pushRfEvent(std::move(ev));
    } else if (cmd == "NFC_XCHG_RESP") {
      std::string hex;
      iss >> hex;
      VirtualPn532::RfEvent ev;
      ev.kind = VirtualPn532::RfEventKind::XCHG_RESP;
      ev.data = fromHex(hex);
      gPn532.pushRfEvent(std::move(ev));
    } else if (cmd == "NFC_XCHG_FAIL") {
      VirtualPn532::RfEvent ev;
      ev.kind = VirtualPn532::RfEventKind::XCHG_FAIL;
      gPn532.pushRfEvent(std::move(ev));
    } else if (cmd == "NFC_TG_ACTIVATE") {
      std::string hex;
      iss >> hex;
      VirtualPn532::RfEvent ev;
      ev.kind = VirtualPn532::RfEventKind::TG_ACTIVATE;
      ev.data = fromHex(hex);
      gPn532.pushRfEvent(std::move(ev));
    } else if (cmd == "NFC_TG_APDU") {
      std::string hex;
      iss >> hex;
      VirtualPn532::RfEvent ev;
      ev.kind = VirtualPn532::RfEventKind::TG_APDU;
      ev.data = fromHex(hex);
      gPn532.pushRfEvent(std::move(ev));
    } else if (cmd == "NFC_TG_RELEASE") {
      VirtualPn532::RfEvent ev;
      ev.kind = VirtualPn532::RfEventKind::TG_RELEASE;
      gPn532.pushRfEvent(std::move(ev));
    } else if (cmd == "STATS") {
      updatePowerAcc();
      char buf[128];
      std::snprintf(buf, sizeof(buf), "ms=%u mah=%.5f led_ma=%.1f",
                    millis(), gTotalMah, gCurLedMa);
      emitLine("STATS", buf);
    } else if (cmd == "QUIT") {
      gRunning.store(false);
      break;
    }
  }
  gRunning.store(false);
}
}  // namespace

// ---------------- Arduino API 实现 ----------------
SimSerial Serial;
TwoWire Wire;

void SimSerial::begin(unsigned long) {}
int SimSerial::available() {
  std::lock_guard<std::mutex> lk(gSerialMtx);
  return (int)gSerialRx.size();
}
int SimSerial::read() {
  std::lock_guard<std::mutex> lk(gSerialMtx);
  if (gSerialRx.empty()) return -1;
  char c = gSerialRx.front();
  gSerialRx.pop_front();
  return (unsigned char)c;
}
void SimSerial::println(const char* s) { emitLine("SERIAL", s ? s : ""); }
void SimSerial::printf(const char* fmt, ...) {
  char buf[512];
  va_list ap;
  va_start(ap, fmt);
  std::vsnprintf(buf, sizeof(buf), fmt, ap);
  va_end(ap);
  std::string str(buf);
  for (char c : str) {
    if (c == '\n') {
      if (!gSerialLineAcc.empty()) {
        emitLine("SERIAL", gSerialLineAcc);
        gSerialLineAcc.clear();
      }
    } else if (c != '\r') {
      gSerialLineAcc.push_back(c);
    }
  }
}

uint32_t millis() {
  return (uint32_t)std::chrono::duration_cast<std::chrono::milliseconds>(Clock::now() - gBootTime).count();
}
void delay(uint32_t ms) { std::this_thread::sleep_for(std::chrono::milliseconds(ms)); }
void delayMicroseconds(uint32_t us) {
  if (us > 0) std::this_thread::sleep_for(std::chrono::microseconds(us));
}

void pinMode(int pin, int mode) {
  if (pin < 0 || pin >= 48) return;
  std::lock_guard<std::mutex> lk(gGpioMtx);
  gPinMode[pin] = mode;
  if (mode == INPUT_PULLUP) gPinState[pin] = HIGH;
}

void digitalWrite(int pin, int val) {
  if (pin == 7 && val == HIGH) {  // PIN_SCL = GPIO7: 检测 bus::recover() 9-clock 脉冲
    gSclPulseCount++;
    if (gSclPulseCount == 9) {
      gI2cFaults.store(0);  // 9-clock 恢复清除总线锁死！
      emitLine("I2C_RECOVER");
    }
  }
  setPinInternal(pin, val);
  if (pin == 5) {  // PIN_MOTOR = GPIO5
    int m = val ? 1 : 0;
    if (m != gLastMotor) {
      gLastMotor = m;
      updatePowerAcc();
      {
        std::lock_guard<std::mutex> plk(gPwrMtx);
        gCurMotorOn = (m != 0);
      }
      emitLine("MOTOR", m ? "1" : "0");
    }
  }
}

int digitalRead(int pin) {
  if (pin < 0 || pin >= 48) return LOW;
  std::lock_guard<std::mutex> lk(gGpioMtx);
  return gPinState[pin];
}

int digitalPinToInterrupt(int pin) { return pin; }
void attachInterrupt(int irq, void (*fn)(), int mode) {
  if (irq < 0 || irq >= 48) return;
  std::lock_guard<std::mutex> lk(gGpioMtx);
  gIrqHandler[irq] = fn;
  gIrqMode[irq] = mode;
}

void analogReadResolution(int) {}
void analogSetPinAttenuation(int, int) {}
uint32_t analogReadMilliVolts(int) { return gBattMv.load() / 2; }

void ledcSetup(uint8_t, double, uint8_t) {}
void ledcAttachPin(int, uint8_t) {}
void ledcWriteTone(uint8_t, double freq) {
  if (freq != gLastBuzzFreq) {
    gLastBuzzFreq = freq;
    updatePowerAcc();
    {
      std::lock_guard<std::mutex> plk(gPwrMtx);
      gCurBuzzOn = (freq > 0.0);
    }
    char buf[32];
    std::snprintf(buf, sizeof(buf), "%.0f", freq);
    emitLine("BUZZ", buf);
  }
}

// ---------------- TwoWire 实现 ----------------
bool TwoWire::begin(int, int, uint32_t) {
  gSclPulseCount = 0;
  return true;
}
void TwoWire::end() { gSclPulseCount = 0; }
void TwoWire::setTimeOut(uint16_t) {}
void TwoWire::beginTransmission(uint8_t addr) {
  txAddr_ = addr;
  txBuf_.clear();
}
size_t TwoWire::write(uint8_t b) {
  txBuf_.push_back(b);
  return 1;
}
size_t TwoWire::write(const uint8_t* data, size_t len) {
  txBuf_.insert(txBuf_.end(), data, data + len);
  return len;
}
uint8_t TwoWire::endTransmission(bool) {
  if (gI2cFaults.load() > 0) {
    gI2cFaults.fetch_sub(1);
    return 5;  // Timeout / bus stuck
  }
  if (txAddr_ == 0x19) {
    gImu.write(txBuf_);
    return 0;
  }
  if (txAddr_ == 0x24) {
    return gPn532.write(txBuf_);
  }
  return 2;  // NACK
}
int TwoWire::requestFrom(int addr, int len) {
  rxPos_ = 0;
  rxBuf_.clear();
  if (gI2cFaults.load() > 0) {
    gI2cFaults.fetch_sub(1);
    return 0;
  }
  if (addr == 0x19) {
    rxBuf_ = gImu.read(len);
    return (int)rxBuf_.size();
  }
  if (addr == 0x24) {
    rxBuf_ = gPn532.read(len);
    return (int)rxBuf_.size();
  }
  return 0;
}
int TwoWire::read() {
  if (rxPos_ >= rxBuf_.size()) return -1;
  return rxBuf_[rxPos_++];
}

// ---------------- NeoPixel 回调 ----------------
namespace sim_hw {
static uint32_t gLastLedSig = 0xFFFFFFFFu;
void onLedShow(const std::vector<uint32_t>& pixels, uint8_t brightness) {
  // 估算 12 颗 WS2812B 实际电流：每通道满亮 20mA，关灯静态 0.8mA/颗
  double ma = 0.0;
  uint32_t firstNonZero = 0;
  for (uint32_t c : pixels) {
    if (c != 0 && firstNonZero == 0) firstNonZero = c;
    double r = ((c >> 16) & 0xFF) * (brightness / 255.0) / 255.0;
    double g = ((c >> 8) & 0xFF) * (brightness / 255.0) / 255.0;
    double b = (c & 0xFF) * (brightness / 255.0) / 255.0;
    ma += 0.8 + (r + g + b) * 20.0;
  }
  updatePowerAcc();
  {
    std::lock_guard<std::mutex> plk(gPwrMtx);
    gCurLedMa = ma;
  }
  // 避免 50fps 刷屏，仅在主色调/亮度状态变化显著时上报
  uint32_t sig = ((uint32_t)brightness << 24) ^ (firstNonZero & 0x00F0F0F0u);
  if (sig != gLastLedSig) {
    gLastLedSig = sig;
    char buf[64];
    std::snprintf(buf, sizeof(buf), "%u %06X %.1f", brightness, firstNonZero, ma);
    emitLine("LED", buf);
  }
}
}  // namespace sim_hw

// ---------------- NimBLE 实现 ----------------
bool NimBLECharacteristic::notify() {
  emitLine("BLE_EVT", toHex(val_.data(), val_.size()));
  return true;
}

NimBLECharacteristic* NimBLEService::createCharacteristic(const char* uuid, uint32_t props) {
  auto* c = new NimBLECharacteristic(uuid, props);
  chrs_.push_back(c);
  if (props & NIMBLE_PROPERTY::WRITE) gBleCmdChr = c;
  else if (props & NIMBLE_PROPERTY::NOTIFY) gBleEvtChr = c;
  else if (props & NIMBLE_PROPERTY::READ) gBleInfoChr = c;
  return c;
}

void NimBLEAdvertising::start() {
  active_ = true;
  std::string mfgHex = toHex((const uint8_t*)advData_.mfg_.data(), advData_.mfg_.size());
  emitLine("BLE_ADV", std::string(advType_ == BLE_GAP_CONN_MODE_NON ? "NON " : "UND ") + advData_.name_ + " " + mfgHex);
}

NimBLEService* NimBLEServer::createService(const char* uuid) {
  auto* s = new NimBLEService(uuid);
  svcs_.push_back(s);
  return s;
}

void NimBLEDevice::init(const char*) {}
void NimBLEDevice::setMTU(uint16_t) {}
void NimBLEDevice::setPower(int) {}
NimBLEServer* NimBLEDevice::createServer() {
  if (!gBleServer) gBleServer = new NimBLEServer();
  return gBleServer;
}
NimBLEAdvertising* NimBLEDevice::getAdvertising() { return &gBleAdv; }
void NimBLEDevice::startAdvertising() { gBleAdv.start(); }

// ---------------- ESP32 MAC & DeepSleep ----------------
int esp_read_mac(uint8_t* mac, esp_mac_type_t) {
  std::memcpy(mac, gMac, 6);
  return 0;
}

int esp_deep_sleep_enable_gpio_wakeup(uint64_t gpio_pin_mask, esp_deepsleep_gpio_wake_up_mode_t mode) {
  gWakeMask = gpio_pin_mask;
  gWakeMode = (int)mode;
  return 0;
}

void esp_deep_sleep_start() {
  updatePowerAcc();
  char buf[128];
  std::snprintf(buf, sizeof(buf), "mask=0x%llX mode=%d mah=%.5f",
                (unsigned long long)gWakeMask, gWakeMode, gTotalMah);
  emitLine("SLEEP", buf);
  gRunning.store(false);
  std::exit(0);
}

// ---------------- 主进程入口 ----------------
int main(int argc, char** argv) {
  // 可选参数：12位十六进制 MAC（例如 A0B1C2D3E401）
  if (argc >= 2) {
    auto m = fromHex(argv[1]);
    if (m.size() == 6) std::memcpy(gMac, m.data(), 6);
  }
  std::thread inThread(stdinThreadFn);
  inThread.detach();

  setup();
  emitLine("READY", toHex(gMac, 6));

  while (gRunning.load()) {
    loop();
  }
  return 0;
}
