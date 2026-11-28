# Strap-Halo / Velcro Lite EVT-A 机电变更

2026-11-28。用户确认保留 ESP32-C3-MINI-1，并授权调整局部结构和天线净空。本页记录相对 [冻结 ICD](PCB与3D结构协同布局规范.md) 的变更。两款腕带共用同一主机和 PCB。共用参数见 [CAD 源码](../cad/strap_halo_geometry.py)。

| 界面 | EVT-A |
|---|---|
| PCB 机械基准 | CAD 原点为主机中心，KiCad 平面坐标 `(100 + X, 100 − Y)` mm。FR4 为 28.4 × 35.4 × 1.0 mm，角 R6.2。 |
| M2 避让 | 按 CAD 原始实体保留 `(±12.6, +11.0)` 的 R2.1 边缘铣缺口。缺口处无板边镀铜。 |
| 顶腔 | 原厂模组 2.40 ± 0.15 mm，按最大本体 2.55 mm 和 0.10 mm 贴装余量建包络。铁氧体底面移到 Z=34.10，模组顶面至铁氧体名义包络余量 0.80 mm。顶壳升高 0.35 mm，主机总厚 12.15 mm。 |
| BLE 天线 | 模组中心仍为 `(-1.7, -9.2)`。天线标称区域 Y=-17.50 至 -12.10。开口铣口 X=-8.90 至 +5.50，深入到 Y=-12.15，内圆角 R0.6。最近模组铜焊盘边界 Y=-11.80，距直唇名义 0.35 mm。 |
| 4 层净空 | 规则区 X=-8.90 至 +8.30、Y=-17.70 至 -11.83，禁止四层铜、焊盘和过孔。近端边界按原厂 MINI-1 的天线旁地焊盘调整。整机 BLE 性能仍需装入电池、铁氧体和腕带后测量。 |
| 声学与侧键 | 蜂鸣器中心移至 `(+10.13, -6.30)`，三个出音槽随 Y 移动。晶振移至 `(-12.30, +6.20)`。侧键中心为 `(+12.25, +1.50)`，开关从 +X 方向按压。 |

原厂尺寸和露铜焊盘来自 [Espressif MINI-1 技术规格书 §10、§11](https://documentation.espressif.com/esp32-c3-mini-1_datasheet_en.pdf)。装机射频检查口径见 [Espressif PCB Layout Design](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32c3/pcb-layout-design.html)。

## 连接器和生产接口

- 灯带座采用底接触 `FH19C-4S-0.5SH(10)` 候选。前翼朝 +Y，后翼朝 −Y。原有 2.2/2.0 mm 宽的窄颈定义已于 3D CAD 中升级闭合为 Hirose 精确规格：ZIF 本体 `4.00 × 2.60 × 0.95 mm`（带翻转锁扣与两侧 MP 焊耳，槽口宽 `2.66 × 0.36 mm`），两翼末端接触舌升级为 **`2.50 × 0.20 × 3.60 mm` PI 补强舌**并深入插接 `1.55 mm`（单侧净空 `0.08 mm`）。[Hirose 连接器图纸与目录](https://www.hirose.com/en/product/p/CL0580-0410-1-10)
- 从 +Z 看主板，底部磁吸盘从 −X 到 +X 依次为 5V、GND、USB D−、USB D+，节距 2.54 mm。原装配差 5.00 mm。经确认增设 [四线柔性转接](../pcb/catmouse-band-v15-pogo-flex/README.md)，并在底壳增加局部通槽和触点焊尾。治具面朝端子的针序随视角镜像。
- 两枚 NFC 弹片的原 CAD 顶面 Z=31.32，线圈尾端底面约 Z=31.39。实际弹片 MPN、压缩行程和两个独立尾带触点须由实装接口闭合。主板预留 2.00 mm 针距焊接区。
- PN532 对应 `PN5321A3HN/C106,55`。按 C106 固件版应用图使用 I0=DVDD、I1=GND、TESTEN=GND。DVDD 兼供本芯片 TVDD/AVDD，按原厂应用图各点去耦，VBAT/PVDD 接 3V3。RF 元件值是初始匹配，需以装机线圈实测阻抗定值。[NXP C106 应用图](https://community.nxp.com/pwmxy87654/attachments/pwmxy87654/nfc/4394/1/PN532C106_Application%2BNote_v1.2.pdf)
- GPIO8 仍为低有效。开漏缓冲器将其与 +BATT 域的 PMOS 栅极隔开，保持 100 kΩ 栅极上拉。GPIO21 经双电源缓冲与 330 Ω 串联器件到前翼。第六颗灯的 DOUT 返回主板，经 330 Ω 进入后翼 DIN。
- 充电电流候选为 100 mA（10 kΩ PROG）。电芯/保护板、温控与插座极性需按实物确认。现有 MCP73831 + AP2112 拓扑没有独立负载分配，充电期间的终止、温升、最低电压余量以及整机深睡电流需要验证。AP2112 数据手册空载典型已为 55 µA。[Diodes AP2112 规格书](https://www.diodes.com/datasheet/download/AP2112.pdf)

两款 17 零件 STEP（Strap-Halo `33.06 g` / Velcro Lite `35.07 g`）、两版原生参数化 Autodesk Fusion 360 脚本（`hardware/cad/fusion360/`）以及全套 17 零件 CAD 工程与连接微距评审图均已同步重建并闭合 Hirose `FH19C` 接触舌与 `17_Pogo_Flex_Interposer` 实模。两款模型均通过 17/17 B-Rep 实体有效性校验与 `0.000 mm³`（阈值 `0.05 mm³`）零干涉检查。
