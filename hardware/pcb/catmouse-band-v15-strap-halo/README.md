# CatMouse Band V1.5 Strap-Halo / Velcro Lite 主板

本目录是主板工程评审版。用 KiCad 10 打开 `catmouse-band-v15-strap-halo.kicad_pro` 查看原理图、四层 1.00 mm 裸板设计、本地封装和 RF 规则区。机械结构基准与接口在 [EVT-A 机电变更](../../docs/Strap-Halo-EVT-A-机电变更.md)。`catmouse-band-v15` 是 40 × 46 mm 基线参考。

前翼使用主板 J5，后翼使用 J6。沿编号方向分别为 VLED、GND、DIN、DOUT。J5 的 DOUT 经 330 Ω 回到 J6 的 DIN，J6 的 4 脚悬空。座子使用 Hirose FH19C-4S-0.5SH(10)，底面为插舌接触面。磁吸、马达、电池仅在主板底面保留平焊盘。磁吸四线通过 [独立柔性转接](../catmouse-band-v15-pogo-flex/README.md) 接到底壳。

## 验证与投板状态

使用 KiCad 自带的 Python 和 `../verify_strap_halo.py` 可在当前保存版本上复跑 ERC、DRC、原理图一致性和固件物理引脚校验。报告同时检查固件的 10 个 `PIN_*`、USB D± 和 BOOT。

KiCad 10.0.8 的[审查汇总](review/audit.json)记录 ERC 0 项、原理图一致性差异 0 项、固件物理引脚 13/13 一致。PN532 裸露焊盘内有四颗 Ø0.20 mm 接地通孔，钻孔避开钢网开口。[DRC 报告](review/drc.json)记录其他规则违规 0 项和布线未连通 10 项。[物料评审表](review/BOM-review.csv)共 38 项，其中 21 项已有嘉立创目录候选，17 项待配料。[贴装坐标评审表](review/CPL-review.csv)包含顶面 74 个贴装位号。

当前待连通的网络包括 USB、NFC 时钟与发射链路、灯带栅极与回传、IO0 测试点和 IMU 地址脚。主板发板前须完成布线、NFC 弹片与天线尾带选型、USB 实际叠层和 RF 匹配。MCP73831 与 AP2112 保留为参考电源方案，充电温控、终止时的系统负载以及深睡电流须以实际电池和样机确认。生成脚本会重建基线，继续布线时请从已提交的 KiCad 工程打开。
