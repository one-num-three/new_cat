#pragma once
#include <cstdint>
#include <vector>

#define NEO_GRB    0x00
#define NEO_KHZ800 0x00

namespace sim_hw {
void onLedShow(const std::vector<uint32_t>& pixels, uint8_t brightness);
}

class Adafruit_NeoPixel {
 public:
  Adafruit_NeoPixel(uint16_t n, int pin, uint16_t type) : px_(n, 0) { (void)pin; (void)type; }
  void begin() {}
  void setBrightness(uint8_t b) { bright_ = b; }
  void clear() { std::fill(px_.begin(), px_.end(), 0); }
  void fill(uint32_t c) { std::fill(px_.begin(), px_.end(), c); }
  void setPixelColor(uint16_t i, uint32_t c) {
    if (i < px_.size()) px_[i] = c;
  }
  void show() { sim_hw::onLedShow(px_, bright_); }

  static uint32_t Color(uint8_t r, uint8_t g, uint8_t b) {
    return ((uint32_t)r << 16) | ((uint32_t)g << 8) | b;
  }
  uint32_t ColorHSV(uint16_t hue, uint8_t sat = 255, uint8_t val = 255) const {
    (void)sat;
    uint8_t region = (uint8_t)((hue >> 13) & 0x07);
    uint8_t r = (region == 0 || region == 5 || region == 6 || region == 7) ? val : 0;
    uint8_t g = (region == 1 || region == 2 || region == 3) ? val : 0;
    uint8_t b = (region == 3 || region == 4 || region == 5) ? val : 0;
    return Color(r, g, b);
  }
  uint32_t gamma32(uint32_t x) const { return x; }

 private:
  uint8_t bright_ = 255;
  std::vector<uint32_t> px_;
};
