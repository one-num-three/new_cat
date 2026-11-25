#pragma once
#include <Arduino.h>

// LIS2DH12 三轴加速度计：单击（碰撞）检测
namespace imu {
bool begin();
bool ok();
void setThreshold(uint16_t mg);
uint16_t threshold();
// 若发生碰撞返回 true，并给出峰值加速度（mg）
bool poll(uint16_t& peakMg);
// 深睡前调用：保持碰撞中断，作为唤醒源之一
void prepareSleep();
}  // namespace imu
