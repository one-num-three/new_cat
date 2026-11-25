#include "nfc_manager.h"

#include <atomic>

#include "config.h"
#include "pn532.h"
#include "protocol.h"

namespace nfc {
namespace {
PN532 pn;
bool present = false;
QueueHandle_t evtQ = nullptr;
QueueHandle_t reqQ = nullptr;
SemaphoreHandle_t urlMutex = nullptr;

uint8_t myId[6];
std::atomic<uint8_t> myRole{ROLE_LOBBY};
std::atomic<uint8_t> myTeam{0};
std::atomic<uint32_t> mySession{0};
std::atomic<uint8_t> myFlags{0};
std::atomic<bool> isBusy{false};
std::atomic<bool> cancelReq{false};

struct WindowReq {
  Mode mode;
  uint16_t ms;
};

// ---- 应用标识 ----
const uint8_t AID_CMB[]  = {0xF0, 0x43, 0x4D, 0x42, 0x41, 0x4E, 0x44};  // "CMBAND"
const uint8_t AID_NDEF[] = {0xD2, 0x76, 0x00, 0x00, 0x85, 0x01, 0x01};
constexpr uint8_t INS_HELLO = 0x10;

// ---- NDEF 卡模拟用的文件 ----
const uint8_t CC_FILE[15] = {
    0x00, 0x0F,        // CCLEN
    0x20,              // 映射版本 2.0
    0x00, 0x3B,        // MLe = 59
    0x00, 0x34,        // MLc = 52
    0x04, 0x06,        // NDEF 文件控制 TLV
    0xE1, 0x04,        // 文件 ID
    0x00, 0xFF,        // 最大 NDEF 大小
    0x00,              // 可读
    0xFF,              // 不可写
};
uint8_t ndefFile[128];
uint16_t ndefLen = 0;

// ---- 去重 ----
uint8_t lastPeer[10];
uint8_t lastPeerLen = 0;
uint32_t lastPeerMs = 0;

bool recentlySeen(const uint8_t* id, uint8_t len) {
  return len == lastPeerLen && memcmp(id, lastPeer, len) == 0 &&
         millis() - lastPeerMs < NFC_PEER_COOLDOWN_MS;
}
void markSeen(const uint8_t* id, uint8_t len) {
  lastPeerLen = len > sizeof(lastPeer) ? sizeof(lastPeer) : len;
  memcpy(lastPeer, id, lastPeerLen);
  lastPeerMs = millis();
}

void pushEvent(const uint8_t* d, uint8_t len) {
  BandEvent ev;
  ev.len = len;
  memcpy(ev.d, d, len);
  xQueueSend(evtQ, &ev, 0);
}

// 自己的身份：id6 role team session4
void packIdentity(uint8_t* out) {
  memcpy(out, myId, 6);
  out[6] = myRole.load();
  out[7] = myTeam.load();
  uint32_t s = mySession.load();
  memcpy(&out[8], &s, 4);
}

// 上报 NFC_PEER：[type seq dir id6 role team session4 flags]
void reportPeer(uint8_t dir, const uint8_t* ident12, uint8_t flags) {
  uint8_t e[16];
  e[0] = EVT_NFC_PEER;
  e[1] = 0;
  e[2] = dir;
  memcpy(&e[3], ident12, 12);
  e[15] = flags;
  pushEvent(e, sizeof(e));
}

void buildNdef(const String& prefix) {
  char hex[13];
  snprintf(hex, sizeof(hex), "%02X%02X%02X%02X%02X%02X", myId[0], myId[1], myId[2], myId[3], myId[4], myId[5]);
  String url = prefix + hex;
  uint8_t code = 0x00;
  if (url.startsWith("https://")) { code = 0x04; url = url.substring(8); }
  else if (url.startsWith("http://")) { code = 0x03; url = url.substring(7); }

  size_t ulen = url.length();
  if (ulen > sizeof(ndefFile) - 8) ulen = sizeof(ndefFile) - 8;
  uint8_t payloadLen = 1 + ulen;
  uint16_t msgLen = 4 + payloadLen;  // 记录头 D1 01 len 'U'

  xSemaphoreTake(urlMutex, portMAX_DELAY);
  ndefFile[0] = msgLen >> 8;
  ndefFile[1] = msgLen & 0xFF;
  ndefFile[2] = 0xD1;  // MB ME SR TNF=Well-known
  ndefFile[3] = 0x01;  // type length
  ndefFile[4] = payloadLen;
  ndefFile[5] = 'U';
  ndefFile[6] = code;
  memcpy(&ndefFile[7], url.c_str(), ulen);
  ndefLen = 2 + msgLen;
  xSemaphoreGive(urlMutex);
}

// ================= 读卡方 =================
// 返回 true 表示本窗口已完成一次有效交互
bool pollOnce() {
  uint8_t uid[10], uidLen = 0, sak = 0;
  if (!pn.inListPassiveTarget(uid, uidLen, sak, 80)) return false;

  bool done = false;
  if (sak & 0x20) {
    // ISO-DEP：可能是另一只手环
    uint8_t sel[13] = {0x00, 0xA4, 0x04, 0x00, 0x07};
    memcpy(&sel[5], AID_CMB, 7);
    sel[12] = 0x00;
    uint8_t r[40];
    uint8_t rl = sizeof(r);
    if (pn.inDataExchange(sel, sizeof(sel), r, rl, 150) && rl >= 2 && r[rl - 2] == 0x90 && r[rl - 1] == 0x00) {
      uint8_t hello[18] = {0x80, INS_HELLO, 0x00, 0x00, 12};
      packIdentity(&hello[5]);
      hello[17] = 0x00;
      rl = sizeof(r);
      if (pn.inDataExchange(hello, sizeof(hello), r, rl, 150) && rl >= 15 && r[rl - 2] == 0x90) {
        if (!recentlySeen(r, 6)) {
          markSeen(r, 6);
          reportPeer(0, r, r[12]);
        }
        done = true;
      }
    }
  } else if (!recentlySeen(uid, uidLen)) {
    // Type 2 道具卡（NTAG）：读第 4 页起 16 字节，上报前 8 字节
    uint8_t rd[2] = {0x30, 0x04};
    uint8_t r[20];
    uint8_t rl = sizeof(r);
    uint8_t e[18] = {EVT_NFC_ITEM, 0};
    e[2] = uidLen > 7 ? 7 : uidLen;
    memcpy(&e[3], uid, e[2]);
    if (pn.inDataExchange(rd, sizeof(rd), r, rl, 100) && rl >= 8) memcpy(&e[10], r, 8);
    markSeen(uid, uidLen);
    pushEvent(e, sizeof(e));
    done = true;
  } else {
    done = true;  // 同一张卡刚读过
  }
  pn.inRelease();
  return done;
}

// ================= 卡模拟方 =================
enum Selected { SEL_NONE, SEL_CMB, SEL_NDEF_APP, SEL_CC, SEL_NDEF_FILE };

struct TargetResult {
  bool hello = false;
  bool bindRead = false;
};

uint8_t handleApdu(const uint8_t* c, int n, uint8_t* resp, Selected& sel, TargetResult& res) {
  auto sw = [&](uint8_t pos, uint8_t a, uint8_t b) -> uint8_t { resp[pos] = a; resp[pos + 1] = b; return pos + 2; };
  if (n < 4) return sw(0, 0x67, 0x00);
  uint8_t cla = c[0], ins = c[1], p1 = c[2], p2 = c[3];

  // SELECT
  if (ins == 0xA4) {
    if (p1 == 0x04 && n >= 5 + 7) {
      if (memcmp(&c[5], AID_CMB, 7) == 0) { sel = SEL_CMB; return sw(0, 0x90, 0x00); }
      if (memcmp(&c[5], AID_NDEF, 7) == 0) { sel = SEL_NDEF_APP; return sw(0, 0x90, 0x00); }
      return sw(0, 0x6A, 0x82);
    }
    if ((p1 == 0x00 || p1 == 0x02) && n >= 7 && sel != SEL_NONE && sel != SEL_CMB) {
      uint16_t fid = (c[5] << 8) | c[6];
      if (fid == 0xE103) { sel = SEL_CC; return sw(0, 0x90, 0x00); }
      if (fid == 0xE104) { sel = SEL_NDEF_FILE; return sw(0, 0x90, 0x00); }
    }
    return sw(0, 0x6A, 0x82);
  }

  // READ BINARY
  if (ins == 0xB0 && (sel == SEL_CC || sel == SEL_NDEF_FILE)) {
    uint16_t off = (p1 << 8) | p2;
    uint16_t le = n >= 5 ? c[4] : 0;
    if (le == 0) le = 59;
    if (le > 59) le = 59;
    const uint8_t* file;
    uint16_t size;
    if (sel == SEL_CC) { file = CC_FILE; size = sizeof(CC_FILE); }
    else { file = ndefFile; size = ndefLen; res.bindRead = res.bindRead || off >= 2; }
    if (off > size) return sw(0, 0x6B, 0x00);
    uint16_t cnt = size - off < le ? size - off : le;
    xSemaphoreTake(urlMutex, portMAX_DELAY);
    memcpy(resp, file + off, cnt);
    xSemaphoreGive(urlMutex);
    return sw(cnt, 0x90, 0x00);
  }

  // HELLO（手环之间）
  if (cla == 0x80 && ins == INS_HELLO && sel == SEL_CMB && n >= 5 + 12) {
    const uint8_t* peer = &c[5];
    if (!recentlySeen(peer, 6)) {
      markSeen(peer, 6);
      reportPeer(1, peer, 0);
    }
    res.hello = true;
    packIdentity(resp);
    resp[12] = myFlags.load();
    return sw(13, 0x90, 0x00);
  }

  return sw(0, 0x6D, 0x00);
}

void serveTarget(const uint8_t* initCmd, uint8_t initLen, TargetResult& res) {
  Selected sel = SEL_NONE;
  uint8_t cmd[80], resp[80];
  if (initLen > 0) {
    uint8_t rl = handleApdu(initCmd, initLen, resp, sel, res);
    if (!pn.tgSetData(resp, rl, 100)) return;
  }
  uint32_t start = millis();
  while (millis() - start < 1500) {
    int n = pn.tgGetData(cmd, sizeof(cmd), 300);
    if (n < 0) break;  // 读卡器离开
    uint8_t rl = handleApdu(cmd, n, resp, sel, res);
    if (!pn.tgSetData(resp, rl, 100)) break;
  }
}

// ================= 窗口调度 =================
void runWindow(const WindowReq& req) {
  uint8_t role = myRole.load();
  Mode mode = req.mode;
  if (mode == MODE_AUTO) {
    if (role == ROLE_OUT) return;
    if (role == ROLE_CAT) mode = MODE_POLL;
    else if (role == ROLE_JAILED || role == ROLE_LOBBY) mode = MODE_LISTEN;
  }
  bool bindWindow = (req.mode == MODE_LISTEN && req.ms >= NFC_BIND_WINDOW_MS);

  if (!pn.wake()) return;
  isBusy = true;
  cancelReq = false;
  uint32_t end = millis() + req.ms;
  bool listenTurn = true;  // 自由的鼠：先 Listen（被抓优先）
  bool done = false;

  while (!done && !cancelReq && (int32_t)(end - millis()) > 0) {
    uint32_t remain = end - millis();
    bool doPoll;
    uint32_t slot;
    if (mode == MODE_POLL) { doPoll = true; slot = remain; }
    else if (mode == MODE_LISTEN) { doPoll = false; slot = remain; }
    else {  // 自由的鼠：交替
      doPoll = !listenTurn;
      slot = doPoll ? NFC_MOUSE_POLL_SLOT_MS : NFC_MOUSE_LISTEN_SLOT_MS;
      if (slot > remain) slot = remain;
      listenTurn = !listenTurn;
    }

    uint32_t slotEnd = millis() + slot;
    if (doPoll) {
      pn.rfField(true);
      while (!done && !cancelReq && (int32_t)(slotEnd - millis()) > 0) done = pollOnce();
      pn.rfField(false);
    } else {
      while (!done && !cancelReq && (int32_t)(slotEnd - millis()) > 0) {
        uint32_t left = slotEnd - millis();
        // 绑定窗口分段等待，方便及时响应取消
        uint8_t initCmd[80];
        uint8_t initLen = sizeof(initCmd);
        int r = pn.tgInitAsTarget(initCmd, initLen, left > 2000 ? 2000 : left);
        if (r == 1) {
          TargetResult res;
          serveTarget(initCmd, initLen, res);
          if (res.bindRead) {
            uint8_t e[2] = {EVT_NFC_BIND_READ, 0};
            pushEvent(e, 2);
          }
          done = bindWindow ? res.bindRead : (res.hello || res.bindRead);
        } else if (r < 0) {
          delay(20);
        }
      }
    }
  }
  pn.rfField(false);
  pn.powerDown();
  isBusy = false;
}

void task(void*) {
  WindowReq req;
  for (;;) {
    if (xQueueReceive(reqQ, &req, portMAX_DELAY) == pdTRUE) runWindow(req);
  }
}
}  // namespace

bool begin(const uint8_t bandId[6], QueueHandle_t eventQ) {
  memcpy(myId, bandId, 6);
  evtQ = eventQ;
  urlMutex = xSemaphoreCreateMutex();
  reqQ = xQueueCreate(1, sizeof(WindowReq));
  buildNdef(DEFAULT_BIND_URL);

  present = pn.begin(PIN_NFC_RST);
  if (!present) return false;
  pn.rfField(false);
  pn.powerDown();
  xTaskCreate(task, "nfc", 4096, nullptr, 2, nullptr);
  return true;
}

bool ok() { return present; }
bool busy() { return isBusy.load(); }

void setIdentity(uint8_t role, uint8_t team, uint32_t session) {
  myRole = role;
  myTeam = team;
  mySession = session;
}
void setFlags(uint8_t flags) { myFlags = flags; }
void setBindUrl(const String& prefix) { buildNdef(prefix); }

void requestWindow(Mode mode, uint16_t ms) {
  if (!present || isBusy.load()) return;
  WindowReq r{mode, ms};
  xQueueOverwrite(reqQ, &r);
}

void cancel() { cancelReq = true; }

void sleep() {
  cancel();
  uint32_t t = millis();
  while (isBusy.load() && millis() - t < 3000) delay(10);
}
}  // namespace nfc
