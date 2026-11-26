#include <Arduino.h>
#include <Preferences.h>
#if __has_include(<esp_mac.h>)
#include <esp_mac.h>
#else
#include <esp_system.h>
#endif
#include <esp_sleep.h>
#include <driver/gpio.h>

#include "ble_service.h"
#include "bus.h"
#include "config.h"
#include "imu.h"
#include "nfc_manager.h"
#include "peripherals.h"
#include "protocol.h"

namespace {
Preferences prefs;
QueueHandle_t evtQ = nullptr;
QueueHandle_t cmdQ = nullptr;

uint8_t bandId[6] = {0};
uint8_t curRole = ROLE_LOBBY;
uint8_t curTeam = 0;
uint32_t curSession = 0;
bool standaloneMode = true;
bool lastBleConnected = false;

uint8_t evtSeq = 0;
uint32_t lastImpactMs = 0;
bool hasImpact = false;
uint32_t lastBattMs = 0;
uint32_t lastJailedListenMs = 0;
uint16_t curBattMv = 3800;
uint8_t curBattPct = 55;
uint8_t lowBattStreak = 0;
bool lowBattWarned = false;
String serialBuf;
String bindUrlBuf;
String activeBindUrl;

void applyRoleLed() {
  switch (curRole) {
    case ROLE_LOBBY:
      if (ble::connected()) {
        led::setBase(led::BREATHE, 0x00C8FF);  // 青色呼吸：已连手机待开局
      } else {
        led::setBase(led::BLINK, 0x404040);    // 白色慢闪：等待连接
      }
      break;
    case ROLE_CAT:
      led::setBase(led::SPIN, 0xFF1000);       // 红色旋转：猫
      break;
    case ROLE_MOUSE:
      led::setBase(led::BREATHE, 0x00FF30);    // 绿色呼吸：自由的鼠
      break;
    case ROLE_JAILED:
      led::setBase(led::BLINK, 0x0050FF);      // 蓝色闪烁：被抓进牢房
      break;
    case ROLE_OUT:
    default:
      led::setBase(led::SOLID, 0x200030);      // 紫色微光：出局/观战
      break;
  }
}

void syncBleInfo() {
  ble::InfoSnapshot snap{};
  memcpy(snap.bandId, bandId, 6);
  snap.fwMajor = FW_VERSION_MAJOR;
  snap.fwMinor = FW_VERSION_MINOR;
  snap.role = curRole;
  snap.team = curTeam;
  snap.session = curSession;
  snap.battMv = curBattMv;
  snap.battPct = curBattPct;
  snap.hwFlags = (imu::ok() ? 0x01 : 0x00) | (nfc::ok() ? 0x02 : 0x00);
  ble::updateInfo(snap);
}

void sendEventRaw(uint8_t* payload, uint8_t len) {
  if (len < 2) return;
  payload[1] = evtSeq++;
  ble::notify(payload, len);
}

void sendAck(uint8_t opcode, uint8_t result) {
  uint8_t e[4] = {EVT_ACK, 0, opcode, result};
  sendEventRaw(e, sizeof(e));
}

void sendBootEvent() {
  uint8_t e[5] = {EVT_BOOT, 0, FW_VERSION_MAJOR, FW_VERSION_MINOR, curRole};
  sendEventRaw(e, sizeof(e));
}

void sendBatteryEvent() {
  uint8_t e[5];
  e[0] = EVT_BATTERY;
  e[1] = 0;
  memcpy(&e[2], &curBattMv, 2);
  e[4] = curBattPct;
  sendEventRaw(e, sizeof(e));
}

void sendLowBatteryEvent(uint8_t critical) {
  uint8_t e[6];
  e[0] = EVT_LOW_BATTERY;
  e[1] = 0;
  memcpy(&e[2], &curBattMv, 2);
  e[4] = curBattPct;
  e[5] = critical;
  sendEventRaw(e, sizeof(e));
}

void changeRole(uint8_t newRole, uint8_t newTeam, RoleReason reason) {
  if (newRole >= ROLE_COUNT) return;
  bool changed = (curRole != newRole) || (curTeam != newTeam);
  curRole = newRole;
  curTeam = newTeam;
  nfc::setIdentity(curRole, curTeam, curSession);
  applyRoleLed();
  syncBleInfo();

  if (changed || reason != REASON_CMD) {
    uint8_t e[5] = {EVT_ROLE_CHANGED, 0, curRole, curTeam, (uint8_t)reason};
    sendEventRaw(e, sizeof(e));
  }
}

void enterDeepSleep() {
  Serial.println("[PWR] Entering deep sleep...");
  uint8_t ack[4] = {EVT_ACK, 0, CMD_POWER_OFF, ACK_OK};
  sendEventRaw(ack, sizeof(ack));

  nfc::sleep();
  imu::prepareSleep();
  haptic::play(PAT_TICK);
  delay(80);
  haptic::stop();
  buzzer::stop();
  led::off();

  // 等待按键松开，避免一睡就醒
  uint32_t t0 = millis();
  while (digitalRead(PIN_BUTTON) == LOW && millis() - t0 < 2000) {
    delay(10);
  }

  // ESP32-C3 支持 GPIO0~5 深度睡眠唤醒：按键低电平唤醒 (PIN_BUTTON = GPIO4)
  esp_deep_sleep_enable_gpio_wakeup(1ULL << PIN_BUTTON, ESP_GPIO_WAKEUP_GPIO_LOW);
  esp_deep_sleep_start();
}

// 脱机或本地即时反馈逻辑：当未连手机且开启 standaloneMode 时，本地直接执行猫抓鼠/解救规则
void handleNfcPeerLocal(const uint8_t* ev) {
  // ev: [0]=EVT_NFC_PEER, [1]=seq, [2]=dir, [3..8]=peerId, [9]=peerRole, [10]=peerTeam, [11..14]=peerSession, [15]=flags
  uint8_t peerRole = ev[9];
  uint32_t peerSession = 0;
  memcpy(&peerSession, &ev[11], 4);

  // 如果设置了非0场次且不一致，忽略本地规则
  if (curSession != 0 && peerSession != 0 && curSession != peerSession) {
    haptic::play(PAT_ERROR);
    buzzer::play(PAT_ERROR);
    return;
  }

  // 先给碰触成功的基础触觉反馈（连着手机时最终裁决由服务器下发，但先给轻触确认手感）
  if (ble::connected() && !standaloneMode) {
    haptic::play(PAT_TICK);
    buzzer::play(PAT_TICK);
    led::overlay(led::FLASH, 0xFFFFFF, 250);
    return;
  }

  if (!ble::connected() && standaloneMode) {
    // 本地猫鼠规则：
    // 1. 我是猫，对方是自由鼠 -> 抓捕成功反馈
    if (curRole == ROLE_CAT && peerRole == ROLE_MOUSE) {
      haptic::play(PAT_CATCH_OK);
      buzzer::play(PAT_CATCH_OK);
      led::overlay(led::FLASH, 0xFF8000, 600);
      return;
    }
    // 2. 我是自由鼠，对方是猫 -> 我被抓进牢房
    if (curRole == ROLE_MOUSE && peerRole == ROLE_CAT) {
      haptic::play(PAT_CAUGHT);
      buzzer::play(PAT_CAUGHT);
      led::overlay(led::FLASH, 0xFF0000, 600);
      changeRole(ROLE_JAILED, curTeam, REASON_LOCAL_RULE);
      return;
    }
    // 3. 我是自由鼠，对方是被抓的鼠 -> 解救成功反馈
    if (curRole == ROLE_MOUSE && peerRole == ROLE_JAILED) {
      haptic::play(PAT_RESCUED);
      buzzer::play(PAT_RESCUED);
      led::overlay(led::FLASH, 0x00FFFF, 500);
      return;
    }
    // 4. 我是被抓的鼠，对方是自由鼠 -> 我被解救恢复自由鼠
    if (curRole == ROLE_JAILED && peerRole == ROLE_MOUSE) {
      haptic::play(PAT_RESCUED);
      buzzer::play(PAT_RESCUED);
      led::overlay(led::FLASH, 0x00FF60, 600);
      changeRole(ROLE_MOUSE, curTeam, REASON_LOCAL_RULE);
      return;
    }
  }

  // 连着手机时给一次轻快碰触反馈，等服务器下发正式角色/特效指令
  haptic::play(PAT_TICK);
  buzzer::play(PAT_TICK);
  led::overlay(led::FLASH, 0xFFFFFF, 250);
}

void handleCmd(const BandCmd& cmd) {
  if (cmd.len < 1) return;
  uint8_t op = cmd.d[0];
  switch (op) {
    case CMD_SET_ROLE: {
      if (cmd.len < 3 || cmd.d[1] >= ROLE_COUNT) {
        sendAck(op, ACK_BAD_ARGS);
        return;
      }
      changeRole(cmd.d[1], cmd.d[2], REASON_CMD);
      sendAck(op, ACK_OK);
      break;
    }
    case CMD_SET_SESSION: {
      if (cmd.len < 5) {
        sendAck(op, ACK_BAD_ARGS);
        return;
      }
      memcpy(&curSession, &cmd.d[1], 4);
      nfc::setIdentity(curRole, curTeam, curSession);
      syncBleInfo();
      sendAck(op, ACK_OK);
      break;
    }
    case CMD_LED: {
      if (cmd.len < 7 || cmd.d[1] >= led::EFFECT_COUNT) {
        sendAck(op, ACK_BAD_ARGS);
        return;
      }
      uint32_t rgb = ((uint32_t)cmd.d[2] << 16) | ((uint32_t)cmd.d[3] << 8) | cmd.d[4];
      uint16_t dur = 0;
      memcpy(&dur, &cmd.d[5], 2);
      if (dur == 0) {
        led::setBase((led::Effect)cmd.d[1], rgb);
      } else {
        led::overlay((led::Effect)cmd.d[1], rgb, dur);
      }
      sendAck(op, ACK_OK);
      break;
    }
    case CMD_HAPTIC: {
      if (cmd.len < 2 || cmd.d[1] >= PAT_COUNT) {
        sendAck(op, ACK_BAD_ARGS);
        return;
      }
      haptic::play(cmd.d[1]);
      sendAck(op, ACK_OK);
      break;
    }
    case CMD_BUZZER: {
      if (cmd.len < 2 || cmd.d[1] >= PAT_COUNT) {
        sendAck(op, ACK_BAD_ARGS);
        return;
      }
      buzzer::play(cmd.d[1]);
      sendAck(op, ACK_OK);
      break;
    }
    case CMD_NFC_WINDOW: {
      if (cmd.len < 4 || cmd.d[1] > nfc::MODE_LISTEN) {
        sendAck(op, ACK_BAD_ARGS);
        return;
      }
      uint16_t dur = 0;
      memcpy(&dur, &cmd.d[2], 2);
      if (dur == 0) dur = NFC_WINDOW_MS;
      nfc::requestWindow((nfc::Mode)cmd.d[1], dur);
      sendAck(op, ACK_OK);
      break;
    }
    case CMD_IMU_THRESHOLD: {
      if (cmd.len < 3) {
        sendAck(op, ACK_BAD_ARGS);
        return;
      }
      uint16_t mg = 0;
      memcpy(&mg, &cmd.d[1], 2);
      if (mg < 250 || mg > 8000) {
        sendAck(op, ACK_BAD_ARGS);
        return;
      }
      imu::setThreshold(mg);
      prefs.putUShort("imu_ths", mg);
      sendAck(op, ACK_OK);
      break;
    }
    case CMD_IDENTIFY: {
      led::overlay(led::RAINBOW, 0, 2500);
      haptic::play(PAT_START);
      buzzer::play(PAT_START);
      sendAck(op, ACK_OK);
      break;
    }
    case CMD_BIND_URL_BEGIN: {
      bindUrlBuf = "";
      for (uint8_t i = 1; i < cmd.len; i++) bindUrlBuf += (char)cmd.d[i];
      sendAck(op, ACK_OK);
      break;
    }
    case CMD_BIND_URL_APPEND: {
      if (bindUrlBuf.length() + (cmd.len - 1) > 96) {
        sendAck(op, ACK_BAD_ARGS);
        return;
      }
      for (uint8_t i = 1; i < cmd.len; i++) bindUrlBuf += (char)cmd.d[i];
      sendAck(op, ACK_OK);
      break;
    }
    case CMD_BIND_URL_COMMIT: {
      if (bindUrlBuf.length() < 8) {
        sendAck(op, ACK_BAD_ARGS);
        return;
      }
      activeBindUrl = bindUrlBuf;
      prefs.putString("bind_url", activeBindUrl);
      nfc::setBindUrl(activeBindUrl);
      sendAck(op, ACK_OK);
      break;
    }
    case CMD_POWER_OFF: {
      enterDeepSleep();
      break;
    }
    case CMD_BRIGHTNESS: {
      if (cmd.len < 2) {
        sendAck(op, ACK_BAD_ARGS);
        return;
      }
      led::setMaxBrightness(cmd.d[1]);
      prefs.putUChar("led_max", cmd.d[1]);
      sendAck(op, ACK_OK);
      break;
    }
    case CMD_STANDALONE: {
      if (cmd.len < 2) {
        sendAck(op, ACK_BAD_ARGS);
        return;
      }
      standaloneMode = (cmd.d[1] != 0);
      prefs.putBool("standalone", standaloneMode);
      sendAck(op, ACK_OK);
      break;
    }
    default:
      sendAck(op, ACK_UNKNOWN);
      break;
  }
}

void handleButton(uint8_t kind) {
  if (kind == BTN_NONE) return;

  if (kind == BTN_POWER) {
    enterDeepSleep();
    return;
  }

  // 上报按键事件（短按/双击/长按）
  uint8_t e[3] = {EVT_BUTTON, 0, kind};
  sendEventRaw(e, sizeof(e));

  if (kind == BTN_SHORT) {
    // 短按：主动打开一次 NFC 交互窗口（捡道具/抓捕/解救）
    haptic::play(PAT_TICK);
    if (curRole != ROLE_OUT) {
      led::overlay(led::FLASH, 0xFFFFFF, 160);
      nfc::requestWindow(nfc::MODE_AUTO, NFC_WINDOW_MS);
    }
  } else if (kind == BTN_DOUBLE) {
    haptic::play(PAT_DOUBLE);
    // 脱机且开启 standaloneMode 时，双击循环切换角色（LOBBY -> CAT -> MOUSE -> JAILED），方便无手机现场实测！
    if (!ble::connected() && standaloneMode) {
      uint8_t next = (curRole + 1) % 4;
      changeRole(next, curTeam, REASON_BUTTON);
      buzzer::play(PAT_TICK);
    }
  } else if (kind == BTN_LONG) {
    // 大厅状态下长按：进入 30 秒手机 NFC 碰一碰绑定窗口
    if (curRole == ROLE_LOBBY) {
      haptic::play(PAT_ITEM);
      buzzer::play(PAT_ITEM);
      led::overlay(led::BREATHE, 0xFFD000, NFC_BIND_WINDOW_MS);
      nfc::requestWindow(nfc::MODE_LISTEN, NFC_BIND_WINDOW_MS);
    } else {
      haptic::play(PAT_TICK);
    }
  }
}

void checkBatteryLvp() {
  // 排除裸板未焊分压电阻的 ADC 悬空低值
  if (curBattMv < BATT_PRESENT_MIN_MV) {
    lowBattStreak = 0;
    return;
  }
  if (curBattMv <= BATT_CRITICAL_MV) {
    lowBattStreak++;
    sendLowBatteryEvent(1);
    led::overlay(led::FLASH, 0xFF0000, 1000);
    haptic::play(PAT_ERROR);
    buzzer::play(PAT_ERROR);
    if (lowBattStreak >= 3) {
      Serial.printf("[PWR] Critical battery %u mV -> auto sleep\n", curBattMv);
      enterDeepSleep();
    }
  } else if (curBattMv <= BATT_LOW_MV) {
    lowBattStreak = 0;
    if (!lowBattWarned) {
      lowBattWarned = true;
      sendLowBatteryEvent(0);
      led::overlay(led::FLASH, 0xFF2000, 600);
      haptic::play(PAT_DOUBLE);
    }
  } else {
    lowBattStreak = 0;
    lowBattWarned = false;
  }
}

void runFactorySelfTest() {
  Serial.println("=== FACTORY SELF-TEST START ===");
  bool imuOk = imu::ok();
  bool nfcOk = nfc::ok();
  uint16_t mv = battery::readMv();
  uint8_t pct = battery::percent(mv);
  bool battOk = (mv >= 3000 && mv <= 4350) || (mv < BATT_PRESENT_MIN_MV);
  Serial.printf("[TEST] ID:   %02X%02X%02X%02X%02X%02X\n",
                bandId[0], bandId[1], bandId[2], bandId[3], bandId[4], bandId[5]);
  Serial.printf("[TEST] URL:  %s%02X%02X%02X%02X%02X%02X\n",
                activeBindUrl.c_str(),
                bandId[0], bandId[1], bandId[2], bandId[3], bandId[4], bandId[5]);
  Serial.printf("[TEST] IMU:  %s (ths=%u mg)\n", imuOk ? "PASS" : "FAIL", imu::threshold());
  Serial.printf("[TEST] NFC:  %s\n", nfcOk ? "PASS" : "FAIL");
  Serial.printf("[TEST] BATT: %u mV (%u%%) -> %s\n", mv, pct, battOk ? "PASS" : "WARN");
  led::overlay(led::RAINBOW, 0, 1200);
  haptic::play(PAT_START);
  buzzer::play(PAT_START);
  Serial.printf("=== FACTORY SELF-TEST RESULT: %s ===\n", (imuOk && nfcOk && battOk) ? "PASS" : "FAIL");
}

void handleSerialLine(String line) {
  line.trim();
  if (line.length() == 0) return;
  line.toUpperCase();
  if (line == "HELP") {
    Serial.println("Commands: INFO | TEST | ROLE <0-4> | NFC | LED <0-6> | VIB <0-9> | BUZZ <0-9> | RECOVER | SLEEP");
  } else if (line == "INFO") {
    Serial.printf("[INFO] fw=%d.%d id=%02X%02X%02X%02X%02X%02X role=%u team=%u session=%lu batt=%umV(%u%%) ble=%u imu=%u nfc=%u standalone=%u\n",
                  FW_VERSION_MAJOR, FW_VERSION_MINOR,
                  bandId[0], bandId[1], bandId[2], bandId[3], bandId[4], bandId[5],
                  curRole, curTeam, (unsigned long)curSession, curBattMv, curBattPct,
                  ble::connected() ? 1 : 0, imu::ok() ? 1 : 0, nfc::ok() ? 1 : 0, standaloneMode ? 1 : 0);
  } else if (line == "TEST") {
    runFactorySelfTest();
  } else if (line.startsWith("ROLE ")) {
    int r = line.substring(5).toInt();
    if (r >= 0 && r < ROLE_COUNT) {
      changeRole((uint8_t)r, curTeam, REASON_CMD);
      Serial.printf("[CLI] role=%d\n", r);
    }
  } else if (line == "NFC") {
    nfc::requestWindow(nfc::MODE_AUTO, 3000);
    Serial.println("[CLI] NFC window 3000ms opened");
  } else if (line.startsWith("LED ")) {
    int e = line.substring(4).toInt();
    if (e >= 0 && e < led::EFFECT_COUNT) led::overlay((led::Effect)e, 0x00FF80, 1500);
  } else if (line.startsWith("VIB ")) {
    haptic::play((uint8_t)line.substring(4).toInt());
  } else if (line.startsWith("BUZZ ")) {
    buzzer::play((uint8_t)line.substring(5).toInt());
  } else if (line == "RECOVER") {
    bus::recover();
    Serial.println("[CLI] I2C bus recovered");
  } else if (line == "SLEEP") {
    enterDeepSleep();
  } else {
    Serial.printf("[CLI] Unknown command: %s (type HELP)\n", line.c_str());
  }
}

void pollSerialCli() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\r' || c == '\n') {
      if (serialBuf.length() > 0) {
        handleSerialLine(serialBuf);
        serialBuf = "";
      }
    } else if (serialBuf.length() < 64) {
      serialBuf += c;
    }
  }
}
}  // namespace

