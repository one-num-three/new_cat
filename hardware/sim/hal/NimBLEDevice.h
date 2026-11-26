#pragma once
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

#define ESP_PWR_LVL_P9 9
#define BLE_GAP_CONN_MODE_NON 0
#define BLE_GAP_CONN_MODE_UND 2

namespace NIMBLE_PROPERTY {
constexpr uint32_t READ     = 0x01;
constexpr uint32_t WRITE    = 0x02;
constexpr uint32_t WRITE_NR = 0x04;
constexpr uint32_t NOTIFY   = 0x08;
}  // namespace NIMBLE_PROPERTY

struct ble_gap_conn_desc {
  uint16_t conn_handle = 1;
};

class NimBLEUUID {
 public:
  explicit NimBLEUUID(const char* s) : u_(s ? s : "") {}
  const std::string& str() const { return u_; }
 private:
  std::string u_;
};

class NimBLEAttValue {
 public:
  NimBLEAttValue() = default;
  NimBLEAttValue(const uint8_t* d, size_t n) : v_(d, d + n) {}
  size_t size() const { return v_.size(); }
  const uint8_t* data() const { return v_.data(); }
 private:
  std::vector<uint8_t> v_;
};

class NimBLECharacteristic;
class NimBLEServer;

class NimBLEServerCallbacks {
 public:
  virtual ~NimBLEServerCallbacks() = default;
  virtual void onConnect(NimBLEServer* pServer, ble_gap_conn_desc* desc) { (void)pServer; (void)desc; }
  virtual void onDisconnect(NimBLEServer* pServer, ble_gap_conn_desc* desc) { (void)pServer; (void)desc; }
};

class NimBLECharacteristicCallbacks {
 public:
  virtual ~NimBLECharacteristicCallbacks() = default;
  virtual void onWrite(NimBLECharacteristic* pCharacteristic, ble_gap_conn_desc* desc) { (void)pCharacteristic; (void)desc; }
  virtual void onSubscribe(NimBLECharacteristic* pCharacteristic, ble_gap_conn_desc* desc, uint16_t subValue) {
    (void)pCharacteristic; (void)desc; (void)subValue;
  }
};

class NimBLECharacteristic {
 public:
  NimBLECharacteristic(const char* uuid, uint32_t props) : uuid_(uuid ? uuid : "") { (void)props; }
  void setCallbacks(NimBLECharacteristicCallbacks* cb) { cb_ = cb; }
  void setValue(const uint8_t* data, size_t len) { val_ = NimBLEAttValue(data, len); }
  const NimBLEAttValue& getValue() const { return val_; }
  bool notify();

  const std::string& uuid() const { return uuid_; }
  NimBLECharacteristicCallbacks* callbacks() const { return cb_; }

 private:
  std::string uuid_;
  NimBLEAttValue val_;
  NimBLECharacteristicCallbacks* cb_ = nullptr;
};

class NimBLEService {
 public:
  explicit NimBLEService(const char* uuid) : uuid_(uuid ? uuid : "") {}
  NimBLECharacteristic* createCharacteristic(const char* uuid, uint32_t props);
  void start() {}
 private:
  std::string uuid_;
  std::vector<NimBLECharacteristic*> chrs_;
};

class NimBLEAdvertisementData {
 public:
  void setFlags(uint8_t f) { flags_ = f; }
  void setName(const char* n) { name_ = n ? n : ""; }
  void setManufacturerData(const std::string& m) { mfg_ = m; }
  void setCompleteServices(const NimBLEUUID& u) { svc_ = u.str(); }

  uint8_t flags_ = 0;
  std::string name_;
  std::string mfg_;
  std::string svc_;
};

class NimBLEAdvertising {
 public:
  void setMinInterval(uint16_t v) { minInt_ = v; }
  void setMaxInterval(uint16_t v) { maxInt_ = v; }
  void setAdvertisementData(const NimBLEAdvertisementData& d) { advData_ = d; }
  void setScanResponseData(const NimBLEAdvertisementData& d) { scanResp_ = d; }
  void setAdvertisementType(uint8_t t) { advType_ = t; }
  bool isAdvertising() const { return active_; }
  void stop() { active_ = false; }
  void start();

  uint8_t advType() const { return advType_; }
  const NimBLEAdvertisementData& data() const { return advData_; }

 private:
  uint16_t minInt_ = 0;
  uint16_t maxInt_ = 0;
  uint8_t advType_ = BLE_GAP_CONN_MODE_UND;
  bool active_ = false;
  NimBLEAdvertisementData advData_;
  NimBLEAdvertisementData scanResp_;
};

class NimBLEServer {
 public:
  void setCallbacks(NimBLEServerCallbacks* cb) { cb_ = cb; }
  NimBLEService* createService(const char* uuid);
  void updateConnParams(uint16_t handle, uint16_t minI, uint16_t maxI, uint16_t lat, uint16_t timeout) {
    (void)handle; (void)minI; (void)maxI; (void)lat; (void)timeout;
  }
  NimBLEServerCallbacks* callbacks() const { return cb_; }

 private:
  NimBLEServerCallbacks* cb_ = nullptr;
  std::vector<NimBLEService*> svcs_;
};

class NimBLEDevice {
 public:
  static void init(const char* name);
  static void setMTU(uint16_t mtu);
  static void setPower(int lvl);
  static NimBLEServer* createServer();
  static NimBLEAdvertising* getAdvertising();
  static void startAdvertising();
};
