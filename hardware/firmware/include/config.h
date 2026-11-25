#pragma once
#include <Arduino.h>

// ---------------- 版本 ----------------
#define FW_VERSION_MAJOR 1
#define FW_VERSION_MINOR 5

// ---------------- 引脚（XIAO ESP32C3） ----------------
constexpr int PIN_BATT_ADC = 2;   // D0  电池分压 2x200k
constexpr int PIN_IMU_INT  = 3;   // D1  LIS2DH12 INT1（可深睡唤醒）
constexpr int PIN_BUTTON   = 4;   // D2  按键 -> GND（可深睡唤醒）
constexpr int PIN_MOTOR    = 5;   // D3  AO3400 栅极
constexpr int PIN_SDA      = 6;   // D4
constexpr int PIN_SCL      = 7;   // D5
constexpr int PIN_LED_DATA = 21;  // D6  WS2812B DIN
constexpr int PIN_BUZZER   = 20;  // D7  无源蜂鸣器
constexpr int PIN_NFC_RST  = 10;  // D10 PN532 RSTPDN，没接线设为 -1

constexpr uint32_t I2C_FREQ = 100000;  // 杜邦线原型用 100k 更稳；PCB 可改 400k

// ---------------- 灯环 ----------------
constexpr int     LED_COUNT                  = 12;
constexpr uint8_t LED_DEFAULT_MAX_BRIGHTNESS = 100;  // 0~255，约 40%

// ---------------- 碰撞 ----------------
constexpr uint16_t IMU_DEFAULT_THRESHOLD_MG = 2000;
constexpr uint32_t IMPACT_COOLDOWN_MS       = 800;

// ---------------- NFC ----------------
constexpr uint16_t NFC_WINDOW_MS            = 1500;   // 碰撞/短按后打开的窗口
constexpr uint16_t NFC_BIND_WINDOW_MS       = 30000;  // 大厅长按：手机绑定窗口
constexpr uint16_t NFC_MOUSE_LISTEN_SLOT_MS = 600;
constexpr uint16_t NFC_MOUSE_POLL_SLOT_MS   = 300;
constexpr uint32_t NFC_PEER_COOLDOWN_MS     = 3000;   // 同一对象 3 秒内不重复上报
#define DEFAULT_BIND_URL "https://example.com/b?id="

// ---------------- 按键 ----------------
constexpr uint32_t BUTTON_DEBOUNCE_MS   = 25;
constexpr uint32_t BUTTON_LONG_MS       = 1200;
constexpr uint32_t BUTTON_POWER_OFF_MS  = 4000;
constexpr uint32_t BUTTON_DOUBLE_GAP_MS = 350;

// ---------------- 电池 ----------------
constexpr uint32_t BATTERY_REPORT_MS = 30000;
constexpr float    BATT_DIVIDER      = 2.0f;

// ---------------- BLE ----------------
#define BLE_SVC_UUID   "7a3e0001-5c1d-4b8e-9a2f-6c4d1e0b9a10"
#define BLE_CMD_UUID   "7a3e0002-5c1d-4b8e-9a2f-6c4d1e0b9a10"
#define BLE_EVENT_UUID "7a3e0003-5c1d-4b8e-9a2f-6c4d1e0b9a10"
#define BLE_INFO_UUID  "7a3e0004-5c1d-4b8e-9a2f-6c4d1e0b9a10"
constexpr uint16_t BLE_MTU = 185;
