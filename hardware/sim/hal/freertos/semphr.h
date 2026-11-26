#pragma once
#include <mutex>
#include "FreeRTOS.h"

struct SimMutex {
  std::recursive_mutex mtx;
};
using SemaphoreHandle_t = SimMutex*;

inline SemaphoreHandle_t xSemaphoreCreateMutex() { return new SimMutex(); }
inline BaseType_t xSemaphoreTake(SemaphoreHandle_t h, TickType_t wait) {
  (void)wait;
  if (!h) return pdFALSE;
  h->mtx.lock();
  return pdTRUE;
}
inline BaseType_t xSemaphoreGive(SemaphoreHandle_t h) {
  if (!h) return pdFALSE;
  h->mtx.unlock();
  return pdTRUE;
}
