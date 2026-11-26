#pragma once
#include <cstdint>
#include <thread>

using BaseType_t = int;
using TickType_t = uint32_t;
using TaskHandle_t = void*;

constexpr BaseType_t pdTRUE = 1;
constexpr BaseType_t pdFALSE = 0;
constexpr TickType_t portMAX_DELAY = 0xFFFFFFFFu;

inline BaseType_t xTaskCreate(void (*fn)(void*), const char* name, uint32_t stack, void* param, uint32_t prio, TaskHandle_t* out) {
  (void)name; (void)stack; (void)prio;
  std::thread t(fn, param);
  t.detach();
  if (out) *out = nullptr;
  return pdTRUE;
}
