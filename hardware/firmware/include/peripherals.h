#pragma once
#include <Arduino.h>

// ---------------- 灯环 ----------------
namespace led {
enum Effect : uint8_t { OFF = 0, SOLID, BREATHE, BLINK, SPIN, FLASH, RAINBOW, EFFECT_COUNT };
void begin();
void setMaxBrightness(uint8_t b);
uint8_t maxBrightness();
void setBase(Effect e, uint32_t rgb);              // 常驻灯效
void overlay(Effect e, uint32_t rgb, uint16_t ms); // 临时叠加，结束后回到常驻灯效
void off();                                        // 立即全灭（关机用）
void update();
}  // namespace led

// ---------------- 振动 ----------------
namespace haptic {
void begin();
void play(uint8_t pattern);
void stop();
void update();
}  // namespace haptic

// ---------------- 蜂鸣器 ----------------
namespace buzzer {
void begin();
void play(uint8_t pattern);
void stop();
void update();
}  // namespace buzzer

// ---------------- 按键 ----------------
namespace button {
void begin();
uint8_t update();  // 返回 ButtonKind
}  // namespace button

// ---------------- 电池 ----------------
namespace battery {
void begin();
uint16_t readMv();
uint8_t percent(uint16_t mv);
}  // namespace battery
