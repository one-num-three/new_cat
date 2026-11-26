# 猫鼠手环 V1.5 EVT —— 4 层紧凑主板设计与打样说明

> 工程路径：`hardware/pcb/catmouse-band-v15/`（KiCad 10.0 原生工程，自带官方自包含符号与封装，双击 `.kicad_pro` 即可直接打开）  
> 状态：**EVT 工程验证候选版（已通过 KiCad 10 官方 ERC 0 违规、4 层 PCB DRC 0 错误 / 0 未连接飞线、网表-固件 12 引脚 100% 对齐及虚拟 USB-JTAG 烧录全链路联调）**

---

## 1. 板卡规格与 4 层叠层（嘉立创标准工艺）

| 参数 | 指标 | 说明 |
|---|---|---|
| **外形尺寸** | **40.0 mm × 46.0 mm（圆角 R = 14.0 mm）** | 运动手表表盘比例，有效面积约 `16.7 cm²`，含 2 个 M2 金属化接地安装孔（防 ESD） |
| **层数与板厚** | **4 层板，板厚 1.0 mm** | 推荐嘉立创 `JLC04101H-7628` 叠层，沉金（ENIG）利于背面磁吸触点耐磨 |
| **最小线宽 / 间距** | 信号 `0.145 mm`，电源 `0.16–0.18 mm`，最小间距 `≥ 0.127 mm` | 完全落在嘉立创 4 层免费基础工艺窗口内 |
| **过孔规格** | **外径 `0.45 mm` / 钻孔 `0.20 mm`**（通孔） | 嘉立创 4 层板 0.20mm 过孔免费（无盲埋孔、无盘中孔额外费用） |

### 4 层功能分配

| 铜层 | 职责 | 关键设计原则 |
|---|---|---|
| **L1 (`F.Cu` 顶层)** | 360° 12× `WS2812B-2020` 发光圆环 + 中心声学贴片蜂鸣器 `LS1` + 充电指示灯 `D13` + 局部去耦 | 12 颗灯珠沿 `(100.0, 105.5)` 半径 `14.2 mm` 等距 30° 排布，与北侧 BLE 天线保持 `> 5 mm` 纯净隔离；蜂鸣器居中朝外发声不被手腕闷住 |
| **L2 (`In1.Cu` 内层1)** | **完整连续 `GND` 参考地平面** | 紧邻顶层与高频器件提供最短低感回流路径；严格切在 `y ≥ 84.25 mm`，确保北侧 2.4GHz 天线 4 层全净空 |
| **L3 (`In2.Cu` 内层2)** | **`+3V3` 电源平面 + `+BATT` / `VLED` / `+5V` 电源分配** | 电源与地紧耦合形成天然去耦电容；同样避让北侧天线禁布区 |
| **L4 (`B.Cu` 底层)** | `ESP32-C3-WROOM-02` + `PN5321A3HN` + `27.12MHz` 晶振 + `LIS2DH12TR` + `MCP73831` + `AP2112K-3.3` + `AO3401A/AO3400A` + 背面 4-pin 磁吸口 `J1` + 电池/NFC/马达座 | 射频、数字、电源分区隔离，北侧天线隔离边界布置 GND 缝合屏蔽地过孔 |

---

## 2. 遵循的关键 PCB 与电气设计原则

1. **2.4GHz BLE 天线 4 层全净空**：`U1 (ESP32-C3-WROOM-02)` 置于北缘，倒 F 天线探至板边，其官方禁布区（`y < 84.5 mm`）在全部 4 层严禁铺铜、走线、打孔或放置器件，并在 `y = 85.6 mm` 打一排 GND 缝合屏蔽过孔。
2. **13.56MHz 双模 NFC 与 2.4GHz 远距隔离**：`U2 (PN5321A3HN)` 位于西南象限（距 BLE 天线 `> 25 mm`）；`27.12MHz` 晶体紧贴 `OSCIN/OSCOUT` 并下覆完整 L2 地平面；`TX1/TX2` 经差分 `560nH` EMC 滤波 + `150pF/47pF` 匹配网络直达 `J3` 环形 FPC 天线座；`DVDD (Pin 39)` 作为芯片内部 1.8V 稳压输出仅接独立 `100nF` 退耦电容（严禁外接 3.3V）。
3. **高边 PMOS 灯环断电兼顾启动配置**：`Q1 (AO3401A)` 由 `GPIO8` 控制，栅极经 `R17 (100kΩ)` 上拉至 `+BATT` —— 上电瞬间既默认关闭 12 颗灯珠切断 `~12 mA` 暗电流，又自然满足 ESP32-C3 `GPIO8` 上电高电平启动约束。
4. **磁吸一线充电 + 原生 USB Serial/JTAG 烧录**：背面 `J1` 4-pin 贴片触点引出 `+5V / GND / USB_DN (GPIO18) / USB_DP (GPIO19)`（串 `22Ω` 匹配电阻），无需 CH340/CP2102 桥接芯片，卡入 20 联充电箱即可一线充电、烧录固件与串口自动产测。
5. **双向引脚防短路与感性续流**：`LIS2DH12` 双向地址脚 `SA0/SDO` 经 `R19 (10kΩ)` 上拉至 `+3V3`（选 `0x19` 地址并防推挽短路，通过 ERC 零警告验证）；马达驱动 `Q2 (AO3400A)` 反并 `D14 (1N4148W)` 吸收关断反电动势，栅极加 `100kΩ` 下拉防复位误抖。

