#pragma once
#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

#ifndef PI
#define PI 3.14159265358979323846f
#endif

#ifndef IRAM_ATTR
#define IRAM_ATTR
#endif

#define INPUT        0x01
#define OUTPUT       0x02
#define INPUT_PULLUP 0x05

#define LOW          0
#define HIGH         1

#define RISING       1
#define FALLING      2
#define CHANGE       3

#define ADC_11db     3

class String {
 public:
  String() = default;
  String(const char* s) : s_(s ? s : "") {}
  String(const std::string& s) : s_(s) {}
  String(const String&) = default;
  String& operator=(const String&) = default;
  String& operator=(const char* s) { s_ = s ? s : ""; return *this; }

  size_t length() const { return s_.size(); }
  const char* c_str() const { return s_.c_str(); }
  bool startsWith(const char* p) const {
    size_t n = std::strlen(p);
    return s_.size() >= n && s_.compare(0, n, p) == 0;
  }
  String substring(size_t from) const {
    return from >= s_.size() ? String("") : String(s_.substr(from));
  }
  void trim() {
    size_t a = 0;
    while (a < s_.size() && std::isspace((unsigned char)s_[a])) a++;
    size_t b = s_.size();
    while (b > a && std::isspace((unsigned char)s_[b - 1])) b--;
    s_ = s_.substr(a, b - a);
  }
  void toUpperCase() {
    for (char& c : s_) c = (char)std::toupper((unsigned char)c);
  }
  int toInt() const { return std::atoi(s_.c_str()); }

  String& operator+=(char c) { s_.push_back(c); return *this; }
  String& operator+=(const char* rhs) { if (rhs) s_ += rhs; return *this; }
  String& operator+=(const String& rhs) { s_ += rhs.s_; return *this; }
  String operator+(const char* rhs) const { return String(s_ + (rhs ? rhs : "")); }
  String operator+(const String& rhs) const { return String(s_ + rhs.s_); }
  bool operator==(const char* rhs) const { return s_ == (rhs ? rhs : ""); }
  bool operator!=(const char* rhs) const { return !(*this == rhs); }

 private:
  std::string s_;
};

class SimSerial {
 public:
  void begin(unsigned long baud);
  int available();
  int read();
  void println(const char* s = "");
  void printf(const char* fmt, ...);
};
extern SimSerial Serial;

uint32_t millis();
void delay(uint32_t ms);
void delayMicroseconds(uint32_t us);

void pinMode(int pin, int mode);
void digitalWrite(int pin, int val);
int digitalRead(int pin);

int digitalPinToInterrupt(int pin);
void attachInterrupt(int irq, void (*fn)(), int mode);

void analogReadResolution(int bits);
void analogSetPinAttenuation(int pin, int atten);
uint32_t analogReadMilliVolts(int pin);

void ledcSetup(uint8_t ch, double freq, uint8_t res);
void ledcAttachPin(int pin, uint8_t ch);
void ledcWriteTone(uint8_t ch, double freq);
