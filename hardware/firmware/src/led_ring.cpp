#include <Adafruit_NeoPixel.h>
#include <math.h>

#include "config.h"
#include "peripherals.h"

namespace led {
namespace {
Adafruit_NeoPixel strip(LED_COUNT, PIN_LED_DATA, NEO_GRB + NEO_KHZ800);

struct Layer {
  Effect effect = OFF;
  uint32_t rgb = 0;
  uint32_t startMs = 0;
  uint32_t untilMs = 0;  // 仅叠加层使用
};
Layer base, ovl;
bool ovlActive = false;
bool powerOn = false;
uint8_t maxBright = LED_DEFAULT_MAX_BRIGHTNESS;
uint32_t lastFrame = 0;

void setPower(bool on) {
  if (PIN_LED_PWR < 0) {
    powerOn = on;
    return;
  }
  if (powerOn == on) return;
  if (on) {
    digitalWrite(PIN_LED_PWR, LED_PWR_ACTIVE_HIGH ? HIGH : LOW);
    delay(2);  // 等待高边 PMOS 与灯珠内部逻辑上电稳定
    powerOn = true;
  } else {
    // 断电前先拉低数据线，防止 GPIO 通过保护二极管向灯珠反灌供电
    pinMode(PIN_LED_DATA, OUTPUT);
    digitalWrite(PIN_LED_DATA, LOW);
    digitalWrite(PIN_LED_PWR, LED_PWR_ACTIVE_HIGH ? LOW : HIGH);
    powerOn = false;
  }
}

inline uint32_t scale(uint32_t rgb, uint8_t k) {
  uint8_t r = ((rgb >> 16) & 0xFF) * k / 255;
  uint8_t g = ((rgb >> 8) & 0xFF) * k / 255;
  uint8_t b = (rgb & 0xFF) * k / 255;
  return Adafruit_NeoPixel::Color(r, g, b);
}

void render(const Layer& l, uint32_t now) {
  uint32_t t = now - l.startMs;
  switch (l.effect) {
    case OFF:
      strip.clear();
      break;
    case SOLID:
      strip.fill(scale(l.rgb, 255));
      break;
    case BREATHE: {
      float p = (sinf(t * 2.0f * PI / 2000.0f) + 1.0f) * 0.5f;  // 2 秒周期
      strip.fill(scale(l.rgb, (uint8_t)(30 + p * 225)));
      break;
    }
    case BLINK:
      strip.fill(((t / 400) % 2) ? 0 : scale(l.rgb, 255));
      break;
    case FLASH:
      strip.fill(((t / 80) % 2) ? 0 : scale(l.rgb, 255));
      break;
    case SPIN: {
      int head = (t / (1000 / LED_COUNT)) % LED_COUNT;  // 1 秒一圈
      strip.clear();
      for (int i = 0; i < 4; i++) {
        int idx = (head - i + LED_COUNT) % LED_COUNT;
        strip.setPixelColor(idx, scale(l.rgb, 255 >> (i * 2)));
      }
      break;
    }
    case RAINBOW:
      for (int i = 0; i < LED_COUNT; i++) {
        uint16_t hue = (uint16_t)(t * 65) + i * (65536 / LED_COUNT);
        strip.setPixelColor(i, strip.gamma32(strip.ColorHSV(hue)));
      }
      break;
    default:
      strip.clear();
  }
}
}  // namespace

void begin() {
  if (PIN_LED_PWR >= 0) {
    pinMode(PIN_LED_PWR, OUTPUT);
    digitalWrite(PIN_LED_PWR, LED_PWR_ACTIVE_HIGH ? LOW : HIGH);
  }
  setPower(true);
  strip.begin();
  strip.setBrightness(maxBright);
  strip.clear();
  strip.show();
}

void setMaxBrightness(uint8_t b) {
  maxBright = b;
  strip.setBrightness(b);
}
uint8_t maxBrightness() { return maxBright; }

void setBase(Effect e, uint32_t rgb) {
  if (base.effect == e && base.rgb == rgb) return;
  base.effect = e;
  base.rgb = rgb;
  base.startMs = millis();
}

void overlay(Effect e, uint32_t rgb, uint16_t ms) {
  ovl.effect = e;
  ovl.rgb = rgb;
  ovl.startMs = millis();
  ovl.untilMs = ovl.startMs + ms;
  ovlActive = true;
}

void off() {
  base.effect = OFF;
  ovlActive = false;
  if (powerOn) {
    strip.clear();
    strip.show();
  }
  setPower(false);
}

void update() {
  uint32_t now = millis();
  if (now - lastFrame < 20) return;  // 50 fps
  lastFrame = now;
  if (ovlActive && (int32_t)(now - ovl.untilMs) >= 0) ovlActive = false;
  const Layer& active = ovlActive ? ovl : base;
  if (active.effect == OFF) {
    if (powerOn) {
      strip.clear();
      strip.show();
      setPower(false);
    }
    return;
  }
  if (!powerOn) setPower(true);
  render(active, now);
  strip.show();
}
}  // namespace led
