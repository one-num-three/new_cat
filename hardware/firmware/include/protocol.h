#pragma once
#include <stdint.h>

// 角色
enum Role : uint8_t {
  ROLE_LOBBY  = 0,
  ROLE_CAT    = 1,
  ROLE_MOUSE  = 2,
  ROLE_JAILED = 3,
  ROLE_OUT    = 4,
  ROLE_COUNT
};

// BLE 指令
enum CmdOp : uint8_t {
  CMD_SET_ROLE        = 0x01,
  CMD_SET_SESSION     = 0x02,
  CMD_LED             = 0x03,
  CMD_HAPTIC          = 0x04,
  CMD_BUZZER          = 0x05,
  CMD_NFC_WINDOW      = 0x06,
  CMD_IMU_THRESHOLD   = 0x07,
  CMD_IDENTIFY        = 0x08,
  CMD_BIND_URL_BEGIN  = 0x09,
  CMD_BIND_URL_APPEND = 0x0A,
  CMD_BIND_URL_COMMIT = 0x0B,
  CMD_POWER_OFF       = 0x0C,
  CMD_BRIGHTNESS      = 0x0D,
  CMD_STANDALONE      = 0x0E,
};

// BLE 事件
enum EvtType : uint8_t {
  EVT_BOOT          = 0x01,
  EVT_BUTTON        = 0x02,
  EVT_IMPACT        = 0x03,
  EVT_NFC_PEER      = 0x04,
  EVT_NFC_ITEM      = 0x05,
  EVT_BATTERY       = 0x06,
  EVT_NFC_BIND_READ = 0x07,
  EVT_ACK           = 0x08,
  EVT_ROLE_CHANGED  = 0x09,
  EVT_LOW_BATTERY   = 0x0A,
};

enum AckResult : uint8_t { ACK_OK = 0, ACK_BAD_ARGS = 1, ACK_UNKNOWN = 2 };
enum RoleReason : uint8_t { REASON_CMD = 0, REASON_LOCAL_RULE = 1, REASON_BUTTON = 2 };
enum ButtonKind : uint8_t { BTN_NONE = 0, BTN_SHORT = 1, BTN_DOUBLE = 2, BTN_LONG = 3, BTN_POWER = 4 };

// 振动 / 蜂鸣图案
enum Pattern : uint8_t {
  PAT_TICK = 0, PAT_DOUBLE, PAT_CAUGHT, PAT_RESCUED, PAT_HEARTBEAT,
  PAT_COUNTDOWN, PAT_ITEM, PAT_ERROR, PAT_CATCH_OK, PAT_START,
  PAT_COUNT
};

// 事件包：d[0]=type, d[1]=seq（由主循环填写）
struct BandEvent {
  uint8_t len;
  uint8_t d[20];
};

// 指令包
struct BandCmd {
  uint8_t len;
  uint8_t d[180];
};