void setup() {
  Serial.begin(115200);
  delay(100);

  esp_read_mac(bandId, ESP_MAC_BT);
  Serial.printf("\n=== CatMouse Band V%d.%d [%02X:%02X:%02X:%02X:%02X:%02X] ===\n",
                FW_VERSION_MAJOR, FW_VERSION_MINOR,
                bandId[0], bandId[1], bandId[2], bandId[3], bandId[4], bandId[5]);

  prefs.begin("cmband", false);
  uint8_t savedBright = prefs.getUChar("led_max", LED_DEFAULT_MAX_BRIGHTNESS);
  uint16_t savedImuThs = prefs.getUShort("imu_ths", IMU_DEFAULT_THRESHOLD_MG);
  standaloneMode = prefs.getBool("standalone", true);
  activeBindUrl = prefs.getString("bind_url", DEFAULT_BIND_URL);

  evtQ = xQueueCreate(16, sizeof(BandEvent));
  cmdQ = xQueueCreate(8, sizeof(BandCmd));

  led::begin();
  led::setMaxBrightness(savedBright);
  haptic::begin();
  buzzer::begin();
  button::begin();
  battery::begin();
  bus::begin();

  bool imuOk = imu::begin();
  if (imuOk) imu::setThreshold(savedImuThs);
  Serial.printf("[HW] IMU LIS2DH12: %s (ths=%u mg)\n", imuOk ? "OK" : "MISSING", savedImuThs);

  bool nfcOk = nfc::begin(bandId, evtQ);
  nfc::setBindUrl(activeBindUrl);
  nfc::setIdentity(curRole, curTeam, curSession);
  Serial.printf("[HW] NFC PN532:    %s\n", nfcOk ? "OK" : "MISSING");

  curBattMv = battery::readMv();
  curBattPct = battery::percent(curBattMv);
  lastBattMs = millis();

  ble::begin(bandId, cmdQ);
  applyRoleLed();
  syncBleInfo();

  // 开机自检灯效 + 轻振
  led::overlay(led::RAINBOW, 0, 800);
  haptic::play(PAT_TICK);
  buzzer::play(PAT_TICK);
}

