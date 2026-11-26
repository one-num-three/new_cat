#pragma once
#include <cstdint>

enum esp_deepsleep_gpio_wake_up_mode_t {
  ESP_GPIO_WAKEUP_GPIO_LOW = 0,
  ESP_GPIO_WAKEUP_GPIO_HIGH = 1,
};

int esp_deep_sleep_enable_gpio_wakeup(uint64_t gpio_pin_mask, esp_deepsleep_gpio_wake_up_mode_t mode);
void esp_deep_sleep_start();
