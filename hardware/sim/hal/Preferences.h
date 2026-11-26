#pragma once
#include <cstdint>
#include <map>
#include <string>
#include "Arduino.h"

class Preferences {
 public:
  bool begin(const char* ns, bool readOnly = false) {
    ns_ = ns ? ns : "";
    (void)readOnly;
    return true;
  }
  uint8_t getUChar(const char* key, uint8_t def = 0) {
    auto it = u8_.find(k(key));
    return it == u8_.end() ? def : it->second;
  }
  void putUChar(const char* key, uint8_t val) { u8_[k(key)] = val; }

  uint16_t getUShort(const char* key, uint16_t def = 0) {
    auto it = u16_.find(k(key));
    return it == u16_.end() ? def : it->second;
  }
  void putUShort(const char* key, uint16_t val) { u16_[k(key)] = val; }

  bool getBool(const char* key, bool def = false) {
    auto it = b_.find(k(key));
    return it == b_.end() ? def : it->second;
  }
  void putBool(const char* key, bool val) { b_[k(key)] = val; }

  String getString(const char* key, const char* def = "") {
    auto it = s_.find(k(key));
    return it == s_.end() ? String(def) : String(it->second);
  }
  void putString(const char* key, const String& val) { s_[k(key)] = val.c_str(); }

 private:
  std::string k(const char* key) const { return ns_ + ":" + (key ? key : ""); }
  std::string ns_;
  std::map<std::string, uint8_t> u8_;
  std::map<std::string, uint16_t> u16_;
  std::map<std::string, bool> b_;
  std::map<std::string, std::string> s_;
};
