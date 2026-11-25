// 振动马达 + 蜂鸣器：非阻塞图案播放
#include "config.h"
#include "peripherals.h"
#include "protocol.h"

// ================= 振动 =================
namespace haptic {
namespace {
// 交替 开/关 毫秒数，以 0 结尾
const uint16_t P_TICK[]      = {40, 0};
const uint16_t P_DOUBLE[]    = {60, 80, 60, 0};
const uint16_t P_CAUGHT[]    = {700, 0};
const uint16_t P_RESCUED[]   = {80, 80, 120, 80, 250, 0};
const uint16_t P_HEARTBEAT[] = {60, 120, 90, 0};
const uint16_t P_COUNTDOWN[] = {30, 0};
const uint16_t P_ITEM[]      = {50, 50, 50, 50, 150, 0};
const uint16_t P_ERROR[]     = {200, 100, 200, 0};
const uint16_t P_CATCH_OK[]  = {100, 60, 300, 0};
const uint16_t P_START[]     = {300, 150, 300, 150, 600, 0};
const uint16_t* const PATTERNS[PAT_COUNT] = {
    P_TICK, P_DOUBLE, P_CAUGHT, P_RESCUED, P_HEARTBEAT,
    P_COUNTDOWN, P_ITEM, P_ERROR, P_CATCH_OK, P_START};

const uint16_t* cur = nullptr;
uint8_t step = 0;
uint32_t stepStart = 0;

void apply() { digitalWrite(PIN_MOTOR, (step % 2 == 0) ? HIGH : LOW); }
}  // namespace

void begin() {
  pinMode(PIN_MOTOR, OUTPUT);
  digitalWrite(PIN_MOTOR, LOW);
}

void play(uint8_t pattern) {
  if (pattern >= PAT_COUNT) return;
  cur = PATTERNS[pattern];
  step = 0;
  stepStart = millis();
  apply();
}

void stop() {
  cur = nullptr;
  digitalWrite(PIN_MOTOR, LOW);
}

void update() {
  if (!cur) return;
  if (millis() - stepStart < cur[step]) return;
  step++;
  stepStart = millis();
  if (cur[step] == 0) {
    stop();
    return;
  }
  apply();
}
}  // namespace haptic

// ================= 蜂鸣器 =================
namespace buzzer {
namespace {
constexpr uint8_t LEDC_CH = 0;
struct Note { uint16_t freq; uint16_t ms; };  // freq=0 为休止，ms=0 为结束

const Note B_TICK[]      = {{2700, 30}, {0, 0}};
const Note B_DOUBLE[]    = {{2700, 40}, {0, 60}, {2700, 40}, {0, 0}};
const Note B_CAUGHT[]    = {{880, 150}, {660, 150}, {440, 400}, {0, 0}};
const Note B_RESCUED[]   = {{1047, 100}, {1319, 100}, {1568, 250}, {0, 0}};
const Note B_HEARTBEAT[] = {{200, 60}, {0, 100}, {200, 80}, {0, 0}};
const Note B_COUNTDOWN[] = {{1800, 40}, {0, 0}};
const Note B_ITEM[]      = {{1568, 60}, {2093, 120}, {0, 0}};
const Note B_ERROR[]     = {{300, 250}, {0, 0}};
const Note B_CATCH_OK[]  = {{1319, 80}, {1760, 80}, {2637, 200}, {0, 0}};
const Note B_START[]     = {{1047, 200}, {0, 100}, {1047, 200}, {0, 100}, {2093, 500}, {0, 0}};
const Note* const PATTERNS[PAT_COUNT] = {
    B_TICK, B_DOUBLE, B_CAUGHT, B_RESCUED, B_HEARTBEAT,
    B_COUNTDOWN, B_ITEM, B_ERROR, B_CATCH_OK, B_START};

const Note* cur = nullptr;
uint8_t step = 0;
uint32_t stepStart = 0;

void apply() { ledcWriteTone(LEDC_CH, cur[step].freq); }
}  // namespace

void begin() {
  ledcSetup(LEDC_CH, 2000, 10);
  ledcAttachPin(PIN_BUZZER, LEDC_CH);
  ledcWriteTone(LEDC_CH, 0);
}

void play(uint8_t pattern) {
  if (pattern >= PAT_COUNT) return;
  cur = PATTERNS[pattern];
  step = 0;
  stepStart = millis();
  apply();
}

void stop() {
  cur = nullptr;
  ledcWriteTone(LEDC_CH, 0);
}

void update() {
  if (!cur) return;
  if (millis() - stepStart < cur[step].ms) return;
  step++;
  stepStart = millis();
  if (cur[step].ms == 0) {
    stop();
    return;
  }
  apply();
}
}  // namespace buzzer

// ================= 按键 =================
namespace button {
namespace {
bool stable = false;  // true = 按下
bool lastRaw = false;
uint32_t lastChange = 0;
uint32_t pressStart = 0;
bool longFired = false;
bool powerFired = false;
uint8_t pendingShorts = 0;
uint32_t lastRelease = 0;
}  // namespace

void begin() { pinMode(PIN_BUTTON, INPUT_PULLUP); }

uint8_t update() {
  uint32_t now = millis();
  bool raw = digitalRead(PIN_BUTTON) == LOW;
  if (raw != lastRaw) {
    lastRaw = raw;
    lastChange = now;
  }
  if (now - lastChange >= BUTTON_DEBOUNCE_MS && raw != stable) {
    stable = raw;
    if (stable) {  // 按下
      pressStart = now;
      longFired = powerFired = false;
    } else {  // 松开
      if (!longFired) {
        pendingShorts++;
        lastRelease = now;
      }
    }
  }

  if (stable) {
    uint32_t held = now - pressStart;
    if (!powerFired && held >= BUTTON_POWER_OFF_MS) {
      powerFired = true;
      return BTN_POWER;
    }
    if (!longFired && held >= BUTTON_LONG_MS) {
      longFired = true;
      pendingShorts = 0;
      return BTN_LONG;
    }
  }

  if (pendingShorts >= 2) {
    pendingShorts = 0;
    return BTN_DOUBLE;
  }
  if (pendingShorts == 1 && !stable && now - lastRelease > BUTTON_DOUBLE_GAP_MS) {
    pendingShorts = 0;
    return BTN_SHORT;
  }
  return BTN_NONE;
}
}  // namespace button

// ================= 电池 =================
namespace battery {
void begin() {
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_BATT_ADC, ADC_11db);
}

uint16_t readMv() {
  uint32_t sum = 0;
  for (int i = 0; i < 8; i++) sum += analogReadMilliVolts(PIN_BATT_ADC);
  return (uint16_t)((sum / 8) * BATT_DIVIDER);
}

uint8_t percent(uint16_t mv) {
  // 锂聚合物简化放电曲线
  static const uint16_t V[] = {3300, 3500, 3600, 3700, 3750, 3800, 3900, 4000, 4100, 4180};
  static const uint8_t P[]  = {0,    5,    10,   25,   40,   55,   70,   82,   93,   100};
  if (mv <= V[0]) return 0;
  for (int i = 1; i < 10; i++) {
    if (mv < V[i]) return P[i - 1] + (uint32_t)(mv - V[i - 1]) * (P[i] - P[i - 1]) / (V[i] - V[i - 1]);
  }
  return 100;
}
}  // namespace battery
