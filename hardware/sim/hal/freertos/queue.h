#pragma once
#include <chrono>
#include <condition_variable>
#include <cstring>
#include <deque>
#include <mutex>
#include <vector>
#include "FreeRTOS.h"

struct SimQueue {
  size_t capacity;
  size_t itemSize;
  std::deque<std::vector<uint8_t>> q;
  std::mutex mtx;
  std::condition_variable cv;
};
using QueueHandle_t = SimQueue*;

inline QueueHandle_t xQueueCreate(size_t cap, size_t itemSize) {
  auto* sq = new SimQueue();
  sq->capacity = cap;
  sq->itemSize = itemSize;
  return sq;
}

inline BaseType_t xQueueSend(QueueHandle_t h, const void* item, TickType_t wait) {
  (void)wait;
  if (!h) return pdFALSE;
  std::lock_guard<std::mutex> lk(h->mtx);
  if (h->q.size() >= h->capacity) return pdFALSE;
  std::vector<uint8_t> buf(h->itemSize);
  std::memcpy(buf.data(), item, h->itemSize);
  h->q.push_back(std::move(buf));
  h->cv.notify_one();
  return pdTRUE;
}

inline BaseType_t xQueueOverwrite(QueueHandle_t h, const void* item) {
  if (!h) return pdFALSE;
  std::lock_guard<std::mutex> lk(h->mtx);
  h->q.clear();
  std::vector<uint8_t> buf(h->itemSize);
  std::memcpy(buf.data(), item, h->itemSize);
  h->q.push_back(std::move(buf));
  h->cv.notify_one();
  return pdTRUE;
}

inline BaseType_t xQueueReceive(QueueHandle_t h, void* out, TickType_t wait) {
  if (!h) return pdFALSE;
  std::unique_lock<std::mutex> lk(h->mtx);
  if (wait == 0) {
    if (h->q.empty()) return pdFALSE;
  } else if (wait == portMAX_DELAY) {
    h->cv.wait(lk, [&] { return !h->q.empty(); });
  } else {
    if (!h->cv.wait_for(lk, std::chrono::milliseconds(wait), [&] { return !h->q.empty(); })) {
      return pdFALSE;
    }
  }
  std::memcpy(out, h->q.front().data(), h->itemSize);
  h->q.pop_front();
  return pdTRUE;
}