void loop() {
  uint32_t now = millis();

  // 1. BLE 连接状态变化与首次订阅 BOOT 事件
  bool conn = ble::connected();
  if (conn != lastBleConnected) {
    lastBleConnected = conn;
    if (curRole == ROLE_LOBBY) applyRoleLed();
    haptic::play(PAT_TICK);
  }
  if (ble::takeJustSubscribed()) {
    sendBootEvent();
    sendBatteryEvent();
  }

  // 2. 处理手机 BLE 指令
  BandCmd cmd;
  while (xQueueReceive(cmdQ, &cmd, 0) == pdTRUE) {
    handleCmd(cmd);
  }

  // 3. 按键扫描
  handleButton(button::update());

  // 4. IMU 碰撞检测 -> 自动触发 NFC 窗口
  uint16_t peakMg = 0;
  if (imu::poll(peakMg) && (!hasImpact || (now - lastImpactMs >= IMPACT_COOLDOWN_MS))) {
    hasImpact = true;
    lastImpactMs = now;
    uint8_t e[4];
    e[0] = EVT_IMPACT;
    e[1] = 0;
    memcpy(&e[2], &peakMg, 2);
    sendEventRaw(e, sizeof(e));

    if (curRole != ROLE_OUT) {
      haptic::play(PAT_TICK);
      nfc::requestWindow(nfc::MODE_AUTO, NFC_WINDOW_MS);
    }
  }

  // 4.5 被抓的鼠（ROLE_JAILED）原地等待队友解救：周期自动开启被动 Listen 窗（不开射频场，约12mA）
  // 监听 900ms / 间隔 1100ms（休眠间隙仅 200ms < 自由鼠 300ms Poll 时隙），数学上 100% 必然命中！
  if (curRole == ROLE_JAILED && !nfc::busy() && (now - lastJailedListenMs >= 1100)) {
    lastJailedListenMs = now;
    nfc::requestWindow(nfc::MODE_LISTEN, 900);
  }

  // 5. 处理 NFC 任务上报的事件
  BandEvent nev;
  while (xQueueReceive(evtQ, &nev, 0) == pdTRUE) {
    if (nev.len >= 2) {
      uint8_t type = nev.d[0];
      if (type == EVT_NFC_PEER && nev.len >= 16) {
        handleNfcPeerLocal(nev.d);
      } else if (type == EVT_NFC_ITEM) {
        haptic::play(PAT_ITEM);
        buzzer::play(PAT_ITEM);
        led::overlay(led::FLASH, 0xFFE000, 450);
      } else if (type == EVT_NFC_BIND_READ) {
        haptic::play(PAT_START);
        buzzer::play(PAT_ITEM);
        led::overlay(led::SOLID, 0x00FF80, 800);
      }
      sendEventRaw(nev.d, nev.len);
    }
  }

  // 6. 定时采样电量、欠压保护并更新广播包
  if (now - lastBattMs >= BATTERY_REPORT_MS) {
    lastBattMs = now;
    curBattMv = battery::readMv();
    curBattPct = battery::percent(curBattMv);
    syncBleInfo();
    sendBatteryEvent();
    checkBatteryLvp();
  }

  // 7. 串口产测自检 CLI
  pollSerialCli();

  // 8. 非阻塞更新灯环、振动、蜂鸣器动画
  led::update();
  haptic::update();
  buzzer::update();

  delay(2);
}
