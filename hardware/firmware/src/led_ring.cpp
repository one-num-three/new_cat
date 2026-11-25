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
uint8_t maxBright = LED_DEFAULT_MAX_BRIGHTNESS;
uint32_t lastFrame = 0;

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
  strip.clear();
  strip.show();
}

void update() {
  uint32_t now = millis();
  if (now - lastFrame < 20) return;  // 50 fps
  lastFrame = now;
  if (ovlActive && (int32_t)(now - ovl.untilMs) >= 0) ovlActive = false;
  render(ovlActive ? ovl : base, now);
  strip.show();
}
}  // namespace led
