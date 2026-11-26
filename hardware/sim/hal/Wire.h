#pragma once
#include <cstdint>
#include <vector>

class TwoWire {
 public:
  bool begin(int sda, int scl, uint32_t freq = 100000);
  void end();
  void setTimeOut(uint16_t ms);
  void beginTransmission(uint8_t addr);
  size_t write(uint8_t b);
  size_t write(const uint8_t* data, size_t len);
  uint8_t endTransmission(bool sendStop = true);
  int requestFrom(int addr, int len);
  int read();

 private:
  uint8_t txAddr_ = 0;
  std::vector<uint8_t> txBuf_;
  std::vector<uint8_t> rxBuf_;
  size_t rxPos_ = 0;
};

extern TwoWire Wire;
