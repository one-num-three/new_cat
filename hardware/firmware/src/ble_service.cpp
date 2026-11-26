#include "ble_service.h"

#include <NimBLEDevice.h>
#include <freertos/semphr.h>
#include <atomic>

#include "config.h"

namespace ble {
namespace {
QueueHandle_t gCmdQ = nullptr;
NimBLEServer* gServer = nullptr;
NimBLECharacteristic* gEvtChr = nullptr;
NimBLECharacteristic* gInfoChr = nullptr;
std::atomic<bool> gConnected{false};
std::atomic<bool> gJustConnected{false};

uint8_t gBandId[6] = {0};
char gDevName[12] = {0};
InfoSnapshot gLatestInfo{};
SemaphoreHandle_t gInfoMutex = nullptr;

void refreshAdvertising() {
  if (!gServer) return;
  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  if (!adv) return;

  InfoSnapshot snap;
  xSemaphoreTake(gInfoMutex, portMAX_DELAY);
  snap = gLatestInfo;
  xSemaphoreGive(gInfoMutex);

  // 厂商数据: 0xFFFF (Company ID) + 'C' 'M' role team battPct sessionLo sessionHi
  uint8_t mfg[9];
  mfg[0] = 0xFF;
  mfg[1] = 0xFF;
  mfg[2] = 'C';
  mfg[3] = 'M';
  mfg[4] = snap.role;
  mfg[5] = snap.team;
  mfg[6] = snap.battPct;
  mfg[7] = (uint8_t)(snap.session & 0xFF);
  mfg[8] = (uint8_t)((snap.session >> 8) & 0xFF);

  NimBLEAdvertisementData advData;
  advData.setFlags(0x06);  // General Discoverable + BR/EDR Not Supported
  advData.setName(gDevName);
  advData.setManufacturerData(std::string((const char*)mfg, sizeof(mfg)));

  NimBLEAdvertisementData scanResp;
  scanResp.setCompleteServices(NimBLEUUID(BLE_SVC_UUID));

  bool wasAdv = adv->isAdvertising();
  if (wasAdv) adv->stop();
  adv->setAdvertisementData(advData);
  adv->setScanResponseData(scanResp);
  // 未连接宿主手机：可连接广播；已连接宿主手机：不可连接广播（让周围鼠玩家的手机仍可扫到猫的角色与RSSI）
  adv->setAdvertisementType(gConnected.load() ? BLE_GAP_CONN_MODE_NON : BLE_GAP_CONN_MODE_UND);
  adv->start();
}

class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* pServer, ble_gap_conn_desc* desc) override {
    gConnected = true;
    // 连接参数建议：15ms ~ 30ms 保证实时性
    pServer->updateConnParams(desc->conn_handle, 12, 24, 0, 200);
    // 切换为不可连接广播，继续向全场广播角色/电量
    refreshAdvertising();
  }

  void onDisconnect(NimBLEServer* pServer, ble_gap_conn_desc* desc) override {
    (void)pServer;
    (void)desc;
    gConnected = false;
    refreshAdvertising();
  }
};

class CmdCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pCharacteristic, ble_gap_conn_desc* desc) override {
    (void)desc;
    if (!gCmdQ) return;
    NimBLEAttValue val = pCharacteristic->getValue();
    if (val.size() == 0) return;
    BandCmd cmd;
    cmd.len = val.size() > sizeof(cmd.d) ? sizeof(cmd.d) : (uint8_t)val.size();
    memcpy(cmd.d, val.data(), cmd.len);
    xQueueSend(gCmdQ, &cmd, 0);
  }
};

class EvtCallbacks : public NimBLECharacteristicCallbacks {
  void onSubscribe(NimBLECharacteristic* pCharacteristic, ble_gap_conn_desc* desc, uint16_t subValue) override {
    (void)pCharacteristic;
    (void)desc;
    if (subValue > 0) {
      gJustConnected = true;
    }
  }
};

ServerCallbacks gSrvCb;
CmdCallbacks gCmdCb;
EvtCallbacks gEvtCb;
}  // namespace

void begin(const uint8_t bandId[6], QueueHandle_t cmdQ) {
  memcpy(gBandId, bandId, 6);
  gCmdQ = cmdQ;
  gInfoMutex = xSemaphoreCreateMutex();

  snprintf(gDevName, sizeof(gDevName), "CMB-%02X%02X", bandId[4], bandId[5]);

  NimBLEDevice::init(gDevName);
  NimBLEDevice::setMTU(BLE_MTU);
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);  // 户外开最大发射功率 +9 dBm

  gServer = NimBLEDevice::createServer();
  gServer->setCallbacks(&gSrvCb);

  NimBLEService* svc = gServer->createService(BLE_SVC_UUID);

  NimBLECharacteristic* cmdChr = svc->createCharacteristic(
      BLE_CMD_UUID, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  cmdChr->setCallbacks(&gCmdCb);

  gEvtChr = svc->createCharacteristic(BLE_EVENT_UUID, NIMBLE_PROPERTY::NOTIFY);
  gEvtChr->setCallbacks(&gEvtCb);

  gInfoChr = svc->createCharacteristic(BLE_INFO_UUID, NIMBLE_PROPERTY::READ);

  svc->start();

  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  adv->setMinInterval(160);  // 100 ms
  adv->setMaxInterval(320);  // 200 ms

  memset(&gLatestInfo, 0, sizeof(gLatestInfo));
  memcpy(gLatestInfo.bandId, bandId, 6);
  gLatestInfo.fwMajor = FW_VERSION_MAJOR;
  gLatestInfo.fwMinor = FW_VERSION_MINOR;
  updateInfo(gLatestInfo);
}

bool connected() { return gConnected.load(); }

bool takeJustSubscribed() { return gJustConnected.exchange(false); }

bool notify(const uint8_t* data, uint8_t len) {
  if (!gConnected.load() || !gEvtChr) return false;
  gEvtChr->setValue(data, len);
  return gEvtChr->notify();
}

void updateInfo(const InfoSnapshot& info) {
  xSemaphoreTake(gInfoMutex, portMAX_DELAY);
  gLatestInfo = info;
  xSemaphoreGive(gInfoMutex);

  if (gInfoChr) {
    // INFO payload (18 bytes):
    // [0..5] bandId, [6] fwMajor, [7] fwMinor, [8] role, [9] team,
    // [10..13] session(u32 LE), [14..15] battMv(u16 LE), [16] battPct, [17] hwFlags
    uint8_t buf[18];
    memcpy(&buf[0], info.bandId, 6);
    buf[6] = info.fwMajor;
    buf[7] = info.fwMinor;
    buf[8] = info.role;
    buf[9] = info.team;
    memcpy(&buf[10], &info.session, 4);
    memcpy(&buf[14], &info.battMv, 2);
    buf[16] = info.battPct;
    buf[17] = info.hwFlags;
    gInfoChr->setValue(buf, sizeof(buf));
  }

  refreshAdvertising();
}
}  // namespace ble