---

## 3. 网表与 EVT 固件引脚 100% 物理对齐

固件 `firmware/platformio.ini` 已新增 `[env:evt_4layer_pcb]`（宏 `-DCATMOUSE_EVT_4LAYER_PCB`，自动启用 `PIN_LED_PWR = 8` 高边断电与 `400 kHz` I2C），经 `pcb/verify_netlist_vs_firmware.py` 针对 KiCad 10 官方网表自动校验 12 根引脚 100% 一一对应：

| 固件宏 | ESP32-C3 GPIO | WROOM-02 引脚 | 原理图 / PCB 网络 | 功能 |
|---|---|---|---|---|
| `PIN_BATT_ADC` | `GPIO2` | Pin 16 | `BATT_ADC` | 200k+200k 电池电量分压 |
| `PIN_IMU_INT` | `GPIO3` | Pin 15 | `IMU_INT` | LIS2DH12 碰撞中断（可唤醒） |
| `PIN_BUTTON` | `GPIO4` | Pin 3 | `BTN_USER` | 侧按轻触键（深睡低电平唤醒） |
| `PIN_MOTOR` | `GPIO5` | Pin 4 | `MOTOR_PWM` | Q2 AO3400A 1027 马达驱动 |
| `PIN_SDA` / `PIN_SCL` | `GPIO6` / `GPIO7` | Pin 5 / 6 | `I2C_SDA` / `I2C_SCL` | 400kHz I2C（LIS2DH12 + PN532） |
| `PIN_LED_PWR` | `GPIO8` | Pin 7 | `LED_PWR_EN` | Q1 AO3401A 高边 PMOS 断电 |
| `BOOT_STRAP` | `GPIO9` | Pin 8 | `BOOT_SW` | 10k 上拉 + `TP1` 强制下载点 |
| `PIN_NFC_RST` | `GPIO10` | Pin 10 | `NFC_RST` | PN532 `~RSTPD` 硬件复位 |
| `USB_JTAG` | `GPIO18` / `GPIO19` | Pin 13 / 14 | `USB_DN` / `USB_DP` | 磁吸口原生 USB 烧录/产测 |
| `PIN_BUZZER` | `GPIO20` | Pin 11 | `BUZZER_PWM` | Q3 AO3400A 贴片无源蜂鸣器 |
| `PIN_LED_DATA` | `GPIO21` | Pin 12 | `LED_DATA` | 经 330Ω 驱动 12× WS2812B-2020 |

---

## 4. KiCad 10 官方检测与虚拟烧录验证汇总

| 校验项 | 执行工具 / 脚本 | 实测结果 |
|---|---|---|
| **原理图 ERC 电气规则检测** | `kicad-cli sch erc --severity-all` | **0 错误，0 警告**（`erc_report.json`） |
| **4 层 PCB DRC 设计规则检测** | `kicad-cli pcb drc --severity-all`（嘉立创 4 层 `.kicad_dru`） | **0 错误，0 未连接飞线**（仅 1 条无害内层孤铜角提示 `isolated_copper`，`drc_report.json`） |
| **网表 ↔ 固件引脚一致性** | `pcb/verify_netlist_vs_firmware.py` | **12/12 关键 MCU 引脚 100% 物理对齐** |
| **EVT 真实固件编译与虚拟烧录联调** | `sim/run_evt_virtual_flash_and_hil.py`（`-DCATMOUSE_EVT_4LAYER_PCB`） | **0 警告编译通过，USB-JTAG 虚拟烧录 + GPIO8 PMOS 断电 + 400kHz I2C + 6 大多手环场景 100% 通过** |
| **嘉立创生产制造文件与 3D 预览** | `pcb/export_fab_and_renders.py` | `fab_jlcpcb/` 15 份全套 4 层 Gerber + Excellon 钻孔 + CPL + BOM；`previews/` Top/Bottom/Iso 3D 渲染图与原理图 PDF |

> 注：本版定位为 **EVT 工程打样候选版**。实板回厂后建议重点实测：① 13.56MHz NFC 线圈匹配网络 (`L1/L2/C16~C19`) 按实装 FPC 线圈电感做 VNA 微调；② 背面 4-pin 磁吸触点 (`J1`) 对应充电箱顶针机械公差与防反接极性确认；③ 2.4GHz BLE 空口 RSSI 标定。
